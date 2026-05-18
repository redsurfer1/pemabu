═══════════════════════════════════════════════════════════════════
PEMABU PLATFORM — COMPREHENSIVE SCORING ASSESSMENT
Assessment date: May 18, 2026
Codebase: PEMABU_PLATFORM_NEW (main @ 5d925a8)
Assessor: Claude Code (automated code review)
═══════════════════════════════════════════════════════════════════

## SCORECARD

```
┌─────────────────────────────────┬───────┬──────────────────────┐
│ Dimension                       │ Score │ Weight → Contribution │
├─────────────────────────────────┼───────┼──────────────────────┤
│ Overall (weighted composite)    │  7.4  │ —                    │
├─────────────────────────────────┼───────┼──────────────────────┤
│ Viability                       │  7.6  │ 20% → 1.52           │
│ Functionality                   │  7.8  │ 25% → 1.95           │
│ Features                        │  7.1  │ 20% → 1.42           │
│ Market / Launch Readiness       │  7.7  │ 20% → 1.54           │
│ Competitive Advantages / Moats  │  6.8  │ 15% → 1.02           │
└─────────────────────────────────┴───────┴──────────────────────┘
```

**Composite calculation:** 0.25×7.8 + 0.20×7.6 + 0.20×7.1 + 0.20×7.7 + 0.15×6.8 = **7.38 → 7.4/10**

### WHAT THIS SCORE MEANS

Pemabu has moved from **late-beta** toward **early production**: the quant portfolio engine, licensed Tiingo prices (including macro correlation), Stripe + import-token marketplace, legal surfaces, Supabase rate limits, and **live Sentry error capture on production** are implemented and verified in code. A paying Intelligence-tier user gets a coherent workbook, institutional overlay pages, and monitored failures. Remaining gaps are feature depth (scenario sim is an honest 501), allocation UI vs marketing copy, onboarding without a demo portfolio, and moats that are architectural rather than traction-driven.

---

## PHASE 1 — CODEBASE INVENTORY

### 1.1 — Application structure

**Page routes (`app/`, 45 `page.tsx` files)**

| Area | Routes |
|------|--------|
| Marketing | `/`, `/about`, `/pricing`, `/crypto`, `/request-access`, `/terms`, `/privacy`, `/disclaimer` |
| Auth | `/auth/error`, `/auth/callback` |
| Dashboard | `/dashboard` |
| Workspace | `/portfolio/engine`, `/portfolio/sleeves`, `/portfolio/[id]/execution-safety`, `/strategy-council`, `/marketplace`, `/macro`, `/governance`, `/political-tracker`, `/token-quality`, `/intelligence/13f-overlay`, `/defi`, `/options`, `/scenario-sim`, `/family`, `/family-view`, `/broadcast`, `/vault-export`, `/upgrade` |
| Admin | `/admin`, `/admin/portfolios`, `/admin/pricing`, `/admin/subscriptions`, `/admin/ops` |
| Other | `/trial`, `/access-denied`, `/broadcast/[token]`, `/strategy-council/print` |

**API routes (`app/api/`, 82 `route.ts` handlers)**  
Workbook (holdings, portfolios, assumptions, brief, consolidated, watchlist, explain, signal-history, morning-brief-context), portfolio (refresh, sleeves, model-assumptions, api-credentials, system-safety, execution-errors), marketplace (publish, import, leaderboard), stripe (checkout, subscription checkout, customer-portal, webhook), intelligence/macro/governance/political/token-quality, defi/options/execution/family/broadcast/vault-export, scenario-sim, strategy-council, **cron** (nightly-refresh, weekly-brief, assumption-drift, **sentry-verify**), admin, public (pricing, leaderboard), prices, market-data, trial.

**Major `lib/` modules (~169 files)**  
`actions/`, `allocation/`, `api/`, `broadcast/`, `constants/` (services, ai-models, compliance), `dashboard/`, `execution/`, `governance/`, `intelligence/`, `market-data/` (tiingo, tiingo-provider, tiingo-daily-closes, fetch-market-data), `marketplace/`, `monitoring/` (sentry-dsn), `navigation/`, `political-tracker/`, `portfolio/` (formula-engine, fiat-watchlist, row_status), `prices/`, `scenario-sim/`, `security/` (rate-limiter, tier-guard), `services/`, `supabase/`, `token-quality/`, `vault/`, `workspace/`.

**Supabase migrations:** **66** SQL files, range `20250001000000` → `20260630000002` (royalty RPC, rate-limit RPC, portfolio `row_status`, watchlist).

**Tests:** **26** Vitest test files (formula engine, refresh pipeline, Tiingo fallback, tiingo-daily-closes, accrue-creator-royalty, sentry-dsn, execution-sovereign, political/13F, portfolio hook).

**Configuration:** Next.js 15.5.15, React 19.2.4, TypeScript **strict**, Tailwind 4, `next.config.ts` + Sentry `withSentryConfig` (`tunnelRoute: /api/monitoring`), `vercel.json` crons, `instrumentation.ts` (Sentry + Anthropic validation).

### 1.2 — Feature inventory

| Feature | Status | Primary files | Notes |
|---------|--------|---------------|-------|
| User authentication (Supabase) | **EXISTS** | `middleware.ts`, `components/AuthModal.tsx`, `lib/navigation/workspace-auth.ts` | Wildcard matcher + `/api/cron/` public with bearer auth |
| Portfolio creation and management | **EXISTS** | `app/api/workbook/portfolios/route.ts`, `lib/services/portfolio.ts` | Ownership checks |
| Holdings CRUD (add/edit/remove) | **EXISTS** | `app/api/workbook/holdings/*`, `lib/portfolio/use-portfolio-engine.ts` | Engine + workbook |
| Live price fetching | **EXISTS** | `lib/market-data/fetch-market-data.ts`, `lib/market-data/tiingo.ts`, `lib/market-data/index.ts` | Tiingo only; `MARKET_DATA_PROVIDER=tiingo` on Vercel |
| Allocation ring / drift visualization | **PARTIAL** | `components/dashboard/PortfolioCard.tsx`, `lib/allocation/engine.ts` | Horizontal bar + drift %; not interactive target ring |
| Composite scoring engine | **EXISTS** | `lib/portfolio/formula-engine.ts`, `lib/portfolio/portfolio-factors.ts` (10 factors) | Vitest coverage |
| Signal generation (Entry/Hold/Exit) | **EXISTS** | `colAL`/`colAM` in `formula-engine.ts` | RSI + weighted-return thresholds |
| Assumptions tab (factor weights) | **EXISTS** | `app/api/workbook/assumptions/route.ts`, `portfolio-assumptions-store.ts` | `normaliseFactorWeights` |
| Weekly AI brief (Anthropic) | **EXISTS** | `lib/services/ai.ts`, `app/api/workbook/brief/route.ts` | Disclaimer in prompt; rate limit |
| Marketplace (browse strategies) | **EXISTS** | `app/(workspace)/marketplace/page.tsx`, leaderboard APIs | Tier-gated teasers |
| Marketplace (publish strategies) | **EXISTS** | `app/api/marketplace/publish/route.ts` | Intelligence tier |
| Marketplace (import/purchase) | **EXISTS** | `app/api/marketplace/import/route.ts`, Stripe checkout | Ledger default ON |
| Import token ledger | **EXISTS** | `lib/marketplace/import-gate.ts`, `import-token-service.ts`, webhook credits | `!== 'false'` default |
| Stripe payment integration | **EXISTS** | `app/api/stripe/*`, `webhook/route.ts` L271 `constructEvent` | Idempotent unlocks + royalty RPC |
| Subscription / tier management | **EXISTS** | `lib/services/user-entitlements.ts`, `lib/constants/services.ts` | Beta grant RPC |
| Crypto asset class support | **PARTIAL** | `lib/market-data/normalize-ticker.ts`, `tiingo.ts` crypto branch | BTC→BTC-USD |
| Sovereign execution (exchange keys) | **PARTIAL** | `lib/execution/*`, `USE_LOCAL_VAULT`, `vault-execution-plane.ts` | Ops-heavy deploy split |
| Trade proposal engine | **PARTIAL** | `trade_proposals` migration, `approveTradeProposal.ts` | Live dispatch gated |
| Macro regime intelligence | **PARTIAL** | `lib/intelligence/macro-regime.ts`, `macro-correlation-cache.ts` | **Tiingo** daily closes (no Yahoo in cache) |
| 13F / congressional disclosure data | **EXISTS** | `lib/intelligence/thirteen-f-edgar.ts`, political tracker APIs | EDGAR + sentiment |
| Leaderboard | **EXISTS** | `app/api/public/leaderboard/route.ts`, materialized view migration | Home preview |
| Family sharing | **PARTIAL** | `app/api/family/*`, family pages | Token-based viewer |
| Governance alerts | **PARTIAL** | `services/watcher/governance-fetcher.ts`, governance APIs | Watcher-dependent |
| DeFi wallet positions | **PARTIAL** | `services/watcher/defi-native-balances.ts`, defi page | RPC sync |
| Options positions | **PARTIAL** | `app/api/options/positions/*` | CRUD, thin analytics |
| Tax lot tracking | **PARTIAL** | `20260605120000_sovereign_sleeve_audit_and_tax_lots.sql` | Schema + server; thin UI |
| Portfolio drift alerts | **EXISTS** | `services/watcher/drift-detector.ts`, `portfolio_drift_alerts` | Value-based drift in `engine.ts` |
| Strategy council (AI monthly memo) | **EXISTS** | `lib/intelligence/strategy-council.ts`, memo PDF route | Model IDs centralized |
| Morning brief | **PARTIAL** | `app/api/workbook/morning-brief-context/route.ts` | Context API only |
| Scenario simulation | **STUB** | `app/api/scenario-sim/run/route.ts` L96–105 | Honest **501 FEATURE_COMING_SOON** |
| Marketing site (public pages) | **EXISTS** | `components/home/HomePage.tsx`, `(marketing)/*` | Legal footer + CTAs |
| Onboarding flow | **PARTIAL** | `/trial`, `/request-access`, empty states | No demo portfolio |
| Admin / ops tooling | **EXISTS** | `app/(admin)/*`, `app/api/admin/*`, `app/api/cron/sentry-verify/route.ts` | Sentry verify + stats |

**Summary (35 features):** EXISTS **20** (57%) · PARTIAL **14** (40%) · STUB **1** (3%) · ABSENT **0** (interactive allocation ring remains PARTIAL, not ABSENT)

### 1.3 — Technology stack

| Item | Value |
|------|--------|
| Next.js | 15.5.15 |
| React | 19.2.4 |
| TypeScript | ^5, **strict: true** |
| Supabase | `@supabase/ssr` 0.10.2, `@supabase/supabase-js` ^2.103 |
| Stripe | ^17.7.0 |
| Anthropic | `@anthropic-ai/sdk` ^0.89.0 |
| Monitoring | `@sentry/nextjs` ^10.53.1 — **production DSN configured & verify ping confirmed** |
| Market data | Tiingo (`lib/market-data/tiingo.ts`); `yahoo-finance2` in `package.json` but primary path is Tiingo |
| Tests | Vitest 4.1.4, GitHub Actions CI |
| Deploy | Vercel production (`www.pemabu.com`), Docker for vault/watcher |

### 1.4 — Database schema completeness

| Metric | Estimate |
|--------|----------|
| Migration files | 66 |
| `CREATE TABLE` (across migrations) | 25+ explicit batches |
| `ENABLE ROW LEVEL SECURITY` | ~18 migration touchpoints |
| `CREATE POLICY` | ~50+ policy statements |
| RPC functions | `accrue_creator_royalty`, `check_rate_limit`, beta grant, leaderboard refresh, import token spend |

RLS on portfolios, holdings, signals, marketplace, execution credentials, briefs. Service-role used only after server-side auth (`withAuth`, admin middleware).

---

## PHASE 2 — DIMENSION SCORING

### DIMENSION 2 — VIABILITY — **7.6/10**

**Score justification:**
- Stripe webhook verifies signatures (`constructEvent` L271), idempotent `marketplace_unlocks`, atomic `accrue_creator_royalty` RPC, and **always** credits import ledger (`webhook/route.ts` L92–106).
- Import entitlement defaults to ledger (`import-gate.ts` L62–63: `MARKETPLACE_USE_IMPORT_LEDGER !== "false"`).
- Licensed Tiingo path is the sole active provider (`lib/market-data/index.ts`); production Vercel has `MARKET_DATA_PROVIDER=tiingo` and `TIINGO_API_KEY`.
- Sentry production monitoring configured (`lib/monitoring/sentry-dsn.ts`, `instrumentation.ts`); verify endpoint returned `eventId` + `flushed: true` on `www.pemabu.com`.
- Sovereign execution and vault split remain operationally complex (`docs/DEPLOYMENT.md`, `USE_LOCAL_VAULT`).

**Evidence:**

| Finding | File | Impact |
|---------|------|--------|
| Idempotent unlock + ledger credit | `app/api/stripe/webhook/route.ts` | + monetization |
| Ledger default ON | `lib/marketplace/import-gate.ts` | + entitlement model |
| Tiingo-only provider | `lib/market-data/index.ts` | + licensed data |
| Sentry verify route | `app/api/cron/sentry-verify/route.ts` | + ops visibility |
| Vault deploy matrix | `.env.example`, execution libs | − ops burden |

**Ceiling (→ ~9.1):** Production migration checklist automated in CI; creator payout dashboard; preview/staging env parity; remove dead `yahoo-finance2` dependency.

**Strength:** End-to-end marketplace purchase → ledger → import gate with idempotent webhook and royalty RPC.

**Weakness:** Financial correctness still depends on applying latest Supabase migrations in production without drift.

---

### DIMENSION 3 — FUNCTIONALITY — **7.8/10**

**Score justification:**
- Portfolio MV (`colJ`) and weight (`colD`) are tested (`lib/portfolio/formula-engine.test.ts`); drift uses market values (`lib/allocation/engine.ts` `detectDrift`, `calculatePortfolioValue`).
- CASH fixed at $1 (`lib/market-data/fetch-market-data.ts` L23–25 `cashMarketDataResult`).
- Tiingo is the real fetch path; `yahoo-finance.ts` is a deprecated re-export to `fetch-market-data.ts` (no Yahoo HTTP in price pipeline).
- Macro correlation cache uses `fetchTiingoDailyCloses` (`lib/intelligence/macro-correlation-cache.ts`, `lib/market-data/tiingo-daily-closes.ts`).
- `withAuth` + wildcard middleware protect workspace routes; `/api/cron/` uses `CRON_SECRET` bearer inside handlers.
- `isPriceStale()` exists (`lib/market-data/types.ts` L58–64) but UI surfacing is inconsistent across all tables.

**Evidence:**

| Finding | File | Impact |
|---------|------|--------|
| colJ / colD / drift on MV | `formula-engine.ts`, `allocation/engine.ts` | + accuracy |
| Tiingo fetch + CASH | `fetch-market-data.ts` | + compliance |
| Macro Tiingo closes | `macro-correlation-cache.ts` | + licensed macro |
| Sentry in withAuth errors | `lib/api/auth.ts` L89 | + observability |
| Staleness util, thin UI | `types.ts` `isPriceStale` | − UX completeness |

**Ceiling (→ ~9.3):** E2E test signup→refresh→brief; staleness indicators on engine table; load test 50+ holdings; remove `scripts/doctor.mjs` Yahoo health check (L194).

**Strength:** Spreadsheet-grade formula engine with Vitest coverage and unified Tiingo refresh pipeline.

**Weakness:** No automated E2E proof of full dashboard path under production env on every deploy.

---

### DIMENSION 4 — FEATURES — **7.1/10**

**Feature inventory summary:**

| Status | Count | % | Weighted importance |
|--------|-------|---|---------------------|
| EXISTS | 20 | 57% | High — engine, auth, marketplace, intelligence, legal, monitoring |
| PARTIAL | 14 | 40% | Medium — execution, DeFi, options, allocation viz |
| STUB | 1 | 3% | Scenario sim |
| ABSENT | 0 | 0% | — |

**Differentiating features:**

| Feature | Implementation | Completeness |
|---------|----------------|--------------|
| Sovereign execution | Vault + encrypted creds + guardrails | ~58% |
| Institutional overlays (13F, political, governance, token) | APIs + pages + fetchers | ~74% |
| Macro regime | Pages + Tiingo correlation cache | ~68% |
| Strategy Council AI memo | Memo + PDF + disclaimer | ~80% |
| Import token + royalty marketplace | Stripe + ledger + publish/import | ~78% |

**Score justification:**
- Broad surface (45 pages, 82 API routes) exceeds typical MVP; engine has 10 configurable factors (`portfolio-factors.ts`).
- New **watchlist / row_status** (`20260628000001_portfolio_holdings_row_status.sql`, `PortfolioWatchlistPanel.tsx`) deepens engine UX.
- Scenario sim returns honest 501 — good integrity, reduces feature score.
- Marketing/about still implies “allocation ring” while UI is a bar (`PortfolioCard.tsx` L61–74).
- `yahoo-finance2` remains in `package.json` though unused in primary paths.

**Ceiling (→ ~8.6):** Ship scenario engine or hide nav; interactive target-vs-actual allocation; remove unused Yahoo package.

**Strength:** Composite scoring + institutional overlay bundle in one self-directed product.

**Weakness:** Breadth still exceeds depth on secondary modules (scenario, DeFi/options parity with engine).

---

### DIMENSION 5 — MARKET / LAUNCH READINESS — **7.7/10**

**Launch blocker inventory:**

| Blocker | Severity | Est. effort |
|---------|----------|-------------|
| Apply migrations `20260630000001`, `20260630000002` on prod if not applied | **HIGH** | 1 day |
| Preview env: Sentry DSN only on Production (not Preview/Development) | **MEDIUM** | 1 hour |
| Scenario sim nav visible but returns 501 | **MEDIUM** | 2–5 days or hide nav |
| No sample/demo portfolio for cold start | **MEDIUM** | 3–5 days |
| `scripts/doctor.mjs` still probes Yahoo (L194) | **LOW** | 1 hour |

**Score justification:**
- Legal: `/terms`, `/privacy`, `/disclaimer` + `InvestmentDisclaimerBanner` in `WorkspaceChrome.tsx` + `lib/constants/compliance.ts`.
- Security: wildcard middleware, Stripe webhook signature, Supabase `check_rate_limit` RPC (`lib/security/rate-limiter.ts`), tier guards.
- **Sentry live on production** — DSN set on Vercel; `POST /api/cron/sentry-verify` returned 200 with `eventId` and `flushed: true`.
- Rate limiter **fails open** on DB error (`rate-limiter.ts` L45–46).
- CI: typecheck, vitest, build, migration presence checks (`.github/workflows/ci.yml`).

**Ceiling (→ ~9.2):** Fail-closed rate limits on import/brief; E2E onboarding test; Sentry on preview; pen test.

**Strength:** Hardening sprint + Tiingo + Sentry materially closed prior launch gaps (middleware, legal, monitoring, licensed data).

**Weakness:** Rate limiter fail-open and preview-environment monitoring gaps.

---

### DIMENSION 6 — COMPETITIVE ADVANTAGES / MOATS — **6.8/10**

**Moat assessment:**

| Moat type | Strength | Current implementation |
|-----------|----------|------------------------|
| Data / network effects | **Moderate** | Leaderboard, marketplace strategies, portfolio history |
| Technical architecture | **Moderate** | Formula engine + vault execution + ledger marketplace |
| Market positioning | **Moderate** | Self-directed + institutional overlays |
| Regulatory design | **Moderate–Strong** | Disclaimers + non-custodial cloud mode |
| Marketplace flywheel | **Partial** | Publish/import/rate; needs liquidity |

**Closest competitors:**

| Competitor | How Pemabu differentiates |
|------------|---------------------------|
| Kubera / Monarch | Quant engine, composite ranks, signals, strategy marketplace |
| Composer / M1 | Marketplace sleeves + optional sovereign execution |
| Koyfin / Portfolio Visualizer | Unified overlays (13F, governance, political, token quality) in one workbook |

**Score justification:**
- 10-factor configurable engine is defensible proprietary logic.
- Sovereign vault path is differentiated but hard to operate.
- Marketplace + royalty RPC is a real economic model, not vapor.
- Moats remain **architecture-deep, traction-shallow**.
- Replication estimate: **12–18 engineer-months** for full stack.

**Ceiling (→ ~8.3):** Live marketplace liquidity; proprietary performance dataset; certified vault playbook.

**Strength:** Bundled institutional overlays on a personal quant engine — uncommon combination.

**Weakness:** Moats require users and publishers; technology alone is copyable with funding.

---

## PRIORITY ACTION MATRIX

| Priority | Action | Dimension | Score impact | Effort |
|----------|--------|-----------|--------------|--------|
| 1 | Confirm prod migrations `20260630000001` + `20260630000002` applied | Viability | +0.3 | S |
| 2 | E2E test: signup → dashboard → refresh → brief | Functionality | +0.3 | M |
| 3 | Ship scenario engine or hide Scenario Sim nav | Features | +0.2 | M/L |
| 4 | Interactive allocation target vs actual UI | Features | +0.2 | M |
| 5 | Add Sentry DSN to Preview/Development on Vercel | Launch | +0.15 | S |
| 6 | Fail-closed rate limit on import/brief (config flag) | Launch | +0.15 | S |
| 7 | Sample portfolio / onboarding wizard | Launch | +0.2 | M |
| 8 | Remove `yahoo-finance2` + doctor Yahoo probe | Launch | +0.1 | S |
| 9 | Staleness UI on engine holdings table | Functionality | +0.15 | S |
| 10 | Marketplace liquidity / publisher incentives | Moats | +0.2 | L |

---

## INVESTMENT / LAUNCH DECISION SUMMARY

**Current state in one sentence:**  
Pemabu is an **early-production allocation intelligence platform** with a working quant engine, licensed Tiingo data, monetized marketplace, legal/compliance surfaces, and **verified production error monitoring**—but not yet a complete institutional workstation on every marketed surface.

**Ready for:**  
Paid private beta and Intelligence tier; portfolio engine + watchlist; marketplace import tokens; Strategy Council; intelligence overlays; controlled public launch with legal pages, disclaimers, and Sentry-backed ops.

**Not ready for:**  
Mass-market self-serve without onboarding help; scenario-simulation marketing claims; claiming interactive “allocation ring” parity; autonomous live trading without vault ops runbooks.

**What would change overall score from 7.4 to 8.5+:**  
1. Production DB migrations verified + E2E-tested core user journey on every deploy.  
2. Scenario sim shipped or removed from nav; interactive allocation vs targets.  
3. Marketplace liquidity signal (active publishers + repeat imports) and fail-closed abuse controls on paid endpoints.

**Estimated time to launch-ready (1 senior full-stack dev):**  
**5–8 weeks** (migrations/E2E: 1–2 weeks; scenario or nav + allocation UI: 2–4 weeks; onboarding demo: 1–2 weeks).

═══════════════════════════════════════════════════════════════════
End of assessment — read-only review; scores reflect codebase @ 5d925a8.
