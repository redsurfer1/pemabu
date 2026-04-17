# refresh-portfolio-signals

Supabase Edge Function — nightly portfolio signal refresh.
Scheduled via pg_cron at 01:00 UTC.

## Deploy

```bash
supabase functions deploy refresh-portfolio-signals \
  --project-ref YOUR_PROJECT_REF
```

## Required secrets (set via Supabase dashboard or CLI)

```bash
supabase secrets set PEMABU_CRON_SECRET=your_secret_here
supabase secrets set NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Manual trigger

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-portfolio-signals \
  -H "x-pemabu-cron-secret: your_secret_here"
```

## Local development

```bash
supabase functions serve refresh-portfolio-signals --env-file .env.local
```
