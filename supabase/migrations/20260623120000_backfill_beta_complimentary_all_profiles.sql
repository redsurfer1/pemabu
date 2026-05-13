-- ─────────────────────────────────────────────────────────────────────────────
-- One-time backfill: every existing `user_profiles` row → beta group +
-- complimentary subscriptions for all active `pemabu_services` rows.
--
-- Uses `assign_beta_grant_atomic` (same path as admin “grant beta”) so RLS /
-- triggers stay consistent. Safe to re-run: upserts group + subscriptions.
-- Run once on deploy via `supabase db push` / hosted migration runner.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  r         record;
  n_applied integer := 0;
  j         jsonb;
begin
  for r in select id from public.user_profiles
  loop
    j := public.assign_beta_grant_atomic(
      r.id,
      null::uuid,
      'Migration 20260623120000: backfill beta + complimentary for all existing profiles'
    );
    if coalesce((j ->> 'success')::boolean, false) then
      n_applied := n_applied + 1;
    else
      raise warning 'assign_beta_grant_atomic failed for user_id=%: %', r.id, j;
    end if;
  end loop;

  raise notice 'Backfill complete: assign_beta_grant_atomic succeeded for % user_profiles row(s).', n_applied;
end;
$$;
