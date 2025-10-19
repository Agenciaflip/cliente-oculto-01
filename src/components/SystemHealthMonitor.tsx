import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HealthMetrics {
  webhookActive: boolean;
  monitorActive: boolean;
  lastActivity: Date | null;
  unprocessedMessages: number;
  instanceChanges: number;
  erroredAnalyses: number;
}

export function SystemHealthMonitor() {
  const [metrics, setMetrics] = useState<HealthMetrics>({
    webhookActive: false,
    monitorActive: false,
    lastActivity: null,
    unprocessedMessages: 0,
    instanceChanges: 0,
    erroredAnalyses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Buscar última atividade (última mensagem)
        const { data: lastMessage } = await supabase
          .from('conversation_messages')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Buscar mensagens não processadas
        const { data: unprocessed, count } = await supabase
          .from('conversation_messages')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'user')
          .eq('metadata->>processed', 'false');

        // Determinar status do webhook (ativo se última mensagem < 5min)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const webhookActive = lastMessage && new Date(lastMessage.created_at) > fiveMinutesAgo;

        // Determinar status do monitor (ativo se não há mensagens órfãs > 2min)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const { data: oldUnprocessed, count: oldCount } = await supabase
          .from('conversation_messages')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'user')
          .eq('metadata->>processed', 'false')
          .lt('created_at', twoMinutesAgo.toISOString());

        const monitorActive = (oldCount || 0) === 0;

        // Buscar análises com mudança de instância
        const { count: instanceChangesCount } = await supabase
          .from('analysis_requests')
          .select('*', { count: 'exact', head: true })
          .eq('metadata->>instance_changed', 'true')
          .eq('status', 'chatting');

        // Buscar análises em erro por mismatch
        const { count: erroredCount } = await supabase
          .from('analysis_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed')
          .like('metadata->>error', '%mismatch%');

        setMetrics({
          webhookActive: webhookActive || false,
          monitorActive,
          lastActivity: lastMessage ? new Date(lastMessage.created_at) : null,
          unprocessedMessages: count || 0,
          instanceChanges: instanceChangesCount || 0,
          erroredAnalyses: erroredCount || 0,
        });
      } catch (error) {
        console.error('Error fetching health metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Atualizar a cada 30s

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Carregando status do sistema...</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Status do Sistema
      </h3>
      
      <div className="space-y-3">
        {/* Webhook Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Webhook</span>
          {metrics.webhookActive ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Ativo
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Inativo
            </Badge>
          )}
        </div>

        {/* Monitor Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Monitor</span>
          {metrics.monitorActive ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Processando
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              Aguardando
            </Badge>
          )}
        </div>

        {/* Last Activity */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Última atividade</span>
          <span className="text-xs text-muted-foreground">
            {metrics.lastActivity 
              ? formatDistanceToNow(metrics.lastActivity, { addSuffix: true, locale: ptBR })
              : 'Nenhuma atividade'}
          </span>
        </div>

        {/* Unprocessed Messages */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Mensagens pendentes</span>
          {metrics.unprocessedMessages > 0 ? (
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {metrics.unprocessedMessages}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              0
            </Badge>
          )}
        </div>

        {/* Instance Changes */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Trocas de Instância</span>
          <Badge variant={metrics.instanceChanges > 0 ? "destructive" : "secondary"}>
            {metrics.instanceChanges}
          </Badge>
        </div>

        {/* Errored Analyses */}
        {metrics.erroredAnalyses > 0 && (
          <div className="flex items-center justify-between p-2 bg-destructive/10 rounded-md border border-destructive">
            <span className="text-sm font-medium text-destructive">⚠️ Análises com Erro</span>
            <Badge variant="destructive">
              {metrics.erroredAnalyses}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
