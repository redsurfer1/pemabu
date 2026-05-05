# Allocation Intelligence v3.2 — Validation Report

**Generated:** 2026-05-03  
**Environment:** Local `npm run build`, `npm run test` (Vitest)

---

## 9.1 Schema checks

| Check | Result |
|-------|--------|
| New migration file `20260503120000_allocation_v32_schema_alignment.sql` adds `sleeves.weighting_method`, `sleeve_holdings.manual_*`, extended `sleeve_snapshots` metrics, `price_cache` structured index | **Ready** — apply with Supabase CLI / dashboard against your Postgres instance |
| Prisma models | **N/A** — repository uses Supabase SQL migrations only (no `@prisma/client` per dependency constraints) |

---

## 9.2 Engine checks

| Command | Result |
|---------|--------|
| `npx vitest run lib/allocation/engine.test.ts` | **8 passed** |

Mission referenced Jest; project standard is **Vitest** (`npm run test`).

---

## 9.3 Computation invariants (after migration + seed)

**Not executed against production DB in this run** (no remote credentials). After applying migrations and optional seed:

- Main sleeve active targets should sum to ≈ `1 - incomeBudgetPct` (engine tests cover synthetic case).
- Income sleeve targets sum to `incomeBudgetPct` (tested).
- Score and return weight sums validated via assumptions editing / defaults.

---

## 9.4 API checks

| Endpoint | Notes |
|----------|--------|
| `GET /api/prices/current` | Requires authenticated Supabase session (`401` if anonymous). Delegates to `getCurrentPrices`. |
| `GET /api/prices/historical` | Same auth rule; uses `getHistoricalPrices` with `date-fns` windows. |
| `PriceCache` | Populated by `lib/prices/priceService.ts` on fetch (existing `cache_key` scheme retained). |

---

## 9.5 UI checks

| Item | Status |
|------|--------|
| `/portfolio/sleeves` | Builds successfully; uses `PortfolioDashboard` + refreshed allocation engine imports |
| KPI / sleeves | Existing components; full spreadsheet parity depends on seeded holdings |

---

## Summary

- **Build:** `npm run build` — success  
- **Tests:** `npm run test` — 75 passed (includes allocation engine suite)  
- **Database:** Run pending SQL migrations on your Supabase project before relying on new snapshot columns.
