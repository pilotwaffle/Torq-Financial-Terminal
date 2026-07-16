"use client";

import { useState, useRef, useEffect } from "react";

type Turn = {
  role: "user" | "advisor";
  text: string;
  meta?: { intent?: string; tickers?: string[]; model?: string; status?: string };
};

const SAMPLES = [
  "What's the market tone today?",
  "What's happening with $NVDA?",
  "Any notable congressional trades this week?",
  "Which stocks are the biggest movers?",
];

export default function Advisor() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setTurns((t) => [...t, { role: "user", text: question }]);
    setValue("");
    setBusy(true);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTurns((t) => [
          ...t,
          { role: "advisor", text: `⚠ ${data.error || "Something went wrong."}`, meta: { status: "error" } },
        ]);
      } else {
        setTurns((t) => [
          ...t,
          {
            role: "advisor",
            text: data.answer,
            meta: { intent: data.intent, tickers: data.tickers, model: data.model, status: data.status },
          },
        ]);
      }
    } catch {
      setTurns((t) => [...t, { role: "advisor", text: "⚠ Network error. Try again.", meta: { status: "error" } }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-mono tracking-tight">
          Advisor <span className="text-muted">// Prince Flowers</span>
        </h1>
        <p className="text-xs text-muted mt-1">
          Ask about the market, a ticker, filings, or congressional trades. Answers are grounded in the
          terminal&apos;s data — informational only, not financial advice.
        </p>
      </div>

      {turns.length === 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="text-xs font-mono px-2.5 py-1.5 rounded border border-border text-muted hover:border-accent hover:text-accent transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "" : "border-l-2 border-accent/40 pl-3"}>
            <div className="text-xs font-mono text-muted mb-1">
              {t.role === "user" ? "you" : "prince flowers"}
              {t.meta?.intent && <span className="text-muted/50"> · {t.meta.intent}</span>}
              {t.meta?.tickers && t.meta.tickers.length > 0 && (
                <span className="text-accent/70"> · {t.meta.tickers.map((x) => `$${x}`).join(" ")}</span>
              )}
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{t.text}</div>
          </div>
        ))}
        {busy && (
          <div className="border-l-2 border-accent/40 pl-3">
            <div className="text-xs font-mono text-muted mb-1">prince flowers</div>
            <div className="text-sm text-muted animate-pulse">analyzing the tape…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(value);
        }}
        className="sticky bottom-4 flex gap-2 bg-bg/95 backdrop-blur-sm py-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          placeholder="Ask about the market or a ticker…"
          aria-label="Ask the advisor"
          className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="px-4 py-2 text-sm font-mono rounded border border-border hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
