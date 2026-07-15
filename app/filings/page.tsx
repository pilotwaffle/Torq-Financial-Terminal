import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type FilingRow = {
  id: number;
  accession_number: string;
  cik: string;
  company_name: string;
  ticker: string | null;
  form_type: string;
  filing_url: string;
  filed_at: string;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function FilingsPage() {
  const { data, error } = await supabaseAdmin
    .from("news_filings")
    .select("id, accession_number, cik, company_name, ticker, form_type, filing_url, filed_at")
    .order("filed_at", { ascending: false })
    .limit(200);

  if (error) {
    return <div className="text-danger text-sm">Error loading filings: {error.message}</div>;
  }
  const rows = (data ?? []) as FilingRow[];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-mono tracking-tight">SEC filings</h1>
        <span className="text-xs text-muted">{rows.length} recent</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-muted text-sm">No filings yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-border">
              <tr>
                <th className="text-left py-2 pr-4 font-normal">Filed</th>
                <th className="text-left py-2 pr-4 font-normal">Form</th>
                <th className="text-left py-2 pr-4 font-normal">Company</th>
                <th className="text-left py-2 pr-4 font-normal">CIK</th>
                <th className="text-right py-2 font-normal">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((f) => (
                <tr key={f.id} className="hover:bg-surface">
                  <td className="py-2 pr-4 font-mono text-xs text-muted whitespace-nowrap">
                    {fmtTime(f.filed_at)}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded border border-border">
                      {f.form_type}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{f.company_name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted">{f.cik}</td>
                  <td className="py-2 text-right">
                    <a
                      href={f.filing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hover:text-accent"
                    >
                      view →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
