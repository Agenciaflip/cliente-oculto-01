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

    console.log('🔍 Buscando mensagens órfãs...');

    // Buscar mensagens órfãs: não processadas OU claimed há mais de 2 minutos
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();

    const { data: orphanMessages } = await supabase
      .from('conversation_messages')
      .select(`
        *,
        analysis_requests!inner(*)
      `)
      .eq('role', 'user')
      .eq('metadata->>processed', 'false')
      .eq('analysis_requests.status', 'chatting')
      .or(`created_at.lt.${thirtySecondsAgo},metadata->>claimed_at.lt.${twoMinutesAgo}`)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!orphanMessages || orphanMessages.length === 0) {
      console.log('✅ Nenhuma mensagem órfã encontrada');
      return new Response(
        JSON.stringify({ message: 'No orphan messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`⚠️ Encontradas ${orphanMessages.length} mensagens órfãs`);

    // Agrupar por analysis_id para evitar múltiplas chamadas para a mesma análise
    const analysisIds = [...new Set(orphanMessages.map((m: any) => m.analysis_id))];

    const results = [];
    for (const analysisId of analysisIds) {
      const messagesForAnalysis = orphanMessages.filter((m: any) => m.analysis_id === analysisId);
      console.log(`🔄 Verificando ${messagesForAnalysis.length} mensagens órfãs para análise ${analysisId}`);

      try {
        // 🔍 VERIFICAR: Conversa tem lock ativo, cooldown ou janela de agrupamento?
        const { data: analysisCheck } = await supabase
          .from('analysis_requests')
          .select('metadata')
          .eq('id', analysisId)
          .single();
        
        if (analysisCheck?.metadata) {
          const metadata = analysisCheck.metadata;
          const now = new Date();
          
          // Verificar lock ativo
          if (metadata.processing_lock) {
            const lockUntil = new Date(metadata.processing_lock.until);
            if (lockUntil > now) {
              console.log(`🔒 [${analysisId}] Conversa está sendo processada (lock até ${metadata.processing_lock.until}). Pulando.`);
              results.push({ analysis_id: analysisId, success: false, error: 'conversation_locked' });
              continue;
            }
          }
          
          // Verificar cooldown (último monitor foi há menos de 30s)
          if (metadata.last_monitor_at) {
            const lastMonitorAt = new Date(metadata.last_monitor_at);
            const cooldownMs = 30000; // 30s
            if (now.getTime() - lastMonitorAt.getTime() < cooldownMs) {
              console.log(`⏰ [${analysisId}] Monitor executado há ${((now.getTime() - lastMonitorAt.getTime())/1000).toFixed(0)}s. Aguardando cooldown. Pulando.`);
              results.push({ analysis_id: analysisId, success: false, error: 'cooldown_active' });
              continue;
            }
          }
        }
        
        // Verificar next_ai_response_at ativo
        const { data: activeWindow } = await supabase
          .from('conversation_messages')
          .select('metadata')
          .eq('analysis_id', analysisId)
          .not('metadata->>next_ai_response_at', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (activeWindow && activeWindow.length > 0) {
          const nextResponse = activeWindow[0].metadata?.next_ai_response_at;
          if (nextResponse && new Date(nextResponse) > new Date()) {
            console.log(`⏳ [${analysisId}] Janela de agrupamento ativa até ${nextResponse}. Pulando.`);
            results.push({ analysis_id: analysisId, success: false, error: 'grouping_window_active' });
            continue;
          }
        }
        
        // ✅ Tudo OK, invocar monitor-conversations
        const { error } = await supabase.functions.invoke('monitor-conversations', {
          body: { analysis_id: analysisId }
        });

        if (error) {
          console.error(`❌ Erro ao reprocessar análise ${analysisId}:`, error);
          results.push({ analysis_id: analysisId, success: false, error: error.message });
        } else {
          console.log(`✅ Monitor-conversations invocado para análise ${analysisId}`);
          results.push({ analysis_id: analysisId, success: true });
        }
      } catch (error) {
        console.error(`❌ Exceção ao reprocessar análise ${analysisId}:`, error);
        results.push({ 
          analysis_id: analysisId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Reprocessamento concluído: ${successful} sucesso, ${failed} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true,
        orphan_messages: orphanMessages.length,
        analyses_reprocessed: analysisIds.length,
        successful,
        failed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-orphan-messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
