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
    const evolutionInstanceFemale = Deno.env.get('EVOLUTION_INSTANCE_NAME_FEMALE');

    const payload = await req.json();
    console.log('Received webhook:', JSON.stringify(payload, null, 2));

    // Identificar instância do webhook
    const webhookInstance = payload.instance;

    // Validar que é de uma das nossas instâncias (masculina OU feminina)
    const validInstances = [evolutionInstance, evolutionInstanceFemale].filter(Boolean);
    if (!validInstances.includes(webhookInstance)) {
      console.log(`Webhook from different instance (${webhookInstance}), ignoring. Valid: ${validInstances.join(', ')}`);
      return new Response(
        JSON.stringify({ message: 'Ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Webhook aceito da instância: ${webhookInstance}`);

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

    console.log(`🔍 Webhook recebido:`, {
      instance: webhookInstance,
      phone: phoneNumber,
      messagePreview: messageText.substring(0, 30)
    });

    // Criar variações ROBUSTAS do número (adiciona E remove o 9)
    const phoneVariations = [
      phoneNumber,                                    // Original: 556283071325
      `55629${phoneNumber.slice(4)}`,                // Adiciona 9: 5562983071325
      phoneNumber.replace(/^(55\d{2})9(\d{8})$/, '$1$2'), // Remove 9 se tiver: 556283071325
      phoneNumber.slice(2),                          // Remove DDI: 6283071325
      `629${phoneNumber.slice(4)}`,                  // Remove DDI + adiciona 9: 62983071325
      phoneNumber.slice(2).replace(/^(\d{2})9(\d{8})$/, '$1$2') // Remove DDI e 9: 6283071325
    ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicatas
    
    console.log(`🔎 Buscando análise para:`, {
      instance: webhookInstance,
      phoneVariations: phoneVariations
    });

    // Buscar análise ativa filtrando por instância E telefone
    const { data: activeAnalyses } = await supabase
      .from('analysis_requests')
      .select('*')
      .eq('status', 'chatting')
      .eq('evolution_instance', webhookInstance) // 🔥 FILTRO CRÍTICO
      .or(phoneVariations.map(v => `target_phone.like.%${v}%`).join(','));
    
    const activeAnalysis = activeAnalyses?.[0];

    if (!activeAnalysis) {
      console.log(`❌ Nenhuma análise ativa encontrada para instância ${webhookInstance} com telefone ${phoneNumber}`);
      console.log(`📊 Variações testadas: ${phoneVariations.join(', ')}`);
      return new Response(
        JSON.stringify({ message: 'No active analysis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`✅ Análise encontrada:`, {
      id: activeAnalysis.id,
      ai_gender: activeAnalysis.ai_gender,
      evolution_instance: activeAnalysis.evolution_instance,
      target_phone: activeAnalysis.target_phone
    });

    // Validação de consistência
    if (activeAnalysis.ai_gender === 'female' && 
        activeAnalysis.evolution_instance !== 'clienteoculto-mulher') {
      console.error(`⚠️ INCONSISTÊNCIA: Análise ${activeAnalysis.id} tem ai_gender=female mas evolution_instance=${activeAnalysis.evolution_instance}`);
    }

    // Salvar mensagem do usuário com flag processed: false
    const { error: insertError } = await supabase.from('conversation_messages').insert({
      analysis_id: activeAnalysis.id,
      role: 'user',
      content: messageText,
      metadata: { 
        processed: false,
        timestamp: new Date().toISOString() 
      }
    });

    if (insertError) {
      console.error('❌ Erro ao salvar mensagem:', insertError);
      throw insertError;
    }

    console.log(`✅ Mensagem salva para análise ${activeAnalysis.id}:`, {
      role: 'user',
      content: messageText.substring(0, 50) + '...',
      processed: false
    });

    // Atualizar timestamp da última mensagem
    const { error: updateError } = await supabase
      .from('analysis_requests')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', activeAnalysis.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar last_message_at:', updateError);
    } else {
      console.log(`✅ last_message_at atualizado para ${activeAnalysis.id}`);
    }

    // Monitor será invocado via gatilho do banco (trigger). Evitando chamadas duplicadas aqui.


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
