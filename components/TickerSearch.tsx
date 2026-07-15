"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TickerSearch({
  size = "sm",
  autoFocus = false,
}: {
  size?: "sm" | "lg";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    // Keep only letters/digits/dot/hyphen; tickers are short and uppercase.
    const sym = value.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (!sym) return;
    router.push(`/ticker/${sym}`);
  }

  const lg = size === "lg";
  return (
    <form onSubmit={go} className="flex items-center gap-2">
      <div className="relative">
        <span
          className={`absolute left-2 top-1/2 -translate-y-1/2 text-muted font-mono ${
            lg ? "text-base" : "text-xs"
          }`}
        >
          $
        </span>
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ticker (e.g. QQQM)"
          aria-label="Look up a ticker symbol"
          className={`bg-surface border border-border rounded font-mono text-text placeholder:text-muted/60 focus:outline-none focus:border-accent ${
            lg ? "pl-6 pr-3 py-2 text-base w-56" : "pl-5 pr-2 py-1 text-xs w-32 sm:w-40"
          }`}
        />
      </div>
      <button
        type="submit"
        className={`font-mono rounded border border-border hover:border-accent hover:text-accent transition-colors ${
          lg ? "px-4 py-2 text-sm" : "px-2 py-1 text-xs"
        }`}
      >
        Go
      </button>
    </form>
  );
}
