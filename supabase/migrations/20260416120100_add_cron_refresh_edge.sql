-- Enable pg_cron extension (requires Supabase Pro or above)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the edge function nightly at 01:00 UTC
-- Uses net.http_post which requires the pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'nightly-portfolio-signal-refresh',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url')
           || '/functions/v1/refresh-portfolio-signals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pemabu-cron-secret',
        current_setting('app.pemabu_cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- To remove the job if needed:
-- SELECT cron.unschedule('nightly-portfolio-signal-refresh');
