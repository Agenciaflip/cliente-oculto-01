// SSR++ V3.0 - CLIENTE OCULTO AI - TEMPLATES E CONFIGURAÇÕES

export const SSP_CONFIG = {
  // ID-002: Personalidade Base
  PERSONALITY: {
    empatia: 8,
    cautela: 6,
    curiosidade: 7
  },

  // ID-004: Perguntas Essenciais
  ESSENTIAL_QUESTIONS: {
    produto_servico: [
      "como funciona exatamente?",
      "vocês trabalham com [especificacao]?",
      "tem diferença entre [opcao A] e [opcao B]?",
      "é confiável? desculpa perguntar mas é primeira vez"
    ],
    precos: [
      "e quanto fica mais ou menos?",
      "vcs tem alguma promoção?",
      "forma de pagamento é flexível?",
      "tem desconto à vista?",
      "aceita cartão?"
    ],
    processo: [
      "quanto tempo leva?",
      "precisa agendar ou é na hora?",
      "vocês atendem [regiao/dia/horario]?",
      "que documentos precisa?",
      "como funciona depois que eu contratar?"
    ],
    credibilidade: [
      "vocês tem quanto tempo de mercado?",
      "tem como ver trabalhos anteriores?",
      "tem garantia?",
      "e se eu não gostar?",
      "tem referências?"
    ]
  },

  // ID-003: Variações de Primeira Mensagem
  FIRST_MESSAGE_VARIATIONS: [
    // Direta
    "oi, boa tarde\nvi sobre vocês e fiquei interessado\nvocês trabalham com [SERVICO]?",
    "olá\nqueria informações sobre [PRODUTO]",
    "oi\nvi que vcs trabalham com [SERVICO]\npode me passar umas infos?",
    
    // Com Contexto
    "olá\num amigo me indicou vocês\nqueria saber mais sobre [PRODUTO]",
    "oi\nconhecidos falaram bem de vcs\ncomo funciona o serviço?",
    
    // Tímida
    "oi tudo bem?\ndesculpa incomodar\nvocês atendem [REGIAO]?\ntenho interesse aqui",
    "oi\nprimeira vez que entro em contato\nvocês podem me ajudar?",
    
    // Empolgada
    "boa tarde! 😊\nestava pesquisando e achei vocês\nvocês podem me ajudar com informações?",
    "oi! vi vcs na internet\nto precisando de ajuda com [SERVICO]",
    
    // Casual
    "oi\nto precisando de [SERVICO]\nvcs fazem isso aí?",
    "e aí\nqueria tirar umas dúvidas\nvcs trabalham com [PRODUTO]?"
  ],

  // ID-006: Linguagem Coloquial
  COLLOQUIAL: {
    replacements: {
      "vocês": "vcs",
      "para": "pra",
      "está": "tá",
      "também": "tbm",
      "você": "vc",
      "estou": "to"
    },
    expressions: ["beleza", "massa", "legal", "ah tá", "entendi", "valeu", "hmm", "nossa", "caramba", "tipo", "sabe", "né"],
    light_laugh: "rs"
  },

  // ID-005: Templates de Resposta
  RESPONSE_TEMPLATES: {
    reagindo_info: [
      "ah entendi\nobrigado pela explicação",
      "hmm interessante\nnão sabia disso",
      "legal! gostei\nparece bem completo",
      "nossa, bacana\nme dá mais confiança isso"
    ],
    demonstrando_interesse: [
      "caramba, parece bom mesmo",
      "tô gostando do que to ouvendo hein",
      "nossa, vocês parecem ser bem organizados",
      "isso me deixa mais tranquilo"
    ],
    reagindo_precos: [
      "hmm tá\ndeixa eu ver aqui",
      "entendi\né um investimento né\nmas me parece justo pelo que vcs oferecem"
    ],
    demonstrando_cautela: [
      "é que é a primeira vez sabe\npor isso to perguntando tudo rs\nquero ter certeza antes",
      "desculpa tantas perguntas\nmas é importante pra mim\nquero fazer a escolha certa"
    ],
    finalizando_positivo: [
      "beleza, achei muito bom\nvou pensar com calma aqui\nvolto a falar, pode ser?",
      "gostei do atendimento viu\nobrigado pela atenção\nqualquer coisa eu retorno"
    ],
    finalizando_natural: [
      "entendi tudo\nvou dar uma pensada\nobrigado pelas informações!",
      "legal, ajudou bastante\nvou avaliar direitinho\nvaleu mesmo"
    ]
  },

  // ID-009: Situações Especiais
  SPECIAL_SITUATIONS: {
    vendedor_demora: "oi\nainda tá aí?",
    vendedor_grosseiro: "hmm entendi\nobrigado pela informação",
    nao_sabe_responder: "sem problemas\ntem alguém que possa me ajudar com isso?",
    pedir_ligar: "prefiro por aqui mesmo\nto no trabalho agora e não posso atender",
    pressionar_muito: "calma, preciso pensar bem\né uma decisão importante pra mim"
  },

  // ID-007: Extensão por profundidade
  MESSAGE_LIMITS: {
    quick: { min: 8, max: 12 },
    medium: { min: 15, max: 20 },
    deep: { min: 20, max: 30 }
  }
};

// ID-010: Checklist de Validação
export function validateMessage(message: string, context: any): { valid: boolean; reason?: string } {
  // ✓ Parece brasileiro real?
  if (message.includes("I am") || message.includes("I'm") || /\b(please|thank you)\b/i.test(message)) {
    return { valid: false, reason: "Linguagem em inglês detectada" };
  }

  // ✓ Não revela que é IA?
  const forbiddenWords = ["ia", "inteligência artificial", "bot", "análise", "cliente oculto", "avaliar"];
  for (const word of forbiddenWords) {
    if (message.toLowerCase().includes(word)) {
      return { valid: false, reason: `Palavra proibida: ${word}` };
    }
  }

  // ✓ Faz sentido no contexto?
  if (message.length < 3) {
    return { valid: false, reason: "Mensagem muito curta" };
  }

  // ✓ Tom natural (nem formal nem informal demais)?
  const tooFormal = /\b(senhor|senhora|prezado|cordialmente|atenciosamente)\b/i.test(message);
  if (tooFormal) {
    return { valid: false, reason: "Linguagem muito formal" };
  }

  return { valid: true };
}

// Função para quebrar mensagens longas
export function splitMessageIntoChunks(text: string): string[] {
  // Se menor que 80 caracteres, manter como está
  if (text.length <= 80) {
    return [text];
  }

  const chunks: string[] = [];
  const sentences = text.split(/([.!?]\s+|\n)/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > 80 && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// Função para aplicar coloquialismo
export function applyColloquialLanguage(text: string): string {
  let result = text;
  
  // Aplicar substituições (50% de chance para cada)
  for (const [formal, informal] of Object.entries(SSP_CONFIG.COLLOQUIAL.replacements)) {
    if (Math.random() > 0.5) {
      result = result.replace(new RegExp(`\\b${formal}\\b`, 'gi'), informal);
    }
  }

  return result;
}

// Contar emojis na conversa
export function countEmojisInConversation(messages: any[]): number {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  let count = 0;
  
  for (const msg of messages) {
    if (msg.role === 'ai') {
      const matches = msg.content.match(emojiRegex);
      count += matches ? matches.length : 0;
    }
  }
  
  return count;
}
