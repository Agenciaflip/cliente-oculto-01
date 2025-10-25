# 🛠️ Stack Tecnológico - Cliente Oculto

## 📚 Resumo Executivo

Este documento explica **todas as tecnologias** usadas no projeto, **por que** foram escolhidas e **como** funcionam juntas. Escrito de forma simples para quem não tem experiência técnica.

---

## 🎨 Frontend (Interface Visual)

### React 18 + TypeScript
**O que é:** Biblioteca JavaScript para criar interfaces de usuário
**Por que usamos:**
- ✅ Componentes reutilizáveis (escreve uma vez, usa em vários lugares)
- ✅ Atualizações automáticas na tela quando dados mudam
- ✅ TypeScript previne erros antes do código rodar
- ✅ Comunidade gigante = muitos recursos e ajuda disponível

**Exemplo prático:**
```typescript
// Componente que mostra uma mensagem
function Message({ text, sender }) {
  return (
    <div className={sender === 'user' ? 'bg-blue' : 'bg-gray'}>
      {text}
    </div>
  );
}
```

### Vite
**O que é:** Ferramenta para desenvolvimento rápido
**Por que usamos:**
- ⚡ Servidor dev super rápido (inicia em < 1s)
- 🔥 Hot Module Replacement (vê mudanças instantaneamente)
- 📦 Build otimizado para produção
- 🎯 Suporte nativo a TypeScript e React

**Comparação:**
- Vite: Inicia em 0.5s
- Create React App (antigo): Inicia em 10-30s

### Tailwind CSS
**O que é:** Framework CSS utilitário
**Por que usamos:**
- 🎨 Design rápido com classes prontas (`bg-blue-500`, `p-4`)
- 📱 Responsivo por padrão (funciona em mobile/desktop)
- 🗜️ Remove CSS não usado (arquivo final pequeno)
- 🔧 Customizável via `tailwind.config.js`

**Exemplo prático:**
```html
<!-- Sem Tailwind (CSS tradicional) -->
<div class="card">...</div>
<style>
  .card { padding: 16px; background: white; border-radius: 8px; }
</style>

<!-- Com Tailwind -->
<div class="p-4 bg-white rounded-lg">...</div>
```

### shadcn/ui
**O que é:** Coleção de componentes UI prontos
**Por que usamos:**
- 🎁 Componentes bonitos e acessíveis (Card, Button, Dialog)
- 📋 Baseado em Radix UI (biblioteca profissional)
- ✨ Totalmente customizável (você tem o código)
- ♿ Acessibilidade embutida (screen readers, teclado)

**Componentes usados:**
- `Card` - Cards de análises
- `Badge` - Status (pending, completed)
- `Button` - Botões de ação
- `Dialog` - Modais
- `Toast` - Notificações

### React Router v6
**O que é:** Gerenciamento de rotas (páginas)
**Por que usamos:**
- 🗺️ Navegação entre páginas sem recarregar
- 📍 URLs amigáveis (`/analysis/123`)
- 🔙 Botão voltar funciona corretamente
- 🎯 Roteamento baseado em componentes

**Rotas do sistema:**
```typescript
<Routes>
  <Route path="/" element={<Index />} />              // Lista de análises
  <Route path="/analysis/:id" element={<AnalysisDetails />} />  // Detalhes
</Routes>
```

### Lucide Icons
**O que é:** Biblioteca de ícones SVG
**Por que usamos:**
- 🎨 Ícones modernos e consistentes
- 📦 Importação tree-shakeable (só usa o que precisa)
- 🎯 Totalmente customizável (tamanho, cor)

**Exemplo:**
```typescript
import { Clock, MessageSquare, CheckCircle } from "lucide-react";
<Clock className="h-4 w-4 text-blue-500" />
```

---

## ⚙️ Backend (Servidor)

### Supabase (Backend-as-a-Service)
**O que é:** Plataforma completa de backend
**Por que usamos:**
- 🗄️ **PostgreSQL** (banco de dados robusto)
- 🔐 **Autenticação** (login/registro prontos)
- 📡 **Realtime** (atualizações ao vivo)
- ⚡ **Edge Functions** (código serverless)
- 🔒 **Row Level Security** (segurança no banco)

**Benefícios:**
- ✅ Infraestrutura gerenciada (não precisa configurar servidor)
- ✅ Escalável automaticamente
- ✅ Sem custo inicial (free tier generoso)
- ✅ Dashboard visual para gerenciar dados

### PostgreSQL
**O que é:** Banco de dados relacional
**Por que usamos:**
- 🏗️ Estrutura organizada (tabelas, relações)
- 💪 Suporta JSONB (dados flexíveis + estruturados)
- 🔍 Queries complexas (JOINs, agregações)
- 🔒 ACID (dados sempre consistentes)
- 📈 Performático mesmo com milhões de registros

**Estrutura do banco:**
```
analysis_requests  (análises)
    ├── id
    ├── customer_name
    ├── objectives
    └── metadata (JSONB) → armazena debug_logs, follow-ups, etc

messages  (mensagens do chat)
    ├── id
    ├── analysis_id → FK para analysis_requests
    ├── role (user/ai)
    └── content
```

### Supabase Edge Functions (Deno)
**O que é:** Funções serverless que rodam no edge (perto do usuário)
**Por que usamos:**
- ⚡ Baixa latência (executa próximo ao usuário)
- 💰 Paga apenas pelo que usa (sem servidor ocioso)
- 🔧 Deploy simples (`supabase functions deploy`)
- 🦕 Deno (runtime moderno, seguro, TypeScript nativo)

**Funções criadas:**
1. `handle-webhook` - Recebe mensagens do WhatsApp
2. `monitor-conversations` - Processa conversas e IA

**Por que Deno (não Node.js)?**
- ✅ TypeScript nativo (sem configuração)
- ✅ Mais seguro (permissões explícitas)
- ✅ Imports modernos (URLs diretas)
- ✅ Web APIs padrão (fetch, Response)

### Cron Jobs (pg_cron)
**O que é:** Agendador de tarefas no PostgreSQL
**Por que usamos:**
- ⏰ Executa `monitor-conversations` a cada 30s
- 🔁 Confiável (banco de dados gerencia)
- 📊 Logs de execução no Supabase

**Configuração:**
```sql
SELECT cron.schedule(
  'monitor-conversations',
  '*/30 * * * * *',  -- A cada 30 segundos
  $$ SELECT net.http_post(...) $$
);
```

---

## 🤖 Inteligência Artificial

### OpenAI GPT-4o
**O que é:** Modelo de linguagem da OpenAI
**Por que usamos:**
- 🧠 Conversas naturais e contextuais
- 📚 Entende instruções complexas
- 🎭 Consegue assumir personas (cliente oculto)
- 🇧🇷 Ótimo em português brasileiro

**Modelos usados:**
- `gpt-4o` - Análises intermediate/deep (mais inteligente)
- `gpt-4o-mini` - Análises quick (mais rápido e barato)

**Custos (aproximados):**
- GPT-4o: $2.50 por 1M tokens input / $10 por 1M output
- GPT-4o-mini: $0.15 por 1M tokens input / $0.60 por 1M output

**Exemplo de uso:**
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "Você é um cliente oculto..." },
    { role: "user", content: "Olá! Tudo bem?" },
    { role: "assistant", content: "Oi! Tudo ótimo..." },
    { role: "user", content: "Queria saber sobre X" }
  ],
  temperature: 0.8,  // Criatividade (0 = robótico, 1 = criativo)
  max_tokens: 500    // Limite de resposta
});
```

**Por que não usar modelos open-source (Llama, Mistral)?**
- ❌ Precisaria hospedar (caro e complexo)
- ❌ Qualidade inferior em português
- ❌ Menos context window (memória)
- ✅ GPT-4o é plug-and-play e confiável

---

## 📱 WhatsApp Integration

### Evolution API
**O que é:** API para integração com WhatsApp
**Por que usamos:**
- ✅ Open-source e auto-hospedado
- ✅ Multi-instância (vários números simultâneos)
- ✅ Webhooks para receber mensagens
- ✅ Suporta typing indicators, leitura, etc
- ✅ Não precisa do WhatsApp Business API oficial (evita burocracia)

**Alternativas descartadas:**
- ❌ Twilio WhatsApp: Caro ($0.005/msg) + aprovação Meta
- ❌ Baileys (lib): Precisa manter conexão WebSocket 24/7
- ❌ WhatsApp Business API oficial: Processo de aprovação longo

**Endpoints principais:**
```typescript
// Enviar mensagem
POST /message/sendText/clienteoculto-mulher
{ number: "5511999999999", text: "Olá!" }

// Simular digitação
POST /chat/presence/clienteoculto-mulher
{ number: "5511999999999", state: "composing", delay: 5000 }

// Webhook recebe mensagens
POST /supabase/functions/v1/handle-webhook
{ event: "messages.upsert", data: {...} }
```

---

## 🔄 Realtime (Atualizações ao Vivo)

### Supabase Realtime
**O que é:** WebSocket que escuta mudanças no banco
**Por que usamos:**
- 📡 Frontend atualiza instantaneamente quando backend muda dados
- 🔥 Não precisa ficar fazendo polling (requisições repetidas)
- ⚡ Baixa latência (< 100ms)

**Como funciona:**
```typescript
// Frontend se inscreve para escutar mudanças
const channel = supabase
  .channel(`analysis-${id}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'analysis_requests',
    filter: `id=eq.${id}`
  }, (payload) => {
    console.log('Análise atualizada!', payload.new);
    setAnalysis(payload.new);  // Atualiza UI automaticamente
  })
  .subscribe();
```

**Casos de uso:**
- ✅ Mensagens novas aparecem instantaneamente
- ✅ Timer de follow-up atualiza sem refresh
- ✅ Debug logs surgem em tempo real
- ✅ Status da análise muda ao vivo

---

## 🗺️ Gerenciamento de Estado

### React Hooks (useState, useEffect)
**O que é:** Sistema nativo do React para gerenciar estado
**Por que NÃO usamos Redux/Zustand:**
- ✅ Estado local é suficiente (não há complexidade)
- ✅ Supabase Realtime já sincroniza dados
- ✅ Menos código = mais simples de manter
- ✅ Não há compartilhamento de estado entre rotas distantes

**Exemplo:**
```typescript
function AnalysisDetails() {
  const [messages, setMessages] = useState([]);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    // Busca inicial
    loadAnalysis();

    // Realtime subscription
    const channel = supabase
      .channel('analysis')
      .on('postgres_changes', ..., (payload) => {
        setAnalysis(payload.new);  // Atualiza estado
      })
      .subscribe();

    return () => channel.unsubscribe();
  }, []);
}
```

---

## 🔐 Autenticação e Segurança

### Supabase Auth
**O que é:** Sistema de autenticação completo
**Funcionalidades:**
- 🔑 Login com email/senha
- 🌐 Login social (Google, GitHub, etc)
- 🔒 JWT tokens seguros
- 👤 Gerenciamento de usuários
- 📧 Email de confirmação

### Row Level Security (RLS)
**O que é:** Segurança a nível de linha no PostgreSQL
**Como funciona:**
```sql
-- Política: Usuário só vê suas próprias análises
CREATE POLICY "users_see_own_analyses"
ON analysis_requests
FOR SELECT
USING (auth.uid() = user_id);
```

**Benefícios:**
- ✅ Segurança no banco (não depende do backend)
- ✅ Impossível ver dados de outros usuários
- ✅ Mesmo se hackear o frontend, não acessa dados alheios

---

## 📦 Gerenciamento de Dependências

### npm (Node Package Manager)
**O que é:** Gerenciador de pacotes JavaScript
**Arquivo principal:** `package.json`

**Dependências principais:**
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-router-dom": "^6.x",
    "@supabase/supabase-js": "^2.x",
    "lucide-react": "^0.x",
    "tailwindcss": "^3.x"
  }
}
```

**Scripts úteis:**
```bash
npm install          # Instala dependências
npm run dev          # Roda servidor dev (localhost:5173)
npm run build        # Cria build de produção
npm run preview      # Testa build localmente
```

---

## 🚀 Deploy e Hospedagem

### Frontend: Lovable (ou Vercel/Netlify)
**O que é:** Plataforma de deploy para frontends
**Benefícios:**
- ✅ Deploy automático a cada push no GitHub
- ✅ SSL grátis (HTTPS)
- ✅ CDN global (site rápido em qualquer lugar)
- ✅ Preview deployments (testa antes de publicar)

### Backend: Supabase Cloud
**O que é:** Infraestrutura gerenciada
**Benefícios:**
- ✅ Banco PostgreSQL escalável
- ✅ Edge Functions rodando globalmente
- ✅ Backup automático
- ✅ Monitoramento e logs

### WhatsApp: Evolution API (Auto-hospedado)
**Onde roda:** Easypanel (https://evolution-nova-versao...)
**Tecnologia:** Docker container
**Benefícios:**
- ✅ Controle total sobre instâncias
- ✅ Sem dependência de terceiros
- ✅ Custos fixos (servidor)

---

## 📊 Monitoramento e Logs

### Console Logs (Supabase Functions)
**Como ver:**
```bash
supabase functions logs monitor-conversations --project-ref ltjnbmvfjjphljcavrmp
```

**Níveis:**
- `console.log()` - Informação normal
- `console.warn()` - Avisos
- `console.error()` - Erros

### Debug Logs (Custom)
**O que é:** Sistema próprio de logs no metadata
**Como funciona:**
```typescript
// Backend salva logs no banco
await saveDebugLog(supabase, analysisId, 'info', 'Mensagem', { data });

// Frontend exibe em tempo real
<DebugLogs analysisId={id} />  // Ctrl+Shift+D
```

**Vantagens:**
- ✅ Usuário vê logs sem acesso ao servidor
- ✅ Persistente (não some ao recarregar)
- ✅ Filtrado por análise
- ✅ Interface visual bonita

---

## 🔧 Ferramentas de Desenvolvimento

### VS Code
**Extensões recomendadas:**
- ESLint - Linter JavaScript
- Prettier - Formatação automática
- Tailwind CSS IntelliSense - Autocomplete Tailwind
- TypeScript - Suporte TypeScript

### Git & GitHub
**O que é:** Controle de versão
**Benefícios:**
- 📜 Histórico completo de mudanças
- 🔙 Reverter código se algo quebrar
- 👥 Colaboração entre desenvolvedores
- 🌿 Branches para testar features

### Supabase CLI
**O que é:** Ferramenta de linha de comando
**Comandos úteis:**
```bash
supabase init                    # Inicializa projeto
supabase login                   # Faz login
supabase functions deploy        # Deploy de functions
supabase functions logs          # Ver logs
supabase db push                 # Aplica migrations
```

---

## 💰 Custos Estimados (por mês)

### Cenário: 100 análises/mês, 50 mensagens por análise

#### Supabase (Free tier)
- ✅ 500MB banco de dados: **GRÁTIS**
- ✅ 2GB bandwidth: **GRÁTIS**
- ✅ 500K Edge Function requests: **GRÁTIS**
- ✅ 2GB Realtime: **GRÁTIS**

**Custo:** $0/mês (dentro do free tier)

#### OpenAI
- 100 análises × 50 msgs × ~500 tokens/msg = 2.5M tokens input
- Respostas IA: ~1M tokens output
- GPT-4o-mini: (2.5M × $0.15) + (1M × $0.60) = $0.375 + $0.60 = **$0.98**
- GPT-4o: (2.5M × $2.50) + (1M × $10) = $6.25 + $10 = **$16.25**

**Custo:** $1-16/mês (dependendo do modelo)

#### Evolution API (Auto-hospedado)
- Servidor VPS: **$10-20/mês**
- Ou Easypanel compartilhado: **já pago**

**Custo:** $0-20/mês

### Total Estimado: $1-36/mês

**Comparação com Twilio:**
- 100 análises × 50 msgs × $0.005 = **$25 apenas em mensagens**
- Não inclui servidor, banco, etc

---

## 🎯 Por Que Esta Stack?

### 1. **Simplicidade**
- Menos ferramentas = menos complexidade
- Supabase elimina necessidade de backend separado
- React é padrão da indústria

### 2. **Custo**
- Free tier generoso do Supabase
- OpenAI com preços acessíveis
- Evolution API open-source

### 3. **Escalabilidade**
- Supabase escala automaticamente
- Edge Functions distribuídas globalmente
- PostgreSQL aguenta milhões de registros

### 4. **Produtividade**
- Componentes prontos (shadcn/ui)
- TypeScript previne bugs
- Realtime funciona out-of-the-box
- Deploy automático

### 5. **Manutenibilidade**
- Código TypeScript bem tipado
- Documentação completa
- Stack moderna e popular (fácil achar ajuda)

---

## 🆚 Alternativas Descartadas

### Backend: Node.js + Express + PM2
**Por que NÃO:**
- ❌ Precisa gerenciar servidor
- ❌ Configurar banco separadamente
- ❌ Implementar autenticação do zero
- ❌ Sem realtime nativo
- ❌ Mais código para manter

### Frontend: Next.js
**Por que NÃO (para este projeto):**
- ❌ Overkill (não precisamos SSR)
- ❌ Mais complexo para iniciantes
- ❌ Vite + React é suficiente
- ✅ Seria útil para SEO (mas não é nosso caso)

### Banco: MongoDB
**Por que NÃO:**
- ❌ Menos estruturado (análises têm schema fixo)
- ❌ Queries complexas mais difíceis
- ❌ PostgreSQL + JSONB oferece o melhor dos 2 mundos

### IA: Modelos Open-Source (Llama, Mistral)
**Por que NÃO:**
- ❌ Precisa GPU (caro)
- ❌ Latência maior
- ❌ Qualidade inferior em PT-BR
- ❌ Complexidade de infra

---

## 📚 Recursos de Aprendizado

### React
- [React Docs](https://react.dev) - Documentação oficial
- [React Tutorial](https://react.dev/learn) - Tutorial interativo

### Supabase
- [Supabase Docs](https://supabase.com/docs) - Guias completos
- [Supabase YouTube](https://www.youtube.com/@supabase) - Tutoriais em vídeo

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Guia oficial
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/) - Livro grátis

### Tailwind CSS
- [Tailwind Docs](https://tailwindcss.com/docs) - Referência completa
- [Tailwind UI](https://tailwindui.com/) - Componentes prontos

---

## 🤝 Contribuindo para o Projeto

### Setup Local
```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/cliente-oculto-01.git

# 2. Instale dependências
cd cliente-oculto-01
npm install

# 3. Configure .env.local
cp .env.example .env.local
# Edite .env.local com suas credenciais

# 4. Rode o servidor dev
npm run dev
```

### Workflow
1. Crie branch: `git checkout -b feature/nome-da-feature`
2. Faça mudanças e commite: `git commit -m "feat: descrição"`
3. Push: `git push origin feature/nome-da-feature`
4. Abra Pull Request no GitHub

---

## 🎓 Glossário de Termos Técnicos

- **API:** Interface de Programação de Aplicações (comunicação entre sistemas)
- **Edge Function:** Código que roda próximo ao usuário (baixa latência)
- **Webhook:** URL que recebe notificações automáticas de eventos
- **JWT:** Token seguro para autenticação
- **RLS:** Row Level Security (segurança a nível de linha no banco)
- **SSR:** Server-Side Rendering (renderização no servidor)
- **CDN:** Content Delivery Network (distribui conteúdo globalmente)
- **Polling:** Fazer requisições repetidas para checar atualizações
- **WebSocket:** Conexão persistente para comunicação em tempo real
- **Tree-shaking:** Remover código não usado no build final
- **Hot Module Replacement:** Atualizar código sem recarregar página
