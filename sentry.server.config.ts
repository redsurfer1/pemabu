/**
 * Sentry Node.js (server-side) SDK initialization.
 * Runs in the Next.js Node.js runtime for API routes, Server Components,
 * and server actions.
 */
import * as Sentry from "@sentry/nextjs";
import { getSentryDsn } from "@/lib/monitoring/sentry-dsn";

const dsn = getSentryDsn();

Sentry.init({
  dsn,

  enabled: Boolean(dsn) && process.env.NODE_ENV === "production",

  // Server-side trace sampling — 10% for API routes.
  tracesSampleRate: 0.1,

  // ── PII stripping ────────────────────────────────────────────────────────
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }

    const sensitiveKeys = ["apiKey", "stripeKey", "password", "token", "secret", "api_key"];
    function redactObject(obj: Record<string, unknown>): void {
      for (const key of Object.keys(obj)) {
        if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
          obj[key] = "[Redacted]";
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          redactObject(obj[key] as Record<string, unknown>);
        }
      }
    }

    if (event.extra) redactObject(event.extra as Record<string, unknown>);
    if (event.contexts) redactObject(event.contexts as Record<string, unknown>);

    return event;
  },
});
