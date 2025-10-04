-- Criar tabela sales_analysis
CREATE TABLE public.sales_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analysis_requests(id) ON DELETE CASCADE,
  overall_score DECIMAL(3,1) NOT NULL,
  categories JSONB NOT NULL,
  competitive_positioning TEXT,
  sales_methodology_detected TEXT[],
  conversion_probability INTEGER CHECK (conversion_probability >= 0 AND conversion_probability <= 100),
  recommended_actions TEXT[],
  comparative_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(analysis_id)
);

-- Criar índices
CREATE INDEX idx_sales_analysis_analysis_id ON sales_analysis(analysis_id);
CREATE INDEX idx_sales_analysis_created_at ON sales_analysis(created_at DESC);

-- Habilitar RLS
ALTER TABLE sales_analysis ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas suas próprias análises
CREATE POLICY "Users can view own sales analyses"
ON sales_analysis FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM analysis_requests
    WHERE analysis_requests.id = sales_analysis.analysis_id
    AND analysis_requests.user_id = auth.uid()
  )
);

-- Política para admins verem todas as análises
CREATE POLICY "Admins can view all sales analyses"
ON sales_analysis FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Política para service inserir análises
CREATE POLICY "Service can insert sales analyses"
ON sales_analysis FOR INSERT
WITH CHECK (true);