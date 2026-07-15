-- Public read access for the news_* datasets.
--
-- These tables have RLS enabled. Without a SELECT policy, only the service_role
-- key (which bypasses RLS) can read them — so any render using the anon key
-- (e.g. a preview deploy that only has NEXT_PUBLIC_SUPABASE_ANON_KEY) silently
-- returns zero rows. The data is public market news, so we grant read to all.
--
-- Writes are unaffected: the cron uses the service_role key, which bypasses RLS.

drop policy if exists "public read news_items" on public.news_items;
create policy "public read news_items" on public.news_items
  for select using (true);

drop policy if exists "public read news_filings" on public.news_filings;
create policy "public read news_filings" on public.news_filings
  for select using (true);

drop policy if exists "public read news_movers" on public.news_movers;
create policy "public read news_movers" on public.news_movers
  for select using (true);

drop policy if exists "public read news_congress_trades" on public.news_congress_trades;
create policy "public read news_congress_trades" on public.news_congress_trades
  for select using (true);

drop policy if exists "public read news_briefings" on public.news_briefings;
create policy "public read news_briefings" on public.news_briefings
  for select using (true);
