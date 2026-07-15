import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";

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

export default async function TickerPage({ params }: Params) {
  const sym = params.symbol.toUpperCase();

  const [newsRes, filingsRes, tradesRes] = await Promise.all([
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
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-2xl font-mono tracking-tight text-accent">${sym}</h1>
        <Link href="/" className="text-xs text-muted hover:text-text">
          ← back to feed
        </Link>
      </div>

      {empty && (
        <div className="text-muted text-sm">No news, filings, or congress trades found for ${sym}.</div>
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
