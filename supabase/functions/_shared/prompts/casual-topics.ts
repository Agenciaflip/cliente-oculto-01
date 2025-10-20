// Tópicos casuais por segmento para conversação natural

export const CASUAL_TOPICS_BY_SEGMENT: Record<string, string[]> = {
  alimentacao: [
    "como está o movimento aí hoje?",
    "vocês fazem delivery também?",
    "há quanto tempo estão aqui no bairro?",
    "sempre passo na frente, parece sempre cheio!",
    "que cheiro gostoso!",
    "vocês abrem no domingo?",
    "tem estacionamento aqui perto?",
    "aceitam encomendas?",
    "vocês são muito conhecidos aqui na região né?",
    "a loja é climatizada? tá quente hoje"
  ],
  servicos: [
    "vocês atendem aos finais de semana?",
    "tem muita procura esse tipo de serviço?",
    "há quanto tempo vocês trabalham com isso?",
    "já trabalharam em casos similares?",
    "vocês têm whatsapp pra consultas?",
    "a agenda costuma ficar cheia?",
    "como funciona o atendimento de vocês?",
    "vocês dão garantia do serviço?",
    "tem desconto para cliente antigo?",
    "aceitam cartão?"
  ],
  varejo: [
    "há quanto tempo a loja está aqui?",
    "vocês têm outras filiais?",
    "sempre passo na frente mas nunca entrei",
    "que bacana, não sabia que vendiam isso",
    "vocês fazem entrega?",
    "aceitam vale-presente?",
    "tem promoção essa semana?",
    "vocês abrem aos sábados?",
    "a loja é bem organizada, parabéns",
    "tem estacionamento conveniado?"
  ],
  saude: [
    "vocês atendem por convênio?",
    "é fácil marcar consulta com vocês?",
    "há quanto tempo vocês estão aqui?",
    "tem muita fila de espera?",
    "vocês fazem atendimento de emergência?",
    "aceitam particular também?",
    "a clínica é bem equipada?",
    "tem estacionamento?",
    "vocês atendem final de semana?",
    "precisa agendar com antecedência?"
  ],
  default: [
    "como está o movimento hoje?",
    "há quanto tempo vocês trabalham com isso?",
    "vocês são conhecidos aqui na região?",
    "sempre ouço falar bem de vocês",
    "como funciona o atendimento?",
    "vocês atendem aos finais de semana?",
    "tem estacionamento aqui perto?",
    "aceitam cartão?",
    "que legal, não conhecia",
    "fica fácil de chegar aqui?"
  ]
};

export const TRANSITIONS = [
  "ah, então me tira uma dúvida...",
  "aproveitando, queria perguntar...",
  "falando nisso, vocês têm...",
  "já que to aqui, queria saber...",
  "aliás, fiquei curioso sobre...",
  "mudando de assunto, me diz uma coisa...",
  "ah, e sobre...",
  "por falar nisso..."
];

export function getRandomCasualTopic(segment: string): string {
  const normalizedSegment = segment?.toLowerCase() || 'default';
  const topics = CASUAL_TOPICS_BY_SEGMENT[normalizedSegment] || CASUAL_TOPICS_BY_SEGMENT.default;
  return topics[Math.floor(Math.random() * topics.length)];
}

export function getRandomTransition(): string {
  return TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];
}
