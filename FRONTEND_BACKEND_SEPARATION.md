# 🔀 Separação Frontend/Backend - Guia para Trabalho Paralelo

## 🎯 Objetivo Deste Documento

Este documento explica como **dividir o trabalho** entre diferentes desenvolvedores ou agentes de IA, permitindo que múltiplas pessoas trabalhem simultaneamente no projeto sem conflitos.

**Cenários de uso:**
- Você quer um dev focado em UI e outro em lógica
- Você quer usar múltiplos agentes de IA trabalhando em paralelo
- Você quer aprender frontend sem mexer no backend
- Você quer trocar o backend sem quebrar o frontend

---

## 📊 Diagrama de Separação

```
┌─────────────────────────────────────────────────────────────┐
│                     PROJETO COMPLETO                         │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
        ┌───────▼────────┐      ┌──────▼──────┐
        │   FRONTEND     │      │   BACKEND   │
        │   (Visual)     │◄────►│   (Lógica)  │
        └────────────────┘      └─────────────┘
                │                       │
        ┌───────▼────────┐      ┌──────▼──────┐
        │  React + Vite  │      │  Supabase   │
        │  Tailwind CSS  │      │  Functions  │
        │  TypeScript    │      │  PostgreSQL │
        └────────────────┘      └─────────────┘
                │                       │
        ┌───────▼────────┐      ┌──────▼──────┐
        │  Responsável   │      │  Responsável│
        │  pela UI/UX    │      │  por APIs   │
        └────────────────┘      └─────────────┘
```

---

## 🎨 Frontend (Interface Visual)

### 📁 Arquivos de Responsabilidade

```
✅ PODE EDITAR LIVREMENTE:
├── src/
│   ├── pages/              # Páginas e layouts
│   ├── components/         # Componentes visuais
│   ├── lib/utils.ts        # Funções helper do frontend
│   ├── hooks/              # Custom React hooks
│   ├── App.tsx             # Rotas
│   ├── main.tsx            # Entry point
│   └── index.css           # Estilos globais
│
├── public/                 # Imagens, ícones
├── tailwind.config.ts      # Config Tailwind
├── vite.config.ts          # Config Vite
└── package.json            # Dependências frontend

⚠️ PODE LER, NÃO EDITAR:
├── src/integrations/supabase/
│   ├── client.ts           # Cliente Supabase (gerado)
│   └── types.ts            # Tipos auto-gerados do banco

🚫 NÃO MEXER:
└── supabase/               # Pasta do backend
```

### 🎯 Responsabilidades do Frontend

#### 1. **Interface de Usuário (UI)**
- Criar/editar componentes visuais
- Estilizar com Tailwind CSS
- Garantir responsividade (mobile/desktop)
- Adicionar animações e transições

**Exemplo de tarefa:**
```
✅ "Adicionar botão de exportar análise em PDF"
✅ "Mudar cores do tema para azul"
✅ "Criar modal de confirmação ao deletar"
✅ "Adicionar skeleton loading nas mensagens"
```

#### 2. **Experiência do Usuário (UX)**
- Fluxos de navegação
- Feedback visual (loading, success, error)
- Validação de formulários
- Mensagens de erro amigáveis

**Exemplo de tarefa:**
```
✅ "Mostrar toast quando análise for criada"
✅ "Adicionar confirmação antes de cancelar análise"
✅ "Melhorar feedback de upload de arquivo"
```

#### 3. **Consumo de Dados**
- Buscar dados do Supabase
- Escutar atualizações em tempo real
- Exibir dados na tela
- **NÃO criar lógica de negócio**

**Exemplo de código (OK para frontend):**
```typescript
// ✅ BOM: Buscar e exibir dados
async function loadAnalysis(id: string) {
  const { data, error } = await supabase
    .from('analysis_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    toast.error('Erro ao carregar análise')
    return
  }

  setAnalysis(data)
}

// ✅ BOM: Escutar atualizações
useEffect(() => {
  const channel = supabase
    .channel(`analysis-${id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'analysis_requests',
      filter: `id=eq.${id}`
    }, (payload) => {
      setAnalysis(payload.new)
    })
    .subscribe()

  return () => channel.unsubscribe()
}, [id])

// ❌ RUIM: Lógica de negócio no frontend
async function processAIResponse() {
  // Isso deveria estar no backend!
  const response = await openai.chat.completions.create(...)
  await sendWhatsAppMessage(...)
}
```

### 🛠️ Ferramentas do Frontend

#### Desenvolvimento Local
```bash
cd cliente-oculto-01
npm install
npm run dev  # http://localhost:5173
```

#### Comandos Úteis
```bash
npm run build     # Build de produção
npm run preview   # Testar build
npm run lint      # Verificar erros
```

#### Acessar Banco de Dados (Somente Leitura)
```typescript
// Buscar análises
const { data } = await supabase
  .from('analysis_requests')
  .select('*')

// Buscar mensagens
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('analysis_id', id)
  .order('created_at', { ascending: true })
```

**IMPORTANTE:** Frontend NUNCA deve:
- ❌ Chamar APIs externas diretamente (Evolution, OpenAI)
- ❌ Processar lógica de negócio complexa
- ❌ Manipular metadata crítico (follow-ups, timers)
- ❌ Enviar mensagens WhatsApp

---

## ⚙️ Backend (Lógica do Servidor)

### 📁 Arquivos de Responsabilidade

```
✅ PODE EDITAR LIVREMENTE:
└── supabase/
    ├── functions/              # Edge Functions
    │   ├── handle-webhook/
    │   ├── monitor-conversations/
    │   └── _shared/
    │       ├── evolutionApi.ts
    │       ├── openaiClient.ts
    │       └── config/
    │
    ├── migrations/             # Estrutura do banco
    └── seed.sql                # Dados de teste

⚠️ PODE LER, NÃO EDITAR:
└── src/integrations/supabase/
    └── types.ts                # Tipos gerados (leia para saber estrutura)

🚫 NÃO MEXER:
└── src/                        # Pasta do frontend
```

### 🎯 Responsabilidades do Backend

#### 1. **Lógica de Negócio**
- Processar conversas
- Gerar respostas IA
- Gerenciar follow-ups
- Calcular métricas
- Definir quando conversa encerra

**Exemplo de tarefa:**
```
✅ "Mudar delay de follow-up de 1h para 2h"
✅ "Adicionar análise de sentimento nas mensagens"
✅ "Implementar retry em falhas de WhatsApp"
✅ "Criar função para exportar conversa em PDF"
```

#### 2. **Integrações Externas**
- Enviar/receber mensagens WhatsApp (Evolution API)
- Gerar respostas IA (OpenAI)
- Salvar logs
- Webhooks

**Exemplo de tarefa:**
```
✅ "Adicionar Perplexity AI para pesquisa"
✅ "Implementar rate limiting no WhatsApp"
✅ "Adicionar retry com backoff exponencial"
```

#### 3. **Banco de Dados**
- Criar/modificar tabelas (migrations)
- Definir índices para performance
- Configurar Row Level Security (RLS)
- Trigger functions

**Exemplo de tarefa:**
```
✅ "Adicionar campo 'tags' na análise"
✅ "Criar índice para busca por telefone"
✅ "Adicionar trigger para atualizar updated_at"
```

#### 4. **Segurança e Performance**
- Validação de dados
- Rate limiting
- Caching
- Otimização de queries

**Exemplo de código (OK para backend):**
```typescript
// ✅ BOM: Lógica de negócio no backend
async function processUnreadMessages(analysisId: string) {
  // 1. Buscar mensagens não processadas
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('processed', false)
    .eq('role', 'user')
    .order('created_at', { ascending: true })

  if (!messages || messages.length === 0) return

  // 2. Gerar resposta IA
  const aiResponse = await generateAIResponse(messages)

  // 3. Enviar WhatsApp
  await sendWhatsAppMessage(analysis.evolution_instance, analysis.customer_phone, aiResponse)

  // 4. Salvar mensagem IA
  await supabase.from('messages').insert({
    analysis_id: analysisId,
    role: 'ai',
    content: aiResponse,
    processed: true
  })

  // 5. Marcar mensagens como processadas
  await supabase
    .from('messages')
    .update({ processed: true })
    .in('id', messages.map(m => m.id))

  // 6. Definir próximo follow-up
  await defineNextFollowUp(analysisId)
}

// ❌ RUIM: Retornar HTML/JSX do backend
function generateReport(analysis: any) {
  return `<div><h1>${analysis.name}</h1></div>`  // Isso é trabalho do frontend!
}
```

### 🛠️ Ferramentas do Backend

#### Desenvolvimento Local
```bash
# Instalar Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Vincular projeto
supabase link --project-ref ltjnbmvfjjphljcavrmp

# Rodar localmente (opcional)
supabase start  # Inicia Postgres + Functions local
```

#### Deploy
```bash
# Deploy function específica
supabase functions deploy monitor-conversations

# Deploy todas
supabase functions deploy

# Aplicar migrations
supabase db push
```

#### Logs em Tempo Real
```bash
# Ver logs de função específica
supabase functions logs monitor-conversations --project-ref ltjnbmvfjjphljcavrmp

# Ver todos os logs
supabase functions logs --project-ref ltjnbmvfjjphljcavrmp
```

#### Testar Funções Localmente
```bash
# Invocar função
supabase functions serve

# Em outro terminal
curl -X POST http://localhost:54321/functions/v1/monitor-conversations \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 🔌 Contrato de Interface (API)

Esta é a **ponte** entre frontend e backend. Ambos devem concordar com esta estrutura.

### 📊 Tabela: analysis_requests

```typescript
interface AnalysisRequest {
  id: string                      // UUID
  user_id: string                 // FK para auth.users
  customer_name: string           // Nome do cliente oculto
  customer_phone: string          // Telefone do vendedor
  objectives: string[]            // Objetivos da conversa
  analysis_depth: 'quick' | 'intermediate' | 'deep'
  evolution_instance: 'clienteoculto-homem' | 'clienteoculto-mulher'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  next_ai_response_at: string | null  // ISO 8601 timestamp
  metadata: {
    next_ai_response_source?: 'webhook_planned' | 'ai_planned'
    next_follow_up_at?: string  // ISO 8601 timestamp
    follow_ups_sent?: number
    max_follow_ups?: number
    conversation_style?: 'casual' | 'balanced' | 'direct' | 'detailed'
    debug_logs?: Array<{
      timestamp: string
      level: 'info' | 'warning' | 'error' | 'success'
      message: string
      data?: any
    }>
  }
  analysis_result: {
    summary?: string
    sales_techniques?: string[]
    positive_points?: string[]
    improvement_areas?: string[]
    objective_completion?: Record<string, boolean>
    overall_score?: number
  } | null
  created_at: string              // ISO 8601 timestamp
  updated_at: string              // ISO 8601 timestamp
}
```

### 💬 Tabela: messages

```typescript
interface Message {
  id: string                      // UUID
  analysis_id: string             // FK para analysis_requests
  role: 'user' | 'ai' | 'system'
  content: string
  processed: boolean              // Se já foi processada pelo backend
  whatsapp_message_id: string | null
  chunk_index: number | null      // Para mensagens quebradas
  created_at: string              // ISO 8601 timestamp
}
```

### 🎯 Regras do Contrato

#### Frontend PODE:
- ✅ Ler `analysis_requests` (somente suas análises - RLS)
- ✅ Ler `messages` (somente de suas análises - RLS)
- ✅ Criar `analysis_requests` (INSERT)
- ✅ Atualizar `status` para 'cancelled' (se implementado)
- ✅ Escutar mudanças via Realtime

#### Frontend NÃO PODE:
- ❌ Criar `messages` (é o backend que cria)
- ❌ Atualizar `next_ai_response_at` (lógica do backend)
- ❌ Atualizar `metadata` (exceto se backend expor endpoint específico)
- ❌ Atualizar `processed` (controle do backend)

#### Backend PODE:
- ✅ Criar/atualizar qualquer registro (usa SERVICE_ROLE_KEY)
- ✅ Ler qualquer registro
- ✅ Deletar registros (se necessário)

---

## 🚀 Workflows de Trabalho Paralelo

### Cenário 1: Dev Frontend + Dev Backend

#### Dev Frontend:
1. Cria componente `ExportButton.tsx`
2. Adiciona botão na tela de análise
3. Ao clicar, chama: `POST /functions/v1/export-analysis`
4. Exibe loading enquanto processa
5. Baixa PDF quando retornar

#### Dev Backend (em paralelo):
1. Cria função `export-analysis/index.ts`
2. Implementa geração de PDF com análise
3. Deploy: `supabase functions deploy export-analysis`
4. Testa: `curl -X POST ...`

#### Integração:
- Frontend chama endpoint quando pronto
- Backend retorna PDF quando pronto
- Ambos trabalham independentemente até integrar

### Cenário 2: Múltiplos Agentes IA

#### Agente UI:
```
Tarefa: "Melhorar visual da tela de análise"
Arquivos: src/pages/AnalysisDetails.tsx, src/components/
Restrição: Não mexer em supabase/
```

#### Agente Backend:
```
Tarefa: "Implementar retry em falhas de WhatsApp"
Arquivos: supabase/functions/_shared/evolutionApi.ts
Restrição: Não mexer em src/
```

#### Agente Banco:
```
Tarefa: "Adicionar campo 'tags' nas análises"
Arquivos: supabase/migrations/
Depois: supabase db push
```

Todos podem trabalhar simultaneamente sem conflitos!

---

## 📋 Checklist de Separação

### Para Frontend:

- [ ] Código está em `src/`
- [ ] Usa `supabase.from()` para ler dados
- [ ] Não faz chamadas diretas a APIs externas (Evolution, OpenAI)
- [ ] Não modifica `metadata` crítico
- [ ] Exibe dados de forma bonita e responsiva
- [ ] Trata erros com mensagens amigáveis
- [ ] Testa em mobile e desktop

### Para Backend:

- [ ] Código está em `supabase/`
- [ ] Usa `SERVICE_ROLE_KEY` (acesso total)
- [ ] Valida dados de entrada
- [ ] Trata erros de APIs externas (retry, fallback)
- [ ] Salva logs para debug
- [ ] Atualiza `metadata` quando necessário
- [ ] Testa localmente antes de deploy

### Para Banco de Dados:

- [ ] Mudanças estão em migrations (não manual)
- [ ] Migrations têm nome descritivo e timestamp
- [ ] Adicionou índices se necessário
- [ ] RLS configurado corretamente
- [ ] Testou rollback (se der errado)
- [ ] Documentou schema no código

---

## 🔄 Fluxo de Integração

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND                                  │
│                                                              │
│  1. Usuário clica em "Criar Análise"                        │
│  2. Valida formulário                                        │
│  3. POST /analysis_requests                                  │
│  4. Exibe loading...                                         │
│  5. Escuta Realtime para atualizações                        │
│  6. Exibe mensagens conforme chegam                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Supabase (Banco + Realtime)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    BACKEND                                   │
│                                                              │
│  1. Cron job dispara monitor-conversations a cada 30s       │
│  2. Busca análises 'in_progress'                            │
│  3. Verifica janela de agrupamento                          │
│  4. Processa mensagens novas                                │
│  5. Gera resposta IA (OpenAI)                               │
│  6. Envia WhatsApp (Evolution API)                          │
│  7. Salva no banco                                          │
│  8. Frontend recebe via Realtime automaticamente            │
└─────────────────────────────────────────────────────────────┘
```

**Comunicação:**
- Frontend → Backend: Via tabelas Supabase (INSERT/UPDATE)
- Backend → Frontend: Via Supabase Realtime (notificações automáticas)
- **Nunca** chamadas HTTP diretas entre frontend e backend

---

## 🎯 Exemplos Práticos de Separação

### Exemplo 1: Adicionar Campo "Tags"

#### Backend (Dev 1):
```sql
-- supabase/migrations/20250126_add_tags.sql
ALTER TABLE analysis_requests
ADD COLUMN tags TEXT[] DEFAULT '{}';
```
```bash
supabase db push
```

#### Frontend (Dev 2 - em paralelo):
```typescript
// src/pages/Index.tsx
<input
  type="text"
  placeholder="Tags (separadas por vírgula)"
  value={tags}
  onChange={(e) => setTags(e.target.value)}
/>

// Ao criar análise
await supabase.from('analysis_requests').insert({
  ...outros_campos,
  tags: tags.split(',').map(t => t.trim())
})
```

**Integração:** Após backend fazer push, frontend já pode usar o campo!

### Exemplo 2: Implementar Exportar PDF

#### Backend (Dev 1):
```typescript
// supabase/functions/export-analysis/index.ts
import { PDFDocument } from 'pdf-lib'

Deno.serve(async (req) => {
  const { analysisId } = await req.json()

  // Buscar análise + mensagens
  const { data: analysis } = await supabase
    .from('analysis_requests')
    .select('*, messages(*)')
    .eq('id', analysisId)
    .single()

  // Gerar PDF
  const pdfDoc = await PDFDocument.create()
  // ... adicionar conteúdo

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="analise-${analysisId}.pdf"`
    }
  })
})
```

#### Frontend (Dev 2 - em paralelo):
```typescript
// src/components/ExportButton.tsx
async function handleExport() {
  setLoading(true)
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/export-analysis`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ analysisId: id })
      }
    )

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analise-${id}.pdf`
    a.click()
    toast.success('PDF exportado com sucesso!')
  } catch (error) {
    toast.error('Erro ao exportar PDF')
  } finally {
    setLoading(false)
  }
}
```

**Integração:** Frontend testa com mock enquanto backend desenvolve. Depois conecta!

---

## 🛡️ Regras de Segurança

### Frontend (.env.local)
```bash
# Chave ANON (pública, pode ir no código)
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```
- ✅ Pode ser compartilhada
- ✅ Limitada por RLS
- ✅ Somente lê dados do próprio usuário

### Backend (Supabase Secrets)
```bash
# Chave SERVICE_ROLE (NUNCA expor!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-proj-...
EVOLUTION_API_KEY=429683...
```
- ❌ NUNCA colocar no frontend
- ❌ NUNCA commitar no Git
- ✅ Acesso total ao banco
- ✅ Pode chamar APIs externas

---

## 📚 Resumo em 3 Regras Simples

### 1. Frontend = Visual
- Componentes bonitos
- Exibir dados
- Navegação e UX
- **Não processa lógica de negócio**

### 2. Backend = Lógica
- Processamento de dados
- Integrações com APIs
- Regras de negócio
- **Não gera HTML/componentes**

### 3. Contrato = Banco de Dados
- Frontend lê/escreve nas tabelas acordadas
- Backend gerencia tudo
- Realtime conecta os dois
- **Ambos respeitam o schema**

---

## 🎓 Para Iniciantes

**"Eu quero mexer na cor do botão"**
→ Frontend! Arquivo: `src/components/`

**"Eu quero mudar o tempo de follow-up"**
→ Backend! Arquivo: `supabase/functions/monitor-conversations/index.ts`

**"Eu quero adicionar um campo novo"**
→ Banco! Arquivo: `supabase/migrations/`

**"Eu quero mudar o texto da mensagem de boas-vindas"**
→ Backend! Arquivo: `supabase/functions/_shared/config/prompts.ts`

**"Eu quero mudar o layout do chat"**
→ Frontend! Arquivo: `src/pages/AnalysisDetails.tsx`

---

## 🚀 Checklist para Começar a Trabalhar

### Frontend Developer:
- [ ] Clone o repositório
- [ ] `npm install`
- [ ] Configure `.env.local` com SUPABASE_URL e ANON_KEY
- [ ] `npm run dev`
- [ ] Abra `http://localhost:5173`
- [ ] Edite arquivos em `src/`

### Backend Developer:
- [ ] Clone o repositório
- [ ] `brew install supabase/tap/supabase`
- [ ] `supabase login`
- [ ] `supabase link --project-ref ltjnbmvfjjphljcavrmp`
- [ ] Configure secrets no Supabase Dashboard
- [ ] Edite arquivos em `supabase/`
- [ ] Deploy: `supabase functions deploy`

### Database Developer:
- [ ] Mesmo setup do Backend
- [ ] Crie migration: `supabase migration new nome_da_migration`
- [ ] Edite arquivo SQL em `supabase/migrations/`
- [ ] Aplique: `supabase db push`
- [ ] Verifique no Supabase Dashboard

---

Agora você pode dividir o trabalho e múltiplas pessoas/agentes podem trabalhar no projeto simultaneamente! 🎉
