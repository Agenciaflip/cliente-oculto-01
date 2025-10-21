import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Lightbulb, MessageCircle, Target, TrendingUp, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface QuestionStep {
  order: number;
  objective: string;
  approach: string;
  estimated_messages: number;
  status?: 'completed' | 'in_progress' | 'pending';
}

interface AdaptationLog {
  timestamp: string;
  reason: string;
  changes: string;
}

interface ConversationPlanStrategy {
  warm_up_topics: string[];
  transition_approach: string;
  question_sequence: QuestionStep[];
}

interface ConversationPlan {
  created_at: string;
  last_updated: string;
  version: number;
  objectives: string[];
  strategy: ConversationPlanStrategy;
  adaptation_log: AdaptationLog[];
  current_phase: 'planning' | 'warm_up' | 'transition' | 'investigation' | 'closing';
  estimated_total_messages: number;
  messages_sent?: number;
}

interface ConversationPlanProps {
  plan: ConversationPlan | null;
  currentMessageCount: number;
}

const phaseLabels: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  planning: { label: 'Planejando', icon: Lightbulb, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  warm_up: { label: 'Aquecimento', icon: MessageCircle, color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-950' },
  transition: { label: 'Transição', icon: TrendingUp, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950' },
  investigation: { label: 'Investigação', icon: Target, color: 'text-primary', bgColor: 'bg-primary/10' },
  closing: { label: 'Finalização', icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-950' },
};

export const ConversationPlan = ({ plan, currentMessageCount }: ConversationPlanProps) => {
  const [showAllObjectives, setShowAllObjectives] = useState(false);
  const [showAdaptations, setShowAdaptations] = useState(false);

  if (!plan) {
    return (
      <Card className="shadow-soft border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary animate-pulse" />
            Plano de Ação da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Aguardando plano de ação...
          </div>
        </CardContent>
      </Card>
    );
  }

  const phaseInfo = phaseLabels[plan.current_phase] || phaseLabels.planning;
  const PhaseIcon = phaseInfo.icon;
  
  // Calcular progresso
  const warmUpComplete = plan.strategy.warm_up_topics.length;
  const totalSteps = plan.strategy.question_sequence.length + warmUpComplete + 1; // +1 para transição
  const completedSteps = 
    plan.strategy.question_sequence.filter(q => q.status === 'completed').length + 
    (plan.current_phase !== 'warm_up' && plan.current_phase !== 'planning' ? warmUpComplete : Math.min(currentMessageCount, warmUpComplete)) +
    (plan.current_phase === 'investigation' || plan.current_phase === 'closing' ? 1 : 0); // transição
  
  const progressPercentage = Math.round((completedSteps / totalSteps) * 100);
  
  // Círculo de progresso
  const circumference = 2 * Math.PI * 40; // raio de 40
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  // Determinar o que está acontecendo agora (mais detalhado e humanizado)
  const getCurrentStatus = () => {
    if (plan.current_phase === 'planning') {
      return 'Analisando perfil do cliente e preparando estratégia de conversa';
    }
    
    if (plan.current_phase === 'warm_up') {
      const completedWarmup = Math.min(currentMessageCount, plan.strategy.warm_up_topics.length);
      const totalWarmup = plan.strategy.warm_up_topics.length;
      
      if (completedWarmup < totalWarmup) {
        const currentTopic = plan.strategy.warm_up_topics[completedWarmup];
        return `Criando rapport: "${currentTopic}"`;
      }
      return 'Finalizando aquecimento e preparando transição para objetivos';
    }
    
    if (plan.current_phase === 'transition') {
      return 'Direcionando conversa para os objetivos principais da investigação';
    }
    
    if (plan.current_phase === 'investigation') {
      const inProgress = plan.strategy.question_sequence.find(q => q.status === 'in_progress');
      if (inProgress) {
        return `🔍 Investigando: "${inProgress.objective}" - aguardando resposta do vendedor`;
      }
      
      const completed = plan.strategy.question_sequence.filter(q => q.status === 'completed');
      const nextPending = plan.strategy.question_sequence.find(q => q.status === 'pending' || !q.status);
      
      if (nextPending) {
        return `✅ ${completed.length} objetivo(s) concluído(s). Próximo: "${nextPending.objective}"`;
      }
      
      return 'Analisando informações coletadas e preparando próxima pergunta';
    }
    
    if (plan.current_phase === 'closing') {
      return '🎉 Todos os objetivos alcançados! Finalizando atendimento...';
    }
    
    return 'Processando informações e planejando próxima ação';
  };

  // Filtrar adaptações relevantes (remover mensagens técnicas de erro)
  const getRelevantAdaptations = () => {
    return plan.adaptation_log
      .filter(log => {
        const lowerReason = log.reason.toLowerCase();
        const lowerChanges = log.changes.toLowerCase();
        
        // Filtrar mensagens técnicas/erro
        const isTechnicalError = 
          lowerReason.includes('erro') || 
          lowerReason.includes('fallback') ||
          lowerReason.includes('failed') ||
          lowerChanges.includes('erro na ia') ||
          lowerChanges.includes('simplificado devido');
        
        return !isTechnicalError;
      })
      .slice(-3); // Últimas 3 adaptações relevantes
  };

  // Mostrar só 3 objetivos por padrão
  const visibleObjectives = showAllObjectives 
    ? plan.strategy.question_sequence 
    : plan.strategy.question_sequence.slice(0, 3);

  return (
    <Card className="shadow-soft border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          Plano de Ação da IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fase Atual + Progresso Circular */}
        <div className={cn("p-4 rounded-lg", phaseInfo.bgColor)}>
          <div className="flex items-center gap-4">
            {/* Círculo de progresso */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="transform -rotate-90 w-20 h-20">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className={cn(
                    "transition-all duration-1000 ease-out",
                    phaseInfo.color
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <PhaseIcon className={cn("h-8 w-8", phaseInfo.color)} />
              </div>
            </div>

            {/* Info da fase */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg">{phaseInfo.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {progressPercentage}%
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {completedSteps}/{totalSteps} etapas • {currentMessageCount} mensagens
              </p>
            </div>
          </div>
        </div>

        {/* O que está acontecendo agora - mais destacado */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 rounded-lg border-l-4 border-primary shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-primary mb-1.5 uppercase tracking-wide">
                Agora
              </p>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {getCurrentStatus()}
              </p>
            </div>
          </div>
        </div>

        {/* Progresso Warm-up (se aplicável) */}
        {plan.strategy.warm_up_topics.length > 0 && plan.current_phase === 'warm_up' && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5" />
              AQUECIMENTO
            </p>
            <div className="space-y-1.5 pl-1">
              {plan.strategy.warm_up_topics.map((topic, index) => {
                const isCompleted = index < currentMessageCount;
                return (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    {isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    )}
                    <p className={cn(isCompleted ? "text-foreground" : "text-muted-foreground")}>
                      {topic}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Objetivos de Investigação */}
        {plan.strategy.question_sequence.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              <Target className="h-3.5 w-3.5" />
              OBJETIVOS
            </p>
            <div className="space-y-2 pl-1">
              {visibleObjectives.map((step, index) => {
                const status = step.status || 'pending';
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex items-start gap-2 text-xs p-2 rounded",
                      status === 'in_progress' && "bg-primary/5 border border-primary/20"
                    )}
                  >
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : status === 'in_progress' ? (
                      <Clock className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0 animate-pulse" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium",
                        status === 'completed' ? "text-muted-foreground line-through" : 
                        status === 'in_progress' ? "text-primary" : 
                        "text-foreground"
                      )}>
                        {step.objective}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {/* Botão para mostrar mais */}
              {plan.strategy.question_sequence.length > 3 && (
                <button
                  onClick={() => setShowAllObjectives(!showAllObjectives)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                >
                  {showAllObjectives ? '↑ Mostrar menos' : `↓ Ver mais ${plan.strategy.question_sequence.length - 3} objetivos`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Adaptações (colapsável) - apenas se houver adaptações relevantes */}
        {(() => {
          const relevantAdaptations = getRelevantAdaptations();
          return relevantAdaptations.length > 0 && (
            <Collapsible open={showAdaptations} onOpenChange={setShowAdaptations}>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="font-semibold">AJUSTES DE ESTRATÉGIA ({relevantAdaptations.length})</span>
                <ChevronDown className={cn(
                  "h-3.5 w-3.5 transition-transform ml-auto",
                  showAdaptations && "rotate-180"
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {relevantAdaptations.map((log, index) => (
                  <div key={index} className="bg-primary/5 border border-primary/10 p-3 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      <p className="text-muted-foreground font-medium">
                        {new Date(log.timestamp).toLocaleString('pt-BR', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                    <p className="font-semibold text-foreground">{log.reason}</p>
                    <p className="text-muted-foreground leading-relaxed">💡 {log.changes}</p>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })()}
      </CardContent>
    </Card>
  );
};
