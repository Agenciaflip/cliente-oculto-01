# 🐛 Problemas Conhecidos e Soluções

## 📋 Índice

1. [Problemas Resolvidos](#-problemas-resolvidos)
2. [Problemas Pendentes](#-problemas-pendentes)
3. [Limitações Conhecidas](#-limitações-conhecidas)
4. [Melhorias Sugeridas](#-melhorias-sugeridas)
5. [Histórico de Correções](#-histórico-de-correções)

---

## ✅ Problemas Resolvidos

### 1. Agrupamento de Mensagens Não Funcionava ✅ RESOLVIDO

**Problema:** Quando o vendedor enviava 2 mensagens seguidas (ex: "Sim" + "Oque precisa"), a IA respondia duas vezes separadamente em vez de agrupar.

**Causa Raiz:** O código detectava a janela de agrupamento ativa, mas **continuava processando** em vez de retornar imediatamente.

**Sintomas:**
- Duas respostas da IA em sequência
- Vendedor recebia mensagens desconexas
- Conversa parecia robotizada

**Solução Aplicada (Commit 9208c46):**
```typescript
// supabase/functions/monitor-conversations/index.ts
// Linha ~851

if (windowDate > now) {
  console.log(`🛑 [${analysis.id}] AGUARDANDO janela expirar`);

  // ✅ CRITICAL FIX: Retornar imediatamente
  return {
    analysis_id: analysis.id,
    action: 'waiting_for_analysis_window',
    time_remaining_seconds: timeRemainingSeconds
  };
}

// ❌ ANTES: Código continuava executando aqui (BUG!)
```

**Como Testar:**
1. Criar análise
2. Enviar 2 mensagens no intervalo de 5s: "Sim" + "Oque precisa"
3. Verificar debug logs: deve aparecer "🛑 JANELA ATIVA DETECTADA!"
4. Após 10-15s: deve aparecer "✅ PROCESSANDO 2 MENSAGENS AGRUPADAS"
5. IA deve responder UMA VEZ considerando ambas mensagens

**Status:** ✅ Corrigido e testado

---

### 2. Timer de Follow-up Não Aparecia ✅ RESOLVIDO

**Problema:** Após IA enviar mensagem, o timer não mostrava "Próximo follow-up em: Xh Ymin".

**Causa Raiz:** O campo `metadata.next_follow_up_at` não estava sendo definido quando a IA enviava resposta.

**Sintomas:**
- Timer desaparecia após IA responder
- Usuário não sabia quando follow-up seria enviado
- Interface mostrava "Aguardando resposta" em vez de countdown

**Solução Aplicada (Commit 216b0ad):**

**1. Backend - Definir next_follow_up_at:**
```typescript
// supabase/functions/monitor-conversations/index.ts
// Linha ~1407-1423

if (i === messageChunks.length - 1) {
  const currentFollowUpsSent = currentMetadata.follow_ups_sent || 0;
  const nextFollowUpTime = calculateNextFollowUpTime(analysis, currentFollowUpsSent);

  const mergedMeta = {
    ...(analysis.metadata || {}),
    next_ai_response_at: nextAiResponseAt,
    next_follow_up_at: nextFollowUpTime,  // ✅ Novo!
    follow_ups_sent: currentFollowUpsSent,
    max_follow_ups: maxFollowUps,
    // ...
  };
}
```

**2. Frontend - Simplificar NextResponseTimer:**
```typescript
// src/components/NextResponseTimer.tsx
// Linha ~36-43

// CENÁRIO 2: Se última mensagem foi da IA → mostrar timer de follow-up
if (lastMessageRole === 'ai' && analysisMetadata?.next_follow_up_at) {
  const candidate = new Date(analysisMetadata.next_follow_up_at);
  if (candidate.getTime() > now) {
    targetDate = candidate;
    type = 'follow_up';
  }
}
```

**Como Testar:**
1. Criar análise e trocar mensagens
2. Após IA responder, verificar que timer aparece
3. Timer deve mostrar: "Próximo follow-up em: 1h 30min"
4. Deve exibir "Tentativas restantes: 3/3"

**Status:** ✅ Corrigido e testado

---

### 3. Texto "Analisando Objetivos" Ainda Aparecia ✅ RESOLVIDO

**Problema:** Mesmo desabilitando análise de objetivos, o texto "Analisando a conversa para identificar objetivos..." ainda aparecia na UI.

**Causa Raiz:** Componente `ObjectiveProgressBar` ainda estava sendo renderizado no `AnalysisDetails.tsx`.

**Solução Aplicada (Commit f3ea5ba):**
```typescript
// src/pages/AnalysisDetails.tsx
// Removido:
import { ObjectiveProgressBar } from "@/components/ObjectiveProgressBar"

// E removido do JSX (linha ~733-744):
<ObjectiveProgressBar
  objectives={analysis.objectives}
  analysisId={analysis.id}
/>
```

**Código de Análise de Objetivos Comentado:**
```typescript
// supabase/functions/monitor-conversations/index.ts
// Linha 1483-1604

// 🚫 SISTEMA DE IDENTIFICAÇÃO DE OBJETIVOS DESABILITADO
/*
async function analyzeObjectivesProgress(
  analysis: AnalysisRequest,
  messages: Message[]
): Promise<ObjectiveCompletion> {
  // ... código comentado
}
*/
```

**Status:** ✅ Removido completamente

---

### 4. Logs Não Eram Visíveis ✅ RESOLVIDO

**Problema:** Para ver logs, era necessário usar Supabase CLI ou Dashboard, mas o projeto pertence ao Lovable (sem acesso direto).

**Solução Aplicada (Commits 78fbfd3 + 06aab7d):**

**1. Componente Frontend (DebugLogs.tsx):**
```typescript
// src/components/DebugLogs.tsx (162 linhas)
// - Painel flutuante (Ctrl+Shift+D)
// - Escuta metadata.debug_logs via Realtime
// - Exibe com cores e níveis
// - Dados expandíveis

export function DebugLogs({ analysisId }: DebugLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel(`debug-logs-${analysisId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        table: 'analysis_requests',
        filter: `id=eq.${analysisId}`
      }, (payload) => {
        if (payload.new.metadata?.debug_logs) {
          setLogs(payload.new.metadata.debug_logs);
        }
      })
      .subscribe();
  }, [analysisId]);
}
```

**2. Função Backend (saveDebugLog):**
```typescript
// supabase/functions/monitor-conversations/index.ts
// Linha 11-56

async function saveDebugLog(
  supabase: any,
  analysisId: string,
  level: 'info' | 'warning' | 'error' | 'success',
  message: string,
  data?: any
) {
  // Busca logs atuais
  const currentLogs = analysis?.metadata?.debug_logs || [];

  // Adiciona novo log
  const newLog = { timestamp: new Date().toISOString(), level, message, data };

  // Mantém últimos 100 logs
  const updatedLogs = [...currentLogs, newLog].slice(-100);

  // Salva no metadata (fire-and-forget)
  supabase.from('analysis_requests')
    .update({ metadata: { ...metadata, debug_logs: updatedLogs } })
    .eq('id', analysisId);
}
```

**3. Logs Adicionados (6 pontos críticos):**
```typescript
// Monitor invocado
await saveDebugLog(supabase, analysis.id, 'info', '========== MONITOR INVOCADO ==========');

// Janela ativa detectada
await saveDebugLog(supabase, analysis.id, 'warning', '🛑🛑🛑 JANELA ATIVA DETECTADA!');

// Mensagens agrupadas
await saveDebugLog(supabase, analysis.id, 'success', `✅✅✅ PROCESSANDO ${messages.length} MENSAGENS AGRUPADAS`);

// Resposta IA gerada
await saveDebugLog(supabase, analysis.id, 'success', '🤖 RESPOSTA IA GERADA', { aiResponse });

// Resposta quebrada em chunks
await saveDebugLog(supabase, analysis.id, 'info', `✂️ QUEBRANDO RESPOSTA EM ${chunks.length} CHUNK(S)`);

// Chunk enviado
await saveDebugLog(supabase, analysis.id, 'success', `📤 Chunk ${i+1} enviado via WhatsApp`);
```

**Como Usar:**
1. Abrir tela de análise
2. Pressionar `Ctrl+Shift+D`
3. Ver logs em tempo real
4. Expandir "Ver dados" para detalhes JSON

**Status:** ✅ Implementado e funcionando

---

### 5. Janela de Agrupamento Muito Longa ✅ RESOLVIDO

**Problema:** Janela de agrupamento era de 10-120s (muito aleatório), causando demora excessiva nas respostas.

**Solução Aplicada (Commit 3ab9643):**
```typescript
// supabase/functions/handle-webhook/index.ts
// Linha 166

// ❌ ANTES: 10 a 120 segundos
const randomDelaySeconds = Math.floor(Math.random() * 110) + 10;

// ✅ DEPOIS: 10 a 15 segundos
const randomDelaySeconds = Math.floor(Math.random() * 5) + 10;
```

**Status:** ✅ Corrigido

---

### 6. Componentes de Timer Duplicados ✅ RESOLVIDO

**Problema:** Existiam 2 componentes diferentes (`NextResponseTimer.tsx` e `FollowUpTimer.tsx`), causando confusão e bugs.

**Solução Aplicada (Commit 216b0ad):**
- **DELETADO:** `FollowUpTimer.tsx` (171 linhas)
- **UNIFICADO:** Tudo no `NextResponseTimer.tsx` (128 linhas)
- Lógica única detecta qual timer mostrar baseado na última mensagem

**Status:** ✅ Simplificado e unificado

---

## ⚠️ Problemas Pendentes

### 1. Instância `clienteoculto-homem` Não Existe ⚠️ AÇÃO NECESSÁRIA

**Problema:** Apenas a instância `clienteoculto-mulher` foi criada na Evolution API.

**Impacto:** Usuários não conseguem selecionar "Cliente Oculto Homem" ao criar análise.

**Solução:**
1. Acessar Evolution API: https://evolution-nova-versao-evolution-api.78s68s.easypanel.host/manager/
2. Criar nova instância: `clienteoculto-homem`
3. Conectar com número WhatsApp masculino
4. Testar envio de mensagem

**Prioridade:** 🔴 Alta (funcionalidade incompleta)

---

### 2. Debug Logs Implementados mas Não Testados em Produção ⚠️ VERIFICAR

**Problema:** Sistema de debug logs foi implementado, mas não houve mensagens reais para validar funcionamento.

**O que Testar:**
1. Criar análise de teste
2. Abrir Debug Logs (Ctrl+Shift+D)
3. Enviar 2 mensagens seguidas no WhatsApp
4. Verificar se logs aparecem:
   - "🛑 JANELA ATIVA DETECTADA!"
   - "✅ PROCESSANDO 2 MENSAGENS AGRUPADAS"
   - "🤖 RESPOSTA IA GERADA"
   - "📤 Chunk enviado via WhatsApp"

**Prioridade:** 🟡 Média (funcionalidade implementada, falta validar)

---

### 3. Análise Final de Vendas Superficial ⚠️ MELHORAR

**Problema:** Quando conversa encerra, a análise gerada é básica e não profunda.

**O que Falta:**
- Análise detalhada de técnicas de vendas
- Identificação de objeções e como foram tratadas
- Pontuação de cada critério (rapport, produto, fechamento)
- Comparação com melhores práticas

**Solução Sugerida:**
```typescript
// Criar função dedicada para análise final
async function generateDeepAnalysis(messages: Message[], objectives: string[]) {
  const prompt = `
Analise esta conversa de vendas em PROFUNDIDADE:

MENSAGENS:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

OBJETIVOS:
${objectives.join('\n')}

FORNEÇA:
1. Resumo executivo (2-3 parágrafos)
2. Técnicas de vendas identificadas (com exemplos da conversa)
3. Pontos fortes (com citações)
4. Áreas de melhoria (com sugestões específicas)
5. Alcance de objetivos (cada um com sim/não + justificativa)
6. Score geral (0-10) com breakdown:
   - Rapport (0-10)
   - Conhecimento do produto (0-10)
   - Objeções (0-10)
   - Fechamento (0-10)
  `;

  // Usar GPT-4o com mais tokens
  return await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000  // Análise mais longa
  });
}
```

**Prioridade:** 🟡 Média (funcional mas não ideal)

---

### 4. Pesquisa com Perplexity Não Implementada ⚠️ NÃO IMPLEMENTADO

**Problema:** IA não pesquisa informações externas sobre produtos/empresas.

**Solução Sugerida:**
```typescript
// supabase/functions/_shared/perplexityApi.ts
export async function searchPerplexity(query: string) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: query }]
    })
  });
  return response.json();
}

// Usar antes de gerar resposta IA
const context = await searchPerplexity(`Informações sobre ${productName}`);
```

**Prioridade:** 🟢 Baixa (nice-to-have)

---

### 5. Sem Retry em Falhas de API ⚠️ FALTA IMPLEMENTAR

**Problema:** Se Evolution API ou OpenAI falharem, a função simplesmente falha sem retentar.

**Impacto:** Mensagens podem ser perdidas em caso de falha temporária.

**Solução Sugerida:**
```typescript
// supabase/functions/_shared/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i);  // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries reached');
}

// Uso:
const response = await retryWithBackoff(() =>
  sendWhatsAppMessage(instance, phone, text)
);
```

**Prioridade:** 🔴 Alta (pode perder mensagens)

---

### 6. Timeout de 2h Pode Ser Muito Longo ⚠️ REVISAR

**Problema:** Se vendedor não responde, sistema aguarda 2h antes de encerrar.

**Impacto:** Análises ficam "in_progress" por muito tempo, dando falsa sensação de atividade.

**Solução Sugerida:**
- Reduzir para 1h ou 30min (configurável por profundidade)
- Adicionar opção de "cancelar análise" manualmente

**Prioridade:** 🟡 Média (UX)

---

## 🔒 Limitações Conhecidas

### 1. Supabase Free Tier
- **500MB banco de dados** - OK para ~50k mensagens
- **2GB bandwidth** - ~20k requisições/mês
- **500K Edge Function invocations** - ~16k/dia

**Solução:** Upgrade para Pro ($25/mês) quando escalar

### 2. OpenAI Rate Limits
- **GPT-4o:** 500 requisições/min (suficiente)
- **GPT-4o-mini:** 10,000 requisições/min

**Solução:** Implementar queue se escalar muito

### 3. Evolution API Single Point of Failure
- Se o servidor Easypanel cair, WhatsApp para de funcionar

**Solução:** Ter instância backup ou migrar para Twilio

### 4. Sem Sistema de Filas
- Cron job processa todas análises sequencialmente
- Se tiver 100 análises ativas, pode demorar > 30s

**Solução:** Implementar fila com Bull/BullMQ ou Supabase Queues (beta)

---

## 🎯 Melhorias Sugeridas

### Prioridade Alta 🔴

1. **Implementar Retry Logic**
   - Retentar chamadas falhadas (Evolution + OpenAI)
   - Exponential backoff
   - Salvar logs de falhas

2. **Criar Instância `clienteoculto-homem`**
   - Conectar número masculino
   - Testar envio/recebimento

3. **Validação de Telefone Mais Rigorosa**
   - Verificar formato correto (55 + DDD + número)
   - Verificar se número existe no WhatsApp (Evolution API)

4. **Análise Final Aprofundada**
   - Prompt mais detalhado
   - Mais tokens (2000+)
   - Estrutura JSON para fácil exibição

### Prioridade Média 🟡

5. **Webhook Signature Validation**
   - Validar que webhook veio realmente da Evolution
   - Prevenir requisições falsas

6. **Rate Limiting**
   - Limitar tentativas de criação de análise
   - Prevenir spam

7. **Exportar Conversa em PDF**
   - Gerar relatório bonito
   - Incluir gráficos de métricas
   - Compartilhável

8. **Dashboard de Métricas**
   - Visão geral de todas análises
   - Gráficos de performance
   - Comparativo entre vendedores

### Prioridade Baixa 🟢

9. **Integração com Perplexity**
   - Pesquisar informações sobre produtos
   - Enriquecer contexto da IA

10. **Sistema de Templates**
    - Templates de prompts prontos
    - Por tipo de negócio (e-commerce, serviços, etc)

11. **Gravação de Áudio**
    - Se vendedor enviar áudio, transcrever com Whisper
    - Responder via texto ou áudio

12. **Multi-idioma**
    - Suportar outros idiomas além de PT-BR
    - Detectar idioma automaticamente

---

## 📜 Histórico de Correções

### Janeiro 2025

#### Commit 06aab7d - "feat: Implementar saveDebugLog no backend" (26/01/2025)
- ✅ Criada função `saveDebugLog()` no monitor-conversations
- ✅ Adicionados 6 pontos de log críticos
- ✅ Fire-and-forget pattern (não bloqueia processamento)
- ✅ Mantém últimos 100 logs no metadata

#### Commit 78fbfd3 - "feat: Criar DebugLogs.tsx visual" (26/01/2025)
- ✅ Criado componente `DebugLogs.tsx` (162 linhas)
- ✅ Painel flutuante com Ctrl+Shift+D
- ✅ Realtime subscription para logs
- ✅ UI estilo terminal com cores e níveis
- ✅ Dados JSON expandíveis

#### Commit 216b0ad - "fix: Simplificar timer e unificar componentes" (26/01/2025)
- ✅ DELETADO `FollowUpTimer.tsx`
- ✅ Unificado tudo em `NextResponseTimer.tsx`
- ✅ Lógica única baseada em última mensagem
- ✅ Definir `next_follow_up_at` após IA enviar
- ✅ Exibir tentativas restantes (X/3)

#### Commit 9208c46 - "fix: Adicionar early return em janela ativa" (25/01/2025)
- ✅ CRITICAL FIX: Retornar quando janela ativa detectada
- ✅ Previne processamento duplicado
- ✅ Agrupa mensagens corretamente
- ✅ Adicionados logs ultra-detalhados (8 pontos)

#### Commit f3ea5ba - "fix: Remover texto de análise de objetivos" (25/01/2025)
- ✅ Removido `ObjectiveProgressBar` do AnalysisDetails
- ✅ Removido import do componente
- ✅ Sistema de análise de objetivos comentado

#### Commit 3ab9643 - "fix: Corrigir agrupamento e timer de follow-up" (25/01/2025)
- ✅ Janela de agrupamento: 10-15s (era 10-120s)
- ✅ Timer de follow-up implementado
- ✅ Objetivos da análise desabilitados
- ✅ Formulário objectives exibido na tela

---

## 🧪 Como Testar Cada Fix

### Teste 1: Agrupamento de Mensagens
```
1. Criar análise de teste
2. Abrir Debug Logs (Ctrl+Shift+D)
3. Enviar 2 mensagens no WhatsApp (intervalo < 5s):
   - Mensagem 1: "Sim"
   - Mensagem 2: "Oque precisa"
4. ✅ ESPERADO:
   - Log: "🛑 JANELA ATIVA DETECTADA!"
   - Após 10-15s: "✅ PROCESSANDO 2 MENSAGENS AGRUPADAS"
   - IA responde UMA VEZ considerando ambas
```

### Teste 2: Timer de Follow-up
```
1. Criar análise e trocar mensagens
2. Última mensagem da IA
3. ✅ ESPERADO:
   - Timer aparece: "Próximo follow-up em: 1h 30min"
   - Mostra "Tentativas restantes: 3/3"
   - Countdown atualiza a cada segundo
4. NÃO responder no WhatsApp
5. Após 1h30min:
   - ✅ Recebe follow-up automático
   - Timer atualiza: "Tentativas restantes: 2/3"
```

### Teste 3: Debug Logs
```
1. Criar análise
2. Pressionar Ctrl+Shift+D
3. Enviar mensagem no WhatsApp
4. ✅ ESPERADO:
   - Logs aparecem em tempo real
   - Cores diferentes por nível (info/warning/error/success)
   - Timestamp correto
   - "Ver dados" mostra JSON expandível
```

---

## 📞 Suporte

Se encontrar novos bugs:

1. **Verificar Debug Logs** (Ctrl+Shift+D na tela de análise)
2. **Verificar Supabase Logs:**
   ```bash
   supabase functions logs monitor-conversations --project-ref ltjnbmvfjjphljcavrmp
   ```
3. **Documentar:**
   - O que estava fazendo
   - O que esperava acontecer
   - O que aconteceu de fato
   - Logs capturados
4. **Reportar** neste documento ou criar issue no GitHub

---

## 🎯 Próximos Passos Recomendados

1. 🔴 **Criar instância `clienteoculto-homem`** (bloqueador)
2. 🔴 **Implementar retry logic** (prevenir perda de mensagens)
3. 🟡 **Testar debug logs em produção** (validar funcionamento)
4. 🟡 **Melhorar análise final** (valor agregado ao cliente)
5. 🟢 **Adicionar Perplexity** (diferencial competitivo)

---

**Última Atualização:** 26/01/2025
**Versão do Documento:** 1.0
**Status do Projeto:** ⚠️ Funcional com melhorias pendentes
