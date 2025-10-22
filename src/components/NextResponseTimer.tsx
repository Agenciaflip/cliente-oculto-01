import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";

interface NextResponseTimerProps {
  messages: any[];
  analysisNextResponseAt?: string | null;
}

export function NextResponseTimer({ messages, analysisNextResponseAt }: NextResponseTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [showRespondingNow, setShowRespondingNow] = useState(false);

  useEffect(() => {
    const now = Date.now();

    // Buscar next_ai_response_at prioritariamente do metadata da análise
    let targetDate: Date | null = null;
    
    if (analysisNextResponseAt) {
      const candidate = new Date(analysisNextResponseAt);
      if (candidate.getTime() > now) {
        targetDate = candidate;
        console.log('🕐 NextResponseTimer: Usando análise.metadata.next_ai_response_at', targetDate);
      }
    }
    
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
        setTimeRemaining('Respondendo agora...');
        setShowRespondingNow(true);
        setTimeout(() => {
          setIsWaiting(false);
          setShowRespondingNow(false);
        }, 15000);
        return;
      }

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0) {
        setTimeRemaining(`em ${minutes}min ${remainingSeconds}s`);
      } else {
        setTimeRemaining(`em ${remainingSeconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [messages, analysisNextResponseAt]);

  if (!isWaiting) {
    return null;
  }

  return (
    <Card className="p-3 bg-muted/50 border-primary/20">
      <div className="flex items-center gap-2 text-sm">
        {showRespondingNow ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">
          Próxima resposta do agente: <span className="font-medium text-foreground">{timeRemaining}</span>
        </span>
      </div>
    </Card>
  );
}
