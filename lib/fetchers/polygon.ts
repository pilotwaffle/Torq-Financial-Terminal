// Polygon.io / Massive.com fetchers.
// Docs: https://polygon.io/docs/stocks
// Rebranded to massive.com Oct 30, 2025 — same endpoints.

const BASE = "https://api.polygon.io";

export type PolygonNewsItem = {
  id: string;
  publisher: { name: string };
  title: string;
  author?: string;
  published_utc: string;
  article_url: string;
  tickers?: string[];
  image_url?: string;
  description?: string;
  keywords?: string[];
  insights?: { ticker: string; sentiment: string; sentiment_reasoning: string }[];
};

export async function fetchPolygonNews(sinceISO: string, limit = 100): Promise<PolygonNewsItem[]> {
  const key = process.env.POLYGON_API_KEY!;
  const url = new URL(`${BASE}/v2/reference/news`);
  url.searchParams.set("published_utc.gte", sinceISO);
  url.searchParams.set("order", "desc");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`polygon news ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.results ?? [];
}

export type PolygonMover = {
  ticker: string;
  todaysChange: number;
  todaysChangePerc: number;
  day?: { c?: number; v?: number };
  prevDay?: { c?: number };
};

export async function fetchPolygonMovers(direction: "gainers" | "losers"): Promise<PolygonMover[]> {
  const key = process.env.POLYGON_API_KEY!;
  const url = new URL(`${BASE}/v2/snapshot/locale/us/markets/stocks/${direction}`);
  url.searchParams.set("apiKey", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`polygon ${direction} ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.tickers ?? [];
}

// Top by volume — derived from full-market snapshot
export async function fetchPolygonMostActive(limit = 20): Promise<PolygonMover[]> {
  const key = process.env.POLYGON_API_KEY!;
  const url = new URL(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers`);
  url.searchParams.set("apiKey", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`polygon snapshot ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const tickers: PolygonMover[] = body.tickers ?? [];
  return tickers
    .filter((t) => t.day?.v && t.day.v > 0)
    .sort((a, b) => (b.day?.v ?? 0) - (a.day?.v ?? 0))
    .slice(0, limit);
}
