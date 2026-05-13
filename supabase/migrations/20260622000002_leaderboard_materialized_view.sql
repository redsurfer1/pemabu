-- Pre-computed leaderboard rows for fast reads.

create materialized view if not exists public.marketplace_leaderboard_scores as
select
  ms.id,
  ms.display_name,
  ms.published_at,
  ms.strategy_grade,
  ms.blueprint_adherence_score,
  ms.vw_rsi_performance_score,
  count(mss.user_id)::bigint as subscriber_count
from public.marketplace_strategies ms
left join public.marketplace_strategy_subscribers mss
  on mss.strategy_id = ms.id
group by
  ms.id,
  ms.display_name,
  ms.published_at,
  ms.strategy_grade,
  ms.blueprint_adherence_score,
  ms.vw_rsi_performance_score;

create unique index if not exists idx_leaderboard_scores_id
  on public.marketplace_leaderboard_scores (id);

create index if not exists idx_leaderboard_scores_grade
  on public.marketplace_leaderboard_scores (strategy_grade desc nulls last);

create or replace function public.refresh_leaderboard_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.marketplace_leaderboard_scores;
end;
$$;

revoke all on function public.refresh_leaderboard_scores() from public;
grant execute on function public.refresh_leaderboard_scores() to service_role;

grant select on public.marketplace_leaderboard_scores to authenticated;
grant select on public.marketplace_leaderboard_scores to anon;
