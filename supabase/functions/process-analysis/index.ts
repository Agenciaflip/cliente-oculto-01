import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPersonaPrompt } from "../_shared/prompts/personas.ts";

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

    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    
    // Carregar credenciais Evolution API padrão (male/neutral)
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    
    // Carregar credenciais Evolution API feminina
    const evolutionUrlFemale = Deno.env.get('EVOLUTION_API_URL_FEMALE');
    const evolutionKeyFemale = Deno.env.get('EVOLUTION_API_KEY_FEMALE');
    const evolutionInstanceFemale = Deno.env.get('EVOLUTION_INSTANCE_NAME_FEMALE');

    const { action } = await req.json().catch(() => ({}));

    // Se ação for finalizar conversas inativas
    if (action === 'finalize_inactive') {
      const { data: inactiveChats } = await supabase
        .from('analysis_requests')
        .select('*')
        .eq('status', 'chatting')
        .lt('last_message_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

      console.log(`Found ${inactiveChats?.length || 0} inactive chats`);

      for (const chat of inactiveChats || []) {
        await supabase.functions.invoke('generate-metrics', {
          body: { analysis_id: chat.id }
        });
      }

      return new Response(
        JSON.stringify({ processed: inactiveChats?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PROCESSAMENTO PARALELO: pegar até 5 análises pendentes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    
    const { data: pendingAnalyses } = await supabase
      .from('analysis_requests')
      .select('*')
      .eq('status', 'pending')
      .or(`processing_started_at.is.null,processing_started_at.lt.${twoMinutesAgo}`)
      .or(`scheduled_start_at.is.null,scheduled_start_at.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(5);

    if (!pendingAnalyses || pendingAnalyses.length === 0) {
      console.log('No pending analyses found');
      return new Response(
        JSON.stringify({ message: 'No pending analyses' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Processando ${pendingAnalyses.length} análises simultâneas`);
    console.log(`📋 IDs: ${pendingAnalyses.map(a => a.id).join(', ')}`);
    console.log(`⏱️ Iniciado às ${new Date().toISOString()}`);

    // Marcar todas como 'processing' com lock otimista
    const analysisIds = pendingAnalyses.map(a => a.id);
    await supabase
      .from('analysis_requests')
      .update({ 
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .in('id', analysisIds);

    // Processar cada análise em paralelo
    const results = await Promise.allSettled(
      pendingAnalyses.map(analysis => processAnalysis(
        analysis, 
        supabase, 
        perplexityKey, 
        openAIKey, 
        evolutionUrl, 
        evolutionKey, 
        evolutionInstance,
        evolutionUrlFemale,
        evolutionKeyFemale,
        evolutionInstanceFemale
      ))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Concluído: ${successful} sucesso, ${failed} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: pendingAnalyses.length,
        successful,
        failed,
        results: results.map((r, i) => ({
          id: pendingAnalyses[i].id,
          status: r.status,
          ...(r.status === 'rejected' ? { error: r.reason } : {})
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============= FUNÇÃO AUXILIAR: SELECIONAR EVOLUTION CREDENTIALS =============
function getEvolutionCredentials(
  aiGender: string,
  evolutionUrl: string | undefined,
  evolutionKey: string | undefined,
  evolutionInstance: string | undefined,
  evolutionUrlFemale: string | undefined,
  evolutionKeyFemale: string | undefined,
  evolutionInstanceFemale: string | undefined
) {
  if (aiGender === 'female') {
    return {
      url: evolutionUrlFemale,
      key: evolutionKeyFemale,
      instance: evolutionInstanceFemale
    };
  }
  
  // Padrão: male ou neutral
  return {
    url: evolutionUrl,
    key: evolutionKey,
    instance: evolutionInstance
  };
}

// FUNÇÃO AUXILIAR PARA PROCESSAR CADA ANÁLISE
async function processAnalysis(
  pendingAnalysis: any,
  supabase: any,
  perplexityKey: string | undefined,
  openAIKey: string | undefined,
  evolutionUrl: string | undefined,
  evolutionKey: string | undefined,
  evolutionInstance: string | undefined,
  evolutionUrlFemale: string | undefined,
  evolutionKeyFemale: string | undefined,
  evolutionInstanceFemale: string | undefined
) {
  // Selecionar credenciais Evolution baseadas no ai_gender
  const evoCredentials = getEvolutionCredentials(
    pendingAnalysis.ai_gender || 'male',
    evolutionUrl,
    evolutionKey,
    evolutionInstance,
    evolutionUrlFemale,
    evolutionKeyFemale,
    evolutionInstanceFemale
  );
  
  const actualEvolutionUrl = evoCredentials.url!;
  const actualEvolutionKey = evoCredentials.key!;
  const actualEvolutionInstance = evoCredentials.instance!;
  
  console.log(`🔧 [${pendingAnalysis.id}] Usando Evolution ${pendingAnalysis.ai_gender === 'female' ? 'FEMININA (clienteoculto-mulher)' : 'MASCULINA (felipedisparo)'}`);

  try {
    console.log(`🔄 [${pendingAnalysis.id}] Iniciando processamento para ${pendingAnalysis.target_phone}`);

    // ETAPA 1: Pesquisar empresa no Perplexity (se necessário)
    let companyInfo = pendingAnalysis.research_data;
    if (!companyInfo && perplexityKey) {
      console.log(`🔍 [${pendingAnalysis.id}] Pesquisando empresa no Perplexity...`);
      
      // Atualizar processing_stage para 'researching'
      await supabase
        .from('analysis_requests')
        .update({ processing_stage: 'researching' })
        .eq('id', pendingAnalysis.id);
      
      // Construir prompt melhorado com contexto completo
      const perplexityPrompt = `Pesquise informações ESPECÍFICAS sobre esta empresa:

📍 IDENTIFICAÇÃO:
- Nome: ${pendingAnalysis.company_name || 'não informado'}
- CNPJ: ${pendingAnalysis.cnpj || 'não informado'}
- Cidade: ${pendingAnalysis.city || 'não informado'}
- Segmento: ${pendingAnalysis.business_segment || 'não informado'}
- Telefone WhatsApp: ${pendingAnalysis.target_phone}

🎯 OBJETIVO:
Encontrar ESPECIFICAMENTE essa empresa na cidade ${pendingAnalysis.city || 'informada'}.
Confirme se o telefone ${pendingAnalysis.target_phone} pertence a essa empresa.

📊 INFORMAÇÕES NECESSÁRIAS:
1. Endereço completo (rua, bairro, cidade)
2. Principais produtos/serviços oferecidos
3. Diferenciais e pontos fortes
4. Público-alvo
5. Reputação online (avaliações, comentários)
6. Confirmar se o telefone está vinculado à empresa

⚠️ IMPORTANTE: 
- Seja específico e factual
- Se não encontrar informações, seja honesto
- Priorize dados recentes e verificáveis`;
      
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'Você é um pesquisador especializado em análise de empresas brasileiras. Seja preciso, conciso e objetivo.'
            },
            {
              role: 'user',
              content: perplexityPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 600,
        }),
      });

      if (perplexityResponse.ok) {
        const perplexityData = await perplexityResponse.json();
        companyInfo = {
          summary: perplexityData.choices[0].message.content,
          researched_at: new Date().toISOString(),
          city: pendingAnalysis.city,
          segment: pendingAnalysis.business_segment,
          cnpj: pendingAnalysis.cnpj
        };

        console.log(`✅ [${pendingAnalysis.id}] Pesquisa Perplexity concluída com sucesso`);
        console.log(`📄 [${pendingAnalysis.id}] Resumo: ${companyInfo.summary.substring(0, 200)}...`);

        // Atualizar com dados da pesquisa e mudar para 'generating_strategy'
        await supabase
          .from('analysis_requests')
          .update({ 
            research_data: companyInfo,
            status: 'researching',
            processing_stage: 'generating_strategy'
          })
          .eq('id', pendingAnalysis.id);
      } else {
        const errorStatus = perplexityResponse.status;
        const errorText = await perplexityResponse.text();
        console.error(`❌ [${pendingAnalysis.id}] Perplexity falhou - Status: ${errorStatus}`);
        console.error(`❌ [${pendingAnalysis.id}] Erro: ${errorText.substring(0, 300)}`);
        
        // Persistir erro para auditoria
        companyInfo = {
          error: `Perplexity API failed with status ${errorStatus}`,
          error_details: errorText.substring(0, 500),
          attempted_at: new Date().toISOString()
        };
        
        await supabase
          .from('analysis_requests')
          .update({ 
            research_data: companyInfo,
            processing_stage: 'generating_strategy'
          })
          .eq('id', pendingAnalysis.id);
      }
    }

    // ETAPA 2: Gerar estratégia de perguntas com OpenAI
    console.log(`🧠 [${pendingAnalysis.id}] Gerando estratégia com OpenAI (gpt-4o)...`);

    // FASE 3: Configurações atualizadas com novos perfis e profundidades
    const personaDescriptions = {
      ideal_client: {
        name: 'Cliente Ideal',
        behavior: 'Você é um CLIENTE IDEAL - altamente interessado. Demonstre entusiasmo genuíno, faça perguntas específicas e relevantes, mostre conhecimento prévio e sinalize forte intenção de compra. Seja receptivo e engajado.'
      },
      curious_client: {
        name: 'Cliente Curioso',
        behavior: 'Você é um CLIENTE CURIOSO em fase de descoberta. Faça perguntas gerais, demonstre curiosidade sem urgência, compare com outras opções sem citar concorrentes diretamente. Não sinalize forte intenção de compra imediata.'
      },
      difficult_client: {
        name: 'Cliente Difícil',
        behavior: 'Você é um CLIENTE DIFÍCIL e cético. Questione preços, condições, benefícios. Apresente objeções sobre prazo e custo-benefício. Peça justificativas detalhadas. Teste conhecimento e paciência do vendedor, mas mantenha interesse suficiente.'
      },
      // Manter antigos para compatibilidade
      interested: { name: 'Interessado', behavior: 'um cliente interessado e curioso, que faz perguntas naturais sobre os serviços' },
      skeptical: { name: 'Cético', behavior: 'um cliente cético que questiona detalhes, preços e compara com concorrentes' },
      urgent: { name: 'Urgente', behavior: 'um cliente com urgência que precisa de resposta rápida e soluções imediatas' },
      price_focused: { name: 'Focado em Preço', behavior: 'um cliente focado em preço e custo-benefício' },
      researcher: { name: 'Pesquisador', behavior: 'um cliente que está pesquisando detalhadamente antes de decidir' }
    };

    const depthConfig = {
      quick: { 
        numQuestions: 4, 
        description: 'análise rápida com perguntas essenciais',
        maxDuration: 30 * 60 * 1000, // 30 minutos
        maxInteractions: 5,
      },
      intermediate: { 
        numQuestions: 7, 
        description: 'análise intermediária com follow-ups',
        maxDuration: 24 * 60 * 60 * 1000, // 24 horas
        maxInteractions: 10,
      },
      deep: { 
        numQuestions: 12, 
        description: 'análise profunda com persistência',
        maxDuration: 5 * 24 * 60 * 60 * 1000, // 5 dias
        maxInteractions: 15,
      }
    };

    // Obter prompt completo da persona baseado no ai_gender
    const basePersonaPrompt = getPersonaPrompt(pendingAnalysis.ai_gender || 'male');
    
    const aiGenderNames = {
      male: ['Bruno', 'Carlos', 'Diego', 'Felipe', 'Gabriel', 'Lucas', 'Matheus', 'Rafael', 'Rodrigo', 'Thiago'],
      female: ['Ana', 'Beatriz', 'Camila', 'Daniela', 'Fernanda', 'Juliana', 'Marina', 'Paula', 'Renata', 'Sofia'],
      neutral: ['Alex', 'Morgan', 'Taylor', 'Jordan', 'Sam', 'Chris', 'Pat', 'Rio', 'Sky']
    };

    const config = depthConfig[pendingAnalysis.analysis_depth as keyof typeof depthConfig] || depthConfig.quick;
    
    // Selecionar nome baseado no gênero
    const aiGender = pendingAnalysis.ai_gender || 'neutral';
    const aiName = aiGenderNames[aiGender as keyof typeof aiGenderNames][
      Math.floor(Math.random() * aiGenderNames[aiGender as keyof typeof aiGenderNames].length)
    ];

    const strategyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.8,
        messages: [
          {
            role: 'system',
            content: `${basePersonaPrompt}

CONTEXTO DO CONCORRENTE:
${pendingAnalysis.competitor_description || 'Informação não fornecida'}
${pendingAnalysis.competitor_url ? `Site: ${pendingAnalysis.competitor_url}` : ''}

INFORMAÇÕES ADICIONAIS:
${companyInfo?.summary || 'Nenhuma pesquisa adicional realizada'}

SEU PERFIL:
${(personaDescriptions[pendingAnalysis.persona as keyof typeof personaDescriptions] || personaDescriptions.ideal_client).behavior}

${pendingAnalysis.investigation_goals ? `
OBJETIVOS ESPECÍFICOS:
Durante a conversa, descubra naturalmente:
${pendingAnalysis.investigation_goals}
` : ''}

Você é um especialista em criar conversas ULTRA NATURAIS de cliente oculto via WhatsApp.

MODELO SSR++ V3.0 - REGRAS CRÍTICAS:
- A primeira mensagem DEVE parecer 100% humana e brasileira
- Use linguagem coloquial: "vcs", "pra", "tá", "to", "né"
- Quebrar mensagens longas em múltiplas curtas (separadas por \\n)
- Variar estruturas (NUNCA iguais)
- Tom amigável, curioso, levemente informal

CATEGORIAS ESSENCIAIS DE PERGUNTAS:
1. Produto/Serviço (como funciona, confiabilidade)
2. Preços (valores, formas de pagamento, descontos)
3. Processo (prazos, agendamento, documentos)
4. Credibilidade (tempo de mercado, garantias, referências)

COMPORTAMENTO:
- UMA pergunta por vez
- Reagir emocionalmente antes de perguntar
- Demonstrar cautela ("primeira vez", "quero ter certeza")
- Emojis moderados (máximo 2-3 na conversa toda)`
          },
          {
            role: 'user',
            content: `Crie uma estratégia de ${config.numQuestions} perguntas ULTRA NATURAIS para cliente oculto brasileiro.

CONTEXTO:
- Empresa: ${pendingAnalysis.company_name || 'Empresa'}
- Telefone: ${pendingAnalysis.target_phone}
- Info: ${companyInfo?.summary || 'Não disponível'}
- Persona: ${personaDescriptions[pendingAnalysis.persona as keyof typeof personaDescriptions]}
- Profundidade: ${config.description}

PRIMEIRA MENSAGEM - Exemplos naturais SEM emojis:
1. "bom dia, vi sobre vocês e fiquei interessado, vocês trabalham com [SERVICO]?"
2. "boa tarde, um conhecido indicou, como funciona o [SERVICO]?"
3. "boa noite, to precisando de [PRODUTO], vcs fazem?"
4. "bom dia, estava pesquisando e achei vocês, pode me ajudar?"
5. "boa tarde, vcs atendem na região do [BAIRRO]?"

CRITICAL: 
- SEMPRE começar com saudação contextual (bom dia/boa tarde/boa noite)
- UMA pergunta simples e direta
- Máximo 2 linhas curtas
- ZERO emojis
- 100% natural brasileiro`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'create_questions_strategy',
            description: 'Cria a estratégia de perguntas para o cliente oculto',
            parameters: {
              type: 'object',
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      order: { type: 'number' },
                      question: { type: 'string' },
                      expected_info: { type: 'string' },
                      follow_up_hints: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['order', 'question', 'expected_info']
                  }
                }
              },
              required: ['questions']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'create_questions_strategy' } }
      }),
    });

    const strategyData = await strategyResponse.json();

    // Robust parsing with tool-call fallback and content parsing
    let questionsStrategy: any | null = null;
    try {
      const toolCalls = strategyData?.choices?.[0]?.message?.tool_calls;
      if (toolCalls && toolCalls[0]?.function?.arguments) {
        questionsStrategy = JSON.parse(toolCalls[0].function.arguments);
      } else {
        const content = strategyData?.choices?.[0]?.message?.content;
        if (content) {
          try {
            questionsStrategy = JSON.parse(content);
          } catch {
            // attempt to extract numbered lines into a minimal strategy
            const lines = String(content).split('\n').map((l: string) => l.trim()).filter(Boolean);
            const qs = lines
              .filter((l: string) => /^\d+[\).\-]\s*/.test(l) || l.length > 0)
              .slice(0, config.numQuestions)
              .map((l: string, idx: number) => ({
                order: idx + 1,
                question: l.replace(/^\d+[\).\-]\s*/, ''),
                expected_info: 'informações relevantes sobre serviços e atendimento'
              }));
            if (qs.length > 0) questionsStrategy = { questions: qs };
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse questions strategy:', e);
    }

    if (!questionsStrategy?.questions?.length) {
      // create a minimal default strategy to avoid blocking
      questionsStrategy = {
        questions: Array.from({ length: config.numQuestions }, (_, i) => {
          const base = [
            'Olá! Tudo bem? Vi o contato e gostaria de entender melhor os serviços que vocês oferecem.',
            'Poderia me explicar como funciona o atendimento e os prazos?',
            'Vocês poderiam me passar uma ideia de valores ou faixas de preço?',
            'Quais diferenciais vocês têm em relação a outras opções?',
            'Como posso seguir com um orçamento/atendimento?'
          ];
          return {
            order: i + 1,
            question: base[i] || `Pergunta ${i + 1}: poderia me detalhar um pouco mais?`,
            expected_info: 'detalhes sobre serviços, prazos e preços'
          };
        })
      };
    }
    // Salvar estratégia no banco e atualizar processing_stage
    console.log(`✅ [${pendingAnalysis.id}] Estratégia gerada com ${questionsStrategy.questions.length} perguntas`);
    
    await supabase
      .from('analysis_requests')
      .update({ 
        questions_strategy: questionsStrategy,
        processing_stage: 'ready_to_send'
      })
      .eq('id', pendingAnalysis.id);

    // ETAPA 3: Enviar primeira mensagem via Evolution API
    console.log(`📤 [${pendingAnalysis.id}] Enviando primeira mensagem via Evolution API...`);
    
    // Atualizar processing_stage para 'sending'
    await supabase
      .from('analysis_requests')
      .update({ processing_stage: 'sending' })
      .eq('id', pendingAnalysis.id);

    const firstQuestion = questionsStrategy.questions[0];

    // NORMALIZAÇÃO MELHORADA: remover caracteres especiais e garantir formato correto
    const rawPhone = String(pendingAnalysis.target_phone || '').replace(/\D/g, '');
    let normalizedPhone = rawPhone;
    
    // Se não começa com 55, adicionar código do país
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }
    
    console.log(`📱 Número original: ${pendingAnalysis.target_phone} → Normalizado: ${normalizedPhone}`);

    // GERAR MÚLTIPLAS VARIAÇÕES para testar
    const candidates: string[] = [];
    
    if (normalizedPhone.startsWith('55')) {
      const afterCountry = normalizedPhone.slice(2); // remove '55'
      const areaCode = afterCountry.slice(0, 2); // primeiros 2 dígitos = DDD
      const localNumber = afterCountry.slice(2); // resto do número
      
      // Variação 1: Número completo normalizado (55 + DDD + número)
      candidates.push(normalizedPhone);
      
      // Variação 2: Se tem 11 dígitos após o 55 (55 + 11 dígitos), tentar com 12 (adicionar 9)
      if (afterCountry.length === 10) {
        candidates.push(`55${areaCode}9${localNumber}`);
      }
      
      // Variação 3: Se tem 12 dígitos após o 55, tentar remover o primeiro dígito do número local
      if (afterCountry.length === 11 && localNumber.startsWith('9')) {
        candidates.push(`55${areaCode}${localNumber.slice(1)}`);
      }
      
      // Variação 4: Sem código do país (apenas DDD + número)
      candidates.push(afterCountry);
      
      // Variação 5: Sem código do país + adicionar/remover 9
      if (afterCountry.length === 10) {
        candidates.push(`${areaCode}9${localNumber}`);
      }
      if (afterCountry.length === 11 && localNumber.startsWith('9')) {
        candidates.push(`${areaCode}${localNumber.slice(1)}`);
      }
    } else {
      candidates.push(normalizedPhone);
    }

    // Remover duplicatas mantendo ordem
    const uniqueCandidates = [...new Set(candidates)];
    console.log(`🔄 Testando ${uniqueCandidates.length} variações: ${uniqueCandidates.join(', ')}`);

    let sendOk = false;
    let usedNumber = normalizedPhone;
    let lastErr = '';
    let lastErrorResponse: any = null;

    for (const num of uniqueCandidates) {
      console.log(`📤 Tentando enviar para: ${num}`);
      
      const payload = { number: num, text: firstQuestion.question };
      const resp = await fetch(
        `${actualEvolutionUrl}/message/sendText/${actualEvolutionInstance}`,
        {
          method: 'POST',
          headers: {
            'apikey': actualEvolutionKey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
      
      if (resp.ok) {
        sendOk = true;
        usedNumber = num;
        console.log(`✅ Mensagem enviada com sucesso usando: ${num}`);
        break;
      }
      
      const errorText = await resp.text();
      lastErr = errorText;
      
      try {
        lastErrorResponse = JSON.parse(errorText);
        console.warn(`❌ Falha com ${num}:`, lastErrorResponse);
        
        // Verificar se o número não existe no WhatsApp
        if (lastErrorResponse?.response?.message?.[0]?.exists === false) {
          console.warn(`⚠️ Número ${num} não existe no WhatsApp`);
        }
      } catch {
        console.warn(`❌ Falha com ${num}: ${errorText}`);
      }
    }

    if (!sendOk) {
      // Criar objeto de erro simplificado (evitar MaxDepthReached)
      const errorDetails: any = {
        error: 'Número não encontrado no WhatsApp',
        tested_variations: uniqueCandidates,
        timestamp: new Date().toISOString()
      };

      // Adicionar detalhes do erro de forma simplificada
      if (lastErrorResponse) {
        errorDetails.api_error = {
          status: lastErrorResponse.status || 'unknown',
          message: typeof lastErrorResponse.response?.message === 'string' 
            ? lastErrorResponse.response.message 
            : 'Número não existe no WhatsApp'
        };
      } else if (lastErr) {
        errorDetails.api_error = lastErr.substring(0, 200); // Limitar tamanho
      }

      // Atualizar status para failed com informação simplificada
      await supabase
        .from('analysis_requests')
        .update({ 
          status: 'failed',
          metrics: errorDetails
        })
        .eq('id', pendingAnalysis.id);
      
      throw new Error(`Evolution API error: Nenhuma variação do número funcionou. Última tentativa: ${lastErr}`);
    }

    // ATUALIZAR target_phone e evolution_instance com o número e instância que funcionaram
    await supabase
      .from('analysis_requests')
      .update({ 
        target_phone: usedNumber,
        evolution_instance: actualEvolutionInstance // 🔥 Garantir instância correta
      })
      .eq('id', pendingAnalysis.id);
    
    console.log(`💾 Número e instância atualizados no banco: ${usedNumber} (${actualEvolutionInstance})`);
    // Salvar mensagem inicial
    await supabase.from('conversation_messages').insert({
      analysis_id: pendingAnalysis.id,
      role: 'ai',
      content: firstQuestion.question,
      metadata: { order: 1, expected_info: firstQuestion.expected_info }
    });

    // Atualizar status para chatting e processing_stage
    console.log(`✅ [${pendingAnalysis.id}] Primeira mensagem enviada! Status: chatting`);
    
    await supabase
      .from('analysis_requests')
      .update({ 
        status: 'chatting',
        processing_stage: 'chatting',
        started_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', pendingAnalysis.id);

    console.log(`✅ [${pendingAnalysis.id}] Análise iniciada com sucesso`);
    
    return {
      success: true,
      analysis_id: pendingAnalysis.id,
      first_question: firstQuestion.question
    };

  } catch (error) {
    console.error(`❌ [${pendingAnalysis.id}] Erro:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // SISTEMA DE RETRY: tentar novamente se não excedeu o limite
    if (pendingAnalysis.retry_count < 3) {
      console.log(`🔄 [${pendingAnalysis.id}] Retry ${pendingAnalysis.retry_count + 1}/3`);
      
      await supabase
        .from('analysis_requests')
        .update({ 
          status: 'pending',
          retry_count: pendingAnalysis.retry_count + 1,
          processing_started_at: null
        })
        .eq('id', pendingAnalysis.id);
      
      throw new Error(`Retry scheduled: ${errorMessage}`);
    } else {
      // Após 3 tentativas, marcar como failed definitivamente
      console.log(`💀 [${pendingAnalysis.id}] Falha definitiva após 3 tentativas`);
      
      await supabase
        .from('analysis_requests')
        .update({ 
          status: 'failed',
          metrics: {
            error: errorMessage,
            details: 'Falha após 3 tentativas automáticas',
            retry_count: pendingAnalysis.retry_count,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', pendingAnalysis.id);
      
      throw error;
    }
  }
}
