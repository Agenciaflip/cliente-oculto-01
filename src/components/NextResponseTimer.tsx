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
    // Procurar pela última mensagem da IA (não do usuário)
    const aiMessages = messages.filter((m) => m.role === "ai");
    
    if (aiMessages.length === 0) {
      setIsWaiting(false);
      return;
    }

    const lastAiMessage = aiMessages[aiMessages.length - 1];
    const nextResponseAt = lastAiMessage.metadata?.next_ai_response_at;

    if (!nextResponseAt) {
      console.log('🕐 NextResponseTimer: Sem next_ai_response_at na última mensagem AI');
      setIsWaiting(false);
      return;
    }

    const targetDate = new Date(nextResponseAt);
    
    if (targetDate.getTime() <= Date.now()) {
      console.log('🕐 NextResponseTimer: Janela de resposta já passou');
      setIsWaiting(false);
      return;
    }

    console.log('🕐 NextResponseTimer: Próxima resposta em', targetDate);
    setIsWaiting(true);

    const updateTimer = () => {
      const now = Date.now();
      const diff = nextResponseAt.getTime() - now;

      if (diff <= 0) {
        setTimeRemaining("Respondendo agora...");
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
