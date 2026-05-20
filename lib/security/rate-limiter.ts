/**
 * lib/security/rate-limiter.ts
 *
 * Supabase-backed sliding-window rate limiter.
 *
 * Uses the check_rate_limit() Postgres RPC (migration 20260630000002) via
 * supabaseAdmin so the state is persisted across serverless cold starts and
 * across multiple Vercel function instances — unlike the in-process Map that
 * was previously used in the import route.
 *
 * No new packages required; uses the existing @supabase/supabase-js client.
 *
 * Usage:
 *   const result = await checkRateLimit({
 *     key: `import:${userId}`,
 *     maxCount: 5,
 *     windowSeconds: 3600,
 *   });
 *   if (!result.allowed) {
 *     return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *   }
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds?: number };

export interface RateLimitOptions {
  /** Unique bucket key (e.g. "import:{userId}", "brief:{userId}"). */
  key: string;
  /** Maximum requests allowed within the window. */
  maxCount: number;
  /** Rolling window size in seconds. */
  windowSeconds: number;
  /** When true, DB errors deny the request instead of allowing it (mutation safety). */
  failClosed?: boolean;
}

/**
 * Check (and atomically increment if allowed) a rate-limit bucket.
 *
 * Returns `{ allowed: true }` if the request is within the limit.
 * Returns `{ allowed: false, retryAfterSeconds }` if the cap is exceeded.
 *
 * Read endpoints default to fail-open (DB hiccup shouldn't block reads).
 * Mutation endpoints MUST pass `failClosed: true` so a DB error denies the
 * write rather than allowing unbounded requests.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, maxCount, windowSeconds, failClosed = false } = options;

  let allowed: boolean;

  try {
    const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: key,
      p_max_count: maxCount,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("[rate-limiter] RPC error:", error.message);
      if (failClosed) {
        return { allowed: false, retryAfterSeconds: windowSeconds };
      }
      return { allowed: true };
    }

    // The RPC returns a boolean scalar.
    allowed = data === true;
  } catch (err) {
    console.error("[rate-limiter] Unexpected error:", err);
    if (failClosed) {
      return { allowed: false, retryAfterSeconds: windowSeconds };
    }
    return { allowed: true };
  }

  if (!allowed) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  return { allowed: true };
}

// ── Pre-configured limit profiles ────────────────────────────────────────────

/** 5 imports per user per hour. */
export const IMPORT_RATE_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 5,
  windowSeconds: 3600,
};

/** 3 morning briefs per user per 24 hours. */
export const BRIEF_RATE_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 3,
  windowSeconds: 86400,
};

/** 10 portfolio refreshes per user per hour. */
export const REFRESH_RATE_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 10,
  windowSeconds: 3600,
};

/** 20 AI holding explanations per user per hour. */
export const EXPLAIN_RATE_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 20,
  windowSeconds: 3600,
};

/** 5 strategy council memo generations per user per 24 hours. */
export const STRATEGY_COUNCIL_MEMO_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 5,
  windowSeconds: 86400,
};

/** 200 price lookups per user per minute (most are cache hits). */
export const PRICES_RATE_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 200,
  windowSeconds: 60,
};

// ── Standard profiles for bulk application ──────────────────────────────────

/** 60 standard reads per user per minute. */
export const READ_RATE_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 60,
  windowSeconds: 60,
};

/** 30 mutations per user per minute. Fail-closed: DB errors deny the mutation. */
export const MUTATION_RATE_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 30,
  windowSeconds: 60,
  failClosed: true,
};

/** 10 AI-powered requests per user per minute. */
export const AI_RATE_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 10,
  windowSeconds: 60,
};

/** 5 sensitive operations per user per minute (credentials, vault config). Fail-closed. */
export const SENSITIVE_RATE_LIMIT: Omit<RateLimitOptions, "key"> = {
  maxCount: 5,
  windowSeconds: 60,
  failClosed: true,
};
