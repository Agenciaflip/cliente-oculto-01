-- 1. Aumentar timeout padrão de 15 para 120 minutos (2 horas)
ALTER TABLE analysis_requests 
ALTER COLUMN timeout_minutes SET DEFAULT 120;

-- Atualizar análises existentes que ainda estão ativas
UPDATE analysis_requests 
SET timeout_minutes = 120 
WHERE status IN ('pending', 'processing', 'chatting');

-- 2. Adicionar campo para agendamento
ALTER TABLE analysis_requests 
ADD COLUMN scheduled_start_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para buscar análises agendadas que precisam iniciar
CREATE INDEX idx_analysis_requests_scheduled 
ON analysis_requests(scheduled_start_at, status) 
WHERE scheduled_start_at IS NOT NULL AND status = 'pending';

-- 3. Configurar pg_cron para processar análises agendadas a cada 5 minutos
SELECT cron.schedule(
  'process-scheduled-analyses',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/process-analysis',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0am5ibXZmampwaGxqY2F2cm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTAxMTYsImV4cCI6MjA3NDk4NjExNn0.S6BQiIp1yYE6sfT9jyAMBLXdaSsL-KvlgNlWuU3X0hk"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);