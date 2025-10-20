import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ObjectiveProgressBar } from "./ObjectiveProgressBar";

interface AnalysisTimerProps {
  startedAt: string;
  timeoutMinutes: number;
  status: string;
  metadata?: any;
}

export const AnalysisTimer = ({ startedAt, timeoutMinutes, status, metadata }: AnalysisTimerProps) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progress, setProgress] = useState(0);

  // Extrair dados de progresso dos objetivos
  const progressData = metadata?.progress || null;

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(startedAt);
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000); // em segundos
      
      const timeoutSeconds = timeoutMinutes * 60;
      const remaining = Math.max(0, timeoutSeconds - elapsed);
      const progressPercent = Math.min(100, (elapsed / timeoutSeconds) * 100);

      setTimeElapsed(elapsed);
      setTimeRemaining(remaining);
      setProgress(progressPercent);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startedAt, timeoutMinutes]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}min ${secs}s`;
    }
    return `${minutes}min ${secs}s`;
  };

  const getProgressColor = () => {
    if (timeRemaining > 60 * 60) return "bg-green-500"; // > 60 min
    if (timeRemaining > 30 * 60) return "bg-yellow-500"; // 30-60 min
    return "bg-red-500"; // < 30 min
  };

  const expiresAt = new Date(new Date(startedAt).getTime() + timeoutMinutes * 60 * 1000);

  return (
    <div className="space-y-4">
      <Card className="shadow-soft border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Tempo de Análise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tempo decorrido</p>
              <p className="text-xl font-bold text-foreground">{formatTime(timeElapsed)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tempo restante</p>
              <p className="text-xl font-bold text-foreground">{formatTime(timeRemaining)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso Temporal</span>
              <span className="font-medium">{progress.toFixed(0)}%</span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div 
                className={cn("h-full transition-all", getProgressColor())}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t space-y-1 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Iniciado: {format(new Date(startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Expira em: {format(expiresAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barra de Progresso dos Objetivos */}
      {progressData && progressData.total_objectives > 0 && (
        <ObjectiveProgressBar
          totalObjectives={progressData.total_objectives}
          achievedObjectives={progressData.achieved_objectives}
          percentage={progressData.percentage}
          objectivesStatus={progressData.objectives_status}
        />
      )}
    </div>
  );
};
