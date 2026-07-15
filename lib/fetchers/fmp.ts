// Financial Modeling Prep movers — free-tier /stable endpoints.
//
// The legacy /api/v3/stock_market/{gainers,losers,actives} endpoints are dead
// ("Legacy Endpoint … no longer supported"). The /stable/ endpoints work on the
// current free key. They return price/change/%/name/exchange but NOT volume or
// prev_close, so we derive prev_close from (price - change). Volume is left null
// (Polygon's snapshot is paid-only and per-ticker enrichment would exceed the
// free rate limit within the cron's 60s budget).

const BASE = "https://financialmodelingprep.com/stable";

const ENDPOINT: Record<"gainers" | "losers" | "actives", string> = {
  gainers: "biggest-gainers",
  losers: "biggest-losers",
  actives: "most-actives",
};

export type FmpMover = {
  symbol: string;
  name?: string;
  change: number;
  price: number;
  changesPercentage: number;
  // Derived / unavailable on the stable feed:
  prevClose: number | null;
  volume: number | null;
};

type FmpStableRow = {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changesPercentage?: number;
  exchange?: string;
};

export async function fetchFmpMovers(
  category: "gainers" | "losers" | "actives"
): Promise<FmpMover[]> {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY not set");
  const url = new URL(`${BASE}/${ENDPOINT[category]}`);
  url.searchParams.set("apikey", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`fmp ${category} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const body = await res.json();
  if (!Array.isArray(body)) {
    throw new Error(`fmp ${category}: unexpected response: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return (body as FmpStableRow[])
    .filter((r) => r.symbol && r.price != null)
    .map((r) => {
      const price = r.price ?? 0;
      const change = r.change ?? 0;
      return {
        symbol: r.symbol,
        name: r.name,
        price,
        change,
        changesPercentage: r.changesPercentage ?? 0,
        prevClose: r.change != null ? Number((price - change).toFixed(4)) : null,
        volume: null,
      };
    });
}
