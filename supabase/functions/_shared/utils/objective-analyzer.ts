// Analisador de objetivos alcançados usando OpenAI

export interface ObjectiveStatus {
  objective: string;
  achieved: boolean;
  confidence: number;
  evidence: string | null;
}

export interface AnalysisProgress {
  total_objectives: number;
  achieved_objectives: number;
  percentage: number;
  objectives_status: { [key: string]: ObjectiveStatus };
}

/**
 * Analisa se os objetivos de investigação foram alcançados
 */
export async function analyzeObjectivesProgress(
  investigationGoals: string,
  messages: any[],
  openAIKey: string
): Promise<AnalysisProgress> {
  try {
    // Extrair objetivos do investigation_goals
    const objectives = extractObjectives(investigationGoals);
    
    if (objectives.length === 0) {
      return {
        total_objectives: 0,
        achieved_objectives: 0,
        percentage: 0,
        objectives_status: {}
      };
    }

    // Construir histórico de conversa
    const conversationText = messages
      .map(m => `${m.role === 'ai' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
      .join('\n');

    // Analisar cada objetivo usando OpenAI
    const objectivesStatus: { [key: string]: ObjectiveStatus } = {};
    let achievedCount = 0;

    for (const objective of objectives) {
      const status = await checkObjectiveAchieved(objective, conversationText, openAIKey);
      const objectiveKey = sanitizeObjectiveKey(objective);
      objectivesStatus[objectiveKey] = status;
      
      if (status.achieved) {
        achievedCount++;
      }
    }

    return {
      total_objectives: objectives.length,
      achieved_objectives: achievedCount,
      percentage: Math.round((achievedCount / objectives.length) * 100),
      objectives_status: objectivesStatus
    };

  } catch (error) {
    console.error('Erro ao analisar objetivos:', error);
    return {
      total_objectives: 0,
      achieved_objectives: 0,
      percentage: 0,
      objectives_status: {}
    };
  }
}

/**
 * Extrai objetivos individuais do texto de investigation_goals
 */
function extractObjectives(investigationGoals: string): string[] {
  // Dividir por linhas, vírgulas ou pontos
  const lines = investigationGoals
    .split(/[\n,;]/)
    .map(line => line.trim())
    .filter(line => line.length > 5);

  if (lines.length === 0) {
    // Se não conseguiu dividir, retornar como objetivo único
    return [investigationGoals.trim()];
  }

  return lines;
}

/**
 * Verifica se um objetivo específico foi alcançado
 */
async function checkObjectiveAchieved(
  objective: string,
  conversationText: string,
  openAIKey: string
): Promise<ObjectiveStatus> {
  try {
    const prompt = `Analise se o seguinte objetivo foi alcançado na conversa abaixo.

OBJETIVO: ${objective}

CONVERSA:
${conversationText}

Responda APENAS com um JSON no formato:
{
  "achieved": true/false,
  "confidence": 0-100,
  "evidence": "citação da conversa que prova que foi alcançado, ou null se não foi"
}

Se o vendedor respondeu à pergunta ou forneceu a informação pedida, marque como achieved=true.
Se ainda não respondeu ou a informação não foi obtida, marque como achieved=false.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um analisador de objetivos de conversação. Responda apenas com JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Extrair JSON do response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Não foi possível extrair JSON da resposta');
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      objective,
      achieved: result.achieved || false,
      confidence: result.confidence || 0,
      evidence: result.evidence || null
    };

  } catch (error) {
    console.error(`Erro ao analisar objetivo "${objective}":`, error);
    return {
      objective,
      achieved: false,
      confidence: 0,
      evidence: null
    };
  }
}

/**
 * Sanitiza nome do objetivo para usar como chave
 */
function sanitizeObjectiveKey(objective: string): string {
  return objective
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '_') // Substitui espaços por underscores
    .substring(0, 50); // Limita tamanho
}
