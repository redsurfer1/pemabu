# Changelog — Allocation Intelligence Audit & Alignment

## 2026-05-03

### Added

- `AUDIT_REPORT.md` — Phase 0 codebase audit vs Allocation Intelligence v3.2.
- `VALIDATION_REPORT.md` — Phase 9 validation checklist results.
- `CHANGELOG.md` — This file.
- `supabase/migrations/20260503120000_allocation_v32_schema_alignment.sql` — Sleeve weighting method, manual holding fields, snapshot metric columns, structured `price_cache` index.
- `lib/allocation/allocation-intelligence-core.ts` — Pure v3.2 engine (`computePortfolioAllocations`, fixed theme-cap passes, parity gap = current − target).
- `lib/allocation/asset-class-engine.ts` — Legacy workbook asset-class engine + `refreshPortfolioSignals` (renamed from former `engine.ts` body).
- `lib/allocation/engine.test.ts` — Vitest coverage for PERCENTRANK, composites, income/main sums, parity dollars.
- `lib/prices/priceService.ts` — Yahoo + `price_cache` (`getCurrentPrices`, `getHistoricalPrices`), batched quotes.

### Changed

- `lib/allocation/engine.ts` — Re-exports v3.2 core + legacy asset-class module (breaking import path for code that imported only legacy APIs unchanged).
- `lib/actions/refreshPrices.ts` — Single-pass `computePortfolioAllocations`, uses `priceService`, resolves sleeve role via `weighting_method` / `purpose`, writes extended snapshot fields when migration applied.
- `components/portfolio/PortfolioDashboard.tsx` — `computeMainSleeve(..., fullNav)`, income inputs include `id`, imports from `@/lib/allocation/engine`.
- `app/api/prices/current/route.ts` — Auth gate + `getCurrentPrices`.
- `app/api/prices/historical/route.ts` — Auth gate + `getHistoricalPrices`.
- `types/allocation.ts` — `AllocationEngineHolding`, `IncomeHoldingInput`, `SleeveRole`, extended `ComputedHolding`.
- `vitest.config.ts` — Exclude `.claude/` worktrees from test discovery.

### Removed

- `lib/allocation/v3-engine.ts` — Logic superseded by `allocation-intelligence-core.ts`.

### Dependencies

- `date-fns`, `@dnd-kit/core`, `@dnd-kit/sortable`
