import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Loader2, RefreshCw, AlertCircle, Search, Brain, Send, MessageCircle, CheckCircle2, XCircle, Circle, Sparkles, Printer, CalendarIcon, StopCircle, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SalesAnalysis } from "@/components/SalesAnalysis";
import { AnalysisTimer } from "@/components/AnalysisTimer";
import { NextResponseTimer } from "@/components/NextResponseTimer";
import { FollowUpTimer } from "@/components/FollowUpTimer";
import { ObjectiveProgressBar } from "@/components/ObjectiveProgressBar";
import { Confetti } from "@/components/Confetti";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AnalysisDetailsProps {
  isAdminView?: boolean;
}

const AnalysisDetails = ({ isAdminView = false }: AnalysisDetailsProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [salesAnalysis, setSalesAnalysis] = useState<any>(null);
  const [generatingSales, setGeneratingSales] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string>("");
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [previousPercentage, setPreviousPercentage] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimePollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) {
      navigate("/dashboard");
      return;
    }

    let mounted = true;

    const fetchCompanyLogo = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.user || !mounted) return;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("company_logo")
          .eq("id", session.session.user.id)
          .single();

        if (profileData?.company_logo && mounted) {
          const { data: { publicUrl } } = supabase.storage
            .from("company-logos")
            .getPublicUrl(profileData.company_logo);
          setCompanyLogo(publicUrl);
        }
      } catch (error) {
        console.error("Erro ao carregar logo:", error);
      }
    };

    const fetchMessages = async () => {
      try {
        const { data: messagesData } = await supabase
          .from("conversation_messages")
          .select("*")
          .eq("analysis_id", id)
          .order("created_at", { ascending: true });

        if (mounted) {
          setMessages(messagesData || []);
          // Auto-scroll para a última mensagem
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    const fetchAnalysis = async () => {
      try {
        // Buscar dados da análise
        const { data: analysisData, error: analysisError } = await supabase
          .from("analysis_requests")
          .select("*")
          .eq("id", id)
          .single();

        if (analysisError) {
          console.error("Error fetching analysis:", analysisError);
          if (mounted) {
            navigate("/dashboard");
          }
          return;
        }

        if (mounted) {
          setAnalysis(analysisData);
        }

        // Buscar mensagens
        await fetchMessages();

        // Buscar análise de vendas
        const { data: salesData } = await supabase
          .from("sales_analysis")
          .select("*")
          .eq("analysis_id", id)
          .maybeSingle();

        if (mounted) {
          setSalesAnalysis(salesData);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAnalysis();
    fetchCompanyLogo();

    // Inscrever para updates em tempo real
    const channel = supabase
      .channel(`analysis-details-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analysis_requests',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('🔥 REALTIME: Análise atualizada:', payload);
          if (mounted && payload.new) {
            const oldLastMessageAt = analysis && 'last_message_at' in analysis ? analysis.last_message_at : null;
            const newLastMessageAt = payload.new && 'last_message_at' in payload.new ? payload.new.last_message_at : null;
            
            setAnalysis(payload.new);
            
            // Se last_message_at mudou, refetch mensagens
            if (oldLastMessageAt !== newLastMessageAt && newLastMessageAt !== null) {
              console.log('🔄 last_message_at mudou, buscando mensagens...');
              fetchMessages();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `analysis_id=eq.${id}`
        },
        (payload) => {
          console.log('🔥 REALTIME: Nova mensagem inserida:', payload);
          if (mounted && payload.new) {
            setMessages(prev => {
              // Evitar duplicatas
              const exists = prev.some(msg => msg.id === payload.new.id);
              if (exists) {
                console.log('⚠️ Mensagem duplicada ignorada:', payload.new.id);
                return prev;
              }
              console.log('✅ Adicionando nova mensagem ao estado');
              const newMessages = [...prev, payload.new].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              // Auto-scroll para a última mensagem
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 100);
              return newMessages;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_messages',
          filter: `analysis_id=eq.${id}`
        },
        (payload) => {
          console.log('🔥 REALTIME: Mensagem atualizada:', payload);
          if (mounted && payload.new) {
            setMessages(prev => {
              console.log('✅ Atualizando mensagem no estado');
              return prev.map(msg => 
                msg.id === payload.new.id ? payload.new : msg
              ).sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_analysis',
          filter: `analysis_id=eq.${id}`
        },
        (payload) => {
          console.log('Sales analysis updated:', payload);
          if (mounted && payload.new) {
            setSalesAnalysis(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔌 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime conectado para análise', id);
          setIsRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no canal realtime');
          setIsRealtimeConnected(false);
        } else if (status === 'CLOSED') {
          console.log('🔌 Canal realtime fechado');
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (realtimePollingRef.current) {
        clearInterval(realtimePollingRef.current);
      }
    };
  }, [id, navigate]);

  // 🔄 ATUALIZAÇÃO EM TEMPO REAL (a cada 2s)
  useEffect(() => {
    if (!id || !analysis || (analysis.status !== 'chatting' && analysis.status !== 'pending_follow_up')) {
      return;
    }

    console.log("🔄 Iniciando atualização em tempo real (2s)");
    
    realtimePollingRef.current = setInterval(async () => {
      try {
        const { data: updatedAnalysis } = await supabase
          .from("analysis_requests")
          .select("*")
          .eq("id", id)
          .single();

        if (updatedAnalysis) {
          setAnalysis(updatedAnalysis);
          
          // 🎉 Verificar se objetivos foram concluídos (0 -> 100)
          const metadata = updatedAnalysis.metadata as any;
          const currentPercentage = metadata?.progress?.percentage || 0;
          if (previousPercentage < 100 && currentPercentage === 100) {
            console.log('🎉 OBJETIVOS 100% CONCLUÍDOS! Disparando confetes...');
            setShowConfetti(true);
          }
          setPreviousPercentage(currentPercentage);
        }
      } catch (error) {
        console.error('Erro ao atualizar análise:', error);
      }
    }, 2000);

    return () => {
      if (realtimePollingRef.current) {
        clearInterval(realtimePollingRef.current);
      }
    };
  }, [id, analysis?.status, previousPercentage]);

  // Polling como fallback (aumentado para 10s)
  useEffect(() => {
    if (analysis?.status === "chatting") {
      console.log("🔄 Iniciando polling fallback (10s)");
      pollingIntervalRef.current = setInterval(async () => {
        console.log('🔄 Polling fallback executado');
        try {
          const { data: messagesData } = await supabase
            .from("conversation_messages")
            .select("*")
            .eq("analysis_id", id)
            .order("created_at", { ascending: true });

          if (messagesData) {
            setMessages(prev => {
              // Só atualizar se houver mudanças
              if (JSON.stringify(prev) !== JSON.stringify(messagesData)) {
                console.log("⚠️ Polling detectou mudanças (Realtime falhou?)");
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);
                return messagesData;
              }
              return prev;
            });
          }
        } catch (error) {
          console.error("❌ Erro no polling:", error);
        }
      }, 10000); // Aumentado de 3s para 10s
    } else {
      // Limpar polling se status não for "chatting"
      if (pollingIntervalRef.current) {
        console.log("🛑 Parando polling fallback");
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [analysis?.status, id]);

  const handleProcessNow = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-analysis');
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao processar",
          description: error.message
        });
      } else {
        toast({
          title: "Processamento iniciado!",
          description: "Sua análise está sendo processada agora."
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível iniciar o processamento."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSalesAnalysis = async () => {
    setGeneratingSales(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-sales-conversation', {
        body: { analysis_id: id }
      });

      if (error) throw error;

      toast({
        title: "✅ Análise gerada com sucesso!",
        description: "A análise de vendas está pronta."
      });
    } catch (error: any) {
      toast({
        title: "❌ Erro ao gerar análise",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setGeneratingSales(false);
    }
  };

  const handleStopAnalysis = async () => {
    try {
      const { error } = await supabase
        .from('analysis_requests')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Análise encerrada",
        description: "A análise foi finalizada com sucesso.",
      });

      setAnalysis({ ...analysis, status: 'completed', completed_at: new Date().toISOString() });
    } catch (error) {
      console.error('Erro ao encerrar análise:', error);
      toast({
        title: "Erro ao encerrar análise",
        variant: "destructive",
      });
    }
  };

  // Componente de Etapa Individual
  const ProcessingStage = ({ 
    icon, 
    title, 
    description, 
    status, 
    isActive 
  }: { 
    icon: React.ReactNode; 
    title: string; 
    description: string; 
    status: 'pending' | 'active' | 'completed' | 'error'; 
    isActive: boolean;
  }) => {
    const getIcon = () => {
      if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      if (status === 'error') return <XCircle className="h-5 w-5 text-destructive" />;
      if (isActive) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      return <Circle className="h-5 w-5 text-muted-foreground" />;
    };

    return (
      <div className="flex items-start gap-3">
        <div className="mt-1">{getIcon()}</div>
        <div className="flex-1">
          <p className={cn(
            "font-medium",
            status === 'completed' && "text-green-600",
            isActive && "text-primary",
            status === 'pending' && "text-muted-foreground",
            status === 'error' && "text-destructive"
          )}>
            {title}
          </p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    );
  };

  // Função para determinar status de cada etapa
  const getStageStatus = (targetStage: string, currentStage: string) => {
    const stageOrder = [
      'awaiting_research',
      'researching',
      'generating_strategy',
      'ready_to_send',
      'sending',
      'chatting',
      'completed'
    ];
    
    // Se a análise falhou, marcar como erro
    if (analysis.status === 'failed') {
      return 'error';
    }
    
    const targetIndex = stageOrder.indexOf(targetStage);
    const currentIndex = stageOrder.indexOf(currentStage);
    
    if (currentIndex > targetIndex) return 'completed';
    if (currentIndex === targetIndex) return 'active';
    return 'pending';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      researching: "default",
      chatting: "default",
      pending_follow_up: "outline",
      analyzing: "default",
      completed: "outline",
      failed: "destructive",
    };

    const labels: Record<string, string> = {
      pending: "Pendente",
      researching: "Pesquisando",
      chatting: "Conversando",
      pending_follow_up: "Aguardando Resposta",
      analyzing: "Analisando",
      completed: "Concluída",
      failed: "Falhou",
    };

    return (
      <Badge variant={variants[status] || "default"} className={status === 'pending_follow_up' ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : ''}>
        {status === 'pending_follow_up' && <Clock className="h-3 w-3 mr-1" />}
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Análise não encontrada</h2>
          <Button onClick={() => navigate("/dashboard")}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate(isAdminView ? "/admin" : "/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isAdminView ? "Voltar ao Painel Admin" : "Voltar ao Dashboard"}
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Detalhes da Análise</h1>
              <p className="text-sm text-muted-foreground">
                {analysis.target_phone}
                {analysis.company_name && ` • ${analysis.company_name}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(analysis.status)}
              {isRealtimeConnected && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  🟢 Ao vivo
                </Badge>
              )}
              {analysis.status !== 'completed' && analysis.status !== 'failed' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <StopCircle className="h-4 w-4" />
                      Encerrar Análise
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Encerrar análise?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá finalizar a análise imediatamente. 
                        {analysis.status === 'chatting' 
                          ? 'A conversa será encerrada e você poderá visualizar os resultados.'
                          : 'A análise será marcada como concluída.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleStopAnalysis}>
                        Encerrar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {analysis.status === 'completed' && (
                <Button
                  onClick={() => window.print()}
                  className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Feedback de Erro em Tempo Real */}
        {analysis.status === 'failed' && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>❌ Análise Falhou</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                {analysis.metrics?.error || 'Erro desconhecido durante o processamento'}
              </p>
              
              {analysis.metrics?.api_error && (
                <div className="mt-3">
                  <p className="text-sm font-semibold mb-1">Detalhes do erro:</p>
                  <p className="text-sm opacity-90">
                    {typeof analysis.metrics.api_error === 'string' 
                      ? analysis.metrics.api_error 
                      : analysis.metrics.api_error.message || JSON.stringify(analysis.metrics.api_error)}
                  </p>
                </div>
              )}
              
              {analysis.metrics?.tested_variations && (
                <details className="mt-3">
                  <summary className="text-sm font-semibold cursor-pointer">
                    Ver variações testadas ({analysis.metrics.tested_variations.length})
                  </summary>
                  <pre className="text-xs mt-2 p-2 bg-destructive/10 rounded">
                    {analysis.metrics.tested_variations.join('\n')}
                  </pre>
                </details>
              )}
              
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/dashboard/new')}
                >
                  Criar Nova Análise
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Voltar ao Dashboard
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Alerta de Agendamento */}
        {analysis.status === 'pending' && analysis.scheduled_start_at && (
          <Alert className="mb-6 border-primary/50 bg-primary/5">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Análise Agendada</AlertTitle>
            <AlertDescription>
              Esta análise iniciará automaticamente em{' '}
              <strong className="text-foreground">
                {format(new Date(analysis.scheduled_start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Cronômetro da Análise */}
        {analysis.status === 'chatting' && analysis.started_at && (
          <div className="mb-6">
            <AnalysisTimer
              startedAt={analysis.started_at}
              timeoutMinutes={analysis.timeout_minutes || 120}
              status={analysis.status}
              metadata={analysis.metadata}
            />
          </div>
        )}

        {/* Barra de Progresso dos Objetivos */}
        {(analysis.status === 'chatting' || analysis.status === 'pending_follow_up') && (
          <div className="mb-6">
            <ObjectiveProgressBar
              totalObjectives={analysis.metadata?.progress?.total_objectives || 0}
              achievedObjectives={analysis.metadata?.progress?.achieved_objectives || 0}
              percentage={analysis.metadata?.progress?.percentage || 0}
              objectivesStatus={analysis.metadata?.progress?.objectives_status || {}}
            />
            <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
          </div>
        )}

        {/* Timer de Follow-up */}
        {analysis.status === 'chatting' && messages.length > 0 && (
          <div className="mb-6">
            <FollowUpTimer
              followUpsSent={analysis.metadata?.follow_ups_sent || 0}
              maxFollowUps={analysis.metadata?.max_follow_ups || 3}
              nextFollowUpAt={analysis.metadata?.next_follow_up_at}
              lastMessageRole={messages[messages.length - 1]?.role}
            />
          </div>
        )}


        <div className="grid gap-6 lg:grid-cols-3">
          {/* Info da Análise */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{analysis.target_phone}</p>
                </div>
                {analysis.company_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Empresa</p>
                    <p className="font-medium">{analysis.company_name}</p>
                  </div>
                )}
                {analysis.city && (
                  <div>
                    <p className="text-sm text-muted-foreground">Cidade</p>
                    <p className="font-medium">{analysis.city}</p>
                  </div>
                )}
                {analysis.business_segment && (
                  <div>
                    <p className="text-sm text-muted-foreground">Segmento</p>
                    <p className="font-medium capitalize">{analysis.business_segment}</p>
                  </div>
                )}
                {analysis.cnpj && (
                  <div>
                    <p className="text-sm text-muted-foreground">CNPJ</p>
                    <p className="font-medium">{analysis.cnpj}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Cliente</p>
                  <p className="font-medium capitalize">
                    {analysis.persona.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profundidade</p>
                  <p className="font-medium capitalize">{analysis.analysis_depth}</p>
                </div>
                {analysis.scheduled_start_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Horário Programado</p>
                    <p className="font-medium">
                      {format(new Date(analysis.scheduled_start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Criada em</p>
                  <p className="font-medium">
                    {new Date(analysis.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {analysis.status === "pending" && (
              <Card className="shadow-soft bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">Aguardando Processamento</CardTitle>
                  <CardDescription>
                    Sua análise será processada em breve. Esta página será atualizada automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleProcessNow}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Processar Agora
                      </>
                    )}
                  </Button>
                  {analysis.retry_count > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Tentativa {analysis.retry_count + 1} de 4
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Conversa */}
          <div className="lg:col-span-2">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Conversa
                </CardTitle>
                <CardDescription>
                  {messages.length === 0
                    ? "Aguardando início da conversa..."
                    : `${messages.length} mensagem${messages.length > 1 ? 's' : ''} trocada${messages.length > 1 ? 's' : ''}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    {analysis.status === 'chatting' ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <p className="text-muted-foreground">Aguardando início da conversa...</p>
                        <p className="text-xs text-muted-foreground">As mensagens aparecerão aqui em tempo real</p>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                        <p className="text-muted-foreground">A conversa aparecerá aqui assim que iniciar</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    <NextResponseTimer messages={messages} />
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.role === "ai" ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 shadow-sm ${
                            msg.role === "ai"
                              ? "bg-muted border border-border"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {msg.role === "ai" ? (
                              <>
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <p className="text-xs font-semibold">Cliente Oculto AI</p>
                              </>
                            ) : (
                              <>
                                <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                                <p className="text-xs font-semibold">Concorrente</p>
                              </>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs mt-2 opacity-60">
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {analysis.status === 'chatting' && (
                      <div className="flex justify-start">
                        <div className="bg-muted border border-border rounded-lg p-4 max-w-[80%]">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground">Cliente Oculto AI está digitando...</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Métricas (só aparece quando completado) */}
        {analysis.status === "completed" && analysis.metrics && (
          <div className="mt-6 space-y-6">
            {/* Avaliação de Atendimento */}
            <Card className="shadow-strong bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    Qualidade do Serviço
                  </Badge>
                </div>
                <CardTitle className="flex items-center justify-between">
                  <span>📋 Avaliação de Atendimento</span>
                  <span className="text-4xl font-bold text-primary">
                    {analysis.metrics.overall_score.toFixed(1)}/10
                  </span>
                </CardTitle>
                <CardDescription className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                  <span className="flex items-center gap-1">💬 Comunicação</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">⏱️ Tempo</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">📝 Informações</span>
                </CardDescription>
                <CardDescription className="mt-3">
                  {analysis.metrics.summary}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Qualidade da Comunicação */}
              <Card className="shadow-medium">
                <CardHeader>
                  <CardTitle className="text-lg">Qualidade da Comunicação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Clareza</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${(analysis.metrics.communication_quality.clarity / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right">
                        {analysis.metrics.communication_quality.clarity.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Profissionalismo</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${(analysis.metrics.communication_quality.professionalism / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right">
                        {analysis.metrics.communication_quality.professionalism.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Empatia</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${(analysis.metrics.communication_quality.empathy / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right">
                        {analysis.metrics.communication_quality.empathy.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Completude</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${(analysis.metrics.communication_quality.completeness / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right">
                        {analysis.metrics.communication_quality.completeness.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tempo de Resposta */}
              <Card className="shadow-medium">
                <CardHeader>
                  <CardTitle className="text-lg">Tempo de Resposta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-primary mb-2">
                      {analysis.metrics.response_time.avg_seconds}s
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">
                      Classificação: <span className="font-semibold">{analysis.metrics.response_time.rating}</span>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
                      <span className="text-2xl">
                        {analysis.metrics.customer_experience_score.toFixed(1)}/10
                      </span>
                      <span className="text-sm text-muted-foreground">Experiência</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Informações Capturadas */}
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle className="text-lg">Informações Capturadas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-2">Serviços Oferecidos:</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.metrics.information_captured.services_offered.map((service: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold mb-1">Preço Transparente:</p>
                    <p className="text-sm">
                      {analysis.metrics.information_captured.pricing_transparent ? "✅ Sim" : "❌ Não"}
                    </p>
                  </div>
                  {analysis.metrics.information_captured.pricing_details && (
                    <div>
                      <p className="text-sm font-semibold mb-1">Detalhes de Preço:</p>
                      <p className="text-sm text-muted-foreground">
                        {analysis.metrics.information_captured.pricing_details}
                      </p>
                    </div>
                  )}
                </div>
                {analysis.metrics.information_captured.availability_info && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Disponibilidade:</p>
                    <p className="text-sm text-muted-foreground">
                      {analysis.metrics.information_captured.availability_info}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Pontos Fortes */}
              <Card className="shadow-medium border-green-200 dark:border-green-900">
                <CardHeader>
                  <CardTitle className="text-lg text-green-700 dark:text-green-400">
                    ✨ Pontos Fortes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.metrics.strengths.map((strength: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Pontos de Melhoria */}
              <Card className="shadow-medium border-amber-200 dark:border-amber-900">
                <CardHeader>
                  <CardTitle className="text-lg text-amber-700 dark:text-amber-400">
                    ⚠️ Oportunidades de Melhoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.metrics.weaknesses.map((weakness: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Recomendações */}
            <Card className="shadow-strong border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">💡 Recomendações Estratégicas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analysis.metrics.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <span className="text-primary font-bold text-lg">{i + 1}.</span>
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Resumo Final */}
            <Card className="shadow-strong bg-gradient-to-br from-primary/10 to-secondary/10">
              <CardHeader>
                <CardTitle className="text-lg">Conclusão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm mb-2">Este atendimento seria recomendado?</p>
                    <p className="text-2xl font-bold">
                      {analysis.metrics.would_recommend ? "✅ Sim" : "❌ Não"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Nota da Experiência</p>
                    <p className="text-4xl font-bold text-primary">
                      {analysis.metrics.customer_experience_score.toFixed(1)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Separador */}
        {analysis.status === 'completed' && (
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-sm font-semibold text-muted-foreground">
              ANÁLISE COMERCIAL DETALHADA
            </span>
            <div className="flex-1 h-px bg-border"></div>
          </div>
        )}

        {/* 🆕 Seção: Análise Comercial Avançada */}
        {analysis.status === 'completed' && (
          <Card className="shadow-medium bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                  Metodologias de Vendas
                </Badge>
              </div>
              <CardTitle className="flex items-center justify-between">
                <span>🎯 Análise Comercial Avançada</span>
                {!salesAnalysis && (
                  <Button
                    onClick={handleGenerateSalesAnalysis}
                    disabled={generatingSales}
                    size="sm"
                    variant="default"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generatingSales ? 'Gerando...' : 'Gerar Análise'}
                  </Button>
                )}
              </CardTitle>
              <CardDescription className="text-emerald-900/70 dark:text-emerald-100/70">
                Avaliação de técnicas de vendas e estratégia comercial
              </CardDescription>
            </CardHeader>
            {salesAnalysis ? (
              <CardContent>
                <SalesAnalysis analysis={salesAnalysis} />
              </CardContent>
            ) : (
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>Clique no botão acima para gerar a análise de vendas</p>
              </CardContent>
            )}
          </Card>
        )}
      </main>
    </div>
  );
};

export default AnalysisDetails;
