# CI Workflows

## ci.yml

Runs on every push to `main` and every pull request targeting `main`.

Steps:

1. `npx tsc --noEmit` — TypeScript check across all files
2. `npm run build` — Next.js production build

Required GitHub Secrets (repo Settings → Secrets and variables → Actions):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`EXECUTION_LIVE_MODE` is always `false` in CI — no real orders are placed.
