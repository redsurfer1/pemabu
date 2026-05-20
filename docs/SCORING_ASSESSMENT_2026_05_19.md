═══════════════════════════════════════════════════════════════════
PEMABU PLATFORM — COMPREHENSIVE SCORING ASSESSMENT (UPDATE)
Assessment date: May 19, 2026
Codebase: PEMABU_PLATFORM_NEW
Assessor: Automated code review (post-audit update)
Baseline: docs/SCORING_ASSESSMENT.md (May 18, 2026, score 6.2/10)
═══════════════════════════════════════════════════════════════════

SCORECARD — CURRENT vs BASELINE
┌─────────────────────────────────┬──────────┬──────────┬────────┬──────────────────────┐
│ Dimension                       │ Previous │ Current  │ Delta  │ Weight → Contribution │
├─────────────────────────────────┼──────────┼──────────┼────────┼──────────────────────┤
│ Overall (weighted composite)    │   6.2    │   7.3    │ +1.1   │ —                    │
├─────────────────────────────────┼──────────┼──────────┼────────┼──────────────────────┤
│ Viability                       │   6.3    │   7.0    │ +0.7   │ 20% → 1.40           │
│ Functionality                   │   6.8    │   7.5    │ +0.7   │ 25% → 1.875          │
│ Features                        │   6.5    │   7.8    │ +1.3   │ 20% → 1.56           │
│ Market / Launch Readiness       │   5.4    │   6.9    │ +1.5   │ 20% → 1.38           │
│ Competitive Advantages / Moats  │   7.0    │   7.5    │ +0.5   │ 15% → 1.125          │
└─────────────────────────────────┴──────────┴──────────┴────────┴──────────────────────┘

WHAT CHANGED

The Allocation Intelligence Audit & Alignment (Phases 0–6) addressed 8 of the 10
priority action items from the baseline assessment. The most impactful changes were:

  1. Five previously-stub workspace pages (defi, governance, options, political-tracker,
     vault-export) now have real client components (372–444 lines each) with tier-gating,
     demo mode, and empty-state handling.
  2. Guided onboarding wizard (OnboardingWizard, 243 lines) with three portfolio archetypes
     (growth / balanced / income) and automatic demo portfolio seeding via auto-onboard
     route — addressing the highest-leverage user acquisition gap from baseline.
  3. Rate limiting deployed across 10+ API routes (marketplace import, portfolio refresh,
     prices, brief generation, strategy council, explain, API key mutations) using a
     Supabase-backed sliding-window RPC (check_rate_limit).
  4. Integration test suite added: 3 new files covering auth→portfolio CRUD, Stripe→
     entitlement, and market-data→allocation pipelines.
  5. AI brief hardened: 24h cooldown (portfolio-level), Supabase-backed rate limit
     (user-level, 3/24h), persistence to portfolio_briefs table with RLS, GET endpoint
     for cached brief retrieval, mandatory disclaimer appended via AI_DISCLAIMER constant.
  6. AI disclaimer post-appended programmatically via PemabuDisclaimer component and
     AI_DISCLAIMER constant (not prompt-only), resolving the compliance gap flagged at
     baseline.
  7. Model IDs confirmed valid: AI_MODELS.PRIMARY = "claude-sonnet-4-20250514",
     AI_MODELS.FAST = "claude-haiku-4-5-20251001" (resolves H6 from audit).
  8. All three critical security gaps closed: auth gated /api/market-data/[ticker],
     /api/prices/current, and /api/prices/historical — previously open Yahoo Finance
     proxies.

Two priority items from the baseline remain unaddressed:
  - Marketplace content seeding (0 published strategies — flywheel still theoretical)
  - AI service degradation fallback (callAnthropic logs errors but still throws;
    no cached/fallback content returned when Anthropic is unavailable)

New regression introduced since baseline:
  - 28 TypeScript errors in integration test files (market-data-allocation.test.ts,
    stripe-payment-flows.test.ts) — these tests reference schema fields that have been
    renamed or restructured (dividend_dollars, score_thirteen_f, last_market_refresh).
    Production code is 0-error; tests are broken and would not pass vitest --run.

═══════════════════════════════════════════════════════════════════

DIMENSION DETAIL

VIABILITY — 7.0/10  (was 6.3/10, +0.7)

Score justification:
- Self-serve subscription upgrade is fully wired: SubscriptionManager component
  (components/subscriptions/SubscriptionManager.tsx:62) calls
  /api/stripe/create-subscription-checkout, and the upgrade page handles
  success/cancelled redirects from Stripe. The pricing page routes authenticated
  users to /upgrade?service=... which completes the funnel. The baseline concern
  about a disconnected CTA is resolved.
- Rate limiting is now deployed on the riskiest routes (marketplace import,
  portfolio refresh, AI generation, prices) using a Supabase-backed RPC rather
  than an in-process Map, meaning it survives serverless cold starts and scales
  across multiple Vercel instances. Profile constants (IMPORT_RATE_LIMIT,
  BRIEF_RATE_LIMIT, PRICES_RATE_LIMIT, AI_RATE_LIMIT, SENSITIVE_RATE_LIMIT)
  are defined in lib/security/rate-limiter.ts and applied consistently.
- Integration tests now cover the three critical paths identified in the baseline:
  auth→portfolio CRUD (tests/integration/auth-portfolio-crud.test.ts),
  Stripe→entitlement (tests/integration/stripe-entitlement.test.ts), and
  market-data→allocation (tests/integration/market-data-allocation.test.ts).
  These are mock-based (not true database E2E), but they test the behavioral
  contracts of the route handlers.
- The vault data plane still requires Docker + local Postgres. No cloud-native
  alternative has been added. This remains the primary deployment barrier.
- 28 TypeScript errors in test files are a regression. The integration tests
  reference Holding fields (dividend_dollars, score_thirteen_f, last_market_refresh,
  score_macro_intelligence, score_governance_layer, score_political_tracker,
  score_token_quality) and TokenCreditParams signatures that no longer match the
  current type definitions. Tests would fail vitest --run.

Evidence:
Finding                                                   File                                              Impact
SubscriptionManager calls /api/stripe/create-checkout     components/subscriptions/SubscriptionManager.tsx:62  +0.4
Supabase-backed rate limiter on 10+ routes                lib/security/rate-limiter.ts, app/api/*/route.ts      +0.4
Integration tests for 3 critical paths                    tests/integration/                                  +0.3
28 TypeScript errors in integration test files            tests/integration/*.test.ts                         -0.4
Vault still requires Docker Postgres                       lib/db.ts:28-49                                     -0.3

Ceiling (what gets this to 8.5):
1. Fix the 28 TypeScript errors in integration test files — align mock shapes to
   current Holding type and TokenCreditParams interface
2. Add true E2E tests with a test Supabase project (not just mocked handlers)
3. Add a cloud-hosted vault option using Supabase Postgres with RLS for execution
4. Implement automated trial-to-paid email reminder sequence
5. Add an admin subscription metrics dashboard

Strength: The payment infrastructure is production-grade and the self-serve upgrade
flow is now fully connected. Rate limiting protects all AI-powered and price-fetch
endpoints with a persistent Supabase-backed counter.

Weakness: The integration test suite is newly added but type-broken. It cannot pass
vitest --run in the current state, which means the coverage it adds is theoretical.
Fixing the 28 type errors would restore its protective value.

FUNCTIONALITY — 7.5/10  (was 6.8/10, +0.7)

Score justification:
- The nightly refresh cron is paginated with PAGE_SIZE = 500
  (app/api/cron/nightly-refresh/route.ts:18) — the baseline flagged unbounded
  batch-fetch as a scalability concern, but the code already implements pagination.
  This was a false positive in the baseline assessment; the correct score at the
  time should have been ~7.0. The actual implementation was already sound.
- The weekly brief cron similarly paginates with PAGE_SIZE = 500
  (app/api/cron/weekly-brief/route.ts, do-while pattern). At 100+ portfolios,
  these crons will process correctly without timeout or OOM.
- AI interaction logging is now wired: every callAnthropic invocation records
  feature, model, latency, prompt preview, and response preview via logAiInteraction,
  giving operational visibility into AI usage patterns. Sentry withCronSentry wraps
  all cron handlers with span tracking and error capture.
- Portfolio brief is fully hardened: GET returns the cached brief with nextAvailableMs,
  POST enforces 24h per-portfolio cooldown AND a Supabase-backed 3/24h user-level rate
  limit, persists to portfolio_briefs, and returns the brief with cached/nextAvailableMs
  metadata.
- isPriceStale() utility is available (lib/market-data/types.ts) but not yet surfaced
  in any UI component to show staleness indicators to users.
- The AI service still has no degradation fallback. When Anthropic is unavailable,
  callAnthropic throws — the cron job wraps per-portfolio in try/catch (so failures
  do not halt the batch), but no cached/fallback brief text is returned to the user
  from the API route. Users would receive a 500 error.
- Morning brief cron is implemented (app/api/cron/morning-brief/route.ts) and the
  MorningBriefCard component (components/brief/MorningBriefCard.tsx, 130 lines) exists.

Evidence:
Finding                                                   File                                              Impact
Nightly refresh paginated (PAGE_SIZE=500)                  app/api/cron/nightly-refresh/route.ts:18           +0.3
callAnthropic latency + error logging to AI logger         lib/services/ai.ts:16-60                           +0.2
Portfolio brief has cooldown + rate limit + persistence    app/api/workbook/brief/route.ts                    +0.3
isPriceStale utility available but not surfaced in UI      lib/market-data/types.ts:58-64                     +0.0
AI service throws on Anthropic outage, no fallback         lib/services/ai.ts:44-60                           -0.1

Ceiling (what gets this to 8.5):
1. Add AI service degradation fallback: when Anthropic is down, return most-recent
   portfolio_briefs row with a "cached from [date]" notice (API route already reads this)
2. Surface isPriceStale in the holdings table — show a staleness indicator badge when
   last_refreshed is > 8 hours old
3. Add loading progress indicators during the 202 async refresh (currently opacity-only)
4. Implement scenario simulation engine logic (ScenarioSimClient exists with 251 lines
   but the underlying simulation math needs verification)

Strength: The cron infrastructure is well-hardened — paginated, Sentry-instrumented,
per-item try/catch with operator alerting, and the rate limiter survives cold starts.

Weakness: The AI pathway has no graceful degradation. A Supabase RPC failure for rate
limiting fails-open (good), but an Anthropic API failure surfaces as a 500 to the user.
The portfolio_briefs table already contains the data needed for a fallback — it just
needs to be used.

FEATURES — 7.8/10  (was 6.5/10, +1.3)

Feature inventory summary (updated):
Status                     Count   % of total   Notes
EXISTS (fully implemented)  23      70%          +8 since baseline
PARTIAL (implemented)        5      15%          -3 since baseline
STUB (UI skeleton)           0       0%          all stubs resolved
ABSENT                       5      15%          marketplace content, AI fallback, etc.

Detailed changes from baseline:
| Feature | Previous | Current | Primary files |
|---------|----------|---------|--------------|
| DeFi wallet positions | STUB | EXISTS | components/defi/DefiClient.tsx (435 lines), tier-gated, demo mode |
| Governance alerts | PARTIAL | EXISTS | components/governance/GovernanceClient.tsx (444 lines), Snapshot integration, demo mode |
| Options positions | STUB | EXISTS | components/options/OptionsOverlayClient.tsx (372 lines), tier-gated |
| Political tracker | STUB | EXISTS | components/political-tracker/PoliticalTrackerClient.tsx (194 lines) |
| Vault export | STUB | EXISTS | components/vault-export/VaultExportClient.tsx (206 lines), S3/cloud config |
| Scenario simulation | PARTIAL | PARTIAL | ScenarioSimClient (251 lines), simulation math TBD |
| Onboarding flow | PARTIAL | EXISTS | OnboardingWizard (243 lines), 3 portfolio types, auto-onboard route |
| Morning brief | PARTIAL | EXISTS | morning-brief cron, MorningBriefCard (130 lines) |
| 10-factor assumptions panel | PARTIAL | EXISTS | AssumptionsPanel refactored with FACTOR_WEIGHT_KEYS, FACTOR_LABELS |
| AI brief (Phase 5) | PARTIAL | EXISTS | portfolio_briefs table, 24h cooldown, rate limit, GET+POST |

New features added (not in baseline inventory):
| Feature | Status | Primary files |
|---------|--------|--------------|
| Demo portfolio seeding | EXISTS | lib/demo/seed-demo-portfolio.ts, app/api/workbook/auto-onboard |
| Onboarding tour hook | EXISTS | hooks/useOnboardingTour.ts (73 lines), components/onboarding/OnboardingTour.tsx |
| Portfolio brief persistence | EXISTS | portfolio_briefs migration, RLS, GET /api/workbook/brief |
| Rate limiting (Supabase-backed) | EXISTS | lib/security/rate-limiter.ts, 6 named profiles |
| AI interaction logger | EXISTS | lib/services/ai-logger.ts, every callAnthropic call |

Score justification:
- The feature count has jumped from 15/33 fully implemented to 23/33. The five
  previously-stub workspace pages (defi, governance, options, political-tracker,
  vault-export) are now real components — each has tier-gating, demo mode via
  isDemoRequest(), empty-state handling using the shared EmptyState component,
  and 190–444 lines of actual UI logic.
- The OnboardingWizard resolves the largest UX gap from baseline: new users can
  choose a portfolio archetype (growth/balanced/income) and have a pre-seeded demo
  portfolio created via auto-onboard, eliminating the "No portfolios found" cold start.
- The remaining PARTIAL features (scenario simulation, family sharing deep logic,
  admin ops completeness) are structural — they have UI and API surface but the
  underlying domain logic needs verification.
- The ABSENT items are all content/community or non-code: marketplace strategy seeds,
  AI fallback content, a public API documentation page, a creator royalty dashboard.

Ceiling (what gets this to 9.0):
1. Seed the marketplace with 10+ published strategies to start the flywheel
2. Verify and complete the scenario simulation math in ScenarioSimClient
3. Build a creator dashboard with royalty analytics and payout history
4. Build performance tracking for published marketplace strategies (leaderboard track record)
5. Complete the family sharing deep logic (permissions, view propagation)

Strength: The feature completeness jump from 45% to 70% is substantial. All five
formerly-stub workspace pages are now genuinely functional, and the onboarding
wizard directly addresses the most visible user acquisition bottleneck.

Weakness: The marketplace flywheel has not started. All network-effect features are
complete on the supply and demand side, but zero published strategies means the
platform has no social proof, no leaderboard content, and no creator economics
at work. This is a content/community problem, not a code problem.

MARKET / LAUNCH READINESS — 6.9/10  (was 5.4/10, +1.5)

Launch blocker inventory (updated):
Blocker                                                              Severity   Status
28 TypeScript errors in integration test files                        HIGH      NEW — unresolved
AI service no fallback on Anthropic outage                            MEDIUM    unchanged
Marketplace has 0 published strategies                                MEDIUM    unchanged
No global-error.js for Sentry React render errors                     LOW       NEW (Sentry warns)
pricing page has no direct checkout CTA (routes to workspace)         LOW       partially resolved

Resolved since baseline:
Item                                                                   Resolution
No rate limiting on price refresh or AI generation                    ✓ checkRateLimit on 10+ routes
Multi-table RLS — at least 5 tables missing RLS                       ✓ 60 ENABLE ROW LEVEL SECURITY calls; marketplace RLS audit migration
No empty states on most workspace pages                               ✓ EmptyState, DataFetchBoundary used across all workspace pages
Limited test coverage — no integration tests for payment flows        ✓ 3 integration test files (mocked)
Onboarding: no guided tour, no sample portfolio                       ✓ OnboardingWizard + auto-onboard + demo seed
AI disclaimers prompt-only                                            ✓ AI_DISCLAIMER constant post-appended; PemabuDisclaimer component
H6: Model ID validity uncertain                                       ✓ AI_MODELS constants confirmed valid model IDs

Score justification:
- Rate limiting is now the most improved axis. The baseline flagged "no rate limiting
  on any endpoint" as a -0.3 penalty. The current implementation covers the highest-risk
  routes with named profiles and a Supabase-backed counter that persists across cold
  starts. The remaining unprotected routes (e.g. standard portfolio reads) have low
  abuse risk given the withAuth gate.
- Empty states and error boundaries are systematically applied. The shared
  components/shared/ directory has EmptyState, ErrorBoundaryClient, ErrorState,
  LoadingState, and DataFetchBoundary. All five formerly-stub workspace pages use
  DataFetchBoundary. The DashboardClient shows OnboardingWizard when portfolioCount
  === 0, resolving the cold-start UX gap.
- RLS coverage is significantly improved. 60 ENABLE ROW LEVEL SECURITY calls across
  migrations and a dedicated marketplace RLS audit migration address the multi-table
  gap. portfolio_briefs (new table) has correct owner-only policies.
- AI disclaimer compliance is now post-processing, not prompt-only. The AI_DISCLAIMER
  constant is appended in lib/governance/governance-summariser.ts:31. The
  PemabuDisclaimer component appears in PortfolioBriefPanel, marketplace pages, and
  strategy council output. The baseline concern about "could be omitted if the model
  doesn't follow instructions" is resolved.
- The 28 TypeScript errors in test files are a new regression. The integration tests
  use Holding mock shapes that reference fields removed or renamed in the current
  schema (score_thirteen_f, score_macro_intelligence, dividend_dollars). These tests
  are broken and do not protect the paths they claim to cover until fixed.
- The global-error.js for Sentry React render errors is missing (Sentry warns in
  build output). This is a LOW severity gap — React rendering errors in the workspace
  would not be captured in Sentry.

Evidence:
Finding                                                   File                                              Impact
Rate limiting on 10+ routes (Supabase-backed)             lib/security/rate-limiter.ts, app/api/*/route.ts   +0.4
Empty states + error boundaries across workspace           components/shared/, DataFetchBoundary usage        +0.4
60 RLS enablements + marketplace audit migration           supabase/migrations/                               +0.4
AI disclaimer post-appended (not prompt-only)              AI_DISCLAIMER constant, PemabuDisclaimer           +0.2
OnboardingWizard + auto-onboard demo seeding               OnboardingWizard.tsx, auto-onboard/route.ts        +0.4
28 TS errors in integration test files                     tests/integration/                                 -0.3
No global-error.js for Sentry                              (Sentry build warning)                             -0.1

Ceiling (what gets this to 8.5):
1. Fix 28 TypeScript errors in integration test files to restore coverage
2. Add AI service fallback: return cached brief from portfolio_briefs when Anthropic is down
3. Add global-error.js with Sentry instrumentation for React rendering errors
4. Seed marketplace with 10+ strategies to provide social proof and real launch content
5. Add performance monitoring dashboards (Sentry performance tracing is wired; add
   custom dashboards for P95 latency on AI routes and cron duration)

Strength: The platform has gone from "critical security gaps and no safety nets" to
a defensible posture: all AI-powered endpoints are rate-limited, all tables with user
data have RLS, onboarding is guided, and disclaimers are applied at the component layer.

Weakness: The integration tests are type-broken. The test coverage improvement is
real in intent but cannot execute. A one-hour schema alignment pass on the mock fixtures
would restore full test value.

COMPETITIVE ADVANTAGES / MOATS — 7.5/10  (was 7.0/10, +0.5)

Moat assessment (changes from baseline):
Moat type                       Previous   Current   Evidence of change
Data / network effects           Moderate   Moderate  Unchanged — marketplace still 0 strategies
Technical architecture           Strong     Strong    AssumptionsPanel now exposes all 10 factors
Market positioning               Moderate   Moderate  Onboarding now matches positioning claims
Regulatory design                Strong     Strong    AI_DISCLAIMER constant + PemabuDisclaimer
Marketplace flywheel             Partial    Partial   Code complete; no content

Score justification:
- The 10-factor composite scoring engine is now fully exposed in the UI. The refactored
  AssumptionsPanel (using FACTOR_WEIGHT_KEYS and FACTOR_LABELS from portfolio-factors.ts)
  lets users tune all 10 factors: expense ratio, target allocation %, blended return,
  dividend yield/APY, volatility matrix, 13F institutional flow, macro regime alignment,
  governance robustness, political/regulatory risk, and token/asset quality. This is a
  genuine competitive differentiator — no consumer fintech product exposes a
  user-configurable 10-factor institutional scoring model.
- All five intelligence overlay features (defi, governance, options, political-tracker,
  token-quality) are now implemented, converting the "theoretical moat" claim into a
  demonstrable product. A competitive analysis can now show real screens for each
  institutional overlay rather than placeholders.
- The onboarding flow (wizard + demo portfolio) means the value proposition is
  immediately demonstrable. A technical early adopter can now see the 10-factor engine,
  the institutional overlays, and the macro regime alignment on a pre-seeded balanced
  portfolio within minutes of signup.
- The marketplace flywheel has not advanced. The leaderboard still shows 0 strategies.
  All the infrastructure for publisher royalties, atomic RPC spend, and strategy import
  is complete, but without seed content the competitive advantage of the marketplace
  model remains theoretical to any user who tries it.

Evidence:
Finding                                                   File                                              Impact
All 10 factors exposed in AssumptionsPanel                 AssumptionsPanel.tsx (FACTOR_WEIGHT_KEYS)          +0.3
5 intelligence overlays now functional                     defi, governance, options, political, vault        +0.3
Demo portfolio makes value prop immediately demonstrable   OnboardingWizard + seed-demo-portfolio.ts          +0.2
Marketplace has 0 published strategies                     (content gap)                                      -0.3

Ceiling (what gets this to 9.0):
1. Seed marketplace with founder-published strategies to start the flywheel
2. Build creator dashboard with royalty history and performance analytics
3. Add strategy performance tracking (real track record on leaderboard, not just score)
4. Launch a public developer API with documentation — programmatic strategy import
   creates a distribution channel (hedge funds, robo-advisor integrations)
5. Build community features: strategy reviews, discussion threads, follow/watchlist

Strength: The technical moat deepened. A user who opens the Assumptions panel now
interacts with all 10 institutional factors — including 13F flow, macro regime
alignment, and token quality — with real-time recomputation. This experience is
not replicable by any consumer-facing competitor.

Weakness: The network-effect moat is still zero. The marketplace infrastructure is
production-ready but the content vacuum means the flywheel produces no momentum.

═══════════════════════════════════════════════════════════════════

PRIORITY ACTION MATRIX (UPDATED)

Items resolved since baseline (removed from matrix):
✓ Add empty states + error boundaries — DONE
✓ Implement rate limiting on user-facing endpoints — DONE
✓ Add integration tests for payment + auth — DONE (mocked)
✓ Post-pend AI disclaimer programmatically — DONE
✓ Paginate nightly refresh cron — WAS ALREADY DONE (baseline false positive)
✓ Build guided onboarding wizard — DONE
✓ Implement stub workspace pages — DONE
✓ Write RLS audit and fix gaps — DONE

Updated priority matrix (ordered by score improvement per effort):
Priority  Action                                                         Dimension         Impact  Effort
1         Fix 28 TS errors in integration test files                     Viability         +0.3    XS (1-2h)
2         Seed marketplace with 10+ published strategies                  Competitive+Launch +0.6   S (1d)
3         Add AI service fallback (return cached brief on Anthropic down) Functionality     +0.3    S (2-4h)
4         Add global-error.js for Sentry React render capture             Launch Readiness  +0.1    XS (30m)
5         Verify + complete scenario simulation math                      Features          +0.2    M (1w)
6         Build creator royalty dashboard                                 Competitive       +0.3    M (1w)
7         Add strategy performance tracking on leaderboard                Competitive       +0.4    M (2w)
8         Add true E2E tests with a test Supabase project                 Viability         +0.4    L (3w)
9         Add cloud-hosted vault option for Supabase Postgres             Viability         +0.4    L (3-4w)
10        Surface isPriceStale indicators in holdings table               Functionality     +0.1    S (2-4h)

═══════════════════════════════════════════════════════════════════

INVESTMENT / LAUNCH DECISION SUMMARY

Previous state (May 18): Architecturally ambitious beta with functional core, ~40%
stub features, thin test coverage, no onboarding.

Current state (May 19): Production-defensible platform with comprehensive feature
coverage, hardened security posture, and a guided onboarding path. The critical gaps
from baseline assessment have been systematically addressed in a single development
session.

Ready for (updated):
- Technical early adopters and beta users — the onboarding wizard gives them a
  working demo portfolio within minutes, no manual setup required
- Security-conscious early adopters — RLS, rate limiting, auth gates, and RLS-audited
  tables make the data plane defensible
- Investor demonstrations — all 10 institutional overlays are functional and
  demonstrable; the full value proposition is now visible on screen
- Limited public beta — the platform is substantially more complete than at baseline

Not yet ready for:
- Mainstream consumer launch — marketplace has no content; social proof is zero
- Scale launch — integration tests are type-broken; true E2E coverage is missing
- Exchange execution — EXECUTION_LIVE_MODE still false; paper trading not integrated
- Heavy AI feature usage — Anthropic outage would return 500 errors to users

What would push the score to 9.0+:
The platform is now primarily blocked by content (marketplace seeds), community
(ratings/reviews/discussion), and one remaining infrastructure gap (AI fallback).
The code is ahead of the content. Shipping 10+ high-quality strategies, fixing
the 28 test type errors, and adding the AI fallback path would put the score at
8.5+. Adding a cloud vault option would push it to 9.0.

Estimated time to mainstream-launch-ready (assuming 1 senior full-stack dev):
3–5 weeks (down from 10–14 weeks at baseline).
- 0.5 day: Fix 28 TS errors in integration tests
- 0.5 day: AI fallback + global-error.js
- 1 week:  Marketplace seeding + creator dashboard
- 1 week:  Strategy performance tracking + community features
- 1–2 weeks: True E2E test suite with test Supabase
- 0.5–1 week: Cloud vault option prototype

═══════════════════════════════════════════════════════════════════
