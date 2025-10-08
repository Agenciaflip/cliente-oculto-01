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

    const { analysis_id } = await req.json();

    if (!analysis_id) {
      return new Response(
        JSON.stringify({ error: 'analysis_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating metrics for analysis ${analysis_id}`);

    // Buscar análise
    const { data: analysis } = await supabase
      .from('analysis_requests')
      .select('*')
      .eq('id', analysis_id)
      .single();

    if (!analysis) {
      return new Response(
        JSON.stringify({ error: 'Analysis not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todas as mensagens da conversa
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('analysis_id', analysis_id)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar histórico formatado
    const conversationHistory = messages.map(m => ({
      role: m.role === 'ai' ? 'Cliente Oculto' : 'Empresa',
      content: m.content,
      timestamp: m.created_at
    }));

    // Calcular tempo médio de resposta
    const responseTimes: number[] = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === 'ai' && messages[i + 1].role === 'user') {
        const time1 = new Date(messages[i].created_at).getTime();
        const time2 = new Date(messages[i + 1].created_at).getTime();
        responseTimes.push((time2 - time1) / 1000); // em segundos
      }
    }

    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    console.log('Calling OpenAI (gpt-4o) to generate metrics...');

    // Chamar OpenAI para análise completa
    const metricsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Você é um analista especializado em Cliente Oculto. 
Analise conversas de atendimento e gere métricas objetivas e insights acionáveis.
Seja crítico mas construtivo. Identifique pontos fortes e oportunidades de melhoria.`
          },
          {
            role: 'user',
            content: `Analise esta conversa de cliente oculto e gere métricas detalhadas:

INFORMAÇÕES DA ANÁLISE:
- Empresa: ${analysis.company_name || 'Não informada'}
- Telefone: ${analysis.target_phone}
- Persona utilizada: ${analysis.persona}
- Profundidade: ${analysis.analysis_depth}
- Tempo médio de resposta: ${avgResponseTime} segundos

CONVERSA COMPLETA:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n\n')}

Gere uma análise completa e estruturada do atendimento.`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_analysis_metrics',
            description: 'Gera métricas estruturadas da análise de cliente oculto',
            parameters: {
              type: 'object',
              properties: {
                overall_score: {
                  type: 'number',
                  description: 'Nota geral de 0 a 10',
                  minimum: 0,
                  maximum: 10
                },
                response_time: {
                  type: 'object',
                  properties: {
                    avg_seconds: { type: 'number' },
                    rating: { type: 'string', enum: ['excelente', 'bom', 'regular', 'lento'] }
                  },
                  required: ['avg_seconds', 'rating']
                },
                communication_quality: {
                  type: 'object',
                  properties: {
                    clarity: { type: 'number', minimum: 0, maximum: 10 },
                    professionalism: { type: 'number', minimum: 0, maximum: 10 },
                    empathy: { type: 'number', minimum: 0, maximum: 10 },
                    completeness: { type: 'number', minimum: 0, maximum: 10 }
                  },
                  required: ['clarity', 'professionalism', 'empathy', 'completeness']
                },
                information_captured: {
                  type: 'object',
                  properties: {
                    services_offered: { type: 'array', items: { type: 'string' } },
                    pricing_transparent: { type: 'boolean' },
                    pricing_details: { type: 'string' },
                    availability_info: { type: 'string' },
                    additional_info: { type: 'string' }
                  },
                  required: ['services_offered', 'pricing_transparent']
                },
                strengths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Pontos fortes do atendimento'
                },
                weaknesses: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Pontos fracos ou oportunidades de melhoria'
                },
                recommendations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Recomendações práticas e acionáveis'
                },
                customer_experience_score: {
                  type: 'number',
                  description: 'Nota da experiência do cliente de 0 a 10',
                  minimum: 0,
                  maximum: 10
                },
                would_recommend: {
                  type: 'boolean',
                  description: 'Se recomendaria este atendimento'
                },
                summary: {
                  type: 'string',
                  description: 'Resumo executivo da análise em 2-3 frases'
                }
              },
              required: [
                'overall_score',
                'response_time',
                'communication_quality',
                'information_captured',
                'strengths',
                'weaknesses',
                'recommendations',
                'customer_experience_score',
                'would_recommend',
                'summary'
              ]
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_analysis_metrics' } }
      }),
    });

    const metricsData = await metricsResponse.json();
    
    if (!metricsData.choices?.[0]?.message?.tool_calls?.[0]) {
      throw new Error('Failed to generate metrics from AI');
    }

    const metrics = JSON.parse(
      metricsData.choices[0].message.tool_calls[0].function.arguments
    );

    console.log('Metrics generated successfully');

    // FASE 6: Enriquecer com análises temporais e de follow-up
    const enrichedMetrics: any = { ...metrics };
    
    // Análise temporal
    const enrichedResponseTimes = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === 'ai' && messages[i + 1].role === 'user') {
        const time1 = new Date(messages[i].created_at).getTime();
        const time2 = new Date(messages[i + 1].created_at).getTime();
        enrichedResponseTimes.push((time2 - time1) / (1000 * 60));
      }
    }
    
    if (enrichedResponseTimes.length > 0) {
      enrichedMetrics.temporal_analysis = {
        avg_response_minutes: (enrichedResponseTimes.reduce((a, b) => a + b, 0) / enrichedResponseTimes.length).toFixed(1),
        fastest_response: Math.min(...enrichedResponseTimes).toFixed(1),
        slowest_response: Math.max(...enrichedResponseTimes).toFixed(1)
      };
    }
    
    // Análise de follow-ups
    let followUpCount = 0;
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].role === 'assistant' && messages[i-1].role === 'assistant') followUpCount++;
    }
    
    enrichedMetrics.followup_analysis = {
      total_followups: followUpCount,
      reactivations_sent: analysis.metadata?.reactivations_sent || 0
    };
    
    // Score de persistência (deep)
    if (analysis.analysis_depth === 'deep') {
      const reactivations = analysis.metadata?.reactivations_sent || 0;
      const score = Math.min(10, (reactivations * 2) + (followUpCount * 0.5));
      enrichedMetrics.persistence_score = {
        score: score.toFixed(1),
        classification: score >= 8 ? 'Excelente' : score >= 6 ? 'Boa' : 'Regular'
      };
    }

    // Salvar métricas enriquecidas e atualizar status
    const { error: updateError } = await supabase
      .from('analysis_requests')
      .update({
        metrics: enrichedMetrics,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', analysis_id);

    if (updateError) {
      throw updateError;
    }

    console.log(`Analysis ${analysis_id} completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id: analysis_id,
        metrics: metrics
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
