import "https://deno.land/x/xhr@0.1.0/mod.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPersonaPrompt } from "../_shared/prompts/personas.ts";

// Função auxiliar para saudação contextual (horário de Brasília)
function getGreetingByTime(): string {
  const nowBrasilia = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false });
  const hour = parseInt(nowBrasilia.split(':')[0]);
  if (hour >= 5 && hour < 12) return 'bom dia';
  if (hour >= 12 && hour < 18) return 'boa tarde';
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
  // Selecionar credenciais baseadas no ai_gender
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
      // Atomic claim to avoid duplicate processing
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

      console.log(`📦 [${analysis.id}] Reivindicadas ${claimedMessages.length} mensagens (runId=${runId})`);

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

      // Determinar próxima ação
      let nextQuestion: any = null;
      let nextStepInstruction = '';

      if (currentQuestionIndex < totalQuestions) {
        nextQuestion = questionsStrategy.questions[currentQuestionIndex];
        nextStepInstruction = `Faça a próxima pergunta (${currentQuestionIndex + 1}/${totalQuestions}): ${nextQuestion.expected_info}`;
      } else {
        nextStepInstruction = 'Perguntas estruturadas completas - continue conversa livre';
      }

      // Construir systemPrompt
      const basePersonaPrompt = getPersonaPrompt(analysis.ai_gender || 'male');
      const currentTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const appropriateGreeting = getGreetingByTime();

      const systemPrompt = `${basePersonaPrompt}

HORÁRIO ATUAL (Brasil): ${currentTime}
SAUDAÇÃO CONTEXTUAL: ${appropriateGreeting}

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

🎯 REGRAS CRÍTICAS DE CONVERSA NATURAL:

1. RESPONDER PRIMEIRO, PERGUNTAR DEPOIS:
   - SE a última mensagem do vendedor tiver uma PERGUNTA (contém "?"), você DEVE responder objetivamente ANTES de fazer sua próxima pergunta
   - Resposta deve ser CURTA (1-2 linhas), direta e natural
   - Só DEPOIS da resposta, faça UMA nova pergunta relacionada ao objetivo
   
   Exemplos:
   Vendedor: "Quantos pães você quer?"
   ❌ ERRADO: "E vocês fazem entrega?"
   ✅ CORRETO: "uns 6 pães mesmo, vocês fazem entrega?"
   
   Vendedor: "Para quando você precisa?"
   ❌ ERRADO: "Qual é o preço?"
   ✅ CORRETO: "pra amanhã de manhã, qual o valor?"

2. UMA PERGUNTA POR VEZ:
   - Faça APENAS uma pergunta por mensagem
   - Aguarde a resposta antes de avançar
   - Não atropele o vendedor

3. NATURALIDADE BRASILEIRA:
   - Use linguagem coloquial: "vcs", "pra", "tá", "né", "uns", "umas"
   - Mensagens curtas (máximo 2-3 linhas)
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
Faça UMA pergunta objetiva e natural.
`}

LEMBRE-SE:
- ZERO emojis
- Linguagem coloquial brasileira (vcs, pra, tá, né)
- Máximo 2-3 linhas
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

      console.log(`🤖 [${analysis.id}] Resposta final: ${finalResponse.substring(0, 100)}...`);

      // Enviar mensagem via Evolution
      await sendText(actualEvolutionUrl, actualEvolutionKey, actualEvolutionInstance, analysis.target_phone, finalResponse);

      // Salvar mensagem
      await supabase.from('conversation_messages').insert({
        analysis_id: analysis.id,
        role: 'ai',
        content: finalResponse,
        metadata: {
          question_order: nextQuestion?.order || currentQuestionIndex + 1,
          expected_info: nextQuestion?.expected_info || 'conversa livre',
          answered_seller_question: hasSellerQuestion || false
        }
      });

      // Marcar mensagens como processadas
      for (const msg of claimedMessages) {
        await supabase
          .from('conversation_messages')
          .update({ metadata: { ...msg.metadata, processed: true } })
          .eq('id', msg.id);
      }

      // Atualizar last_message_at
      await supabase
        .from('analysis_requests')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', analysis.id);

      return { analysis_id: analysis.id, action: 'responded', grouped: claimedMessages.length };
    }

    // CENÁRIO B: Nudge (20 minutos sem resposta)
    if (lastMessage.role === 'ai') {
      const TWENTY_MINUTES = 20 * 60 * 1000;

      if (timeSinceLastMessage > TWENTY_MINUTES && !analysis.nudge_sent) {
        console.log(`👋 [${analysis.id}] Enviando nudge (20+ min sem resposta)`);

        const nudgeVariations = [
          'oi, tudo bem?',
          'opa, ainda tá aí?',
          'e aí, consegue me ajudar?',
          'oi, viu minha msg?'
        ];

        const nudgeMessage = nudgeVariations[Math.floor(Math.random() * nudgeVariations.length)];

        await sendText(actualEvolutionUrl, actualEvolutionKey, actualEvolutionInstance, analysis.target_phone, nudgeMessage);

        await supabase.from('conversation_messages').insert({
          analysis_id: analysis.id,
          role: 'ai',
          content: nudgeMessage,
          metadata: { processed: true, is_nudge: true, nudge_type: '20min' }
        });

        await supabase
          .from('analysis_requests')
          .update({
            nudge_sent: true,
            last_message_at: new Date().toISOString()
          })
          .eq('id', analysis.id);

        return { analysis_id: analysis.id, action: 'nudge_sent' };
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
          last_message_at: new Date().toISOString(),
          metadata: { ...metadata, reactivations_sent: 2, last_reactivation_at: new Date().toISOString() }
        })
        .eq('id', analysis.id);

      console.log(`✅ [${analysis.id}] Segunda reativação enviada (24h)`);
      return { analysis_id: analysis.id, action: 'reactivation_24h' };
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
