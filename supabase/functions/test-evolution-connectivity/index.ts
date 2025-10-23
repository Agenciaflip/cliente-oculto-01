import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, instance = 'clienteoculto-mulher', message = 'Teste de conectividade' } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Testando conectividade para: ${phone} na instância: ${instance}`);

    // Selecionar credenciais baseado na instância
    const evolutionUrl = instance === 'clienteoculto-mulher'
      ? Deno.env.get('EVOLUTION_API_URL_FEMALE')
      : Deno.env.get('EVOLUTION_API_URL');

    const evolutionKey = instance === 'clienteoculto-mulher'
      ? Deno.env.get('EVOLUTION_API_KEY_FEMALE')
      : Deno.env.get('EVOLUTION_API_KEY');

    const evolutionInstance = instance === 'clienteoculto-mulher'
      ? Deno.env.get('EVOLUTION_INSTANCE_NAME_FEMALE')
      : Deno.env.get('EVOLUTION_INSTANCE_NAME');

    const results: any = {
      phone,
      instance,
      evolutionUrl,
      evolutionInstance,
      tests: []
    };

    // Normalizar número de telefone
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneVariations = [
      `55${cleanPhone}`,
      `${cleanPhone}`,
      cleanPhone.startsWith('55') ? cleanPhone.slice(2) : cleanPhone,
    ];

    console.log(`📱 Variações de telefone a testar:`, phoneVariations);

    // Teste 1: Verificar status da instância
    console.log(`\n🔍 TESTE 1: Verificando status da instância ${evolutionInstance}`);
    try {
      const statusResponse = await fetch(
        `${evolutionUrl}/instance/connectionState/${evolutionInstance}`,
        {
          method: 'GET',
          headers: {
            'apikey': evolutionKey || '',
          },
        }
      );

      const statusData = await statusResponse.json();
      results.tests.push({
        name: 'Instance Status',
        success: statusResponse.ok,
        status: statusResponse.status,
        data: statusData
      });

      console.log(`✅ Status da instância:`, statusData);
    } catch (error) {
      console.error(`❌ Erro ao verificar status:`, error);
      results.tests.push({
        name: 'Instance Status',
        success: false,
        error: error.message
      });
    }

    // Teste 2: Tentar enviar mensagem com cada variação
    for (const phoneVariation of phoneVariations) {
      console.log(`\n🔍 TESTE 2: Testando envio para variação: ${phoneVariation}`);
      
      try {
        const sendResponse = await fetch(
          `${evolutionUrl}/message/sendText/${evolutionInstance}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionKey || '',
            },
            body: JSON.stringify({
              number: `${phoneVariation}@s.whatsapp.net`,
              text: message,
            }),
          }
        );

        const sendData = await sendResponse.json();
        
        results.tests.push({
          name: `Send Message (${phoneVariation})`,
          success: sendResponse.ok,
          status: sendResponse.status,
          phoneVariation,
          data: sendData
        });

        if (sendResponse.ok) {
          console.log(`✅ Mensagem enviada com sucesso para ${phoneVariation}:`, sendData);
        } else {
          console.log(`❌ Falha ao enviar para ${phoneVariation}:`, sendData);
        }
      } catch (error) {
        console.error(`❌ Erro ao enviar para ${phoneVariation}:`, error);
        results.tests.push({
          name: `Send Message (${phoneVariation})`,
          success: false,
          phoneVariation,
          error: error.message
        });
      }
    }

    // Teste 3: Verificar webhook configurado
    console.log(`\n🔍 TESTE 3: Verificando webhook configurado`);
    try {
      const webhookResponse = await fetch(
        `${evolutionUrl}/webhook/find/${evolutionInstance}`,
        {
          method: 'GET',
          headers: {
            'apikey': evolutionKey || '',
          },
        }
      );

      const webhookData = await webhookResponse.json();
      results.tests.push({
        name: 'Webhook Configuration',
        success: webhookResponse.ok,
        status: webhookResponse.status,
        data: webhookData
      });

      console.log(`✅ Configuração do webhook:`, webhookData);
    } catch (error) {
      console.error(`❌ Erro ao verificar webhook:`, error);
      results.tests.push({
        name: 'Webhook Configuration',
        success: false,
        error: error.message
      });
    }

    // Resumo
    const successfulTests = results.tests.filter((t: any) => t.success).length;
    const totalTests = results.tests.length;
    
    results.summary = {
      total: totalTests,
      successful: successfulTests,
      failed: totalTests - successfulTests,
      allPassed: successfulTests === totalTests
    };

    console.log(`\n📊 RESUMO: ${successfulTests}/${totalTests} testes passaram`);

    return new Response(
      JSON.stringify(results, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
