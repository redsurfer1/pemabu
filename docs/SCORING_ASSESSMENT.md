═══════════════════════════════════════════════════════════════════
PEMABU PLATFORM — COMPREHENSIVE SCORING ASSESSMENT
Assessment date: May 17, 2026
Codebase: PEMABU_PLATFORM_NEW (main @ 8ee81a0)
Assessor: Claude Code (automated code review)
═══════════════════════════════════════════════════════════════════

## SCORECARD

```
┌─────────────────────────────────┬───────┬──────────────────────┐
│ Dimension                       │ Score │ Weight → Contribution │
├─────────────────────────────────┼───────┼──────────────────────┤
│ Overall (weighted composite)    │  7.1  │ —                    │
├─────────────────────────────────┼───────┼──────────────────────┤
│ Viability                       │  7.3  │ 20% → 1.46           │
│ Functionality                   │  7.4  │ 25% → 1.85           │
│ Features                        │  6.8  │ 20% → 1.36           │
│ Market / Launch Readiness       │  7.2  │ 20% → 1.44           │
│ Competitive Advantages / Moats  │  6.6  │ 15% → 0.99           │
└─────────────────────────────────┴───────┴──────────────────────┘
```

**Composite calculation:** 0.25×7.4 + 0.20×7.3 + 0.20×6.8 + 0.20×7.2 + 0.15×6.6 = **7.10 → 7.1/10**

### WHAT THIS SCORE MEANS

Pemabu is a **credible late-beta / early-launch** allocation intelligence platform: the portfolio engine, Tiingo market data path, Stripe monetization, marketplace ledger, and hardening sprint (middleware, rate limits, Sentry, legal pages) are real and wired in code. A paying Intelligence-tier user can manage portfolios, refresh signals, buy import tokens, and use institutional overlay pages. Gaps remain in scenario simulation (honest 501), shallow allocation visualization vs marketing copy, sovereign execution ops complexity, and a few residual Yahoo calls outside the main price pipeline.

---

## PHASE 1 — CODEBASE INVENTORY

### 1.1 — Application structure

**Page routes (`app/`, 45 `page.tsx` files)**

| Area | Routes |
|------|--------|
| Marketing | `/`, `/about`, `/pricing`, `/crypto`, `/request-access`, `/terms`, `/privacy`, `/disclaimer` |
| Auth | `/auth/error`, `/auth/callback` (route handler) |
| Dashboard | `/dashboard` |
| Workspace | `/portfolio/engine`, `/portfolio/sleeves`, `/portfolio/[id]/execution-safety`, `/strategy-council`, `/marketplace`, `/macro`, `/governance`, `/political-tracker`, `/token-quality`, `/intelligence/13f-overlay`, `/defi`, `/options`, `/scenario-sim`, `/family`, `/family-view`, `/broadcast`, `/vault-export`, `/upgrade` |
| Admin | `/admin`, `/admin/portfolios`, `/admin/pricing`, `/admin/subscriptions`, `/admin/ops` |
| Other | `/trial`, `/access-denied`, `/broadcast/[token]`, `/strategy-council/print` |

**API routes (`app/api/`, ~76 unique handlers)**  
Workbook (holdings, portfolios, assumptions, brief, consolidated, watchlist, explain, signal-history, morning-brief-context), portfolio (refresh, sleeves, model-assumptions, api-credentials, system-safety, execution-errors), marketplace (publish, import, leaderboard), stripe (checkout, subscription checkout, customer-portal, webhook), intelligence/macro/governance/political/token-quality, defi/options/execution/family/broadcast/vault-export, scenario-sim, strategy-council, cron/watcher, admin, public (pricing, leaderboard), prices, market-data, trial.

**Major `lib/` modules (150+ files)**  
`actions/`, `allocation/`, `api/`, `broadcast/`, `constants/` (services, ai-models, compliance), `dashboard/`, `execution/`, `governance/`, `intelligence/`, `market-data/` (tiingo, tiingo-provider, fetch-market-data), `marketplace/`, `navigation/`, `political-tracker/`, `portfolio/`, `prices/`, `scenario-sim/`, `security/` (rate-limiter, tier-guard, encryption), `services/`, `supabase/`, `token-quality/`, `vault/`, `workspace/`.

**Supabase migrations:** **66** SQL files, range `20250001000000` → `20260630000002` (includes `accrue_creator_royalty_rpc`, `rate_limit_rpc`, portfolio engine columns, marketplace ledger).

**Tests:** **24** Vitest test files (formula engine, refresh pipeline, fallback/Tiingo, accrue-creator-royalty, execution-sovereign, political/13F, portfolio hook, API refresh/ticker).

**Configuration:** Next.js 15.5.15 (`next.config.ts` + Sentry `withSentryConfig`), React 19.2.4, TypeScript strict, Tailwind 4, `vercel.json` crons, `instrumentation.ts` for AI config validation.

### 1.2 — Feature inventory

| Feature | Status | Primary files | Notes |
|---------|--------|---------------|-------|
| User authentication (Supabase) | **EXISTS** | `components/AuthModal.tsx`, `middleware.ts`, `lib/navigation/workspace-auth.ts` | Wildcard middleware + workspace layout |
| Portfolio creation and management | **EXISTS** | `app/api/workbook/portfolios/route.ts`, `lib/services/portfolio.ts` | Ownership checks |
| Holdings CRUD (add/edit/remove) | **EXISTS** | `app/api/workbook/holdings/*`, `lib/portfolio/use-portfolio-engine.ts` | Engine + workbook |
| Live price fetching | **EXISTS** | `lib/market-data/tiingo.ts`, `lib/market-data/fetch-market-data.ts`, `lib/market-data/index.ts` | Tiingo licensed path; requires `TIINGO_API_KEY` |
| Allocation ring / drift visualization | **PARTIAL** | `components/dashboard/PortfolioCard.tsx`, `lib/allocation/engine.ts` | Horizontal **bar** + drift %; not interactive target ring |
| Composite scoring engine | **EXISTS** | `lib/portfolio/formula-engine.ts`, `lib/allocation/refresh-portfolio-signals.ts`, `lib/portfolio/portfolio-factors.ts` | 10 factors, tests |
| Signal generation (Entry/Hold/Exit) | **EXISTS** | `colAL`/`colAM` in `formula-engine.ts` | RSI + weighted-return thresholds |
| Assumptions tab (factor weights) | **EXISTS** | `app/api/workbook/assumptions/route.ts`, `portfolio-assumptions-store.ts` | Normalization + tests |
| Weekly AI brief (Anthropic) | **EXISTS** | `lib/services/ai.ts`, `app/api/workbook/brief/route.ts`, `portfolio_briefs` table | 24h cooldown + Supabase rate limit |
| Marketplace (browse strategies) | **EXISTS** | `app/(workspace)/marketplace/page.tsx`, leaderboard APIs | Teaser vs full by tier |
| Marketplace (publish strategies) | **EXISTS** | `app/api/marketplace/publish/route.ts` | Intelligence tier |
| Marketplace (import/purchase) | **EXISTS** | `app/api/marketplace/import/route.ts`, Stripe checkout | Ledger default ON |
| Import token ledger | **EXISTS** | `lib/marketplace/import-gate.ts`, `import-token-service.ts`, webhook credits | `!== 'false'` default; legacy rollback path |
| Stripe payment integration | **EXISTS** | `app/api/stripe/*`, webhook signature verify | Subscriptions + marketplace + idempotency |
| Subscription / tier management | **EXISTS** | `lib/services/user-entitlements.ts`, `lib/constants/services.ts` | Beta bundle expansion |
| Crypto asset class support | **PARTIAL** | `lib/market-data/normalize-ticker.ts`, `tiingo.ts` crypto branch | BTC→BTC-USD in main path |
| Sovereign execution (exchange keys) | **PARTIAL** | `lib/execution/*`, `USE_LOCAL_VAULT`, `vault-execution-plane.ts` | Requires local vault deploy |
| Trade proposal engine | **PARTIAL** | `trade_proposals` migration, `approveTradeProposal.ts`, execution queue API | Stub dispatch unless live mode |
| Macro regime intelligence | **PARTIAL** | `lib/intelligence/macro-regime.ts`, macro pages/APIs | **Residual Yahoo** in `macro-correlation-cache.ts` |
| 13F / congressional disclosure data | **EXISTS** | `lib/intelligence/thirteen-f-edgar.ts`, political tracker libs | EDGAR + sentiment UI |
| Leaderboard | **EXISTS** | `app/api/public/leaderboard/route.ts`, materialized view migration | Home preview |
| Family sharing | **PARTIAL** | `app/api/family/*`, family pages | Token-based viewer |
| Governance alerts | **PARTIAL** | `services/watcher/governance-fetcher.ts`, governance APIs | Watcher-dependent |
| DeFi wallet positions | **PARTIAL** | `services/watcher/defi-native-balances.ts`, defi page | RPC sync |
| Options positions | **PARTIAL** | `app/api/options/positions/*` | CRUD, limited analytics |
| Tax lot tracking | **PARTIAL** | `20260605120000_sovereign_sleeve_audit_and_tax_lots.sql`, `addHolding.ts` | Schema + server; thin UI |
| Portfolio drift alerts | **EXISTS** | `services/watcher/drift-detector.ts`, `portfolio_drift_alerts` | Watcher inserts |
| Strategy council (AI monthly memo) | **EXISTS** | `lib/intelligence/strategy-council.ts`, memo PDF route | Valid model IDs |
| Morning brief | **PARTIAL** | `app/api/workbook/morning-brief-context/route.ts` | Context API; not standalone product |
| Scenario simulation | **STUB** | `app/api/scenario-sim/run/route.ts` | Honest **501 FEATURE_COMING_SOON** |
| Marketing site (public pages) | **EXISTS** | `components/home/HomePage.tsx`, `(marketing)/*` | Pricing, legal footer |
| Onboarding flow | **PARTIAL** | `/trial`, `/request-access`, empty states in dashboard | No demo portfolio / wizard |
| Admin / ops tooling | **EXISTS** | `app/(admin)/*`, `app/api/admin/*` | Subscriptions, groups, stats |

**Summary (35 features):** EXISTS 19 (54%) · PARTIAL 14 (40%) · STUB 1 (3%) · ABSENT 1 (3% — interactive allocation ring / guided demo as marketed)

### 1.3 — Technology stack

| Item | Value |
|------|--------|
| Next.js | 15.5.15 |
| React | 19.2.4 |
| TypeScript | ^5, **strict: true** |
| Supabase | `@supabase/ssr` 0.10.2, `@supabase/supabase-js` ^2.103 |
| Stripe | ^17.7.0 |
| Anthropic | `@anthropic-ai/sdk` ^0.89.0 |
| Monitoring | `@sentry/nextjs` ^10.53.1 |
| Market data | Tiingo (`lib/market-data/tiingo.ts`); `yahoo-finance2` still in `package.json` but **not** used in primary price paths |
| Tests | Vitest 4.1.4, CI on GitHub Actions |
| Deploy | Vercel (`output: "standalone"`), Docker for vault/watcher |

### 1.4 — Database schema completeness

| Metric | Estimate |
|--------|----------|
| Migration files | 66 |
| `CREATE TABLE` (sampled migrations) | 25+ explicit; core tables in `20250001*` / `20260501*` batches |
| `ENABLE ROW LEVEL SECURITY` | ~18 migration touchpoints |
| `CREATE POLICY` | ~45+ policy statements |
| RPC functions | `accrue_creator_royalty`, `check_rate_limit`, beta grant, leaderboard refresh, import token spend |

RLS on portfolios, holdings, signals, marketplace, execution (vault), briefs. Service-role paths used after server-side auth (`withAuth`, `requireWorkspaceUser`).

---

## PHASE 2 — DIMENSION SCORING

### DIMENSION 2 — VIABILITY — **7.3/10**

**Score justification:**
- Stripe webhook verifies signatures, idempotent `marketplace_unlocks`, **always** credits import ledger, atomic `accrue_creator_royalty` RPC (`app/api/stripe/webhook/route.ts`, `20260630000001_accrue_creator_royalty_rpc.sql`, `tests/accrue-creator-royalty.test.ts`).
- Import entitlement defaults to ledger (`import-gate.ts`: `MARKETPLACE_USE_IMPORT_LEDGER !== "false"`).
- Tiingo is the sole `getActiveProvider()` path (`lib/market-data/index.ts`, `lib/env.ts`); monetization no longer depends on unlicensed Yahoo for core quotes.
- Sovereign execution remains a **deployment split** (cloud vs `USE_LOCAL_VAULT=true`) — viable but operationally heavy.
- Migrations `20260630000001` and `20260630000002` must be applied in production or royalty accrual / rate limits fail.

**Evidence:**

| Finding | File | Impact |
|---------|------|--------|
| Ledger + unlock on checkout | `webhook/route.ts` L92–100 | + monetization |
| Atomic royalty RPC | `accrue_creator_royalty` migration | + idempotency |
| Tiingo required at startup | `lib/env.ts` L8–15 | + licensed data |
| Vault/cloud matrix | `docs/DEPLOYMENT.md`, `.env.example` | − ops complexity |
| Creator accrual 500 if RPC missing | webhook L82–89 | − deploy discipline |

**Ceiling (→ ~8.8):** Production-verify full Stripe paths in staging; remove legacy dual unlock/ledger transition; automated migration checks in deploy; revenue dashboard for creator payouts.

**Strength:** End-to-end marketplace purchase → ledger credit → import gate with idempotent webhook handling.

**Weakness:** Production depends on applying newer SQL migrations and correct Vercel env (`TIINGO_API_KEY`, Sentry optional) — financial correctness is migration-sensitive.

---

### DIMENSION 3 — FUNCTIONALITY — **7.4/10**

**Score justification:**
- Portfolio MV (`colJ`) and weight (`colD`) are tested (`lib/portfolio/formula-engine.test.ts`); refresh preserves ticker on upsert (`refresh-portfolio-signals.ts`, `defaultToNull: false`).
- CASH fixed at $1 via `cashMarketDataResult` / Tiingo path skip (`fetch-market-data.ts`, `tiingo-provider.ts`).
- Middleware wildcard protects new workspace routes automatically (`middleware.ts` L115–118).
- `withAuth` on consolidated dashboard and ~60 API route files; tier gates on Intelligence features.
- Residual Yahoo in `lib/intelligence/macro-correlation-cache.ts` undermines “all licensed” claim for macro overlay.

**Evidence:**

| Finding | File | Impact |
|---------|------|--------|
| colJ / colD formulas | `formula-engine.ts` L32–41 | + accuracy |
| Tiingo-only fetch | `fetch-market-data.ts` | + compliance |
| Wildcard auth | `middleware.ts` | + security |
| Scenario 501 honest | `scenario-sim/run/route.ts` L92–105 | + honesty, − feature |
| Yahoo in macro cache | `macro-correlation-cache.ts` L15 | − consistency |

**Ceiling (→ ~8.9):** Route macro cache through Tiingo; E2E test signup→portfolio→refresh; staleness UI on engine table; load test 50+ holdings.

**Strength:** Spreadsheet-grade formula engine with Vitest coverage and unified refresh pipeline.

**Weakness:** One remaining Yahoo HTTP path and no E2E proof of full dashboard path under production env.

---

### DIMENSION 4 — FEATURES — **6.8/10**

**Feature inventory summary:**

| Status | Count | % | Weighted importance |
|--------|-------|---|---------------------|
| EXISTS | 19 | 54% | High — engine, auth, marketplace, intelligence pages |
| PARTIAL | 14 | 40% | Medium — execution, DeFi, options, allocation viz |
| STUB | 1 | 3% | Scenario sim |
| ABSENT | 1 | 3% | Interactive ring / demo onboarding |

**Differentiating features:**

| Feature | Implementation | Completeness |
|---------|----------------|--------------|
| Sovereign execution | Vault + encrypted creds + guardrails | ~55% |
| Institutional overlays (13F, political, governance, token) | APIs + pages + fetchers | ~72% |
| Macro regime | Pages + cache (partial Yahoo) | ~60% |
| Strategy Council AI memo | Memo + PDF + fallback | ~78% |
| Import token + royalty marketplace | Stripe + ledger + publish/import | ~75% |

**Score justification:**
- Broad surface (23 workspace routes, 76 API handlers) exceeds typical MVP.
- Engine depth is strong (10 factors, ranks, alerts, assumptions).
- Marketing/about copy still references “allocation ring” while UI shows a bar (`PortfolioCard.tsx`, `about/page.tsx`).
- Scenario sim explicitly gated — good honesty, reduces feature score.
- Many intelligence pages are **breadth-first** (watchlist + overlays) vs depth on each.

**Ceiling (→ ~8.3):** Ship scenario engine or hide nav; interactive target-vs-actual allocation; deepen DeFi/options to parity with engine.

**Strength:** Composite scoring + institutional overlay bundle in one product.

**Weakness:** Breadth exceeds depth on secondary modules (scenario, macro Yahoo stray, allocation viz).

---

### DIMENSION 5 — MARKET / LAUNCH READINESS — **7.2/10**

**Launch blocker inventory:**

| Blocker | Severity | Est. effort |
|---------|----------|-------------|
| Apply migrations `20260630000001`, `20260630000002` on prod Supabase | **HIGH** | 1 day |
| `TIINGO_API_KEY` + `MARKET_DATA_PROVIDER=tiingo` on Vercel | **HIGH** | 1 hour |
| `SENTRY_DSN` (optional but recommended) | MEDIUM | 2 hours |
| Macro correlation still uses Yahoo | MEDIUM | 2–3 days |
| No sample/demo portfolio for cold start | MEDIUM | 3–5 days |

**Score justification:**
- Legal: `/terms`, `/privacy`, `/disclaimer` + workspace banner + `PemabuDisclaimer` (`lib/constants/compliance.ts`, `InvestmentDisclaimerBanner.tsx`).
- Security: wildcard middleware, Stripe webhook signature, Supabase rate limits on import/brief/refresh (`rate-limiter.ts`), tier guards.
- Sentry: client/server/edge configs, workspace `error.tsx`, instrumentation in `withAuth` and AI service.
- Rate limiter **fails open** on DB error (`rate-limiter.ts` L45–46) — availability over strict abuse prevention.
- CI: typecheck, vitest, build, migration presence checks (`.github/workflows/ci.yml`).

**Ceiling (→ ~8.7):** Fail-closed rate limits for paid endpoints; remove last Yahoo caller; penetration test; onboarding demo portfolio.

**Strength:** Hardening sprint materially closed middleware, legal, monitoring, and rate-limit gaps from prior assessment.

**Weakness:** Production readiness still tied to migration + env discipline and one unlicensed data straggler.

---

### DIMENSION 6 — COMPETITIVE ADVANTAGES / MOATS — **6.6/10**

**Moat assessment:**

| Moat type | Strength | Current implementation |
|-----------|----------|------------------------|
| Data / network effects | **Moderate** | Leaderboard, marketplace strategies, portfolio history |
| Technical architecture | **Moderate** | Formula engine + vault execution + ledger marketplace |
| Market positioning | **Moderate** | Self-directed + institutional overlays |
| Regulatory design | **Moderate–Strong** | Disclaimers in product + non-custodial cloud mode |
| Marketplace flywheel | **Partial** | Publish/import/rate; needs liquidity |

**Closest competitors:**

| Competitor | How Pemabu differentiates |
|------------|---------------------------|
| Kubera / Monarch | Quant engine, composite ranks, signals, marketplace sleeves |
| Composer / M1 | Strategy marketplace + sovereign execution option |
| Koyfin / Portfolio Visualizer | Unified overlays (13F, governance, political, token quality) |

**Score justification:**
- Configurable 10-factor engine is defensible if kept proprietary.
- Sovereign vault path is hard to operate but differentiated.
- Marketplace + royalty RPC is a real model, not vapor.
- Moats are **architecture-deep, traction-shallow** until user/strategy density grows.
- Replication estimate: **12–18 engineer-months** for full stack.

**Ceiling (→ ~8.1):** Live marketplace liquidity; proprietary performance dataset; certified vault deployment playbook.

**Strength:** Bundled institutional overlays on a personal quant engine — uncommon combination.

**Weakness:** Moats require users and publishers; technology alone is copyable given funding.

---

## PRIORITY ACTION MATRIX

| Priority | Action | Dimension | Score impact | Effort |
|----------|--------|-----------|------------|--------|
| 1 | Apply `20260630000001` + `20260630000002` to production Supabase | Viability / Launch | +0.4 | S |
| 2 | Verify Vercel env: `TIINGO_API_KEY`, `MARKET_DATA_PROVIDER=tiingo` | Functionality | +0.3 | S |
| 3 | Replace Yahoo in `macro-correlation-cache.ts` with Tiingo | Functionality / Launch | +0.2 | M |
| 4 | Configure `SENTRY_DSN` and verify error capture | Launch | +0.2 | S |
| 5 | E2E test: signup → dashboard → refresh → brief | Functionality | +0.3 | M |
| 6 | Ship scenario engine or hide Scenario Sim nav until ready | Features | +0.2 | M/L |
| 7 | Interactive allocation target vs actual (replace static ring copy) | Features | +0.2 | M |
| 8 | Fail-closed rate limit on import/brief (config flag) | Launch | +0.15 | S |
| 9 | Sample portfolio / onboarding wizard | Launch | +0.2 | M |
| 10 | Remove unused `yahoo-finance2` dependency | Launch | +0.05 | S |

---

## INVESTMENT / LAUNCH DECISION SUMMARY

**Current state in one sentence:**  
Pemabu is a **late-beta allocation intelligence platform** with a working quant engine, licensed Tiingo prices, Stripe + token marketplace, legal/compliance surfaces, and production hardening — but not yet a complete “everything on the tin” institutional workstation.

**Ready for:**  
Private beta and paid Intelligence tier (with migrations applied); portfolio engine; marketplace import tokens; Strategy Council; intelligence overlay pages; controlled public launch with legal pages and disclaimers.

**Not ready for:**  
Mass-market self-serve without onboarding help; scenario simulation marketing claims; unlicensed macro correlation at scale; autonomous live trading without vault ops; claiming interactive “allocation ring” parity with marketing.

**What would change overall score from 7.1 to 8.5+:**  
1. Production DB fully migrated + Tiingo/Sentry env verified on every deploy.  
2. Zero unlicensed market-data callers; scenario sim shipped or removed from nav.  
3. E2E-tested onboarding path and interactive allocation vs targets.

**Estimated time to launch-ready (1 senior full-stack dev):**  
**6–10 weeks** (migrations/env: immediate; macro Tiingo + E2E + allocation UI + scenario or nav: remaining scope).

═══════════════════════════════════════════════════════════════════
End of assessment — read-only; no application code modified except this document.
