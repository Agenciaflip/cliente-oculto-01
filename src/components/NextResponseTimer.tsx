import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";

interface NextResponseTimerProps {
  messages: any[];
  analysisNextResponseAt?: string | null;
  analysisMetadata?: any; // Para acessar next_follow_up_at
}

export function NextResponseTimer({ messages, analysisNextResponseAt, analysisMetadata }: NextResponseTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [showRespondingNow, setShowRespondingNow] = useState(false);
  const [timerType, setTimerType] = useState<'response' | 'follow_up'>('response');

  useEffect(() => {
    const now = Date.now();

    // Buscar next_ai_response_at e next_follow_up_at
    let targetDate: Date | null = null;
    let type: 'response' | 'follow_up' = 'response';

    // Prioridade 1: next_ai_response_at (resposta normal)
    if (analysisNextResponseAt) {
      const candidate = new Date(analysisNextResponseAt);
      if (candidate.getTime() > now) {
        targetDate = candidate;
        type = 'response';
        console.log('🕐 NextResponseTimer: Usando next_ai_response_at', targetDate);
      }
    }

    // Prioridade 2: next_follow_up_at (se não tem resposta pendente)
    if (!targetDate && analysisMetadata?.next_follow_up_at) {
      const candidate = new Date(analysisMetadata.next_follow_up_at);
      if (candidate.getTime() > now) {
        targetDate = candidate;
        type = 'follow_up';
        console.log('🕐 NextResponseTimer: Usando next_follow_up_at', targetDate);
      }
    }

    setTimerType(type);
    
    // Se não encontrou na análise, buscar nas mensagens
    if (!targetDate) {
      const candidatesWithFutureWindow = messages
        .map((msg) => ({
          message: msg,
          nextResponseAt: msg.metadata?.next_ai_response_at as string | undefined,
        }))
        .filter((c) => {
          if (!c.nextResponseAt) return false;
          const targetDate = new Date(c.nextResponseAt);
          return targetDate.getTime() > now;
        })
        .sort((a, b) => {
          const timeA = new Date(a.nextResponseAt!).getTime();
          const timeB = new Date(b.nextResponseAt!).getTime();
          return timeA - timeB;
        });

      if (candidatesWithFutureWindow.length > 0) {
        const selectedCandidate = candidatesWithFutureWindow[0];
        targetDate = new Date(selectedCandidate.nextResponseAt!);
        console.log('🕐 NextResponseTimer: Próxima resposta em', targetDate,
          'de mensagem', selectedCandidate.message.id);
      }
    }

    if (!targetDate) {
      console.log('🕐 NextResponseTimer: Nenhuma janela de resposta futura encontrada');
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

  const label = timerType === 'follow_up'
    ? 'Próximo follow-up do agente'
    : 'Próxima resposta do agente';

  return (
    <Card className="p-3 bg-muted/50 border-primary/20">
      <div className="flex items-center gap-2 text-sm">
        {showRespondingNow ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">
          {label}: <span className="font-medium text-foreground">{timeRemaining}</span>
        </span>
      </div>
    </Card>
  );
}
