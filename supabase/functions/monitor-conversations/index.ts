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

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    console.log('🔍 Monitor: Buscando conversas ativas...');

    // Buscar todas análises em 'chatting'
    const { data: activeAnalyses } = await supabase
      .from('analysis_requests')
      .select('*')
      .eq('status', 'chatting');

    if (!activeAnalyses || activeAnalyses.length === 0) {
      console.log('Nenhuma conversa ativa encontrada');
      return new Response(
        JSON.stringify({ message: 'No active conversations' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Monitorando ${activeAnalyses.length} conversas ativas`);

    const results = await Promise.allSettled(
      activeAnalyses.map(analysis => processConversation(
        analysis, 
        supabase, 
        lovableKey!, 
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
        failed
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
  lovableKey: string,
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

      // Buscar próxima pergunta
      const currentQuestionIndex = messages.filter((m: any) => m.role === 'ai').length;
      const questionsStrategy = analysis.questions_strategy;
      const totalQuestions = questionsStrategy?.questions?.length || 0;

      // Verificar se todas perguntas foram respondidas
      if (currentQuestionIndex >= totalQuestions) {
        console.log(`✅ [${analysis.id}] Todas perguntas respondidas - finalizando`);
        
        await supabase
          .from('analysis_requests')
          .update({ status: 'processing' })
          .eq('id', analysis.id);

        await supabase.functions.invoke('generate-metrics', {
          body: { analysis_id: analysis.id }
        });

        // Marcar mensagens como processadas
        for (const msg of unprocessedMessages) {
          await supabase
            .from('conversation_messages')
            .update({ metadata: { ...msg.metadata, processed: true } })
            .eq('id', msg.id);
        }

        return { analysis_id: analysis.id, action: 'completed' };
      }

      const nextQuestion = questionsStrategy.questions[currentQuestionIndex];

      // Chamar IA com robustez
      let adaptedQuestion = nextQuestion.question;

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `Você é um cliente oculto ${analysis.persona}. Adapte a próxima pergunta considerando TODAS as mensagens recentes do cliente. Seja natural e coerente.`
              },
              {
                role: 'user',
                content: `HISTÓRICO COMPLETO:
${conversationHistory}

MENSAGENS AGRUPADAS DO CLIENTE:
${groupedContent}

PRÓXIMA PERGUNTA PLANEJADA: ${nextQuestion.question}
OBJETIVO: ${nextQuestion.expected_info}

Adapte a pergunta de forma natural considerando TUDO que o cliente disse. Seja direto, sem rodeios.`
              }
            ],
            max_tokens: 300,
          }),
        });

        if (!aiResponse.ok) {
          const status = aiResponse.status;
          console.error(`❌ [${analysis.id}] IA falhou: ${status}`);
          
          if (status === 429) {
            console.error('Rate limit - usando pergunta planejada');
          } else if (status === 402) {
            console.error('Payment required - usando pergunta planejada');
          }
          // Fallback: usar pergunta planejada
          adaptedQuestion = nextQuestion.question;
        } else {
          const aiData = await aiResponse.json();
          adaptedQuestion = aiData.choices?.[0]?.message?.content?.trim() || nextQuestion.question;
          console.log(`🤖 [${analysis.id}] IA adaptou: ${adaptedQuestion}`);
        }
      } catch (error) {
        console.error(`❌ [${analysis.id}] Erro na IA:`, error);
        adaptedQuestion = nextQuestion.question;
      }

      // Enviar via Evolution
      const evolutionPayload = {
        number: analysis.target_phone,
        text: adaptedQuestion
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

      console.log(`📤 [${analysis.id}] Resposta enviada`);

      // Salvar mensagem da IA
      await supabase.from('conversation_messages').insert({
        analysis_id: analysis.id,
        role: 'ai',
        content: adaptedQuestion,
        metadata: { 
          processed: true,
          order: currentQuestionIndex + 1,
          expected_info: nextQuestion.expected_info,
          grouped_responses: unprocessedMessages.length
        }
      });

      // Marcar mensagens como processadas
      for (const msg of unprocessedMessages) {
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

      return { analysis_id: analysis.id, action: 'responded', grouped: unprocessedMessages.length };
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
          const nudgeResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
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
