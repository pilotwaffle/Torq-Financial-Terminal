# TORQ News Desk

Self-hosted stocktitan.net-style market news dashboard.

- **Live feed** — headlines from Polygon.io/Massive (primary) + Finnhub (fallback)
- **SEC filings** — 8-K, 10-Q, 10-K, 13F, S-1, Form 4, etc. from EDGAR
- **Movers** — top gainers / losers / most-active from Polygon

Refreshes every 4 hours via Vercel Cron.

## Stack

- Next.js 14 (App Router, Server Components)
- Supabase (reuses existing TORQ project `npukynbaglmcdvzyklqa`, tables prefixed `news_`)
- Vercel (hosting + cron)
- Tailwind CSS (dark minimal UI)

## Setup

### 1. Install dependencies
```
cd E:\torq-news
npm install
```

### 2. Environment variables
`.env.local` is already populated with your Polygon + Finnhub keys and SEC User-Agent. You still need to add:

- `SUPABASE_SERVICE_ROLE_KEY` — from https://supabase.com/dashboard/project/npukynbaglmcdvzyklqa/settings/api (the `service_role` key, NOT the anon key)
- `CRON_SECRET` — any long random string; must match the same env var in Vercel

### 3. Apply database migration
In the Supabase SQL editor (https://supabase.com/dashboard/project/npukynbaglmcdvzyklqa/sql), paste and run the contents of:
```
supabase/migrations/0001_news_tables.sql
```
This creates four tables: `news_items`, `news_filings`, `news_movers`, `news_cron_runs` — all prefixed so they don't collide with TORQ Console tables.

### 4. Run locally
```
npm run dev
```
Open http://localhost:3000

### 5. Seed data manually (local dev)
Cron jobs only run on deployed Vercel. To populate locally, call the endpoint yourself:
```
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/refresh
```
You should see a JSON response with counts. Then reload the pages.

## Deploy to Vercel

```
npm i -g vercel       # if not already installed
vercel login          # interactive — opens browser
cd E:\torq-news
vercel                # first deploy: creates project, prompts for settings
```

Then add env vars (either via dashboard or CLI):
```
vercel env add POLYGON_API_KEY production
vercel env add FINNHUB_API_KEY production
vercel env add SEC_USER_AGENT production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add CRON_SECRET production
```

Deploy to prod:
```
vercel --prod
```

The cron defined in `vercel.json` (`0 */4 * * *`) activates automatically once deployed.

## Cron schedule

`0 */4 * * *` UTC — runs at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC daily.

During EDT (Mar–Nov), that's ET 20:00, 00:00, 04:00, 08:00, 12:00, 16:00.
During EST (Nov–Mar), that's ET 19:00, 23:00, 03:00, 07:00, 11:00, 15:00.

Either way you get a run at / near 08:00 ET and 5 other times.

## Data source notes

- **Polygon/Massive free tier:** 5 calls/min. Each cron uses ~4 calls, so we're well under.
- **Finnhub free tier:** 60 calls/min, fallback only.
- **SEC EDGAR:** no key, no rate limit in practice, but requires `User-Agent` header with contact info (already set).

## Auditing

Each cron run writes to `news_cron_runs` with status, insert counts, and errors. Query it:
```sql
select * from news_cron_runs order by started_at desc limit 20;
```

## Files

```
app/
  layout.tsx               nav shell
  page.tsx                 / — live news feed
  filings/page.tsx         /filings — SEC filings table
  movers/page.tsx          /movers — gainers / losers / volume
  api/cron/refresh/route.ts  cron endpoint
lib/
  supabase.ts              service-role client
  fetchers/
    polygon.ts             news + movers + snapshot
    finnhub.ts             news fallback
    edgar.ts               SEC atom feed parser
supabase/migrations/
  0001_news_tables.sql     schema
vercel.json                cron schedule
```

## Next steps (post-v1)

- Ticker detail page: `/ticker/[symbol]` aggregating news + filings + chart
- Real-time push: swap cron for Polygon WebSocket stream (paid tier) if you want sub-minute latency
- Styled shell: apply linear.app design-clone via Playwright MCP as originally planned
