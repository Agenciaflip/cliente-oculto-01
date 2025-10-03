-- ============================================
-- CLIENTE OCULTO AI - SCHEMA OTIMIZADO
-- ============================================

-- Enum para tipos de assinatura
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium');

-- Enum para status da análise
CREATE TYPE analysis_status AS ENUM (
  'pending',      -- Aguardando início
  'researching',  -- Pesquisando empresa
  'chatting',     -- Conversando via WhatsApp
  'analyzing',    -- Gerando métricas
  'completed',    -- Finalizada
  'failed'        -- Falhou
);

-- Enum para tipos de persona
CREATE TYPE persona_type AS ENUM (
  'interested',     -- Cliente interessado genérico
  'price_hunter',   -- Caçador de preço
  'competitor',     -- Concorrente disfarçado
  'custom'          -- Personalizado
);

-- ============================================
-- TABELA: profiles
-- Estende auth.users com dados do usuário
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier subscription_tier DEFAULT 'free' NOT NULL,
  credits_remaining INTEGER DEFAULT 5 NOT NULL,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================
-- TABELA: subscriptions
-- Gerencia assinaturas Stripe
-- ============================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  plan_tier subscription_tier NOT NULL,
  status TEXT NOT NULL, -- active, canceled, past_due
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id) -- Apenas uma assinatura ativa por usuário
);

-- ============================================
-- TABELA: analysis_requests
-- Armazena cada análise de cliente oculto
-- ============================================
CREATE TABLE public.analysis_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Configuração da análise
  target_phone TEXT NOT NULL,
  company_name TEXT,
  persona persona_type DEFAULT 'interested' NOT NULL,
  analysis_depth TEXT DEFAULT 'quick' NOT NULL, -- quick ou deep
  
  -- Estado da análise
  status analysis_status DEFAULT 'pending' NOT NULL,
  
  -- Dados de pesquisa (Perplexity)
  research_data JSONB,
  
  -- Estratégia de perguntas gerada pela IA
  questions_strategy JSONB,
  
  -- Métricas finais
  metrics JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_analysis_user_id ON public.analysis_requests(user_id);
CREATE INDEX idx_analysis_status ON public.analysis_requests(status);
CREATE INDEX idx_analysis_created_at ON public.analysis_requests(created_at DESC);

-- ============================================
-- TABELA: conversation_messages
-- Armazena cada mensagem da conversa
-- (Separado para melhor performance e realtime)
-- ============================================
CREATE TABLE public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES public.analysis_requests(id) ON DELETE CASCADE NOT NULL,
  
  -- Dados da mensagem
  role TEXT NOT NULL, -- 'ai' ou 'target'
  content TEXT NOT NULL,
  
  -- Metadata opcional
  metadata JSONB,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para queries rápidas
CREATE INDEX idx_messages_analysis_id ON public.conversation_messages(analysis_id);
CREATE INDEX idx_messages_created_at ON public.conversation_messages(created_at);

-- ============================================
-- TABELA: usage_tracking
-- Rastreia uso mensal por usuário
-- ============================================
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL, -- Formato: "2025-01"
  analyses_count INTEGER DEFAULT 0 NOT NULL,
  analyses_limit INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, month)
);

-- ============================================
-- TRIGGER: Atualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGER: Criar profile automaticamente ao signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, subscription_tier, credits_remaining)
  VALUES (NEW.id, 'free', 5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles: usuários veem apenas o próprio perfil
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Subscriptions: usuários veem apenas própria assinatura
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Analysis Requests: usuários gerenciam próprias análises
ALTER TABLE public.analysis_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
  ON public.analysis_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own analyses"
  ON public.analysis_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON public.analysis_requests FOR UPDATE
  USING (auth.uid() = user_id);

-- Conversation Messages: acesso via analysis_id
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from own analyses"
  ON public.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_requests
      WHERE id = conversation_messages.analysis_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert messages"
  ON public.conversation_messages FOR INSERT
  WITH CHECK (true); -- Edge functions vão inserir via service_role

-- Usage Tracking: usuários veem apenas próprio uso
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- REALTIME: Habilitar para updates ao vivo
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;