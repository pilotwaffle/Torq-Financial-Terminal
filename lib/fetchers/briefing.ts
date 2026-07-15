// AI-generated daily market briefing. Summarizes the most recent news + filings
// into a structured markdown briefing via the Anthropic Messages API.
//
// No SDK dependency — calls the REST endpoint directly with fetch, matching the
// other fetchers. Model defaults to claude-opus-4-8 (override with BRIEFING_MODEL).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-8";

export type BriefingInput = {
  headlines: { headline: string; tickers: string[]; sentiment: string | null }[];
  filings: { company_name: string; form_type: string; ticker: string | null }[];
};

export type GeneratedBriefing = {
  content: string;
  model: string;
  newsCount: number;
  filingsCount: number;
};

const SYSTEM_PROMPT = `You are a markets desk analyst writing a concise pre-market briefing for a finance terminal.
Given today's headlines and SEC filings, produce a tight markdown briefing with these sections, in order:

## MARKET PULSE
One short paragraph on the overall tone of the tape.

## TOP STORIES
3-5 bullets, each starting with a bolded theme, then a sentence. Reference tickers with a $ prefix (e.g. $NVDA).

## SECTOR MOVES
2-3 bullets on notable sector rotation or themes.

## WATCH TODAY
2-3 bullets on specific names or events to watch, with $TICKERS.

Rules:
- Use only the provided data; do not invent numbers or facts.
- Be specific and punchy. No preamble, no sign-off, no disclaimer.
- Output only the markdown briefing.`;

function buildUserPrompt(input: BriefingInput): string {
  const heads = input.headlines
    .slice(0, 60)
    .map(
      (h) =>
        `- ${h.headline}${h.tickers.length ? ` [${h.tickers.slice(0, 5).join(", ")}]` : ""}${
          h.sentiment ? ` (${h.sentiment})` : ""
        }`
    )
    .join("\n");
  const files = input.filings
    .slice(0, 30)
    .map((f) => `- ${f.form_type}: ${f.company_name}${f.ticker ? ` ($${f.ticker})` : ""}`)
    .join("\n");
  return `HEADLINES (most recent first):\n${heads || "(none)"}\n\nSEC FILINGS:\n${files || "(none)"}\n\nWrite the briefing.`;
}

export async function generateBriefing(
  input: BriefingInput
): Promise<GeneratedBriefing | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  if (input.headlines.length === 0) return null; // nothing to summarize

  const model = process.env.BRIEFING_MODEL || DEFAULT_MODEL;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = await res.json();

  // A refusal (stop_reason "refusal") or empty content => no briefing this run.
  if (body.stop_reason === "refusal") return null;
  const text = (body.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();
  if (!text) return null;

  return {
    content: text,
    model: body.model ?? model,
    newsCount: input.headlines.length,
    filingsCount: input.filings.length,
  };
}
