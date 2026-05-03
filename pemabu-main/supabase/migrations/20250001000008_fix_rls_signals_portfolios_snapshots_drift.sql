-- Fix signals RLS
drop policy if exists "owner_all_signals"
  on public.signals;

create policy "owner_select_signals"
  on public.signals for select
  using (
    portfolio_id in (
      select id from public.portfolios
      where user_id = (select auth.uid())
    )
  );

create policy "owner_insert_signals"
  on public.signals for insert
  with check (
    portfolio_id in (
      select id from public.portfolios
      where user_id = (select auth.uid())
    )
  );

create policy "owner_update_signals"
  on public.signals for update
  using (
    portfolio_id in (
      select id from public.portfolios
      where user_id = (select auth.uid())
    )
  );

create policy "owner_delete_signals"
  on public.signals for delete
  using (
    portfolio_id in (
      select id from public.portfolios
      where user_id = (select auth.uid())
    )
  );

-- Fix portfolios RLS (same pattern)
drop policy if exists "owner_all_portfolios"
  on public.portfolios;

create policy "owner_select_portfolios"
  on public.portfolios for select
  using (auth.uid() = user_id);

create policy "owner_insert_portfolios"
  on public.portfolios for insert
  with check (auth.uid() = user_id);

create policy "owner_update_portfolios"
  on public.portfolios for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owner_delete_portfolios"
  on public.portfolios for delete
  using (auth.uid() = user_id);

-- Fix allocation_snapshots RLS
drop policy if exists "owner_read_snapshots"
  on public.allocation_snapshots;

create policy "owner_select_snapshots"
  on public.allocation_snapshots for select
  using (
    portfolio_id in (
      select id from public.portfolios
      where user_id = (select auth.uid())
    )
  );

-- Snapshots are inserted by service role (cron)
-- No INSERT policy needed for authenticated role

-- Fix drift_events RLS
drop policy if exists "owner_read_drift_events"
  on public.drift_events;

create policy "owner_select_drift_events"
  on public.drift_events for select
  using (
    portfolio_id in (
      select id from public.portfolios
      where user_id = (select auth.uid())
    )
  );

-- Drift events inserted by service role (cron)
-- No INSERT policy needed for authenticated role
