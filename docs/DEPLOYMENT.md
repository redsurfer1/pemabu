# PEMABU deployment matrix

This runbook defines **which environment variables are allowed together**. Violations can expose exchange keys to cloud Postgres or place live orders from the wrong plane.

## Deployment profiles

| Profile | `USE_LOCAL_VAULT` | `EXECUTION_LIVE_MODE` | Where to run | Exchange / execution keys |
|--------|-------------------|------------------------|--------------|---------------------------|
| **Sovereign (recommended)** | `true` | `false` (default) until paper-validated | Docker Compose (`docker-compose.yml`) | Local vault Postgres only |
| **Sovereign + paper live** | `true` | `true` + paper/sandbox broker creds | Docker Compose | Local vault only; `ALPACA_USE_LIVE=false`, `COINBASE_USE_SANDBOX=true` |
| **Cloud workbook** | `false` | **must be unset or `false`** | Vercel / hosted Next.js | **No** exchange credentials; Tiingo-only portfolio keys OK |
| **Forbidden** | `false` | `true` | Any cloud host | **Never** — live/stub dispatch must not run against cloud execution plane |

## Rules

1. **`USE_LOCAL_VAULT=true`** is required for:
   - Saving user or portfolio **execution** API keys (Alpaca, Kraken, Coinbase Advanced)
   - `approveTradeProposal` (trade approval)
   - Autonomous execution toggle
   - `GET/POST /api/execution/queue`

2. **`EXECUTION_LIVE_MODE=true`** is opt-in only. When not exactly `"true"`, `dispatchOrder()` returns stub responses (no broker REST).

3. **Vercel / serverless cloud**: keep `USE_LOCAL_VAULT=false` and `EXECUTION_LIVE_MODE=false`. Use Supabase for auth, workbook, marketplace, and Strategy Council. Do not enable live execution on cloud without an explicit risk sign-off and a vault-side worker.

4. **`MASTER_VAULT_KEY`**: required in vault mode for AES-256-GCM credential encryption (min 16 characters).

## Startup checklist (vault)

```bash
cp .env.example .env
# Set USE_LOCAL_VAULT=true, MASTER_VAULT_KEY, LOCAL_DB_URL, Supabase keys for auth
docker compose up -d
npm run vault:sync
npm run doctor
```

`npm run doctor` warns when `USE_LOCAL_VAULT` is not `true` in a sovereign deployment.

## Marketplace

Blueprint unlock price is **$4.99** (`MARKETPLACE_UNLOCK_PRICE_CENTS=499` in `lib/marketplace/unlock-pricing.ts`), enforced in Stripe checkout and webhook royalty split (70% creator / 30% platform).
