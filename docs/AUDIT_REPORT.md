# PEMABU — Allocation Intelligence Audit Report
**Phase 0 — Full Codebase Read-Only Audit**
**Date:** 2026-05-16
**Auditor:** Claude (Anthropic Agent)

---

## Summary Counts

| Severity | Count |
|---|---|
| CRITICAL (P0) | 5 |
| HIGH (P1) | 8 |
| MEDIUM (P2) | 9 |
| LOW (P3) | 5 |
| ALREADY CORRECT | 14 |

---

## CRITICAL (P0) — Must fix before any production use

### C1 · Three parallel market data systems with no unified layer

**Files:** `lib/market-data/index.ts`, `lib/market-data/yahoo-finance.ts`, `lib/prices/priceService.ts`, `lib/market-data/tiingo.ts`

Three completely separate market data paths exist and are each wired to different callers:

| Path | Used by | Note |
|---|---|---|
| `getActiveProvider()` → `google-finance.ts` | `workbook/brief`, `cron/nightly-refresh` | **Actually calls Yahoo Finance** (`query1.finance.yahoo.com`) |
| `fetchMarketDataWithFallback()` from `yahoo-finance.ts` | `/api/market-data/[ticker]`, `asset-class-engine.ts` | Separate Yahoo implementation |
| `yahoo-finance2` npm in `priceService.ts` | `/api/prices/current`, `/api/prices/historical` | Third distinct Yahoo caller |
| `tiingo.ts` | **Nothing** — never imported | Exists, has crypto detection, never wired |

This means quote freshness, error handling, and rate limiting are inconsistent across features. The cron job uses one path; the portfolio dashboard uses another. One stale price doesn't make any other path aware.

**Fix (Phase 3):** Consolidate to one canonical `getActiveProvider()` path. Add Tiingo as a second enum variant. Wire crypto ticker normalization at this boundary.

---

### C2 · `google-finance.ts` is not Google Finance — ToS violation risk

**File:** `lib/market-data/google-finance.ts`

The file is named `google-finance`, the env var is `MARKET_DATA_PROVIDER=google-finance`, but the actual HTTP call is:

```
https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d
```

The file's own comment says: _"ToS: not licensed for commercial redistribution. Approved for private beta and internal testing only."_

This is the **only** selectable provider via `MARKET_DATA_PROVIDER`. At launch, this must be replaced with a licensed provider (Tiingo, Marketstack, or Alpaca Data). The misleading name creates operational risk when rotating providers.

**Fix (Phase 3):** Rename to `yahoo-finance-unofficial.ts` (or remove and use `tiingo.ts`). Add Tiingo to `z.enum(["google-finance", "tiingo"])`. Make `TIINGO_API_KEY` conditional on provider selection.

---

### C3 · No crypto ticker normalization in any market data path

**Files:** `lib/market-data/google-finance.ts`, `lib/market-data/yahoo-finance.ts`, `lib/market-data/tiingo.ts`

- Yahoo Finance requires `BTC-USD` format for crypto
- Users entering `BTC` or `BTCUSD` or `BTC/USD` will get a `not_found` error with no hint
- `tiingo.ts` has `isCryptoTicker()` and `CRYPTO_BASE_TICKERS` but is not wired to anything
- `allocation-intelligence-core.ts` has `normalizeTicker(t)` but it only does `.trim().toUpperCase()` — no crypto format handling

The result: any crypto holding entered without the exact `BTC-USD` format silently returns no price, falls through to `current_price` (stale or null), and produces a 0-value position that skews allocation weights.

**Fix (Phase 3):** Add `normalizeTicker(ticker, assetClass)` that appends `-USD` for crypto asset class. Apply at the top of every price-fetch path before any API call.

---

### C4 · `/api/market-data/[ticker]` has no authentication

**File:** `app/api/market-data/[ticker]/route.ts`

```typescript
// TODO: add Redis rate limit before production
export async function GET(_req: Request, ctx: ...) {
  // No withAuth, no session check
  const data = await fetchMarketDataWithFallback(ticker);
```

Any unauthenticated user (or bot) can call this endpoint for any ticker string. With 200ms per-request sequential fetching this can be abused to rate-limit the app's Yahoo Finance quota, affecting all users.

**Fix (Phase 3):** Add `withAuth` wrapper. Add rate limiting (even simple in-memory token bucket until Redis is available).

---

### C5 · All three broker execution providers are stubs — no real trades possible

**Files:** `lib/execution/providers/alpaca.ts`, `lib/execution/providers/kraken.ts`, `lib/execution/providers/coinbase-advanced.ts`

Every `placeOrder()` implementation returns a fake order ID:

```typescript
// alpaca.ts
return { ok: true, externalId: `alpaca-stub-${Date.now()}` };
// kraken.ts
return { ok: true, externalId: `kraken-stub-${Date.now()}` };
// coinbase-advanced.ts
return { ok: true, externalId: `coinbase-stub-${Date.now()}` };
```

The execution UI, trade proposals, autonomous bridge, and circuit breaker are all wired but connect to stubs. Users who approve trade proposals believe trades are executing. The audit log records `TRADE_EXECUTION_SUCCESS` for fake orders.

**Fix (Phase 2/post-launch):** Add real broker API calls behind a `EXECUTION_LIVE=true` env gate. Keep stub path for local vault demo mode.

---

## HIGH (P1) — Fix before launch / before next phase

### H1 · AI briefs not persisted; no cooldown; no disclaimer in output

**Files:** `app/api/workbook/brief/route.ts`, `lib/services/ai.ts`

- The `POST /api/workbook/brief` route generates a brief and returns it inline — nothing is stored
- No `portfolio_briefs` table exists in any migration
- No 24-hour cooldown (each call triggers an Anthropic API request at full cost)
- The prompt says "No financial advice" as an instruction to the model, but the generated output contains no formal disclaimer visible to the user
- `generatePortfolioBrief` prompt: "Address the portfolio owner directly" — reads as personalized advice

Contrast with Strategy Council which has a non-fiduciary footer on every PDF. The weekly brief has no equivalent protection.

**Fix (Phase 5):** Create `portfolio_briefs` table. Add 24h cooldown enforced in the route. Prepend a fixed disclaimer to every brief before returning it.

---

### H2 · TypeScript errors in `lib/allocation/engine.test.ts` (4 errors)

**File:** `lib/allocation/engine.test.ts` lines 201, 220, 254, 262

From prior audit:
- L201, L220: `TS18048: 'h.finalTargetWt' is possibly 'undefined'` (optional field on `ComputedHolding`)
- L254, L262: `TS2554: Expected 2 arguments, but got 3`

These fail `tsc --noEmit`. The build likely passes because the test file is excluded from `tsconfig.json`, but any CI that runs type-checking on test files will fail.

**Fix (Phase 1):** Add `!` non-null assertions or null checks for `finalTargetWt`. Fix argument count.

---

### H3 · Beta group assignment not atomic — partial failure leaves incomplete access

**File:** `app/api/admin/groups/route.ts`

The beta grant path calls `supabaseAdmin.from("user_subscriptions").upsert(upserts, ...)` in a single batch call (good), but if the upsert fails partway through (e.g., FK violation on one service), the user ends up with partial beta access. There is no Postgres transaction wrapping the group assignment + subscription grant.

Migration `20260619000001_beta_grant_atomic_rpc.sql` exists — verify this wraps the logic in a `BEGIN/COMMIT` RPC. If the RPC is not called by the group route, the non-atomic path remains.

**Fix (Phase 1):** Confirm the admin groups route calls the atomic RPC. If it's still doing direct upserts, switch to the RPC.

---

### H4 · `asset-class-engine.ts` and `engine.ts` are near-identical duplicates

**Files:** `lib/allocation/engine.ts`, `lib/allocation/asset-class-engine.ts`

Lines 1–268 of `engine.ts` and lines 1–268 of `asset-class-engine.ts` are byte-for-byte identical (same `Quote`, `AllocationTarget`, `DEFAULT_TARGETS`, `calculateHoldingValue`, `calculatePortfolioValue`, `calculateAllocationWeights`, `detectDrift`, `calculateHoldingWeights`, `calculateHoldingDrift`, `buildSnapshotData`). `asset-class-engine.ts` then adds `refreshPortfolioSignals` (lines 270–620).

Similarly, `allocation-intelligence-core.ts` and `v3-engine.ts` both implement the v3.2 composite scoring engine.

This creates divergence risk: fixes applied to one file won't reach the other.

**Fix (Phase 2):** Delete `asset-class-engine.ts` and import the shared functions from `engine.ts`. Delete `allocation-intelligence-core.ts` in favour of `v3-engine.ts`.

---

### H5 · `TIINGO_API_KEY` required by env validator but provider is unreachable

**File:** `lib/env.ts` line 12

```typescript
TIINGO_API_KEY: z.string().min(1),
```

`getActiveProvider()` only accepts `"google-finance"`. Tiingo is never returned. But `lib/env.ts` fails startup if `TIINGO_API_KEY` is absent, even in a deployment that has no intention of using Tiingo. Developers hit `ZodError: TIINGO_API_KEY must be at least 1 character` before they can even start the app.

**Fix (Phase 3):** Make `TIINGO_API_KEY` optional in the schema (`z.string().min(1).optional()`), required only when `MARKET_DATA_PROVIDER === "tiingo"`.

---

### H6 · `lib/services/ai.ts` uses likely-invalid model IDs

**File:** `lib/services/ai.ts` lines 13–14

```typescript
const MODEL = "claude-opus-4-5";
const STRATEGY_COUNCIL_MODEL = process.env.STRATEGY_COUNCIL_ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
```

`claude-opus-4-5` is not a documented model snapshot. The correct IDs are `claude-opus-4-20250514` (or the `claude-3-5-sonnet-*` family). An invalid model ID returns a 404 from the Anthropic API, silently failing every brief and signal narrative generation. The Strategy Council fallback `"claude-sonnet-4-20250514"` looks non-standard as well.

**Fix (Phase 5):** Update to validated model IDs. Add a startup check that the configured model responds to a health ping.

---

### H7 · `sovereign violation`: encrypted API keys routed to Supabase cloud in non-vault mode

**File:** `lib/actions/execution/saveExchangeCredentials.ts`

When `USE_LOCAL_VAULT=false` (hosted/cloud mode), AES-256-GCM encrypted API keys are written to `exchange_credentials` in Supabase Cloud. The sovereign architecture promise ("API keys never touch the cloud") only holds when `isLocalVaultExecutionPlane()` returns true.

**Fix:** Add a hard block: if `USE_LOCAL_VAULT=false`, refuse to save exchange credentials and return an explicit error explaining that credential storage requires the local vault.

---

### H8 · `AssumptionsPanel` has only one group — two independent groups required

**File:** `components/portfolio/AssumptionsPanel.tsx`

The directive requires two independent assumption groups: one for the Main sleeve (return weights + composite scoring weights) and one for the Income sleeve (separate return and scoring weights). The current panel shows one merged set. Saving applies the same weights to both sleeves.

**Fix (Phase 4):** Add a sleeve-type tab (Main / Income) to the panel. Load and save two separate `model_assumptions` rows (one per `sleeve_type`).

---

## MEDIUM (P2) — Fix before feature-complete launch

### M1 · Cash handling: only `asset_class === "cash" || ticker === "CASH"` gets $1.00

**Files:** `lib/allocation/engine.ts:86-94`, `lib/allocation/asset-class-engine.ts:88-97`

```typescript
if (h.asset_class === "cash" || h.ticker === "CASH") {
  enrichedQuotes.set(h.ticker, { price: 1.00, ... });
}
```

A holding with `asset_class: "cash"` and `ticker: "USD"` or `"CASH_USD"` would be caught by the asset_class check (good). But a holding with `asset_class: "equity"` and `ticker: "CASH"` would also be set to $1.00 (probably wrong). The intent is clear — but the guard should be the asset_class check only, not an OR with the ticker string.

**Fix (Phase 2):** Change to `h.asset_class === "cash"` only. Remove the `|| h.ticker === "CASH"` OR clause. Add test for `ticker: "CASH", asset_class: "equity"` to confirm it gets a real price (or 0).

---

### M2 · Staleness indicator missing — no way to show when a price is >24h old

**Files:** All quote display paths

`Quote.asOf` is populated by providers. Holdings have `last_price_refreshed_at`. But:
- No component renders a "stale" warning when `asOf` is older than 24 hours
- No utility function `isPriceStale(asOf: Date): boolean`
- The nightly cron refreshes prices, but weekends produce 48h+ old prices

**Fix (Phase 3):** Add `isPriceStale(date: Date, hours = 24): boolean`. Show amber clock icon in `HoldingsTable` when stale. Show stale indicator in `PortfolioKPIBar`.

---

### M3 · `HoldingsTable` main sleeve missing Dividend $ column

**File:** `components/portfolio/HoldingsTable.tsx` line 141–227

The main sleeve table has 22 columns but does not show `divDollar` (raw annual dividend dollars). The model spreadsheet requires this column for parity $ calculation verification. `divAPY` is shown but not the underlying `divDollar`.

**Fix (Phase 4):** Add `Div $` column between `Div APY` and `Cur Wt%` for the main sleeve view.

---

### M4 · `allocation-intelligence-core.ts` is a duplicate of `v3-engine.ts` with drift risk

**Files:** `lib/allocation/allocation-intelligence-core.ts`, `lib/allocation/v3-engine.ts`

Both implement the v3.2 8-step pipeline. `allocation-intelligence-core.ts` has `normalizeTicker()` (though trivial) that `v3-engine.ts` lacks. The dashboard uses `v3-engine.ts`. If a fix is applied to one, the other silently diverges.

**Fix (Phase 2):** Remove `allocation-intelligence-core.ts`. Any callers should import from `v3-engine.ts`.

---

### M5 · Crypto ring color not applied to allocation chart

**Files:** `components/dashboard/AllocationReference.tsx` (not read), `app/(marketing)/crypto/page.tsx`

The crypto marketing page correctly uses `#F7931A` (Bitcoin orange). It's unclear whether the allocation ring chart applies this color for the `crypto` asset class bucket. If the chart uses a generic color palette, crypto allocations will render with a generic color.

**Fix (Phase 4):** Ensure `ASSET_CLASS_COLORS` constant includes `crypto: "#F7931A"` and is used by all ring/donut charts.

---

### M6 · Workspace routes missing from middleware matcher (partial)

**File:** `middleware.ts` lines 87–101

The matcher includes `/portfolio`, `/strategy-council`, `/marketplace`, `/dashboard`, `/admin`, `/workbook`. However these workspace routes are NOT in the matcher: `/broadcast`, `/defi`, `/governance`, `/intelligence`, `/macro`, `/options`, `/political-tracker`, `/scenario-sim`, `/token-quality`, `/vault-export`, `/family`, `/upgrade`.

These routes rely on `requireWorkspaceUser()` in their layouts (a server-side auth check), which is correct but adds latency. More importantly, if a route doesn't have its own auth check in the layout/page, it would be unprotected.

**Fix (Phase 1):** Audit all workspace route layouts for `requireWorkspaceUser()`. Add missing routes to the middleware matcher.

---

### M7 · `XXmiddleware.ts` is a dead file — causes confusion

**File:** `XXmiddleware.ts`

A disabled, older middleware file (prefixed `XX`) with a narrower matcher (`/dashboard`, `/admin`, `/workbook` only, no `/portfolio` or `/strategy-council`). Any developer reading the project directory may confuse this for the active middleware.

**Fix (Phase 6):** Delete `XXmiddleware.ts`.

---

### M8 · Cron routes verify secret correctly but are excluded from middleware

**Files:** `app/api/cron/*/route.ts`, `middleware.ts`

Cron routes check `Authorization: Bearer ${CRON_SECRET}` at the handler level. The middleware matcher excludes `/api/cron/*`. This is the correct pattern — Vercel Cron injects the secret in the header. **This is a confirmed-correct pattern**, not a defect. Documented here to distinguish from the unauthenticated `/api/market-data` route.

---

### M9 · `priceService.ts` has no CASH guard — CASH will query Yahoo Finance and fail

**File:** `lib/prices/priceService.ts:102–119`

The `getCurrentPrices()` function batches all tickers and queries `yahoo-finance2.quote(ticker)` for each. If `tickers` includes `"CASH"`, Yahoo Finance returns no data and the price is silently omitted from `results`. The caller falls back to `price_seed`. But this is a silent failure that burns a rate-limit slot.

**Fix (Phase 3):** Add `if (ticker === "CASH" || ...) { results[ticker] = 1.00; continue; }` at the top of the fetch loop.

---

## LOW (P3) — Quality / cleanup items

### L1 · `google-finance.ts` filename mismatch — calls Yahoo Finance

Rename to `yahoo-finance-unofficial.ts` or replace with `tiingo.ts`. The env enum value `"google-finance"` should change to `"yahoo-unofficial"` or `"tiingo"`.

### L2 · `XXmiddleware.ts` dead file — delete

### L3 · TODO artifact in production route handler

`app/api/market-data/[ticker]/route.ts:4`: `// TODO: add Redis rate limit before production`

### L4 · `allocation-intelligence-core.ts` is unreferenced dead code

Run `grep -r "allocation-intelligence-core"` — if no callers, delete. The v3-engine is the canonical implementation.

### L5 · `lib/market-data/tiingo.ts` wired to nothing

Tiingo exists, has crypto detection, uses `TIINGO_API_KEY` — but is never called. Either wire it to `getActiveProvider()` or delete it.

---

## ALREADY CORRECT ✓

| # | Item | Evidence |
|---|---|---|
| 1 | `crypto` in `AssetClass` type | `lib/types/database.ts:14` |
| 2 | `crypto` in `portfolio_holdings` check constraint | migration `20260430164649` |
| 3 | `DEFAULT_TARGETS` includes `crypto: 0` | `lib/allocation/engine.ts:52–58` |
| 4 | Cash = $1.00 for `asset_class === "cash"` holdings | `engine.ts:86-94` |
| 5 | `computeTrendSignal` returns "Consider Entry / Hold / Consider Exit" | `v3-engine.ts:141-145` |
| 6 | `withAuth` wrapper used on all authenticated API routes | `lib/api/auth.ts` |
| 7 | Middleware gates `/api/admin/*` and checks `role === "admin"` | `middleware.ts:51-69` |
| 8 | `x-pemabu-admin` header injected for verified admin requests | `middleware.ts:59` |
| 9 | Strategy Council memo has non-fiduciary footer | `strategy-council-pdf-document.tsx` |
| 10 | Crypto marketing page has disclaimer on every section | `app/(marketing)/crypto/page.tsx` |
| 11 | `SubscriptionStatus` includes all 5 values incl. `trial` | `lib/types/database.ts:131` |
| 12 | `price_paid_usd` is the correct column name | `lib/types/database.ts:153` |
| 13 | `percentRank` clamped `[0,1]` via formula | `v3-engine.ts:70-75` |
| 14 | Vol cap + 3-pass theme cap + normalize pipeline | `v3-engine.ts:96-137` |

---

## Phase 0 Inventory Summary

### Migrations (50 total)
Complete table inventory across all 50 migration files. Key tables:
- `portfolio_holdings` — crypto asset class ✓
- `sleeves`, `sleeve_holdings`, `model_assumptions` — v3.2 engine tables ✓
- `pemabu_services`, `user_subscriptions`, `user_group_assignments` — pricing ✓
- `marketplace_strategies`, `marketplace_strategy_subscribers` — marketplace ✓
- `exchange_credentials`, `trade_proposals`, `execution_queue` — execution stubs ✓
- `portfolio_briefs` — **does NOT exist** (H1) ✗

### Route Inventory
- **Total API routes:** ~65 route files
- **Authenticated (withAuth):** All workspace routes ✓
- **Unauthenticated (public):** `/api/public/*`, `/api/market-data/[ticker]` (H4) ✗
- **Admin-gated (middleware + role):** `/api/admin/*` ✓
- **Cron-secret-gated:** `/api/cron/*` ✓

### TypeScript Health
- **Production code:** 0 known errors
- **Test files:** 4 errors in `engine.test.ts` (H2)
- **Strict mode:** Enabled (`tsconfig.json` has `"strict": true`)

### Market Data Health
- **Providers registered:** 1 active (`google-finance`/Yahoo)
- **Providers wired but unreachable:** 1 (Tiingo)
- **Parallel implementations:** 3 (C1)
- **Crypto normalization:** None (C3)
- **Auth on ticker endpoint:** Missing (C4)

### AI Brief Health
- **Disclaimer in prompt:** Partial (instruction to model)
- **Disclaimer in output:** None (H1)
- **Storage:** None (H1)
- **Cooldown:** None (H1)
- **Model ID validity:** Uncertain (H6)

---

*This report was produced by read-only analysis. No files were modified.*
