# Workbook Intelligence Roadmap

**Scope:** Read-only analysis comparing legacy workbook intelligence (`PEMABU_PLATFORM`) with the rebuilt beta (`PEMABU_PLATFORM_NEW`).  
**Sources:** `lib/workbook/*.ts` (old), `lib/types/database.ts`, `lib/allocation/engine.ts`, `lib/market-data/*`, `supabase/migrations/*.sql` (new).

---

## Count reconciliation (47 vs typed fields)

- **`parse-workbook.ts`** documents **47 Excel columns (A–AU)** on the canonical Risk Parity template. Indices **11 (K)** and **41 (AP)** are **spacers** (no `COL.*` mapping); `PRICE_1` starts at column **12**, `RANK_OVERALL` at **42** after composite at **40**.
- **`WorkbookRow` / `WorkbookRowSchema`** define **46 typed properties per row**, including **`sheetRow`** (1-based Excel row index for traceability, not column AU).
- **Discrepancy note:** Marketing language “47 columns” refers to the **Excel template width**. The **canonical machine shape** is **46 keys per row** in code (`WorkbookRow` + Zod). This roadmap numbers **#1–#46** following **`WorkbookRowSchema` field order** in `schema.ts`.

---

## 1. Old Platform Column Inventory (complete table)

| # | Column name | Type | Category | Source | Calculation summary |
|---|-------------|------|----------|--------|---------------------|
| 1 | `sheetRow` | integer | METADATA | Excel / parse | Row index in sheet; not a capital-market input. |
| 2 | `rowStatus` | string | METADATA | Excel | `Active` vs `Comparable` (watchlist / peer rows). |
| 3 | `symbol` | string | METADATA | Excel | Ticker / symbol (required). |
| 4 | `name` | string | METADATA | Excel | Fund / security name. |
| 5 | `currentWeight` | decimal fraction \| null | ALLOCATION | Excel (typically formula) | Current sleeve weight as fraction of portfolio (0–1 style). |
| 6 | `targetParityWeight` | decimal fraction \| null | ALLOCATION | Excel | Target parity / risk-parity sleeve weight. |
| 7 | `expenseRatio` | decimal fraction \| null | EXPENSE | Excel / fund data | Stated expense ratio (Excel fraction, e.g. 0.0004). |
| 8 | `dividendDollars` | number \| null | DIVIDEND | Excel | Dividend dollars (period unspecified in schema). |
| 9 | `divApy` | decimal fraction \| null | DIVIDEND | Excel | Dividend yield APY as fraction. |
| 10 | `quantity` | number \| null | METADATA | Excel | Shares / units. |
| 11 | `marketValue` | number \| null | METADATA | Excel | Position market value (currency). |
| 12 | `price1` | number \| null | METADATA | Excel | Latest / primary price (see row 2 for as-of in `priceAsOfDates[0]`). |
| 13 | `price2` | number \| null | METADATA | Excel | Secondary price point. |
| 14 | `price3` | number \| null | METADATA | Excel | Tertiary price point. |
| 15 | `change24h` | decimal fraction \| null | MOMENTUM | Excel | 24h price change as fraction. |
| 16 | `change7d` | decimal fraction \| null | MOMENTUM | Excel | 7d price change as fraction. |
| 17 | `basisPrice3mo` | number \| null | BENCHMARK | Excel | Basis price for 3mo return window. |
| 18 | `basisPrice6mo` | number \| null | BENCHMARK | Excel | Basis price for 6mo window. |
| 19 | `basisPrice1yr` | number \| null | BENCHMARK | Excel | Basis price for 1yr window. |
| 20 | `basisPrice3yr` | number \| null | BENCHMARK | Excel | Basis price for 3yr window. |
| 21 | `basisPrice5yr` | number \| null | BENCHMARK | Excel | Basis price for 5yr window. |
| 22 | `return3mo` | decimal fraction \| null | MOMENTUM | Excel | Trailing total return fraction (3mo). |
| 23 | `return6mo` | decimal fraction \| null | MOMENTUM | Excel | Trailing total return fraction (6mo). |
| 24 | `return1yr` | decimal fraction \| null | MOMENTUM | Excel | Trailing total return fraction (1yr). |
| 25 | `return3yr` | decimal fraction \| null | MOMENTUM | Excel | Trailing total return fraction (3yr). |
| 26 | `return5yr` | decimal fraction \| null | MOMENTUM | Excel | Trailing total return fraction (5yr). |
| 27 | `returnWeightedAvg` | decimal fraction \| null | MOMENTUM | Excel | Blended / sheet-weighted return metric (stored). |
| 28 | `volatilityWeight` | decimal fraction \| null | RISK | Excel | Volatility / risk weight column from sheet. |
| 29 | `volatility3mo` | decimal fraction \| null | RISK | Excel | Short-horizon volatility (fraction). |
| 30 | `volatilitySecondary` | decimal fraction \| null | RISK | Excel | Secondary vol / alignment metric (may be signed). |
| 31 | `subRankCurrent` | number \| null | SIGNAL | Excel | Sub-rank for “current” factor (1–100 style). |
| 32 | `subRankExpense` | number \| null | SIGNAL | Excel | Sub-rank for expense. |
| 33 | `subRankPctWeight` | number \| null | SIGNAL | Excel | Sub-rank for % weight / sleeve. |
| 34 | `subRankDivApy` | number \| null | SIGNAL | Excel | Sub-rank for dividend APY. |
| 35 | `subRankVolatility` | number \| null | SIGNAL | Excel | Sub-rank for volatility. |
| 36 | `weightAvgPercent` | number \| null | SIGNAL | Excel | Composite weight-average % (often whole-number percent in UI). |
| 37 | `rsi` | number \| null | TECHNICAL | Excel | RSI (0–100 scale); also drives Scenario Lab secondary alert. |
| 38 | `alertPrimary` | string \| null | SIGNAL | Excel ingest; **overwritten** in Scenario Lab | Sheet narrative; `engine.ts` recomputes for Scenario Lab from sleeve drift or comparable tilt. |
| 39 | `alertSecondary` | string \| null | SIGNAL | Excel ingest; **overwritten** in Scenario Lab | Sheet narrative; `engine.ts` maps RSI ≥70 → `Consider Exit`, ≤30 → `Consider Entry`, else `Hold`. |
| 40 | `compositeScore` | number \| null | SIGNAL | Excel ingest; **overwritten** in Scenario Lab | Horizon blend + factor blend → 0–100 style score (`engine.ts`). |
| 41 | `rankOverall` | number \| null | SIGNAL | Excel ingest; **overwritten** in Scenario Lab | Dense rank by descending composite (`compositeRank`). |
| 42 | `rankSecondary` | number \| null | SIGNAL | Excel | Alternate / secondary rank column; **not** recomputed in `recalculatePortfolioRanks` (passed through). |
| 43 | `parityDollars` | number \| null | ALLOCATION | Excel / builder | Dollar parity anchor / reference. |
| 44 | `parityChangeDollars` | number \| null | ALLOCATION | Excel / builder | Delta vs parity dollars. |
| 45 | `sharesDelta` | number \| null | ALLOCATION | Excel | Share count delta vs target trade. |
| 46 | `targetSleevePct` | decimal fraction \| null | ALLOCATION | Excel | Target sleeve % for parity band; used as fallback target in alerts when `targetParityWeight` absent. |

**Assumption block (footer rows 129–138, not counted in the 46 row fields):** `returnHorizons` (3mo–5yr weights) and `factors` (expense, pctWeight, divApy, volatility) — see `default-assumptions.ts` and `PortfolioAssumptionsSchema`. These feed **`engine.ts`** composite recomputation.

**`engine.ts` composite (Scenario Lab) — inputs and formula (summary):**

- **Return leg:** \( \sum_h w_h \cdot r_{h,\text{row}} \) then **min–max normalize** across rows (“higher is better”).
- **Factor leg (per row):** normalized expense (lower better), sleeve drift \(|currentWeight - target|\) (lower better), div APY (higher better), vol (lower better, uses `volatility3mo` else `volatilityWeight`), each weighted by `factors.*`.
- **Blend:** combines return normalization and factor normalization with weights proportional to `sumHorizons` vs `sumFactors` (see `recalculatePortfolioRanks`).
- **Outputs:** `compositeScore`, `compositeRank` / `rankOverall`, `alertPrimary`, `alertSecondary` (RSI rule).

**`portfolio-benchmark-stats.ts`:** MV-weighted average of `return3mo`…`return5yr` across **Active** rows → `BenchmarkHorizonReturns` (portfolio-level trailing return blend for benchmarking / dashboards).

**`build-snapshot-from-holdings.ts`:** Synthesizes a `WorkbookRowValidated` from DB holdings with **defaults** (zeros, RSI 50, null ranks) then `rankPositions` — **not** full workbook fidelity.

**`universe-row.ts`:** Maps ETF universe entries into synthetic **Comparable** rows for peer context.

**`signal-normalize.ts`:** String normalization for audit (`Consider Entry` / `Consider Exit` / `Hold`).

---

## 2. New Platform Data Model

### Portfolio (`portfolios`)

| Field | Notes |
|-------|--------|
| `id` | UUID PK |
| `user_id` | FK → `auth.users` |
| `name`, `description` | Text |
| `currency` | USD, GBP, EUR, CAD, AUD |
| `created_at`, `updated_at` | timestamptz |

No first-class JSON column for custom allocation targets in migrations reviewed; **`DEFAULT_TARGETS`** live in **`lib/allocation/engine.ts`**.

### Holding (`portfolio_holdings`)

| Field | Notes |
|-------|--------|
| `id`, `portfolio_id` | UUID |
| `ticker`, `name` | Text |
| `asset_class` | enum: equity, fixed_income, alternatives, cash, other |
| `quantity`, `cost_basis`, `current_price` | numeric |
| `currency` | default USD |
| `source` | manual, upload, csv_import |
| `last_price_refreshed_at` | timestamptz |
| `created_at`, `updated_at` | timestamptz |
| **Unique** | `(portfolio_id, ticker)` |

### Signals (`signals`)

| Field | Notes |
|-------|--------|
| `type` | drift, trend, brief, price_refresh_error, assumption_drift |
| `severity` | info, warning, critical |
| `status` | unacknowledged, acknowledged, resolved |
| `title`, `message`, `metadata` | jsonb metadata for drift payload etc. |
| `holding_id` | optional FK |
| Ack / resolved timestamps | optional |

**Implemented cron path (`nightly-refresh`):** creates **`drift`** signals from **`detectDrift`** on **asset-class** weights vs **`DEFAULT_TARGETS`**. **`trend`** exists in the enum but is **not** produced in the reviewed nightly job.

### Drift events (`drift_events`)

Links `portfolio_id`, `holding_id` (one representative holding in asset class in current implementation), `signal_id`, `asset_class`, `target_pct`, `actual_pct`, `threshold_pct`, `direction`, `detected_at`.

### Allocation snapshots (`allocation_snapshots`)

| Field | Notes |
|-------|--------|
| `snapshot_data` | jsonb — from **`buildSnapshotData`**: per-holding id, ticker, asset_class, quantity, price, `value_usd`, plus **`weights`** array and `captured_at` |
| `total_value`, `currency`, `triggered_by`, `created_at` | audit / display |

### User profiles (`user_profiles`)

`role` (owner | admin), `display_name`, timestamps — orthogonal to workbook columns.

### Allocation engine (`lib/allocation/engine.ts`) — what is computed today

- **`calculateHoldingValue`**, **`calculatePortfolioValue`**
- **`calculateAllocationWeights`**: actual % and drift vs **`AllocationTarget[]`** (default global targets), **aggregated by `asset_class`**, not by sleeve / ticker parity.
- **`detectDrift`**: absolute drift vs threshold (default 5%).
- **`buildSnapshotData`**: holdings mini-dump + weights for JSON snapshot.

### Market data (`lib/market-data/types.ts` + `google-finance.ts`)

- **`Quote`:** `ticker`, `price`, `change`, `changePercent`, `currency`, `asOf`, `source`, optional `exchange`.
- **Provider behavior (beta file):** uses a **1d** Yahoo chart endpoint pattern to derive **spot** price and **1-session** change vs previous close — **no** multi-horizon OHLCV series, **no** RSI, **no** expense/dividend endpoints in this layer.

---

## 3. Gap Analysis Table

**Legend:** **PRESENT** = directly supported or trivially derived in new beta; **PARTIAL** = concept exists but semantics differ; **MISSING** = not modeled; **DEFERRED** = out of beta scope by design.

| Column | Old platform | New platform | Status | Priority |
|--------|--------------|--------------|--------|----------|
| `sheetRow` | Excel row index | No sheet ingestion in beta DB model | MISSING | DEFER |
| `rowStatus` | Active / Comparable | No comparable-row concept | MISSING | LOW |
| `symbol` | Ticker | `portfolio_holdings.ticker` | PRESENT | — |
| `name` | Fund name | `portfolio_holdings.name` | PRESENT | — |
| `currentWeight` | Sleeve weight fraction | **Holding weight** = \(q \cdot p / \sum q \cdot p\) derivable; **not** same as sleeve parity | PARTIAL | HIGH |
| `targetParityWeight` | Parity target fraction | **Asset-class** targets only (`DEFAULT_TARGETS`); no per-ticker sleeve target in DB | PARTIAL | HIGH |
| `expenseRatio` | Fund expense | Not stored | MISSING | MEDIUM |
| `dividendDollars` | Dividend $ | Not stored | MISSING | LOW |
| `divApy` | Dividend yield | Not stored | MISSING | MEDIUM |
| `quantity` | Shares | `quantity` | PRESENT | — |
| `marketValue` | Position MV | `quantity * current_price` (with quote in cron) | PRESENT | — |
| `price1` | Primary price | `current_price` + nightly quote | PRESENT | — |
| `price2`, `price3` | Secondary prices | Not stored | MISSING | LOW |
| `change24h` | 24h return fraction | Provider has **session** `change` / `changePercent`; not persisted on row | PARTIAL | MEDIUM |
| `change7d` | 7d return | Not available from 1d provider | MISSING | MEDIUM |
| `basisPrice*` (5) | Historical bases | Not stored | MISSING | HIGH |
| `return3mo` … `return5yr` | Trailing returns | Not stored / not computed | MISSING | HIGH |
| `returnWeightedAvg` | Sheet blend | Not stored | MISSING | MEDIUM |
| `volatilityWeight`, `volatility3mo`, `volatilitySecondary` | Vol metrics | Not stored | MISSING | HIGH |
| `subRank*` (5) | Cross-sectional ranks | No ranking engine | MISSING | MEDIUM |
| `weightAvgPercent` | Composite % | Not stored | MISSING | LOW |
| `rsi` | RSI | Not computed | MISSING | HIGH |
| `alertPrimary`, `alertSecondary` | Narrative signals | **`signals`** drift titles/messages; no RSI / entry-exit strings | PARTIAL | HIGH |
| `compositeScore` | 0–100 score | No composite score | MISSING | MEDIUM |
| `rankOverall`, `rankSecondary` | Ranks | No ranks | MISSING | MEDIUM |
| `parityDollars`, `parityChangeDollars`, `sharesDelta` | Parity trade math | Not modeled | MISSING | MEDIUM |
| `targetSleevePct` | Sleeve target | No per-sleeve % in schema | MISSING | HIGH |
| Assumption horizons | Footer weights | Hardcoded defaults only in **new** engine path | PARTIAL | MEDIUM |
| Assumption factors | Footer weights | Same | PARTIAL | MEDIUM |
| Portfolio MV-weighted returns | `portfolio-benchmark-stats` | Not implemented | MISSING | MEDIUM |

**Rough counts (row-level fields #2–#46, 45 fields):**

- **PRESENT:** ~6 (symbol, name, quantity, MV, price1 analog, partial mapping for “weight” if defined as MV%)  
- **PARTIAL:** ~6 (current/target weight semantics, change24h-like if surfaced, alerts, assumptions)  
- **MISSING:** ~33  
- **DEFERRED:** ~1 (`sheetRow` / full Excel pipeline treated as non-goal for beta DB)

*(Exact counts depend on whether `currentWeight` is scored PRESENT vs PARTIAL; table uses **PARTIAL** for honesty.)*

---

## 4. Column Category Deep Dives

### MOMENTUM columns

- **What existed:** `change24h`, `change7d`, multi-horizon **`return*`** and **`returnWeightedAvg`** (stored in sheet / ingest).
- **How calculated in old:** **Ingested from Excel** (`parse-workbook` reads cells / formula results). **`engine.ts`** does **not** recompute trailing returns; it **blends** existing `return*` with horizon weights for the **composite score**.
- **Data required:** Historical prices or precomputed returns per ticker; optional benchmark series for relative momentum (not in core row schema beyond row fields).
- **Google Finance provider (new beta):** **Insufficient** for multi-window momentum or 7d change without storing history or calling a richer API. Current implementation is effectively **latest close + 1d change**.
- **New platform changes:** Add **`price_daily`** (ticker, date, close, optionally volume) or call a provider with **range** endpoints; extend cron or a backfill job to populate returns.

### DIVIDEND columns

- **Tracked:** `dividendDollars`, `divApy` (fraction).
- **Source in old:** **Excel / user workbook** (not recomputed in `engine.ts` beyond using `divApy` inside composite normalization).
- **Feasibility:** Free tiers rarely give **clean, licensed** dividend calendars + TTM yield for arbitrary tickers. **User-input** `divApy` on holding is the pragmatic beta path; paid APIs (Polygon, FMP, etc.) for automation later.

### EXPENSE columns

- **Tracked:** `expenseRatio` (fraction).
- **ETF relevance:** High.
- **Beta:** **User-input** `expense_ratio` on `portfolio_holdings` is enough for scoring parity with a simplified factor model.
- **Schema:** nullable `numeric` column + optional validation range.

### RSI / TECHNICAL columns

- **What existed:** **`rsi`** plus **`alertSecondary`** RSI bands in **`engine.ts`** (≥70 exit, ≤30 entry).
- **Computation:** **Comes from workbook** in production of old app; Scenario Lab **consumes** RSI, does not derive OHLCV.
- **Historical depth:** Typical RSI(14) needs **≥15 daily closes**.
- **Google Finance (new):** **No** RSI; would need **history store** or different provider.

### VOLATILITY columns

- **Measured:** `volatility3mo`, `volatilitySecondary`, `volatilityWeight` (meanings sheet-defined).
- **Inputs:** Usually **returns series** or precomputed vol from data vendor / Excel.
- **`allocation_snapshots`:** Store **weights and values**, not **return series** — cannot derive classical vol from snapshots alone without prices per day per holding.

### TARGET % columns

- **Old:** **`currentWeight`**, **`targetParityWeight`**, **`targetSleevePct`** at **sleeve / row** granularity; Scenario Lab drift uses **`currentWeight` vs `targetParityWeight` or `targetSleevePct`**.
- **New:** **`DEFAULT_TARGETS`** are **per `asset_class`** only; drift is **asset-class bucket** vs those targets. **No** per-holding sleeve parity in DB.

### BENCHMARK columns

- **Old row fields:** Basis prices and returns act as **per-security** trailing performance; **`computePortfolioBenchmarkReturns`** aggregates **Active** rows into **portfolio-level** horizon returns.
- **New:** **`trend`** signal type suggests intent to compare vs benchmark; **not wired** in reviewed nightly cron. **No** benchmark ticker stored per portfolio in migrations.

### SIGNAL / SCORING columns

- **Old:** **`subRank*`**, **`compositeScore`**, **`rank*`**, **`alert*`** — composite from **`engine.ts`**; ranks dense-sort composites.
- **New:** **`Signal`** table with typed **`drift`**, **`brief`**, etc.; **drift** from **`detectDrift`** on **asset-class** weights. **No** composite score or dense rank across holdings.

---

## 5. Phase 2 Feature Roadmap

### Feature Group A — Enhanced Holdings Schema

1. **User problem:** Cannot express **fund costs**, **yield**, or **per-line target weights** — core to old workbook intelligence.  
2. **Data not stored:** expense ratio, div yield, sleeve target %, optional sector tags.  
3. **Schema:** Add nullable columns on **`portfolio_holdings`** (or `jsonb` `metrics` if you prefer fewer migrations).  
4. **Engine:** Extend factor scoring (port of `engine.ts` blend) **after** MV% and targets exist.  
5. **APIs:** Workbook / consolidated / holdings PATCH routes.  
6. **UI:** `HoldingsBuilder` new columns + validation.  
7. **Complexity:** **MEDIUM**  
8. **Release:** **Beta v1.1** if scope-controlled; else post-beta.

### Feature Group B — Technical Indicators

1. **User problem:** No **RSI / momentum** visibility.  
2. **Data:** Daily closes per ticker (**30–252+** days).  
3. **Schema:** `price_history (ticker, date, close, …)` or external warehouse.  
4. **Engine:** RSI, optional MA cross; nightly job to append bars.  
5. **APIs:** Internal-only fetch + optional chart endpoint.  
6. **UI:** Column + sparkline or detail drawer.  
7. **Complexity:** **HIGH**  
8. **Post-beta** unless a tiny RSI read-only MVP is acceptable with manual CSV import.

### Feature Group C — Benchmark Intelligence

1. **User problem:** Cannot answer “vs S&P / vs AGG” at portfolio level.  
2. **Data:** Benchmark ticker(s) per portfolio + benchmark returns or prices.  
3. **Schema:** `portfolios.benchmark_symbol` or join table.  
4. **Engine:** Relativize holding or portfolio returns vs benchmark (requires returns).  
5. **APIs:** Benchmark summary route (old `portfolio-benchmark-stats` analog).  
6. **UI:** Benchmark strip on dashboard.  
7. **Complexity:** **MEDIUM–HIGH**  
8. **v1.1** for static benchmark + manual refresh; **post-beta** for live series.

### Feature Group D — Scoring and Ranking

1. **User problem:** No **cross-holding prioritization** (“what to review first”).  
2. **Data:** Same as Groups A + B (returns, vol, expense, yield, drift).  
3. **Schema:** Optional `scores` json on snapshot or materialized view.  
4. **Engine:** Port **`recalculatePortfolioRanks`** with configurable weights stored per user.  
5. **APIs:** Scenario lab endpoint (old `engine` consumers).  
6. **UI:** Sortable table + rank badge.  
7. **Complexity:** **MEDIUM** once inputs exist.  
8. **Post-beta** for full parity; **v1.1** for “simple score = drift + expense” stub.

### Feature Group E — Risk Metrics

1. **User problem:** No **vol / beta / drawdown** in new beta.  
2. **Data:** Daily returns for **60–252** trading days minimum for meaningful vol; beta needs benchmark series.  
3. **MVP:** **User-entered** `volatility3mo` equivalent (optional) + display only — weak but **fast**.  
4. **Engine:** Std dev of log returns from `price_history`.  
5. **APIs:** Derived metrics service.  
6. **UI:** Risk column + tooltip.  
7. **Complexity:** **HIGH** for proper stats; **LOW** for user-typed placeholder.  
8. **Post-beta** for rigorous; **v1.1** for placeholder fields.

---

## 6. Quick Wins (top 5, implementation-ready)

All assume **`HoldingsBuilder`** and consolidated API can render extra columns; **`engine.ts`** stays pure where possible.

| # | Enhancement | `portfolio_holdings` field | `engine.ts` calculation | `HoldingsBuilder` column | Est. effort |
|---|-------------|------------------------------|---------------------------|---------------------------|-------------|
| 1 | **Position weight %** (MV / total) | *None* — derive in selector/API | `holdingValue / totalValue * 100` | **Weight %** | **2–3 h** |
| 2 | **Persist last session change %** from nightly quote | `last_change_pct numeric` nullable | Copy from provider `changePercent` during nightly update | **1d %** | **3–4 h** (migration + cron PATCH) |
| 3 | **User expense ratio** (ETF intelligence) | `expense_ratio numeric` nullable | Optional factor: `normalizeLowerIsBetter` in a **lite** score or display-only | **Expense %** | **3–5 h** |
| 4 | **User target weight %** per line (parity lite) | `target_weight_pct numeric` nullable | Compare to MV weight; flag row if \(\Delta > \epsilon\) (UI signal, not necessarily DB `signals`) | **Target %** / **Δ** | **4–6 h** |
| 5 | **Per-portfolio targets** (escape hardcoded `DEFAULT_TARGETS`) | *Optional:* `portfolios.target_weights jsonb` OR separate table | Parameterize `calculateAllocationWeights(..., targets)` from DB row | **Settings** slider / form | **6–10 h** |

**No new paid market provider** is strictly required for **#1–#2**; **#3–#4** are **user-input**; **#5** is config + engine wiring.

---

## Terminal summary

```
=== WORKBOOK INTELLIGENCE ROADMAP (SUMMARY) ===
Old platform Excel template width:     47 columns (A–AU, incl. 2 spacer columns)
Typed row fields (WorkbookRow/Schema): 46 keys per row (incl. sheetRow)
Columns present in new platform:       ~6 PRESENT (strict), ~6 PARTIAL
Columns missing vs workbook parity:    ~33 MISSING (row-level #2–#46)
Quick wins identified:                   5
Recommended first addition to build:   (1) MV-weight % column + API field
                                         then (2) persist last_change_pct from nightly quote
```

---

*End of document.*
