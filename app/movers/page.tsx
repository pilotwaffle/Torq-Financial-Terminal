import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type MoverRow = {
  id: number;
  captured_at: string;
  category: string;
  rank: number;
  ticker: string;
  company_name: string | null;
  last_price: number | null;
  change_amount: number | null;
  change_percent: number | null;
  volume: number | null;
};

function fmtPct(n: number | null) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
function fmtPrice(n: number | null) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}
function fmtVol(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function getCategory(category: string): Promise<MoverRow[]> {
  const { data } = await supabaseAdmin
    .from("news_movers_latest")
    .select(
      "id, captured_at, category, rank, ticker, company_name, last_price, change_amount, change_percent, volume"
    )
    .eq("category", category)
    .order("rank", { ascending: true });
  return (data ?? []) as MoverRow[];
}

function Table({ title, rows }: { title: string; rows: MoverRow[] }) {
  // Scale the % bar relative to the largest absolute move in this table.
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.change_percent ?? 0)));

  return (
    <div>
      <h2 className="text-sm font-mono text-muted mb-2">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted border-b border-border">
          <tr>
            <th className="text-left py-1.5 pr-2 font-normal">#</th>
            <th className="text-left py-1.5 pr-2 font-normal">Ticker</th>
            <th className="text-right py-1.5 pr-2 font-normal">Last</th>
            <th className="text-right py-1.5 pr-2 font-normal">% Chg</th>
            <th className="text-right py-1.5 font-normal">Vol</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const pct = r.change_percent ?? 0;
            const cls = pct >= 0 ? "text-accent" : "text-danger";
            const barPct = Math.min(100, (Math.abs(pct) / maxAbs) * 100);
            return (
              <tr key={r.id} className="hover:bg-surface align-top">
                <td className="py-1.5 pr-2 text-muted font-mono text-xs">{r.rank}</td>
                <td className="py-1.5 pr-2">
                  <Link href={`/ticker/${r.ticker}`} className="font-mono hover:text-accent">
                    {r.ticker}
                  </Link>
                  {r.company_name && (
                    <div className="text-[10px] text-muted/60 truncate max-w-[120px] leading-tight">
                      {r.company_name}
                    </div>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right font-mono whitespace-nowrap">
                  {fmtPrice(r.last_price)}
                </td>
                <td className="py-1.5 pr-2 text-right font-mono whitespace-nowrap">
                  <span className={cls}>{fmtPct(pct)}</span>
                  <div className="mt-1 h-1 w-full bg-border/40 rounded overflow-hidden">
                    <div
                      className={`h-full ${pct >= 0 ? "bg-accent" : "bg-danger"}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </td>
                <td className="py-1.5 text-right font-mono text-muted whitespace-nowrap">
                  {fmtVol(r.volume)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="text-muted text-xs mt-2">No data yet.</div>}
    </div>
  );
}

export default async function MoversPage() {
  const [gainers, losers, volume] = await Promise.all([
    getCategory("gainers"),
    getCategory("losers"),
    getCategory("volume"),
  ]);
  const capturedAt =
    gainers[0]?.captured_at ?? losers[0]?.captured_at ?? volume[0]?.captured_at ?? null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-mono tracking-tight">Movers</h1>
        {capturedAt && (
          <span className="text-xs text-muted font-mono" title={new Date(capturedAt).toLocaleString("en-US")}>
            updated {timeAgo(capturedAt)}
          </span>
        )}
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        <Table title="gainers" rows={gainers} />
        <Table title="losers" rows={losers} />
        <Table title="most active" rows={volume} />
      </div>
      <p className="text-xs text-muted/60 mt-6">
        Click a ticker for its news, filings, congressional trades, and live quote.
      </p>
    </div>
  );
}
