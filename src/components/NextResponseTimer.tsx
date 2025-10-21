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
  const [isApprox, setIsApprox] = useState(false);
  const [showRespondingNow, setShowRespondingNow] = useState(false);

  useEffect(() => {
    // Procurar por next_ai_response_at em QUALQUER mensagem (user ou ai)
    // e cair para análise.metadata.next_ai_response_at se necessário
    const now = Date.now();

    // Coletar todas as mensagens com next_ai_response_at no futuro
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
        // Ordenar por próximo tempo (menor diferença para o futuro)
        const timeA = new Date(a.nextResponseAt!).getTime();
        const timeB = new Date(b.nextResponseAt!).getTime();
        return timeA - timeB;
      });

    let targetDate: Date | null = null;
    let isEstimated = false;

    if (candidatesWithFutureWindow.length > 0) {
      const selectedCandidate = candidatesWithFutureWindow[0];
      targetDate = new Date(selectedCandidate.nextResponseAt!);
      console.log('🕐 NextResponseTimer: Próxima resposta em', targetDate,
        'de mensagem', selectedCandidate.message.id,
        'role:', selectedCandidate.message.role);
    } else if (analysisNextResponseAt) {
      const candidate = new Date(analysisNextResponseAt);
      if (candidate.getTime() > now) {
        targetDate = candidate;
        console.log('🕐 NextResponseTimer: Usando análise.metadata.next_ai_response_at', targetDate);
      }
    } else {
      // FALLBACK: Estimar baseado na última mensagem do usuário não processada
      const unprocessedUserMsgs = messages.filter(
        m => m.role === 'user' && m.metadata?.processed === false
      );
      
      if (unprocessedUserMsgs.length > 0) {
        const lastUserMsg = unprocessedUserMsgs[unprocessedUserMsgs.length - 1];
        const estimatedTime = new Date(new Date(lastUserMsg.created_at).getTime() + 2 * 60 * 1000);
        
        if (estimatedTime.getTime() > now) {
          targetDate = estimatedTime;
          isEstimated = true;
          console.log('🕐 NextResponseTimer: Fallback estimado de 2min a partir de', lastUserMsg.created_at);
        }
      }
    }

    if (!targetDate) {
      console.log('🕐 NextResponseTimer: Nenhuma janela de resposta futura encontrada');
      setIsWaiting(false);
      setShowRespondingNow(false);
      return;
    }

    setIsWaiting(true);
    setIsApprox(isEstimated);
    setShowRespondingNow(false);

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetDate!.getTime() - now;

      if (diff <= 0) {
        setTimeRemaining('Respondendo agora...');
        setShowRespondingNow(true);
        // Manter visível por 15s
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
        setTimeRemaining(`em ${isEstimated ? '~' : ''}${minutes}min ${remainingSeconds}s`);
      } else {
        setTimeRemaining(`em ${isEstimated ? '~' : ''}${remainingSeconds}s`);
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
          {isApprox && !showRespondingNow && <span className="text-xs ml-1 opacity-70">(estimado)</span>}
        </span>
      </div>
    </Card>
  );
}
