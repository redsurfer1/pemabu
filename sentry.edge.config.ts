/**
 * Sentry Edge runtime SDK initialization.
 * Runs for Next.js middleware and any API routes marked with
 * `export const runtime = "edge"`.
 *
 * Note: the Edge runtime has a constrained API surface; only a subset of
 * Sentry features are available here (no profiling, limited integrations).
 */
import * as Sentry from "@sentry/nextjs";
import { getSentryDsn } from "@/lib/monitoring/sentry-dsn";

const dsn = getSentryDsn();

Sentry.init({
  dsn,

  enabled: Boolean(dsn) && process.env.NODE_ENV === "production",

  // Minimal trace sampling for edge routes — they are high-frequency.
  tracesSampleRate: 0.02,

  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },
});
