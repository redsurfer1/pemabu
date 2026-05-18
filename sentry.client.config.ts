/**
 * Sentry browser-side SDK initialization.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 *
 * NEXT_PUBLIC_SENTRY_DSN is intentionally a NEXT_PUBLIC_ variable —
 * DSNs are designed to be public (they only accept error events from
 * your configured origins, not read data).
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production; avoids polluting Sentry during local dev.
  enabled: process.env.NODE_ENV === "production",

  // Performance traces — 5% sample rate to keep quota manageable.
  tracesSampleRate: 0.05,

  // Session replays — only when an error occurs (not all sessions).
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,

  // ── PII stripping ────────────────────────────────────────────────────────
  // Strip any identifiable fields before the event leaves the browser.
  beforeSend(event) {
    // Redact user identity
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }

    // Redact sensitive context keys
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
