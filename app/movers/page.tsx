import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type MoverRow = {
  id: number;
  captured_at: string;
  category: string;
  rank: number;
  ticker: string;
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

async function getCategory(category: string): Promise<MoverRow[]> {
  const { data } = await supabaseAdmin
    .from("news_movers_latest")
    .select("id, captured_at, category, rank, ticker, last_price, change_amount, change_percent, volume")
    .eq("category", category)
    .order("rank", { ascending: true });
  return (data ?? []) as MoverRow[];
}

function Table({ title, rows, accentGain }: { title: string; rows: MoverRow[]; accentGain: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-mono text-muted mb-2">{title}</h2>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted border-b border-border">
          <tr>
            <th className="text-left py-1.5 pr-3 font-normal">#</th>
            <th className="text-left py-1.5 pr-3 font-normal">Ticker</th>
            <th className="text-right py-1.5 pr-3 font-normal">Last</th>
            <th className="text-right py-1.5 pr-3 font-normal">% Chg</th>
            <th className="text-right py-1.5 font-normal">Vol</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const pct = r.change_percent ?? 0;
            const cls = accentGain
              ? pct >= 0 ? "text-accent" : "text-danger"
              : pct >= 0 ? "text-accent" : "text-danger";
            return (
              <tr key={r.id} className="hover:bg-surface">
                <td className="py-1.5 pr-3 text-muted font-mono text-xs">{r.rank}</td>
                <td className="py-1.5 pr-3 font-mono">{r.ticker}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{fmtPrice(r.last_price)}</td>
                <td className={`py-1.5 pr-3 text-right font-mono ${cls}`}>{fmtPct(pct)}</td>
                <td className="py-1.5 text-right font-mono text-muted">{fmtVol(r.volume)}</td>
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
  const capturedAt = gainers[0]?.captured_at ?? losers[0]?.captured_at ?? volume[0]?.captured_at ?? null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-mono tracking-tight">Movers</h1>
        {capturedAt && (
          <span className="text-xs text-muted font-mono">
            captured {new Date(capturedAt).toLocaleString("en-US")}
          </span>
        )}
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        <Table title="gainers" rows={gainers} accentGain />
        <Table title="losers" rows={losers} accentGain={false} />
        <Table title="most active" rows={volume} accentGain />
      </div>
    </div>
  );
}
