-- Atomic increment of monthly scenario simulation counter.
-- Uses INSERT ... ON CONFLICT DO UPDATE to avoid race conditions.

create or replace function public.increment_scenario_sim_count(
  p_user_id  uuid,
  p_month_key text
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.scenario_simulation_events (user_id, month_key, event_count, updated_at)
  values (p_user_id, p_month_key, 1, now())
  on conflict (user_id, month_key)
  do update set
    event_count = scenario_simulation_events.event_count + 1,
    updated_at  = now();
end;
$$;

grant execute on function public.increment_scenario_sim_count(uuid, text) to service_role;
