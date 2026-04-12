-- Enable pg_cron and pg_net extensions for scheduled Edge Function calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the fetch-usgs-data Edge Function every 15 minutes.
--
-- IMPORTANT: Replace <YOUR_PROJECT_REF> with your Supabase project reference ID
-- (found in Supabase dashboard URL: https://supabase.com/dashboard/project/<ref>)
-- and <YOUR_SERVICE_ROLE_KEY> with the service_role key from Settings → API.
--
-- Alternatively, set this up in the Supabase Dashboard:
-- Database → Extensions → pg_cron → then run the SELECT below in the SQL editor.

SELECT cron.schedule(
  'fetch-usgs-data-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/fetch-usgs-data',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
