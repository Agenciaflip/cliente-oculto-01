# 🏗️ Arquitetura do Sistema Cliente Oculto

## 📋 Visão Geral

Sistema automatizado para realizar análises de "cliente oculto" em WhatsApp, onde uma IA conversa com vendedores para avaliar qualidade de atendimento, técnicas de vendas e alcance de objetivos.

### Fluxo Principal

```
1. Usuário cria análise no sistema → Preenche formulário com objetivos
2. Sistema envia mensagem inicial via WhatsApp (Evolution API)
3. IA conversa naturalmente com o vendedor
4. Sistema agrupa mensagens (10-15s) antes de responder
5. Após resposta, define próximo follow-up se vendedor não responder
6. Continua até: vendedor desistir, timeout, ou 3 follow-ups sem resposta
7. Gera análise final com métricas e avaliação de técnicas
```

---

## 🎨 Frontend (React + Vite + TypeScript)

### Localização
```
/src/
  ├── pages/           # Páginas principais
  ├── components/      # Componentes reutilizáveis
  ├── integrations/    # Supabase client
  └── lib/             # Utilitários
```

### Componentes Principais

#### 1. **Criar Análise** (`/src/pages/Index.tsx`)
- Formulário para configurar análise
- Campos:
  - Nome do cliente oculto
  - Telefone do vendedor (WhatsApp)
  - Objetivos da conversa (texto livre)
  - Profundidade (quick/intermediate/deep)
  - Instância Evolution (cliente oculto homem/mulher)

#### 2. **Lista de Análises** (`/src/pages/Index.tsx`)
- Grid de cards mostrando análises
- Status: pending/in_progress/completed/failed
- Contador de mensagens
- Timer para próxima ação

#### 3. **Detalhes da Análise** (`/src/pages/AnalysisDetails.tsx`)
- **Chat em tempo real** (mensagens usuário/IA)
- **Timer de próxima resposta** (`NextResponseTimer.tsx`)
  - Mostra "Próxima resposta em: Xmin Ys"
  - Ou "Próximo follow-up em: Xh Ymin" (com tentativas restantes)
- **Informações da análise** (objetivos, profundidade, telefone)
- **Métricas em tempo real** (total mensagens, tempo decorrido)
- **Debug Logs** (painel flutuante, Ctrl+Shift+D)
- **Análise final** (após completar)

#### 4. **Debug Logs** (`/src/components/DebugLogs.tsx`)
- Painel flutuante no canto inferior direito
- Logs em tempo real via Supabase Realtime
- Níveis: info/warning/error/success
- Expandível para ver dados JSON
- Atalho: Ctrl+Shift+D

### Comunicação com Backend

```typescript
// Supabase Client
import { supabase } from "@/integrations/supabase/client";

// Realtime subscriptions
const channel = supabase
  .channel(`analysis-${id}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'analysis_requests'
  }, (payload) => {
    // Atualiza UI em tempo real
  })
  .subscribe();
```

---

## ⚙️ Backend (Supabase Edge Functions - Deno)

### Localização
```
/supabase/functions/
  ├── handle-webhook/           # Recebe mensagens do WhatsApp
  ├── monitor-conversations/    # Processa conversas e gera respostas IA
  └── _shared/                  # Código compartilhado
      ├── supabaseClient.ts     # Cliente Supabase
      ├── evolutionApi.ts       # Funções Evolution API
      └── config/
          └── conversation-styles.ts  # Estilos de conversa A/B
```

### Funções Principais

#### 1. **handle-webhook** (Webhook do Evolution API)

**Trigger:** Evolution API envia POST quando mensagem chega

**Responsabilidades:**
```typescript
1. Recebe payload do Evolution
2. Valida que é mensagem de texto (não mídia)
3. Busca analysis_request ativa para o telefone
4. Cria registro na tabela messages (role: 'user')
5. Define next_ai_response_at (10-15s aleatório) → JANELA DE AGRUPAMENTO
6. Retorna 200 OK (não processa IA aqui)
```

**Código Principal:**
```typescript
// Janela de agrupamento: 10-15s
const randomDelaySeconds = Math.floor(Math.random() * 5) + 10;
const nextAiResponseAt = new Date(Date.now() + randomDelaySeconds * 1000).toISOString();

await supabase
  .from('analysis_requests')
  .update({
    next_ai_response_at: nextAiResponseAt,
    metadata: {
      ...metadata,
      next_ai_response_source: 'webhook_planned'
    }
  })
  .eq('id', analysis.id);
```

#### 2. **monitor-conversations** (Edge Function + Cron Job)

**Trigger:** Cron job a cada 30 segundos

**Responsabilidades:**
```typescript
1. Busca análises com status 'in_progress'
2. Para cada análise:
   a. Verifica se há janela de agrupamento ativa (next_ai_response_at)
      → Se SIM: RETORNA sem processar (aguarda mais mensagens)
      → Se NÃO: Continua

   b. Busca mensagens não processadas (processed: false, role: 'user')

   c. Se há mensagens:
      - Agrupa todas as mensagens do vendedor
      - Gera resposta IA (OpenAI GPT-4o)
      - Quebra resposta em chunks (max 1000 caracteres)
      - Envia via Evolution API com typing indicators
      - Salva mensagens IA no banco (role: 'ai')
      - Define next_follow_up_at para tentar novamente
      - Marca mensagens como processed: true

   d. Se NÃO há mensagens:
      - Verifica se passou do next_follow_up_at
      - Se SIM e follow_ups_sent < max_follow_ups:
        → Gera follow-up progressivo
        → Envia via WhatsApp
        → Incrementa follow_ups_sent
        → Define novo next_follow_up_at
      - Se follow_ups_sent >= 3:
        → Encerra conversa (status: completed)
        → Gera análise final

   e. Timeout check:
      - Se passou de 2h sem resposta → Encerra conversa
```

**Estrutura de Decisão:**
```
┌─────────────────────────────────┐
│ monitor-conversations executa   │
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│ Busca análises 'in_progress'   │
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│ Para cada análise:              │
│ next_ai_response_at > now?      │
└───────┬─────────────────────┬───┘
        │                     │
      SIM                    NÃO
        │                     │
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│ RETORNA       │    │ Continua processando│
│ (aguardando   │    └────────┬───────────┘
│  janela)      │             │
└───────────────┘             ▼
                  ┌──────────────────────┐
                  │ Há mensagens novas?  │
                  └──────┬────────────┬──┘
                         │            │
                       SIM          NÃO
                         │            │
                         ▼            ▼
          ┌──────────────────┐  ┌─────────────────┐
          │ GERA RESPOSTA IA │  │ Verifica follow-up│
          │ - Agrupa msgs    │  │ next_follow_up_at?│
          │ - Chama OpenAI   │  └────────┬──────────┘
          │ - Envia WhatsApp │           │
          │ - Define follow-up│          ▼
          └──────────────────┘  ┌──────────────────┐
                                │ Passou do horário?│
                                └────┬──────────┬───┘
                                   SIM        NÃO
                                     │          │
                                     ▼          ▼
                        ┌────────────────┐  ┌────────┐
                        │ follow_ups < 3?│  │ Aguarda│
                        └──┬──────────┬──┘  └────────┘
                         SIM        NÃO
                           │          │
                           ▼          ▼
                  ┌────────────┐  ┌──────────┐
                  │ Envia      │  │ Encerra  │
                  │ follow-up  │  │ conversa │
                  └────────────┘  └──────────┘
```

**Logging System:**
```typescript
// Salva logs no metadata da análise
await saveDebugLog(supabase, analysisId, 'info', 'Monitor invocado');
await saveDebugLog(supabase, analysisId, 'warning', '🛑 Janela ativa detectada!');
await saveDebugLog(supabase, analysisId, 'success', '✅ Mensagens agrupadas', { count: 2 });
```

---

## 🗄️ Banco de Dados (PostgreSQL via Supabase)

### Tabelas Principais

#### **analysis_requests**
```sql
CREATE TABLE analysis_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,

  -- Configuração
  customer_name TEXT,
  customer_phone TEXT,
  objectives TEXT[],  -- Objetivos da conversa
  analysis_depth TEXT,  -- 'quick' | 'intermediate' | 'deep'
  evolution_instance TEXT,  -- 'clienteoculto-homem' | 'clienteoculto-mulher'

  -- Estado
  status TEXT,  -- 'pending' | 'in_progress' | 'completed' | 'failed'
  next_ai_response_at TIMESTAMP,  -- Quando processar próxima resposta

  -- Metadata (JSONB)
  metadata JSONB,
  /*
    metadata: {
      next_ai_response_source: 'webhook_planned' | 'ai_planned',
      next_follow_up_at: '2025-10-25T15:30:00Z',
      follow_ups_sent: 0,
      max_follow_ups: 3,
      conversation_style: 'casual' | 'balanced' | 'direct' | 'detailed',
      debug_logs: [
        { timestamp, level, message, data }
      ]
    }
  */

  -- Análise Final
  analysis_result JSONB,
  /*
    analysis_result: {
      summary: "Análise geral...",
      sales_techniques: ["técnica 1", "técnica 2"],
      positive_points: ["ponto 1", "ponto 2"],
      improvement_areas: ["área 1", "área 2"],
      objective_completion: { "objetivo 1": true, "objetivo 2": false },
      overall_score: 8.5
    }
  */

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### **messages**
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  analysis_id UUID REFERENCES analysis_requests,

  role TEXT,  -- 'user' | 'ai' | 'system'
  content TEXT,

  processed BOOLEAN DEFAULT FALSE,  -- Se já foi processada pelo monitor

  -- Metadata WhatsApp
  whatsapp_message_id TEXT,
  chunk_index INTEGER,  -- Para mensagens quebradas em partes

  created_at TIMESTAMP
);
```

### Índices Importantes
```sql
CREATE INDEX idx_analysis_status ON analysis_requests(status);
CREATE INDEX idx_analysis_next_response ON analysis_requests(next_ai_response_at);
CREATE INDEX idx_messages_analysis ON messages(analysis_id, created_at);
CREATE INDEX idx_messages_unprocessed ON messages(analysis_id, processed) WHERE processed = FALSE;
```

---

## 🔌 Integrações Externas

### 1. **Evolution API** (WhatsApp)

**Base URL:** `https://evolution-nova-versao-evolution-api.78s68s.easypanel.host`

**API Key:** `429683C434535345**10F7D57E11`

**Instâncias:**
- `clienteoculto-mulher` (551132300858 - Fernanda S.) ✅ Ativa
- `clienteoculto-homem` ❌ Precisa criar

#### Endpoints Usados:

**Enviar Mensagem:**
```typescript
POST /message/sendText/{instance}
Headers: { apikey: API_KEY }
Body: {
  number: "5511999999999",
  text: "Mensagem aqui"
}
```

**Enviar Typing Indicator:**
```typescript
POST /chat/presence/{instance}
Headers: { apikey: API_KEY }
Body: {
  number: "5511999999999",
  state: "composing",  // ou "available"
  delay: 5000
}
```

**Webhook de Mensagens Recebidas:**
```
POST /supabase/functions/v1/handle-webhook
Body: {
  event: "messages.upsert",
  data: {
    key: { remoteJid: "5511999999999@s.whatsapp.net", id: "..." },
    message: { conversation: "Texto da mensagem" }
  }
}
```

### 2. **OpenAI API** (GPT-4o)

**Endpoint:** `https://api.openai.com/v1/chat/completions`

**Modelo:** `gpt-4o` (ou `gpt-4o-mini` para quick)

**Uso:**
```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: PROMPT_SISTEMA },
      ...historicoConversa
    ],
    temperature: 0.8,
    max_tokens: 500
  })
});
```

---

## 🔄 Fluxo de Dados Detalhado

### Cenário 1: Vendedor responde (mensagens agrupadas)

```
TEMPO 0s
├─ Vendedor envia: "Sim"
│  ├─ Evolution API → POST /handle-webhook
│  ├─ Cria message (role: user, processed: false)
│  └─ Define next_ai_response_at = now + 12s

TEMPO 3s
├─ Vendedor envia: "Oque precisa"
│  ├─ Evolution API → POST /handle-webhook
│  ├─ Cria message (role: user, processed: false)
│  └─ Atualiza next_ai_response_at = now + 14s (nova janela)

TEMPO 17s (14s + 3s)
├─ monitor-conversations executa (cron 30s)
│  ├─ Verifica: next_ai_response_at (TEMPO 17s) <= now? SIM
│  ├─ Busca mensagens unprocessed: ["Sim", "Oque precisa"]
│  ├─ Agrupa as 2 mensagens
│  ├─ Gera resposta IA considerando AMBAS
│  ├─ Resposta: "Oi! Que bom que você tá interessado..."
│  ├─ Envia typing indicator (5s)
│  ├─ Envia mensagem via Evolution
│  ├─ Cria message (role: ai, processed: true)
│  ├─ Marca ["Sim", "Oque precisa"] como processed: true
│  ├─ Define next_follow_up_at = now + 1h30min
│  └─ Salva debug logs
```

### Cenário 2: Vendedor não responde (follow-up)

```
TEMPO 0s
├─ IA enviou última mensagem
│  └─ Definiu next_follow_up_at = now + 1h30min

TEMPO 1h30min
├─ monitor-conversations executa
│  ├─ Verifica: next_ai_response_at? NÃO
│  ├─ Busca mensagens unprocessed: []
│  ├─ Verifica: next_follow_up_at <= now? SIM
│  ├─ Verifica: follow_ups_sent (0) < max_follow_ups (3)? SIM
│  ├─ Gera follow-up nível 1 (gentil)
│  ├─ "Oi! Conseguiu pensar sobre o que conversamos?"
│  ├─ Envia via Evolution
│  ├─ Incrementa follow_ups_sent = 1
│  ├─ Define novo next_follow_up_at = now + 4h
│  └─ Salva debug log

TEMPO 5h30min (1h30min + 4h)
├─ monitor-conversations executa
│  ├─ Verifica: follow_ups_sent (1) < 3? SIM
│  ├─ Gera follow-up nível 2 (médio)
│  ├─ "E aí, tudo bem? Ficou alguma dúvida?"
│  ├─ Incrementa follow_ups_sent = 2
│  └─ Define next_follow_up_at = now + 8h

TEMPO 13h30min (5h30min + 8h)
├─ monitor-conversations executa
│  ├─ Verifica: follow_ups_sent (2) < 3? SIM
│  ├─ Gera follow-up nível 3 (final)
│  ├─ "Beleza, se precisar de algo é só chamar!"
│  ├─ Incrementa follow_ups_sent = 3
│  ├─ follow_ups_sent >= max_follow_ups → ENCERRA
│  ├─ Gera análise final
│  └─ status = 'completed'
```

---

## 🚀 Deploy e Configuração

### Variáveis de Ambiente

**Frontend (.env.local):**
```bash
VITE_SUPABASE_URL=https://ltjnbmvfjjphljcavrmp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Backend (Supabase Secrets):**
```bash
OPENAI_API_KEY=sk-...
EVOLUTION_API_KEY=429683C434535345**10F7D57E11
EVOLUTION_API_URL=https://evolution-nova-versao-evolution-api.78s68s.easypanel.host
```

### Cron Job (Supabase)
```sql
SELECT cron.schedule(
  'monitor-conversations',
  '*/30 * * * * *',  -- A cada 30 segundos
  $$
  SELECT net.http_post(
    url := 'https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/monitor-conversations',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  );
  $$
);
```

### Webhook Evolution API
```
URL: https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook
Eventos: messages.upsert
```

---

## 📊 Métricas e Monitoramento

### Debug Logs (Em Tempo Real)
- Armazenado em `analysis_requests.metadata.debug_logs`
- Exibido no componente `DebugLogs.tsx`
- Atualização via Supabase Realtime

### Logs Importantes:
```
✅ "✅✅✅ PROCESSANDO 2 MENSAGENS AGRUPADAS"
🛑 "🛑🛑🛑 JANELA ATIVA DETECTADA!"
✂️ "✂️ QUEBRANDO RESPOSTA EM 2 CHUNK(S)"
🤖 "🤖 RESPOSTA IA GERADA"
📤 "📤 Chunk 1 enviado via WhatsApp"
🔔 "🔔 Follow-up #1 enviado"
```

### Supabase CLI Logs:
```bash
supabase functions logs monitor-conversations --project-ref ltjnbmvfjjphljcavrmp
```

---

## 🔐 Segurança

### Row Level Security (RLS)
```sql
-- Usuários só veem suas próprias análises
CREATE POLICY "Users see own analyses"
ON analysis_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Usuários só criam análises para si
CREATE POLICY "Users create own analyses"
ON analysis_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Validações
- ✅ Telefone no formato correto (55 + DDD + número)
- ✅ Objetivos não vazios
- ✅ Evolution instance válida
- ✅ Webhook só aceita payloads Evolution válidos

---

## 🧪 Testes

### Como Testar Agrupamento de Mensagens:

1. Criar análise no sistema
2. Abrir painel Debug Logs (Ctrl+Shift+D)
3. Enviar 2 mensagens seguidas no WhatsApp (intervalo < 5s)
4. Verificar logs:
   - Deve aparecer: "🛑 JANELA ATIVA DETECTADA!"
   - Após 10-15s: "✅ PROCESSANDO 2 MENSAGENS AGRUPADAS"
5. IA deve responder UMA VEZ considerando ambas mensagens

### Como Testar Follow-ups:

1. Criar análise
2. IA envia mensagem
3. NÃO responder no WhatsApp
4. Verificar timer: "Próximo follow-up em: Xh Ymin"
5. Aguardar tempo expirar
6. Verificar recebimento de follow-up progressivo (3 níveis)

---

## 🐛 Problemas Conhecidos

### ✅ RESOLVIDOS:
1. ~~Agrupamento não funcionava (respondia 2x)~~ → Adicionado early return
2. ~~Timer de follow-up não aparecia~~ → Definindo next_follow_up_at após IA enviar
3. ~~Texto "Analisando objetivos" aparecia~~ → Componente removido
4. ~~Logs não eram visíveis~~ → Criado DebugLogs.tsx + saveDebugLog()

### ⚠️ PENDENTES:
1. Instância `clienteoculto-homem` não existe (precisa criar)
2. Análise final de vendas ainda não gera detalhes profundos
3. Pesquisa com Perplexity não implementada
4. Timeout de 2h pode ser muito longo
5. Sem retry em falhas de API (Evolution ou OpenAI)

---

## 🔄 Próximos Passos

### Melhorias Sugeridas:
1. **Retry Logic:** Retentar envio WhatsApp em caso de falha
2. **Perplexity Integration:** Pesquisar informações externas sobre produto/empresa
3. **Análise Aprofundada:** Usar GPT-4o para análise detalhada de vendas
4. **Webhook Signature:** Validar assinatura de webhooks Evolution
5. **Rate Limiting:** Evitar envio excessivo de mensagens
6. **Backup de Conversas:** Exportar histórico em PDF/JSON
