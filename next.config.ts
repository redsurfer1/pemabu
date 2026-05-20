import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/font",
    "@react-pdf/layout",
    "@react-pdf/render",
    "@react-pdf/pdfkit",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project are optional — set them in CI/CD env if
  // you want source-map uploads (SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN).
  // Without them, error monitoring still works; stack traces just show
  // minified names in the Sentry UI.
  silent: true, // suppress CLI output during next build

  // Upload source maps only when SENTRY_AUTH_TOKEN is present in the build env.
  // This avoids failing local/preview builds that lack the token.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Automatically tree-shake Sentry debug code in production builds.
  disableLogger: true,

  // Do not widen the bundle with unnecessary integrations.
  widenClientFileUpload: false,

  // Tunnel Sentry requests through the Next.js server to avoid ad-blockers
  // that block sentry.io. Routes requests through /api/monitoring.
  tunnelRoute: "/api/monitoring",

  // Upload source maps to Sentry and exclude them from the client bundle.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
