-- FASE 1: Adicionar novos campos na tabela analysis_requests

-- Adicionar novos campos
ALTER TABLE analysis_requests 
ADD COLUMN IF NOT EXISTS competitor_description TEXT,
ADD COLUMN IF NOT EXISTS competitor_url TEXT,
ADD COLUMN IF NOT EXISTS investigation_goals TEXT,
ADD COLUMN IF NOT EXISTS ai_gender TEXT DEFAULT 'neutral' CHECK (ai_gender IN ('male', 'female', 'neutral')),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Adicionar comentário explicativo
COMMENT ON COLUMN analysis_requests.competitor_description IS 'Descrição detalhada do concorrente fornecida pelo usuário';
COMMENT ON COLUMN analysis_requests.competitor_url IS 'URL opcional do site do concorrente';
COMMENT ON COLUMN analysis_requests.investigation_goals IS 'Objetivos específicos que o usuário deseja descobrir durante a análise';
COMMENT ON COLUMN analysis_requests.ai_gender IS 'Gênero da persona da IA: male, female ou neutral';
COMMENT ON COLUMN analysis_requests.metadata IS 'Metadados adicionais incluindo contadores de reativação';

-- Atualizar enum persona_type com novos valores
ALTER TYPE persona_type ADD VALUE IF NOT EXISTS 'ideal_client';
ALTER TYPE persona_type ADD VALUE IF NOT EXISTS 'curious_client';
ALTER TYPE persona_type ADD VALUE IF NOT EXISTS 'difficult_client';

-- Adicionar comentário no analysis_depth para documentar os novos níveis
COMMENT ON COLUMN analysis_requests.analysis_depth IS 'Níveis: quick (3-5 interações, 30min), intermediate (5-10 interações, 24h), deep (10-15 interações, 5 dias)';