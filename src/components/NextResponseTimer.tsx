import { useEffect, useState } from "react";
import { Clock, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";

interface NextResponseTimerProps {
  messages: any[];
  analysisNextResponseAt?: string | null;
  analysisMetadata?: any;
}

export function NextResponseTimer({ messages, analysisNextResponseAt, analysisMetadata }: NextResponseTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [showRespondingNow, setShowRespondingNow] = useState(false);
  const [timerType, setTimerType] = useState<'response' | 'follow_up'>('response');

  useEffect(() => {
    const now = Date.now();

    // Buscar última mensagem
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const lastMessageRole = lastMessage?.role;

    let targetDate: Date | null = null;
    let type: 'response' | 'follow_up' = 'response';

    // CENÁRIO 1: Se última mensagem foi do USUÁRIO → mostrar timer de resposta
    if (lastMessageRole === 'user' && analysisNextResponseAt) {
      const candidate = new Date(analysisNextResponseAt);
      if (candidate.getTime() > now) {
        targetDate = candidate;
        type = 'response';
      }
    }

    // CENÁRIO 2: Se última mensagem foi da IA → mostrar timer de follow-up
    if (lastMessageRole === 'ai' && analysisMetadata?.next_follow_up_at) {
      const candidate = new Date(analysisMetadata.next_follow_up_at);
      if (candidate.getTime() > now) {
        targetDate = candidate;
        type = 'follow_up';
      }
    }

    setTimerType(type);

    if (!targetDate) {
      setIsWaiting(false);
      setShowRespondingNow(false);
      return;
    }

    setIsWaiting(true);
    setShowRespondingNow(false);

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetDate!.getTime() - now;

      if (diff <= 0) {
        const message = type === 'follow_up' ? 'Enviando follow-up...' : 'Respondendo agora...';
        setTimeRemaining(message);
        setShowRespondingNow(true);
        setTimeout(() => {
          setIsWaiting(false);
          setShowRespondingNow(false);
        }, 15000);
        return;
      }

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      const remainingSeconds = seconds % 60;

      // Formato: Xh Ymin ou Ymin Zs ou apenas Zs
      if (hours > 0) {
        setTimeRemaining(`em ${hours}h ${remainingMinutes}min`);
      } else if (minutes > 0) {
        setTimeRemaining(`em ${minutes}min ${remainingSeconds}s`);
      } else {
        setTimeRemaining(`em ${remainingSeconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [messages, analysisNextResponseAt, analysisMetadata]);

  if (!isWaiting) {
    return null;
  }

  // Calcular tentativas restantes para follow-up
  const followUpsSent = analysisMetadata?.follow_ups_sent || 0;
  const maxFollowUps = analysisMetadata?.max_follow_ups || 3;
  const remainingAttempts = maxFollowUps - followUpsSent;

  const isFollowUp = timerType === 'follow_up';

  return (
    <Card className={`p-3 ${isFollowUp ? 'border-primary/30 bg-primary/5' : 'bg-muted/50 border-primary/20'}`}>
      <div className="flex items-center gap-2 text-sm">
        {showRespondingNow ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : isFollowUp ? (
          <RefreshCw className="h-4 w-4 text-primary animate-pulse" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex-1">
          <span className="text-muted-foreground">
            {isFollowUp ? 'Próximo follow-up do agente' : 'Próxima resposta do agente'}:{' '}
            <span className="font-medium text-foreground">{timeRemaining}</span>
          </span>
          {isFollowUp && !showRespondingNow && (
            <p className="text-xs text-muted-foreground mt-1">
              Tentativas restantes: {remainingAttempts}/{maxFollowUps}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
