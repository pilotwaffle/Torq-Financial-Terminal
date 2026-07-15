// Live single-symbol quote. Finnhub primary (free /quote + /profile2), Polygon
// prev-close as fallback. Used by the ticker page so ANY symbol shows a price,
// not just ones in the news feed.
//
// Note: FMP's /api/v3/quote is a legacy endpoint that no longer works on the
// current key, so it is not used here.

export type Quote = {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  open: number | null;
  prevClose: number | null;
  volume: number | null;
  marketCap: number | null; // in USD
  exchange: string | null;
  source: "finnhub" | "polygon";
};

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const POLYGON_BASE = "https://api.polygon.io";

async function fetchFinnhub(symbol: string): Promise<Quote | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;

  const quoteUrl = new URL(`${FINNHUB_BASE}/quote`);
  quoteUrl.searchParams.set("symbol", symbol);
  quoteUrl.searchParams.set("token", key);

  const profileUrl = new URL(`${FINNHUB_BASE}/stock/profile2`);
  profileUrl.searchParams.set("symbol", symbol);
  profileUrl.searchParams.set("token", key);

  const [qRes, pRes] = await Promise.all([
    fetch(quoteUrl, { cache: "no-store" }),
    fetch(profileUrl, { cache: "no-store" }).catch(() => null),
  ]);
  if (!qRes.ok) return null;
  const q = await qRes.json();
  // c === 0 (and no prev close) means Finnhub doesn't recognize the symbol.
  if (!q || q.c == null || (q.c === 0 && (q.pc == null || q.pc === 0))) return null;

  let name: string | null = null;
  let marketCap: number | null = null;
  let exchange: string | null = null;
  if (pRes && pRes.ok) {
    const p = await pRes.json();
    name = p?.name ?? null;
    // Finnhub reports market cap in millions.
    marketCap = p?.marketCapitalization != null ? p.marketCapitalization * 1e6 : null;
    exchange = p?.exchange ?? null;
  }

  return {
    symbol,
    name,
    price: q.c ?? null,
    change: q.d ?? null,
    changePercent: q.dp ?? null,
    dayLow: q.l ?? null,
    dayHigh: q.h ?? null,
    open: q.o ?? null,
    prevClose: q.pc ?? null,
    volume: null, // Finnhub /quote does not include volume
    marketCap,
    exchange,
    source: "finnhub",
  };
}

async function fetchPolygonPrev(symbol: string): Promise<Quote | null> {
  const key = process.env.POLYGON_API_KEY;
  if (!key) return null;
  const url = new URL(`${POLYGON_BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev`);
  url.searchParams.set("adjusted", "true");
  url.searchParams.set("apiKey", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const body = await res.json();
  const r = body?.results?.[0];
  if (!r || r.c == null) return null;
  const change = r.o != null ? r.c - r.o : null;
  const changePercent = r.o ? ((r.c - r.o) / r.o) * 100 : null;
  return {
    symbol,
    name: null,
    price: r.c ?? null, // prev-day close (delayed) — best the free tier allows
    change,
    changePercent,
    dayLow: r.l ?? null,
    dayHigh: r.h ?? null,
    open: r.o ?? null,
    prevClose: null,
    volume: r.v ?? null,
    marketCap: null,
    exchange: null,
    source: "polygon",
  };
}

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const fh = await fetchFinnhub(symbol);
    if (fh) return fh;
  } catch {
    /* fall through */
  }
  try {
    return await fetchPolygonPrev(symbol);
  } catch {
    return null;
  }
}
