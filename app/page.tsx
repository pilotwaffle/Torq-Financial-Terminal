import { supabaseAdmin } from "@/lib/supabase";

export const revalidate = 60;

type NewsRow = {
  id: number;
  source: string;
  headline: string;
  summary: string | null;
  url: string;
  publisher: string | null;
  tickers: string[];
  sentiment: string | null;
  published_at: string;
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sentimentClass(s: string | null) {
  if (s === "positive") return "text-accent";
  if (s === "negative") return "text-danger";
  return "text-muted";
}

export default async function FeedPage() {
  const { data, error } = await supabaseAdmin
    .from("news_items")
    .select("id, source, headline, summary, url, publisher, tickers, sentiment, published_at")
    .order("published_at", { ascending: false })
    .limit(150);

  if (error) {
    return <div className="text-danger text-sm">Error loading feed: {error.message}</div>;
  }
  const items = (data ?? []) as NewsRow[];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-mono tracking-tight">Live feed</h1>
        <span className="text-xs text-muted">{items.length} items</span>
      </div>
      {items.length === 0 ? (
        <div className="text-muted text-sm">
          No news yet. Wait for the next cron run (or hit{" "}
          <code className="text-xs">/api/cron/refresh</code> manually).
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((n) => (
            <li key={n.id} className="py-3 flex gap-4">
              <div className="w-20 shrink-0 text-xs text-muted font-mono pt-1">
                {timeAgo(n.published_at)}
              </div>
              <div className="flex-1 min-w-0">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-medium leading-snug hover:text-accent"
                >
                  {n.headline}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {n.publisher && <span>{n.publisher}</span>}
                  {n.tickers.slice(0, 8).map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded border border-border text-text font-mono"
                    >
                      ${t}
                    </span>
                  ))}
                  {n.sentiment && (
                    <span className={`font-mono ${sentimentClass(n.sentiment)}`}>
                      {n.sentiment}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
