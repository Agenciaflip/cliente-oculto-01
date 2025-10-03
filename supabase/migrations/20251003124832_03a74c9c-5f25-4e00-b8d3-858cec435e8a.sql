-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to run monitor-conversations every 30 seconds
SELECT cron.schedule(
  'monitor-conversations-every-30s',
  '*/30 * * * * *',
  $$
  SELECT net.http_post(
    url:='https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/monitor-conversations',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0am5ibXZmampwaGxqY2F2cm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTAxMTYsImV4cCI6MjA3NDk4NjExNn0.S6BQiIp1yYE6sfT9jyAMBLXdaSsL-KvlgNlWuU3X0hk"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);