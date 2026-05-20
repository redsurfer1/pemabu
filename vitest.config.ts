import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', 'tests/user_journey_tests.ts'],
    exclude: ['node_modules', '.next'],

    // Global setup file — runs once before each worker pool spins up.
    // Provides stub env vars required by lib/env.ts's eager publicSchema.parse()
    // so that test files importing withAuth (→ origin.ts → app-url.ts → env.ts)
    // don't fail with a ZodError before any mocks can be registered.
    setupFiles: ['./tests/vitest-setup.ts'],

    // Seed the test worker's process.env before any module is evaluated.
    // These are placeholder values; no real Supabase calls are made in unit tests
    // (the supabase/server and supabase/admin clients are mocked per-test).
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://vitest-placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'vitest-placeholder-anon-key',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
