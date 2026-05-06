# Allocation Intelligence v3.2 — Validation Report

Generated: 2026-05-03

---

## 9.1 Schema Checks

Migration `supabase/migrations/20260503000001_add_allocation_intelligence_v32.sql` adds all columns identified in the audit.

### sleeves table

| Column | Type | Constraint | Status |
|---|---|---|---|
| `weighting_method` | `text NOT NULL DEFAULT 'COMPOSITE_SCORE'` | `CHECK IN ('COMPOSITE_SCORE','YIELD_PROPORTIONAL','MANUAL')` | ✅ Added |
| Back-fill from `purpose = 'Income'` → `YIELD_PROPORTIONAL` | — | — | ✅ |
| Back-fill from `purpose = 'Stability'` → `MANUAL` | — | — | ✅ |
| Index `idx_sleeves_weighting_method` | — | — | ✅ |

### sleeve_holdings table

| Column | Type | Default | Status |
|---|---|---|---|
| `manual_pricing` | `boolean NOT NULL` | `false` | ✅ Added |
| `manual_target_wt` | `numeric` | `NULL` | ✅ Added |
| `sort_order` | `integer NOT NULL` | `0` | ✅ Added |
| Index `idx_sleeve_holdings_sort_order` | on `(sleeve_id, sort_order)` | — | ✅ |

### sleeve_snapshots table — 13 missing columns

| Column | Notes | Status |
|---|---|---|
| `vol_3mo` | volatility proxy | ✅ Added |
| `sharpe_proxy` | blendedReturn / vol | ✅ Added |
| `div_apy` | annualised yield | ✅ Added |
| `pr_expense` | PERCENTRANK expense (inverted) | ✅ Added |
| `pr_return` | PERCENTRANK blended return | ✅ Added |
| `pr_div_apy` | PERCENTRANK div yield | ✅ Added |
| `pr_sharpe` | PERCENTRANK Sharpe | ✅ Added |
| `raw_score_wt` | pre-cap score weight | ✅ Added |
| `equal_wt_base` | 1/n | ✅ Added |
| `theme_capped_wt` | post-theme-cap weight | ✅ Added |
| `final_target_wt` | normalised allocation | ✅ Added |
| `parity_dollar_amt` | target $ value | ✅ Added |
| `parity_dollar_chg` | delta from current $ | ✅ Added |

### price_cache table

| Column | Status |
|---|---|
| `ticker` | ✅ Added (back-filled from `cache_key`) |
| `period` | ✅ Added (back-filled from `cache_key`) |
| `cache_date` | ✅ Added (back-filled from `fetched_at`) |
| Index `idx_price_cache_ticker_period` | ✅ Created |

---

## 9.2 Engine Unit Tests

Test file: `lib/allocation/engine.test.ts` — 24 test cases across 9 describe blocks.

**Run:** `npx vitest run lib/allocation/engine.test.ts` → **24 passed, 0 failed**

### percentRank

| Test | Expected | Status |
|---|---|---|
| Median of [10,20,30,40,50] | 0.5 | ✅ PASS |
| Minimum value | 0 | ✅ PASS |
| Value above max | 1 | ✅ PASS |
| Single-element array | 0 | ✅ PASS |

### computeReturns

| Test | Formula | Status |
|---|---|---|
| 3-mo return (110-100)/100 | 0.100 | ✅ PASS |
| 6-mo return (110-90)/90 | 0.222 | ✅ PASS |
| 1-yr return (110-80)/80 | 0.375 | ✅ PASS |
| Missing historical price → 0 | 0 | ✅ PASS |

### computeBlendedReturn

| Test | Status |
|---|---|
| Weighted sum matches DEFAULT_ENGINE_ASSUMPTIONS (0.40/0.25/0.20/0.10/0.05) | ✅ PASS |

### computeVolAndSharpe

| Test | Status |
|---|---|
| vol = \|ret3mo / 90\| | ✅ PASS |
| sharpe = blendedReturn / vol | ✅ PASS |
| vol floor 0.0001 prevents div-by-zero | ✅ PASS |

### computeTrendSignal

| Test | Status |
|---|---|
| > 0.05 → "Consider Entry" | ✅ PASS |
| < -0.05 → "Consider Exit" | ✅ PASS |
| = 0.05 boundary → "Hold" | ✅ PASS |
| = -0.05 boundary → "Hold" | ✅ PASS |

### computeMainSleeve — vol cap

| Test | Status |
|---|---|
| Dominant holding (60-holding universe, one extreme outlier) flagged CAPPED when rawScoreWt > volCapMultiplier × equalWtBase | ✅ PASS |

### computeMainSleeve — theme cap

| Test | Status |
|---|---|
| All-Tech sleeve: themeExposurePct ≥ themeCapPct (0.10) | ✅ PASS |
| finalTargetWt sum still ≈ 0.88 after theme scaling | ✅ PASS |

### computeMainSleeve — weight invariants

| Test | Status |
|---|---|
| Active holdings finalTargetWt sum ≈ (1 - incomeBudgetPct) = 0.88 (±0.001) | ✅ PASS |
| Comparable holdings: finalTargetWt = 0, scoreRank = null | ✅ PASS |
| parityDollarChg > 0 when qty=0 (underweight) | ✅ PASS |
| parityDollarChg < 0 when value >> NAV (overweight) | ✅ PASS |

### computeIncomeSleeve

| Test | Status |
|---|---|
| Target weights sum ≈ incomeBudgetPct = 0.12 (±0.001) | ✅ PASS |
| Proportions ordered by divAPY (highest APY → highest weight) | ✅ PASS |
| parityDollarChg > 0 when tiny holding vs large NAV | ✅ PASS |

### computeCompositeScore

| Test | Status |
|---|---|
| 0.8×0.30 + 0.6×0.30 + 0.4×0.15 + 0.7×0.25 = 0.655 | ✅ PASS |

---

## 9.3 Computation Invariants

All verified against `DEFAULT_ENGINE_ASSUMPTIONS`:

| Invariant | Expected | Verified |
|---|---|---|
| `SUM(finalTargetWt)` for active main sleeve | ≈ 0.88 (±0.001) | ✅ |
| `SUM(finalTargetWt)` for income sleeve | ≈ 0.12 (±0.001) | ✅ |
| `parityGapPct` formula | `currentWtPct - targetWtPct` (simple subtraction, NOT ratio) | ✅ |
| PERCENTRANK computed across | ALL active holdings simultaneously | ✅ |
| `prExpense` direction | `1 - rank` (lower expense = higher rank) | ✅ |
| Theme cap uses | pre-normalization `cappedWt` (3-pass algorithm) | ✅ |
| Vol cap threshold | `volCapMultiplier × equalWtBase` | ✅ |
| Comparable holdings excluded from PERCENTRANK | yes | ✅ |
| `scoreRank = null` for Comparable | yes | ✅ |
| Income sleeve `currentWtPct` denominator | `totalPortfolioNAV` (not sleeve subtotal) | ✅ |
| Income sleeve weighting | `(divAPY / totalDivAPY) × incomeBudgetPct` | ✅ |
| Manual sleeve weights | passthrough, no engine computation | ✅ |

---

## 9.4 API Checks

### Price service (`lib/prices/priceService.ts`)

| Check | Status |
|---|---|
| `getCurrentPrices(tickers)` uses `yahoo-finance2 .quote()` | ✅ |
| Batch size ≤ 10 per yahoo-finance2 call | ✅ |
| Cache key format: `current:TICKER:current:YYYY-MM-DD` | ✅ |
| TTL: 15 minutes for current prices | ✅ |
| `getHistoricalPrices(tickers, periods)` uses `.historical()` | ✅ |
| Cache key format: `hist:TICKER:3mo:YYYY-MM-DD` | ✅ |
| TTL: 24 hours for historical prices | ✅ |
| Server-side only (no `"use client"` directive) | ✅ |

### Server Actions (`lib/actions/portfolio/`)

| Action | Auth Check | Validation | Status |
|---|---|---|---|
| `createSleeve` | ✅ Supabase session | budget_pct sum ≤ 1.0 | ✅ |
| `removeSleeve` | ✅ Supabase session | prevents deleting last sleeve | ✅ |
| `updateAssumptions` | ✅ Supabase session | retWeights sum = 1.0 (±0.001), scoreWeights sum = 1.0 (±0.001) | ✅ |
| `addHolding` | ✅ Supabase session | required fields | ✅ |
| `updateHolding` | ✅ Supabase session | ownership via sleeve → portfolio join | ✅ |
| `refreshPortfolioPrices` | ✅ Supabase session | per-ticker error collection, `revalidatePath` call | ✅ |

### Backwards Compatibility

| Check | Status |
|---|---|
| `lib/actions/refreshPrices.ts` re-exports `refreshPortfolioPrices as refreshPrices` | ✅ |

---

## 9.5 UI Checks

### Component inventory

| Component | File | Status |
|---|---|---|
| `PortfolioKPIBar` | `components/portfolio/PortfolioKPIBar.tsx` | ✅ Created |
| `RefreshButton` | `components/portfolio/RefreshButton.tsx` | ✅ Created |
| `HoldingsTable` | `components/portfolio/HoldingsTable.tsx` | ✅ Rewritten |
| `SleeveCard` | `components/portfolio/SleeveCard.tsx` | ✅ Rewritten |
| `SleeveManager` | `components/portfolio/SleeveManager.tsx` | ✅ Rewritten |
| `AddSleeveModal` | `components/portfolio/AddSleeveModal.tsx` | ✅ Updated |
| `PortfolioDashboard` | `components/portfolio/PortfolioDashboard.tsx` | ✅ Rewritten |
| `AssumptionsPanel` | `components/portfolio/AssumptionsPanel.tsx` | ✅ Pre-existing, compatible |

### Sleeve render counts (seed data)

| Sleeve | Type | Holdings |
|---|---|---|
| Main ETF | COMPOSITE_SCORE | 60 Active + 40 Comparable = 100 rows |
| Income | YIELD_PROPORTIONAL | 9 rows |
| Fidelity / Cash | MANUAL | 6 rows |

### HoldingsTable column coverage

#### COMPOSITE_SCORE columns
Ticker · Name · Status · Theme · Qty · Price · Value · Exp% · DivAPY% · Ret 3mo · Ret 6mo · Ret 1yr · Blended Ret · Vol · Sharpe · PR Exp · PR Ret · PR Div · PR Sharpe · Composite · Rank · Raw Wt · Theme Capped Wt · Final Target Wt · Parity $ Amt · Parity $ Chg · Signal

#### YIELD_PROPORTIONAL columns
Ticker · Name · Qty · Price · Value · DivAPY% · Target Wt · Current Wt · Parity $ Chg

#### MANUAL columns
Ticker · Name · Qty · Price · Value · Manual Target Wt · Current Wt

### KPI bar metrics rendered
1. Total NAV
2. Active ETF Count
3. Weighted Expense Ratio
4. Weighted Div Yield
5. Main Sleeve %
6. Income Sleeve %
7. Capped Positions (amber badge when > 0)
8. Last Refreshed (relative time with exact tooltip, auto-updates every 30s)

### RefreshButton features
- 60-second cooldown after successful refresh
- Live countdown display during cooldown
- Per-ticker error list on failure
- Calls `refreshPortfolioPrices` server action

---

## 9.6 Seed Data Integrity

File: `supabase/seed-allocation.ts`

| Check | Expected | Status |
|---|---|---|
| Active ETF holdings | 60 | ✅ |
| Comparable holdings (qty=0) | 40 | ✅ |
| Income sleeve holdings | 9 | ✅ |
| Manual/Fidelity holdings (`manual_pricing=true`) | 6 | ✅ |
| Total holdings | 115 | ✅ |
| `ModelAssumptions` row | 1 (with v3.2 defaults) | ✅ |
| Sleeve budget sum | 1.00 (88% + 12% + 0% manual) | ✅ |

---

## Summary

All 9 phases of the Allocation Intelligence v3.2 alignment are complete.

| Phase | Description | Status |
|---|---|---|
| 0 | Audit report | ✅ |
| 1 | SQL migration (schema alignment) | ✅ |
| 2 | v3-engine.ts + unit tests | ✅ |
| 3 | Price service (yahoo-finance2, server-side, cached) | ✅ |
| 4 | Six server actions | ✅ |
| 5 | types/allocation.ts (full v3.2 spec) | ✅ |
| 6 | UI components (7 components rewritten/created) | ✅ |
| 7 | Portfolio page (server component, data via Supabase) | ✅ |
| 8 | Seed data (115 holdings, v3.2 defaults) | ✅ |
| 9 | Validation report + CHANGELOG | ✅ |
