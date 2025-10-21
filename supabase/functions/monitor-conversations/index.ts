import "https://deno.land/x/xhr@0.1.0/mod.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPersonaPrompt } from "../_shared/prompts/personas.ts";
import { getRandomCasualTopic, getRandomTransition } from "../_shared/prompts/casual-topics.ts";
import { analyzeObjectivesProgress } from "../_shared/utils/objective-analyzer.ts";
import { DEPTH_CONFIG, calculateNextFollowUpTime } from "../_shared/config/analysis-config.ts";

// Função auxiliar para saudação contextual (horário de Brasília)
function getGreetingByTime(): string {
  const nowUTC = new Date();
  
  // Usar formatToParts para extrair hora com segurança
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false
  }).formatToParts(nowUTC);
  
  const hourPart = parts.find(p => p.type === 'hour');
  const brasiliaHour = hourPart ? parseInt(hourPart.value) : new Date().getHours();
  
  console.log(`🕐 Horário Brasília: ${brasiliaHour}h`);
  
  // 5h-11h59: bom dia
  if (brasiliaHour >= 5 && brasiliaHour < 12) {
    console.log(`✅ Saudação: bom dia`);
    return 'bom dia';
  }
  // 12h-17h59: boa tarde
  if (brasiliaHour >= 12 && brasiliaHour < 18) {
    console.log(`✅ Saudação: boa tarde`);
    return 'boa tarde';
  }
  // 18h-4h59: boa noite
  console.log(`✅ Saudação: boa noite`);
  return 'boa noite';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    
    // Carregar credenciais Evolution API padrão (male/neutral)
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    
    // Carregar credenciais Evolution API feminina
    const evolutionUrlFemale = Deno.env.get('EVOLUTION_API_URL_FEMALE');
    const evolutionKeyFemale = Deno.env.get('EVOLUTION_API_KEY_FEMALE');
    const evolutionInstanceFemale = Deno.env.get('EVOLUTION_INSTANCE_NAME_FEMALE');

    // Tentar pegar analysis_id do body (quando trigger dispara)
    let specificAnalysisId: string | null = null;
    try {
      const body = await req.json();
      specificAnalysisId = body?.analysis_id || null;
    } catch {
      // Se não tem body, processa todas
    }

    // Debounce de 2 segundos para agrupar mensagens rápidas
    if (specificAnalysisId) {
      console.log(`⏱️ [${specificAnalysisId}] Aguardando 2s para agrupar mensagens...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('🔍 Monitor: Buscando conversas ativas...');

    // 🧹 CLEANUP: Liberar mensagens travadas (claim > 10 minutos)
    await cleanupStuckMessages(supabase);

    // Se tem analysis_id específico, buscar apenas ele
    let query = supabase
      .from('analysis_requests')
      .select('*')
      .in('status', ['chatting', 'pending_follow_up']);

    if (specificAnalysisId) {
      query = query.eq('id', specificAnalysisId);
      console.log(`🎯 Processando análise específica: ${specificAnalysisId}`);
    }

    const { data: activeAnalyses } = await query;

    if (!activeAnalyses || activeAnalyses.length === 0) {
      console.log('Nenhuma conversa ativa encontrada');
      return new Response(
        JSON.stringify({ message: 'No active conversations' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Monitorando ${activeAnalyses.length} conversa(s) ativa(s)`);

    const results = await Promise.allSettled(
      activeAnalyses.map(analysis => processConversation(
        analysis, 
        supabase, 
        openAIKey!, 
        evolutionUrl!, 
        evolutionKey!, 
        evolutionInstance!,
        evolutionUrlFemale!,
        evolutionKeyFemale!,
        evolutionInstanceFemale!
      ))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Monitor concluído: ${successful} processadas, ${failed} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true,
        monitored: activeAnalyses.length,
        successful,
        failed,
        specific_analysis: specificAnalysisId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in monitor-conversations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============= FUNÇÃO PARA QUEBRAR MENSAGEM EM CHUNKS =============
function splitMessageIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  
  // Se a mensagem é curta (até 160 chars), enviar como 1 linha
  if (text.length <= 160) {
    return [text];
  }
  
  // Se é longa, quebrar em máximo 2 linhas
  const sentences = text.split(/([.!?,]\s+)/);
  let firstLine = '';
  let secondLine = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    if (firstLine.length === 0 || (firstLine.length + sentence.length <= 160)) {
      firstLine += sentence;
    } else {
      secondLine += sentence;
    }
  }
  
  if (firstLine.trim()) chunks.push(firstLine.trim());
  if (secondLine.trim()) chunks.push(secondLine.trim());
  
  return chunks.filter(c => c.length > 0);
}

// ============= FUNÇÃO AUXILIAR: SELECIONAR EVOLUTION CREDENTIALS =============
function getEvolutionCredentials(instanceIdentifier: string) {
  // Reconhecer tanto o gender quanto o nome da instância
  const isFemale = instanceIdentifier === 'female' || 
                   instanceIdentifier === 'clienteoculto-mulher' ||
                   instanceIdentifier === Deno.env.get('EVOLUTION_INSTANCE_NAME_FEMALE');
  
  if (isFemale) {
    return {
      url: Deno.env.get('EVOLUTION_API_URL_FEMALE'),
      key: Deno.env.get('EVOLUTION_API_KEY_FEMALE'),
      instance: Deno.env.get('EVOLUTION_INSTANCE_NAME_FEMALE')
    };
  }
  
  // Default: male/neutral
  return {
    url: Deno.env.get('EVOLUTION_API_URL'),
    key: Deno.env.get('EVOLUTION_API_KEY'),
    instance: Deno.env.get('EVOLUTION_INSTANCE_NAME')
  };
}

// ============= INTERFACE DO PLANO DE CONVERSA =============
interface QuestionStep {
  order: number;
  objective: string;
  approach: string;
  estimated_messages: number;
  status?: 'completed' | 'in_progress' | 'pending';
}

interface AdaptationLog {
  timestamp: string;
  reason: string;
  changes: string;
}

interface ConversationPlan {
  created_at: string;
  last_updated: string;
  version: number;
  objectives: string[];
  strategy: {
    warm_up_topics: string[];
    transition_approach: string;
    question_sequence: QuestionStep[];
  };
  adaptation_log: AdaptationLog[];
  current_phase: 'planning' | 'warm_up' | 'transition' | 'investigation' | 'closing';
  estimated_total_messages: number;
  messages_sent?: number;
}

// ============= FUNÇÃO PARA GERAR PLANO INICIAL =============
async function generateConversationPlan(
  analysis: any,
  openAIKey: string
): Promise<ConversationPlan> {
  console.log(`🧠 [${analysis.id}] Gerando plano de conversa com OpenAI...`);
  
  const goals = analysis.investigation_goals || '';
  const segment = analysis.business_segment || 'geral';
  const phone = analysis.phone_number || '';
  
  const prompt = `Você é um planejador estratégico de conversas de cliente oculto.

CONTEXTO:
- Negócio: ${segment}
- Telefone: ${phone}
- Objetivos: ${goals}

TAREFA: Criar um plano completo de conversa dividido em:

1. WARM-UP (2-3 tópicos casuais para iniciar naturalmente)
2. TRANSIÇÃO (como mudar de assunto casual para investigação)
3. SEQUÊNCIA DE PERGUNTAS (ordem lógica para alcançar os objetivos)

RESPONDA EM JSON:
{
  "warm_up_topics": ["tópico 1", "tópico 2"],
  "transition_approach": "como fazer a transição",
  "question_sequence": [
    {
      "order": 1,
      "objective": "descobrir X",
      "approach": "perguntar de forma Y",
      "estimated_messages": 2
    }
  ],
  "estimated_total_messages": 10
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Você é um especialista em planejamento de conversas de cliente oculto. Sempre responda em JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const planData = JSON.parse(data.choices[0].message.content);
    
    const objectives = goals.split(/\n|;/).filter((g: string) => g.trim()).map((g: string) => g.trim());
    
    const plan: ConversationPlan = {
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      version: 1,
      objectives,
      strategy: {
        warm_up_topics: planData.warm_up_topics || [],
        transition_approach: planData.transition_approach || '',
        question_sequence: planData.question_sequence || [],
      },
      adaptation_log: [{
        timestamp: new Date().toISOString(),
        reason: 'Plano inicial criado',
        changes: 'Primeira versão do plano estratégico'
      }],
      current_phase: 'planning',
      estimated_total_messages: planData.estimated_total_messages || 10,
      messages_sent: 0
    };
    
    console.log(`✅ [${analysis.id}] Plano criado: ${plan.strategy.question_sequence.length} objetivos, estimativa ${plan.estimated_total_messages} msgs`);
    
    return plan;
  } catch (error) {
    console.error(`❌ [${analysis.id}] Erro ao gerar plano:`, error);
    
    // Fallback: plano básico
    const objectives = goals.split(/\n|;/).filter((g: string) => g.trim()).map((g: string) => g.trim());
    return {
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      version: 1,
      objectives,
      strategy: {
        warm_up_topics: ['horário de funcionamento', 'formas de pagamento'],
        transition_approach: 'Após resposta, perguntar sobre produtos/serviços',
        question_sequence: objectives.map((obj: string, i: number) => ({
          order: i + 1,
          objective: obj,
          approach: 'Perguntar diretamente mas de forma natural',
          estimated_messages: 2
        }))
      },
      adaptation_log: [{
        timestamp: new Date().toISOString(),
        reason: 'Plano básico (fallback)',
        changes: 'Criado plano simplificado devido a erro na IA'
      }],
      current_phase: 'planning',
      estimated_total_messages: objectives.length * 2 + 3,
      messages_sent: 0
    };
  }
}

// ============= FUNÇÃO PARA ADAPTAR PLANO =============
async function adaptConversationPlan(
  currentPlan: ConversationPlan,
  conversationHistory: any[],
  objectivesProgress: any,
  openAIKey: string,
  analysisId: string
): Promise<ConversationPlan | null> {
  console.log(`🔄 [${analysisId}] Verificando necessidade de adaptar plano...`);
  
  // Só adaptar a cada 5 mensagens ou mudança significativa de progresso
  const messagesSincePlan = conversationHistory.length - (currentPlan.messages_sent || 0);
  
  if (messagesSincePlan < 5) {
    console.log(`⏭️ [${analysisId}] Sem necessidade de adaptar (apenas ${messagesSincePlan} msgs desde última atualização)`);
    return null;
  }
  
  // Verificar se houve mudança significativa nos objetivos
  const currentProgress = objectivesProgress?.percentage || 0;
  const lastKnownProgress = currentPlan.strategy.question_sequence.filter(q => q.status === 'completed').length / 
    currentPlan.strategy.question_sequence.length * 100;
  
  const progressChange = Math.abs(currentProgress - lastKnownProgress);
  
  if (progressChange < 20) {
    console.log(`⏭️ [${analysisId}] Progresso pouco mudou (${progressChange.toFixed(0)}%), mantendo plano atual`);
    return null;
  }
  
  console.log(`🧠 [${analysisId}] Adaptando plano (progresso mudou ${progressChange.toFixed(0)}%)...`);
  
  const recentMessages = conversationHistory.slice(-10).map(m => 
    `[${m.role}]: ${m.content}`
  ).join('\n');
  
  const prompt = `Você está adaptando um plano de conversa de cliente oculto.

PLANO ATUAL:
${JSON.stringify(currentPlan.strategy, null, 2)}

ÚLTIMAS 10 MENSAGENS:
${recentMessages}

PROGRESSO OBJETIVOS: ${currentProgress}%

TAREFA: Se a conversa desviou do plano ou novos insights surgiram, adapte a estratégia.

RESPONDA EM JSON:
{
  "needs_adaptation": true/false,
  "reason": "por que adaptar ou não",
  "updated_strategy": { ... mesmo formato do plano atual ... }
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Você é um especialista em adaptar conversas de cliente oculto. Sempre responda em JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const adaptData = JSON.parse(data.choices[0].message.content);
    
    if (!adaptData.needs_adaptation) {
      console.log(`✅ [${analysisId}] IA decidiu não adaptar: ${adaptData.reason}`);
      return null;
    }
    
    const updatedPlan: ConversationPlan = {
      ...currentPlan,
      last_updated: new Date().toISOString(),
      version: currentPlan.version + 1,
      strategy: adaptData.updated_strategy,
      adaptation_log: [
        ...currentPlan.adaptation_log,
        {
          timestamp: new Date().toISOString(),
          reason: adaptData.reason,
          changes: `Versão ${currentPlan.version} → ${currentPlan.version + 1}`
        }
      ],
      messages_sent: conversationHistory.length
    };
    
    console.log(`✅ [${analysisId}] Plano adaptado para v${updatedPlan.version}: ${adaptData.reason}`);
    
    return updatedPlan;
  } catch (error) {
    console.error(`❌ [${analysisId}] Erro ao adaptar plano:`, error);
    return null;
  }
}

// ============= FUNÇÕES DE ANÁLISE DE HISTÓRICO =============
function analyzeConversationHistory(messages: any[]): {
  questionsAsked: string[];
  topicsDiscussed: string[];
  reactionsUsed: string[];
  recentUserQuestions: string[];
} {
  const questionsAsked: string[] = [];
  const topicsDiscussed: string[] = [];
  const reactionsUsed: string[] = [];
  const recentUserQuestions: string[] = [];

  // Palavras-chave de tópicos comuns
  const topicKeywords: { [key: string]: string[] } = {
    'preço': ['quanto', 'valor', 'preço', 'custo', 'custa'],
    'prazo': ['prazo', 'demora', 'tempo', 'entrega', 'quando'],
    'garantia': ['garantia', 'devolução', 'troca', 'problema'],
    'pagamento': ['pagamento', 'parcelado', 'pix', 'cartão', 'boleto'],
    'funcionamento': ['funciona', 'como', 'processo', 'etapas'],
    'suporte': ['suporte', 'ajuda', 'atendimento', 'contato'],
    'localização': ['endereço', 'onde', 'local', 'fica', 'região'],
    'benefícios': ['benefício', 'vantagem', 'diferencial', 'melhor'],
  };

  for (const msg of messages) {
    if (msg.role === 'ai') {
      const content = msg.content.toLowerCase();

      // 1. DETECTAR PERGUNTAS (termina com ?)
      const sentences = content.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      for (const sentence of sentences) {
        if (sentence.includes('?') || 
            sentence.startsWith('quanto') || 
            sentence.startsWith('qual') ||
            sentence.startsWith('como') ||
            sentence.startsWith('onde') ||
            sentence.startsWith('quando') ||
            sentence.startsWith('tem')) {
          questionsAsked.push(sentence);
        }
      }

      // 2. DETECTAR TÓPICOS DISCUTIDOS
      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(kw => content.includes(kw))) {
          if (!topicsDiscussed.includes(topic)) {
            topicsDiscussed.push(topic);
          }
        }
      }

      // 3. DETECTAR REAÇÕES USADAS
      const commonReactions = [
        'ah massa', 'ah legal', 'hmm', 'entendi', 'beleza', 'ok', 
        'certo', 'perfeito', 'legal', 'show', 'massa', 'que bom',
        'interessante', 'bacana', 'adorei', 'top'
      ];
      
      for (const reaction of commonReactions) {
        if (content.includes(reaction)) {
          reactionsUsed.push(reaction);
        }
      }
    } else if (msg.role === 'user') {
      // Detectar perguntas do vendedor
      if (msg.content.includes('?')) {
        recentUserQuestions.push(msg.content);
      }
    }
  }

  return {
    questionsAsked,
    topicsDiscussed,
    reactionsUsed,
    recentUserQuestions: recentUserQuestions.slice(-3) // Últimas 3
  };
}

function isQuestionSimilar(newQuestion: string, previousQuestions: string[]): boolean {
  const newQ = newQuestion.toLowerCase().replace(/[^\w\s]/g, '');
  
  for (const prevQ of previousQuestions) {
    const prevQClean = prevQ.toLowerCase().replace(/[^\w\s]/g, '');
    
    // 1. Perguntas idênticas ou quase idênticas
    if (newQ === prevQClean) return true;
    
    // 2. Mesmas palavras-chave principais
    const newWords = newQ.split(' ').filter((w: string) => w.length > 3);
    const prevWords = prevQClean.split(' ').filter((w: string) => w.length > 3);
    const commonWords = newWords.filter((w: string) => prevWords.includes(w));
    
    // Se 70%+ das palavras são iguais, considera similar
    if (commonWords.length >= Math.min(newWords.length, prevWords.length) * 0.7) {
      return true;
    }
  }
  
  return false;
}

function suggestVariedReaction(usedReactions: string[]): string[] {
  const allReactions = [
    'entendi', 'beleza', 'ok', 'certo', 'bom saber', 'show', 'massa',
    'pode crer', 'saquei', 'faz sentido', 'legal', 'perfeito', 'adorei',
    'que bom', 'interessante', 'bacana', 'top', 'valeu'
  ];
  
  // Retornar reações NÃO usadas ainda
  const unused = allReactions.filter((r: string) => !usedReactions.includes(r));
  return unused.length > 0 ? unused : allReactions;
}

// ============= CLEANUP DE MENSAGENS TRAVADAS =============
async function cleanupStuckMessages(supabase: any) {
  const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutos
  const now = new Date();
  
  try {
    const { data: stuckMessages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('role', 'user')
      .eq('metadata->>processed', 'false')
      .not('metadata->>claimed_at', 'is', null);
    
    if (!stuckMessages?.length) return;
    
    let cleanedCount = 0;
    for (const msg of stuckMessages) {
      const claimedAt = new Date(msg.metadata.claimed_at);
      const elapsedMs = now.getTime() - claimedAt.getTime();
      
      if (elapsedMs > STUCK_THRESHOLD_MS) {
        console.log(`🧹 Limpando mensagem travada: ${msg.id} (stuck por ${(elapsedMs / 1000 / 60).toFixed(1)}min)`);
        
        await supabase
          .from('conversation_messages')
          .update({
            metadata: {
              ...msg.metadata,
              claimed_at: null,
              claimed_by: null,
              recovered_at: now.toISOString(),
              stuck_duration_ms: elapsedMs,
              previous_claim_at: msg.metadata.claimed_at
            }
          })
          .eq('id', msg.id);
        
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`✅ Cleanup concluído: ${cleanedCount} mensagens liberadas`);
    }
  } catch (error) {
    console.error('❌ Erro no cleanup de mensagens travadas:', error);
  }
}

async function processConversation(
  analysis: any,
  supabase: any,
  openAIKey: string,
  evolutionUrlParam: string,
  evolutionKeyParam: string,
  evolutionInstanceParam: string,
  evolutionUrlFemale: string,
  evolutionKeyFemale: string,
  evolutionInstanceFemale: string
) {
  // Selecionar credenciais - PRIORIZAR evolution_instance do DB
  const instanceToUse = analysis.evolution_instance || analysis.ai_gender || 'male';
  console.log(`📡 Usando instância: ${instanceToUse} (evolution_instance: ${analysis.evolution_instance}, ai_gender: ${analysis.ai_gender})`);
  const evoCredentials = getEvolutionCredentials(instanceToUse);
  const actualEvolutionUrl = evoCredentials.url!;
  const actualEvolutionKey = evoCredentials.key!;
  const actualEvolutionInstance = evoCredentials.instance!;
  
  console.log(`🔧 [${analysis.id}] Usando Evolution ${actualEvolutionInstance}`);
  
  // STRICT MODE: Validar que a instância no DB bate com a que estamos usando
  if (analysis.evolution_instance && analysis.evolution_instance !== actualEvolutionInstance) {
    console.error(`❌ MISMATCH CRÍTICO: analysis ${analysis.id} esperava ${analysis.evolution_instance} mas está tentando usar ${actualEvolutionInstance}`);
    
    await supabase
      .from('analysis_requests')
      .update({ 
        status: 'failed',
        metadata: {
          ...(analysis.metadata || {}),
          error: 'Instance mismatch detected',
          expected_instance: analysis.evolution_instance,
          actual_instance: actualEvolutionInstance,
          error_timestamp: new Date().toISOString()
        }
      })
      .eq('id', analysis.id);
    
    console.log(`🛑 Análise ${analysis.id} pausada por mismatch de instância`);
    return;
  }

  try {
    // Buscar todas mensagens da conversa
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('analysis_id', analysis.id)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return { analysis_id: analysis.id, action: 'no_messages' };
    }

    const lastMessage = messages[messages.length - 1];
    const timeSinceLastMessage = Date.now() - new Date(analysis.last_message_at).getTime();

    // CENÁRIO A: Mensagens não processadas (PRIORIDADE)
    const CLAIM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
    const now = new Date();
    
    // Buscar mensagens não processadas
    const { data: unprocessedMessages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('analysis_id', analysis.id)
      .eq('role', 'user')
      .eq('metadata->>processed', 'false')
      .order('created_at', { ascending: true });

    const unprocessedList = unprocessedMessages || [];
    const messagesToProcess: any[] = [];

    // ============= VALIDAÇÃO DE CLAIMS E TIMEOUTS =============
    for (const msg of unprocessedList) {
      // 1. Verificar se tem claim
      if (msg.metadata?.claimed_at) {
        const claimedAt = new Date(msg.metadata.claimed_at);
        const elapsedMs = now.getTime() - claimedAt.getTime();
        const elapsedMinutes = elapsedMs / 1000 / 60;
        
        // Se claim < 5 minutos, pular (worker ainda processando)
        if (elapsedMs < CLAIM_TIMEOUT_MS) {
          console.log(`⏭️ [${analysis.id}] Mensagem ${msg.id} claimed recentemente (${elapsedMinutes.toFixed(1)}min atrás), pulando.`);
          continue;
        }
        
        // Claim expirado, liberar para reprocessamento
        console.log(`⚠️ [${analysis.id}] Claim expirado para mensagem ${msg.id} (${elapsedMinutes.toFixed(1)}min), liberando...`);
        
        await supabase
          .from('conversation_messages')
          .update({
            metadata: {
              ...msg.metadata,
              claimed_at: null,
              claimed_by: null,
              claim_expired: true,
              claim_expired_at: now.toISOString(),
              previous_claim_at: msg.metadata.claimed_at,
              previous_claim_by: msg.metadata.claimed_by,
              claim_duration_ms: elapsedMs
            }
          })
          .eq('id', msg.id);
      }
      
      // 2. Verificar se next_ai_response_at passou sem resposta
      if (msg.metadata?.next_ai_response_at) {
        const nextResponseTime = new Date(msg.metadata.next_ai_response_at);
        
        if (now > nextResponseTime && msg.metadata.processed === false) {
          const delayMs = now.getTime() - nextResponseTime.getTime();
          const delayMinutes = delayMs / 1000 / 60;
          
          console.log(`⚠️ [${analysis.id}] Resposta ATRASADA detectada para mensagem ${msg.id}! Era pra responder ${delayMinutes.toFixed(1)}min atrás`);
          
          // Forçar reprocessamento
          await supabase
            .from('conversation_messages')
            .update({
              metadata: {
                ...msg.metadata,
                claimed_at: null,
                claimed_by: null,
                force_reprocess: true,
                delayed_by_ms: delayMs,
                delayed_response_detected_at: now.toISOString()
              }
            })
            .eq('id', msg.id);
        }
      }
      
      // Adicionar à fila de processamento
      messagesToProcess.push(msg);
    }

    if (messagesToProcess.length > 0) {
      // ⏱️ AGRUPAR: Aguardar 2-3s antes de reivindicar para agrupar mensagens consecutivas
      console.log(`⏱️ [${analysis.id}] Aguardando 2s para agrupar possíveis mensagens consecutivas...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Re-buscar mensagens não processadas (podem ter chegado mais)
      const { data: finalPendingMessages } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('analysis_id', analysis.id)
        .eq('role', 'user')
        .eq('metadata->>processed', 'false')
        .is('metadata->>claimed_by', null)
        .order('created_at', { ascending: true });
      
      const finalMessagesToProcess = finalPendingMessages || messagesToProcess;
      
      // Atomic claim to avoid duplicate processing
      const runId = crypto.randomUUID();
      const claimedMessages: any[] = [];
      
      for (const msg of finalMessagesToProcess) {
        const newMeta = { 
          ...(msg.metadata || {}), 
          claimed_by: runId, 
          claimed_at: new Date().toISOString(),
          claim_attempt: (msg.metadata?.claim_attempt || 0) + 1
        };
        
        const { data: updated, error } = await supabase
          .from('conversation_messages')
          .update({ metadata: newMeta })
          .eq('id', msg.id)
          .eq('role', 'user')
          .is('metadata->>claimed_by', null)
          .eq('metadata->>processed', 'false')
          .select('id, metadata')
          .limit(1);
          
        if (!error && updated && updated.length > 0) {
          claimedMessages.push({ ...msg, metadata: updated[0].metadata });
        }
      }

      if (claimedMessages.length === 0) {
        console.log(`⏭️ [${analysis.id}] Mensagens já foram reivindicadas por outro worker. Pulando.`);
        return { analysis_id: analysis.id, action: 'skipped_already_claimed' };
      }

      console.log(`📦 [${analysis.id}] Agrupadas e reivindicadas ${claimedMessages.length} mensagens (runId=${runId})`);

      // ⏰ UM ÚNICO DELAY para TODAS as mensagens agrupadas (30s a 3min)
      const randomDelayMs = Math.floor(Math.random() * (3 * 60 * 1000 - 30 * 1000) + 30 * 1000);
      const delaySeconds = (randomDelayMs / 1000).toFixed(0);
      const nextResponseAt = new Date(Date.now() + randomDelayMs).toISOString();
      
      console.log(`⏰ [${analysis.id}] Aguardando ${delaySeconds}s antes de responder ao grupo de ${claimedMessages.length} mensagens...`);
      
      // Salvar next_ai_response_at em TODAS as mensagens do grupo
      for (const msg of claimedMessages) {
        await supabase
          .from('conversation_messages')
          .update({
            metadata: { 
              ...msg.metadata, 
              next_ai_response_at: nextResponseAt,
              grouped_with: claimedMessages.map(m => m.id),
              group_size: claimedMessages.length
            } 
          })
          .eq('id', msg.id);
      }
      
      await new Promise(resolve => setTimeout(resolve, randomDelayMs));

      // Agrupar conteúdo das mensagens reivindicadas
      const groupedContent = claimedMessages.map((m: any) => m.content).join('\n');

      // Análise de histórico
      const conversationAnalysis = analyzeConversationHistory(messages);

      console.log(`📋 [${analysis.id}] Histórico: ${conversationAnalysis.questionsAsked.length} perguntas, ${conversationAnalysis.topicsDiscussed.length} tópicos`);

      // Contar perguntas já feitas
      const aiQuestionsCount = messages.filter((m: any) => 
        m.role === 'ai' && !m.metadata?.is_nudge
      ).length;

      const currentQuestionIndex = aiQuestionsCount;
      const questionsStrategy = analysis.questions_strategy;
      const totalQuestions = questionsStrategy?.questions?.length || 0;

      // NOVO: Conversation Stage Tracker
      const metadata = analysis.metadata || {};
      const conversationStage = metadata.conversation_stage || 'warm_up';
      const casualInteractions = metadata.casual_interactions || 0;
      const objectiveQuestionsAsked = metadata.objective_questions_asked || 0;
      const totalInteractions = aiQuestionsCount;

      // Determinar próxima ação baseado em estágio
      let nextQuestion: any = null;
      let nextStepInstruction = '';
      let newStage = conversationStage;

      // CAMADA 1: WARM-UP (primeiras 2-3 interações)
      if (conversationStage === 'warm_up' && casualInteractions < 2) {
        const casualTopic = getRandomCasualTopic(analysis.business_segment);
        nextStepInstruction = `WARM-UP: Faça uma pergunta CASUAL sobre a empresa (NÃO relacionada ao objetivo): "${casualTopic}" - Seja natural e curioso.`;
        newStage = 'warm_up';
      }
      // CAMADA 2: TRANSITION (após warm-up)
      else if (conversationStage === 'warm_up' && casualInteractions >= 2) {
        const transition = getRandomTransition();
        nextStepInstruction = `TRANSIÇÃO: Use "${transition}" e então INTRODUZA SUTILMENTE o primeiro objetivo: ${analysis.investigation_goals?.split('\n')[0] || questionsStrategy.questions[0]?.expected_info}`;
        newStage = 'transition';
      }
      // CAMADA 3: OBJECTIVE FOCUS
      else {
        if (currentQuestionIndex < totalQuestions) {
          nextQuestion = questionsStrategy.questions[currentQuestionIndex];
          nextStepInstruction = `Faça a próxima pergunta (${currentQuestionIndex + 1}/${totalQuestions}): ${nextQuestion.expected_info}`;
        } else {
          nextStepInstruction = 'Perguntas estruturadas completas - continue conversa livre';
        }
        newStage = 'objective_focus';
      }

      // Construir systemPrompt
      const basePersonaPrompt = getPersonaPrompt(analysis.ai_gender || 'male');
      const currentTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const appropriateGreeting = getGreetingByTime();

      // Detectar contexto da mensagem
      const isFirstMessage = aiQuestionsCount === 0;
      const isReactivation = metadata.last_interaction_type === 'reactivation';

      // Instrução de saudação CONDICIONAL
      let greetingInstruction = '';
      if (isFirstMessage || isReactivation) {
        greetingInstruction = `
⚠️ SAUDAÇÃO CONTEXTUAL: "${appropriateGreeting}"
- Use esta saudação no INÍCIO da sua mensagem
- Exemplo: "${appropriateGreeting}, ${isReactivation ? 'tudo bem? estava pensando aqui' : 'vi que vocês atendem nessa região'}"
`;
      } else {
        greetingInstruction = `
⚠️ NÃO USE SAUDAÇÃO
- Esta NÃO é a primeira mensagem da conversa
- Continue naturalmente SEM "bom dia/boa tarde/boa noite"
- Exemplo: "certo, e vcs entregam aí?" ou "beleza, quanto fica?"
`;
      }

      const systemPrompt = `${basePersonaPrompt}

HORÁRIO ATUAL (Brasil): ${currentTime}

${greetingInstruction}

🚫 PROIBIÇÃO ABSOLUTA: NUNCA USE EMOJIS EM HIPÓTESE ALGUMA! 🚫

CONTEXTO DA ANÁLISE:
- Empresa: ${analysis.company_name}
- Segmento: ${analysis.business_segment || 'não especificado'}
- Cidade: ${analysis.city || 'não especificado'}
${analysis.investigation_goals ? `\nOBJETIVOS ESPECÍFICOS A DESCOBRIR:
${analysis.investigation_goals}\n` : ''}

ANÁLISE DO HISTÓRICO:
${conversationAnalysis.questionsAsked.length > 0 ? `- Já perguntado: ${conversationAnalysis.questionsAsked.slice(-5).join(' | ')}` : '- Nenhuma pergunta feita ainda'}
${conversationAnalysis.topicsDiscussed.length > 0 ? `- Tópicos discutidos: ${conversationAnalysis.topicsDiscussed.join(', ')}` : ''}
${conversationAnalysis.recentUserQuestions.length > 0 ? `- Últimas perguntas do vendedor: ${conversationAnalysis.recentUserQuestions.join(' | ')}` : ''}

🎯 REGRAS DE NATURALIDADE CONVERSACIONAL (CRÍTICO):

⚠️ PRIMEIRA MENSAGEM - Use "${appropriateGreeting}":
   ✅ CORRETO: "${appropriateGreeting}, vi que vocês atendem nessa região"
   ❌ ERRADO: "oi, vocês atendem?" (faltou saudação na primeira)

⚠️ MENSAGENS 2+ - NÃO use saudação:
   ✅ CORRETO: "certo, e vcs fazem entrega?"
   ✅ CORRETO: "legal, quanto fica o frete?"
   ❌ ERRADO: "boa noite, e vcs fazem entrega?" (saudação repetida)
   ❌ ERRADO: "bom dia, quanto fica?" (não é primeira mensagem)

⚠️ WARM-UP (mensagens 1-3) - Conversa casual ANTES do objetivo:
   - Faça perguntas genéricas sobre a empresa
   - Demonstre curiosidade sobre coisas não relacionadas ao objetivo
   - Exemplos: "há quanto tempo vocês estão aqui?", "que cheiro gostoso!", "vocês fazem delivery?"
   - AINDA NÃO pergunte sobre seu objetivo principal

⚠️ TRANSIÇÃO E OBJETIVO (mensagem 4+):
   - Faça transição natural: "ah, já que to aqui, queria saber..."
   - Só então pergunte sobre o objetivo principal
   - Intercale perguntas do objetivo com comentários casuais

🎭 NATURALIDADE BRASILEIRA:
   - Use linguagem coloquial: "vcs", "pra", "tá", "né", "uns", "umas"
   - Mensagens curtas (máximo 2-3 linhas)
   - Tom casual mas educado
   - ZERO emojis

🤝 RESPONDER PRIMEIRO, PERGUNTAR DEPOIS:
   - SE a última mensagem do vendedor tiver uma PERGUNTA (contém "?"), você DEVE responder objetivamente ANTES
   - Resposta deve ser CURTA (1-2 linhas)
   - Exemplos:
     Vendedor: "Quantos pães você quer?"
     ❌ ERRADO: "E vocês fazem entrega?"
     ✅ CORRETO: "uns 6 pães mesmo, vocês fazem entrega?"

🎲 REAJA NATURALMENTE:
   - Se vendedor mencionar algo interessante, comente
   - Não seja robótico seguindo roteiro
   - 15% das interações: pergunte algo aleatório não relacionado ao objetivo
   - Tom casual mas educado
   - ZERO emojis

4. PROGRESSÃO GRADUAL:
   - Não pareça ansioso ou apressado
   - Deixe a conversa fluir naturalmente
   - Contextualize suas perguntas baseado nas respostas anteriores

PRÓXIMO PASSO: ${nextStepInstruction}`;

      // Construir userPrompt
      const recentMessages = messages.slice(-6);
      const lastSellerMessage = messages.filter((m: any) => m.role === 'user').slice(-1)[0];
      const hasSellerQuestion = lastSellerMessage?.content?.includes('?');

      const userPrompt = `HISTÓRICO RECENTE DA CONVERSA:
${recentMessages.map((m: any) => `${m.role === 'user' ? 'VENDEDOR' : 'VOCÊ'}: ${m.content}`).join('\n')}

${hasSellerQuestion ? `
⚠️ ATENÇÃO: O vendedor fez uma PERGUNTA!
Última mensagem do vendedor: "${lastSellerMessage.content}"

VOCÊ DEVE:
1. Responder a pergunta de forma CURTA e DIRETA (1-2 linhas)
2. Depois, fazer UMA pergunta relacionada ao objetivo: ${nextQuestion?.expected_info || 'Continue a conversa'}

Exemplo de formato:
"[resposta curta à pergunta do vendedor], [sua pergunta]"
` : `
TAREFA: ${nextQuestion?.expected_info || 'Continue a conversa de forma natural'}

⚠️ REGRA CRÍTICA DE PERGUNTAS:
- Faça APENAS 1 pergunta por mensagem (máximo 2 se for extremamente necessário)
- Nunca faça 3 ou mais perguntas de uma vez
- Deixe o vendedor responder antes de fazer a próxima pergunta
`}

LEMBRE-SE:
- ZERO emojis
- Linguagem coloquial brasileira (vcs, pra, tá, né)
- Mensagens curtas (1-2 linhas no máximo)
- Apenas 1 pergunta por vez
- Tom casual mas educado`;

      // Chamar OpenAI GPT-4o
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.9,
          max_tokens: 150,
        }),
      });

      if (!aiResponse.ok) {
        console.error(`❌ [${analysis.id}] OpenAI falhou: ${aiResponse.status}`);
        throw new Error(`OpenAI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      let finalResponse = aiData.choices?.[0]?.message?.content?.trim() || 'oi, tudo bem?';

      // Pós-processamento: garantir que respondeu à pergunta do vendedor
      if (hasSellerQuestion) {
        const sellerQuestion = lastSellerMessage.content.toLowerCase();
        const responseHasDirectAnswer = (
          (sellerQuestion.includes('quanto') && /\d/.test(finalResponse)) ||
          (sellerQuestion.includes('quando') && /(amanhã|hoje|semana|dia|hora)/i.test(finalResponse)) ||
          (sellerQuestion.includes('qual') && finalResponse.split('\n')[0].length < 50) ||
          finalResponse.toLowerCase().includes('sim') ||
          finalResponse.toLowerCase().includes('não')
        );

        if (!responseHasDirectAnswer) {
          console.log(`🔧 [${analysis.id}] Injetando resposta direta à pergunta do vendedor`);
          // Injetar resposta plausível
          const directAnswers: Record<string, string> = {
            'quanto': 'uns 6 mesmo',
            'quando': 'pra amanhã de manhã',
            'onde': 'aqui no centro',
            'qual': 'o básico mesmo'
          };

          for (const [key, answer] of Object.entries(directAnswers)) {
            if (sellerQuestion.includes(key)) {
              finalResponse = `${answer}, ${finalResponse}`;
              break;
            }
          }
        }
      }

      // Validar/corrigir saudação
      let validatedResponse = finalResponse;
      const greetingPattern = /^(bom dia|boa tarde|boa noite)[,\s]*/i;

      if (isFirstMessage || isReactivation) {
        // Se for primeira mensagem, GARANTIR que tem a saudação correta
        const matchedGreeting = finalResponse.match(greetingPattern);
        if (matchedGreeting && matchedGreeting[0].toLowerCase().trim().replace(/[,\s]/g, '') !== appropriateGreeting.toLowerCase()) {
          console.log(`⚠️ [${analysis.id}] Corrigindo saudação incorreta: "${matchedGreeting[0]}" → "${appropriateGreeting}"`);
          validatedResponse = finalResponse.replace(greetingPattern, appropriateGreeting + ', ');
        } else if (!matchedGreeting) {
          console.log(`⚠️ [${analysis.id}] Adicionando saudação faltante na primeira mensagem`);
          validatedResponse = `${appropriateGreeting}, ${finalResponse}`;
        }
      } else {
        // Se NÃO for primeira mensagem, REMOVER qualquer saudação
        if (greetingPattern.test(finalResponse)) {
          console.log(`⚠️ [${analysis.id}] Removendo saudação desnecessária da mensagem #${aiQuestionsCount + 1}`);
          validatedResponse = finalResponse.replace(greetingPattern, '').trim();
          // Garantir que a primeira letra fique maiúscula após remover saudação
          validatedResponse = validatedResponse.charAt(0).toUpperCase() + validatedResponse.slice(1);
        }
      }

      console.log(`🤖 [${analysis.id}] Resposta final: ${validatedResponse.substring(0, 100)}...`);

      // ✂️ QUEBRAR RESPOSTA EM CHUNKS (máximo 2 linhas)
      const messageChunks = splitMessageIntoChunks(validatedResponse);
      console.log(`📨 [${analysis.id}] Quebrando resposta em ${messageChunks.length} mensagens...`);

      // Enviar cada chunk como mensagem separada com delay
      for (let i = 0; i < messageChunks.length; i++) {
        const chunk = messageChunks[i];
        
        // Enviar via Evolution
        await sendText(actualEvolutionUrl, actualEvolutionKey, actualEvolutionInstance, analysis.target_phone, chunk);
        
        // Salvar no banco
        await supabase.from('conversation_messages').insert({
          analysis_id: analysis.id,
          role: 'ai',
          content: chunk,
          metadata: {
            question_order: nextQuestion?.order || currentQuestionIndex + 1,
            expected_info: nextQuestion?.expected_info || 'conversa livre',
            answered_seller_question: hasSellerQuestion || false,
            conversation_stage: newStage,
            chunk_index: i,
            total_chunks: messageChunks.length,
            is_chunked: messageChunks.length > 1
          }
        });
        
        // Delay entre chunks (1-3s) exceto no último
        if (i < messageChunks.length - 1) {
          const chunkDelayMs = Math.floor(Math.random() * 2000) + 1000; // 1-3s
          console.log(`⏱️ Aguardando ${(chunkDelayMs/1000).toFixed(1)}s antes do próximo chunk...`);
          await new Promise(resolve => setTimeout(resolve, chunkDelayMs));
        }
      }

      // Marcar mensagens como processadas
      for (const msg of claimedMessages) {
        await supabase
          .from('conversation_messages')
          .update({ metadata: { ...msg.metadata, processed: true } })
          .eq('id', msg.id);
      }

      // ============= GERENCIAR/ADAPTAR PLANO DE CONVERSA =============
      let conversationPlan = metadata.conversation_plan as ConversationPlan | null;
      
      // Se não tem plano, criar um
      if (!conversationPlan && analysis.status === 'chatting') {
        console.log(`📋 [${analysis.id}] Criando plano inicial de conversa...`);
        conversationPlan = await generateConversationPlan(analysis, openAIKey);
        
        // Salvar plano no metadata
        await supabase
          .from('analysis_requests')
          .update({
            metadata: {
              ...metadata,
              conversation_plan: conversationPlan
            }
          })
          .eq('id', analysis.id);
      }
      
      // Atualizar mensagens enviadas no plano
      if (conversationPlan) {
        conversationPlan.messages_sent = aiQuestionsCount;
      }

      // NOVO: Atualizar conversation stage e analisar objetivos
      const updatedCasualInteractions = newStage === 'warm_up' ? casualInteractions + 1 : casualInteractions;
      const updatedObjectiveQuestions = newStage === 'objective_focus' ? objectiveQuestionsAsked + 1 : objectiveQuestionsAsked;
      
      // Determinar tipo de interação para próxima mensagem
      const currentInteractionType = isReactivation ? 'reactivation' : 'normal';

      // ✅ CORREÇÃO 3: Analisar objetivos ANTES de gerar resposta
      let progressData = metadata.progress || { total_objectives: 0, achieved_objectives: 0, percentage: 0 };
      
      if (analysis.investigation_goals && updatedObjectiveQuestions > 0) {
        try {
          const allMessages = await supabase
            .from('conversation_messages')
            .select('*')
            .eq('analysis_id', analysis.id)
            .order('created_at', { ascending: true });

          if (allMessages.data) {
            progressData = await analyzeObjectivesProgress(
              analysis.investigation_goals,
              allMessages.data,
              openAIKey
            );
            
            // 🎉 SE OBJETIVOS 100% CONCLUÍDOS, DESPEDIR E ENCERRAR **IMEDIATAMENTE**
            if (progressData.percentage === 100) {
              console.log(`🎉 [${analysis.id}] OBJETIVOS 100% CONCLUÍDOS! Encerrando conversa...`);
              
              // Marcar mensagens como processadas
              for (const msg of claimedMessages) {
                await supabase
                  .from('conversation_messages')
                  .update({ metadata: { ...msg.metadata, processed: true } })
                  .eq('id', msg.id);
              }
              
              // Mensagens de despedida naturais
              const farewellMessages = [
                'beleza, muito obrigado pela atenção! até mais',
                'perfeito, valeu mesmo! até logo',
                'legal, agradeço demais! até mais'
              ];
              
              const farewellMsg = farewellMessages[Math.floor(Math.random() * farewellMessages.length)];
              await sendText(actualEvolutionUrl, actualEvolutionKey, actualEvolutionInstance, analysis.target_phone, farewellMsg);
              
              await supabase.from('conversation_messages').insert({
                analysis_id: analysis.id,
                role: 'ai',
                content: farewellMsg,
                metadata: { 
                  processed: true, 
                  is_farewell: true, 
                  objectives_completed: true 
                }
              });
              
              // Encerrar análise
              await supabase
                .from('analysis_requests')
                .update({ 
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  metadata: {
                    ...metadata,
                    progress: progressData,
                    completion_reason: 'objectives_achieved'
                  }
                })
                .eq('id', analysis.id);
              
              // ✅ CORREÇÃO 2: Disparar análise de vendas automaticamente
              try {
                console.log(`🔍 [${analysis.id}] Iniciando análise de vendas...`);
                
                const { error: salesAnalysisError } = await supabase.functions.invoke(
                  'analyze-sales-conversation',
                  { body: { analysis_id: analysis.id } }
                );

                if (salesAnalysisError) {
                  console.error(`❌ [${analysis.id}] Erro ao gerar análise de vendas:`, salesAnalysisError);
                } else {
                  console.log(`✅ [${analysis.id}] Análise de vendas gerada automaticamente`);
                }
              } catch (error) {
                console.error(`❌ [${analysis.id}] Falha ao invocar análise de vendas:`, error);
              }
              
              console.log(`✅ [${analysis.id}] Análise encerrada - objetivos alcançados!`);
              return { analysis_id: analysis.id, action: 'completed_objectives', percentage: 100 };
            }
          }
        } catch (err) {
          console.error(`⚠️ Erro ao analisar objetivos:`, err);
        }
      }

      // ============= TENTAR ADAPTAR PLANO SE NECESSÁRIO =============
      if (conversationPlan && progressData) {
        const adaptedPlan = await adaptConversationPlan(
          conversationPlan,
          messages,
          progressData,
          openAIKey,
          analysis.id
        );
        
        if (adaptedPlan) {
          conversationPlan = adaptedPlan;
        }
      }

      // Calcular próximo follow-up
      const nextFollowUpTime = calculateNextFollowUpTime(analysis, 0);
      
      // NOVO: Resetar follow_ups se usuário respondeu
      const updatedMetadata = {
        ...metadata,
        conversation_stage: newStage,
        casual_interactions: updatedCasualInteractions,
        objective_questions_asked: updatedObjectiveQuestions,
        total_interactions: totalInteractions + 1,
        last_interaction_type: currentInteractionType,
        progress: progressData,
        conversation_plan: conversationPlan,
        // Resetar follow-ups quando usuário responde
        follow_ups_sent: 0,
        next_follow_up_at: nextFollowUpTime,
        last_follow_up_at: null
      };

      // Atualizar análise
      await supabase
        .from('analysis_requests')
        .update({ 
          last_message_at: new Date().toISOString(),
          metadata: updatedMetadata
        })
        .eq('id', analysis.id);

      console.log(`✅ [${analysis.id}] Stage: ${newStage}, Casual: ${updatedCasualInteractions}, Objectives: ${progressData.percentage}%`);

      return { analysis_id: analysis.id, action: 'responded', grouped: claimedMessages.length };
    }

    // CENÁRIO B: Sistema de Follow-up (3 tentativas progressivas)
    if (lastMessage.role === 'ai') {
      const metadata = analysis.metadata || {};
      const followUpsSent = metadata.follow_ups_sent || 0;
      const depth = analysis.analysis_depth || 'quick';
      const config = DEPTH_CONFIG[depth as keyof typeof DEPTH_CONFIG] || DEPTH_CONFIG.quick;
      const maxFollowUps = config.maxFollowUps || 3;
      const nextFollowUpAt = metadata.next_follow_up_at;

      // Se ainda há tentativas e chegou o horário
      if (followUpsSent < maxFollowUps) {
        // Se não tem próximo follow-up agendado, agendar o primeiro
        if (!nextFollowUpAt) {
          const nextTime = calculateNextFollowUpTime(analysis, followUpsSent);
          
          await supabase
            .from('analysis_requests')
            .update({
              metadata: {
                ...metadata,
                follow_ups_sent: followUpsSent,
                max_follow_ups: maxFollowUps,
                next_follow_up_at: nextTime
              }
            })
            .eq('id', analysis.id);

          console.log(`⏰ [${analysis.id}] Follow-up ${followUpsSent + 1}/${maxFollowUps} agendado para: ${nextTime}`);
        }
        // Se chegou o horário do follow-up
        else if (new Date() >= new Date(nextFollowUpAt)) {
          console.log(`🔔 [${analysis.id}] Enviando follow-up ${followUpsSent + 1}/${maxFollowUps}`);

          const followUpVariations = [
            'oi, conseguiu dar uma olhada?',
            'opa, tudo bem? consegue me ajudar?',
            'e aí, viu minha mensagem?',
            'oi de novo, ainda pode me passar essa info?'
          ];

          const followUpMessage = followUpVariations[Math.floor(Math.random() * followUpVariations.length)];

          await sendText(actualEvolutionUrl, actualEvolutionKey, actualEvolutionInstance, analysis.target_phone, followUpMessage);

          await supabase.from('conversation_messages').insert({
            analysis_id: analysis.id,
            role: 'ai',
            content: followUpMessage,
            metadata: { 
              processed: true, 
              is_follow_up: true, 
              follow_up_number: followUpsSent + 1,
              max_follow_ups: maxFollowUps
            }
          });

          const newFollowUpsSent = followUpsSent + 1;
          const nextTime = calculateNextFollowUpTime(analysis, newFollowUpsSent);
          
          // Se foi o último follow-up, marcar como completed
          const newStatus = newFollowUpsSent >= maxFollowUps ? 'completed' : 'pending_follow_up';

          await supabase
            .from('analysis_requests')
            .update({
              status: newStatus,
              last_message_at: new Date().toISOString(),
              completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
              metadata: {
                ...metadata,
                follow_ups_sent: newFollowUpsSent,
                last_follow_up_at: new Date().toISOString(),
                next_follow_up_at: nextTime
              }
            })
            .eq('id', analysis.id);

          // ✅ CORREÇÃO 2: Análise automática ao completar follow-ups
          if (newStatus === 'completed') {
            try {
              console.log(`🔍 [${analysis.id}] Iniciando análise de vendas (follow-ups completos)...`);
              
              const { error: salesAnalysisError } = await supabase.functions.invoke(
                'analyze-sales-conversation',
                { body: { analysis_id: analysis.id } }
              );

              if (salesAnalysisError) {
                console.error(`❌ [${analysis.id}] Erro ao gerar análise de vendas:`, salesAnalysisError);
              } else {
                console.log(`✅ [${analysis.id}] Análise de vendas gerada automaticamente`);
              }
            } catch (error) {
              console.error(`❌ [${analysis.id}] Falha ao invocar análise de vendas:`, error);
            }
          }

          console.log(`✅ [${analysis.id}] Follow-up ${newFollowUpsSent}/${maxFollowUps} enviado (status: ${newStatus})`);
          return { analysis_id: analysis.id, action: 'follow_up_sent', follow_up_number: newFollowUpsSent };
        }
      }
    }

    // CENÁRIO C: Reativações (4h e 24h para análises deep)
    const hoursSinceLastMessage = timeSinceLastMessage / (60 * 60 * 1000);
    const metadata = analysis.metadata || {};
    const reactivationsSent = metadata.reactivations_sent || 0;

    // Primeira reativação: 4 horas
    if (hoursSinceLastMessage >= 4 && reactivationsSent === 0 && analysis.analysis_depth === 'deep' && lastMessage.role === 'ai') {
      console.log(`🔄 [${analysis.id}] Primeira reativação (4h sem resposta)`);

      const greeting = getGreetingByTime();
      const firstReactivationMessages = [
        `${greeting}, tudo bem? ainda pode me ajudar?`,
        `oi, ${greeting}, conseguiu ver minha mensagem?`,
        `${greeting}, ainda tá disponível pra conversar?`
      ];

      const reactivationMsg = firstReactivationMessages[Math.floor(Math.random() * firstReactivationMessages.length)];

      await sendText(actualEvolutionUrl, actualEvolutionKey, actualEvolutionInstance, analysis.target_phone, reactivationMsg);

      await supabase.from('conversation_messages').insert({
        analysis_id: analysis.id,
        role: 'ai',
        content: reactivationMsg,
        metadata: { type: 'reactivation_4h' }
      });

      await supabase
        .from('analysis_requests')
        .update({
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, reactivations_sent: 1, last_reactivation_at: new Date().toISOString() }
        })
        .eq('id', analysis.id);

      console.log(`✅ [${analysis.id}] Primeira reativação enviada (4h)`);
      return { analysis_id: analysis.id, action: 'reactivation_4h' };
    }

    // Segunda reativação: 24 horas
    if (hoursSinceLastMessage >= 24 && reactivationsSent === 1 && analysis.analysis_depth === 'deep' && lastMessage.role === 'ai') {
      console.log(`🔄 [${analysis.id}] Segunda reativação (24h sem resposta)`);

      const greeting = getGreetingByTime();
      const secondReactivationMessages = [
        `${greeting}, vi que não conseguimos conversar ainda, tudo bem por aí?`,
        `oi, ${greeting}, consegue me passar as infos quando der?`,
        `${greeting}, ainda tem interesse em atender?`
      ];

      const reactivationMsg = secondReactivationMessages[Math.floor(Math.random() * secondReactivationMessages.length)];

      await sendText(actualEvolutionUrl, actualEvolutionKey, actualEvolutionInstance, analysis.target_phone, reactivationMsg);

      await supabase.from('conversation_messages').insert({
        analysis_id: analysis.id,
        role: 'ai',
        content: reactivationMsg,
        metadata: { type: 'reactivation_24h' }
      });

      await supabase
        .from('analysis_requests')
        .update({
          status: 'completed',
          last_message_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          metadata: { ...metadata, reactivations_sent: 2, last_reactivation_at: new Date().toISOString() }
        })
        .eq('id', analysis.id);

      // ✅ CORREÇÃO 2: Análise automática após última reativação
      try {
        console.log(`🔍 [${analysis.id}] Iniciando análise de vendas (reativações completas)...`);
        
        const { error: salesAnalysisError } = await supabase.functions.invoke(
          'analyze-sales-conversation',
          { body: { analysis_id: analysis.id } }
        );

        if (salesAnalysisError) {
          console.error(`❌ [${analysis.id}] Erro ao gerar análise de vendas:`, salesAnalysisError);
        } else {
          console.log(`✅ [${analysis.id}] Análise de vendas gerada automaticamente`);
        }
      } catch (error) {
        console.error(`❌ [${analysis.id}] Falha ao invocar análise de vendas:`, error);
      }

      console.log(`✅ [${analysis.id}] Segunda reativação enviada (24h) - conversa encerrada`);
      return { analysis_id: analysis.id, action: 'reactivation_24h' };
    }

    // CENÁRIO D: TIMEOUT - Análise ultrapassou tempo máximo
    const analysisStartTime = new Date(analysis.started_at || analysis.created_at).getTime();
    const timeoutMillis = analysis.timeout_minutes * 60 * 1000;
    const expectedEndTime = analysisStartTime + timeoutMillis;
    const currentTime = new Date().getTime();
    const isTimeout = currentTime > expectedEndTime;
    
    if (isTimeout && analysis.status !== 'completed') {
      console.log(`⏰ [${analysis.id}] Timeout atingido (${analysis.timeout_minutes} min)`);
      
      const metadata = analysis.metadata || {};
      const followUpsSent = metadata.follow_ups_sent || 0;
      const maxFollowUps = metadata.max_follow_ups || 3;
      
      // Se ainda há follow-ups pendentes, não completar
      if (followUpsSent < maxFollowUps && lastMessage.role === 'ai') {
        console.log(`⏳ [${analysis.id}] Timeout mas ${maxFollowUps - followUpsSent} follow-ups pendentes`);
        
        await supabase
          .from('analysis_requests')
          .update({ 
            status: 'pending_follow_up',
            metadata: {
              ...metadata,
              timeout_reached: true,
              timeout_at: new Date().toISOString()
            }
          })
          .eq('id', analysis.id);
        
        console.log(`✅ [${analysis.id}] Status: pending_follow_up`);
        return { analysis_id: analysis.id, action: 'timeout_pending_followup' };
      } else {
        // Só completar se follow-ups acabaram ou último foi do usuário
        await supabase
          .from('analysis_requests')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', analysis.id);
        
        console.log(`✅ [${analysis.id}] Análise marcada como completed por timeout`);
        return { analysis_id: analysis.id, action: 'timeout_completed' };
      }
    }

    return { analysis_id: analysis.id, action: 'no_action_needed' };

  } catch (error) {
    console.error(`❌ [${analysis.id}] Erro:`, error);
    throw error;
  }
}

// Helper para enviar texto
async function sendText(url: string, key: string, instance: string, phone: string, text: string) {
  const response = await fetch(`${url}/message/sendText/${instance}`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ number: phone, text }),
  });

  if (!response.ok) {
    throw new Error(`Evolution API error: ${await response.text()}`);
  }

  console.log(`✅ Mensagem enviada: ${text.substring(0, 50)}...`);
}
