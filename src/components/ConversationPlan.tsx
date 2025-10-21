import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Lightbulb, MessageCircle, Target, TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const phaseLabels: Record<string, { label: string; icon: any; color: string }> = {
  planning: { label: 'Planejando', icon: Lightbulb, color: 'text-blue-500' },
  warm_up: { label: 'Aquecimento', icon: MessageCircle, color: 'text-yellow-500' },
  transition: { label: 'Transição', icon: TrendingUp, color: 'text-orange-500' },
  investigation: { label: 'Investigação', icon: Target, color: 'text-primary' },
  closing: { label: 'Finalização', icon: CheckCircle2, color: 'text-green-500' },
};

export const ConversationPlan = ({ plan, currentMessageCount }: ConversationPlanProps) => {
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
  
  // Calcular progresso da fase atual
  const warmUpComplete = plan.strategy.warm_up_topics.length;
  const totalSteps = plan.strategy.question_sequence.length + warmUpComplete;
  const completedSteps = plan.strategy.question_sequence.filter(q => q.status === 'completed').length + 
    (plan.current_phase !== 'warm_up' ? warmUpComplete : Math.min(currentMessageCount, warmUpComplete));

  return (
    <Card className="shadow-soft border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Plano de Ação da IA
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            v{plan.version}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fase Atual */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <PhaseIcon className={cn("h-6 w-6", phaseInfo.color)} />
          <div className="flex-1">
            <p className="font-medium text-sm">Fase Atual: {phaseInfo.label}</p>
            <p className="text-xs text-muted-foreground">
              {completedSteps}/{totalSteps} etapas concluídas
            </p>
          </div>
          <Badge variant={plan.current_phase === 'investigation' ? 'default' : 'secondary'}>
            {currentMessageCount} msgs
          </Badge>
        </div>

        {/* Warm-up Topics */}
        {plan.strategy.warm_up_topics.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Tópicos de Aquecimento:
            </p>
            {plan.strategy.warm_up_topics.map((topic, index) => {
              const isCompleted = plan.current_phase !== 'warm_up' || index < currentMessageCount;
              return (
                <div
                  key={index}
                  className="flex items-start gap-2 text-sm pl-6"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
                  <p className={cn(
                    "flex-1",
                    isCompleted ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {topic}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Sequência de Perguntas */}
        {plan.strategy.question_sequence.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Objetivos de Investigação:
            </p>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {plan.strategy.question_sequence.map((step, index) => {
                  const status = step.status || 'pending';
                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-start gap-2 text-sm p-2 rounded-md",
                        status === 'in_progress' && "bg-primary/5 border border-primary/20"
                      )}
                    >
                      {status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : status === 'in_progress' ? (
                        <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0 animate-pulse" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium",
                          status === 'completed' ? "text-foreground line-through" : 
                          status === 'in_progress' ? "text-primary" : 
                          "text-muted-foreground"
                        )}>
                          {step.order}. {step.objective}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {step.approach}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        ~{step.estimated_messages} msgs
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Última Adaptação */}
        {plan.adaptation_log.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Última Adaptação:
            </p>
            <div className="bg-muted/30 p-3 rounded-md space-y-1">
              <p className="text-xs text-muted-foreground">
                {new Date(plan.adaptation_log[plan.adaptation_log.length - 1].timestamp).toLocaleTimeString('pt-BR')}
              </p>
              <p className="text-sm font-medium">
                {plan.adaptation_log[plan.adaptation_log.length - 1].reason}
              </p>
              <p className="text-xs text-muted-foreground italic">
                "{plan.adaptation_log[plan.adaptation_log.length - 1].changes}"
              </p>
            </div>
          </div>
        )}

        {/* Estimativa */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Progresso estimado:</span>
          <span className="font-medium">
            {currentMessageCount}/{plan.estimated_total_messages} mensagens
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
