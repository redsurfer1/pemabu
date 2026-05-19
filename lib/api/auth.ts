// lib/api/auth.ts
// Server-side auth helper for API route handlers.
// Returns the verified user or throws a Response.

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ImportEntitlementError } from "@/lib/marketplace/import-gate";
import * as Sentry from "@sentry/nextjs";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import type { RateLimitOptions } from "@/lib/security/rate-limiter";

// ── Structured error class ────────────────────────────────────────────────────

/**
 * Throw this inside any withAuth handler to produce a structured JSON error
 * response with a specific HTTP status code, without leaking internal details.
 *
 * @example
 * throw new AppError('User exceeded quota', 429, 'Rate limit exceeded', 'RATE_LIMITED')
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly publicMessage: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function getAuthenticatedUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/** Context passed to App Router route handlers (params is always a Promise). */
export type RouteHandlerContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

// ── withAuth wrapper ──────────────────────────────────────────────────────────

/**
 * Wraps a route handler with authentication.
 * Optionally enforces rate limiting before the handler runs.
 * Catches thrown Responses (auth gate), AppError, ImportEntitlementError,
 * and any unexpected errors. In development, unexpected errors include a
 * `detail` field with the root cause message.
 *
 * @example
 * ```ts
 * // No rate limiting
 * export const GET = withAuth(handler);
 *
 * // With rate limiting
 * export const GET = withAuth(handler, { keyTemplate: "holdings:{userId}", maxCount: 60, windowSeconds: 60 });
 * ```
 */
export function withAuth(
  handler: (req: Request, user: User, context: RouteHandlerContext) => Promise<Response>,
  rateLimit?: Omit<RateLimitOptions, "key"> & { keyTemplate: string },
) {
  return async (req: Request, context: RouteHandlerContext): Promise<Response> => {
    try {
      const user = await getAuthenticatedUser();

      if (rateLimit) {
        const rl = await checkRateLimit({
          key: rateLimit.keyTemplate.replace("{userId}", user.id),
          maxCount: rateLimit.maxCount,
          windowSeconds: rateLimit.windowSeconds,
        });
        if (!rl.allowed) {
          return NextResponse.json(
            {
              error: "Too many requests. Please slow down.",
              code: "RATE_LIMITED",
              retryAfterSeconds: rl.retryAfterSeconds,
            },
            { status: 429 },
          );
        }
      }

      return await handler(req, user, context);
    } catch (e) {
      // Auth gate throws a Response directly
      if (e instanceof Response) return e;

      // Structured application errors with explicit HTTP status
      if (e instanceof AppError) {
        return NextResponse.json(
          { error: e.publicMessage, ...(e.code ? { code: e.code } : {}) },
          { status: e.statusCode },
        );
      }

      // Import entitlement errors map to 402 Payment Required
      if (e instanceof ImportEntitlementError) {
        return NextResponse.json(
          { error: e.message, code: e.code },
          { status: 402 },
        );
      }

      // Unexpected errors — log always, capture in Sentry (production), expose detail in dev
      console.error("[withAuth] Unhandled error:", e);
      Sentry.captureException(e);
      const isDev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          error: "Internal server error",
          ...(isDev && e instanceof Error ? { detail: e.message } : {}),
        },
        { status: 500 },
      );
    }
  };
}
