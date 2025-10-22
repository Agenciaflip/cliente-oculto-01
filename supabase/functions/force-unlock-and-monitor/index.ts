import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingLock {
  run_id?: string;
  started_at?: string;
  until?: string;
}

function isExpiredLock(lock?: ProcessingLock | null) {
  if (!lock?.until) return true;
  const until = new Date(lock.until).getTime();
  return isNaN(until) || until <= Date.now();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { analysis_id } = await req.json();
    if (!analysis_id) {
      return new Response(JSON.stringify({ error: 'analysis_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔧 [${analysis_id}] Forçando unlock e disparo do monitor...`);

    const { data: analysis, error: fetchErr } = await supabase
      .from('analysis_requests')
      .select('*')
      .eq('id', analysis_id)
      .single();

    if (fetchErr || !analysis) {
      console.error('❌ Erro ao buscar análise:', fetchErr);
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metadata = (analysis.metadata || {}) as Record<string, any>;
    const lock: ProcessingLock | null = (metadata.processing_lock as ProcessingLock) || null;

    const nowIso = new Date().toISOString();
    let updatedMeta = { ...metadata } as Record<string, any>;

    // Se não há lock ou está expirado, limpar
    let unlocked = false;
    if (!lock || isExpiredLock(lock)) {
      updatedMeta.processing_lock = null;
      unlocked = true;
      console.log(`🔓 [${analysis_id}] Lock ausente/expirado. Limpando.`);
    }

    // Sempre semear uma próxima janela de resposta curta para o timer aparecer
    const seconds = 30 + Math.floor(Math.random() * 60); // 30–90s
    const nextDate = new Date(Date.now() + seconds * 1000);
    updatedMeta.next_ai_response_at = nextDate.toISOString();
    updatedMeta.next_ai_response_source = 'forced_unlock';
    updatedMeta.next_ai_response_set_at = nowIso;

    const { error: updateErr } = await supabase
      .from('analysis_requests')
      .update({ metadata: updatedMeta })
      .eq('id', analysis_id);

    if (updateErr) {
      console.error('❌ Erro ao atualizar metadata:', updateErr);
      return new Response(JSON.stringify({ error: 'Failed to update analysis metadata' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`⏱️ [${analysis_id}] next_ai_response_at=${updatedMeta.next_ai_response_at}`);

    // Disparar o monitor específico desta análise
    const { data: monitorData, error: monitorErr } = await supabase.functions.invoke('monitor-conversations', {
      body: { analysis_id },
    });

    if (monitorErr) {
      console.error('⚠️ Erro ao invocar monitor-conversations:', monitorErr);
    } else {
      console.log('🟢 monitor-conversations invocado com sucesso:', monitorData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        unlocked,
        next_ai_response_at: updatedMeta.next_ai_response_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ force-unlock-and-monitor error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
