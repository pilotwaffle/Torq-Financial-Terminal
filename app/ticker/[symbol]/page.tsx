import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import TickerSearch from "@/components/TickerSearch";
import { fetchQuote } from "@/lib/fetchers/quote";

export const dynamic = "force-dynamic";

type Params = { params: { symbol: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const sym = params.symbol.toUpperCase();
  return {
    title: `$${sym} — TORQ News Desk`,
    description: `News, SEC filings, and congressional trades for $${sym}.`,
    openGraph: {
      title: `$${sym} — TORQ News Desk`,
      description: `News, SEC filings, and congressional trades for $${sym}.`,
    },
  };
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtNum(n: number | null, opts?: { dollar?: boolean; pct?: boolean }) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (opts?.pct) return `${n >= 0 ? "+" : "-"}${s}%`;
  if (opts?.dollar) return `$${n < 0 ? "-" : ""}${s}`;
  return s;
}
function fmtBig(n: number | null) {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString("en-US")}`;
}
function fmtVol(n: number | null) {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export default async function TickerPage({ params }: Params) {
  const sym = params.symbol.toUpperCase();

  const [quote, newsRes, filingsRes, tradesRes] = await Promise.all([
    fetchQuote(sym),
    supabaseAdmin
      .from("news_items")
      .select("id, headline, url, publisher, sentiment, published_at")
      .contains("tickers", [sym])
      .order("published_at", { ascending: false })
      .limit(40),
    supabaseAdmin
      .from("news_filings")
      .select("id, form_type, company_name, filing_url, filed_at")
      .eq("ticker", sym)
      .order("filed_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("news_congress_trades")
      .select("id, representative, party, transaction_type, amount_range, transaction_date")
      .eq("ticker", sym)
      .order("transaction_date", { ascending: false })
      .limit(20),
  ]);

  const news = newsRes.data ?? [];
  const filings = filingsRes.data ?? [];
  const trades = tradesRes.data ?? [];
  const empty = news.length === 0 && filings.length === 0 && trades.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-mono tracking-tight text-accent">${sym}</h1>
          {quote?.name && <span className="text-sm text-muted truncate max-w-[240px]">{quote.name}</span>}
          <Link href="/" className="text-xs text-muted hover:text-text">
            ← back to feed
          </Link>
        </div>
        <TickerSearch size="sm" />
      </div>

      {quote && quote.price != null && (
        <div className="border border-border rounded-lg p-4 mb-8">
          <div className="flex items-end flex-wrap gap-x-4 gap-y-1">
            <span className="text-3xl font-mono">{fmtNum(quote.price, { dollar: true })}</span>
            <span
              className={`text-lg font-mono ${
                (quote.change ?? 0) >= 0 ? "text-accent" : "text-danger"
              }`}
            >
              {fmtNum(quote.change, { dollar: true })} ({fmtNum(quote.changePercent, { pct: true })})
            </span>
            <span className="text-xs text-muted font-mono ml-auto">
              {quote.exchange ? `${quote.exchange} · ` : ""}live via {quote.source}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 text-xs font-mono">
            <Metric label="Open" value={fmtNum(quote.open, { dollar: true })} />
            <Metric label="Prev close" value={fmtNum(quote.prevClose, { dollar: true })} />
            <Metric
              label="Day range"
              value={
                quote.dayLow != null && quote.dayHigh != null
                  ? `${fmtNum(quote.dayLow, { dollar: true })} – ${fmtNum(quote.dayHigh, { dollar: true })}`
                  : "—"
              }
            />
            <Metric label="Volume" value={fmtVol(quote.volume)} />
            <Metric label="Mkt cap" value={fmtBig(quote.marketCap)} />
          </div>
        </div>
      )}

      {quote == null && (
        <div className="text-muted text-xs mb-6">Live quote unavailable for ${sym}.</div>
      )}

      {empty && (
        <div className="text-muted text-sm">
          No news, filings, or congress trades found for ${sym}
          {quote?.price != null ? "." : " — it may not have appeared in the feed recently. Try another symbol above."}
        </div>
      )}

      {news.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-mono text-muted mb-2">News ({news.length})</h2>
          <ul className="divide-y divide-border">
            {news.map((n: any) => (
              <li key={n.id} className="py-2.5 flex gap-4">
                <div className="w-16 shrink-0 text-xs text-muted font-mono pt-0.5">
                  {timeAgo(n.published_at)}
                </div>
                <div className="flex-1 min-w-0">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="font-medium leading-snug hover:text-accent">
                    {n.headline}
                  </a>
                  <div className="mt-0.5 text-xs text-muted flex gap-2">
                    {n.publisher && <span>{n.publisher}</span>}
                    {n.sentiment && (
                      <span className={n.sentiment === "positive" ? "text-accent" : n.sentiment === "negative" ? "text-danger" : "text-muted"}>
                        {n.sentiment}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {filings.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-mono text-muted mb-2">SEC filings ({filings.length})</h2>
          <ul className="divide-y divide-border">
            {filings.map((f: any) => (
              <li key={f.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="text-xs text-muted font-mono w-14 shrink-0">{fmtDate(f.filed_at)}</span>
                <span className="px-1.5 py-0.5 rounded border border-border font-mono text-xs">{f.form_type}</span>
                <span className="flex-1 min-w-0 truncate">{f.company_name}</span>
                <a href={f.filing_url} target="_blank" rel="noopener noreferrer" className="text-xs hover:text-accent shrink-0">
                  view →
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trades.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-mono text-muted mb-2">Congress trades ({trades.length})</h2>
          <ul className="divide-y divide-border">
            {trades.map((t: any) => {
              const buy = /purchase|buy/i.test(t.transaction_type ?? "");
              return (
                <li key={t.id} className="py-2 flex items-center gap-3 text-sm">
                  <span className="text-xs text-muted font-mono w-14 shrink-0">{fmtDate(t.transaction_date)}</span>
                  <span className="flex-1 min-w-0 truncate">{t.representative}</span>
                  <span className={`font-mono text-xs ${buy ? "text-accent" : "text-danger"}`}>{buy ? "BUY" : "SELL"}</span>
                  <span className="text-xs text-muted shrink-0 hidden sm:inline">{t.amount_range}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted/60">{label}</div>
      <div className="text-text mt-0.5">{value}</div>
    </div>
  );
}
