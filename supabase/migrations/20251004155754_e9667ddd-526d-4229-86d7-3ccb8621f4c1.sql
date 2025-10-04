-- Adicionar colunas necessárias na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Criar tabela de métricas de análise se não existir
CREATE TABLE IF NOT EXISTS public.analysis_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analysis_requests(id) ON DELETE CASCADE,
  experience_score DECIMAL(3,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(analysis_id)
);

-- Habilitar RLS
ALTER TABLE public.analysis_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para analysis_metrics
CREATE POLICY "Admins can view all metrics"
  ON public.analysis_metrics FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own metrics"
  ON public.analysis_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_requests
      WHERE analysis_requests.id = analysis_metrics.analysis_id
        AND analysis_requests.user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert metrics"
  ON public.analysis_metrics FOR INSERT
  WITH CHECK (true);