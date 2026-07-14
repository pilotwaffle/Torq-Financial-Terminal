// SEC EDGAR fetcher — no API key, but requires a User-Agent with contact info.
// Docs: https://www.sec.gov/os/accessing-edgar-data

// Recent filings feed (atom). Pull last 100 filings and filter by form type.
// We use the "getcompany" action's cik-less feed for the firehose of recent filings.

export type EdgarFiling = {
  accessionNumber: string;
  cik: string;
  companyName: string;
  formType: string;
  title: string;
  filingUrl: string;
  documentUrl?: string;
  filedAt: string;
  ticker?: string;
};

const FEED_URL =
  "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=&company=&dateb=&owner=include&count=100&output=atom";

const FORM_TYPES_OF_INTEREST = new Set([
  "8-K", "8-K/A",
  "10-Q", "10-Q/A",
  "10-K", "10-K/A",
  "S-1", "S-1/A",
  "S-3", "S-3/A",
  "13F-HR", "SC 13G", "SC 13D",
  "4",  // insider transactions
]);

export async function fetchRecentEdgarFilings(): Promise<EdgarFiling[]> {
  const ua = process.env.SEC_USER_AGENT;
  if (!ua) throw new Error("SEC_USER_AGENT env var is required by SEC");
  const res = await fetch(FEED_URL, {
    headers: { "User-Agent": ua, Accept: "application/atom+xml" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`edgar ${res.status}: ${await res.text()}`);
  const xml = await res.text();
  return parseAtomFeed(xml);
}

// Minimal atom parser — avoids pulling a heavy XML dep.
function parseAtomFeed(xml: string): EdgarFiling[] {
  const out: EdgarFiling[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(xml)) !== null) {
    const entry = match[1];
    const title = extract(entry, "title");
    const updated = extract(entry, "updated");
    const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/);
    const id = extract(entry, "id");
    // title format: "8-K - Apple Inc. (0000320193) (Filer)"
    const titleMatch = title?.match(/^([^\s-]+(?:\/A)?)\s*-\s*(.+?)\s*\((\d+)\)/);
    if (!titleMatch) continue;
    const [, formType, companyName, cik] = titleMatch;
    if (!FORM_TYPES_OF_INTEREST.has(formType)) continue;
    // accession number from id: urn:tag:sec.gov,2008:accession-number=0001193125-25-001234
    const accMatch = id?.match(/accession-number=([\d-]+)/);
    const accessionNumber = accMatch?.[1] ?? id ?? `${cik}-${updated}`;
    out.push({
      accessionNumber,
      cik,
      companyName,
      formType,
      title: title ?? "",
      filingUrl: linkMatch?.[1] ?? "",
      filedAt: updated ?? new Date().toISOString(),
    });
  }
  return out;
}

function extract(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return undefined;
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}
