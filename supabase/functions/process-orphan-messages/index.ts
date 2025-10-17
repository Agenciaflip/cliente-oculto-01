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

    // Buscar mensagens de usuário não processadas há mais de 30 segundos
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

    const { data: orphanMessages } = await supabase
      .from('conversation_messages')
      .select(`
        *,
        analysis_requests!inner(*)
      `)
      .eq('role', 'user')
      .eq('metadata->>processed', 'false')
      .eq('analysis_requests.status', 'chatting')
      .lt('created_at', thirtySecondsAgo)
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
      console.log(`🔄 Reprocessando ${messagesForAnalysis.length} mensagens órfãs para análise ${analysisId}`);

      try {
        // Invocar monitor-conversations para reprocessar
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
