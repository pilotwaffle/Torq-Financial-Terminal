// Cron entrypoint — called by Vercel Cron every 4 hours starting 08:00 ET.
// Pulls news + filings + movers in parallel, writes to Supabase, audits each run.
//
// Auth: Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when
// CRON_SECRET is set in env. We reject anything else to prevent abuse.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchPolygonNews } from "@/lib/fetchers/polygon";
import { fetchFinnhubGeneralNews } from "@/lib/fetchers/finnhub";
import { fetchRecentEdgarFilings } from "@/lib/fetchers/edgar";
import { fetchFmpMovers } from "@/lib/fetchers/fmp";
import { fetchCongressTrades } from "@/lib/fetchers/congress";
import { generateBriefing } from "@/lib/fetchers/briefing";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — Vercel Hobby supports up to 60s for cron

export async function GET(req: NextRequest) {
  // Vercel cron auth
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Create an audit row
  const { data: run, error: runErr } = await supabaseAdmin
    .from("news_cron_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 });
  const runId = run!.id;

  const errors: { stage: string; message: string }[] = [];
  let newsInserted = 0;
  let filingsInserted = 0;
  let moversInserted = 0;
  let congressInserted = 0;
  let briefingInserted = 0;

  // Pull window: anything published in the last 6 hours (cron runs every 4, 2hr overlap)
  const sinceISO = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  // ---------- News: Polygon primary, Finnhub fallback ----------
  try {
    const polyNews = await fetchPolygonNews(sinceISO, 100);
    if (polyNews.length > 0) {
      const rows = polyNews.map((n) => ({
        source: "polygon",
        source_id: n.id,
        headline: n.title,
        summary: n.description ?? null,
        url: n.article_url,
        publisher: n.publisher?.name ?? null,
        tickers: n.tickers ?? [],
        image_url: n.image_url ?? null,
        keywords: n.keywords ?? [],
        sentiment: n.insights?.[0]?.sentiment ?? null,
        published_at: n.published_utc,
      }));
      const { error, count } = await supabaseAdmin
        .from("news_items")
        .upsert(rows, { onConflict: "source,source_id", count: "exact" });
      if (error) throw error;
      newsInserted += count ?? rows.length;
    } else {
      // Fallback to Finnhub
      const fhNews = await fetchFinnhubGeneralNews();
      const rows = fhNews.slice(0, 100).map((n) => ({
        source: "finnhub",
        source_id: String(n.id),
        headline: n.headline,
        summary: n.summary || null,
        url: n.url,
        publisher: n.source || null,
        tickers: n.related ? n.related.split(",").filter(Boolean) : [],
        image_url: n.image || null,
        keywords: [],
        sentiment: null,
        published_at: new Date(n.datetime * 1000).toISOString(),
      }));
      const { error, count } = await supabaseAdmin
        .from("news_items")
        .upsert(rows, { onConflict: "source,source_id", count: "exact" });
      if (error) throw error;
      newsInserted += count ?? rows.length;
    }
  } catch (e: any) {
    errors.push({ stage: "news", message: String(e?.message ?? e) });
  }

  // ---------- Filings: SEC EDGAR (dedup within batch) ----------
  try {
    const filings = await fetchRecentEdgarFilings();
    const seen = new Set<string>();
    const unique = filings.filter((f) => {
      if (seen.has(f.accessionNumber)) return false;
      seen.add(f.accessionNumber);
      return true;
    });
    if (unique.length > 0) {
      const rows = unique.map((f) => ({
        accession_number: f.accessionNumber,
        cik: f.cik,
        company_name: f.companyName,
        ticker: f.ticker ?? null,
        form_type: f.formType,
        title: f.title,
        filing_url: f.filingUrl,
        document_url: f.documentUrl ?? null,
        filed_at: f.filedAt,
      }));
      const { error, count } = await supabaseAdmin
        .from("news_filings")
        .upsert(rows, { onConflict: "accession_number", count: "exact" });
      if (error) throw error;
      filingsInserted += count ?? rows.length;
    }
  } catch (e: any) {
    errors.push({ stage: "filings", message: String(e?.message ?? e) });
  }

  // ---------- Movers: FMP /stable feeds (v3 legacy endpoints are dead) ----------
  try {
    if (!process.env.FMP_API_KEY) throw new Error("FMP_API_KEY not set — skipping movers");
    const [gainers, losers, active] = await Promise.all([
      fetchFmpMovers("gainers"),
      fetchFmpMovers("losers"),
      fetchFmpMovers("actives"),
    ]);
    const capturedAt = new Date().toISOString();
    const toRow = (category: "gainers" | "losers" | "volume") => (m: any, i: number) => ({
      captured_at: capturedAt,
      category,
      rank: i + 1,
      ticker: m.symbol,
      company_name: m.name ?? null,
      last_price: m.price ?? null,
      change_amount: m.change ?? null,
      change_percent: m.changesPercentage ?? null,
      volume: m.volume ?? null,
      prev_close: m.prevClose ?? null,
    });
    const rows = [
      ...gainers.slice(0, 20).map(toRow("gainers")),
      ...losers.slice(0, 20).map(toRow("losers")),
      ...active.slice(0, 20).map(toRow("volume")),
    ];
    if (rows.length > 0) {
      const { error, count } = await supabaseAdmin
        .from("news_movers")
        .insert(rows, { count: "exact" });
      if (error) throw error;
      moversInserted += count ?? rows.length;
    }
  } catch (e: any) {
    errors.push({ stage: "movers", message: String(e?.message ?? e) });
  }

  // ---------- Congress trades: FMP house-latest + senate-latest ----------
  try {
    const trades = await fetchCongressTrades();
    // Dedup within batch on the table's unique key
    // (representative, ticker, transaction_date, transaction_type, amount_range)
    const seen = new Set<string>();
    const unique = trades.filter((t) => {
      const k = `${t.representative}|${t.ticker}|${t.transactionDate}|${t.transactionType}|${t.amountRange}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (unique.length > 0) {
      const rows = unique.map((t) => ({
        representative: t.representative,
        bio_guide_id: t.bioGuideId,
        party: null, // FMP feed doesn't provide party affiliation
        chamber: t.chamber,
        state: t.state,
        ticker: t.ticker,
        transaction_type: t.transactionType,
        amount_range: t.amountRange,
        amount_low: t.amountLow,
        transaction_date: t.transactionDate,
        report_date: t.reportDate,
        description: t.description,
      }));
      const { error, count } = await supabaseAdmin
        .from("news_congress_trades")
        .upsert(rows, {
          onConflict: "representative,ticker,transaction_date,transaction_type,amount_range",
          count: "exact",
          ignoreDuplicates: true,
        });
      if (error) throw error;
      congressInserted += count ?? rows.length;
    }
  } catch (e: any) {
    errors.push({ stage: "congress", message: String(e?.message ?? e) });
  }

  // ---------- Daily briefing: AI summary of recent news + filings ----------
  try {
    const [{ data: recentNews }, { data: recentFilings }] = await Promise.all([
      supabaseAdmin
        .from("news_items")
        .select("headline, tickers, sentiment")
        .order("published_at", { ascending: false })
        .limit(60),
      supabaseAdmin
        .from("news_filings")
        .select("company_name, form_type, ticker")
        .order("filed_at", { ascending: false })
        .limit(30),
    ]);
    const briefing = await generateBriefing({
      headlines: (recentNews ?? []) as any,
      filings: (recentFilings ?? []) as any,
    });
    if (briefing) {
      const { error } = await supabaseAdmin.from("news_briefings").insert({
        content: briefing.content,
        model_used: briefing.model,
        news_count: briefing.newsCount,
        filings_count: briefing.filingsCount,
      });
      if (error) throw error;
      briefingInserted = 1;
    }
  } catch (e: any) {
    errors.push({ stage: "briefing", message: String(e?.message ?? e) });
  }

  // ---------- Close audit row ----------
  const TOTAL_STAGES = 5;
  const status = errors.length === 0 ? "ok" : errors.length >= TOTAL_STAGES ? "failed" : "partial";
  await supabaseAdmin
    .from("news_cron_runs")
    .update({
      finished_at: new Date().toISOString(),
      status,
      news_inserted: newsInserted,
      filings_inserted: filingsInserted,
      movers_inserted: moversInserted,
      errors,
    })
    .eq("id", runId);

  return NextResponse.json({
    runId,
    status,
    news_inserted: newsInserted,
    filings_inserted: filingsInserted,
    movers_inserted: moversInserted,
    congress_inserted: congressInserted,
    briefing_inserted: briefingInserted,
    errors,
  });
}
