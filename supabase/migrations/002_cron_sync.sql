-- Enable pg_cron extension for scheduled jobs
-- Run this in Supabase Dashboard > SQL Editor

-- Schedule sync-orders every 15 minutes
-- (requires pg_cron to be enabled in Supabase project settings)
select cron.schedule(
  'sync-marketplace-orders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
