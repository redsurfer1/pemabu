import { afterEach, describe, expect, it } from "vitest";
import { getSentryDsn, isSentryConfigured } from "./sentry-dsn";

describe("sentry-dsn", () => {
  const prevSentry = process.env.SENTRY_DSN;
  const prevPublic = process.env.NEXT_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    if (prevSentry === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = prevSentry;
    if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = prevPublic;
  });

  it("prefers SENTRY_DSN over NEXT_PUBLIC_SENTRY_DSN", () => {
    process.env.SENTRY_DSN = "https://server@o1.ingest.sentry.io/1";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@o1.ingest.sentry.io/2";
    expect(getSentryDsn()).toBe("https://server@o1.ingest.sentry.io/1");
  });

  it("falls back to NEXT_PUBLIC_SENTRY_DSN", () => {
    delete process.env.SENTRY_DSN;
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@o1.ingest.sentry.io/2";
    expect(getSentryDsn()).toBe("https://public@o1.ingest.sentry.io/2");
  });

  it("returns undefined when unset", () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    expect(isSentryConfigured()).toBe(false);
  });
});
