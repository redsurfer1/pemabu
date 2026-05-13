/**
 * Apply SQL migrations from `supabase/migrations` to the local Postgres vault.
 *
 * Idempotency: filenames recorded in `public.vault_schema_migrations`. A second
 * `npm run vault:sync` skips already-applied files (no duplicate constraint errors).
 *
 * Usage:
 *   LOCAL_DB_URL=postgresql://pemabu:...@localhost:5433/pemabu_vault npx tsx scripts/sync-local-schema.ts
 *   npx tsx scripts/sync-local-schema.ts --only=20260612120000
 *   npx tsx scripts/sync-local-schema.ts --reapply=20260612120000   # clears ledger rows matching substring, then runs
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { assertLocalVaultDatabaseUrl } from "../lib/db";
import {
  clearLedgerEntriesMatching,
  ensureMigrationLedger,
  loadAppliedMigrationFilenames,
  recordAppliedMigration,
} from "../lib/vault/migration-ledger";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function getConnectionString(): string {
  const url = process.env.LOCAL_DB_URL ?? process.env.DATABASE_URL ?? "";
  if (!url) {
    console.error("Set LOCAL_DB_URL (or DATABASE_URL) to your local vault Postgres.");
    process.exit(1);
  }
  assertLocalVaultDatabaseUrl(url);
  return url;
}

async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg?.split("=", 2)[1]?.trim();
  const reapplyArg = process.argv.find((a) => a.startsWith("--reapply="));
  const reapply = reapplyArg?.split("=", 2)[1]?.trim() ?? "";

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const selected = only ? files.filter((f) => f.includes(only)) : files;
  if (selected.length === 0) {
    console.error("No migration files matched.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    await ensureMigrationLedger(client);
    let applied = await loadAppliedMigrationFilenames(client);
    if (reapply.length > 0) {
      await clearLedgerEntriesMatching(client, reapply);
      applied = await loadAppliedMigrationFilenames(client);
      console.log(`[vault:sync] cleared ledger entries matching *${reapply}*`);
    }

    for (const name of selected) {
      if (applied.has(name)) {
        console.log(`[vault:sync] skip ${name} (already applied)`);
        continue;
      }
      const full = join(MIGRATIONS_DIR, name);
      const sql = readFileSync(full, "utf8");
      process.stdout.write(`[vault:sync] applying ${name} ... `);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await recordAppliedMigration(client, name);
        await client.query("COMMIT");
        applied.add(name);
        process.stdout.write("ok\n");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
