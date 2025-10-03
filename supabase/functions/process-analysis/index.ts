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

    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    const { action } = await req.json().catch(() => ({}));

    // Se ação for finalizar conversas inativas
    if (action === 'finalize_inactive') {
      const { data: inactiveChats } = await supabase
        .from('analysis_requests')
        .select('*')
        .eq('status', 'chatting')
        .lt('last_message_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

      console.log(`Found ${inactiveChats?.length || 0} inactive chats`);

      for (const chat of inactiveChats || []) {
        await supabase.functions.invoke('generate-metrics', {
          body: { analysis_id: chat.id }
        });
      }

      return new Response(
        JSON.stringify({ processed: inactiveChats?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar análises pendentes
    const { data: pendingAnalysis } = await supabase
      .from('analysis_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!pendingAnalysis) {
      console.log('No pending analyses found');
      return new Response(
        JSON.stringify({ message: 'No pending analyses' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing analysis ${pendingAnalysis.id}`);

    // ETAPA 1: Pesquisar empresa no Perplexity (se necessário)
    let companyInfo = pendingAnalysis.research_data;
    if (!companyInfo && perplexityKey) {
      console.log('Researching company with Perplexity...');
      
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'Você é um pesquisador especializado em análise de empresas. Seja conciso e objetivo.'
            },
            {
              role: 'user',
              content: `Pesquise informações sobre a empresa "${pendingAnalysis.company_name || 'empresa'}" com o telefone ${pendingAnalysis.target_phone}. 
              Retorne: segmento, principais serviços/produtos, diferenciais, público-alvo e qualquer informação relevante para um cliente oculto.`
            }
          ],
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      if (perplexityResponse.ok) {
        const perplexityData = await perplexityResponse.json();
        companyInfo = {
          summary: perplexityData.choices[0].message.content,
          researched_at: new Date().toISOString()
        };

        await supabase
          .from('analysis_requests')
          .update({ 
            research_data: companyInfo,
            status: 'researching'
          })
          .eq('id', pendingAnalysis.id);
      }
    }

    // ETAPA 2: Gerar estratégia de perguntas com Lovable AI
    console.log('Generating questions strategy with Lovable AI...');

    const personaDescriptions = {
      interested: 'um cliente interessado e curioso, que faz perguntas naturais sobre os serviços',
      skeptical: 'um cliente cético que questiona detalhes, preços e compara com concorrentes',
      urgent: 'um cliente com urgência que precisa de resposta rápida e soluções imediatas',
      price_focused: 'um cliente focado em preço e custo-benefício',
      researcher: 'um cliente que está pesquisando detalhadamente antes de decidir'
    };

    const depthConfig = {
      quick: { numQuestions: 3, description: 'análise rápida com perguntas essenciais' },
      medium: { numQuestions: 5, description: 'análise moderada com perguntas importantes' },
      deep: { numQuestions: 8, description: 'análise profunda com perguntas detalhadas' }
    };

    const config = depthConfig[pendingAnalysis.analysis_depth as keyof typeof depthConfig] || depthConfig.quick;

    const strategyResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Você é um especialista em Cliente Oculto. Sua função é criar uma estratégia de perguntas para avaliar o atendimento de empresas via WhatsApp.`
          },
          {
            role: 'user',
            content: `Crie uma estratégia de ${config.numQuestions} perguntas para análise de cliente oculto.

CONTEXTO:
- Empresa: ${pendingAnalysis.company_name || 'Empresa desconhecida'}
- Telefone: ${pendingAnalysis.target_phone}
- Informações: ${companyInfo?.summary || 'Não disponível'}
- Persona: ${personaDescriptions[pendingAnalysis.persona as keyof typeof personaDescriptions]}
- Profundidade: ${config.description}

IMPORTANTE:
- A primeira mensagem deve ser natural e sem parecer spam
- As perguntas devem seguir uma sequência lógica
- Cada pergunta deve ter um objetivo claro de coleta de informação
- Adapte o tom à persona escolhida`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'create_questions_strategy',
            description: 'Cria a estratégia de perguntas para o cliente oculto',
            parameters: {
              type: 'object',
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      order: { type: 'number' },
                      question: { type: 'string' },
                      expected_info: { type: 'string' },
                      follow_up_hints: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['order', 'question', 'expected_info']
                  }
                }
              },
              required: ['questions']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'create_questions_strategy' } }
      }),
    });

    const strategyData = await strategyResponse.json();
    const questionsStrategy = JSON.parse(
      strategyData.choices[0].message.tool_calls[0].function.arguments
    );

    // Salvar estratégia no banco
    await supabase
      .from('analysis_requests')
      .update({ questions_strategy: questionsStrategy })
      .eq('id', pendingAnalysis.id);

    // ETAPA 3: Enviar primeira mensagem via Evolution API
    console.log('Sending first message via Evolution API...');

    const firstQuestion = questionsStrategy.questions[0];
    const evolutionPayload = {
      number: pendingAnalysis.target_phone.replace(/\D/g, ''),
      text: firstQuestion.question
    };

    const evolutionResponse = await fetch(
      `${evolutionUrl}/message/sendText/${evolutionInstance}`,
      {
        method: 'POST',
        headers: {
          'apikey': evolutionKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(evolutionPayload),
      }
    );

    if (!evolutionResponse.ok) {
      throw new Error(`Evolution API error: ${await evolutionResponse.text()}`);
    }

    // Salvar mensagem inicial
    await supabase.from('conversation_messages').insert({
      analysis_id: pendingAnalysis.id,
      role: 'ai',
      content: firstQuestion.question,
      metadata: { order: 1, expected_info: firstQuestion.expected_info }
    });

    // Atualizar status para chatting
    await supabase
      .from('analysis_requests')
      .update({ 
        status: 'chatting',
        started_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', pendingAnalysis.id);

    console.log(`Analysis ${pendingAnalysis.id} started successfully`);

    return new Response(
      JSON.stringify({ 
        success: true,
        analysis_id: pendingAnalysis.id,
        first_question: firstQuestion.question
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
