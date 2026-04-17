-- Ensure authenticated role can perform owner-scoped writes
-- when RLS policies allow (fixes missing default grants on some projects).

grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.portfolios to authenticated;
grant select, insert, update, delete on public.portfolio_holdings to authenticated;
grant select, insert, update, delete on public.signals to authenticated;
grant select, insert, update, delete on public.drift_events to authenticated;
grant select, insert, update, delete on public.allocation_snapshots to authenticated;
