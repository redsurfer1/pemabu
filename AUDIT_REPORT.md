# Pemabu Allocation Intelligence — Phase 0 Full Codebase Audit

**Repository:** `C:\Users\jwill\Desktop\Developer\Clone\PEMABU_PLATFORM_NEW`  
**Audit date:** 2026-05-03  
**Spec reference:** Allocation Intelligence Model v3.2 (spreadsheet)

---

## 0.1 PROJECT STRUCTURE

### Directory layout (application source, high level)

| Area | Path | Role |
|------|------|------|
| Next.js App Router | `app/` | Routes, layouts, API route handlers |
| React components | `components/` | Dashboard, admin, portfolio, workbook, marketing |
| Libraries | `lib/` | Allocation engines, Supabase, market data, services |
| Types | `types/` | Allocation v3 TypeScript types |
| Hand-written DB types | `lib/types/database.ts` | Supabase table shapes |
| Supabase | `supabase/migrations/`, `supabase/functions/` | SQL migrations, Edge Functions (Deno) |
| Public assets | `public/` | Static SVGs |
| Config | `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts` | |

### Framework

- **Next.js:** `15.5.15` (from `package.json`)
- **Router:** **App Router** (`app/` with `layout.tsx`, `page.tsx`, route groups `(marketing)`, `(admin)`)
- **React:** `19.2.4`

### TypeScript

- **Strict mode:** `strict: true` in `tsconfig.json`
- **Path alias:** `@/*` → project root
- **Exclude:** `supabase/functions` (Deno edge functions)

### Database / ORM

- **No Prisma** in this repository. Persistence is **PostgreSQL via Supabase** with hand-maintained SQL migrations under `supabase/migrations/`.
- **Schema source of truth:** SQL files (e.g. `20250001000001_create_portfolios.sql`, `20260501192059_add_allocation_v3_tables.sql`).
- **App types:** `lib/types/database.ts` (manually synced; comment instructs not to auto-generate).

### Supabase

- **Clients:** `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (Server Components / Route Handlers), `lib/supabase/admin.ts` (service role for elevated ops).
- **RLS:** Enabled on core tables; migration `20260501192059` adds RLS for sleeves, sleeve holdings, snapshots, model_assumptions, price_cache.
- **Edge Functions:** `supabase/functions/refresh-portfolio-signals/` (Deno, URL imports) — excluded from Next.js `tsconfig`.

### State management

- **@tanstack/react-query** for client data fetching where used
- Server state: Supabase + server actions / API routes
- No Redux / Zustand in `package.json`

### UI / styling

- **Tailwind CSS v4** (`@tailwindcss/postcss`, `app/globals.css`)
- **No** component library (MUI/Chakra) in dependencies — custom components
- Brand: navy / gold / cream noted in product docs; portfolio components use similar patterns

### API routes (`app/api/`)

Admin, cron, workbook, market-data, portfolio refresh, prices — see **0.4**.

### Server actions

- Primary server file: `lib/actions/refreshPrices.ts` (`"use server"`) for allocation refresh
- No `lib/server/` directory
- Mission-requested `lib/actions/portfolio/*` not present as a folder yet (flat `refreshPrices.ts` only)

### Environment variables

- **No committed `.env.example`** in repo root (none found at audit time).
- **`lib/env.ts`** defines **server** schema: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `PEMABU_CRON_SECRET`, `ANTHROPIC_API_KEY`, `MARKET_DATA_PROVIDER`, `RESEND_*`, `TIINGO_API_KEY`, etc.
- **Public:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`
- **Typical local:** `.env.local` (gitignored) for Supabase keys and app URL

---

## 0.2 EXISTING DATA MODEL (Supabase — not Prisma)

> **Note:** The mission references `prisma/schema.prisma`. This codebase does **not** use Prisma; the following maps **Supabase/Postgres** tables to the canonical entities.

### `user_profiles` (from migrations)

- User display/role — maps to user identity, not spreadsheet columns directly.

### `portfolios`

- **Maps to:** Portfolio (container for sleeves, holdings, assumptions)
- Fields: `id`, `user_id`, `name`, `description`, `currency`, timestamps

### `portfolio_holdings` (legacy workbook path)

- **Maps to:** older Holding model (quantity, `asset_class`, `current_price`, drift tooling)
- Used by workbook / drift flows alongside **v3 sleeve tables**

### `sleeves` (v3 migration)

- **Maps to:** Sleeve concept (**present**)
- Fields: `id`, `portfolio_id`, `name`, `purpose`, `budget_pct`, `sort_order`, `is_active`, timestamps
- **Gap vs v3.2 spec:** No `weighting_method` enum column in migration as audited — needed for COMPOSITE_SCORE / YIELD_PROPORTIONAL / MANUAL

### `sleeve_holdings`

- **Maps to:** v3 Holding rows inside a sleeve
- Fields include: `ticker`, `name`, `status`, `theme`, `qty`, `price_seed`, `expense_ratio`, `div_dollar`, `target_wt_pct`
- **Gaps vs spec:**
  - No explicit **`manual_pricing`**, **`manual_target_wt`**, **`sort_order`** in original migration
  - Status stored as text (`Active` / `Comparable`) vs enum — acceptable with validation

### `sleeve_snapshots`

- **Maps to:** HoldingSnapshot / computed row per refresh
- Contains: prices, returns, weights, parity fields, `composite_score`, `score_rank`, `vol_cap_flag`, `theme_exposure_pct`, `signal`, etc.
- **Gaps vs spec:** Missing explicit PERCENTRANK columns as separate floats (`pr_expense`…), **`theme_capped_wt`**, **`raw_score_wt`**, **`equal_wt_base`**, **`sharpe_proxy`**, **`vol3mo`**, **`div_apy`**, split **`parity_dollar_amt`** vs change — some may be derivable from existing columns; schema alignment may require additive columns

### `model_assumptions`

- **Maps to:** ModelAssumptions (**present**)
- Return weights, score weights, `income_budget_pct`, `vol_cap_multiplier`, `theme_cap_pct`

### `price_cache`

- **Maps to:** PriceCache (partial)
- Current design: `cache_key` (unique), `price`, `fetched_at`, `ttl_seconds`
- **Gap vs spec:** Spec wants `(ticker, period, cacheDate)` uniqueness — different shape; can be implemented with new columns + unique index while migrating keys

### Other tables (signals, drift, allocation_snapshots JSON)

- **Signals, drift_events, allocation_snapshots** — operational / legacy workbook; `allocation_snapshots.snapshot_data` may hold ad-hoc JSON

### Spreadsheet-entity checklist

| Question | Answer |
|----------|--------|
| Sleeve in schema? | **Yes** (`sleeves` / `sleeve_holdings`) |
| Composite score on holdings? | **In snapshots** (`composite_score`), not on static holding row |
| PERCENTRANK stored? | **Partially** — engine computes in code; DB may not store all four PR columns separately |
| Historical price fields (3mo–5yr)? | **In `sleeve_snapshots`** as `price_3mo` … `price_5yr` |
| Parity gap (current − target)? | **Computed**; snapshot has `parity_gap_pct` |
| Trend signal? | **As `signal` text** on snapshot |
| ModelAssumptions table? | **Yes** (`model_assumptions`) |

---

## 0.3 EXISTING COMPUTATION LOGIC

| File | What it does | vs v3.2 |
|------|----------------|--------|
| `lib/allocation/engine.ts` | Asset-class weights, drift, `refreshPortfolioSignals`, Yahoo quotes via formula-engine columns | **Different model** — spreadsheet column / RSI-style logic from `formula-engine`; **not** the 8-step PERCENTRANK sleeve engine |
| `lib/allocation/v3-engine.ts` | PERCENTRANK, blended return, vol/sharpe, composite score, vol cap, theme cap, income sleeve yield weights, trend signal | **Aligns** with v3.2 **in intent**; **known gaps:** `parityGapPct` formula vs spec (`current − target` preferred), `themeExposurePct` used after normalization in places, `name` sometimes set to ticker, missing explicit **`themeCappedWt`** in output |
| `lib/portfolio/formula-engine.ts` | Excel-column helpers, ranks, RSI | Supports **legacy** workbook engine, not v3.2 sleeve sheet |
| `lib/dashboard/allocationData.ts` | Dashboard allocation display helpers | Display layer |
| `lib/actions/refreshPrices.ts` | Loads sleeves/holdings/assumptions, fetches prices via internal API, runs `computeMainSleeve` / `computeIncomeSleeve`, upserts snapshots | **Orchestration** — matches flow; depends on v3-engine correctness |

**Specific mechanisms**

| Mechanism | Present? | Where |
|-----------|----------|--------|
| Composite score | Yes | `v3-engine.ts` |
| PERCENTRANK | Yes | `percentRank()` — Excel-style |
| Blended return | Yes | Weighted sum of period returns |
| Parity / drift | Partial | Parity dollars/changes; gap % formula may differ |
| Target weights | Yes | Main + income paths |
| Signals (Entry/Hold/Exit) | Yes | `computeTrendSignal` on blended return |

---

## 0.4 API ROUTES & SERVER ACTIONS

### `app/api/` (representative inventory)

| Path | Methods | Purpose | Prices? | DB write? |
|------|---------|---------|---------|-----------|
| `admin/portfolios`, `admin/stats`, `admin/users` | GET | Admin | No | Read |
| `cron/*` | GET/POST | Scheduled jobs | Via services | Yes |
| `market-data/[ticker]` | GET | Quote proxy | Yes | Cache optional |
| `portfolio/[portfolioId]/refresh` | POST | Refresh signals | Via engine | Yes |
| `prices/current` | GET | Yahoo + `price_cache` | Yes | Upsert cache |
| `prices/historical` | GET | Historical prices | Yes | Cache |
| `workbook/*` | Mixed | Portfolio/workbook CRUD | Sometimes | Yes |

### `lib/actions/`

| File | Purpose |
|------|---------|
| `refreshPrices.ts` | Server action: full sleeve refresh for a portfolio |

---

## 0.5 EXISTING UI COMPONENTS (portfolio-related)

| File | Role | v3.2 gap |
|------|------|----------|
| `components/portfolio/PortfolioDashboard.tsx` | Main dashboard composing KPIs, sleeves, assumptions | May need alignment with final `PortfolioView` types and KPI strip |
| `PortfolioKPIBar.tsx` | KPI strip | Exists — verify 8 metrics vs Dashboard sheet |
| `SleeveCard.tsx` | Sleeve header + holdings | Exists — verify parity bar + columns |
| `HoldingsTable.tsx` | Column layout per sleeve type | Exists — verify all spreadsheet columns & formatting |
| `AssumptionsPanel.tsx` | Sliders / save | Exists — wire to `updateAssumptions` when added |
| `SleeveManager.tsx` | Add/reorder sleeves | Exists — dnd-kit may need deps |
| `AddSleeveModal.tsx` | Create sleeve | Exists |
| **Missing per mission** | `RefreshButton.tsx` | Create dedicated control with rate limit |

**Route:** `app/portfolio/sleeves/page.tsx` → `SleevesPageClient` (protected)

---

## 0.6 PRICE DATA SOURCE

| Source | Usage |
|--------|--------|
| **yahoo-finance2** | `package.json` dependency; used in `app/api/prices/current/route.ts` and historical route |
| **lib/market-data/** | `yahoo-finance.ts`, `tiingo.ts`, `google-finance.ts`, `index.ts` — multi-provider fallback for some flows |
| **Hardcoded / cash** | Cash price = 1 in legacy engine paths |

**Limitations:** Yahoo unofficial API — rate limits, symbol coverage; mutual funds may need manual pricing (`manualPricing` in spec).

---

## 0.7 GAP ANALYSIS TABLE (Spreadsheet column map)

| Spreadsheet Feature | Status | Location (if exists) | Gap Description |
|---------------------|--------|------------------------|-----------------|
| Status | Partial | `sleeve_holdings.status` | Values `Active`/`Comparable` vs enum `ACTIVE`/`COMPARABLE` — normalize in types/UI |
| Ticker | Implemented | `sleeve_holdings.ticker` | — |
| Name | Implemented | `sleeve_holdings.name` | Sometimes defaulted to ticker in engine output |
| Theme | Implemented | `sleeve_holdings.theme` | — |
| Qty | Implemented | `sleeve_holdings.qty` | — |
| Price | Implemented | Snapshots / `price_seed` | Live price from Yahoo |
| Value | Implemented | Snapshot `value` | — |
| Expense Ratio | Implemented | `expense_ratio` | — |
| Div $ | Implemented | `div_dollar` | — |
| Div APY | Computed | Engine | Store in snapshot explicitly for audit |
| Current Wt% | Implemented | `current_wt_pct` | — |
| Parity Gap% | Partial | `parity_gap_pct` | Formula must be `currentWt − targetWt` per spec |
| Target Wt% | Implemented | `target_wt_pct` | — |
| Ret 3mo–5mo | Implemented | `ret_3mo` … `ret_5yr` | — |
| Blended Return | Implemented | `blended_return` | — |
| Vol 3mo | Computed | In engine | Persist as column |
| Sharpe Proxy | Computed | In engine | Persist |
| PR Expense | Computed | Engine | Optional persist |
| PR Return / Div / Sharpe | Computed | Engine | Optional persist |
| Composite Score | Implemented | `composite_score` | — |
| Score Rank | Implemented | `score_rank` | — |
| Raw Score Wt | Computed | Engine | Add to snapshot |
| Equal Wt Base | Computed | Engine | Add |
| Vol Cap Flag | Implemented | `vol_cap_flag` | — |
| Theme Exp% | Implemented | `theme_exposure_pct` | Must follow pass-1 capped weights per spec |
| Theme Capped Wt | Missing | — | Add computation + storage |
| Final Target Wt | Partial | `target_wt_pct` | Clarify vs intermediate weights |
| Parity $ Amt | Partial | `parity_dollar` | Split amt vs change per spec |
| Parity $ Chg | Computed | Engine | Align naming |
| Trend Signal | Implemented | `signal` | Enum vs string |
| Price 3mo ago … 5yr ago | Implemented | `price_3mo` … `price_5yr` | — |
| Main ETF sleeve | Partial | `sleeves` + holdings | Needs `weighting_method` |
| Income sleeve | Partial | Same | Yield-proportional path in engine |
| Fidelity/Cash sleeve | Partial | Same | Manual targets — needs `manual_pricing`, `manual_target_wt` |
| ModelAssumptions (12 params) | Implemented | `model_assumptions` | 5 return + 4 score + 3 allocation — matches count |

---

## Phase 0 conclusion

- The project is a **Next.js 15 App Router** app with **Supabase** (no Prisma).  
- **v3.2 logic** largely lives in **`lib/allocation/v3-engine.ts`** with **gaps** in parity/theme metadata and schema completeness.  
- **Legacy** asset-class logic remains in **`lib/allocation/engine.ts`** alongside **`refreshPortfolioSignals`** — consolidation required for a single authoritative v3.2 `engine.ts` and legacy split to a separate module.  
- **Next step:** schema alignment via **SQL migration**, unify computation in **`lib/allocation/engine.ts`**, **`lib/prices/priceService.ts`**, server actions, UI polish, seed data, validation report.

**End of Phase 0 audit.**
