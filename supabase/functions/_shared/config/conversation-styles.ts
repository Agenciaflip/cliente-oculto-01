// ============= A/B TESTING: ESTILOS DE CONVERSA =============

export interface ConversationStyle {
  id: string;
  name: string;
  description: string;
  formality_level: number; // 1-10 (1=muito casual, 10=muito formal)
  question_frequency: 'low' | 'medium' | 'high';
  emoji_usage: 'none' | 'minimal' | 'moderate';
  response_length: 'short' | 'medium' | 'detailed';
  prompt_modifier: string;
}

// ============= ESTILO A: CASUAL E DESCONTRAÍDO =============
export const STYLE_CASUAL: ConversationStyle = {
  id: 'casual',
  name: 'Casual e Descontraído',
  description: 'Estilo muito informal, com gírias brasileiras e linguagem coloquial',
  formality_level: 2,
  question_frequency: 'medium',
  emoji_usage: 'none',
  response_length: 'short',
  prompt_modifier: `
MODIFICADOR DE ESTILO: ULTRA CASUAL

🎯 INSTRUÇÕES DE ESTILO:
- Use MUITAS gírias brasileiras: "massa", "show", "top", "dahora", "blz"
- Abrevie TUDO: "vc", "vcs", "pra", "tá", "to", "tb", "tbm", "blz"
- Mensagens MUITO curtas: 3-8 palavras ideal
- Tom super descontraído, como falando com amigo
- Não se preocupe tanto com gramática perfeita
- Use "né" e "sabe" com frequência no final das frases

EXEMPLOS:
"show, quanto fica?"
"massa, e demora quanto?"
"blz, vcs entregam aí né?"
"dahora, aceita pix?"
  `
};

// ============= ESTILO B: EQUILIBRADO E EDUCADO =============
export const STYLE_BALANCED: ConversationStyle = {
  id: 'balanced',
  name: 'Equilibrado e Educado',
  description: 'Estilo balanceado entre casual e formal, educado e respeitoso',
  formality_level: 5,
  question_frequency: 'medium',
  emoji_usage: 'none',
  response_length: 'medium',
  prompt_modifier: `
MODIFICADOR DE ESTILO: EQUILIBRADO E EDUCADO

🎯 INSTRUÇÕES DE ESTILO:
- Tom educado mas não formal demais
- Use "por favor" e "obrigado" ocasionalmente
- Linguagem coloquial moderada: "vc", "pra", "tá" (mas não exagere)
- Mensagens médias: 8-15 palavras
- Seja cordial e respeitoso
- Português correto mas não rebuscado

EXEMPLOS:
"entendi, e quanto seria o valor?"
"certo, vocês fazem entrega?"
"legal, qual seria o prazo?"
"perfeito, obrigado pelas informações"
  `
};

// ============= ESTILO C: DIRETO E OBJETIVO =============
export const STYLE_DIRECT: ConversationStyle = {
  id: 'direct',
  name: 'Direto e Objetivo',
  description: 'Estilo direto ao ponto, sem rodeios, focado em informações',
  formality_level: 6,
  question_frequency: 'high',
  emoji_usage: 'none',
  response_length: 'short',
  prompt_modifier: `
MODIFICADOR DE ESTILO: DIRETO E OBJETIVO

🎯 INSTRUÇÕES DE ESTILO:
- Vá DIRETO ao ponto, sem rodeios
- Perguntas curtas e objetivas
- Pouco ou nenhum "small talk"
- Mensagens ultra curtas: 3-6 palavras ideal
- Foque apenas nas informações necessárias
- Tom neutro, profissional mas não frio

EXEMPLOS:
"quanto custa?"
"qual o prazo?"
"fazem entrega?"
"aceita cartão?"
"tem garantia?"
  `
};

// ============= ESTILO D: DETALHISTA E ANALÍTICO =============
export const STYLE_DETAILED: ConversationStyle = {
  id: 'detailed',
  name: 'Detalhista e Analítico',
  description: 'Estilo mais detalhado, faz muitas perguntas, analisa tudo',
  formality_level: 7,
  question_frequency: 'high',
  emoji_usage: 'none',
  response_length: 'detailed',
  prompt_modifier: `
MODIFICADOR DE ESTILO: DETALHISTA E ANALÍTICO

🎯 INSTRUÇÕES DE ESTILO:
- Faça perguntas detalhadas e específicas
- Peça explicações sobre como funciona
- Demonstre interesse em entender tudo
- Mensagens mais longas: 12-20 palavras
- Mencione contexto pessoal quando relevante
- Tom curioso e analítico

EXEMPLOS:
"entendi, mas como funciona exatamente o processo de entrega?"
"interessante, e qual seria a diferença entre as opções?"
"me explica melhor sobre a garantia, por favor?"
"tenho uma situação específica, vocês conseguem atender?"
  `
};

// ============= MAPA DE ESTILOS =============
export const CONVERSATION_STYLES: Record<string, ConversationStyle> = {
  casual: STYLE_CASUAL,
  balanced: STYLE_BALANCED,
  direct: STYLE_DIRECT,
  detailed: STYLE_DETAILED,
};

// ============= FUNÇÃO: SELECIONAR ESTILO ALEATÓRIO PARA A/B TESTING =============
export function getRandomConversationStyle(): ConversationStyle {
  const styles = Object.values(CONVERSATION_STYLES);
  const randomIndex = Math.floor(Math.random() * styles.length);
  return styles[randomIndex];
}

// ============= FUNÇÃO: OBTER ESTILO POR ID =============
export function getConversationStyle(styleId: string): ConversationStyle {
  return CONVERSATION_STYLES[styleId] || STYLE_BALANCED;
}

// ============= FUNÇÃO: APLICAR MODIFICADOR DE ESTILO AO PROMPT =============
export function applyStyleModifier(
  basePrompt: string,
  styleId: string
): string {
  const style = getConversationStyle(styleId);

  return `${basePrompt}

${style.prompt_modifier}

⚠️ ESTILO ATIVO: ${style.name.toUpperCase()}
Formalidade: ${style.formality_level}/10
Frequência de perguntas: ${style.question_frequency}
Tamanho de resposta: ${style.response_length}
`;
}

// ============= FUNÇÃO: ATRIBUIR ESTILO A NOVA ANÁLISE =============
export function assignStyleToAnalysis(): {
  style_id: string;
  style_name: string;
  ab_test_group: string;
} {
  const style = getRandomConversationStyle();

  return {
    style_id: style.id,
    style_name: style.name,
    ab_test_group: style.id, // Usar ID como grupo de teste
  };
}
