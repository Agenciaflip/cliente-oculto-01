-- FASE 1: Adicionar colunas para tornar Perplexity mais assertivo e tracking visual

ALTER TABLE public.analysis_requests
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS business_segment TEXT,
ADD COLUMN IF NOT EXISTS processing_stage TEXT DEFAULT 'awaiting_research';

-- Atualizar registros existentes para ter um processing_stage baseado no status atual
UPDATE public.analysis_requests
SET processing_stage = CASE
  WHEN status = 'completed' THEN 'completed'
  WHEN status = 'chatting' THEN 'chatting'
  WHEN status = 'processing' THEN 'researching'
  WHEN status = 'failed' THEN 'failed'
  ELSE 'awaiting_research'
END
WHERE processing_stage IS NULL;