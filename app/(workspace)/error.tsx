"use client";

/**
 * Workspace error boundary — catches unhandled render errors in any
 * workspace route (dashboard, portfolio, workbook, marketplace, etc.)
 * and reports them to Sentry before showing a user-friendly fallback.
 *
 * Next.js automatically renders this file when a route segment throws
 * an unhandled exception during rendering.
 * https://nextjs.org/docs/app/api-reference/file-conventions/error
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface WorkspaceErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WorkspaceError({ error, reset }: WorkspaceErrorProps) {
  useEffect(() => {
    // Report to Sentry — strip user PII before sending (handled by beforeSend in sentry.client.config.ts).
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
        <p className="text-sm text-gray-400 max-w-md">
          An unexpected error occurred. The issue has been reported and our team will investigate.
          You can try refreshing the page or come back later.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-gray-600">
            Error reference: {error.digest}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-sky-500/40 bg-sky-950/30 px-5 py-2 text-sm text-sky-100 hover:bg-sky-950/50 transition-colors"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
