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

    const { analysis_id, phone_number } = await req.json();

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      analysis_id: analysis_id || 'not provided',
      phone_number: phone_number || 'not provided',
      checks: {}
    };

    // ============= CHECK 1: Verificar se análise existe =============
    if (analysis_id) {
      const { data: analysis, error: analysisError } = await supabase
        .from('analysis_requests')
        .select('*')
        .eq('id', analysis_id)
        .single();

      diagnostics.checks.analysis_exists = {
        status: analysis ? '✅ ENCONTRADA' : '❌ NÃO ENCONTRADA',
        data: analysis ? {
          id: analysis.id,
          status: analysis.status,
          target_phone: analysis.target_phone,
          evolution_instance: analysis.evolution_instance,
          ai_gender: analysis.ai_gender,
          started_at: analysis.started_at,
          last_message_at: analysis.last_message_at,
          metadata: analysis.metadata
        } : null,
        error: analysisError?.message
      };

      // ============= CHECK 2: Verificar mensagens =============
      if (analysis) {
        const { data: messages } = await supabase
          .from('conversation_messages')
          .select('*')
          .eq('analysis_id', analysis_id)
          .order('created_at', { ascending: true });

        const userMessages = messages?.filter(m => m.role === 'user') || [];
        const aiMessages = messages?.filter(m => m.role === 'ai') || [];
        const unprocessedMessages = userMessages.filter(m =>
          m.metadata?.processed === false || m.metadata?.processed === 'false'
        );

        diagnostics.checks.messages = {
          status: messages && messages.length > 0 ? '✅ MENSAGENS ENCONTRADAS' : '❌ SEM MENSAGENS',
          total: messages?.length || 0,
          user_messages: userMessages.length,
          ai_messages: aiMessages.length,
          unprocessed_user_messages: unprocessedMessages.length,
          last_5_messages: messages?.slice(-5).map(m => ({
            id: m.id,
            role: m.role,
            content: m.content.substring(0, 50),
            created_at: m.created_at,
            processed: m.metadata?.processed,
            claimed_by: m.metadata?.claimed_by,
            next_ai_response_at: m.metadata?.next_ai_response_at
          }))
        };

        // ============= CHECK 3: Verificar unprocessed messages details =============
        if (unprocessedMessages.length > 0) {
          diagnostics.checks.unprocessed_details = {
            status: '⚠️ MENSAGENS NÃO PROCESSADAS DETECTADAS',
            count: unprocessedMessages.length,
            messages: unprocessedMessages.map(m => ({
              id: m.id,
              content: m.content.substring(0, 50),
              created_at: m.created_at,
              age_minutes: ((new Date().getTime() - new Date(m.created_at).getTime()) / 1000 / 60).toFixed(1),
              processed: m.metadata?.processed,
              claimed_by: m.metadata?.claimed_by,
              claimed_at: m.metadata?.claimed_at,
              next_ai_response_at: m.metadata?.next_ai_response_at,
              timer_delay_seconds: m.metadata?.timer_delay_seconds
            }))
          };
        } else {
          diagnostics.checks.unprocessed_details = {
            status: '✅ TODAS MENSAGENS PROCESSADAS'
          };
        }

        // ============= CHECK 4: Verificar Evolution instance matching =============
        const evolutionInstanceMale = Deno.env.get('EVOLUTION_INSTANCE_NAME');
        const evolutionInstanceFemale = Deno.env.get('EVOLUTION_INSTANCE_NAME_FEMALE');

        diagnostics.checks.evolution_instance = {
          status: '📡 CONFIGURAÇÃO EVOLUTION',
          analysis_instance: analysis.evolution_instance,
          analysis_gender: analysis.ai_gender,
          expected_instance: analysis.ai_gender === 'female' ? evolutionInstanceFemale : evolutionInstanceMale,
          male_instance: evolutionInstanceMale,
          female_instance: evolutionInstanceFemale,
          match: analysis.evolution_instance === (analysis.ai_gender === 'female' ? evolutionInstanceFemale : evolutionInstanceMale) ? '✅ MATCH' : '❌ MISMATCH'
        };

        // ============= CHECK 5: Verificar phone matching =============
        const phoneVariations = [
          analysis.target_phone,
          `55629${analysis.target_phone?.slice(4)}`,
          analysis.target_phone?.replace(/^(55\d{2})9(\d{8})$/, '$1$2'),
          analysis.target_phone?.slice(2),
          `629${analysis.target_phone?.slice(4)}`,
          analysis.target_phone?.slice(2).replace(/^(\d{2})9(\d{8})$/, '$1$2')
        ].filter((v, i, arr) => arr.indexOf(v) === i);

        diagnostics.checks.phone_variations = {
          status: '📞 VARIAÇÕES DE TELEFONE',
          target_phone: analysis.target_phone,
          variations: phoneVariations,
          total_variations: phoneVariations.length
        };

        // ============= CHECK 6: Verificar se há análises ativas com telefones similares =============
        const { data: similarAnalyses } = await supabase
          .from('analysis_requests')
          .select('id, target_phone, status, evolution_instance')
          .eq('status', 'chatting');

        const matchingAnalyses = similarAnalyses?.filter(a =>
          phoneVariations.some(v => a.target_phone?.includes(v) || v?.includes(a.target_phone))
        );

        diagnostics.checks.similar_active_analyses = {
          status: matchingAnalyses && matchingAnalyses.length > 0 ? '⚠️ MÚLTIPLAS ANÁLISES ATIVAS' : '✅ ANÁLISE ÚNICA',
          count: matchingAnalyses?.length || 0,
          analyses: matchingAnalyses?.map(a => ({
            id: a.id,
            target_phone: a.target_phone,
            evolution_instance: a.evolution_instance,
            is_current: a.id === analysis_id
          }))
        };

        // ============= CHECK 7: Verificar metadata da análise =============
        diagnostics.checks.analysis_metadata = {
          status: '📋 METADATA DA ANÁLISE',
          next_ai_response_at: analysis.metadata?.next_ai_response_at,
          next_ai_response_source: analysis.metadata?.next_ai_response_source,
          processing_lock: analysis.metadata?.processing_lock,
          conversation_stage: analysis.metadata?.conversation_stage,
          follow_ups_sent: analysis.metadata?.follow_ups_sent,
          progress: analysis.metadata?.progress
        };
      }
    }

    // ============= CHECK 8: Buscar por número de telefone =============
    if (phone_number) {
      const phoneSearch = phone_number.replace(/\D/g, '');

      const { data: analysesByPhone } = await supabase
        .from('analysis_requests')
        .select('*')
        .or(`target_phone.like.%${phoneSearch}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      diagnostics.checks.phone_search = {
        status: analysesByPhone && analysesByPhone.length > 0 ? '✅ ANÁLISES ENCONTRADAS' : '❌ NENHUMA ANÁLISE',
        search_term: phoneSearch,
        count: analysesByPhone?.length || 0,
        analyses: analysesByPhone?.map(a => ({
          id: a.id,
          status: a.status,
          target_phone: a.target_phone,
          evolution_instance: a.evolution_instance,
          created_at: a.created_at,
          started_at: a.started_at
        }))
      };
    }

    // ============= RECOMENDAÇÕES =============
    const recommendations: string[] = [];

    if (diagnostics.checks.analysis_exists?.status === '❌ NÃO ENCONTRADA') {
      recommendations.push('❌ Análise não encontrada - verifique se o ID está correto');
    }

    if (diagnostics.checks.messages?.total === 0) {
      recommendations.push('⚠️ Nenhuma mensagem encontrada - webhook pode não estar funcionando');
    }

    if (diagnostics.checks.unprocessed_details?.count > 0) {
      recommendations.push(`⚠️ ${diagnostics.checks.unprocessed_details.count} mensagens não processadas - monitor-conversations pode não estar sendo chamado`);
    }

    if (diagnostics.checks.evolution_instance?.match === '❌ MISMATCH') {
      recommendations.push('❌ Mismatch de instância Evolution - mensagens podem não estar chegando');
    }

    if (diagnostics.checks.similar_active_analyses?.count > 1) {
      recommendations.push('⚠️ Múltiplas análises ativas para o mesmo número - pode causar conflitos');
    }

    if (diagnostics.checks.messages?.user_messages > 0 && diagnostics.checks.messages?.ai_messages === 0) {
      recommendations.push('❌ CRÍTICO: Mensagens do usuário recebidas mas IA nunca respondeu - problema no monitor-conversations');
    }

    if (diagnostics.checks.messages?.ai_messages === 1 && diagnostics.checks.messages?.user_messages === 0) {
      recommendations.push('⚠️ IA enviou mensagem inicial mas usuário nunca respondeu - webhook pode não estar configurado');
    }

    diagnostics.recommendations = recommendations;

    // ============= SUMMARY =============
    diagnostics.summary = {
      analysis_found: diagnostics.checks.analysis_exists?.status === '✅ ENCONTRADA',
      messages_found: (diagnostics.checks.messages?.total || 0) > 0,
      unprocessed_messages: diagnostics.checks.unprocessed_details?.count || 0,
      likely_issue: recommendations[0] || '✅ Tudo parece estar funcionando'
    };

    return new Response(
      JSON.stringify(diagnostics, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in diagnose-conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
