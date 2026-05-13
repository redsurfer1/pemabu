import { describe, expect, it } from "vitest";
import { VAULT_MIGRATION_LEDGER_DDL } from "@/lib/vault/migration-ledger";

describe("vault_schema_migrations ledger", () => {
  it("DDL is idempotent at the table level", () => {
    expect(VAULT_MIGRATION_LEDGER_DDL).toMatch(/CREATE TABLE IF NOT EXISTS/i);
    expect(VAULT_MIGRATION_LEDGER_DDL).toMatch(/filename text PRIMARY KEY/i);
  });
});
