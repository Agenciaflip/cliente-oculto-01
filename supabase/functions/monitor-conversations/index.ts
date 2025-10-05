import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');

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
        evolutionInstance!
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

async function processConversation(
  analysis: any,
  supabase: any,
  openAIKey: string,
  evolutionUrl: string,
  evolutionKey: string,
  evolutionInstance: string
) {
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
      console.log(`📦 [${analysis.id}] Agrupando ${unprocessedMessages.length} mensagens não processadas`);

      // Agrupar conteúdo
      const groupedContent = unprocessedMessages
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

      try {

        const systemPrompt = `MODELO SSR++ V3.0 - CLIENTE OCULTO AI

IDENTIDADE: Você é Lucas/Maria, brasileiro(a) de 28-42 anos, interessado genuinamente no produto/serviço.

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
          adaptedQuestion = aiData.choices?.[0]?.message?.content?.trim() || adaptedQuestion;
          console.log(`🤖 [${analysis.id}] OpenAI respondeu: ${adaptedQuestion}`);
        }
      } catch (error) {
        console.error(`❌ [${analysis.id}] Erro na OpenAI:`, error);
        if (!isFreestyle && nextQuestion) {
          adaptedQuestion = nextQuestion.question;
        }
      }

      // Limpar completamente \n do texto
      const cleanMessage = adaptedQuestion
        .replace(/^Cliente Oculto:\s*/i, '')
        .replace(/^Você:\s*/i, '')
        .replace(/\\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Quebrar mensagem em frases naturais (não por \n)
      const messageChunks = cleanMessage.match(/[^.!?]+[.!?]+/g) || [cleanMessage];
      const finalChunks = messageChunks.slice(0, 3); // Máximo 3 mensagens
      
      console.log(`📦 [${analysis.id}] Enviando ${finalChunks.length} mensagem(ns)`);

      // Enviar cada chunk com delay simulando digitação humana
      for (let i = 0; i < finalChunks.length; i++) {
        const chunk = finalChunks[i].trim();
        if (!chunk) continue;
        
        // Delay entre mensagens: 1.5s a 2.5s (aleatório)
        if (i > 0) {
          const delay = 1500 + Math.random() * 1000;
          console.log(`⏱️ [${analysis.id}] Aguardando ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const evolutionPayload = {
          number: analysis.target_phone,
          text: chunk
        };

        const evolutionResponse = await fetch(
          `${evolutionUrl}/message/sendText/${evolutionInstance}`,
          {
            method: 'POST',
            headers: {
              'apikey': evolutionKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(evolutionPayload),
          }
        );

        if (!evolutionResponse.ok) {
          throw new Error(`Evolution API error: ${await evolutionResponse.text()}`);
        }

        const truncated = chunk.substring(0, 40);
        console.log(`📤 [${analysis.id}] Mensagem ${i + 1}/${finalChunks.length}: "${truncated}..."`);
      }

      // Salvar mensagem da IA (mensagem completa)
      await supabase.from('conversation_messages').insert({
        analysis_id: analysis.id,
        role: 'ai',
        content: cleanMessage,
        metadata: { 
          processed: true,
          order: currentQuestionIndex + 1,
          expected_info: nextQuestion?.expected_info || 'conversa livre',
          grouped_responses: unprocessedMessages.length,
          is_freestyle: isFreestyle,
          chunks_sent: finalChunks.length,
          ssp_version: 'v3.0',
          ai_questions: aiQuestionsCount + 1,
          emoji_count: emojiCount
        }
      });

      // Marcar mensagens como processadas
      for (const msg of unprocessedMessages) {
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

    // CENÁRIO B: Cliente não respondeu (NUDGES)
    if (lastMessage.role === 'ai') {
      const nudgeCount = messages.filter((m: any) => 
        m.role === 'ai' && m.metadata?.is_nudge === true
      ).length;

      // Tempos para nudges: 30s, 1min, 2min
      const nudgeThresholds = [30000, 60000, 120000];
      
      if (nudgeCount < 3 && timeSinceLastMessage > nudgeThresholds[nudgeCount]) {
        const nudgeTypes = ['gentle', 'moderate', 'direct'];
        const nudgeType = nudgeTypes[nudgeCount];

        console.log(`👋 [${analysis.id}] Enviando nudge ${nudgeType} (${nudgeCount + 1}/3)`);

        // Gerar nudge humanizado com IA
        const conversationHistory = messages
          .map((m: any) => `${m.role === 'ai' ? 'Cliente Oculto' : 'Empresa'}: ${m.content}`)
          .join('\n');

        const nudgePrompts = {
          gentle: 'Gentil e educado, como quem está aguardando uma resposta',
          moderate: 'Moderadamente curioso, demonstrando interesse genuíno',
          direct: 'Mais direto, mas ainda educado, como quem precisa de uma resposta'
        };

        let nudgeText = 'Oi, conseguiu ver minha mensagem?';

        try {
          const nudgeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Você é um cliente oculto ${analysis.persona}. Gere uma mensagem curta de follow-up.`
                },
                {
                  role: 'user',
                  content: `CONVERSA:
${conversationHistory}

Gere uma mensagem de nudge ${nudgePrompts[nudgeType as keyof typeof nudgePrompts]}. 
Máximo 15 palavras. Seja natural e humano.`
                }
              ],
              temperature: 0.7,
              max_tokens: 50,
            }),
          });

          if (nudgeResponse.ok) {
            const nudgeData = await nudgeResponse.json();
            nudgeText = nudgeData.choices?.[0]?.message?.content?.trim() || nudgeText;
          }
        } catch (error) {
          console.error(`❌ [${analysis.id}] Erro ao gerar nudge:`, error);
        }

        // Enviar nudge
        const evolutionPayload = {
          number: analysis.target_phone,
          text: nudgeText
        };

        const evolutionResponse = await fetch(
          `${evolutionUrl}/message/sendText/${evolutionInstance}`,
          {
            method: 'POST',
            headers: {
              'apikey': evolutionKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(evolutionPayload),
          }
        );

        if (!evolutionResponse.ok) {
          throw new Error(`Evolution API error: ${await evolutionResponse.text()}`);
        }

        // Salvar nudge
        await supabase.from('conversation_messages').insert({
          analysis_id: analysis.id,
          role: 'ai',
          content: nudgeText,
          metadata: { 
            processed: true,
            is_nudge: true,
            nudge_type: nudgeType
          }
        });

        await supabase
          .from('analysis_requests')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', analysis.id);

        return { analysis_id: analysis.id, action: 'nudge_sent', type: nudgeType };
      }
    }

    // CENÁRIO C: Timeout de 15 minutos
    if (timeSinceLastMessage > 15 * 60 * 1000) {
      console.log(`⏰ [${analysis.id}] Timeout de 15min - finalizando`);

      await supabase
        .from('analysis_requests')
        .update({ status: 'processing' })
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
