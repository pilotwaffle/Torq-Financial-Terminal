// TORQ Advisor — the advisory/governance layer.
//
// Flow: classify question -> gather relevant data from Supabase -> build a
// "Prince Flowers" prompt with governance framing (source/time caveats,
// not-financial-advice) -> call the Messages API -> return a structured result.
// The caller (/api/advisor) writes the audit row.
//
// No SDK dependency — calls the Anthropic REST endpoint directly with fetch.

import { supabaseAdmin } from "@/lib/supabase";
import { fetchQuote, type Quote } from "@/lib/fetchers/quote";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-8";

export type Intent = "ticker" | "market" | "filings" | "congress" | "general";

export type AdvisorResult = {
  answer: string;
  model: string;
  intent: Intent;
  tickers: string[];
  contextSummary: string;
  counts: { news: number; filings: number; movers: number; congress: number };
  status: "ok" | "refused" | "error";
  error?: string;
};

// Extract $TICKER or bare uppercase tokens (2-5 chars) from the question.
function extractTickers(q: string): string[] {
  const out = new Set<string>();
  const dollar = q.match(/\$([A-Za-z]{1,5})/g) ?? [];
  for (const d of dollar) out.add(d.slice(1).toUpperCase());
  // bare all-caps tokens (e.g. "NVDA"), avoiding common words
  const STOP = new Set(["I", "A", "THE", "IS", "ARE", "AI", "US", "CEO", "IPO", "ETF", "SEC", "PE", "EPS"]);
  for (const m of q.match(/\b[A-Z]{2,5}\b/g) ?? []) {
    if (!STOP.has(m)) out.add(m);
  }
  return [...out].slice(0, 5);
}

function classify(q: string, tickers: string[]): Intent {
  const s = q.toLowerCase();
  if (tickers.length > 0) return "ticker";
  if (/\b(congress|senate|house|politician|pelosi|insider trad)/.test(s)) return "congress";
  if (/\b(filing|8-k|10-k|10-q|13f|sec|disclos)/.test(s)) return "filings";
  if (/\b(market|movers|gainers|losers|sentiment|today|tape|indices|nasdaq|s&p)/.test(s)) return "market";
  return "general";
}

type Gathered = {
  context: string;
  summary: string;
  counts: { news: number; filings: number; movers: number; congress: number };
};

async function gather(intent: Intent, tickers: string[]): Promise<Gathered> {
  const counts = { news: 0, filings: 0, movers: 0, congress: 0 };
  const parts: string[] = [];

  // Live quotes for any detected tickers
  if (tickers.length > 0) {
    const quotes = (await Promise.all(tickers.map((t) => fetchQuote(t)))).filter(
      Boolean
    ) as Quote[];
    if (quotes.length > 0) {
      parts.push(
        "LIVE QUOTES:\n" +
          quotes
            .map(
              (q) =>
                `$${q.symbol}${q.name ? ` (${q.name})` : ""}: $${q.price?.toFixed(2)} ` +
                `(${(q.changePercent ?? 0) >= 0 ? "+" : ""}${q.changePercent?.toFixed(2)}%)`
            )
            .join("\n")
      );
    }
  }

  // Ticker-scoped news + filings + congress
  if (intent === "ticker" && tickers.length > 0) {
    const { data: news } = await supabaseAdmin
      .from("news_items")
      .select("headline, publisher, sentiment, published_at")
      .overlaps("tickers", tickers)
      .order("published_at", { ascending: false })
      .limit(15);
    counts.news = news?.length ?? 0;
    if (news?.length) {
      parts.push(
        "RECENT NEWS:\n" +
          news.map((n: any) => `- ${n.headline}${n.sentiment ? ` (${n.sentiment})` : ""}`).join("\n")
      );
    }
    const { data: filings } = await supabaseAdmin
      .from("news_filings")
      .select("form_type, company_name, filed_at")
      .in("ticker", tickers)
      .order("filed_at", { ascending: false })
      .limit(10);
    counts.filings = filings?.length ?? 0;
    if (filings?.length) {
      parts.push(
        "RECENT FILINGS:\n" +
          filings.map((f: any) => `- ${f.form_type}: ${f.company_name}`).join("\n")
      );
    }
    const { data: trades } = await supabaseAdmin
      .from("news_congress_trades")
      .select("representative, transaction_type, amount_range, transaction_date")
      .in("ticker", tickers)
      .order("transaction_date", { ascending: false })
      .limit(10);
    counts.congress = trades?.length ?? 0;
    if (trades?.length) {
      parts.push(
        "CONGRESSIONAL TRADES:\n" +
          trades
            .map(
              (t: any) =>
                `- ${t.representative} ${/purchase|buy/i.test(t.transaction_type) ? "BUY" : "SELL"} ${t.amount_range} (${t.transaction_date})`
            )
            .join("\n")
      );
    }
  }

  // Market-wide: recent headlines + movers
  if (intent === "market" || intent === "general") {
    const { data: news } = await supabaseAdmin
      .from("news_items")
      .select("headline, sentiment")
      .order("published_at", { ascending: false })
      .limit(25);
    counts.news = news?.length ?? 0;
    if (news?.length) {
      parts.push("TOP HEADLINES:\n" + news.map((n: any) => `- ${n.headline}`).join("\n"));
    }
    const { data: movers } = await supabaseAdmin
      .from("news_movers_latest")
      .select("category, ticker, change_percent")
      .in("category", ["gainers", "losers"])
      .order("rank", { ascending: true })
      .limit(20);
    counts.movers = movers?.length ?? 0;
    if (movers?.length) {
      parts.push(
        "MOVERS:\n" +
          movers
            .map((m: any) => `- ${m.category}: $${m.ticker} ${m.change_percent?.toFixed(1)}%`)
            .join("\n")
      );
    }
  }

  // Congress-focused
  if (intent === "congress") {
    const { data: trades } = await supabaseAdmin
      .from("news_congress_trades")
      .select("representative, ticker, transaction_type, amount_range, transaction_date")
      .order("transaction_date", { ascending: false })
      .limit(25);
    counts.congress = trades?.length ?? 0;
    if (trades?.length) {
      parts.push(
        "RECENT CONGRESSIONAL TRADES:\n" +
          trades
            .map(
              (t: any) =>
                `- ${t.representative}: $${t.ticker} ${/purchase|buy/i.test(t.transaction_type) ? "BUY" : "SELL"} ${t.amount_range} (${t.transaction_date})`
            )
            .join("\n")
      );
    }
  }

  // Filings-focused
  if (intent === "filings") {
    const { data: filings } = await supabaseAdmin
      .from("news_filings")
      .select("form_type, company_name, ticker, filed_at")
      .order("filed_at", { ascending: false })
      .limit(25);
    counts.filings = filings?.length ?? 0;
    if (filings?.length) {
      parts.push(
        "RECENT SEC FILINGS:\n" +
          filings
            .map((f: any) => `- ${f.form_type}: ${f.company_name}${f.ticker ? ` ($${f.ticker})` : ""}`)
            .join("\n")
      );
    }
  }

  const summary =
    `intent=${intent}` +
    (tickers.length ? ` tickers=${tickers.join(",")}` : "") +
    ` news=${counts.news} filings=${counts.filings} movers=${counts.movers} congress=${counts.congress}`;

  return { context: parts.join("\n\n") || "(no relevant data found in the terminal)", summary, counts };
}

const SYSTEM_PROMPT = `You are "Prince Flowers", the advisory voice of the TORQ markets terminal.

You answer the user's market question using ONLY the DATA CONTEXT provided below. Governance rules — follow all of them:
1. Ground every claim in the provided data. If the data does not support an answer, say so plainly — do not speculate or invent numbers.
2. Always cite what you're drawing on (e.g. "per the latest headlines", "based on the congressional trades shown"). Note that the data reflects the terminal's last refresh, not live tick data.
3. You are NOT a licensed financial advisor. Do not tell the user to buy, sell, or hold. Frame observations as information, not recommendations.
4. End every response with one line: "Not financial advice. Data reflects TORQ's most recent refresh."
5. Be concise and terminal-appropriate: a short paragraph or a few bullets. No preamble.`;

export async function runAdvisor(question: string): Promise<AdvisorResult> {
  const tickers = extractTickers(question);
  const intent = classify(question, tickers);

  let gathered: Gathered;
  try {
    gathered = await gather(intent, tickers);
  } catch (e: any) {
    return {
      answer: "",
      model: DEFAULT_MODEL,
      intent,
      tickers,
      contextSummary: `gather-failed`,
      counts: { news: 0, filings: 0, movers: 0, congress: 0 },
      status: "error",
      error: String(e?.message ?? e),
    };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      answer: "",
      model: DEFAULT_MODEL,
      intent,
      tickers,
      contextSummary: gathered.summary,
      counts: gathered.counts,
      status: "error",
      error: "ANTHROPIC_API_KEY not set",
    };
  }
  const model = process.env.ADVISOR_MODEL || DEFAULT_MODEL;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `QUESTION: ${question}\n\nDATA CONTEXT:\n${gathered.context}`,
          },
        ],
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const body = await res.json();
    if (body.stop_reason === "refusal") {
      return {
        answer: "This question was declined by the model's safety policy. Try rephrasing around the market data.",
        model: body.model ?? model,
        intent,
        tickers,
        contextSummary: gathered.summary,
        counts: gathered.counts,
        status: "refused",
      };
    }
    const answer = (body.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim();
    return {
      answer,
      model: body.model ?? model,
      intent,
      tickers,
      contextSummary: gathered.summary,
      counts: gathered.counts,
      status: "ok",
    };
  } catch (e: any) {
    return {
      answer: "",
      model,
      intent,
      tickers,
      contextSummary: gathered.summary,
      counts: gathered.counts,
      status: "error",
      error: String(e?.message ?? e),
    };
  }
}
