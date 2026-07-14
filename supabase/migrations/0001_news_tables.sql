-- TORQ News Desk — schema for news feed, SEC filings, and market movers.
-- Runs inside existing TORQ Supabase project (npukynbaglmcdvzyklqa).
-- All tables prefixed with news_ to avoid collision with TORQ Console tables.

-- =========================================================================
-- news_items: headlines from Polygon (primary) + Finnhub (fallback)
-- =========================================================================
create table if not exists public.news_items (
  id               bigserial primary key,
  source           text not null,                 -- 'polygon' | 'finnhub'
  source_id        text,                          -- vendor's id for dedup
  headline         text not null,
  summary          text,
  url              text not null,
  publisher        text,                          -- e.g. "Benzinga", "Reuters"
  tickers          text[] default '{}',
  image_url        text,
  keywords         text[] default '{}',
  sentiment        text,                          -- polygon: positive|negative|neutral
  published_at     timestamptz not null,
  fetched_at       timestamptz not null default now()
);

create unique index if not exists news_items_source_sourceid_key
  on public.news_items (source, source_id)
  where source_id is not null;

create index if not exists news_items_published_at_desc_idx
  on public.news_items (published_at desc);

create index if not exists news_items_tickers_gin_idx
  on public.news_items using gin (tickers);

-- =========================================================================
-- news_filings: SEC EDGAR filings
-- =========================================================================
create table if not exists public.news_filings (
  id               bigserial primary key,
  accession_number text not null unique,          -- EDGAR unique id
  cik              text not null,
  company_name     text not null,
  ticker           text,
  form_type        text not null,                 -- 8-K, 10-Q, 10-K, 13F, etc
  title            text,
  filing_url       text not null,
  document_url     text,
  filed_at         timestamptz not null,
  fetched_at       timestamptz not null default now()
);

create index if not exists news_filings_filed_at_desc_idx
  on public.news_filings (filed_at desc);

create index if not exists news_filings_ticker_idx
  on public.news_filings (ticker)
  where ticker is not null;

create index if not exists news_filings_form_type_idx
  on public.news_filings (form_type);

-- =========================================================================
-- news_movers: snapshot of gainers / losers / most-active from Polygon
-- Each cron run inserts a fresh batch tagged with captured_at
-- =========================================================================
create table if not exists public.news_movers (
  id               bigserial primary key,
  captured_at      timestamptz not null default now(),
  category         text not null,                 -- 'gainers' | 'losers' | 'volume'
  rank             int not null,                  -- 1..N within that category/batch
  ticker           text not null,
  company_name     text,
  last_price       numeric,
  change_amount    numeric,
  change_percent   numeric,
  volume           bigint,
  prev_close       numeric
);

create index if not exists news_movers_captured_at_desc_idx
  on public.news_movers (captured_at desc);

create index if not exists news_movers_category_idx
  on public.news_movers (category);

-- Helper view: latest movers batch per category
create or replace view public.news_movers_latest as
select m.*
from public.news_movers m
join (
  select category, max(captured_at) as latest
  from public.news_movers
  group by category
) latest on latest.category = m.category and latest.latest = m.captured_at
order by m.category, m.rank;

-- =========================================================================
-- cron_runs: audit trail of each refresh job
-- =========================================================================
create table if not exists public.news_cron_runs (
  id               bigserial primary key,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  status           text not null default 'running',  -- running | ok | partial | failed
  news_inserted    int default 0,
  filings_inserted int default 0,
  movers_inserted  int default 0,
  errors           jsonb default '[]'::jsonb
);

create index if not exists news_cron_runs_started_at_idx
  on public.news_cron_runs (started_at desc);
