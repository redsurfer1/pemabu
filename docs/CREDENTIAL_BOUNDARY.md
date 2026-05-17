# Pemabu Credential Storage Boundary

## Summary

Pemabu operates a two-plane architecture: a **sovereign local vault** (Docker Postgres)
and a **cloud Supabase** instance. Different credential types belong to different planes.
Mixing them is a security violation.

---

## Vault-required credentials (sovereign — never in Supabase)

These MUST be stored in the local vault database only. They grant trading or withdrawal
authority and must never leave the user's device/network boundary.

| Credential | Storage | Enforced by |
|---|---|---|
| Alpaca API key + secret | Local vault `exchange_credentials` | `lib/actions/execution/saveExchangeCredentials.ts` — `isLocalVaultExecutionPlane()` gate |
| Kraken API key + secret | Local vault `exchange_credentials` | Same |
| Coinbase Advanced API key + secret | Local vault `exchange_credentials` | Same |
| Any future brokerage credential | Local vault `exchange_credentials` | Same |

**Enforcement:** `saveExchangeCredentials.ts` returns an error when
`isLocalVaultExecutionPlane()` is false. In cloud-only mode, exchange credentials
cannot be saved at all — this is intentional.

---

## Cloud-allowed credentials (Supabase — read-only data providers only)

These may be stored in Supabase (encrypted, owner-read RLS). They provide read-only
market data access and carry no trading authority.

| Credential | Storage | Why cloud is acceptable |
|---|---|---|
| Tiingo API key | Supabase `portfolio_api_credentials` | Read-only market data; no financial authority |

---

## Environment variables (server-side only — never expose to browser)

These must never appear with a `NEXT_PUBLIC_` prefix. They are server runtime secrets.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Strategy Council AI calls |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin Supabase operations (bypasses RLS) |
| `STRIPE_SECRET_KEY` | Stripe payment operations |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `MASTER_VAULT_KEY` | AES-256-GCM key for exchange credential encryption |
| `CRON_SECRET` / `PEMABU_CRON_SECRET` | Cron job authentication |

---

## Audit procedure

### Check for server secrets accidentally exposed to the browser

```bash
# Any match in a client component under app/ or components/ is a violation
grep -r "SUPABASE_SERVICE_ROLE_KEY\|ANTHROPIC_API_KEY\|STRIPE_SECRET_KEY\|MASTER_VAULT_KEY" \
  app/ components/
```

A match in a file that is a client component (`"use client"` at top) is a **critical
security violation**. `NEXT_PUBLIC_` variables are bundled into the browser; the others
above must never appear in any client-reachable code path.

### Check for exchange credentials being written outside vault

```bash
grep -n "exchange_credentials" lib/ app/api/ --include="*.ts" -r
```

Any write to `exchange_credentials` that is not gated on `isLocalVaultExecutionPlane()`
is a sovereignty violation.

### Check for Supabase URLs reaching lib/db.ts connection string

```bash
grep -n "supabase.co" lib/db.ts
```

`lib/db.ts:assertLocalVaultDatabaseUrl()` already rejects `.supabase.co` hostnames
unless `SUPABASE_CLOUD_OK=true`. This is the last line of defense.

---

## Related files

- `lib/actions/execution/saveExchangeCredentials.ts` — credential save gate
- `lib/execution/vault-execution-plane.ts` — `isLocalVaultExecutionPlane()` definition
- `lib/db.ts` — `assertLocalVaultDatabaseUrl()` Supabase URL rejection
- `lib/security/encryption.ts` — AES-256-GCM encrypt/decrypt
- `docker-compose.yml` — vault Postgres (no exposed ports by default)
