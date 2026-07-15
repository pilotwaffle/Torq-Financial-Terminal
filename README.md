# TORQ Financial Terminal

A dark, terminal-style market intelligence dashboard — live market news, SEC filings, top movers, congressional stock trades, a news-sentiment tracker, AI-generated daily briefings, and per-ticker research pages. Built with Next.js 14 and backed by Supabase.

> **Live:** [torq-tech-news.vercel.app](https://torq-tech-news.vercel.app)

---

## Features

| Page | Route | What it shows |
|------|-------|---------------|
| **Feed** | `/` | Live market headlines with sentiment tags and clickable `$TICKER` chips |
| **Briefing** | `/briefing` | AI-generated daily market briefing (Market Pulse, Top Stories, Sector Moves) |
| **Sentiment** | `/sentiment` | Aggregated news sentiment score across 6h / 24h / 3d / 7d windows |
| **Filings** | `/filings` | Recent SEC filings (8-K, 10-Q, 10-K, 13F, Form 4, …) from EDGAR |
| **Movers** | `/movers` | Top gainers / losers / most-active, with % bars and freshness indicator |
| **Congress** | `/congress` | Congressional stock trades (STOCK Act disclosures) with "vs SPY" excess return |
| **Ticker** | `/ticker/[symbol]` | Per-symbol page: **live price quote** + that symbol's news, filings, and congress trades |

A **ticker search box** in the header lets you look up any symbol (e.g. `QQQM`) directly — even if it isn't currently in the feed.

## Stack

- **Next.js 14** — App Router, React Server Components, `force-dynamic` pages
- **Supabase** (Postgres) — shared TORQ project `npukynbaglmcdvzyklqa`, all tables prefixed `news_`
- **Vercel** — hosting + Cron
- **Tailwind CSS** — dark, minimal, monospace-accented UI
- **Data providers** — Polygon.io/Massive, Finnhub, SEC EDGAR, FMP, Capitol Trades (congress), Anthropic (briefings)

## Architecture

A **Vercel Cron** job (`/api/cron/refresh`) periodically fetches from the external providers and writes normalized rows into Supabase. Every page is a **server component** that reads directly from Supabase at request time — no client-side data fetching for the core content. The one exception is the live ticker quote, which is fetched server-side per request from Finnhub (with a Polygon fallback).

```
Providers ──► /api/cron/refresh ──► Supabase (news_*) ──► Server Components ──► UI
(Polygon, Finnhub,      (cron)                                (per request)
 EDGAR, FMP, Quiver,
 Anthropic)
```

### Database tables (`news_*`)

| Table | Purpose |
|-------|---------|
| `news_items` | Headlines + sentiment + tickers |
| `news_filings` | SEC EDGAR filings |
| `news_movers` | Snapshots of gainers/losers/most-active (`news_movers_latest` view = newest batch) |
| `news_congress_trades` | Congressional stock trades |
| `news_briefings` | AI-generated daily briefings |
| `news_cron_runs` | Audit log of each cron run (status + insert counts + errors) |

All `news_*` tables have **RLS enabled with public read** policies (migration `0002`) — the data is public market data, so it can be read with the anon key; writes go through the `service_role` key used by the cron.

## Getting started

### 1. Install
```bash
npm install
```

### 2. Environment variables
Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (used for reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (used by cron for writes) |
| `POLYGON_API_KEY` | Polygon.io / Massive |
| `FINNHUB_API_KEY` | Finnhub (news fallback + live quotes) |
| `FMP_API_KEY` | Financial Modeling Prep |
| `SEC_USER_AGENT` | Contact header required by SEC EDGAR, e.g. `TORQ News <you@email.com>` |
| `ANTHROPIC_API_KEY` | For AI briefing generation |
| `CRON_SECRET` | Any long random string; must match Vercel's env var |

> ⚠️ **Env gotcha:** `vercel pull` may write env values with a trailing literal `\n`. Strip it before use (it will otherwise break the Supabase URL at runtime).

### 3. Apply database migrations
Run these in the Supabase SQL editor (in order):
```
supabase/migrations/0001_news_tables.sql            # tables + indexes
supabase/migrations/0002_news_public_read_policies.sql  # public-read RLS
```

### 4. Run
```bash
npm run dev        # http://localhost:3000
```

### 5. Seed data locally
Cron only runs on Vercel. To populate locally, call the endpoint yourself:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/refresh
```

## Deployment

```bash
npm i -g vercel
vercel login
vercel            # preview
vercel --prod     # production
```

Set the environment variables above in the Vercel dashboard (Project → Settings → Environment Variables) for **Production** and **Preview**, then deploy. The cron in `vercel.json` activates automatically.

## Project layout

```
app/
  layout.tsx                  nav shell + header ticker search
  page.tsx                    /            live feed
  briefing/page.tsx           /briefing    AI daily briefing
  sentiment/page.tsx          /sentiment   sentiment tracker
  filings/page.tsx            /filings     SEC filings
  movers/page.tsx             /movers      gainers / losers / volume
  congress/page.tsx           /congress    congressional trades
  ticker/[symbol]/page.tsx    /ticker/*    per-symbol page + live quote
  api/cron/refresh/route.ts   cron endpoint (fetch → Supabase)
components/
  TickerSearch.tsx            header symbol lookup
lib/
  supabase.ts                 lazy client (service-role, anon fallback)
  fetchers/
    polygon.ts  finnhub.ts  fmp.ts  edgar.ts   ingestion sources
    quote.ts                 live single-symbol quote (Finnhub + Polygon fallback)
supabase/migrations/
  0001_news_tables.sql
  0002_news_public_read_policies.sql
vercel.json                   cron schedule
```

## Known limitations / notes

- **This repo's cron is not the full producer.** It ingests news, filings, and movers. Congress trades and AI briefings are read by the pages but their **fetchers are not in this repo** — those tables are populated by the live production deployment. If you make this repo the sole producer, port those fetchers first.
- **Movers source:** the recovered `fmp.ts` calls FMP's `/api/v3/stock_market/*` endpoint, which is now a **dead legacy endpoint**, and Polygon's snapshot is not authorized on the free tier. The live `news_movers` data (with volume + prev-close) comes from a source not in this repo. A working replacement is either Polygon's full-market snapshot (paid tier) or FMP `/stable/biggest-gainers` + per-ticker volume enrichment.
- **Live quotes** use Finnhub `/quote` + `/profile2` (real-time-ish), falling back to Polygon previous-close. FMP's `/api/v3/quote` is legacy and no longer works.

## License

Private / internal project.

<!-- ci: git-connection test fe04e3f -->
