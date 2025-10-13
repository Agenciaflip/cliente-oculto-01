-- FASE 7: Adicionar colunas para rastreamento de reativações
ALTER TABLE analysis_requests 
ADD COLUMN IF NOT EXISTS first_reactivation_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS first_reactivation_sent_at TIMESTAMPTZ;