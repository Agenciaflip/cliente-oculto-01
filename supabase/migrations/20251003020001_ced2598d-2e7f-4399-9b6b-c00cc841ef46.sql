-- Adicionar campos de controle de timeout e última atividade
ALTER TABLE analysis_requests
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS timeout_minutes INTEGER DEFAULT 15;

-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron job para processar análises pendentes (a cada 30 segundos)
SELECT cron.schedule(
  'process-pending-analyses',
  '*/30 * * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/process-analysis',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Cron job para finalizar conversas inativas (a cada 5 minutos)
SELECT cron.schedule(
  'finalize-inactive-chats',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/process-analysis',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "finalize_inactive"}'::jsonb
  ) AS request_id;
  $$
);