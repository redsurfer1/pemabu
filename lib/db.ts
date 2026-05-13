import { Pool, type PoolConfig } from "pg";

let _pool: Pool | null = null;

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "db",
  "postgres",
  "host.docker.internal",
]);

function isPrivateIPv4(host: string): boolean {
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  const m = /^172\.(\d+)\./.exec(host);
  if (m) {
    const n = Number(m[1]);
    return n >= 16 && n <= 31;
  }
  return false;
}

/**
 * Refuse hosted Supabase Postgres URLs unless explicitly allowed (migration / hybrid ops).
 */
export function assertLocalVaultDatabaseUrl(connectionString: string): void {
  if (process.env.SUPABASE_CLOUD_OK === "true") return;

  let hostname: string;
  try {
    hostname = new URL(connectionString).hostname.toLowerCase();
  } catch {
    throw new Error("LOCAL_DB_URL is not a valid URL");
  }

  if (hostname.endsWith("supabase.co")) {
    throw new Error(
      "PEMABU vault: refusing Supabase Cloud database URL. Use LOCAL_DB_URL for the Docker vault, or set SUPABASE_CLOUD_OK=true for explicit cloud migration.",
    );
  }

  if (LOCAL_HOSTS.has(hostname) || isPrivateIPv4(hostname)) return;

  throw new Error(
    `PEMABU vault: database host "${hostname}" is not on the local vault allowlist. Set SUPABASE_CLOUD_OK=true only for controlled migrations.`,
  );
}

/**
 * Primary connection string for the sovereign Postgres vault (Docker `db` service).
 * Defaults to `LOCAL_DB_URL`, then `DATABASE_URL` for tooling compatibility.
 */
export function getVaultConnectionString(): string {
  const url = process.env.LOCAL_DB_URL ?? process.env.DATABASE_URL ?? "";
  if (!url) {
    throw new Error(
      "LOCAL_DB_URL (or DATABASE_URL) must be set when using the local vault data plane.",
    );
  }
  assertLocalVaultDatabaseUrl(url);
  return url;
}

export function getVaultPool(config?: PoolConfig): Pool {
  if (_pool) return _pool;
  const connectionString = getVaultConnectionString();
  _pool = new Pool({
    connectionString,
    max: config?.max ?? 10,
    idleTimeoutMillis: config?.idleTimeoutMillis ?? 30_000,
    ...config,
  });
  return _pool;
}

export async function closeVaultPool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
