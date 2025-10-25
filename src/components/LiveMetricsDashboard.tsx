import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Activity, MessageSquare, CheckCircle2, Clock, TrendingUp, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface LiveMetrics {
  total_analyses: number;
  active_conversations: number;
  completed_today: number;
  avg_response_time: number;
  success_rate: number;
  messages_sent_today: number;
  objectives_achieved: number;
  pending_follow_ups: number;
}

export function LiveMetricsDashboard() {
  const [metrics, setMetrics] = useState<LiveMetrics>({
    total_analyses: 0,
    active_conversations: 0,
    completed_today: 0,
    avg_response_time: 0,
    success_rate: 0,
    messages_sent_today: 0,
    objectives_achieved: 0,
    pending_follow_ups: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();

    // Atualizar a cada 10 segundos
    const interval = setInterval(loadMetrics, 10000);

    // Realtime subscription para análises
    const channel = supabase
      .channel('live-metrics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analysis_requests'
        },
        () => {
          loadMetrics();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, []);

  async function loadMetrics() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Total de análises
      const { count: totalAnalyses } = await supabase
        .from('analysis_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Conversas ativas
      const { count: activeConversations } = await supabase
        .from('analysis_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['chatting', 'pending_follow_up']);

      // Completadas hoje
      const { count: completedToday } = await supabase
        .from('analysis_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', today.toISOString());

      // Follow-ups pendentes
      const { count: pendingFollowUps } = await supabase
        .from('analysis_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending_follow_up');

      // Análises com objetivos alcançados
      const { data: completedAnalyses } = await supabase
        .from('analysis_requests')
        .select('metadata')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      const objectivesAchieved = completedAnalyses?.filter(
        (a: any) => a.metadata?.completion_reason === 'objectives_achieved'
      ).length || 0;

      const totalCompleted = completedAnalyses?.length || 0;
      const successRate = totalCompleted > 0
        ? Math.round((objectivesAchieved / totalCompleted) * 100)
        : 0;

      // Mensagens enviadas hoje
      const { count: messagesSentToday } = await supabase
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'ai')
        .gte('created_at', today.toISOString());

      setMetrics({
        total_analyses: totalAnalyses || 0,
        active_conversations: activeConversations || 0,
        completed_today: completedToday || 0,
        avg_response_time: 0, // Calcular se necessário
        success_rate: successRate,
        messages_sent_today: messagesSentToday || 0,
        objectives_achieved: objectivesAchieved,
        pending_follow_ups: pendingFollowUps || 0,
      });

      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
      setLoading(false);
    }
  }

  const metricCards = [
    {
      title: "Conversas Ativas",
      value: metrics.active_conversations,
      icon: Activity,
      description: "Em andamento agora",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Completadas Hoje",
      value: metrics.completed_today,
      icon: CheckCircle2,
      description: "Análises finalizadas",
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Mensagens Enviadas",
      value: metrics.messages_sent_today,
      icon: MessageSquare,
      description: "Hoje",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Follow-ups Pendentes",
      value: metrics.pending_follow_ups,
      icon: Clock,
      description: "Aguardando resposta",
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Métricas em Tempo Real</h2>
        <div className="flex items-center gap-1 ml-auto text-sm text-muted-foreground">
          <Activity className="h-3 w-3 animate-pulse text-green-500" />
          <span>Atualizando a cada 10s</span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </CardTitle>
                  <div className={`${metric.bgColor} p-2 rounded-lg`}>
                    <Icon className={`h-4 w-4 ${metric.color}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Success Rate Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Taxa de Sucesso
          </CardTitle>
          <CardDescription>
            Análises que alcançaram 100% dos objetivos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-4xl font-bold">{metrics.success_rate}%</div>
              <p className="text-sm text-muted-foreground">
                {metrics.objectives_achieved} de {metrics.total_analyses} análises
              </p>
            </div>
          </div>
          <Progress value={metrics.success_rate} className="h-2" />
        </CardContent>
      </Card>
    </div>
  );
}
