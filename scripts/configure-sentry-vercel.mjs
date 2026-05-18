#!/usr/bin/env node
/**
 * Push SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN to Vercel (all environments).
 *
 * Usage:
 *   SENTRY_DSN="https://key@o123.ingest.us.sentry.io/456" node scripts/configure-sentry-vercel.mjs
 *
 * Get your DSN: https://sentry.io → Project → Settings → Client Keys (DSN)
 */

import { execSync } from "node:child_process";

const dsn = (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "").trim();

if (!dsn) {
  console.error("Missing SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) in environment.");
  console.error(
    'Example: SENTRY_DSN="https://…@….ingest.sentry.io/…" node scripts/configure-sentry-vercel.mjs',
  );
  process.exit(1);
}

if (!dsn.startsWith("https://") || !dsn.includes("@")) {
  console.error("SENTRY_DSN does not look like a valid Sentry DSN URL.");
  process.exit(1);
}

const envs = ["production", "preview", "development"];
const names = ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"];

function addEnv(name, targetEnv) {
  execSync(`npx vercel env add ${name} ${targetEnv} --yes --force`, {
    input: `${dsn}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

for (const name of names) {
  for (const targetEnv of envs) {
    console.log(`Setting ${name} for ${targetEnv}…`);
    addEnv(name, targetEnv);
  }
}

console.log("\nDone. Redeploy production, then run: npm run verify:sentry");
