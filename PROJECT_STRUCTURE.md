# 📁 Estrutura do Projeto - Cliente Oculto

## 🗂️ Visão Geral da Pasta Raiz

```
cliente-oculto-01/
├── src/                          # 🎨 FRONTEND - Interface visual
├── supabase/                     # ⚙️ BACKEND - Lógica do servidor
├── public/                       # 📦 Arquivos públicos (ícones, imagens)
├── .env.local                    # 🔐 Variáveis de ambiente (credenciais)
├── package.json                  # 📋 Dependências do projeto
├── vite.config.ts                # ⚡ Configuração do Vite
├── tailwind.config.ts            # 🎨 Configuração do Tailwind
├── tsconfig.json                 # 🔷 Configuração TypeScript
├── ARCHITECTURE.md               # 📚 Documentação da arquitetura
├── TECH_STACK.md                 # 🛠️ Explicação das tecnologias
├── PROJECT_STRUCTURE.md          # 📁 Este arquivo
├── FRONTEND_BACKEND_SEPARATION.md # 🔀 Como separar frontend/backend
└── CURRENT_ISSUES.md             # 🐛 Problemas conhecidos
```

---

## 🎨 Frontend (`/src/`)

### Estrutura Completa

```
src/
├── main.tsx                      # 🚀 Ponto de entrada da aplicação
├── App.tsx                       # 🏠 Componente raiz + rotas
├── index.css                     # 🎨 Estilos globais
│
├── pages/                        # 📄 Páginas (rotas)
│   ├── Index.tsx                 # Lista de análises + formulário criar
│   ├── AnalysisDetails.tsx       # Detalhes de uma análise
│   └── Auth.tsx                  # Login/Registro (se tiver)
│
├── components/                   # 🧩 Componentes reutilizáveis
│   ├── ui/                       # Componentes base (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── toast.tsx
│   │
│   ├── DebugLogs.tsx             # 🐛 Painel de debug logs
│   ├── NextResponseTimer.tsx     # ⏰ Timer de próxima ação
│   ├── AnalysisCard.tsx          # 📇 Card de análise (lista)
│   ├── MessageBubble.tsx         # 💬 Bolha de mensagem no chat
│   └── AnalysisMetrics.tsx       # 📊 Métricas da análise
│
├── integrations/                 # 🔌 Integrações externas
│   └── supabase/
│       ├── client.ts             # Cliente Supabase (frontend)
│       └── types.ts              # Tipos TypeScript auto-gerados
│
├── lib/                          # 🛠️ Utilitários e helpers
│   ├── utils.ts                  # Funções helper (cn, formatDate)
│   └── constants.ts              # Constantes do projeto
│
└── hooks/                        # 🪝 Custom React hooks
    ├── useAnalysis.ts            # Hook para carregar análise
    ├── useMessages.ts            # Hook para mensagens em tempo real
    └── useRealtime.ts            # Hook genérico de realtime
```

### Arquivos Principais Explicados

#### **main.tsx** (Ponto de Entrada)
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```
**O que faz:** Renderiza o componente `App` no elemento `#root` do HTML.

#### **App.tsx** (Rotas)
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Index from './pages/Index'
import AnalysisDetails from './pages/AnalysisDetails'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/analysis/:id" element={<AnalysisDetails />} />
      </Routes>
    </BrowserRouter>
  )
}
```
**O que faz:** Define as rotas da aplicação (páginas).

#### **pages/Index.tsx** (Página Principal)
```typescript
// Conteúdo:
// - Formulário para criar análise
// - Grid de análises existentes (cards)
// - Filtros por status

// Responsabilidades:
// ✅ Buscar análises do Supabase
// ✅ Criar nova análise
// ✅ Navegar para detalhes ao clicar
```

#### **pages/AnalysisDetails.tsx** (Detalhes da Análise)
```typescript
// Conteúdo:
// - Chat com mensagens (usuário/IA)
// - Timer de próxima ação
// - Informações da análise
// - Debug logs
// - Análise final (se completada)

// Responsabilidades:
// ✅ Carregar análise + mensagens
// ✅ Escutar atualizações em tempo real
// ✅ Exibir timer dinâmico
// ✅ Mostrar debug logs
```

#### **components/DebugLogs.tsx** (Debug Logs)
```typescript
// Conteúdo:
// - Painel flutuante (Ctrl+Shift+D)
// - Logs com níveis (info/warning/error/success)
// - Timestamp e dados expandíveis

// Responsabilidades:
// ✅ Escutar metadata.debug_logs via Realtime
// ✅ Exibir logs formatados
// ✅ Abrir/fechar com atalho
```

#### **components/NextResponseTimer.tsx** (Timer)
```typescript
// Conteúdo:
// - Countdown para próxima ação
// - Diferencia entre resposta e follow-up
// - Mostra tentativas restantes

// Responsabilidades:
// ✅ Verificar última mensagem (user ou ai)
// ✅ Calcular tempo restante
// ✅ Atualizar a cada 1s
// ✅ Exibir "Respondendo agora..." quando expirar
```

#### **integrations/supabase/client.ts** (Cliente Supabase)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
```
**O que faz:** Cria instância do cliente Supabase para o frontend.

#### **lib/utils.ts** (Utilitários)
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Função para combinar classes Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatar data
export function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

// Formatar telefone
export function formatPhone(phone: string) {
  return phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')
}
```

---

## ⚙️ Backend (`/supabase/`)

### Estrutura Completa

```
supabase/
├── functions/                    # ⚡ Edge Functions (Deno)
│   ├── handle-webhook/
│   │   └── index.ts              # Recebe mensagens do WhatsApp
│   │
│   ├── monitor-conversations/
│   │   └── index.ts              # Processa conversas e IA
│   │
│   └── _shared/                  # Código compartilhado
│       ├── supabaseClient.ts     # Cliente Supabase (backend)
│       ├── evolutionApi.ts       # Funções Evolution API
│       ├── openaiClient.ts       # Cliente OpenAI
│       └── config/
│           ├── conversation-styles.ts    # Estilos de conversa
│           ├── prompts.ts        # Prompts da IA
│           └── depth-config.ts   # Config por profundidade
│
├── migrations/                   # 📊 Migrations do banco
│   ├── 20240101000000_initial_schema.sql
│   ├── 20240102000000_add_metadata.sql
│   └── 20240103000000_create_indexes.sql
│
├── seed.sql                      # 🌱 Dados iniciais (dev)
└── config.toml                   # ⚙️ Configuração do Supabase
```

### Arquivos Principais Explicados

#### **functions/handle-webhook/index.ts** (Webhook WhatsApp)
```typescript
// Responsabilidades:
// ✅ Receber payload do Evolution API
// ✅ Validar que é mensagem de texto
// ✅ Buscar análise ativa para o telefone
// ✅ Criar registro na tabela messages
// ✅ Definir next_ai_response_at (janela de agrupamento)
// ✅ Retornar 200 OK rapidamente

// Fluxo:
// 1. POST chega do Evolution
// 2. Extrai número e mensagem
// 3. Busca analysis_request ativa
// 4. Cria message (role: user, processed: false)
// 5. Define next_ai_response_at = now + 10-15s aleatório
// 6. Retorna 200
```

#### **functions/monitor-conversations/index.ts** (Monitor IA)
```typescript
// Responsabilidades:
// ✅ Executar a cada 30s (cron job)
// ✅ Buscar análises in_progress
// ✅ Verificar janela de agrupamento
// ✅ Processar mensagens novas
// ✅ Gerar respostas IA (OpenAI)
// ✅ Enviar via WhatsApp
// ✅ Gerenciar follow-ups
// ✅ Salvar debug logs
// ✅ Gerar análise final

// Fluxo principal:
// 1. Busca análises 'in_progress'
// 2. Para cada análise:
//    a. Checa janela ativa? → RETORNA se sim
//    b. Busca mensagens unprocessed
//    c. Se tem mensagens → gera resposta IA
//    d. Se não tem → checa follow-up
// 3. Salva logs
// 4. Atualiza metadata
```

#### **functions/_shared/supabaseClient.ts** (Cliente Backend)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
```
**Diferença do frontend:** Usa SERVICE_ROLE_KEY (acesso total ao banco).

#### **functions/_shared/evolutionApi.ts** (Evolution API)
```typescript
const EVOLUTION_URL = Deno.env.get('EVOLUTION_API_URL')!
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_API_KEY')!

export async function sendMessage(instance: string, number: string, text: string) {
  const response = await fetch(`${EVOLUTION_URL}/message/sendText/${instance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_KEY
    },
    body: JSON.stringify({ number, text })
  })
  return response.json()
}

export async function sendTypingIndicator(instance: string, number: string, delay: number) {
  // ...similar
}
```

#### **functions/_shared/openaiClient.ts** (OpenAI)
```typescript
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!

export async function generateResponse(messages: any[], model = 'gpt-4o') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 500
    })
  })
  const data = await response.json()
  return data.choices[0].message.content
}
```

#### **functions/_shared/config/prompts.ts** (Prompts)
```typescript
export const SYSTEM_PROMPT = `
Você é um cliente oculto brasileiro avaliando atendimento de vendas.

INSTRUÇÕES:
- Seja natural e coloquial (use "oi", "beleza", "né", "pô")
- Não seja excessivamente formal
- Faça perguntas genuínas sobre o produto/serviço
- Observe técnicas de vendas do vendedor
- Não revele que é um cliente oculto

OBJETIVOS A DESCOBRIR:
{objectives}

ESTILO DE CONVERSA: {conversation_style}
`

export const FOLLOW_UP_PROMPTS = {
  level1: "Oi! Conseguiu pensar sobre o que conversamos?",
  level2: "E aí, tudo bem? Ficou alguma dúvida?",
  level3: "Beleza, se precisar de algo é só chamar! Valeu!"
}
```

#### **functions/_shared/config/depth-config.ts** (Configuração)
```typescript
export const DEPTH_CONFIG = {
  quick: {
    model: 'gpt-4o-mini',
    maxFollowUps: 2,
    followUpDelay: { min: 30, max: 60 },  // minutos
    timeout: 2  // horas
  },
  intermediate: {
    model: 'gpt-4o',
    maxFollowUps: 3,
    followUpDelay: { min: 60, max: 120 },
    timeout: 4
  },
  deep: {
    model: 'gpt-4o',
    maxFollowUps: 3,
    followUpDelay: { min: 90, max: 180 },
    timeout: 8
  }
}
```

---

## 📊 Migrations (`/supabase/migrations/`)

### O que são Migrations?
São scripts SQL que criam/modificam estrutura do banco de forma versionada.

### Exemplo: `20240101000000_initial_schema.sql`
```sql
-- Criar tabela analysis_requests
CREATE TABLE analysis_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  objectives TEXT[] NOT NULL,
  analysis_depth TEXT NOT NULL,
  evolution_instance TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  next_ai_response_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analysis_requests(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  whatsapp_message_id TEXT,
  chunk_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices
CREATE INDEX idx_analysis_status ON analysis_requests(status);
CREATE INDEX idx_analysis_next_response ON analysis_requests(next_ai_response_at);
CREATE INDEX idx_messages_analysis ON messages(analysis_id, created_at);
CREATE INDEX idx_messages_unprocessed ON messages(analysis_id, processed) WHERE processed = FALSE;

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE analysis_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Row Level Security
ALTER TABLE analysis_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "users_see_own_analyses"
  ON analysis_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_create_own_analyses"
  ON analysis_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_see_own_messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM analysis_requests
      WHERE id = messages.analysis_id
      AND user_id = auth.uid()
    )
  );
```

### Como aplicar migrations:
```bash
supabase db push
```

---

## 🔐 Variáveis de Ambiente

### Frontend (`.env.local`)
```bash
VITE_SUPABASE_URL=https://ltjnbmvfjjphljcavrmp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### Backend (Supabase Dashboard → Settings → Secrets)
```bash
OPENAI_API_KEY=sk-proj-...
EVOLUTION_API_KEY=429683C434535345**10F7D57E11
EVOLUTION_API_URL=https://evolution-nova-versao-evolution-api.78s68s.easypanel.host
SUPABASE_URL=https://ltjnbmvfjjphljcavrmp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**IMPORTANTE:** Nunca commite `.env.local` no Git! Use `.env.example`:
```bash
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 📦 Arquivos de Configuração

### **package.json** (Dependências)
```json
{
  "name": "cliente-oculto-01",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "deploy": "npm run build && supabase functions deploy"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.21.0",
    "@supabase/supabase-js": "^2.39.0",
    "lucide-react": "^0.295.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "typescript": "^5.3.3",
    "vite": "^5.0.8",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

### **vite.config.ts** (Vite)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true
  }
})
```

### **tailwind.config.ts** (Tailwind)
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { /* cores personalizadas */ }
      }
    }
  },
  plugins: []
} satisfies Config
```

### **tsconfig.json** (TypeScript)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### **supabase/config.toml** (Supabase)
```toml
[api]
enabled = true
port = 54321

[db]
port = 54322

[studio]
enabled = true
port = 54323

[functions.monitor-conversations]
verify_jwt = false

[functions.handle-webhook]
verify_jwt = false
```

---

## 🗃️ Convenções de Código

### Nomenclatura de Arquivos
- **Componentes React:** PascalCase (`AnalysisCard.tsx`)
- **Utilitários:** camelCase (`utils.ts`, `formatDate.ts`)
- **Constantes:** UPPER_SNAKE_CASE (`API_URL`, `MAX_RETRIES`)
- **Types/Interfaces:** PascalCase (`AnalysisRequest`, `Message`)

### Estrutura de Componentes
```typescript
// 1. Imports externos
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

// 2. Imports internos
import { supabase } from '@/integrations/supabase/client'
import { Card } from '@/components/ui/card'

// 3. Types/Interfaces
interface AnalysisCardProps {
  analysis: Analysis
  onClick: () => void
}

// 4. Componente
export function AnalysisCard({ analysis, onClick }: AnalysisCardProps) {
  // Hooks
  const [loading, setLoading] = useState(false)

  // Effects
  useEffect(() => {
    // ...
  }, [])

  // Handlers
  const handleClick = () => {
    onClick()
  }

  // Render
  return (
    <Card onClick={handleClick}>
      {/* JSX */}
    </Card>
  )
}
```

### Nomenclatura de Funções
- **Event Handlers:** `handle{Action}` (`handleClick`, `handleSubmit`)
- **Fetch Data:** `load{Resource}` (`loadAnalysis`, `loadMessages`)
- **Boolean Functions:** `is{Condition}` (`isActive`, `hasMessages`)
- **Transformations:** `format{Type}` (`formatDate`, `formatPhone`)

---

## 🎯 Como Navegar no Código

### "Quero adicionar um novo campo na análise"
1. `supabase/migrations/` → Cria migration adicionando coluna
2. `src/integrations/supabase/types.ts` → Regenera tipos
3. `src/pages/Index.tsx` → Adiciona campo no formulário
4. `supabase/functions/monitor-conversations/` → Usa o campo na lógica

### "Quero mudar o prompt da IA"
1. `supabase/functions/_shared/config/prompts.ts` → Edita SYSTEM_PROMPT
2. Deploy: `supabase functions deploy monitor-conversations`

### "Quero adicionar uma nova página"
1. `src/pages/NovaPagina.tsx` → Cria componente
2. `src/App.tsx` → Adiciona rota
3. `src/pages/Index.tsx` → Adiciona link de navegação

### "Quero ver logs em tempo real"
1. Terminal: `supabase functions logs monitor-conversations --project-ref ltjnbmvfjjphljcavrmp`
2. Ou: Frontend → Ctrl+Shift+D (Debug Logs)

### "Quero testar localmente"
```bash
# Frontend
npm run dev  # http://localhost:5173

# Backend (Supabase local)
supabase start  # Roda Postgres + Functions localmente
supabase functions serve  # Roda Edge Functions
```

---

## 🚀 Comandos Úteis

### Desenvolvimento
```bash
npm run dev              # Inicia frontend (localhost:5173)
npm run build            # Cria build de produção
npm run preview          # Testa build localmente
```

### Supabase
```bash
supabase login                                    # Login
supabase init                                     # Inicializa projeto
supabase link --project-ref ltjnbmvfjjphljcavrmp  # Vincula projeto
supabase db push                                  # Aplica migrations
supabase functions deploy monitor-conversations   # Deploy function
supabase functions logs monitor-conversations     # Ver logs
```

### Git
```bash
git status                # Ver mudanças
git add .                 # Adiciona tudo
git commit -m "mensagem"  # Commita
git push origin main      # Envia para GitHub
```

---

## 📚 Próximos Passos

Para trabalhar no projeto, leia nesta ordem:
1. **TECH_STACK.md** - Entenda as tecnologias
2. **ARCHITECTURE.md** - Entenda como tudo se conecta
3. **PROJECT_STRUCTURE.md** - Este arquivo (navegação)
4. **FRONTEND_BACKEND_SEPARATION.md** - Como separar para outros devs
5. **CURRENT_ISSUES.md** - Problemas conhecidos e fixes

---

## 🤝 Para Outros Desenvolvedores

### "Vou trabalhar só no Frontend"
**Arquivos relevantes:**
- `src/pages/` - Páginas principais
- `src/components/` - Componentes reutilizáveis
- `src/lib/utils.ts` - Utilitários

**Não precisa mexer:**
- `supabase/functions/` (Backend)

### "Vou trabalhar só no Backend"
**Arquivos relevantes:**
- `supabase/functions/` - Lógica do servidor
- `supabase/migrations/` - Banco de dados

**Não precisa mexer:**
- `src/` (Frontend)

### "Vou trabalhar no banco de dados"
**Arquivos relevantes:**
- `supabase/migrations/` - Criar/modificar tabelas
- Depois: `supabase db push` para aplicar

**Cuidado:**
- Sempre crie migrations (não edite direto no Supabase Dashboard)
- Teste localmente antes: `supabase db reset`
