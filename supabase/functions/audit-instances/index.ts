import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    console.log('🔍 Iniciando auditoria de instâncias...');

    // Buscar análises em chatting
    const { data: analyses, error } = await supabase
      .from('analysis_requests')
      .select('id, evolution_instance, ai_gender, metadata, created_at')
      .eq('status', 'chatting');

    if (error) {
      console.error('Erro ao buscar análises:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const mismatches = [];
    const instanceChanges = [];

    for (const analysis of analyses || []) {
      // Verificar se instância bate com o gênero esperado
      const expectedInstance = analysis.ai_gender === 'female' 
        ? 'clienteoculto-mulher' 
        : 'clienteoculto-homem';

      if (analysis.evolution_instance !== expectedInstance) {
        mismatches.push({
          analysis_id: analysis.id,
          current_instance: analysis.evolution_instance,
          expected_instance: expectedInstance,
          ai_gender: analysis.ai_gender
        });
        console.warn(`⚠️ MISMATCH: analysis ${analysis.id} - esperado ${expectedInstance}, atual ${analysis.evolution_instance}`);
      }

      // Verificar se já houve troca de instância
      if (analysis.metadata?.instance_changed) {
        instanceChanges.push({
          analysis_id: analysis.id,
          original_instance: analysis.metadata.original_instance,
          new_instance: analysis.metadata.new_instance,
          changed_at: analysis.metadata.changed_at
        });
        console.warn(`🔄 TROCA DETECTADA: analysis ${analysis.id} - de ${analysis.metadata.original_instance} para ${analysis.metadata.new_instance}`);
      }
    }

    const result = {
      timestamp: new Date().toISOString(),
      total_analyses: analyses?.length || 0,
      mismatches: mismatches.length,
      instance_changes: instanceChanges.length,
      details: {
        mismatches,
        instanceChanges
      }
    };

    console.log('✅ Auditoria concluída:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na auditoria:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
