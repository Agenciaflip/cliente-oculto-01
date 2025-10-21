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
    // Procurar pela última mensagem do usuário que ainda não foi processada
    const lastUserMessage = messages
      .filter((m) => m.role === "user" && m.metadata?.processed === false)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    // Procurar pela janela mais recente entre TODAS as mensagens do usuário não processadas
    const pendingUserMessages = messages.filter((m) => m.role === "user" && m.metadata?.processed === false);
    const futureWindows = pendingUserMessages
      .map((m) => m.metadata?.next_ai_response_at as string | undefined)
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d))
      .filter((d) => d.getTime() > Date.now());

    console.log('🕐 NextResponseTimer: pending=', pendingUserMessages.length, 'future windows=', futureWindows.length);

    if (futureWindows.length === 0) {
      console.log('🕐 NextResponseTimer: Sem janela futura encontrada, ocultando timer');
      setIsWaiting(false);
      return;
    }

    const nextResponseAt = new Date(Math.max(...futureWindows.map((d) => d.getTime())));
    console.log('🕐 NextResponseTimer: nextResponseAt =', nextResponseAt);
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
