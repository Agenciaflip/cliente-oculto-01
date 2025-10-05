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

    const payload = await req.json();
    console.log('Received webhook:', JSON.stringify(payload, null, 2));

    // Validar que é do nosso instance
    if (payload.instance !== evolutionInstance) {
      console.log('Webhook from different instance, ignoring');
      return new Response(
        JSON.stringify({ message: 'Ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair dados da mensagem
    const messageData = payload.data;
    const fromMe = messageData.key?.fromMe;
    
    // Ignorar mensagens enviadas por nós
    if (fromMe) {
      console.log('Ignoring message sent by us');
      return new Response(
        JSON.stringify({ message: 'Ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const remoteJid = messageData.key?.remoteJid;
    const phoneNumber = remoteJid?.replace('@s.whatsapp.net', '');
    const messageText = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text || '';

    // Validar mensagem válida do cliente
    const isValidMessage = phoneNumber && 
                          messageText && 
                          messageText.trim().length > 0;

    if (!isValidMessage) {
      console.log('Missing phone or message text, or empty message');
      return new Response(
        JSON.stringify({ message: 'Invalid payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Mensagem válida recebida de ${phoneNumber}: ${messageText}`);

    // Criar variações do número para buscar análise ativa
    const phoneVariations = [
      phoneNumber,                           // Ex: 556283071325
      `55629${phoneNumber.slice(4)}`,       // Ex: 5562983071325 (adiciona 9)
      phoneNumber.slice(2),                  // Ex: 6283071325 (remove 55)
      `629${phoneNumber.slice(4)}`          // Ex: 62983071325 (remove 55 + adiciona 9)
    ];
    
    console.log(`🔍 Buscando análise para variações: ${phoneVariations.join(', ')}`);

    // Buscar análise ativa com múltiplas variações do número
    const { data: activeAnalyses } = await supabase
      .from('analysis_requests')
      .select('*')
      .eq('status', 'chatting')
      .or(phoneVariations.map(v => `target_phone.like.%${v}%`).join(','));
    
    const activeAnalysis = activeAnalyses?.[0];

    if (!activeAnalysis) {
      console.log(`❌ Nenhuma análise ativa encontrada para: ${phoneVariations.join(', ')}`);
      return new Response(
        JSON.stringify({ message: 'No active analysis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`✅ Análise encontrada: ${activeAnalysis.id} (target_phone: ${activeAnalysis.target_phone})`);

    console.log(`Found active analysis: ${activeAnalysis.id}`);

    // Salvar mensagem do usuário com flag processed: false
    await supabase.from('conversation_messages').insert({
      analysis_id: activeAnalysis.id,
      role: 'user',
      content: messageText,
      metadata: { 
        processed: false,
        timestamp: new Date().toISOString() 
      }
    });

    // Atualizar timestamp da última mensagem
    await supabase
      .from('analysis_requests')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', activeAnalysis.id);

    console.log(`💾 Mensagem salva com processed: false`);

    // ✅ SEMPRE invocar monitor após salvar mensagem do cliente
    console.log(`🔔 Invocando monitor-conversations para analysis_id: ${activeAnalysis.id}`);
    
    try {
      const monitorResponse = await fetch(
        `${supabaseUrl}/functions/v1/monitor-conversations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ analysis_id: activeAnalysis.id })
        }
      );

      if (!monitorResponse.ok) {
        console.error(`⚠️ Erro ao invocar monitor: ${monitorResponse.status}`);
      } else {
        console.log(`✅ Monitor invocado com sucesso`);
      }
    } catch (monitorError) {
      console.error('⚠️ Erro ao invocar monitor:', monitorError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Message saved and monitor triggered'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in handle-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
