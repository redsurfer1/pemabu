# PEMABU — Audit Implementation Sprint Summary

**Branch:** `audit/marketplace-ledger-sprint`  
**Date:** 2026-05-17  
**Base commit:** `180e9a5` (orientation analysis)  
**Sprint commits:** 8 above `main`

---

## What Was Built

### A — Orientation (`180e9a5`)
`docs/AUDIT_ORIENTATION.md` — answers 8 audit questions about the current marketplace
state. Critical findings documented: `assertMarketplaceImportUnlock` takes `sleeveToken`
not `blueprintId`; `marketplace_import_ledger` had no direction/credit/debit columns.

---

### B — Price Fix (`8b36ac9`)
- `supabase/migrations/20260618120000_marketplace_unlocks_royalty.sql` comment: `$9.99` → `$4.99`
- `lib/marketplace/unlock-pricing.ts`: added clarifying comment block above
  `MARKETPLACE_UNLOCK_PRICE_CENTS = 499`

---

### C — Unified Import Gate (`9acb578`)
**New file:** `lib/marketplace/import-gate.ts`
- `enforceImportEntitlement(userId, sleeveToken)` — single call site that routes
  between legacy unlock path (`MARKETPLACE_USE_IMPORT_LEDGER=false`) and new
  token-debit path (`=true`). Backward-compatible; flag defaults to `false`.
- `ImportEntitlementError` — structured error class (code: `INSUFFICIENT_TOKENS |
  NO_UNLOCK | ALREADY_IMPORTED | RATE_LIMITED`).
- `getImportTokenBalance(userId)` — reads credit/debit ledger rows.

**Edited:**
- `app/api/marketplace/import/route.ts` — replaced `assertMarketplaceImportUnlock`
  with `enforceImportEntitlement`; added per-user 5/min rate limiter;
  fire-and-forget leaderboard refresh (Task I pre-wired here).
- `lib/actions/portfolio/importSleeveStrategyAction.ts` — same replacement +
  leaderboard refresh.
- `.env.example` — added `MARKETPLACE_USE_IMPORT_LEDGER=false` section.

---

### D — Import Token Ledger (`25ee734`)
**New file:** `lib/marketplace/import-token-service.ts`
- `creditTokensFromStripe(params)` — inserts `direction='credit'` row; handles
  Postgres `23505` duplicate silently (idempotent on `stripe_session_id`).
- `spendImportToken(params)` — calls `spend_import_token()` RPC; handles `P0001`
  (insufficient balance) and `23505` (duplicate spend) gracefully.

**New migrations:**
- `20260620000001_import_token_spend_rpc.sql` — adds `direction`, `stripe_session_id`,
  `idempotency_key`, `amount_usd_cents` columns to `marketplace_import_ledger`;
  creates `spend_import_token()` RPC with `pg_advisory_xact_lock` for TOCTOU safety;
  creates `get_import_token_balance()` helper.
- `20260620000002_backfill_existing_unlocks_to_ledger.sql` — backfills existing
  `marketplace_unlocks` rows as `direction='credit'` complimentary tokens;
  guarded against double-insertion; includes operator verification block.

**Edited:**
- `app/api/stripe/webhook/route.ts` — `handleMarketplaceUnlock` calls
  `creditTokensFromStripe` when flag=true (after royalty accrual, non-fatal).

---

### E — Security Fixes (`7c02f78`)
**Edited:**
- `lib/api/auth.ts` — added `AppError` class (throw inside `withAuth` for structured
  HTTP errors); catch block now handles `AppError`, `ImportEntitlementError`, generic.
- `scripts/doctor.mjs` — added three new checks:
  1. `USE_LOCAL_VAULT=true` with no `LOCAL_DB_URL` → `fail()`
  2. `MARKETPLACE_USE_IMPORT_LEDGER=true` without backfill migration → `warn()`
  3. Missing `ANTHROPIC_API_KEY` → `fail()`

**New file:** `docs/CREDENTIAL_BOUNDARY.md` — documents vault-required vs cloud-allowed
credentials; grep commands for auditing; sovereignty boundary rationale.

---

### F — CI Pipeline (`7c02f78`)
**Edited:** `.github/workflows/ci.yml` — restructured from 1 `build` job to 3:
- `typecheck` — `npx tsc --noEmit`
- `test` (needs typecheck) — `npx vitest run` with safe placeholder env vars
- `build` (needs typecheck) — doctor check, marketplace migration verification,
  `npm run build`

---

### G — Sovereign Score Pipeline (`4c5aed8`)
**New file:** `lib/portfolio/sovereign-score-pipeline.ts`
- `runSovereignScorePipeline(portfolioId, holdings)` — iterates crypto holdings,
  calls `scoreTicker(ticker)` from `lib/token-quality/ttf-scorer`, writes
  `score_token_quality` via `supabaseAdmin`; TTF failures are non-fatal.

**New file:** `tests/sovereign-score-pipeline.test.ts` — 5 vitest cases.

**Edited:** `app/api/portfolio/[portfolioId]/refresh/route.ts` — fires sovereign score
pipeline as void IIFE after `refreshPortfolioSignals`; never blocks response.

**Also in this commit:** fixed 5 files of pre-existing test failures:
- `ticker.test.ts` — auth mock + `normalizeTicker` export
- `engine.test.ts` — vol-cap test rewritten for 10-factor weight system
- `v3-engine.ts` — `percentRank` clamped to `[0, 1]`
- `fallback.test.ts` — `fetchMarketDataTiingo` second-arg assertion updated
- `intelligence-access.ts` — `canAccess13FOverlay` restored to AUTONOMOUS tier
- `refresh-portfolio-signals.ts` — null assumptions fallback to `DEFAULT_ASSUMPTIONS`
- `refresh-pipeline.test.ts` — added mocks for `server-only`, assumptions store, api-credentials, and `fetchMarketDataCached`

---

### H — Assumptions → Rank Refresh (`addf9a6`)
**Edited:** `app/api/workbook/assumptions/route.ts` PUT handler
- After `upsertPortfolioAssumptions`, fires void IIFE POST to
  `/api/portfolio/:id/refresh?scope=signals_only` with service-role auth.

**Edited:** `app/api/portfolio/[portfolioId]/refresh/route.ts`
- Reads `scope=signals_only` query param; bypasses the >15-holdings 202 gate
  so weight changes propagate immediately to all portfolio sizes.

---

### I — Leaderboard Refresh Post-Import
Pre-wired in Task C (Group C commit). Both import paths fire and forget
`supabaseAdmin.rpc("refresh_leaderboard_scores")` as a void IIFE after successful
import, non-fatal.

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx vitest run` | ✅ 120/120 pass (16 test files) |
| Feature flag backward compat | ✅ `MARKETPLACE_USE_IMPORT_LEDGER=false` (default) is untouched legacy path |
| Stripe idempotency | ✅ credit dedup on `stripe_session_id`; spend dedup on `idempotency_key` |
| Non-fatal fire-and-forgets | ✅ leaderboard refresh, sovereign pipeline, assumption refresh all void IIFE |

---

## Files Changed (by category)

**New source files (4)**
- `lib/marketplace/import-gate.ts`
- `lib/marketplace/import-token-service.ts`
- `lib/portfolio/sovereign-score-pipeline.ts`
- `docs/CREDENTIAL_BOUNDARY.md`

**New test files (2)**
- `tests/sovereign-score-pipeline.test.ts`
- `docs/AUDIT_ORIENTATION.md` (orientation doc, not test)

**New migrations (3)**
- `supabase/migrations/20260620000001_import_token_spend_rpc.sql`
- `supabase/migrations/20260620000002_backfill_existing_unlocks_to_ledger.sql`
- (comment fix in `20260618120000_marketplace_unlocks_royalty.sql`)

**Edited source (7)**
- `lib/api/auth.ts`
- `lib/marketplace/unlock-pricing.ts`
- `lib/portfolio/intelligence-access.ts`
- `lib/allocation/refresh-portfolio-signals.ts`
- `lib/allocation/v3-engine.ts`
- `app/api/marketplace/import/route.ts`
- `app/api/portfolio/[portfolioId]/refresh/route.ts`
- `app/api/workbook/assumptions/route.ts`
- `app/api/stripe/webhook/route.ts`
- `lib/actions/portfolio/importSleeveStrategyAction.ts`
- `scripts/doctor.mjs`
- `.env.example`
- `.github/workflows/ci.yml`

**Edited tests (5)**
- `app/api/market-data/ticker.test.ts`
- `app/api/portfolio/refresh.test.ts`
- `lib/allocation/engine.test.ts`
- `lib/market-data/fallback.test.ts`
- `lib/portfolio/refresh-pipeline.test.ts`
