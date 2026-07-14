// Financial Modeling Prep fetcher — free tier (250 calls/day).
// Used for gainers / losers / most-active since Polygon's snapshot is paid-only.
// Docs: https://site.financialmodelingprep.com/developer/docs

const BASE = "https://financialmodelingprep.com/api/v3";

export type FmpMover = {
  symbol: string;
  name?: string;
  change: number;
  price: number;
  changesPercentage: number;
  // FMP does not return volume on these endpoints — volume is inferred 0
};

export async function fetchFmpMovers(
  category: "gainers" | "losers" | "actives"
): Promise<FmpMover[]> {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY not set");
  const url = new URL(`${BASE}/stock_market/${category}`);
  url.searchParams.set("apikey", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fmp ${category} ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error(`fmp ${category}: unexpected response: ${JSON.stringify(body).slice(0, 200)}`);
  return body as FmpMover[];
}
