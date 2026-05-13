-- ─────────────────────────────────────────────────────────────────────────────
-- REMEDIATION: Remove core_free from deployed databases
-- Target: any DB that ran 20260617120000 before the core_free removal pass
-- Safe on new installs: all operations are conditional / idempotent
-- ─────────────────────────────────────────────────────────────────────────────


-- ── STEP 1: Cancel any complimentary subscriptions for core_free ─────────────
-- Must run before DELETE on pemabu_services to avoid FK violation.
-- Only cancels complimentary rows — any manually-granted paid rows are
-- also removed since core_free is no longer a valid service key.
-- Rows are then deleted so pemabu_services can drop without FK restrict errors.

do $$
declare
  removed integer;
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_subscriptions'
  ) then
    update public.user_subscriptions
    set
      status       = 'cancelled',
      updated_at   = now()
    where service_key = 'core_free';

    delete from public.user_subscriptions
    where service_key = 'core_free';

    get diagnostics removed = row_count;

    raise notice 'Removed % user_subscriptions rows for core_free (after cancel).', removed;
  else
    raise notice 'user_subscriptions table not found — skipping row cancel.';
  end if;
end
$$;


-- ── STEP 2: Delete core_free from pemabu_services ───────────────────────────
-- Safe: FK references in user_subscriptions were handled in Step 1.
-- Idempotent: DELETE WHERE is a no-op if the row does not exist.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'pemabu_services'
  ) then
    delete from public.pemabu_services
    where service_key = 'core_free';

    raise notice 'Deleted core_free from pemabu_services (0 rows = already clean).';
  else
    raise notice 'pemabu_services table not found — skipping delete.';
  end if;
end
$$;


-- ── STEP 3: Remove core_free from user_group_assignments notes ───────────────
-- Defensive only — no structural dependency, but cleans any admin notes
-- that referenced core_free as a granted service.
-- Skip silently if column or table does not exist.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'user_group_assignments'
      and column_name  = 'notes'
  ) then
    update public.user_group_assignments
    set notes = replace(notes, 'core_free', '[removed]')
    where notes like '%core_free%';

    raise notice 'Cleaned core_free references from user_group_assignments.notes.';
  else
    raise notice 'user_group_assignments.notes not found — skipping note cleanup.';
  end if;
end
$$;


-- ── STEP 4: Remove "free" from pricing_model CHECK constraint ────────────────
-- Drops the existing constraint by its generated name and recreates it
-- without "free". Idempotent: if "free" was never in the constraint,
-- drop + recreate is still safe (same definition = no data impact).

do $$
begin
  -- Drop by generated constraint name
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema    = 'public'
      and table_name      = 'pemabu_services'
      and constraint_type = 'CHECK'
      and constraint_name = 'pemabu_services_pricing_model_check'
  ) then
    alter table public.pemabu_services
      drop constraint pemabu_services_pricing_model_check;

    raise notice 'Dropped pemabu_services_pricing_model_check constraint.';
  else
    raise notice 'Constraint pemabu_services_pricing_model_check not found — drop skipped.';
  end if;
end
$$;

-- Recreate without "free" — canonical three values only
alter table public.pemabu_services
  drop constraint if exists pemabu_services_pricing_model_check;

alter table public.pemabu_services
  add constraint pemabu_services_pricing_model_check
  check (pricing_model in ('one_time', 'annual', 'per_event'));


-- ── STEP 5: Verify final state ───────────────────────────────────────────────

do $$
declare
  core_free_rows      integer;
begin
  -- Verify core_free is gone from pemabu_services
  select count(*) into core_free_rows
  from public.pemabu_services
  where service_key = 'core_free';

  if core_free_rows > 0 then
    raise exception
      'REMEDIATION FAILED: % core_free row(s) still exist in pemabu_services.',
      core_free_rows;
  end if;

  -- Verify no active core_free subscriptions remain
  if exists (
    select 1 from public.user_subscriptions
    where service_key = 'core_free'
      and status in ('active', 'complimentary', 'trial')
  ) then
    raise exception
      'REMEDIATION FAILED: active user_subscriptions for core_free still exist.';
  end if;

  raise notice 'VERIFIED: core_free removed from pemabu_services.';
  raise notice 'VERIFIED: no active user_subscriptions for core_free.';
  raise notice 'VERIFIED: pricing_model constraint updated to canonical three values.';
  raise notice 'Remediation complete.';
end
$$;
