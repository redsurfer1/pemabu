/**
 * tests/vitest-setup.ts
 *
 * Global Vitest setup — runs inside each test worker before any test file
 * is evaluated. Registered via vitest.config.ts → test.setupFiles.
 *
 * Responsibilities:
 *  1. Mock `server-only` globally so route-handler modules that import it
 *     don't throw in the Node test environment (Next.js strips this guard
 *     at build time; Vitest does not).
 *  2. Provide any vi.stubGlobal / global afterEach cleanup that every suite
 *     needs, keeping individual test files free of boilerplate.
 *
 * NOTE: The public env-var stubs (NEXT_PUBLIC_SUPABASE_URL, etc.) are set
 * via vitest.config.ts → test.env, which seeds process.env *before* worker
 * initialisation. That is the correct place for eager module-level parses
 * like lib/env.ts's publicSchema.parse(process.env).
 */

import { vi, afterEach } from "vitest";

// ── Mock `server-only` ────────────────────────────────────────────────────────
// Next.js's `server-only` package throws when imported outside of a Server
// Component context. In Vitest's Node environment there is no such context,
// so we replace it with a no-op module. Individual test files that already
// have vi.mock("server-only", () => ({})) remain compatible — Vitest dedupes.
vi.mock("server-only", () => ({}));

// ── Reset all mocks between tests ─────────────────────────────────────────────
// Prevents mock call counts / return values leaking across test cases.
// Tests that need a specific reset strategy can call vi.clearAllMocks()
// themselves without conflicting with this global hook.
afterEach(() => {
  vi.clearAllMocks();
});
