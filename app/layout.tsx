import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#10b981",
};

export const metadata: Metadata = {
  title: "TORQ News Desk",
  description:
    "Market news, SEC filings, sentiment heatmap & movers. AI-powered daily briefings. Refreshed hourly.",
  manifest: "/manifest.json",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "TORQ News Desk",
    description:
      "Market news, SEC filings, sentiment heatmap & movers. AI-powered daily briefings.",
    siteName: "TORQ News Desk",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "TORQ News Desk",
    description:
      "Market news, SEC filings, sentiment heatmap & movers. AI-powered daily briefings.",
  },
};

const NAV = [
  { href: "/briefing", label: "Briefing" },
  { href: "/", label: "Feed" },
  { href: "/sentiment", label: "Sentiment" },
  { href: "/filings", label: "Filings" },
  { href: "/movers", label: "Movers" },
  { href: "/congress", label: "Congress" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <header className="border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-50">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-mono text-sm tracking-tight shrink-0">
              <span className="text-accent font-bold">TORQ</span>{" "}
              <span className="text-muted hidden sm:inline">// news desk</span>
            </Link>
            <nav className="flex gap-3 sm:gap-5 text-xs sm:text-sm overflow-x-auto">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="whitespace-nowrap transition-colors py-0.5 text-muted hover:text-text"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6">{children}</main>
        <footer className="border-t border-border mt-8 sm:mt-12">
          <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
            Data: Massive, Finnhub, SEC EDGAR, Yahoo Finance. Refreshed hourly.
          </div>
        </footer>
      </body>
    </html>
  );
}
