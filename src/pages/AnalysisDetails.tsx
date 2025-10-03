import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";

const AnalysisDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate("/dashboard");
      return;
    }

    const fetchAnalysis = async () => {
      // Buscar dados da análise
      const { data: analysisData, error: analysisError } = await supabase
        .from("analysis_requests")
        .select("*")
        .eq("id", id)
        .single();

      if (analysisError) {
        console.error("Error fetching analysis:", analysisError);
        navigate("/dashboard");
        return;
      }

      setAnalysis(analysisData);

      // Buscar mensagens da conversa
      const { data: messagesData } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("analysis_id", id)
        .order("created_at", { ascending: true });

      setMessages(messagesData || []);
      setIsLoading(false);
    };

    fetchAnalysis();

    // Inscrever para updates em tempo real
    const channel = supabase
      .channel('analysis-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analysis_requests',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('Analysis updated:', payload);
          setAnalysis(payload.new);
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
          console.log('New message:', payload);
          setMessages(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, navigate]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      researching: "default",
      chatting: "default",
      analyzing: "default",
      completed: "outline",
      failed: "destructive",
    };

    const labels: Record<string, string> = {
      pending: "Pendente",
      researching: "Pesquisando",
      chatting: "Conversando",
      analyzing: "Analisando",
      completed: "Concluída",
      failed: "Falhou",
    };

    return (
      <Badge variant={variants[status] || "default"}>
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
            onClick={() => navigate("/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Detalhes da Análise</h1>
              <p className="text-sm text-muted-foreground">
                {analysis.target_phone}
                {analysis.company_name && ` • ${analysis.company_name}`}
              </p>
            </div>
            {getStatusBadge(analysis.status)}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
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
              </Card>
            )}
          </div>

          {/* Conversa */}
          <div className="lg:col-span-2">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Conversa</CardTitle>
                <CardDescription>
                  {messages.length === 0
                    ? "Nenhuma mensagem ainda"
                    : `${messages.length} mensagens trocadas`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>A conversa aparecerá aqui assim que iniciar</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.role === "ai" ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 ${
                            msg.role === "ai"
                              ? "bg-muted"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          <p className="text-sm font-medium mb-1">
                            {msg.role === "ai" ? "Cliente Oculto AI" : "Concorrente"}
                          </p>
                          <p>{msg.content}</p>
                          <p className="text-xs mt-2 opacity-70">
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Métricas (só aparece quando completado) */}
        {analysis.status === "completed" && analysis.metrics && (
          <div className="mt-6 space-y-6">
            {/* Score Geral */}
            <Card className="shadow-strong bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pontuação Geral</span>
                  <span className="text-4xl font-bold text-primary">
                    {analysis.metrics.overall_score.toFixed(1)}/10
                  </span>
                </CardTitle>
                <CardDescription className="mt-2">
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
      </main>
    </div>
  );
};

export default AnalysisDetails;
