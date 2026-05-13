import type { Pool } from "pg";

/**
 * Ledger for idempotent `vault:sync` — each migration filename is applied at most once
 * unless explicitly re-applied via `--reapply=substring`.
 */

export const VAULT_MIGRATION_LEDGER_DDL = `
CREATE TABLE IF NOT EXISTS public.vault_schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`;

type Queryable = Pick<Pool, "query">;

export async function ensureMigrationLedger(client: Queryable): Promise<void> {
  await client.query(VAULT_MIGRATION_LEDGER_DDL);
}

export async function loadAppliedMigrationFilenames(client: Queryable): Promise<Set<string>> {
  const res = await client.query<{ filename: string }>(
    "SELECT filename FROM public.vault_schema_migrations",
  );
  return new Set(res.rows.map((r) => r.filename));
}

export async function recordAppliedMigration(client: Queryable, filename: string): Promise<void> {
  await client.query(
    "INSERT INTO public.vault_schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
    [filename],
  );
}

export async function clearLedgerEntriesMatching(client: Queryable, substring: string): Promise<void> {
  await client.query("DELETE FROM public.vault_schema_migrations WHERE filename LIKE $1", [`%${substring}%`]);
}
