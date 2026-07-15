import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type TradeRow = {
  id: number;
  representative: string;
  party: string | null;
  chamber: string | null;
  state: string | null;
  ticker: string | null;
  transaction_type: string | null;
  amount_range: string | null;
  amount_low: number | null;
  transaction_date: string;
  excess_return: number | null;
};

function daysAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return `${diff}d ago`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
// Live site shows BUY/SELL from transaction_type strings like "Sale"/"Purchase".
function isBuy(t: string | null) {
  return /purchase|buy/i.test(t ?? "");
}
function isSell(t: string | null) {
  return /sale|sell/i.test(t ?? "");
}
function chamberLabel(c: string | null) {
  if (!c) return "";
  return /senate/i.test(c) ? "Senate" : "House";
}
function fmtPct(n: number | null) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export default async function CongressPage() {
  const { data, error } = await supabaseAdmin
    .from("news_congress_trades")
    .select(
      "id, representative, party, chamber, state, ticker, transaction_type, amount_range, amount_low, transaction_date, excess_return"
    )
    .order("transaction_date", { ascending: false })
    .limit(200);

  if (error) {
    return <div className="text-danger text-sm">Error loading congress trades: {error.message}</div>;
  }
  const rows = (data ?? []) as TradeRow[];

  const buys = rows.filter((r) => isBuy(r.transaction_type)).length;
  const sells = rows.filter((r) => isSell(r.transaction_type)).length;
  const politicians = new Set(rows.map((r) => r.representative)).size;
  const bigTrades = rows.filter((r) => (r.amount_low ?? 0) >= 50000).length;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-mono tracking-tight">Congress trades</h1>
        <span className="text-xs text-muted">{rows.length} recent trades</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="BUYS" value={buys} cls="text-accent" />
        <Stat label="SELLS" value={sells} cls="text-danger" />
        <Stat label="POLITICIANS" value={politicians} cls="text-text" />
        <Stat label="$50K+ TRADES" value={bigTrades} cls="text-yellow-400" />
      </div>

      {rows.length === 0 ? (
        <div className="text-muted text-sm">No congress trades yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-border">
              <tr>
                <th className="text-left py-2 pr-4 font-normal">Traded</th>
                <th className="text-left py-2 pr-4 font-normal">Politician</th>
                <th className="text-left py-2 pr-4 font-normal hidden sm:table-cell">Party</th>
                <th className="text-left py-2 pr-4 font-normal">Ticker</th>
                <th className="text-left py-2 pr-4 font-normal">Type</th>
                <th className="text-left py-2 pr-4 font-normal hidden md:table-cell">Size</th>
                <th className="text-right py-2 font-normal hidden lg:table-cell">vs SPY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const dem = /^d/i.test(r.party ?? "");
                const rep = /^r/i.test(r.party ?? "");
                const buy = isBuy(r.transaction_type);
                return (
                  <tr key={r.id} className="hover:bg-surface">
                    <td className="py-2 pr-4 font-mono text-xs text-muted whitespace-nowrap" title={r.transaction_date}>
                      {fmtDate(r.transaction_date)}{" "}
                      <span className="text-muted/60">({daysAgo(r.transaction_date)})</span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                            dem ? "bg-blue-400" : rep ? "bg-red-400" : "bg-muted"
                          }`}
                        />
                        <span className="truncate max-w-[140px] sm:max-w-none">{r.representative}</span>
                      </div>
                      <div className="text-xs text-muted/60 hidden lg:block">{chamberLabel(r.chamber)}</div>
                    </td>
                    <td className="py-2 pr-4 hidden sm:table-cell">
                      <span
                        className={`font-mono text-xs ${
                          dem ? "text-blue-400" : rep ? "text-red-400" : "text-muted"
                        }`}
                      >
                        {rep ? "R" : dem ? "D" : "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono">
                      {r.ticker ? (
                        <Link href={`/ticker/${r.ticker}`} className="hover:text-accent">
                          ${r.ticker}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`font-mono text-xs ${buy ? "text-accent" : "text-danger"}`}>
                        {buy ? "BUY" : "SELL"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted hidden md:table-cell whitespace-nowrap">
                      {r.amount_range ?? "—"}
                    </td>
                    <td
                      className={`py-2 text-right font-mono text-xs hidden lg:table-cell ${
                        (r.excess_return ?? 0) >= 0 ? "text-accent" : "text-danger"
                      }`}
                    >
                      {fmtPct(r.excess_return)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted/60 mt-6">
        Source: STOCK Act financial disclosures via Quiver Quantitative. &quot;vs SPY&quot; shows excess
        return since trade date. Trades are self-reported and may be delayed 30–45 days.
      </p>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="border border-border rounded p-3">
      <div className="text-xs text-muted font-mono">{label}</div>
      <div className={`text-2xl font-mono mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
