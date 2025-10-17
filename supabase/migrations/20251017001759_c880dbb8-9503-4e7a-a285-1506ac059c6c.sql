-- ============= CORREÇÃO 1: Atualizar timeout das análises existentes =============
UPDATE analysis_requests
SET timeout_minutes = 120
WHERE status IN ('pending', 'processing', 'chatting')
  AND (timeout_minutes IS NULL OR timeout_minutes != 120);

-- ============= CORREÇÃO 2: Melhorar trigger com retry =============
CREATE OR REPLACE FUNCTION public.trigger_monitor_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Apenas disparar se for mensagem de usuário não processada
  IF NEW.role = 'user' AND (NEW.metadata->>'processed')::boolean = false THEN
    -- Tentar 3 vezes com pequeno delay
    FOR i IN 1..3 LOOP
      BEGIN
        PERFORM net.http_post(
          url := 'https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/monitor-conversations',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0am5ibXZmampwaGxqY2F2cm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTAxMTYsImV4cCI6MjA3NDk4NjExNn0.S6BQiIp1yYE6sfT9jyAMBLXdaSsL-KvlgNlWuU3X0hk"}'::jsonb,
          body := json_build_object('analysis_id', NEW.analysis_id)::jsonb,
          timeout_milliseconds := 5000
        );
        EXIT; -- Sucesso, sair do loop
      EXCEPTION WHEN OTHERS THEN
        IF i = 3 THEN
          RAISE WARNING 'Failed to trigger monitor-conversations after 3 attempts for analysis_id=%: %', NEW.analysis_id, SQLERRM;
        ELSE
          PERFORM pg_sleep(0.5); -- Aguardar 500ms antes de tentar novamente
        END IF;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- ============= CORREÇÃO 3: Cron job para processar mensagens órfãs =============
SELECT cron.schedule(
  'process-orphan-messages',
  '* * * * *', -- A cada 1 minuto
  $$
  SELECT net.http_post(
    url := 'https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/process-orphan-messages',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0am5ibXZmampwaGxqY2F2cm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTAxMTYsImV4cCI6MjA3NDk4NjExNn0.S6BQiIp1yYE6sfT9jyAMBLXdaSsL-KvlgNlWuU3X0hk"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);