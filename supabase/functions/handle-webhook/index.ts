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

    if (!phoneNumber || !messageText) {
      console.log('Missing phone or message text');
      return new Response(
        JSON.stringify({ message: 'Invalid payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Received message from ${phoneNumber}: ${messageText}`);

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

    // Salvar mensagem do usuário
    await supabase.from('conversation_messages').insert({
      analysis_id: activeAnalysis.id,
      role: 'user',
      content: messageText,
      metadata: { timestamp: new Date().toISOString() }
    });

    // Atualizar timestamp da última mensagem
    await supabase
      .from('analysis_requests')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', activeAnalysis.id);

    // Buscar histórico de mensagens
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('analysis_id', activeAnalysis.id)
      .order('created_at', { ascending: true });

    // Buscar estratégia de perguntas
    const questionsStrategy = activeAnalysis.questions_strategy;
    const currentQuestionIndex = messages?.filter(m => m.role === 'ai').length || 0;
    const totalQuestions = questionsStrategy?.questions?.length || 0;

    console.log(`Current question: ${currentQuestionIndex}/${totalQuestions}`);

    // Verificar se ainda há perguntas
    if (currentQuestionIndex >= totalQuestions) {
      console.log('All questions answered, generating metrics...');
      
      // Atualizar status para processing
      await supabase
        .from('analysis_requests')
        .update({ status: 'processing' })
        .eq('id', activeAnalysis.id);

      // Chamar geração de métricas
      await supabase.functions.invoke('generate-metrics', {
        body: { analysis_id: activeAnalysis.id }
      });

      return new Response(
        JSON.stringify({ message: 'Conversation completed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analisar resposta e decidir próxima pergunta com IA
    const nextQuestion = questionsStrategy.questions[currentQuestionIndex];
    
    // Usar IA para adaptar a próxima pergunta baseado no contexto
    const conversationHistory = messages?.map(m => 
      `${m.role === 'ai' ? 'Cliente Oculto' : 'Empresa'}: ${m.content}`
    ).join('\n');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Você é um cliente oculto avaliando o atendimento de uma empresa. 
Mantenha naturalidade na conversa e adapte a próxima pergunta ao contexto da resposta anterior.`
          },
          {
            role: 'user',
            content: `CONVERSA ATÉ AGORA:
${conversationHistory}

PRÓXIMA PERGUNTA PLANEJADA:
${nextQuestion.question}

OBJETIVO: ${nextQuestion.expected_info}

Adapte a próxima pergunta para que ela flua naturalmente após a resposta que acabamos de receber. 
Se a resposta já cobriu parte do objetivo, ajuste a pergunta. Mantenha o tom ${activeAnalysis.persona}.
Seja direto e natural, sem rodeios.`
          }
        ],
        max_completion_tokens: 200,
      }),
    });

    const aiData = await aiResponse.json();
    const adaptedQuestion = aiData.choices[0].message.content.trim();

    console.log(`Adapted question: ${adaptedQuestion}`);

    // Enviar próxima pergunta via Evolution
    const evolutionPayload = {
      number: phoneNumber,
      text: adaptedQuestion
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

    // Salvar mensagem da AI
    await supabase.from('conversation_messages').insert({
      analysis_id: activeAnalysis.id,
      role: 'ai',
      content: adaptedQuestion,
      metadata: { 
        order: currentQuestionIndex + 1,
        expected_info: nextQuestion.expected_info,
        original_question: nextQuestion.question
      }
    });

    // Atualizar timestamp
    await supabase
      .from('analysis_requests')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', activeAnalysis.id);

    console.log('Next question sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        next_question: adaptedQuestion,
        progress: `${currentQuestionIndex + 1}/${totalQuestions}`
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
