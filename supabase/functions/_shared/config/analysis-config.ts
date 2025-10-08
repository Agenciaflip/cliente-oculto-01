// FASE 4 & 5: Configuração de delays e reativação para análises

export const DEPTH_CONFIG = {
  quick: {
    name: 'Análise Rápida',
    minInteractions: 3,
    maxInteractions: 5,
    maxDuration: 30 * 60 * 1000, // 30 minutos em ms
    minDelay: 30, // 30 segundos
    maxDelay: 120, // 2 minutos
    timeoutMinutes: 30,
  },
  intermediate: {
    name: 'Análise Intermediária',
    minInteractions: 5,
    maxInteractions: 10,
    maxDuration: 24 * 60 * 60 * 1000, // 24 horas
    minDelay: 60, // 1 minuto
    maxDelay: 240, // 4 minutos
    timeoutMinutes: 24 * 60, // 24 horas
    reactivationTimes: [120, 360, 720], // 2h, 6h, 12h em minutos
  },
  deep: {
    name: 'Análise Profunda',
    minInteractions: 10,
    maxInteractions: 15,
    maxDuration: 5 * 24 * 60 * 60 * 1000, // 5 dias
    minDelay: 60, // 1 minuto
    maxDelay: 360, // 6 minutos
    timeoutMinutes: 5 * 24 * 60, // 5 dias
    reactivationDays: [2, 3, 4],
  }
};

/**
 * FASE 4: Calcula delay realista baseado no tamanho da mensagem e profundidade
 */
export function calculateRealisticDelay(messageLength: number, analysisDepth: string): number {
  const config = DEPTH_CONFIG[analysisDepth as keyof typeof DEPTH_CONFIG] || DEPTH_CONFIG.quick;
  
  let min = config.minDelay;
  let max = config.maxDelay;
  
  // Ajustar baseado no tamanho da mensagem
  if (messageLength <= 50) {
    // Mensagem curta: usar limite inferior
    max = Math.floor((min + max) / 2);
  } else if (messageLength > 150) {
    // Mensagem longa: usar limite superior
    min = Math.floor((min + max) / 2);
  }
  
  // Adicionar randomização
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  
  return delay * 1000; // converter para ms
}

/**
 * FASE 5: Mensagens de reativação naturais
 */
export const REACTIVATION_MESSAGES = {
  intermediate: [
    "Oi! Conseguiu dar uma olhada naquelas informações que mencionou?",
    "Tudo bem por aí? Fiquei pensando sobre o que conversamos...",
    "Desculpa incomodar de novo, mas conseguiu avaliar se faz sentido pra mim?"
  ],
  deep: [
    {
      day: 2,
      messages: [
        "Oi! Voltando aqui... conseguiu ver melhor sobre o que conversamos?",
        "Opa, tudo bem? Ainda to interessado(a), tem alguma novidade?"
      ]
    },
    {
      day: 3,
      messages: [
        "Olá! Ainda to pesquisando sobre isso... consegue me passar mais detalhes?",
        "Oi de novo! Fiquei pensando aqui, será que consegue me ajudar com mais informações?"
      ]
    },
    {
      day: 4,
      messages: [
        "Oi! Desculpa a insistência, mas realmente preciso decidir logo. Pode me ajudar?",
        "Voltando aqui mais uma vez... preciso fechar isso essa semana. Consegue me passar os detalhes?"
      ]
    }
  ]
};

/**
 * Verifica se deve enviar reativação
 */
export function shouldReactivate(
  analysis: any,
  lastMessage: any,
  timeSinceLastMessage: number
): { should: boolean; message?: string } {
  const depth = analysis.analysis_depth;
  const reactivationsSent = analysis.metadata?.reactivations_sent || 0;
  
  // Apenas se a última mensagem foi do assistente
  if (lastMessage.role !== 'assistant') {
    return { should: false };
  }
  
  // ANÁLISE INTERMEDIÁRIA
  if (depth === 'intermediate') {
    const hoursWaiting = timeSinceLastMessage / (1000 * 60 * 60);
    const config = DEPTH_CONFIG.intermediate;
    
    for (let i = 0; i < config.reactivationTimes.length; i++) {
      const requiredMinutes = config.reactivationTimes[i];
      const requiredHours = requiredMinutes / 60;
      
      if (hoursWaiting >= requiredHours && reactivationsSent === i) {
        const message = REACTIVATION_MESSAGES.intermediate[i];
        return { should: true, message };
      }
    }
  }
  
  // ANÁLISE PROFUNDA
  if (depth === 'deep') {
    const daysSinceCreated = (Date.now() - new Date(analysis.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const config = DEPTH_CONFIG.deep;
    
    for (let i = 0; i < config.reactivationDays.length; i++) {
      const targetDay = config.reactivationDays[i];
      
      if (daysSinceCreated >= targetDay && reactivationsSent === i) {
        const dayMessages = REACTIVATION_MESSAGES.deep.find(d => d.day === targetDay);
        if (dayMessages) {
          const message = dayMessages.messages[Math.floor(Math.random() * dayMessages.messages.length)];
          return { should: true, message };
        }
      }
    }
  }
  
  return { should: false };
}

/**
 * Verifica se deve finalizar por timeout
 */
export function shouldTimeout(analysis: any, messageCount: number): boolean {
  const config = DEPTH_CONFIG[analysis.analysis_depth as keyof typeof DEPTH_CONFIG] || DEPTH_CONFIG.quick;
  const timeSinceStart = Date.now() - new Date(analysis.created_at).getTime();
  
  // Finalizar se atingiu duração máxima OU máximo de interações
  return timeSinceStart >= config.maxDuration || messageCount >= config.maxInteractions * 2;
}
