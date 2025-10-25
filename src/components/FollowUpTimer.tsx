import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowUpTimerProps {
  followUpsSent: number;
  maxFollowUps: number;
  nextFollowUpAt: string | null;
  lastMessageRole: string;
}

export const FollowUpTimer = ({ 
  followUpsSent, 
  maxFollowUps, 
  nextFollowUpAt,
  lastMessageRole 
}: FollowUpTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!nextFollowUpAt) {
      console.log('⚠️ FollowUpTimer: nextFollowUpAt is null/undefined');
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      // Comparar timestamps UTC diretamente (mais confiável)
      const now = Date.now();
      const target = new Date(nextFollowUpAt).getTime();
      const diff = Math.max(0, Math.floor((target - now) / 1000));

      console.log('⏰ FollowUpTimer:', {
        now: new Date(now).toISOString(),
        target: new Date(target).toISOString(),
        nextFollowUpAt,
        diffSeconds: diff,
        diffMinutes: Math.floor(diff / 60)
      });

      setTimeRemaining(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [nextFollowUpAt]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}min ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}min ${secs}s`;
    }
    return `${secs}s`;
  };

  // Debug: Log de props recebidas
  console.log('🔍 FollowUpTimer props:', {
    followUpsSent,
    maxFollowUps,
    nextFollowUpAt,
    lastMessageRole,
    timeRemaining
  });

  // Só mostrar se a última mensagem foi do assistente e ainda há tentativas
  if (lastMessageRole !== 'ai' || followUpsSent >= maxFollowUps) {
    console.log('❌ FollowUpTimer: Não renderizando -', {
      lastMessageRole,
      isAI: lastMessageRole === 'ai',
      followUpsSent,
      maxFollowUps,
      hasReachedMax: followUpsSent >= maxFollowUps
    });
    return null;
  }

  const remainingAttempts = maxFollowUps - followUpsSent;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-primary animate-pulse" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Aguardando resposta
              </p>
              <p className="text-xs text-muted-foreground">
                Tentativas restantes: {remainingAttempts}/{maxFollowUps}
              </p>
            </div>
          </div>

          {nextFollowUpAt && timeRemaining > 0 ? (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Próxima tentativa em:</p>
                <p className="text-sm font-bold text-primary">
                  {formatTime(timeRemaining)}
                </p>
              </div>
            </div>
          ) : (
            console.log('⏰ FollowUpTimer: Countdown não exibido -', {
              hasNextFollowUpAt: !!nextFollowUpAt,
              timeRemaining,
              shouldShow: !!(nextFollowUpAt && timeRemaining > 0)
            }),
            null
          )}
        </div>

        {/* Barra de progresso das tentativas */}
        <div className="mt-3 space-y-1">
          <div className="flex gap-1">
            {Array.from({ length: maxFollowUps }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all",
                  index < followUpsSent ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
