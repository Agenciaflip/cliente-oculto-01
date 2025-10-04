import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SALES_ANALYSIS_PROMPT = `Você é um consultor sênior de vendas B2B com 20 anos de experiência, especializado nas metodologias:
- SPIN Selling (Neil Rackham)
- BANT (Budget, Authority, Need, Timeline)
- Challenger Sale
- Consultative Selling
- AIDA (Attention, Interest, Desire, Action)
- Técnicas de fechamento consultivo

Analise a conversa completa e avalie a performance de vendas usando critérios profissionais.

CONVERSA:
{conversation}

AVALIE CADA CRITÉRIO DE 0 A 10:

1. RAPPORT E RELACIONAMENTO
- Primeiro contato e cumprimento adequado
- Tom de voz empático e profissional
- Personalização do atendimento
- Conexão emocional estabelecida

2. DESCOBERTA E QUALIFICAÇÃO (SPIN/BANT)
- Situation: Entendeu a situação atual do cliente?
- Problem: Identificou problemas/necessidades reais?
- Implication: Explorou consequências do problema?
- Need-Payoff: Demonstrou valor da solução?
- Budget: Discutiu investimento de forma consultiva?
- Authority: Identificou quem toma decisões?
- Need: Confirmou necessidade genuína?
- Timeline: Estabeleceu urgência ou prazo?

3. APRESENTAÇÃO DE VALOR
- Comunicou benefícios concretos vs características técnicas
- Utilizou prova social (cases, depoimentos)
- Diferenciou claramente da concorrência
- Proposta de valor clara e convincente

4. GESTÃO DE OBJEÇÕES
- Identificou objeções explícitas e implícitas
- Aplicou técnicas profissionais de contorno
- Transformou objeções em oportunidades
- Manteve controle e confiança na conversa

5. TÉCNICAS DE FECHAMENTO
- Realizou tentativas de fechamento (trial closes)
- Criou senso de urgência genuíno
- Ofereceu próximos passos claros e concretos
- Call to action efetivo e assertivo

6. PROFISSIONALISMO
- Tempo de resposta adequado
- Qualidade e clareza na comunicação
- Demonstrou conhecimento do produto/serviço
- Follow-up e persistência apropriados

7. EXPERIÊNCIA DO CLIENTE
- Facilidade de comunicação e acessibilidade
- Transparência nas informações
- Disponibilidade para dúvidas
- Satisfação geral percebida

RETORNE APENAS JSON VÁLIDO (sem markdown, sem blocos de código):
{
  "overall_score": number (média ponderada 0-10 com 1 casa decimal),
  "categories": {
    "rapport": {
      "score": number (0-10 com 1 casa decimal),
      "feedback": "string de 2-3 frases",
      "strengths": ["ponto forte 1", "ponto forte 2"],
      "improvements": ["melhoria 1", "melhoria 2"]
    },
    "discovery": { ... mesma estrutura ... },
    "value_presentation": { ... mesma estrutura ... },
    "objection_handling": { ... mesma estrutura ... },
    "closing": { ... mesma estrutura ... },
    "professionalism": { ... mesma estrutura ... },
    "customer_experience": { ... mesma estrutura ... }
  },
  "competitive_positioning": "string de 3-4 frases sobre como a abordagem se compara com o mercado",
  "sales_methodology_detected": ["SPIN Selling", "BANT", etc],
  "conversion_probability": number (0-100, inteiro),
  "recommended_actions": ["ação 1", "ação 2", "ação 3"],
  "comparative_analysis": "string comparando com padrões de vendas"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysis_id } = await req.json();

    if (!analysis_id) {
      return new Response(
        JSON.stringify({ error: 'analysis_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se já existe análise
    const { data: existing } = await supabase
      .from('sales_analysis')
      .select('*')
      .eq('analysis_id', analysis_id)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify(existing),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar análise e verificar se está completa
    const { data: analysis, error: analysisError } = await supabase
      .from('analysis_requests')
      .select('*, conversation_messages(*)')
      .eq('id', analysis_id)
      .single();

    if (analysisError || !analysis) {
      return new Response(
        JSON.stringify({ error: 'Análise não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (analysis.status !== 'completed') {
      return new Response(
        JSON.stringify({ error: 'Análise ainda não foi concluída' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages = analysis.conversation_messages || [];
    if (messages.length < 4) {
      return new Response(
        JSON.stringify({ error: 'Conversa muito curta para análise' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar conversa
    const conversation = messages
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((m: any) => `${m.role === 'ai' ? 'CLIENTE' : 'VENDEDOR'}: ${m.content}`)
      .join('\n\n');

    console.log(`Analisando conversa de ${messages.length} mensagens`);

    // Chamar OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: SALES_ANALYSIS_PROMPT.replace('{conversation}', conversation)
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao chamar OpenAI', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    console.log('Análise gerada com sucesso:', result.overall_score);

    // Salvar no banco
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('sales_analysis')
      .insert({
        analysis_id,
        overall_score: result.overall_score,
        categories: result.categories,
        competitive_positioning: result.competitive_positioning,
        sales_methodology_detected: result.sales_methodology_detected,
        conversion_probability: result.conversion_probability,
        recommended_actions: result.recommended_actions,
        comparative_analysis: result.comparative_analysis,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar:', saveError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar análise', details: saveError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(savedAnalysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
