# Allocation Intelligence Audit Report — v3.2 Alignment
**Date:** 2026-05-03  
**Branch:** claude/hardcore-fermat-6e32a6  
**Auditor:** Claude Code (automated)

---

## 0.1 Project Structure

| Item | Finding |
|------|---------|
| Framework | Next.js **15.5.15**, **App Router** |
| TypeScript | `strict: true`, path alias `@/*` → `./*` |
| Database ORM | **None (Prisma absent)** — uses Supabase JS client with raw SQL migrations in `supabase/migrations/` |
| Supabase client | Server: `@supabase/ssr` `createServerClient` in `lib/supabase/server.ts`; Browser: `createBrowserClient` singleton in `lib/supabase/client.ts` |
| RLS | Enabled on all tables |
| State management | React state (`useState`) + TanStack Query (`@tanstack/react-query` v5) |
| UI framework | Tailwind CSS v4, no component library |
| API routes | `app/api/` — see §0.4 |
| Server actions | `lib/actions/refreshPrices.ts` only |
| Env vars required | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

---

## 0.2 Existing Data Model (Supabase SQL Tables)

### Legacy tables (portfolio_holdings-based system)
| Table | Purpose | Maps to v3.2? |
|-------|---------|---------------|
| `user_profiles` | Auth user metadata | No |
| `portfolios` | Portfolio container | Partial (used as parent) |
| `portfolio_holdings` | Old flat holding table (asset_class-based) | Replaced by sleeve_holdings |
| `allocation_snapshots` | Old snapshot (jsonb) | Replaced by sleeve_snapshots |
| `signals` | Alert/signal log | Not in v3.2 scope |
| `drift_events` | Drift tracking | Not in v3.2 scope |

### v3.2 tables (added in migration 20260501192059)
| Table | Fields | Missing vs Spec |
|-------|--------|----------------|
| `sleeves` | id, portfolio_id, name, purpose, budget_pct, sort_order, is_active, created_at, updated_at | **Missing `weighting_method`** |
| `sleeve_holdings` | id, sleeve_id, ticker, name, status, theme, qty, price_seed, expense_ratio, div_dollar, target_wt_pct, created_at, updated_at | **Missing `manual_pricing`, `manual_target_wt`, `sort_order`** |
| `sleeve_snapshots` | id, holding_id, date, price, value, current_wt_pct, target_wt_pct, parity_gap_pct, parity_dollar, blended_return, composite_score, score_rank, vol_cap_flag, theme_exposure_pct, signal, ret_3mo–5yr, price_3mo–5yr, created_at | **Missing `pr_expense`, `pr_return`, `pr_div_apy`, `pr_sharpe`, `raw_score_wt`, `equal_wt_base`, `theme_capped_wt`, `final_target_wt`, `parity_dollar_amt`, `parity_dollar_chg`, `div_apy`, `sharpe_proxy`, `vol_3mo`** |
| `model_assumptions` | id, portfolio_id, all 12 assumption fields, created_at, updated_at | ✓ Complete |
| `price_cache` | id, cache_key (text unique), price, fetched_at, ttl_seconds | **Structure differs from spec** — spec wants ticker/period/cacheDate columns with `@@unique([ticker,period,cacheDate])`; current uses a single opaque `cache_key` text column |

### Missing tables
- No `Sleeve` Prisma model (project uses Supabase, not Prisma — this is by design)

### Field gap flags
- ❌ No `weighting_method` on sleeves (COMPOSITE_SCORE | YIELD_PROPORTIONAL | MANUAL)  
- ❌ No `manual_pricing` on sleeve_holdings (boolean for Fidelity funds)  
- ❌ No `manual_target_wt` on sleeve_holdings  
- ❌ No composite score sub-fields in sleeve_snapshots (pr_expense, pr_return, pr_div_apy, pr_sharpe)  
- ❌ No `raw_score_wt`, `equal_wt_base`, `theme_capped_wt`, `final_target_wt` in sleeve_snapshots  
- ❌ No `parity_dollar_amt` (target $) distinct from `parity_dollar` (change $) in sleeve_snapshots  
- ❌ No `div_apy`, `sharpe_proxy`, `vol_3mo` in sleeve_snapshots  
- ✓ ModelAssumptions all 12 parameters present  
- ✓ PriceCache exists (different structure, functionally equivalent)  

---

## 0.3 Existing Computation Logic

| File | What it computes | v3.2 alignment |
|------|-----------------|----------------|
| `lib/allocation/v3-engine.ts` | Steps 1–8 of composite score engine for main sleeve; yield-proportional for income sleeve | **Partial** — missing `themeCappedWt` in output, wrong `parityGapPct` formula, `themeExposurePct` computed on final normalized weights instead of on pre-normalized cappedWt |
| `lib/allocation/engine.ts` | Old portfolio_holdings-based allocation (asset_class drift, colAL/AM signals) | Conflicts — different data model; uses RSI, different factor weights |
| `lib/portfolio/formula-engine.ts` | Helper functions: colD, colH, colJ, colV–Z, colAA–AD, colAK–AU, PERCENTRANK, RSI | Partial — uses different composite formula (factor weights differ from v3.2) |
| `lib/actions/refreshPrices.ts` | Server action: fetches prices, calls engine, writes sleeve_snapshots | Partial — does not write new score sub-fields |

### Specific engine bugs vs v3.2 spec

1. **`parityGapPct` formula wrong** (v3-engine.ts:235):
   - Current: `(value - targetDollar) / targetDollar`
   - Spec: `currentWtPct - targetWtPct` (simple subtraction)

2. **`themeExposurePct` computed on normalized finalTargetWt** (v3-engine.ts:215–221) instead of on the pre-normalization `cappedWt`. Spec requires pass-1 cappedWt for theme exposure.

3. **`themeCappedWt` not returned** — the per-holding theme-capped weight before normalization is computed internally but not surfaced in the output type.

4. **`parityDollarAmt` not returned** — only `parityDollarChg` (delta) is in the output; the target dollar amount is not.

5. **`prDivAPY`**: In `computeMainSleeve`, `divAPY` is computed as `divDollar / value` which is correct when `value > 0`. However it does not distinguish between "Active" and "Comparable" when building the PERCENTRANK array — comparables should be excluded.

6. **Income sleeve `currentWtPct`**: uses `sleeveValue` (income sleeve total) as denominator instead of `totalPortfolioNAV`. Spec says `currentWtPct = value / totalNAV`.

7. **`name` hardcoded to ticker** in output (v3-engine.ts:250) — `name: d.input.ticker` should come from `HoldingInput.name`.

---

## 0.4 API Routes & Server Actions

| Route / Action | Method | Path | Purpose | Fetches Prices | Writes DB |
|---------------|--------|------|---------|---------------|-----------|
| current prices | GET | `/api/prices/current` | Yahoo Finance quote via cache | ✓ | ✓ (price_cache) |
| historical prices | GET | `/api/prices/historical` | Yahoo Finance historical via cache | ✓ | ✓ (price_cache) |
| market data | GET | `/api/market-data/[ticker]` | Old-style market data (v1 engine) | ✓ | ✗ |
| portfolio refresh | GET | `/api/portfolio/[portfolioId]/refresh` | Old portfolio_holdings refresh | ✓ | ✓ |
| admin portfolios | GET/POST/DELETE | `/api/admin/portfolios` | Admin CRUD | ✗ | ✓ |
| admin users | GET | `/api/admin/users` | Admin user list | ✗ | ✗ |
| cron nightly | GET | `/api/cron/nightly-refresh` | Nightly cron trigger | ✓ | ✓ |
| workbook portfolios | GET/POST | `/api/workbook/portfolios` | Portfolio CRUD | ✗ | ✓ |
| workbook holdings | GET/POST | `/api/workbook/holdings` | Holdings CRUD | ✗ | ✓ |
| `refreshPrices` | Server Action | `lib/actions/refreshPrices.ts` | v3 sleeve refresh | ✓ (via API) | ✓ (sleeve_snapshots) |

**Missing server actions** vs spec:  
- `createSleeve`, `removeSleeve`, `updateAssumptions`, `addHolding`, `updateHolding`, `refreshPortfolioPrices`

---

## 0.5 Existing UI Components

| Component | File | Props | What it renders | Gaps vs spec |
|-----------|------|-------|----------------|-------------|
| `PortfolioDashboard` | `components/portfolio/PortfolioDashboard.tsx` | portfolioId, portfolioName | KPI bar + sleeve summary + sleeve manager | **Runs engine client-side** (spec: server-side); KPI bar is inline not a separate component; no separate RefreshButton component |
| `SleeveCard` | `components/portfolio/SleeveCard.tsx` | sleeve, totalPortfolioNAV, onRemove | Sleeve header + summary bar + holdings table | Missing: parity fill bar, weighted expense/yield in summary row; missing `weightingMethod` display |
| `HoldingsTable` | `components/portfolio/HoldingsTable.tsx` | holdings, sleeveType, totalNAV | Per-row holdings with sorting | Missing columns: `themeCappedWt`, `finalTargetWt`, `parityDollarAmt`, score sub-fields; uses `sleeveType` string not `weightingMethod` enum |
| `AssumptionsPanel` | `components/portfolio/AssumptionsPanel.tsx` | assumptions, onSave, isRecomputing | Slide-out panel with all 12 assumptions | ✓ Complete — matches spec |
| `SleeveManager` | `components/portfolio/SleeveManager.tsx` | sleeves, onAddSleeve, onRemoveSleeve | Sleeve list + add button | Missing drag-to-reorder (@dnd-kit); missing per-sleeve budget allocation bar; missing `weighting_method` in add modal |
| `AddSleeveModal` | `components/portfolio/AddSleeveModal.tsx` | open, onClose, onSubmit | Modal for adding a sleeve | Missing `weightingMethod` field |

**Missing components** vs spec:  
- `PortfolioKPIBar` (standalone) — currently inlined in PortfolioDashboard  
- `RefreshButton` (standalone) — currently inline in PortfolioDashboard  

---

## 0.6 Price Data Source

| Approach | File | Notes |
|----------|------|-------|
| `yahoo-finance2` npm package | `app/api/prices/current/route.ts`, `app/api/prices/historical/route.ts` | **Primary approach** — correct per spec |
| Direct Yahoo chart API (v8 chart endpoint) | `lib/market-data/yahoo-finance.ts` | Old-style fetch for legacy `portfolio_holdings` engine |
| Tiingo fallback | `lib/market-data/tiingo.ts` | Fallback for legacy engine only |
| Google Finance | `lib/market-data/google-finance.ts` | Not actively used in v3 flows |
| Hardcoded `price_seed` | `sleeve_holdings.price_seed` | Used as fallback when prices unavailable |

The v3 price routes use `yahoo-finance2` v3.14.0 (already installed) with a 15-minute TTL for current prices and 24-hour TTL for historical. The caching uses the opaque `cache_key` string (`current:TICKER`, `hist:TICKER:3mo:YYYY-MM-DD`).

**No Fidelity mutual fund exclusion** — `refreshPrices.ts` excludes Stability sleeve by purpose but does not check `manual_pricing` boolean (which doesn't exist yet on the table).

---

## 0.7 Gap Analysis Table

| Spreadsheet Feature | Status | Location (if exists) | Gap Description |
|--------------------|--------|---------------------|-----------------|
| Status (Active/Comparable) | ✓ | sleeve_holdings.status | — |
| Ticker | ✓ | sleeve_holdings.ticker | — |
| Name | ✓ | sleeve_holdings.name | Hardcoded to ticker in engine output |
| Theme | ✓ | sleeve_holdings.theme | — |
| Qty | ✓ | sleeve_holdings.qty | — |
| Price | ✓ | price_cache + price_seed | — |
| Value | ✓ | Computed in engine | — |
| Expense Ratio | ✓ | sleeve_holdings.expense_ratio | — |
| Div $ | ✓ | sleeve_holdings.div_dollar | — |
| Div APY | ✓ | Computed in engine | Not stored in sleeve_snapshots |
| Current Wt% | ✓ | sleeve_snapshots.current_wt_pct | — |
| Parity Gap% | ⚠️ | sleeve_snapshots.parity_gap_pct | Wrong formula (ratio vs subtraction) |
| Target Wt% | ✓ | sleeve_snapshots.target_wt_pct | — |
| Ret 3mo | ✓ | sleeve_snapshots.ret_3mo | — |
| Ret 6mo | ✓ | sleeve_snapshots.ret_6mo | — |
| Ret 1yr | ✓ | sleeve_snapshots.ret_1yr | — |
| Ret 3yr | ✓ | sleeve_snapshots.ret_3yr | — |
| Ret 5yr | ✓ | sleeve_snapshots.ret_5yr | — |
| Blended Return | ✓ | sleeve_snapshots.blended_return | — |
| Vol 3mo | ❌ | Not stored | Missing in snapshot |
| Sharpe Proxy | ❌ | Not stored | Missing in snapshot |
| PR Expense | ❌ | Not stored | Missing in snapshot |
| PR Return | ❌ | Not stored | Missing in snapshot |
| PR Div APY | ❌ | Not stored | Missing in snapshot |
| PR Sharpe | ❌ | Not stored | Missing in snapshot |
| Composite Score | ✓ | sleeve_snapshots.composite_score | — |
| Score Rank | ✓ | sleeve_snapshots.score_rank | — |
| Raw Score Wt | ❌ | Not stored | Missing in snapshot |
| Equal Wt Base | ❌ | Not stored | Missing in snapshot |
| Vol Cap Flag | ✓ | sleeve_snapshots.vol_cap_flag | — |
| Theme Exp% | ✓ | sleeve_snapshots.theme_exposure_pct | Computed on wrong (post-norm) weights |
| Theme Capped Wt | ❌ | Not stored | Missing in snapshot and engine output |
| Final Target Wt | ❌ | Not stored | Not distinct from target_wt_pct |
| Parity $ Amt | ❌ | Not stored | Missing (only delta stored) |
| Parity $ Chg | ✓ | sleeve_snapshots.parity_dollar | Stored as single column, sign correct |
| Trend Signal | ✓ | sleeve_snapshots.signal | — |
| Price 3mo ago | ✓ | sleeve_snapshots.price_3mo | — |
| Price 6mo ago | ✓ | sleeve_snapshots.price_6mo | — |
| Price 1yr ago | ✓ | sleeve_snapshots.price_1yr | — |
| Price 3yr ago | ✓ | sleeve_snapshots.price_3yr | — |
| Price 5yr ago | ✓ | sleeve_snapshots.price_5yr | — |
| Main ETF sleeve | ✓ | sleeves + sleeve_holdings | Missing `weighting_method` column |
| Income sleeve | ✓ | sleeves + sleeve_holdings | Missing `weighting_method` column |
| Fidelity/Cash sleeve | ⚠️ | sleeves + sleeve_holdings | Missing `manual_pricing`, `manual_target_wt`, `weighting_method` |
| ModelAssumptions retWeight3mo | ✓ | model_assumptions.ret_weight_3mo | — |
| ModelAssumptions retWeight6mo | ✓ | model_assumptions.ret_weight_6mo | — |
| ModelAssumptions retWeight1yr | ✓ | model_assumptions.ret_weight_1yr | — |
| ModelAssumptions retWeight3yr | ✓ | model_assumptions.ret_weight_3yr | — |
| ModelAssumptions retWeight5yr | ✓ | model_assumptions.ret_weight_5yr | — |
| ModelAssumptions scoreWeightExp | ✓ | model_assumptions.score_weight_exp | — |
| ModelAssumptions scoreWeightRet | ✓ | model_assumptions.score_weight_ret | — |
| ModelAssumptions scoreWeightDiv | ✓ | model_assumptions.score_weight_div | — |
| ModelAssumptions scoreWeightShp | ✓ | model_assumptions.score_weight_shp | — |
| ModelAssumptions incomeBudgetPct | ✓ | model_assumptions.income_budget_pct | — |
| ModelAssumptions volCapMultiplier | ✓ | model_assumptions.vol_cap_multiplier | — |
| ModelAssumptions themeCapPct | ✓ | model_assumptions.theme_cap_pct | — |

---

## Summary of Required Changes

### Critical (blocks correctness)
1. **SQL migration** — add `weighting_method` to sleeves; add `manual_pricing`, `manual_target_wt`, `sort_order` to sleeve_holdings; add 12 missing score/parity fields to sleeve_snapshots
2. **Engine fix** — correct `parityGapPct` formula, fix `themeExposurePct` to use pre-normalized cappedWt, add `themeCappedWt`/`finalTargetWt`/`parityDollarAmt` to output
3. **Types** — add `SleeveWeightingMethod`, `id`, price history fields, `themeCappedWt`, `finalTargetWt`, `parityDollarAmt` to `ComputedHolding`; add `SleeveView`, `PortfolioKPIs`, `ModelAssumptionsView`
4. **Income sleeve bug** — `currentWtPct` denominator should be `totalPortfolioNAV` not sleeve subtotal

### Important (feature completeness)
5. **Server actions** — create 6 missing server actions
6. **UI components** — add missing columns to HoldingsTable; extract PortfolioKPIBar and RefreshButton; wire `weightingMethod` through SleeveCard
7. **Computation location** — move engine computation to server-side (currently client-side in PortfolioDashboard)
8. **refreshPrices.ts** — write all new snapshot fields; use `weighting_method` instead of `purpose`; exclude `manual_pricing=true` holdings from price fetch

### Nice-to-have (spec completeness)
9. **Seed file** — create demo portfolio with 100 ETF rows
10. **Validation report** — post-implementation invariant checks
