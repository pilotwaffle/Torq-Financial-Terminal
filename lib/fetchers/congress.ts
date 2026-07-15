// Congressional stock trades — STOCK Act disclosures via FMP's free "latest" feeds.
// FMP /stable/senate-latest and /stable/house-latest work on the free tier and
// return the newest disclosed trades (the per-symbol endpoints are paid-only).
//
// Note: FMP does not return party. We leave party null (the /congress page
// renders a neutral dot for unknown party). "excess_return" (vs SPY) is computed
// by a separate enrichment step / the live cron, not here — left null on insert.

export type CongressTrade = {
  bioGuideId: string | null;
  representative: string;
  chamber: "Representatives" | "Senate";
  state: string | null; // 2-letter, parsed from district (e.g. "FL25" -> "FL")
  ticker: string | null;
  transactionType: string | null; // "Purchase" | "Sale" | "Sale (Partial)" ...
  amountRange: string | null; // "$1,001 - $15,000"
  amountLow: number | null;
  transactionDate: string | null; // ISO date
  reportDate: string | null; // disclosure date
  description: string | null;
};

const BASE = "https://financialmodelingprep.com/stable";

type FmpTrade = {
  symbol?: string;
  senateID?: string; // bioguide id (same field name in both feeds)
  disclosureDate?: string;
  transactionDate?: string;
  firstName?: string;
  lastName?: string;
  office?: string;
  district?: string;
  assetDescription?: string;
  type?: string;
  amount?: string;
};

// "$1,001 - $15,000" -> 1001
function parseAmountLow(amount?: string): number | null {
  if (!amount) return null;
  const m = amount.replace(/[$,]/g, "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// "FL25" / "AR" -> "FL" / "AR"
function parseState(district?: string): string | null {
  if (!district) return null;
  const m = district.match(/^([A-Za-z]{2})/);
  return m ? m[1].toUpperCase() : null;
}

function mapTrade(t: FmpTrade, chamber: "Representatives" | "Senate"): CongressTrade {
  const name =
    [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.office || "Unknown";
  return {
    bioGuideId: t.senateID ?? null,
    representative: name,
    chamber,
    state: parseState(t.district),
    ticker: t.symbol || null,
    transactionType: t.type ?? null,
    amountRange: t.amount ?? null,
    amountLow: parseAmountLow(t.amount),
    transactionDate: t.transactionDate ?? null,
    reportDate: t.disclosureDate ?? null,
    description: t.assetDescription ?? null,
  };
}

async function fetchFeed(
  path: "senate-latest" | "house-latest",
  chamber: "Representatives" | "Senate"
): Promise<CongressTrade[]> {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY not set");
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("apikey", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fmp ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  if (!Array.isArray(body)) {
    throw new Error(`fmp ${path}: unexpected response: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return (body as FmpTrade[])
    .filter((t) => t.symbol) // only rows with a ticker are useful for the terminal
    .map((t) => mapTrade(t, chamber));
}

export async function fetchCongressTrades(): Promise<CongressTrade[]> {
  const [house, senate] = await Promise.all([
    fetchFeed("house-latest", "Representatives"),
    fetchFeed("senate-latest", "Senate"),
  ]);
  return [...house, ...senate];
}
