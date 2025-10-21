import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";

interface NextResponseTimerProps {
  messages: any[];
}

export function NextResponseTimer({ messages }: NextResponseTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    // Procurar por next_ai_response_at em QUALQUER mensagem (user ou ai), não só AI
    // Isso garante que o timer apareça mesmo quando a última mensagem é do usuário
    const now = Date.now();
    
    // Coletar todas as mensagens com next_ai_response_at no futuro
    const candidatesWithFutureWindow = messages
      .map((msg) => ({
        message: msg,
        nextResponseAt: msg.metadata?.next_ai_response_at,
      }))
      .filter((c) => {
        if (!c.nextResponseAt) return false;
        const targetDate = new Date(c.nextResponseAt);
        return targetDate.getTime() > now;
      })
      .sort((a, b) => {
        // Ordenar por próximo tempo (menor diferença para o futuro)
        const timeA = new Date(a.nextResponseAt).getTime();
        const timeB = new Date(b.nextResponseAt).getTime();
        return timeA - timeB;
      });

    if (candidatesWithFutureWindow.length === 0) {
      console.log('🕐 NextResponseTimer: Nenhuma janela de resposta futura encontrada');
      setIsWaiting(false);
      return;
    }

    const selectedCandidate = candidatesWithFutureWindow[0];
    const targetDate = new Date(selectedCandidate.nextResponseAt);

    console.log('🕐 NextResponseTimer: Próxima resposta em', targetDate, 
      'de mensagem', selectedCandidate.message.id, 
      'role:', selectedCandidate.message.role);
    setIsWaiting(true);

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetDate.getTime() - now;

      if (diff <= 0) {
        setTimeRemaining("Respondendo agora...");
        setIsWaiting(false);
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
  }, [messages]);

  if (!isWaiting) {
    return null;
  }

  return (
    <Card className="p-3 bg-muted/50 border-primary/20">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          Próxima resposta do agente: <span className="font-medium text-foreground">{timeRemaining}</span>
        </span>
      </div>
    </Card>
  );
}
