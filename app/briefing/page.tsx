import { supabaseAdmin } from "@/lib/supabase";

export const revalidate = 60;

type Briefing = {
  id: number;
  content: string;
  generated_at: string;
  model_used: string | null;
  news_count: number | null;
  filings_count: number | null;
};

// Minimal, dependency-free markdown renderer for the briefing content.
// Supports: ## headings, • bullets, **bold**, $TICKER emphasis.
function renderInline(text: string, keyBase: string) {
  // Split on **bold** while keeping the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={`${keyBase}-${i}`} className="text-text font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyBase}-${i}`}>{p}</span>;
  });
}

function renderBriefing(content: string) {
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) return;
    if (line.startsWith("## ")) {
      out.push(
        <h2 key={i} className="text-sm font-mono text-accent tracking-wide mt-6 mb-2 uppercase">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("• ") || line.startsWith("- ")) {
      out.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed mb-1.5">
          <span className="text-muted shrink-0">•</span>
          <span>{renderInline(line.slice(2), String(i))}</span>
        </div>
      );
    } else {
      out.push(
        <p key={i} className="text-sm leading-relaxed text-muted mb-2">
          {renderInline(line, String(i))}
        </p>
      );
    }
  });
  return out;
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BriefingPage() {
  const { data, error } = await supabaseAdmin
    .from("news_briefings")
    .select("id, content, generated_at, model_used, news_count, filings_count")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return <div className="text-danger text-sm">Error loading briefing: {error.message}</div>;
  }
  const b = data as Briefing | null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-lg font-mono tracking-tight">Daily briefing</h1>
        {b && <span className="text-xs text-muted font-mono">{fmtWhen(b.generated_at)}</span>}
      </div>
      {b && (
        <p className="text-xs text-muted mb-6">
          AI-generated from {b.news_count ?? "—"} headlines and {b.filings_count ?? "—"} filings
          {b.model_used ? ` · ${b.model_used}` : ""}
        </p>
      )}

      {!b ? (
        <div className="text-muted text-sm">
          No briefing yet. One is generated on each cron run.
        </div>
      ) : (
        <div className="max-w-3xl">{renderBriefing(b.content)}</div>
      )}
    </div>
  );
}
