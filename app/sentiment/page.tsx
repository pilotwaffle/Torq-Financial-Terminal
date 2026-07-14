import { supabaseAdmin } from "@/lib/supabase";

export const revalidate = 60;

// Time windows (hours) shown as columns in the tracker.
const WINDOWS: { label: string; hours: number }[] = [
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
];

type Bucket = { positive: number; negative: number; neutral: number; total: number };

function emptyBucket(): Bucket {
  return { positive: 0, negative: 0, neutral: 0, total: 0 };
}

// score = (positive - negative) / total, in [-1, 1]
function score(b: Bucket) {
  if (b.total === 0) return null;
  return (b.positive - b.negative) / b.total;
}

// Map score to a cell background (red → neutral → green).
function cellStyle(s: number | null): React.CSSProperties {
  if (s === null) return { background: "transparent" };
  const alpha = Math.min(Math.abs(s), 1) * 0.6 + 0.1;
  if (s > 0.02) return { background: `rgba(16,185,129,${alpha.toFixed(2)})` };
  if (s < -0.02) return { background: `rgba(239,68,68,${alpha.toFixed(2)})` };
  return { background: "rgba(107,114,128,0.15)" };
}

export default async function SentimentPage() {
  const maxHours = Math.max(...WINDOWS.map((w) => w.hours));
  const sinceISO = new Date(Date.now() - maxHours * 3600_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("news_items")
    .select("sentiment, published_at")
    .gte("published_at", sinceISO)
    .not("sentiment", "is", null)
    .limit(10000);

  if (error) {
    return <div className="text-danger text-sm">Error loading sentiment: {error.message}</div>;
  }
  const rows = (data ?? []) as { sentiment: string; published_at: string }[];

  // Overall buckets per window.
  const buckets = WINDOWS.map((w) => {
    const cutoff = Date.now() - w.hours * 3600_000;
    const b = emptyBucket();
    for (const r of rows) {
      if (new Date(r.published_at).getTime() < cutoff) continue;
      if (r.sentiment === "positive") b.positive++;
      else if (r.sentiment === "negative") b.negative++;
      else b.neutral++;
      b.total++;
    }
    return b;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-mono tracking-tight">Sentiment tracker</h1>
        <p className="text-xs text-muted mt-1">
          Aggregated sentiment scores from Massive news API across time windows. Score = (positive −
          negative) / total articles. Hover cells for breakdown.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm max-w-2xl">
          <thead className="text-xs text-muted border-b border-border">
            <tr>
              <th className="text-left py-2 pr-4 font-normal">Window</th>
              <th className="text-right py-2 pr-4 font-normal">Score</th>
              <th className="text-center py-2 pr-4 font-normal">Heat</th>
              <th className="text-right py-2 pr-4 font-normal">Pos</th>
              <th className="text-right py-2 pr-4 font-normal">Neg</th>
              <th className="text-right py-2 font-normal">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {WINDOWS.map((w, i) => {
              const b = buckets[i];
              const s = score(b);
              return (
                <tr key={w.label} className="hover:bg-surface">
                  <td className="py-2 pr-4 font-mono">{w.label}</td>
                  <td
                    className={`py-2 pr-4 text-right font-mono ${
                      s == null ? "text-muted" : s > 0.02 ? "text-accent" : s < -0.02 ? "text-danger" : "text-muted"
                    }`}
                  >
                    {s == null ? "—" : (s >= 0 ? "+" : "") + s.toFixed(2)}
                  </td>
                  <td className="py-2 pr-4">
                    <div
                      className="h-5 rounded"
                      style={cellStyle(s)}
                      title={`+${b.positive} / -${b.negative} / ~${b.neutral} of ${b.total}`}
                    />
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-accent">{b.positive}</td>
                  <td className="py-2 pr-4 text-right font-mono text-danger">{b.negative}</td>
                  <td className="py-2 text-right font-mono text-muted">{b.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
