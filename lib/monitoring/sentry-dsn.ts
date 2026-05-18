/**
 * Server/edge DSN: SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN.
 * Set both on Vercel to the same value for simplicity.
 */
export function getSentryDsn(): string | undefined {
  const dsn =
    process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return dsn || undefined;
}

/** Browser bundle only inlines NEXT_PUBLIC_* — use this in sentry.client.config.ts */
export function getSentryClientDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

export function isSentryConfigured(): boolean {
  return Boolean(getSentryDsn());
}
