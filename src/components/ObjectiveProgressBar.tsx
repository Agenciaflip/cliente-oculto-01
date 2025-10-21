import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface ObjectiveStatus {
  objective: string;
  achieved: boolean;
  confidence?: number;
  evidence?: string | null;
}

interface ObjectiveProgressBarProps {
  totalObjectives: number;
  achievedObjectives: number;
  percentage: number;
  objectivesStatus?: { [key: string]: ObjectiveStatus };
}

export const ObjectiveProgressBar = ({
  totalObjectives,
  achievedObjectives,
  percentage,
  objectivesStatus = {}
}: ObjectiveProgressBarProps) => {
  // Extrair objetivos corretamente (pode vir aninhado ou como array)
  let objectives: ObjectiveStatus[] = [];
  
  if (objectivesStatus && typeof objectivesStatus === 'object') {
    // Se já é um array, usar direto
    if (Array.isArray(objectivesStatus)) {
      objectives = objectivesStatus.filter(v => v && typeof v === 'object' && 'objective' in v) as ObjectiveStatus[];
    } else {
      // Se é objeto, pegar values
      const values = Object.values(objectivesStatus);
      objectives = values.filter(v => v && typeof v === 'object' && 'objective' in v) as ObjectiveStatus[];
    }
  }

  console.log('📊 ObjectiveProgressBar:', { 
    totalObjectives, 
    achievedObjectives, 
    percentage, 
    objectivesCount: objectives.length, 
    objectivesStatusType: Array.isArray(objectivesStatus) ? 'array' : typeof objectivesStatus,
    objectivesStatus 
  });

  // Calcular ângulo para o círculo (tipo FaceID)
  const circumference = 2 * Math.PI * 45; // raio de 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Card className="shadow-soft border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          {totalObjectives === 0 ? 'Analisando Objetivos...' : 'Progresso dos Objetivos'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalObjectives === 0 ? (
          // Estado de carregamento/análise
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="relative w-24 h-24">
              <svg className="transform -rotate-90 w-24 h-24 animate-pulse">
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-muted"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Target className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Analisando a conversa para identificar objetivos...
            </p>
          </div>
        ) : (
          <>
            {/* Círculo de progresso tipo FaceID */}
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                {/* Círculo de fundo */}
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  {/* Círculo de progresso */}
                  <circle
                    cx="64"
                    cy="64"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className={cn(
                      "transition-all duration-1000 ease-out",
                      percentage === 100 ? "text-green-500" :
                      percentage >= 50 ? "text-primary" :
                      "text-yellow-500"
                    )}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Percentual no centro */}
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold text-foreground">
                    {percentage}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {achievedObjectives}/{totalObjectives}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Lista de objetivos */}
        {objectives.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium text-muted-foreground">Objetivos:</p>
            {objectives.map((obj, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm"
              >
                {obj.achieved ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "line-clamp-2",
                    obj.achieved ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {obj.objective}
                  </p>
                  {obj.achieved && obj.evidence && (
                    <p className="text-xs text-muted-foreground italic mt-1 line-clamp-1">
                      "{obj.evidence}"
                    </p>
                  )}
                </div>
                {obj.achieved && (
                  <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                    Alcançado
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
