// Finnhub fallback for news. Used if Polygon returns empty or errors.
// Docs: https://finnhub.io/docs/api/market-news

const BASE = "https://finnhub.io/api/v1";

export type FinnhubNewsItem = {
  category: string;
  datetime: number;       // unix seconds
  headline: string;
  id: number;
  image: string;
  related: string;        // comma-separated tickers
  source: string;
  summary: string;
  url: string;
};

export async function fetchFinnhubGeneralNews(): Promise<FinnhubNewsItem[]> {
  const key = process.env.FINNHUB_API_KEY!;
  const url = new URL(`${BASE}/news`);
  url.searchParams.set("category", "general");
  url.searchParams.set("token", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`finnhub news ${res.status}: ${await res.text()}`);
  return res.json();
}
