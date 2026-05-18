#!/usr/bin/env node
/**
 * Verify Sentry capture on production via /api/cron/sentry-verify.
 *
 * Usage:
 *   CRON_SECRET=… npm run verify:sentry
 *   # or pull from Vercel: npx vercel env pull .env.verify && source .env.verify
 */

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.pemabu.com").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET?.trim();

if (!cronSecret) {
  console.error("CRON_SECRET is required (Bearer token for /api/cron/sentry-verify).");
  process.exit(1);
}

const url = `${baseUrl}/api/cron/sentry-verify`;

console.log(`POST ${url}`);

const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${cronSecret}` },
});

const body = await res.json().catch(() => ({}));

console.log(`Status: ${res.status}`);
console.log(JSON.stringify(body, null, 2));

if (!res.ok) {
  process.exit(1);
}

if (!body.ok || !body.eventId) {
  console.error("Verify failed: no eventId returned from Sentry.");
  process.exit(1);
}

console.log("\n✓ Sentry verify ping sent. Check your Sentry project Issues for:");
console.log('  Message: "Pemabu Sentry verify ping"');
console.log(`  Event ID: ${body.eventId}`);
