#!/usr/bin/env node
// pemabu doctor — diagnostic for sovereign self-hosted deployments.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";

const PASS = "✓";
const FAIL = "✗";
const WARN = "⚠";
const SEP = "─".repeat(60);

let failures = 0;

function pass(msg) {
  console.log(`  ${PASS}  ${msg}`);
}
function fail(msg) {
  console.log(`  ${FAIL}  ${msg}`);
  failures++;
}
function warn(msg) {
  console.log(`  ${WARN}  ${msg}`);
}
function section(t) {
  console.log(`\n${SEP}\n  ${t}\n${SEP}`);
}

section("Environment");

if (existsSync(".env") || existsSync(".env.local")) {
  pass(".env or .env.local found");
} else {
  fail(".env not found — copy .env.example to .env and fill in values");
}

const env = process.env;

[
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon key"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase service role key"],
].forEach(([key, label]) => {
  env[key] ? pass(`${label} set`) : fail(`${label} missing (${key})`);
});

const liveMode = env.EXECUTION_LIVE_MODE;
if (liveMode === "true") {
  warn("EXECUTION_LIVE_MODE=true — real orders WILL be placed. Confirm this is intentional.");
  [
    ["ALPACA_API_KEY", "Alpaca API key"],
    ["ALPACA_API_SECRET", "Alpaca API secret"],
  ].forEach(([key, label]) => {
    env[key] ? pass(`${label} set`) : fail(`${label} missing — required when EXECUTION_LIVE_MODE=true`);
  });
} else {
  pass("EXECUTION_LIVE_MODE is false — stub mode active (safe)");
}

const useVault = env.USE_LOCAL_VAULT;
if (useVault === "true") {
  pass("USE_LOCAL_VAULT=true — sovereign vault mode active");
  // Check 1: USE_LOCAL_VAULT=true requires LOCAL_DB_URL
  if (!env.LOCAL_DB_URL) {
    fail(
      "USE_LOCAL_VAULT=true but LOCAL_DB_URL is not set. " +
      "This will cause the vault data plane to crash silently at runtime. " +
      "Either set LOCAL_DB_URL or remove USE_LOCAL_VAULT=true.",
    );
  } else {
    pass("LOCAL_DB_URL set — vault database URL configured");
  }
} else {
  warn(
    "USE_LOCAL_VAULT is not set — running in cloud/hybrid mode. Exchange credentials will NOT be saved (sovereign boundary enforced in saveExchangeCredentials).",
  );
}

// Check 2: MARKETPLACE_USE_IMPORT_LEDGER backfill warning
if (env.MARKETPLACE_USE_IMPORT_LEDGER === "true") {
  warn(
    "MARKETPLACE_USE_IMPORT_LEDGER=true. Ensure the backfill migration " +
    "(20260620000002_backfill_existing_unlocks_to_ledger.sql) has been applied " +
    "before deploying. Existing buyers will lose token access otherwise.",
  );
} else {
  pass("MARKETPLACE_USE_IMPORT_LEDGER=false — legacy unlock path active (safe)");
}

// Check 3: ANTHROPIC_API_KEY (not checked in the block above)
if (!env.ANTHROPIC_API_KEY) {
  fail("Missing required environment variable: ANTHROPIC_API_KEY (needed for Strategy Council)");
} else {
  pass("ANTHROPIC_API_KEY set");
}

section("Docker");

try {
  execSync("docker info", { stdio: "pipe" });
  pass("Docker daemon is running");
} catch {
  fail("Docker is not running — start Docker Desktop or the Docker daemon");
}

try {
  const output = execSync("docker compose ps --format json", { stdio: "pipe" }).toString();
  const services = output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const running = services.filter((s) => s.State === "running").map((s) => s.Service);
  const stopped = services.filter((s) => s.State !== "running").map((s) => s.Service);

  running.forEach((s) => pass(`Container '${s}' is running`));
  stopped.forEach((s) => fail(`Container '${s}' is not running — run: docker compose up -d`));

  if (services.length === 0) {
    warn("No docker-compose services found — run: docker compose up -d");
  }
} catch {
  warn("Could not read docker compose status — is docker-compose.yml present?");
}

section("Local Postgres (Vault)");

function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection(port, host);
    socket.setTimeout(3000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const pgReachable = await checkPort("localhost", 5432);
if (pgReachable) {
  pass("Postgres port 5432 reachable");
} else {
  warn(
    "Postgres port 5432 not reachable from host — this is EXPECTED in vault mode (no exposed ports). Vault Postgres is internal to Docker network.",
  );
}

section("Market Data");

try {
  const res = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d");
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (price) {
    pass(`Yahoo Finance reachable — AAPL: $${price}`);
  } else {
    warn("Yahoo Finance responded but returned no price — API may have changed");
  }
} catch {
  fail("Yahoo Finance unreachable — check network connectivity");
}

section("Governance Data");

try {
  const res = await fetch("https://hub.snapshot.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ spaces(first: 1) { id } }" }),
  });
  if (res.ok) {
    pass("Snapshot.org GraphQL API reachable");
  } else {
    warn(`Snapshot.org returned ${res.status} — governance proposals may not fetch`);
  }
} catch {
  fail("Snapshot.org unreachable — governance alerts will not work");
}

section("Summary");

if (failures === 0) {
  console.log(`\n  ${PASS}  All checks passed. Pemabu is correctly configured.\n`);
} else {
  console.log(`\n  ${FAIL}  ${failures} check(s) failed. Review the output above and fix each item.\n`);
  process.exit(1);
}
