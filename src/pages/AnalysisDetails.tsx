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
          <div className="mt-6">
            <Card className="shadow-strong">
              <CardHeader>
                <CardTitle>Análise de Métricas</CardTitle>
                <CardDescription>
                  Insights detalhados sobre a experiência do cliente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto">
                  {JSON.stringify(analysis.metrics, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default AnalysisDetails;
