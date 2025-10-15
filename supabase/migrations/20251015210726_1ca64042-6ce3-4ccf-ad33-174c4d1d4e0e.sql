-- Adicionar coluna evolution_instance para isolar conversas por instância
ALTER TABLE analysis_requests 
ADD COLUMN evolution_instance TEXT;

-- Atualizar registros existentes baseado no ai_gender
UPDATE analysis_requests 
SET evolution_instance = CASE 
  WHEN ai_gender = 'female' THEN 'clienteoculto-mulher'
  ELSE 'felipedisparo'
END;

-- Definir como NOT NULL após população
ALTER TABLE analysis_requests 
ALTER COLUMN evolution_instance SET NOT NULL;

-- Criar índice para performance nas buscas por instância e status
CREATE INDEX idx_analysis_requests_instance_status 
ON analysis_requests(evolution_instance, status);