# Pemabu Marketplace — Audit Orientation Analysis

Generated during: `audit/marketplace-ledger-sprint`
Files read: `lib/marketplace/unlock-pricing.ts`, `lib/marketplace/assert-import-unlock.ts`,
`lib/actions/portfolio/importSleeveStrategyAction.ts`,
`app/api/marketplace/import/route.ts`,
`app/api/stripe/create-checkout-session/route.ts`,
`app/api/stripe/webhook/route.ts`,
`lib/portfolio/import-sleeve-strategy.ts`,
`supabase/migrations/20260618120000_marketplace_unlocks_royalty.sql`,
`supabase/migrations/20260619000002_marketplace_import_tokens.sql`

---

## Q1 — What does `assertMarketplaceImportUnlock` do, step by step?

**File:** `lib/marketplace/assert-import-unlock.ts`
**Signature:** `assertMarketplaceImportUnlock(userId: string, sleeveToken: string)`

> **Note:** The second parameter is `sleeveToken: string` (the raw Base64URL token),
> **not** a `blueprintId`. Task Group C templates reference `blueprintId` — all
> implementations in this sprint use `sleeveToken` to match the actual signature.

Step-by-step:

1. **Hash the sleeveToken** — calls `hashSleeveToken(sleeveToken.trim())` to produce
   a deterministic hash.
2. **Look up marketplace_strategies** — queries `supabaseAdmin.from("marketplace_strategies")`
   filtering by `sleeve_token_hash`. Uses `.maybeSingle()`.
3. **Non-catalog bypass** — if no `marketplace_strategies` row exists (`!strat?.id`),
   returns `{ ok: true }` immediately. Unpublished / private blueprints bypass payment.
4. **Beta/trial group bypass** — queries `user_group_assignments` for the userId.
   If `subscription_group === "beta"` or `"trial"`, returns `{ ok: true }`.
5. **Unlock check** — queries `marketplace_unlocks` for `(user_id, blueprint_id)`.
6. **Gate decision:**
   - Unlock row found → `{ ok: true }`
   - No unlock row → `{ ok: false, status: 402, code: "PAYMENT_REQUIRED", message: "..." }`

**Tables read:** `marketplace_strategies`, `user_group_assignments`, `marketplace_unlocks`
**Gate condition:** published blueprint + not beta/trial + no unlock row → 402

---

## Q2 — What does the Stripe webhook do on `checkout.session.completed`?

**File:** `app/api/stripe/webhook/route.ts`, function `handleMarketplaceUnlock()`

The webhook routes on `session.metadata?.type`:
- `"saas_subscription"` → `handleSaasSubscriptionCheckout()` (separate path)
- No type / marketplace payment → `handleMarketplaceUnlock()`

**`handleMarketplaceUnlock()` step by step:**

1. **Extracts metadata:** `user_id`, `blueprint_id`, `creator_id`, `session.id`
2. **Calculates amounts:** Uses `session.amount_total` if present, else falls back to
   `MARKETPLACE_UNLOCK_PRICE_CENTS` (499). Calls `splitUnlockSale()` to get
   `creatorPayoutCents` and `platformFeeCents`.
3. **Deduplication check (soft):** Queries `marketplace_unlocks` by `stripe_session_id`.
   If a row already exists, returns `{ received: true, duplicate: true }` immediately.
4. **Insert unlock row:** Inserts into `marketplace_unlocks` with all amount fields.
5. **Handles duplicate constraint (hard):** If insert fails with Postgres error `23505`
   (unique violation on `stripe_session_id`), treats as duplicate and returns 200.
6. **Accrues creator royalty:** Calls `accrueCreatorRoyalty(creatorId, creatorPayoutCents)`
   which does a **non-atomic read-modify-write** on `creator_stats`.

**Tables written:** `marketplace_unlocks`, `creator_stats`
**Deduplication:** Yes — first by `SELECT ... WHERE stripe_session_id = sessionId`,
then by catching the `23505` unique constraint violation on insert.
**Race condition:** `accrueCreatorRoyalty` reads current value then upserts `prev + delta`.
Two concurrent events for the same creator could double-count royalties.

---

## Q3 — Does `marketplace_import_ledger` have any rows in production?

**No TypeScript file reads from or writes to `marketplace_import_ledger`.**

Searched all `.ts` / `.tsx` files in the repo — the string `marketplace_import_ledger`
appears only in the migration file
`supabase/migrations/20260619000002_marketplace_import_tokens.sql`.

The table was created by migration but has **zero application wiring**. All import
events currently go through `assertMarketplaceImportUnlock` → `marketplace_unlocks`.
The ledger table exists structurally but is empty and unused.

---

## Q4 — Exact SQL schema of `marketplace_import_ledger`

**File:** `supabase/migrations/20260619000002_marketplace_import_tokens.sql`

```sql
create table if not exists public.marketplace_import_ledger (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  strategy_id       uuid        references public.marketplace_strategies(id) on delete set null,
  service_key       text        not null default 'marketplace_import_token',
  tokens_consumed   integer     not null default 1,
  price_per_token   numeric(10,2) not null default 4.99,
  total_charged_usd numeric(10,2) not null default 4.99,
  is_complimentary  boolean     not null default false,
  imported_at       timestamptz not null default now(),
  notes             text
);
```

**Indexes:**
- `idx_marketplace_import_ledger_user_id` ON `(user_id)`
- `idx_marketplace_import_ledger_strategy_id` ON `(strategy_id)`
- `idx_marketplace_import_ledger_imported_at` ON `(imported_at DESC)`

**RLS:** Enabled. Policy `users_read_own_import_ledger` allows `SELECT` where
`auth.uid() = user_id`. Inserts use `service_role` (bypass RLS).

**Notable absences (added by sprint migration D.2):**
- No `direction` column (credit/debit model) — **must add**
- No `stripe_session_id` column (credit dedup) — **must add**
- No `idempotency_key` column (debit dedup) — **must add**
- No `amount_usd_cents` column (integer cents for credit rows) — **must add**

---

## Q5 — Exact SQL schema of `marketplace_unlocks`

**File:** `supabase/migrations/20260618120000_marketplace_unlocks_royalty.sql`

```sql
create table if not exists public.marketplace_unlocks (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  blueprint_id          uuid        not null references public.marketplace_strategies(id) on delete cascade,
  stripe_session_id     text        not null,
  price_paid_cents      integer     not null check (price_paid_cents > 0),
  creator_royalty_pct   numeric(8,6) not null,
  creator_payout_cents  integer     not null check (creator_payout_cents >= 0),
  platform_fee_cents    integer     not null check (platform_fee_cents >= 0),
  created_at            timestamptz not null default now(),
  unique (user_id, blueprint_id),
  unique (stripe_session_id)
);
```

**Index:** `marketplace_unlocks_user_idx` ON `(user_id, created_at DESC)`

**Key constraints:**
- `UNIQUE (user_id, blueprint_id)` — one unlock per buyer per blueprint
- `UNIQUE (stripe_session_id)` — hard idempotency on Stripe session

---

## Q6 — What happens if a user tries to import the same blueprint twice?

**Two distinct scenarios:**

### Scenario A — Same blueprint, user has an unlock
The gate (`assertMarketplaceImportUnlock`) checks for an unlock row by `(user_id, blueprint_id)`.
Finding an unlock row → `{ ok: true }`. The gate passes **on every import**.
`importSleeveStrategy` creates a **new sleeve** each time. There is no duplicate prevention
on the import itself — the same blueprint can be imported multiple times, creating
multiple sleeves with the same protocol structure. No business logic blocks this.

### Scenario B — Trying to buy the same blueprint twice
`marketplace_unlocks` has `UNIQUE (user_id, blueprint_id)`, so a second Stripe
purchase for the same `(user_id, blueprint_id)` pair would fail at the DB level.
The checkout session creation does not check for an existing unlock before creating
the Stripe session, so a user could start a second checkout — but the webhook insert
would fail with `23505` and return `{ received: true, duplicate: true }`.

---

## Q7 — What is the unpublished blueprint bypass in `assert-import-unlock.ts`?

**File:** `lib/marketplace/assert-import-unlock.ts`, lines 33–35

```typescript
if (!strat?.id) {
  return { ok: true };
}
```

**Exact condition:** If `hashSleeveToken(sleeveToken)` does not match any row in
`marketplace_strategies`, the gate immediately returns `{ ok: true }` (allowed).

**Is this intentional?** Yes. The gate is explicitly scoped to *published* strategies.
Comment in the file: *"Non-catalog imports (no matching row) pass through."*
This allows:
- Users to import their own private blueprints (not published to the marketplace)
- Internal / dev-mode imports of arbitrary sleeve tokens
- Graceful handling if a strategy was deleted from the marketplace after a user
  bookmarked its token

---

## Q8 — Does `importSleeveStrategy` use a database transaction?

**File:** `lib/portfolio/import-sleeve-strategy.ts`

**Yes, in vault mode. Partial compensation in Supabase mode.**

### Vault mode (lines 92–189) — full transaction
Uses `pg` pool client with explicit `BEGIN` / `COMMIT` / `ROLLBACK`.

Wraps atomically:
1. Portfolio ownership check (`SELECT 1 FROM portfolios WHERE id = $1 AND user_id = $2`)
2. Existing sleeve budget total check
3. `INSERT INTO sleeves`
4. `INSERT INTO sleeve_holdings` (loop per allocation row)
5. `INSERT INTO holding_audit_log`

On any error → `ROLLBACK`. On success → `COMMIT`.

### Supabase mode (lines 191–272) — compensating transactions only
No `BEGIN`/`COMMIT`. Uses sequential inserts with manual cleanup on failure:

1. Portfolio ownership check
2. Budget check
3. `INSERT INTO sleeves` → on failure: return error
4. `INSERT INTO sleeve_holdings` → on failure: `DELETE FROM sleeves WHERE id = sleeveId`, return error
5. `insertHoldingAuditRow` → on failure: `DELETE FROM sleeve_holdings WHERE sleeve_id = sleeveId`,
   `DELETE FROM sleeves WHERE id = sleeveId`, return error

**Risk:** Between step 3 and the cleanup in step 4/5, a crash leaves an orphaned sleeve row.
This is a known limitation of the Supabase JS client (no multi-statement transaction support
without an RPC wrapper).
