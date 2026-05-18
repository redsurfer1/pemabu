import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { getSentryDsn, isSentryConfigured } from "@/lib/monitoring/sentry-dsn";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * POST /api/cron/sentry-verify
 * Sends a test event to Sentry (production only when DSN is set).
 * Auth: Bearer CRON_SECRET
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSentryConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sentry DSN not configured",
        hint: "Set SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN on Vercel (same value).",
      },
      { status: 503 },
    );
  }

  if (process.env.NODE_ENV !== "production") {
    return NextResponse.json(
      {
        ok: false,
        error: "Sentry verify runs only in production (NODE_ENV=production)",
        nodeEnv: process.env.NODE_ENV,
      },
      { status: 400 },
    );
  }

  const dsnHost = (() => {
    try {
      return new URL(getSentryDsn()!).host;
    } catch {
      return "invalid-dsn";
    }
  })();

  const eventId = Sentry.captureMessage("Pemabu Sentry verify ping", {
    level: "info",
    tags: { source: "sentry-verify", environment: "production" },
  });

  const flushed = await Sentry.flush(5_000);

  return NextResponse.json({
    ok: true,
    eventId: eventId ?? null,
    flushed,
    dsnHost,
    checkedAt: new Date().toISOString(),
  });
}
