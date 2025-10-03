-- Adicionar valor 'processing' ao enum analysis_status
ALTER TYPE analysis_status ADD VALUE IF NOT EXISTS 'processing';

-- Adicionar campos para processamento paralelo e retry
ALTER TABLE analysis_requests 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE;

-- Limpar análises travadas antigas (mais de 30 minutos pendentes)
UPDATE analysis_requests
SET status = 'failed',
    metrics = jsonb_build_object(
      'error', 'Análise expirada',
      'details', 'Esta análise ficou muito tempo na fila e foi cancelada automaticamente',
      'timestamp', NOW()
    )
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '30 minutes'
  AND id != '5cb9db77-7018-4adb-b0c2-e3e6f41141e4';

-- Criar índice para melhorar performance de queries de processamento
CREATE INDEX IF NOT EXISTS idx_analysis_requests_processing 
ON analysis_requests(status, processing_started_at, created_at);