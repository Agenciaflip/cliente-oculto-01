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

    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
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

    // PROCESSAMENTO PARALELO: pegar até 5 análises pendentes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: pendingAnalyses } = await supabase
      .from('analysis_requests')
      .select('*')
      .eq('status', 'pending')
      .or(`processing_started_at.is.null,processing_started_at.lt.${twoMinutesAgo}`)
      .order('created_at', { ascending: true })
      .limit(5);

    if (!pendingAnalyses || pendingAnalyses.length === 0) {
      console.log('No pending analyses found');
      return new Response(
        JSON.stringify({ message: 'No pending analyses' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Processando ${pendingAnalyses.length} análises simultâneas`);
    console.log(`📋 IDs: ${pendingAnalyses.map(a => a.id).join(', ')}`);
    console.log(`⏱️ Iniciado às ${new Date().toISOString()}`);

    // Marcar todas como 'processing' com lock otimista
    const analysisIds = pendingAnalyses.map(a => a.id);
    await supabase
      .from('analysis_requests')
      .update({ 
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .in('id', analysisIds);

    // Processar cada análise em paralelo
    const results = await Promise.allSettled(
      pendingAnalyses.map(analysis => processAnalysis(analysis, supabase, perplexityKey, openAIKey, evolutionUrl, evolutionKey, evolutionInstance))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Concluído: ${successful} sucesso, ${failed} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: pendingAnalyses.length,
        successful,
        failed,
        results: results.map((r, i) => ({
          id: pendingAnalyses[i].id,
          status: r.status,
          ...(r.status === 'rejected' ? { error: r.reason } : {})
        }))
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

// FUNÇÃO AUXILIAR PARA PROCESSAR CADA ANÁLISE
async function processAnalysis(
  pendingAnalysis: any,
  supabase: any,
  perplexityKey: string | undefined,
  openAIKey: string | undefined,
  evolutionUrl: string | undefined,
  evolutionKey: string | undefined,
  evolutionInstance: string | undefined
) {
  try {
    console.log(`🔄 [${pendingAnalysis.id}] Iniciando processamento para ${pendingAnalysis.target_phone}`);

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

    // ETAPA 2: Gerar estratégia de perguntas com OpenAI
    console.log('Generating questions strategy with OpenAI (gpt-4o)...');

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

    const strategyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.7,
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

    // Robust parsing with tool-call fallback and content parsing
    let questionsStrategy: any | null = null;
    try {
      const toolCalls = strategyData?.choices?.[0]?.message?.tool_calls;
      if (toolCalls && toolCalls[0]?.function?.arguments) {
        questionsStrategy = JSON.parse(toolCalls[0].function.arguments);
      } else {
        const content = strategyData?.choices?.[0]?.message?.content;
        if (content) {
          try {
            questionsStrategy = JSON.parse(content);
          } catch {
            // attempt to extract numbered lines into a minimal strategy
            const lines = String(content).split('\n').map((l: string) => l.trim()).filter(Boolean);
            const qs = lines
              .filter((l: string) => /^\d+[\).\-]\s*/.test(l) || l.length > 0)
              .slice(0, config.numQuestions)
              .map((l: string, idx: number) => ({
                order: idx + 1,
                question: l.replace(/^\d+[\).\-]\s*/, ''),
                expected_info: 'informações relevantes sobre serviços e atendimento'
              }));
            if (qs.length > 0) questionsStrategy = { questions: qs };
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse questions strategy:', e);
    }

    if (!questionsStrategy?.questions?.length) {
      // create a minimal default strategy to avoid blocking
      questionsStrategy = {
        questions: Array.from({ length: config.numQuestions }, (_, i) => {
          const base = [
            'Olá! Tudo bem? Vi o contato e gostaria de entender melhor os serviços que vocês oferecem.',
            'Poderia me explicar como funciona o atendimento e os prazos?',
            'Vocês poderiam me passar uma ideia de valores ou faixas de preço?',
            'Quais diferenciais vocês têm em relação a outras opções?',
            'Como posso seguir com um orçamento/atendimento?'
          ];
          return {
            order: i + 1,
            question: base[i] || `Pergunta ${i + 1}: poderia me detalhar um pouco mais?`,
            expected_info: 'detalhes sobre serviços, prazos e preços'
          };
        })
      };
    }
    // Salvar estratégia no banco
    await supabase
      .from('analysis_requests')
      .update({ questions_strategy: questionsStrategy })
      .eq('id', pendingAnalysis.id);

    // ETAPA 3: Enviar primeira mensagem via Evolution API
    console.log('Sending first message via Evolution API...');

    const firstQuestion = questionsStrategy.questions[0];

    // NORMALIZAÇÃO MELHORADA: remover caracteres especiais e garantir formato correto
    const rawPhone = String(pendingAnalysis.target_phone || '').replace(/\D/g, '');
    let normalizedPhone = rawPhone;
    
    // Se não começa com 55, adicionar código do país
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }
    
    console.log(`📱 Número original: ${pendingAnalysis.target_phone} → Normalizado: ${normalizedPhone}`);

    // GERAR MÚLTIPLAS VARIAÇÕES para testar
    const candidates: string[] = [];
    
    if (normalizedPhone.startsWith('55')) {
      const afterCountry = normalizedPhone.slice(2); // remove '55'
      const areaCode = afterCountry.slice(0, 2); // primeiros 2 dígitos = DDD
      const localNumber = afterCountry.slice(2); // resto do número
      
      // Variação 1: Número completo normalizado (55 + DDD + número)
      candidates.push(normalizedPhone);
      
      // Variação 2: Se tem 11 dígitos após o 55 (55 + 11 dígitos), tentar com 12 (adicionar 9)
      if (afterCountry.length === 10) {
        candidates.push(`55${areaCode}9${localNumber}`);
      }
      
      // Variação 3: Se tem 12 dígitos após o 55, tentar remover o primeiro dígito do número local
      if (afterCountry.length === 11 && localNumber.startsWith('9')) {
        candidates.push(`55${areaCode}${localNumber.slice(1)}`);
      }
      
      // Variação 4: Sem código do país (apenas DDD + número)
      candidates.push(afterCountry);
      
      // Variação 5: Sem código do país + adicionar/remover 9
      if (afterCountry.length === 10) {
        candidates.push(`${areaCode}9${localNumber}`);
      }
      if (afterCountry.length === 11 && localNumber.startsWith('9')) {
        candidates.push(`${areaCode}${localNumber.slice(1)}`);
      }
    } else {
      candidates.push(normalizedPhone);
    }

    // Remover duplicatas mantendo ordem
    const uniqueCandidates = [...new Set(candidates)];
    console.log(`🔄 Testando ${uniqueCandidates.length} variações: ${uniqueCandidates.join(', ')}`);

    let sendOk = false;
    let usedNumber = normalizedPhone;
    let lastErr = '';
    let lastErrorResponse: any = null;

    for (const num of uniqueCandidates) {
      console.log(`📤 Tentando enviar para: ${num}`);
      
      const payload = { number: num, text: firstQuestion.question };
      const resp = await fetch(
        `${evolutionUrl}/message/sendText/${evolutionInstance}`,
        {
          method: 'POST',
          headers: {
            'apikey': evolutionKey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
      
      if (resp.ok) {
        sendOk = true;
        usedNumber = num;
        console.log(`✅ Mensagem enviada com sucesso usando: ${num}`);
        break;
      }
      
      const errorText = await resp.text();
      lastErr = errorText;
      
      try {
        lastErrorResponse = JSON.parse(errorText);
        console.warn(`❌ Falha com ${num}:`, lastErrorResponse);
        
        // Verificar se o número não existe no WhatsApp
        if (lastErrorResponse?.response?.message?.[0]?.exists === false) {
          console.warn(`⚠️ Número ${num} não existe no WhatsApp`);
        }
      } catch {
        console.warn(`❌ Falha com ${num}: ${errorText}`);
      }
    }

    if (!sendOk) {
      // Atualizar status para failed com informação detalhada
      await supabase
        .from('analysis_requests')
        .update({ 
          status: 'failed',
          metrics: {
            error: 'Número não encontrado no WhatsApp',
            details: lastErrorResponse || lastErr,
            tested_variations: uniqueCandidates,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', pendingAnalysis.id);
      
      throw new Error(`Evolution API error: Nenhuma variação do número funcionou. Última tentativa: ${lastErr}`);
    }

    // ATUALIZAR target_phone com o número que funcionou
    await supabase
      .from('analysis_requests')
      .update({ target_phone: usedNumber })
      .eq('id', pendingAnalysis.id);
    
    console.log(`💾 Número atualizado no banco: ${usedNumber}`);
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

    console.log(`✅ [${pendingAnalysis.id}] Análise iniciada com sucesso`);
    
    return {
      success: true,
      analysis_id: pendingAnalysis.id,
      first_question: firstQuestion.question
    };

  } catch (error) {
    console.error(`❌ [${pendingAnalysis.id}] Erro:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // SISTEMA DE RETRY: tentar novamente se não excedeu o limite
    if (pendingAnalysis.retry_count < 3) {
      console.log(`🔄 [${pendingAnalysis.id}] Retry ${pendingAnalysis.retry_count + 1}/3`);
      
      await supabase
        .from('analysis_requests')
        .update({ 
          status: 'pending',
          retry_count: pendingAnalysis.retry_count + 1,
          processing_started_at: null
        })
        .eq('id', pendingAnalysis.id);
      
      throw new Error(`Retry scheduled: ${errorMessage}`);
    } else {
      // Após 3 tentativas, marcar como failed definitivamente
      console.log(`💀 [${pendingAnalysis.id}] Falha definitiva após 3 tentativas`);
      
      await supabase
        .from('analysis_requests')
        .update({ 
          status: 'failed',
          metrics: {
            error: errorMessage,
            details: 'Falha após 3 tentativas automáticas',
            retry_count: pendingAnalysis.retry_count,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', pendingAnalysis.id);
      
      throw error;
    }
  }
}
