import "https://deno.land/x/xhr@0.1.0/mod.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPersonaPrompt } from "../_shared/prompts/personas.ts";

// Função auxiliar para saudação contextual
function getGreetingByTime(): string {
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hour = brazilTime.getHours();
  
  if (hour >= 5 && hour < 12) return "bom dia";
  if (hour >= 12 && hour < 18) return "boa tarde";
  return "boa noite";
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

    // Se tem analysis_id específico, buscar apenas ele
    let query = supabase
      .from('analysis_requests')
      .select('*')
      .eq('status', 'chatting');

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

// ============= FUNÇÃO AUXILIAR: SELECIONAR EVOLUTION CREDENTIALS =============
function getEvolutionCredentials(aiGender: string) {
  if (aiGender === 'female') {
    return {
      url: Deno.env.get('EVOLUTION_API_URL_FEMALE'),
      key: Deno.env.get('EVOLUTION_API_KEY_FEMALE'),
      instance: Deno.env.get('EVOLUTION_INSTANCE_NAME_FEMALE')
    };
  }
  
  return {
    url: Deno.env.get('EVOLUTION_API_URL'),
    key: Deno.env.get('EVOLUTION_API_KEY'),
    instance: Deno.env.get('EVOLUTION_INSTANCE_NAME')
  };
}

// ============= FUNÇÕES DE ANÁLISE DE HISTÓRICO =============
function analyzeConversationHistory(messages: any[]): {
  questionsAsked: string[];
  topicsDiscussed: string[];
  reactionsUsed: string[];
  lastUserQuestions: string[];
} {
  const questionsAsked: string[] = [];
  const topicsDiscussed: string[] = [];
  const reactionsUsed: string[] = [];
  const lastUserQuestions: string[] = [];

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
    }
  }

  // 4. ÚLTIMAS 3 PERGUNTAS DO CLIENTE (para não re-perguntar imediatamente)
  const recentAiMessages = messages
    .filter((m: any) => m.role === 'ai')
    .slice(-3);
  
  for (const msg of recentAiMessages) {
    const content = msg.content.toLowerCase();
    const questions = content.split(/[.!]+/).filter((s: string) => s.includes('?'));
    lastUserQuestions.push(...questions);
  }

  return {
    questionsAsked,
    topicsDiscussed,
    reactionsUsed,
    lastUserQuestions
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

async function processConversation(
  analysis: any,
  supabase: any,
  openAIKey: string,
  evolutionUrl: string,
  evolutionKey: string,
  evolutionInstance: string,
  evolutionUrlFemale: string,
  evolutionKeyFemale: string,
  evolutionInstanceFemale: string
) {
  // NOVO: Selecionar credenciais baseadas no ai_gender
  const evoCredentials = getEvolutionCredentials(analysis.ai_gender || 'male');
  const actualEvolutionUrl = evoCredentials.url!;
  const actualEvolutionKey = evoCredentials.key!;
  const actualEvolutionInstance = evoCredentials.instance!;
  
  console.log(`🔧 [${analysis.id}] Usando Evolution ${analysis.ai_gender === 'female' ? 'FEMININA (clienteoculto-mulher)' : 'MASCULINA (felipedisparo)'}`);

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
    const unprocessedMessages = messages.filter((m: any) => 
      m.role === 'user' && m.metadata?.processed === false
    );

      if (unprocessedMessages.length > 0) {
        // Atomic claim to avoid duplicate processing in parallel runs
        const runId = crypto.randomUUID();
        const claimedMessages: any[] = [];
        for (const msg of unprocessedMessages) {
          const newMeta = { ...(msg.metadata || {}), claimed_by: runId, claimed_at: new Date().toISOString() };
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

        console.log(`📦 [${analysis.id}] Reivindicadas ${claimedMessages.length} mensagens para processamento (runId=${runId})`);

        // Agrupar conteúdo apenas das mensagens reivindicadas
        const groupedContent = claimedMessages
          .map((m: any) => m.content)
          .join('\n');


      // Montar histórico completo
      const conversationHistory = messages
        .map((m: any) => `${m.role === 'ai' ? 'Cliente Oculto' : 'Empresa'}: ${m.content}`)
        .join('\n');

      // SISTEMA SSR++ V3.0 - Análise e Geração de Resposta Ultra Natural
      
      // Contar perguntas já feitas pelo AI (excluindo nudges)
      const aiQuestionsCount = messages.filter((m: any) => 
        m.role === 'ai' && !m.metadata?.is_nudge
      ).length;
      
      const currentQuestionIndex = aiQuestionsCount;
      const questionsStrategy = analysis.questions_strategy;
      const totalQuestions = questionsStrategy?.questions?.length || 0;

      // NOVO: Permitir conversa livre após perguntas estruturadas
      if (currentQuestionIndex >= totalQuestions) {
        console.log(`✅ [${analysis.id}] Perguntas estruturadas completas - modo conversa livre`);
        // Não finaliza mais - continua em modo conversa livre
      }

      // Determinar próxima resposta
      let adaptedQuestion: string;
      let isFreestyle = false;
      let nextQuestion: any = null;

      if (currentQuestionIndex < totalQuestions) {
        nextQuestion = questionsStrategy.questions[currentQuestionIndex];
        adaptedQuestion = nextQuestion.question;
      } else {
        // Modo conversa livre - gerar resposta contextual
        isFreestyle = true;
        adaptedQuestion = "Continuando conversa...";
      }
      
      // Contar emojis já usados
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
      let emojiCount = 0;
      for (const msg of messages) {
        if (msg.role === 'ai') {
          const matches = msg.content.match(emojiRegex);
          emojiCount += matches ? matches.length : 0;
        }
      }

      // Verificar se deve encerrar (>= 10 perguntas)
      const shouldFinish = aiQuestionsCount >= 10;

      console.log(`📊 [${analysis.id}] Perguntas: ${aiQuestionsCount}/10, Emojis: ${emojiCount}/3, Finalizar: ${shouldFinish}`);

      // ============= ANALISAR HISTÓRICO ANTES DE RESPONDER =============
      const historyAnalysis = analyzeConversationHistory(messages);
      const availableReactions = suggestVariedReaction(historyAnalysis.reactionsUsed);

      console.log(`📋 [${analysis.id}] Histórico: ${historyAnalysis.questionsAsked.length} perguntas, ${historyAnalysis.topicsDiscussed.length} tópicos`);

      try {
        const basePersonaPrompt = getPersonaPrompt(analysis.ai_gender || 'male');
        const currentGreeting = getGreetingByTime();
        const currentTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const systemPrompt = `${basePersonaPrompt}

⏰ INFORMAÇÕES DE HORÁRIO (Use apenas na PRIMEIRA mensagem):
- Horário atual: ${currentTime}
- Saudação apropriada: "${currentGreeting}"
- REGRA: Use APENAS a saudação apropriada ao horário na primeira mensagem

CONTEXTO DA CONVERSA:
- Cidade: ${analysis.city}
- Empresa: ${analysis.company_name || 'empresa'}

🔍 ANÁLISE DO HISTÓRICO (NÃO REPETIR):
TÓPICOS DISCUTIDOS: ${historyAnalysis.topicsDiscussed.join(', ') || 'Nenhum'}
PERGUNTAS FEITAS: ${historyAnalysis.questionsAsked.slice(-5).join(' | ') || 'Nenhuma'}
REAÇÕES USADAS: ${historyAnalysis.reactionsUsed.slice(-8).join(', ') || 'Nenhuma'}
REAÇÕES DISPONÍVEIS: ${availableReactions.slice(0, 8).join(', ')}

⚠️ REGRAS ANTI-REPETIÇÃO CRÍTICAS:
❌ NÃO repetir perguntas ou tópicos já discutidos
❌ NÃO usar reações já usadas
✅ Usar APENAS reações disponíveis
✅ Avançar para novos tópicos
⛔ PROIBIÇÃO ABSOLUTA: NUNCA USE EMOJIS EM HIPÓTESE ALGUMA

LEMBRE-SE: Comece com "${currentGreeting}" se for a primeira mensagem. NUNCA use emojis.

PERSONALIDADE:
- Empático (8/10) - educado, simpático
- Cauteloso (6/10) - primeira vez, quer ter certeza
- Curioso (7/10) - faz perguntas, demonstra interesse

COMPORTAMENTO CRÍTICO:

1. LINGUAGEM COLOQUIAL BRASILEIRA (usar ocasionalmente):
   - "vcs" ao invés de "vocês"
   - "pra" ao invés de "para"
   - "tá" ao invés de "está"
   - "né" no final
   - "to" ao invés de "estou"

2. FORMATO DE MENSAGEM:
   - NUNCA incluir \\n no texto
   - Cada mensagem é UMA string limpa
   - Máximo 2 linhas curtas
   - Seja direto e objetivo

3. VARIAÇÃO TOTAL - NUNCA REPETIR:
   ❌ PROIBIDO: "Ah, legal, [repetir]"
   ❌ PROIBIDO: "Hmmm, [pergunta]"
   ❌ PROIBIDO: "Massa, [reação]"
   
   ✅ VARIAR COMPLETAMENTE:
   - "entendi"
   - "beleza"
   - "ok"
   - "certo"
   - "bom saber"
   - Ou fazer pergunta direta sem reação

4. UMA PERGUNTA POR VEZ:
   - Fazer apenas UMA pergunta curta
   - Aguardar resposta antes da próxima

5. EMOJIS:
   Emojis usados: ${emojiCount}/3 ${emojiCount >= 3 ? '- NÃO USE MAIS EMOJIS' : '- Máximo 1 emoji se apropriado'}

6. MENSAGENS CURTAS:
   Exemplos CORRETOS:
   - "quanto custa?"
   - "e o prazo?"
   - "tem garantia?"
   - "entendi, valeu"
   - "beleza, vou pensar"

REGRAS DE OURO:
✅ Mensagens curtas e diretas
✅ NUNCA repetir "ah massa" ou "hmmm"
✅ NUNCA usar \\n no texto
✅ Variar completamente cada resposta
✅ Parecer 100% humano brasileiro

❌ NUNCA mencionar que é IA
❌ NUNCA repetir padrões
❌ NUNCA mensagens longas`;

        let userPrompt = '';
        
        if (shouldFinish) {
          // Forçar finalização
          userPrompt = `ENCERRAR CONVERSA AGORA

Você já fez ${aiQuestionsCount} perguntas e coletou informações suficientes.

Última mensagem do vendedor:
${groupedContent}

INSTRUÇÕES:
Agradeça e finalize educadamente usando UMA destas opções:

Opção 1: "entendi tudo, vou pensar aqui, obrigado!"
Opção 2: "beleza, me ajudou bastante, valeu!"
Opção 3: "legal, vou avaliar e depois retorno, obrigado!"
Opção 4: "certo, preciso pensar melhor, valeu pela atenção!"

Escolha uma opção e envie EXATAMENTE como está (sem modificar).`;
        } else if (isFreestyle) {
          // Modo conversa livre
          userPrompt = `CONVERSA LIVRE - ${aiQuestionsCount} perguntas feitas

Histórico recente:
${messages.slice(-6).map((m: any) => `${m.role === 'ai' ? 'Você' : 'Vendedor'}: ${m.content}`).join('\n')}

Última mensagem do vendedor:
${groupedContent}

INSTRUÇÕES:
1. Reagir de forma VARIADA (não repetir "ah massa" ou "hmmm")
2. Fazer UMA pergunta curta e direta
3. SEM \\n no texto
4. Máximo 2 linhas

Exemplo: "e quanto tempo leva?"`;
        } else {
          // Modo perguntas estruturadas
          userPrompt = `PERGUNTA ${currentQuestionIndex + 1}/${totalQuestions} - ${aiQuestionsCount} feitas

Histórico recente:
${messages.slice(-4).map((m: any) => `${m.role === 'ai' ? 'Você' : 'Vendedor'}: ${m.content}`).join('\n')}

Última mensagem:
${groupedContent}

Próxima pergunta:
"${nextQuestion.question}"

INSTRUÇÕES:
1. Reaja de forma VARIADA (não repetir palavras)
2. Faça a pergunta de forma natural
3. SEM \\n no texto
4. Máximo 2 linhas curtas

Exemplo: "entendi, e ${nextQuestion.question}"`;
        }

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.9,
            max_tokens: 100,
          }),
        });

        if (!aiResponse.ok) {
          const status = aiResponse.status;
          console.error(`❌ [${analysis.id}] OpenAI falhou: ${status}`);
          
          if (status === 429) {
            console.error('Rate limit - usando resposta padrão');
          } else if (status === 401) {
            console.error('Unauthorized - verifique OPENAI_API_KEY');
          }
          // Fallback
          if (!isFreestyle && nextQuestion) {
            adaptedQuestion = nextQuestion.question;
          }
        } else {
          const aiData = await aiResponse.json();
          let proposedResponse = aiData.choices?.[0]?.message?.content?.trim() || adaptedQuestion;
          
          // ============= VALIDAÇÃO ANTI-REPETIÇÃO =============
          const isRepetitive = isQuestionSimilar(proposedResponse, historyAnalysis.questionsAsked);
          
          if (isRepetitive) {
            console.warn(`⚠️ [${analysis.id}] Pergunta repetitiva detectada!`);
            proposedResponse = nextQuestion?.question || adaptedQuestion;
          }
          
          // Substituir reações repetidas
          for (const usedReaction of historyAnalysis.reactionsUsed) {
            if (proposedResponse.toLowerCase().includes(usedReaction)) {
              const newReaction = availableReactions[0] || 'entendi';
              proposedResponse = proposedResponse.replace(new RegExp(usedReaction, 'gi'), newReaction);
            }
          }
          
          adaptedQuestion = proposedResponse;
          console.log(`🤖 [${analysis.id}] OpenAI respondeu: ${adaptedQuestion}`);
        }
      } catch (error) {
        console.error(`❌ [${analysis.id}] Erro na OpenAI:`, error);
        if (!isFreestyle && nextQuestion) {
          adaptedQuestion = nextQuestion.question;
        }
      }

      // Limpar mensagem mantendo quebras de linha naturais
      const cleanMessage = adaptedQuestion
        .replace(/^Cliente Oculto:\s*/i, '')
        .replace(/^Você:\s*/i, '')
        .replace(/\n{3,}/g, '\n\n')  // Máximo 2 quebras seguidas
        .trim();

      console.log(`📤 [${analysis.id}] Preparando para enviar mensagem`);

      // 1. ENVIAR PRESENCE "COMPOSING" (digitando...)
      await fetch(`${actualEvolutionUrl}/chat/sendPresence/${actualEvolutionInstance}`, {
        method: 'POST',
        headers: {
          'apikey': actualEvolutionKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: analysis.target_phone,
          state: 'composing'
        })
      });

      console.log(`⌨️ [${analysis.id}] Mostrando "digitando..."`);

      // 2. DELAY REALISTA COM HEARTBEATS DE "DIGITANDO..." - FASE 4 ATUALIZADO
      // Import da configuração (simulado inline)
      const calculateRealisticDelay = (messageLength: number, analysisDepth: string): number => {
        const DEPTH_CONFIG = {
          quick: { minDelay: 30, maxDelay: 120 },
          intermediate: { minDelay: 60, maxDelay: 240 },
          deep: { minDelay: 60, maxDelay: 360 }
        };
        const config = DEPTH_CONFIG[analysisDepth as keyof typeof DEPTH_CONFIG] || DEPTH_CONFIG.quick;
        let min = config.minDelay;
        let max = config.maxDelay;
        if (messageLength <= 50) max = Math.floor((min + max) / 2);
        else if (messageLength > 150) min = Math.floor((min + max) / 2);
        return (Math.floor(Math.random() * (max - min + 1) + min)) * 1000;
      };
      
      const totalDelay = calculateRealisticDelay(cleanMessage.length, analysis.analysis_depth);

      console.log(`⏱️ [${analysis.id}] Aguardando ${Math.round(totalDelay/1000)}s...`);
      const delayPromise = new Promise((resolve) => setTimeout(resolve, totalDelay));
      const heartbeatPromise = (async () => {
        const interval = 2500;
        let elapsed = 0;
        while (elapsed + interval < totalDelay) {
          await new Promise((r) => setTimeout(r, interval));
          elapsed += interval;
          await fetch(`${actualEvolutionUrl}/chat/sendPresence/${actualEvolutionInstance}`, {
            method: 'POST',
            headers: { 'apikey': actualEvolutionKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: analysis.target_phone, state: 'composing' })
          });
        }
      })();
      await Promise.all([delayPromise, heartbeatPromise]);

      // 3. ENVIAR UMA MENSAGEM COMPLETA
      const evolutionPayload = {
        number: analysis.target_phone,
        text: cleanMessage
      };

      const evolutionResponse = await fetch(
        `${actualEvolutionUrl}/message/sendText/${actualEvolutionInstance}`,
        {
          method: 'POST',
          headers: {
            'apikey': actualEvolutionKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(evolutionPayload),
        }
      );

      if (!evolutionResponse.ok) {
        throw new Error(`Evolution API error: ${await evolutionResponse.text()}`);
      }

      console.log(`✅ [${analysis.id}] Mensagem enviada com sucesso`);

      // 4. PARAR "DIGITANDO..."
      await fetch(`${actualEvolutionUrl}/chat/sendPresence/${actualEvolutionInstance}`, {
        method: 'POST',
        headers: {
          'apikey': actualEvolutionKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: analysis.target_phone,
          state: 'available'
        })
      });

      // Salvar mensagem da IA (mensagem completa)
      await supabase.from('conversation_messages').insert({
        analysis_id: analysis.id,
        role: 'ai',
        content: cleanMessage,
        metadata: { 
          processed: true,
          order: currentQuestionIndex + 1,
          expected_info: nextQuestion?.expected_info || 'conversa livre',
          grouped_responses: claimedMessages.length,
          is_freestyle: isFreestyle,
          ssp_version: 'v3.0',
          ai_questions: aiQuestionsCount + 1,
          emoji_count: emojiCount,
          has_presence: true,
          delay_ms: totalDelay
        }
      });

      // Marcar APENAS as mensagens reivindicadas como processadas
      for (const msg of claimedMessages) {
        await supabase
          .from('conversation_messages')
          .update({ metadata: { ...msg.metadata, processed: true } })
          .eq('id', msg.id);
      }

      // Atualizar status - se finalizou, mudar para processing
      if (shouldFinish) {
        console.log(`✅ [${analysis.id}] Conversa finalizada - iniciando análise`);
        
        await supabase
          .from('analysis_requests')
          .update({
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', analysis.id);

        // Invocar geração de métricas
        await supabase.functions.invoke('generate-metrics', {
          body: { analysis_id: analysis.id }
        });
      } else {
        // Apenas atualizar last_message_at
        await supabase
          .from('analysis_requests')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', analysis.id);
      }

      return { analysis_id: analysis.id, action: 'responded', grouped: unprocessedMessages.length, finished: shouldFinish };
    }

    // CENÁRIO B: Cliente não respondeu (NUDGE após 20 minutos)
    if (lastMessage.role === 'ai') {
      const nudgeCount = messages.filter((m: any) => 
        m.role === 'ai' && m.metadata?.is_nudge === true
      ).length;

      // MUDANÇA: Primeiro nudge após 20 minutos (1200000ms)
      const TWENTY_MINUTES = 20 * 60 * 1000;
      
      if (nudgeCount === 0 && timeSinceLastMessage > TWENTY_MINUTES) {
        console.log(`👋 [${analysis.id}] Enviando nudge após 20 minutos`);

        // Gerar nudge humanizado com IA
        // Selecionar mensagem de nudge aleatória (SEM EMOJIS)
        const nudgeMessages = [
          "oi, tudo bem?",
          "opa, ainda tá aí?",
          "e aí, consegue me ajudar?"
        ];
        const nudgeText = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)];

        // Enviar presence + pequeno delay antes do nudge
        await fetch(`${actualEvolutionUrl}/chat/sendPresence/${actualEvolutionInstance}`, {
          method: 'POST',
          headers: { 'apikey': actualEvolutionKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: analysis.target_phone, state: 'composing' })
        });

        const nudgeBase = 1500;
        const nudgeChar = Math.min(nudgeText.length * 15, 2000);
        const nudgeDelay = nudgeBase + nudgeChar;
        await new Promise((r) => setTimeout(r, nudgeDelay));

        // Enviar nudge
        const evolutionPayload = {
          number: analysis.target_phone,
          text: nudgeText
        };

        const evolutionResponse = await fetch(
          `${actualEvolutionUrl}/message/sendText/${actualEvolutionInstance}`,
          {
            method: 'POST',
            headers: {
              'apikey': actualEvolutionKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(evolutionPayload),
          }
        );

        if (!evolutionResponse.ok) {
          throw new Error(`Evolution API error: ${await evolutionResponse.text()}`);
        }

        await fetch(`${actualEvolutionUrl}/chat/sendPresence/${actualEvolutionInstance}`, {
          method: 'POST',
          headers: { 'apikey': actualEvolutionKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: analysis.target_phone, state: 'available' })
        });

        // Salvar nudge
        await supabase.from('conversation_messages').insert({
          analysis_id: analysis.id,
          role: 'ai',
          content: nudgeText,
          metadata: { 
            processed: true,
            is_nudge: true,
            nudge_type: '20min',
            has_presence: true,
            delay_ms: nudgeDelay
          }
        });

        await supabase
          .from('analysis_requests')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', analysis.id);

        return { analysis_id: analysis.id, action: 'nudge_sent', type: '20min' };
      }
    }

    // CENÁRIO C: REATIVAÇÃO (FASE 5 - Análises Intermediária e Profunda)
    const reactivationsSent = analysis.metadata?.reactivations_sent || 0;
    
    // REATIVAÇÃO INTERMEDIÁRIA (24h)
    if (analysis.analysis_depth === 'intermediate' && lastMessage.role === 'assistant') {
      const hoursWaiting = timeSinceLastMessage / (1000 * 60 * 60);
      const reactivationTimes = [2, 6, 12]; // horas
      
      for (let i = 0; i < reactivationTimes.length; i++) {
        if (hoursWaiting >= reactivationTimes[i] && reactivationsSent === i) {
          const messages = [
            "Oi! Conseguiu dar uma olhada naquelas informações que mencionou?",
            "Tudo bem por aí? Fiquei pensando sobre o que conversamos...",
            "Desculpa incomodar de novo, mas conseguiu avaliar se faz sentido pra mim?"
          ];
          
          console.log(`🔁 [${analysis.id}] Reativação intermediária ${i + 1}/3 (${hoursWaiting.toFixed(1)}h)`);
          
          await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
            method: 'POST',
            headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              number: analysis.target_phone,
              text: messages[i]
            })
          });
          
          await supabase.from('conversation_messages').insert({
            analysis_id: analysis.id,
            role: 'assistant',
            content: messages[i],
            metadata: { processed: true, is_reactivation: true, reactivation_number: i + 1 }
          });
          
          await supabase
            .from('analysis_requests')
            .update({
              metadata: { ...analysis.metadata, reactivations_sent: i + 1 },
              last_message_at: new Date().toISOString()
            })
            .eq('id', analysis.id);
          
          return { analysis_id: analysis.id, action: 'reactivation_sent', number: i + 1 };
        }
      }
    }
    
    // REATIVAÇÃO PROFUNDA (5 dias)
    if (analysis.analysis_depth === 'deep' && lastMessage.role === 'assistant') {
      const daysSinceCreated = (Date.now() - new Date(analysis.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const reactivationDays = [2, 3, 4];
      
      for (let i = 0; i < reactivationDays.length; i++) {
        const targetDay = reactivationDays[i];
        
        if (daysSinceCreated >= targetDay && reactivationsSent === i) {
          const messagesByDay = [
            ["Oi! Voltando aqui... conseguiu ver melhor sobre o que conversamos?", "Opa, tudo bem? Ainda to interessado(a), tem alguma novidade?"],
            ["Olá! Ainda to pesquisando sobre isso... consegue me passar mais detalhes?", "Oi de novo! Fiquei pensando aqui, será que consegue me ajudar com mais informações?"],
            ["Oi! Desculpa a insistência, mas realmente preciso decidir logo. Pode me ajudar?", "Voltando aqui mais uma vez... preciso fechar isso essa semana. Consegue me passar os detalhes?"]
          ];
          
          const msg = messagesByDay[i][Math.floor(Math.random() * messagesByDay[i].length)];
          
          console.log(`🔁 [${analysis.id}] Reativação profunda ${i + 1}/3 (dia ${daysSinceCreated.toFixed(1)})`);
          
          await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
            method: 'POST',
            headers: { 'apikey': evolutionKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              number: analysis.target_phone,
              text: msg
            })
          });
          
          await supabase.from('conversation_messages').insert({
            analysis_id: analysis.id,
            role: 'assistant',
            content: msg,
            metadata: { processed: true, is_reactivation: true, reactivation_day: targetDay }
          });
          
          await supabase
            .from('analysis_requests')
            .update({
              metadata: { ...analysis.metadata, reactivations_sent: i + 1, [`reactivation_day_${targetDay}`]: new Date().toISOString() },
              last_message_at: new Date().toISOString()
            })
            .eq('id', analysis.id);
          
          return { analysis_id: analysis.id, action: 'reactivation_sent', day: targetDay };
        }
      }
    }

    // CENÁRIO D: TIMEOUT CONFIGURÁVEL (FASE 5)
    const DEPTH_TIMEOUTS = {
      quick: 30 * 60 * 1000, // 30 minutos
      intermediate: 24 * 60 * 60 * 1000, // 24 horas
      deep: 5 * 24 * 60 * 60 * 1000 // 5 dias
    };
    
    const messageCount = messages.length;
    const MAX_INTERACTIONS = {
      quick: 10, // 5 interações x 2 (user + assistant)
      intermediate: 20, // 10 interações x 2
      deep: 30 // 15 interações x 2
    };
    
    const timeoutThreshold = DEPTH_TIMEOUTS[analysis.analysis_depth as keyof typeof DEPTH_TIMEOUTS] || DEPTH_TIMEOUTS.quick;
    const maxMessages = MAX_INTERACTIONS[analysis.analysis_depth as keyof typeof MAX_INTERACTIONS] || MAX_INTERACTIONS.quick;
    const timeSinceStart = Date.now() - new Date(analysis.created_at).getTime();
    
    if (timeSinceStart >= timeoutThreshold || messageCount >= maxMessages) {
      console.log(`⏰ [${analysis.id}] Timeout (${(timeSinceStart/1000/60).toFixed(0)}min ou ${messageCount} msgs) - finalizando`);

      await supabase
        .from('analysis_requests')
        .update({ 
          status: 'processing',
          completed_at: new Date().toISOString()
        })
        .eq('id', analysis.id);

      await supabase.functions.invoke('generate-metrics', {
        body: { analysis_id: analysis.id }
      });

      return { analysis_id: analysis.id, action: 'timeout' };
    }

    return { analysis_id: analysis.id, action: 'no_action_needed' };

  } catch (error) {
    console.error(`❌ [${analysis.id}] Erro:`, error);
    throw error;
  }
}
