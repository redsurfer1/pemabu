"use client";

/**
 * Root global error boundary — catches unhandled render errors outside
 * nested route error boundaries (e.g. root layout failures).
 * Must define its own <html> and <body> per Next.js App Router spec.
 * https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "1rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#0D1B2A",
          color: "#e5e7eb",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: "#fff" }}>
            Something went wrong
          </h1>
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.875rem",
              color: "#9ca3af",
              maxWidth: "28rem",
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred. The issue has been reported and our team will
            investigate. You can try again or return to the dashboard.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "0.75rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#6b7280",
              }}
            >
              Error reference: {error.digest}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              borderRadius: "0.5rem",
              border: "1px solid rgba(14, 165, 233, 0.4)",
              backgroundColor: "rgba(12, 74, 110, 0.3)",
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              color: "#e0f2fe",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/dashboard"
            style={{
              borderRadius: "0.5rem",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              color: "#d1d5db",
              textDecoration: "none",
            }}
          >
            Go to dashboard
          </a>
        </div>
      </body>
    </html>
  );
}
