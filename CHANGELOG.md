# Changelog — Allocation Intelligence v3.2 Alignment

All changes made during the Pemabu Platform v3.2 audit and alignment pass.

---

## [v3.2.0] — 2026-05-03

### Added

#### Phase 0 — Audit
- `AUDIT_REPORT.md` — Full gap analysis of the codebase vs the Allocation Intelligence v3.2 spreadsheet. Covers schema gaps, engine formula bugs, missing server actions, wrong computation location (client vs server), and UI column gaps.

#### Phase 1 — Database Schema
- `supabase/migrations/20260503000001_add_allocation_intelligence_v32.sql`
  - `sleeves.weighting_method` column (CHECK constraint: COMPOSITE_SCORE | YIELD_PROPORTIONAL | MANUAL), back-filled from `purpose`
  - `sleeve_holdings.manual_pricing`, `manual_target_wt`, `sort_order` columns
  - 13 columns to `sleeve_snapshots`: `vol_3mo`, `sharpe_proxy`, `div_apy`, `pr_expense`, `pr_return`, `pr_div_apy`, `pr_sharpe`, `raw_score_wt`, `equal_wt_base`, `theme_capped_wt`, `final_target_wt`, `parity_dollar_amt`, `parity_dollar_chg`
  - 3 columns to `price_cache`: `ticker`, `period`, `cache_date` (back-filled from `cache_key`)
  - Indexes: `idx_sleeves_weighting_method`, `idx_sleeve_holdings_sort_order`, `idx_price_cache_ticker_period`

#### Phase 2 — Computation Engine
- `lib/allocation/v3-engine.ts` — Full rewrite of the allocation computation engine
  - Fixed `parityGapPct = currentWtPct - targetWtPct` (was wrong ratio formula)
  - Fixed `themeExposurePct` computed on pre-normalization `cappedWt` (3-pass algorithm)
  - Added `themeCappedWt` to all active holding outputs
  - Added `parityDollarAmt = finalTargetWt × navForParity`
  - Fixed income sleeve `currentWtPct` denominator to use `totalPortfolioNAV` (not sleeve subtotal)
  - Added `id` and `name` fields to `HoldingInput` and all engine outputs
  - Exports: `computeMainSleeve`, `computeIncomeSleeve`, `percentRank`, `computeReturns`, `computeBlendedReturn`, `computeVolAndSharpe`, `computeCompositeScore`, `computeTrendSignal`
- `lib/allocation/engine.test.ts` — 22 unit tests covering:
  - `percentRank` (4 cases including boundary and single-element)
  - `computeReturns` (period returns + zero-price guard)
  - `computeBlendedReturn` (weighted sum against defaults)
  - `computeVolAndSharpe` (vol formula, sharpe formula, div-by-zero floor)
  - `computeTrendSignal` (entry/exit/hold boundaries)
  - `computeMainSleeve` vol cap (CAPPED flag correct)
  - `computeMainSleeve` theme cap (themeExposurePct ≥ cap, sum still 0.88)
  - `computeMainSleeve` weight invariants (sum ≈ 0.88, comparables, parity direction)
  - `computeIncomeSleeve` (sum ≈ 0.12, APY ordering, parity direction)
  - `computeCompositeScore` (weighted sum)

#### Phase 3 — Price Service
- `lib/prices/priceService.ts` — Server-side price fetching via yahoo-finance2
  - `getCurrentPrices(tickers)`: batched 10 per call, 15-min Supabase cache
  - `getHistoricalPrices(tickers, periods)`: per-period `.historical()` calls, 24h cache
  - Cache keys: `current:TICKER:current:YYYY-MM-DD`, `hist:TICKER:3mo:YYYY-MM-DD`
  - No `"use client"` — server-only module

#### Phase 4 — Server Actions
- `lib/actions/portfolio/createSleeve.ts` — Creates sleeve with budget validation (sum ≤ 1.0)
- `lib/actions/portfolio/removeSleeve.ts` — Soft-deletes sleeve; prevents deleting last one
- `lib/actions/portfolio/updateAssumptions.ts` — Validates retWeights sum = 1.0 and scoreWeights sum = 1.0 (±0.001), upserts `model_assumptions`
- `lib/actions/portfolio/addHolding.ts` — Inserts `sleeve_holdings` row with all v3.2 fields including `manual_pricing`, `manual_target_wt`, `sort_order`
- `lib/actions/portfolio/updateHolding.ts` — Partial update with ownership check via sleeve → portfolio join
- `lib/actions/portfolio/refreshPortfolioPrices.ts` — Full refresh pipeline: loads sleeves by `weighting_method`, fetches prices for non-manual holdings, computes engine, writes all 13 new snapshot fields, calls `revalidatePath`

#### Phase 5 — Types
- `types/allocation.ts` — Full rewrite to v3.2 spec
  - New: `SleeveWeightingMethod`, `ModelAssumptionsView`, `EngineAssumptions`, `PortfolioKPIs`, `PortfolioView`, `SleeveView`
  - Updated `ComputedHolding`: added `id`, `name`, `price3mo-5yr`, `themeCappedWt`, `finalTargetWt`, `parityDollarAmt`
  - Updated `HoldingInput`: added `id`, `name`
  - Legacy aliases: `SleeveData = SleeveView & {entry/exit keys}`, `ModelAssumptions = ModelAssumptionsView & {id, portfolioId}`
  - `DEFAULT_ENGINE_ASSUMPTIONS` constant (all v3.2 defaults)

#### Phase 6 — UI Components
- `components/portfolio/PortfolioKPIBar.tsx` — 8-metric KPI bar with `RelativeTime` sub-component (30s auto-refresh, exact timestamp on hover)
- `components/portfolio/RefreshButton.tsx` — Server action trigger with 60-second cooldown countdown and per-ticker error display
- `components/portfolio/HoldingsTable.tsx` — Full rewrite; prop changed to `weightingMethod: SleeveWeightingMethod`; COMPOSITE_SCORE adds rawScoreWt/themeCappedWt/finalTargetWt/parityDollarAmt columns; parity $ Chg formatted as `+$X.XX` / `($X.XX)`; Comparable rows opacity-50 with italic ticker
- `components/portfolio/SleeveCard.tsx` — Full rewrite; uses `weightingMethod`; parity fill bar (red=under, green=over); `METHOD_LABELS` map; signal summary handles both old and new key names
- `components/portfolio/SleeveManager.tsx` — Full rewrite; `SleeveDisplayData` includes `weightingMethod`; budget allocation bar with 5-color scheme
- `components/portfolio/AddSleeveModal.tsx` — Added `weightingMethod` dropdown with `DEFAULT_METHOD` auto-mapping per purpose

#### Phase 7 — Portfolio Page
- `components/portfolio/PortfolioDashboard.tsx` — Full rewrite; dispatches to engine by `weighting_method`; reads `manual_pricing` and `manual_target_wt`; builds `PortfolioKPIs`; uses `PortfolioKPIBar` and `RefreshButton`

#### Phase 8 — Seed Data (corrected against actual spreadsheet)
- `supabase/seed-allocation.ts` — Demo portfolio seed with exact values from `Allocation_Intelligence_Model_v3_2.xlsx`
  - 60 active ETF holdings in Main ETF sleeve (COMPOSITE_SCORE)
  - 40 comparable holdings (status="Comparable", qty=0)
  - 9 income holdings in Income sleeve (YIELD_PROPORTIONAL): CCNR, DIVO, FYEE, GPIX, IAUI, IDVO, IQQQ, JEPQ, KGLD
  - 6 Fidelity/Cash holdings (MANUAL, manual_pricing=true)
  - `model_assumptions` row with all v3.2 defaults

#### Phase 9 — Validation
- `VALIDATION_REPORT.md` — Schema checks, unit test results, computation invariants, API checks, UI checks, seed integrity
- `CHANGELOG.md` — This file

---

### Modified

| File | Change |
|---|---|
| `lib/actions/refreshPrices.ts` | Changed from inline implementation to re-export of `refreshPortfolioPrices as refreshPrices` (backwards compatibility) |
| `lib/allocation/v3-engine.ts` | `percentRank` clamped to `[0, 1]` — Excel PERCENTRANK never returns > 1; in-array targets already guaranteed in [0,1] but clamping prevents edge-case overflow for values above the array max |
| `lib/allocation/engine.test.ts` | Vol cap test redesigned: 60-holding universe with one extreme outlier (price3mo=1 → 99× return) to reliably trigger the 3× cap at 5% threshold; `percentRank` over-max test fixed to expect 1 (clamped) |
| `supabase/seed-allocation.ts` | Fully rewritten with exact qty/priceSeed/expenseRatio/divDollar values from the attached spreadsheet; comparable holdings now include correct names and expense ratios; FIDELITY_HOLDINGS uses actual dollar balances and expense ratios from the Fidelity sheet |

---

### Engine Formula Corrections vs Pre-v3.2

| Bug | Old Formula | Corrected Formula |
|---|---|---|
| `parityGapPct` | `(value - targetDollar) / targetDollar` | `currentWtPct - targetWtPct` |
| `themeExposurePct` basis | post-normalization `targetWeights` | pre-normalization `cappedWt` (pass 2 of 3) |
| Income `currentWtPct` denominator | `sleeveSubtotalValue` | `totalPortfolioNAV` |
| `themeCappedWt` | not in output | added to `ComputedHolding` |
| `parityDollarAmt` | not computed | `finalTargetWt × navForParity` |
| `HoldingInput.name` | hardcoded to ticker | sourced from `h.name` |
| `HoldingInput.id` | missing | required field, passed through |
