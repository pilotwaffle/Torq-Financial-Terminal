import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TORQ News Desk",
  description: "Market news, SEC filings, and movers — refreshed every 4 hours from 08:00 ET.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <header className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-mono text-sm tracking-tight">
              <span className="text-accent">TORQ</span> <span className="text-muted">// news desk</span>
            </Link>
            <nav className="flex gap-5 text-sm">
              <Link href="/">Feed</Link>
              <Link href="/filings">Filings</Link>
              <Link href="/movers">Movers</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="border-t border-border mt-12">
          <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
            Data: Polygon.io (Massive), Finnhub, SEC EDGAR. Refresh: 08:00, 12:00, 16:00, 20:00, 00:00, 04:00 ET.
          </div>
        </footer>
      </body>
    </html>
  );
}
