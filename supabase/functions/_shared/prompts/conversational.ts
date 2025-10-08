// FASE 7: Elementos conversacionais para tornar a IA mais natural

export const CONVERSATIONAL_CONNECTORS = {
  before_question: [
    "Entendi!",
    "Ah sim, faz sentido",
    "Legal!",
    "Hmm interessante",
    "Nossa, bacana",
    "Perfeito, obrigado pela explicação",
    "Ótimo!",
    "Beleza",
    "Show!",
    "Massa"
  ],
  transition: [
    "E quanto ao",
    "Me tira uma dúvida então",
    "Só mais uma coisa:",
    "Agora fiquei curioso(a) sobre",
    "Aproveitando, gostaria de saber",
    "Falando nisso,",
    "Outra coisa,",
    "Já que estamos falando disso,"
  ],
  reactions: [
    "que bom!",
    "massa!",
    "show!",
    "beleza então",
    "entendi, legal",
    "bacana!",
    "perfeito!",
    "ótimo!"
  ]
};

/**
 * Constrói uma mensagem conversacional mais natural
 * @param question Pergunta principal a ser feita
 * @param hasContext Se há contexto de mensagens anteriores
 * @returns Mensagem formatada com elementos conversacionais
 */
export function buildConversationalMessage(question: string, hasContext: boolean = false): string {
  const parts: string[] = [];
  
  // Adicionar reação/conector se houver contexto (não é primeira mensagem)
  if (hasContext && Math.random() > 0.3) {
    const connector = CONVERSATIONAL_CONNECTORS.before_question[
      Math.floor(Math.random() * CONVERSATIONAL_CONNECTORS.before_question.length)
    ];
    parts.push(connector);
  }
  
  // Adicionar transição (50% das vezes)
  if (hasContext && Math.random() > 0.5) {
    const transition = CONVERSATIONAL_CONNECTORS.transition[
      Math.floor(Math.random() * CONVERSATIONAL_CONNECTORS.transition.length)
    ];
    // Se a pergunta já começa com letra maiúscula, adicionar transição com espaço
    parts.push(transition);
  }
  
  // Adicionar pergunta principal
  parts.push(question);
  
  // Juntar com quebras de linha para parecer mais natural
  return parts.join(' ');
}

/**
 * Adiciona uma reação natural ao final de uma resposta
 */
export function addReaction(): string {
  if (Math.random() > 0.7) {
    return CONVERSATIONAL_CONNECTORS.reactions[
      Math.floor(Math.random() * CONVERSATIONAL_CONNECTORS.reactions.length)
    ];
  }
  return '';
}
