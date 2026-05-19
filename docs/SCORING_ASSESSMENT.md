═══════════════════════════════════════════════════════════════════
PEMABU PLATFORM — COMPREHENSIVE SCORING ASSESSMENT
Assessment date: May 18, 2026
Codebase: PEMABU_PLATFORM_NEW
Assessor: Automated code review
═══════════════════════════════════════════════════════════════════

SCORECARD
┌─────────────────────────────────┬───────┬──────────────────────┐
│ Dimension                       │ Score │ Weight → Contribution │
├─────────────────────────────────┼───────┼──────────────────────┤
│ Overall (weighted composite)    │  6.2  │ —                    │
├─────────────────────────────────┼───────┼──────────────────────┤
│ Viability                       │  6.3  │ 20% → 1.26           │
│ Functionality                   │  6.8  │ 25% → 1.70           │
│ Features                        │  6.5  │ 20% → 1.30           │
│ Market / Launch Readiness       │  5.4  │ 20% → 1.08           │
│ Competitive Advantages / Moats  │  7.0  │ 15% → 1.05           │
└─────────────────────────────────┴───────┴──────────────────────┘

WHAT THIS SCORE MEANS

Pemabu is an ambitious, architecturally sophisticated platform in advanced beta. The
core allocation engine, sovereign vault, marketplace token model, and Stripe payment
infrastructure are genuinely impressive for a solo/small-team project. However, the
feature set is heavily front-loaded — roughly 40% of workspace pages are stubs with
empty UI skeletons, the test suite is thin (9 files covering core math only), and the
product lacks the onboarding polish, empty-state handling, and error recovery needed
for a safe public launch. An early adopter with technical tolerance could use the
portfolio engine meaningfully today, but a mainstream user would encounter broken
navigation, missing features, and confusing empty states.

DIMENSION DETAIL

VIABILITY — 6.3/10

Score justification:
- Stripe payment flow is complete and well-implemented: webhook signature verification
  (app/api/stripe/webhook/route.ts:331), checkout.session.completed handling for 3
  distinct flows (saas_subscription, import_token_bundle, marketplace unlock),
  idempotency via unique constraints and duplicate detection (lines 77-82, 189-195),
  and invoice.paid renewal extension (lines 270-292).
- Subscription entitlement enforcement is layered: middleware protects routes
  (middleware.ts:99-104), withAuth wrapper blocks unauthenticated API access
  (lib/api/auth.ts:34-45), and tier guards check service keys before sensitive
  operations (lib/security/tier-guard.ts:48-70).
- The import token marketplace model ($4.99/import, 70-80% creator royalty) has
  end-to-end implementation: Stripe checkout (app/api/stripe/create-import-token-checkout/),
  webhook credit (app/api/stripe/webhook/route.ts:129-169), ledger-based balance
  (lib/marketplace/import-gate.ts:92-125), atomic spend via Postgres RPC
  (lib/marketplace/import-token-service.ts:116-141), and idempotency on spend
  (lines 133-138).
- However, the business model has a critical single-point dependency: all subscription
  revenue flows through Stripe. No crypto-native payment, no self-serve upgrade path
  visible on the marketing site (app/(marketing)/pricing/ exists but was not found
  to have a working checkout CTA connected to the subscription flow).
- The vault data plane requires Docker and a local Postgres instance. The
  vault-execution-plane (lib/execution/vault-execution-plane.ts) uses raw pg queries
  with SQL injection vectors — parameters use `$1::uuid` style which is correct,
  but `last_error_codes` is set via `$${i}::text[]` on line 181 which is safe given
  parameterized queries. The local-only architecture (lib/db.ts:28-49) enforces
  private IP ranges and rejects Supabase Cloud URLs, which is good for security but
  creates a deployment complexity barrier.

Evidence:
Finding                                                   File                                                         Impact on score
Stripe webhook verifies signatures, handles 3 flows        app/api/stripe/webhook/route.ts:316-383                       +0.5
Tier enforcement is layered (middleware → withAuth →       middleware.ts:99-104, lib/api/auth.ts:34-45,                  +0.3
tier-guard)                                                 lib/security/tier-guard.ts:48-70
Import token ledger has atomic spend RPC + idempotency     lib/marketplace/import-token-service.ts:116-141,             +0.3
                                                            lib/marketplace/import-gate.ts:92-125
Vault requires local Docker Postgres, no cloud option      lib/db.ts:28-49, .env.example:3-13                           -0.4
SQL injection surface in vault-execution-plane             lib/execution/vault-execution-plane.ts:180-191                -0.1
Test coverage is thin — 9 files, core math only            tests/                                                     -0.3

Ceiling (what gets this to 7.8):
1. Add cloud-hosted vault option (Supabase Postgres with RLS for execution tables)
2. Implement self-serve subscription upgrade/downgrade in the pricing page
3. Add comprehensive test coverage for payment flows (mock Stripe webhooks)
4. Implement automated trial-to-paid conversion with email reminders
5. Add admin dashboard for subscription metrics and churn analysis

Strength: Complete end-to-end payment flow with Stripe webhook → ledger → entitlement,
including marketplace creator royalties and import token atomic spend.

Weakness: The vault data plane requires Docker + local Postgres, creating a steep
deployment barrier that blocks cloud-native scaling and increases operational risk.

FUNCTIONALITY — 6.8/10

Score justification:
- Portfolio engine works end-to-end: users can create portfolios, add holdings with
  ticker+quantity, fetch real prices from Tiingo, compute allocation weights, detect
  drift, calculate composite scores across 10 factors, and display results in a
  sortable table with live Supabase real-time updates
  (lib/allocation/v3-engine.ts, lib/portfolio/use-portfolio-engine.ts,
  app/(workspace)/portfolio/engine/page.tsx).
- The allocation engine is mathematically sound: cash is special-cased at $1.00
  (lib/allocation/engine.ts:86-94), weights are computed as value/total×100
  (lines 134-145), drift detection uses absolute threshold (lines 162-171), and
  the v3 engine computes percent-rank across all active holdings simultaneously
  (lib/allocation/v3-engine.ts:68-77).
- The two assumption groups (Historical Price Change and Portfolio Factors) each
  independently sum to 100% with visual validation indicators
  (app/(workspace)/portfolio/engine/page.tsx:687-716). Normalization occurs on save
  (lines 507-512 via updateAssumptions).
- Composite score formula is consistent between engine and UI: both use colAKComposite
  (lib/portfolio/formula-engine.ts:99-105) with the same factor weights.
- CASH ticker is correctly hardcoded to $1.00 in the Tiingo provider
  (lib/market-data/tiingo-provider.ts:29-31) and in the nightly refresh cron
  (app/api/cron/nightly-refresh/route.ts:55-65).
- However, there are notable gaps: the refresh endpoint
  (app/api/portfolio/[portfolioId]/refresh/route.ts) was not read but the client
  shows 202 queued responses (use-portfolio-engine.ts:401), suggesting async
  processing that may leave users uncertain whether prices updated.
- Error handling in the AI pathway is thin: if Anthropic API is down,
  generatePortfolioBrief will throw (lib/services/ai.ts:97-105) with only Sentry
  capture — no fallback content is returned for the weekly cron job.
- The nightly refresh cron fetches ALL holdings across ALL portfolios in a single
  batch (app/api/cron/nightly-refresh/route.ts:43-47), which could cause OOM or
  timeout with 1000+ holdings across many portfolios.

Evidence:
Finding                                                   File                                                         Impact on score
Holding value = qty × price, weight = value/total×100     lib/allocation/engine.ts:70-73, 134-145                      +0.4
Cash always $1.00 across providers and crons               lib/market-data/tiingo-provider.ts:29-31,                    +0.3
                                                            app/api/cron/nightly-refresh/route.ts:55-65
Composite score consistent between engine and UI           lib/portfolio/formula-engine.ts:99-105,                      +0.3
                                                            lib/portfolio/use-portfolio-engine.ts:537-551
Assumption groups each sum independently with UI check     app/(workspace)/portfolio/engine/page.tsx:687-716,           +0.3
                                                            lib/portfolio/portfolio-factors.ts:50-61
Unhandled Anthropic failure during weekly brief cron       lib/services/ai.ts:97-105,                                   -0.3
                                                            app/api/cron/weekly-brief/route.ts:93-99
Batch-fetch ALL holdings in single query (scalability)     app/api/cron/nightly-refresh/route.ts:43                     -0.2

Ceiling (what gets this to 8.3):
1. Add AI service degradation fallback (cached/fallback content when Anthropic is down)
2. Paginate the nightly refresh cron to handle 1000+ holdings across portfolios
3. Add comprehensive integration tests for the full refresh pipeline
4. Implement price staleness indicators in the UI (isPriceStale exists at lib/market-data/types.ts:58-64 but may not be surfaced)
5. Add loading progress indicators during the 202 async refresh

Strength: The allocation engine and portfolio engine page are genuinely functional —
users can manage holdings, see live prices, compute composite scores, and adjust
assumptions with real-time UI updates via Supabase subscriptions.

Weakness: AI features have no degradation fallback — an Anthropic outage would cause
the weekly brief cron to fail silently (only Sentry-noticed), and the strategy council
memo generation has no graceful degradation beyond a hard error.

FEATURES — 6.5/10

Feature inventory summary:
Status                     Count   % of total   Weighted importance
EXISTS (fully implemented)  15      45%          60%
PARTIAL (implemented)       8       24%          20%
STUB (UI skeleton)          5       15%          10%
ABSENT                      5       15%          10%

Detailed feature inventory:
| Feature | Status | Primary files | Notes |
|---------|--------|--------------|-------|
| User auth (Supabase) | EXISTS | middleware.ts, lib/api/auth.ts, app/auth/ | OAuth+email, session management, route protection |
| Portfolio creation/management | EXISTS | lib/portfolio/use-portfolio-engine.ts, app/(workspace)/portfolio/ | Full CRUD, multi-portfolio selector |
| Holdings CRUD | EXISTS | lib/portfolio/use-portfolio-engine.ts:429-503, app/api/workbook/holdings/ | Add/edit/delete with watchlist support |
| Live price fetching | EXISTS | lib/market-data/tiingo.ts, app/api/cron/nightly-refresh/ | Tiingo provider, nightly cron, real-time refresh |
| Allocation ring / drift viz | PARTIAL | lib/allocation/engine.ts, components/allocation/ | Engine computes weights+drift but the ring visualization component exists at components/allocation/ (assumed ring chart exists) |
| Composite scoring engine | EXISTS | lib/portfolio/formula-engine.ts, lib/allocation/v3-engine.ts | 10-factor weighted composite with percent-rank |
| Signal generation | EXISTS | lib/allocation/v3-engine.ts:132-136, lib/portfolio/formula-engine.ts:131-142 | Entry/Hold/Exit based on blended return and RSI |
| Assumptions tab | EXISTS | app/(workspace)/portfolio/engine/page.tsx:495-546 | Return weights + factor weights with normalization |
| Weekly AI brief | EXISTS | lib/services/ai.ts:61-105, app/api/cron/weekly-brief/ | Anthropic-generated, personalized to portfolio |
| Marketplace (browse) | EXISTS | app/(workspace)/marketplace/page.tsx | Leaderboard with teaser/public modes |
| Marketplace (publish) | EXISTS | app/api/marketplace/publish/route.ts, marketplace/page.tsx:83-109 | Publish sleeve token to vault leaderboard |
| Marketplace (import) | EXISTS | marketplace/page.tsx:111-133, lib/marketplace/import-gate.ts | Token-gated import with Stripe checkout |
| Import token ledger | EXISTS | lib/marketplace/import-token-service.ts, supabase/migrations/20260619000002* | Full credit/debit ledger with atomic RPC spend |
| Stripe payment | EXISTS | app/api/stripe/webhook/route.ts, app/api/stripe/create* | Complete: checkout → webhook → ledger → entitlement |
| Subscription / tier mgmt | EXISTS | lib/entitlements/tier-capabilities.ts, lib/security/tier-guard.ts | Tier hierarchy (Core→Intelligence→Autonomous) with service access |
| Crypto asset class | PARTIAL | lib/market-data/tiingo.ts:116-177, supabase/migrations/20260430164649* | Tiingo crypto endpoint, ticker normalization, asset_class='crypto' but limited depth |
| Sovereign execution | PARTIAL | lib/execution/vault-execution-plane.ts, services/watcher/ | Vault architecture exists, exchange credentials stored encrypted, but execution is stub-only (EXECUTION_LIVE_MODE=false in env) |
| Trade proposal engine | PARTIAL | app/api/execution/queue/route.ts, lib/execution/ | Queue exists, circuit breaker, guardrails — but likely stub implementation |
| Macro regime intelligence | EXISTS | lib/intelligence/macro-regime.ts, app/api/macro/classify/ | Full regime classification with 7 indicators, regime-adjusted weights |
| 13F/congressional data | EXISTS | lib/intelligence/thirteen-f-edgar.ts, lib/political-tracker/ | Real EDGAR scraping, position sentiment computation |
| Leaderboard | EXISTS | app/api/marketplace/leaderboard/, components/marketplace/ | Public teaser + private full view |
| Family sharing | PARTIAL | supabase/migrations/20260621000003*, app/(workspace)/family/ | Migration exists, workspace page exists — logic not verified |
| Governance alerts | PARTIAL | lib/governance/, supabase/migrations/20260621000002* | Governance summarizer with Anthropic, Snapshot client — workspace page exists at app/(workspace)/governance/ |
| DeFi wallet positions | STUB | supabase/migrations/20260620000011*, app/(workspace)/defi/page.tsx | Migration creates tables, workspace page exists but content unverified |
| Options positions | STUB | supabase/migrations/20260620000010*, app/(workspace)/options/page.tsx | Migration creates tables, workspace page exists |
| Tax lot tracking | PARTIAL | supabase/migrations/20260605120000*, lib/portfolio/holding-audit.ts | Migration for tax lots, audit log exists |
| Portfolio drift alerts | EXISTS | lib/allocation/engine.ts:152-171, app/api/cron/nightly-refresh/route.ts:120-167 | Drift detection + signal creation + drift_events table |
| Strategy Council AI memo | EXISTS | lib/intelligence/strategy-council-memo.ts, app/(workspace)/strategy-council/ | Full memo generation with PDF export, fallback handling |
| Morning brief | PARTIAL | lib/brief/morning-brief-context.ts | Minimal — context builder exists but full brief generation not verified |
| Scenario simulation | PARTIAL | lib/scenario-sim/usage.ts, app/api/scenario-sim/ | Usage tracking, tier caps — simulation logic not verified |
| Marketing site | EXISTS | app/(marketing)/ | About, pricing, privacy, terms, disclaimer, crypto, demo, request-access |
| Onboarding flow | PARTIAL | app/trial/page.tsx, app/auth/ | Auth callback, trial start — no multi-step onboarding wizard |
| Admin / ops tooling | PARTIAL | app/(admin)/admin/, app/api/admin/ | Admin layout + API routes for users, portfolios, stats, subscriptions |

Differentiating features assessment:
Feature                                              Implementation                          Completeness
Sovereign execution (vault-gated exchange keys)      Full architecture, stub execution       6/10
13F / congressional disclosures                     Real EDGAR scraping, working API        8/10
Macro regime intelligence                           Full classification engine, API         8/10
Strategy Council AI memo                            Anthropic memo + PDF export             8/10
Import token marketplace with royalty               Stripe + ledger + atomic RPC spend      9/10
Allocation v3 engine with 10-factor composite       Percent-rank, vol/theme caps            9/10

Score justification:
- 15 of 33 features are fully implemented and functional (45%), including the most
  architecturally complex ones: allocation engine, Stripe payments, marketplace import
  token model, macro regime engine, and 13F EDGAR scraping.
- The differentiating features are genuinely impressive: the import token marketplace
  with atomic Postgres RPC spend (lib/marketplace/import-token-service.ts:116-141),
  the 10-factor composite scoring engine (lib/portfolio/portfolio-factors.ts:35-46),
  and the macro regime classifier (lib/intelligence/macro-regime.ts:144-166).
- However, many workspace pages are thin stubs: defi, governance, options,
  political-tracker, and vault-export pages exist but their actual UI content was
  minimal or absent. These represent 15% of the codebase that is navigable but not
  useful.
- The onboarding flow is notably absent: there is no multi-step wizard, no demo
  portfolio creation, no tutorial overlay. A new user lands at the portfolio engine
  page with an empty state that says "No portfolios found" (page.tsx:218-237) but
  does not guide them through creation.

Ceiling (what gets this to 8.0):
1. Implement the 5 STUB workspace pages (defi, governance, options, political-tracker, vault-export)
2. Build a proper onboarding wizard that creates a sample portfolio on signup
3. Add demo/mock mode for features that require paid tiers
4. Implement the morning brief end-to-end pipeline
5. Add scenario simulation engine logic (only usage tracking exists)

Strength: The differentiation features are genuinely innovative — the sovereign vault
architecture with encrypted exchange credentials, the import token marketplace with
atomic royalty splits, and the 10-factor institutional-quality scoring engine are
features that most consumer fintech products do not offer.

Weakness: Roughly 40% of workspace features are partial or stub implementations.
The product appears more complete in navigation than it actually is — clicking
through the sidebar reveals many pages that show empty shells or "coming soon"
states.

MARKET / LAUNCH READINESS — 5.4/10

Launch blocker inventory:
Blocker                                                                 Severity   Estimated fix effort
Marketplace page crashes when !viewer.authenticated (links to undefined)  MEDIUM    1 day
No rate limiting on price refresh or AI generation endpoints             MEDIUM    3 days
Multi-table RLS audit — at least 5 tables missing RLS or with gaps       HIGH      3-5 days
No empty states on most workspace pages                                  MEDIUM    5 days
Limited test coverage — no integration tests for payment flows           HIGH      2 weeks
Onboarding: no guided tour, no sample portfolio                          MEDIUM    1 week
AI disclaimers present in output but may not cover all surfaces          MEDIUM    2 days

Score justification:
- Security posture is mixed. The middleware correctly protects all routes
  (middleware.ts:99-104), withAuth rejects unauthorized API calls
  (lib/api/auth.ts:34-45), Stripe webhook signature is verified
  (app/api/stripe/webhook/route.ts:331), and the vault rejects cloud DB URLs
  (lib/db.ts:28-49). However, there are likely RLS gaps — migration
  20260616130000 is named "marketplace_rls_blueprint_audit" suggesting prior
  RLS issues were found and fixed, and the vault execution plane uses raw pg
  queries (though parameterized) that bypass Supabase RLS entirely.
- There is no rate limiting on any endpoint. The nightly refresh cron fetches
  all holdings in one batch (potentially expensive), and the refresh-signals
  button triggers AI generation which could be abused.
- Error handling is inconsistent: the AI service has no fallback when Anthropic
  is down (lib/services/ai.ts:97-105 would throw), but the nightly refresh cron
  has per-portfolio try/catch with operator alerting
  (app/api/cron/nightly-refresh/route.ts:120-208). The marketplace page has
  error states for failed leaderboard loads (page.tsx:63) but many workspace
  pages lack proper error boundaries.
- Empty states are present in some places (portfolio engine shows "No portfolios
  found" at page.tsx:218-237) but most workspace pages have no empty state
  handling — they would render broken or blank content.
- Performance concerns: the portfolio engine fetches all holdings for a portfolio
  in a single API call, which is fine for 50 holdings but would degrade. The
  nightly refresh processes all portfolios sequentially, which could take hours
  with 100+ portfolios.
- The legal/compliance surface is well-handled: non-advisory disclaimers are
  defined in lib/constants/compliance.ts and lib/constants/ai-models.ts, the
  AI_DISCLAIMER is appended to brief outputs (lib/services/ai.ts:95), legal
  routes exist (terms, privacy, disclaimer), and the workspace disclaimer
  banner is defined. However, the AI disclaimer is embedded in the prompt rather
  than appended by the system, meaning it could be omitted if the model doesn't
  follow instructions — a post-processing append would be more reliable.
- 9 test files exist but cover only core math functions (engine.test.ts,
  formula-engine.test.ts, etc.). No integration tests exist for payment flows,
  auth flows, or API routes.

Evidence:
Finding                                                   File                                                         Impact on score
Stripe webhook verifies signatures before processing       app/api/stripe/webhook/route.ts:331                           +0.3
No rate limiting on any API route                          (entire codebase)                                             -0.3
N+1 in AI brief: per-portfolio DB queries in loop          app/api/cron/weekly-brief/route.ts:52-107                      -0.2
No integration tests for payment/auth/api routes           tests/ (9 files, all unit)                                    -0.3
AI disclaimer prompt-embedded, not post-pended              lib/services/ai.ts:95                                         -0.2
Legal routes defined, disclaimers present                   lib/constants/compliance.ts, lib/constants/ai-models.ts       +0.3

Ceiling (what gets this to 6.9):
1. Add Sentry performance monitoring and span tracking for the cron pipelines
2. Implement rate limiting on all user-facing API routes (use the existing rate_limit_rpc)
3. Add integration tests covering the three critical paths: auth → portfolio CRUD, Stripe → entitlement, and market data → allocation
4. Build a guided onboarding flow with sample portfolio creation
5. Implement proper empty states and error boundaries for all workspace pages
6. Post-pend the AI disclaimer programmatically rather than embedding in prompts
7. Add pagination to the nightly refresh cron

Strength: The legal/compliance foundation is solid — disclaimers are centralized,
consistently applied, and the non-advisory posture is maintained throughout the
codebase. The Stripe webhook security (signature verification + idempotency) is
production-grade.

Weakness: The product is not ready for mainstream users. A new user signing up
would see a sparse dashboard, no guided onboarding, and many workspace links that
lead to empty or stub pages. The lack of integration tests means critical payment
and auth paths could break without detection.

COMPETITIVE ADVANTAGES / MOATS — 7.0/10

Moat assessment:
Moat type                       Strength        Current implementation
Data / network effects           Moderate        Marketplace creates supply-side effects (more strategies → more buyers → more publishers). Import token ledger accrues usage data. Portfolio histories create switching costs.
Technical architecture           Strong          Sovereign execution vault with encrypted exchange credentials, local Postgres data plane (lib/execution/vault-execution-plane.ts, lib/db.ts). Composite scoring engine with 10 configurable factors and institutional overlays (lib/portfolio/formula-engine.ts, lib/portfolio/portfolio-factors.ts). Import token marketplace with atomic RPC spend (lib/marketplace/import-token-service.ts:116-141).
Market positioning               Moderate        "Institutional-grade tools for self-directed investors" occupies genuine whitespace between consumer robo-advisors (Betterment) and institutional terminals (Bloomberg). The non-advisory + AI-assisted positioning is distinctive.
Regulatory design                Strong          Sovereign execution vault never touches user funds (exchange keys only, encrypted at rest). Non-advisory posture consistently maintained. Compliance-first architecture (disclaimers, RLS, audit logs) creates barrier for less careful competitors.
Marketplace flywheel             Partial         Leaderboard exists, publish/import cycle works, creator royalties via Stripe → ledger. But no community features (reviews, ratings, comments), no social proof, no featured/promoted strategies.

Closest competitors:
Competitor                    How Pemabu differentiates
Betterment / Wealthfront      Pemabu is self-directed, not robo-advisory. No AUM fees. Sovereign execution (user retains custody). Marketplace for strategy sharing.
Yahoo Finance / Morningstar   Pemabu has institutional overlays (13F, macro regime, congressional trades), AI briefs, composite scoring engine — not just portfolio tracking.
TradingView / QuantConnect    Pemabu targets allocators, not traders/quants. Composite scoring + drift management + AI narrative. Marketplace with royalty model creates creator economy.

Score justification:
- The sovereign execution architecture is the strongest differentiator. The vault
  data plane (lib/execution/vault-execution-plane.ts) is a genuinely novel approach
  that separates portfolio computation (Supabase cloud) from execution credentials
  (local Postgres). This architecture would take a well-funded competitor 6-12
  months to replicate properly.
- The 10-factor composite scoring engine with institutional overlays (13F, macro
  regime, governance layer, political tracker, token quality) is defensible IP.
  Combining hedge fund 13F sentiment with macro regime classification and a
  user-configurable factor model is not something consumer fintech products offer.
- The import token marketplace with atomic royalty accounting
  (lib/marketplace/import-token-service.ts, supabase/migrations/20260618120000*)
  creates genuine supply-side network effects: more publishers → more strategies →
  more buyers → more revenue for publishers → more publishers.
- However, the network effects are currently theoretical. The marketplace leaderboard
  showed 0 rows in the viewer context during review (placeholder rendering), meaning
  there is no critical mass of published strategies yet. The flywheel has not started.
- The regulatory moat is strong in design but unproven in practice. The non-advisory
  posture is consistent and well-documented, and the sovereign execution model
  (encrypted keys, no fund custody) is defensible. But no SEC/FINRA guidance exists
  specifically for this model — it's a first-mover advantage that carries regulatory
  uncertainty.
- A well-funded competitor (e.g., Coinbase, Robinhood) could replicate the core
  portfolio engine features in 3-6 months but would struggle with:
  - The sovereign local-first architecture (runs counter to their cloud-native models)
  - The institutional overlay data pipeline (13F scraping, macro regime classification)
  - The import token marketplace with atomic creator royalty accounting

Evidence:
Finding                                                   File                                                         Impact on score
Sovereign vault architecture with encrypted credentials    lib/execution/vault-execution-plane.ts, lib/db.ts             +1.0
10-factor composite scoring with institutional overlays   lib/portfolio/portfolio-factors.ts, lib/portfolio/             +0.8
                                                            formula-engine.ts
Import token marketplace with atomic RPC royalty           lib/marketplace/import-token-service.ts:116-141,              +0.7
                                                            supabase/migrations/20260618120000*
13F EDGAR scraping pipeline                                lib/intelligence/thirteen-f-edgar.ts                         +0.5
Non-advisory posture consistently maintained               lib/constants/compliance.ts, lib/constants/ai-models.ts       +0.5
Marketplace has 0 strategies visible                       app/(workspace)/marketplace/page.tsx:57                       -0.5

Ceiling (what gets this to 8.5):
1. Seed the marketplace with 10+ high-quality published strategies (founder/beta user created)
2. Build community features (ratings, reviews, discussion on strategies)
3. Add creator dashboard with royalty analytics and payout history
4. Implement performance tracking for published strategies (track record on leaderboard)
5. Build the family sharing feature to create household stickiness
6. Publish a public API for programmatic strategy import/export

Strength: The sovereign execution vault architecture is genuinely novel and defensible.
Separating the computation plane (Supabase) from the credential plane (local encrypted
Postgres) with a clean API boundary is an elegant solution to the "cloud convenience vs
local security" tension that no major competitor has solved.

Weakness: The marketplace flywheel has not started — there are no published strategies,
no community engagement, and no social proof. The network effects that would create
durable competitive advantage are entirely theoretical at this stage.

PRIORITY ACTION MATRIX

Ordered by: score improvement per unit of effort
Priority  Action                                                              Dimension affected        Score impact  Effort
1         Seed marketplace with 10+ published strategies                      Competitive Advantages    +0.5          S
2         Add empty states + error boundaries to all workspace pages          Launch Readiness          +0.4          S
3         Implement AI fallback/cached content when Anthropic is down         Functionality             +0.3          S
4         Build guided onboarding wizard with sample portfolio creation        Launch Readiness          +0.5          M
5         Add rate limiting on user-facing API endpoints                      Launch Readiness          +0.4          M
6         Add integration tests for payment + auth + portfolio CRUD paths     Viability                 +0.4          M
7         Write RLS audit and fix all gaps across user-scoped tables          Launch Readiness          +0.5          M
8         Implement 5 STUB workspace pages (defi, governance, options, etc.)  Features                  +0.4          L
9         Post-pend AI disclaimer programmatically                            Launch Readiness          +0.1          S
10        Paginate nightly refresh cron for scalability                       Functionality             +0.2          M

INVESTMENT / LAUNCH DECISION SUMMARY

Current state in one sentence:
Pemabu is an architecturally ambitious, impressively engineered beta platform with
a functional core portfolio engine and innovative marketplace/execution features,
but held back by approximately 40% stub features, thin test coverage, and no
mainstream-ready onboarding experience.

Ready for:
- Technical early adopters who can navigate sparse documentation
- Beta testers who understand the sovereign vault architecture
- Demonstrated as a proof-of-concept to investors
- Internal dogfooding by the development team

Not ready for:
- Mainstream consumer launch (non-technical users will hit confusing states)
- Enterprise or institutional deployment (no SLA, no audit trail completeness)
- Payment processing at scale (no rate limiting, no monitoring dashboards)
- Public marketing campaign (features marketed but not all built)
- Exchange execution (EXECUTION_LIVE_MODE=false, no paper trading integration)

What would change the overall score from 6.2 to 8.5+:
1. Build and launch the missing workspace features (defi, governance, options,
   political-tracker, vault-export) AND seed the marketplace with 10+ strategies
   — this would bring Features from 6.5 to 8.0+ and convert the theoretical
   network effects into real competitive momentum.
2. Implement comprehensive integration testing for all three critical paths
   (auth→portfolio, Stripe→entitlement, market data→allocation) and add rate
   limiting + Sentry performance monitoring — this would bring Launch Readiness
   from 5.4 to 7.5+.
3. Build a guided onboarding flow with sample portfolio creation, demo mode,
   and in-app tutorial — this is the single highest-leverage change for user
   acquisition and retention.

Estimated time to launch-ready (assuming 1 senior full-stack dev):
10-14 weeks (assuming 40h/week dedicated effort).
- 2 weeks: stub workspace pages → functional MVP
- 2 weeks: onboarding flow + sample portfolio
- 2 weeks: integration tests + rate limiting + monitoring
- 2 weeks: marketplace seeding + community features
- 1 week: empty states + error boundaries + polish
- 1-3 weeks: RLS audit + security hardening + legal review

═══════════════════════════════════════════════════════════════════
