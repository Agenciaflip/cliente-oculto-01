import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

const NewAnalysis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Buscar créditos disponíveis
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_remaining")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setCredits(profile.credits_remaining);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar autenticado",
        variant: "destructive",
      });
      return;
    }

    if (credits <= 0) {
      toast({
        title: "Sem créditos",
        description: "Você não tem créditos suficientes. Considere fazer upgrade do seu plano.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const targetPhone = formData.get("target_phone") as string;
    const companyName = formData.get("company_name") as string;
    const persona = formData.get("persona") as string;
    const analysisDepth = formData.get("analysis_depth") as string;

    try {
      // Criar registro de análise no banco
      const { data: analysis, error: createError } = await supabase
        .from("analysis_requests")
        .insert([{
          user_id: user.id,
          target_phone: targetPhone,
          company_name: companyName || null,
          persona: persona as any,
          analysis_depth: analysisDepth,
          status: "pending" as any,
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Decrementar créditos
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ credits_remaining: credits - 1 })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast({
        title: "Análise criada!",
        description: "Sua análise foi iniciada. Redirecionando...",
      });

      // Redirecionar para a página de detalhes da análise
      setTimeout(() => {
        navigate(`/dashboard/analysis/${analysis.id}`);
      }, 1000);

    } catch (error: any) {
      console.error("Error creating analysis:", error);
      toast({
        title: "Erro ao criar análise",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
          <h1 className="text-2xl font-bold">Nova Análise de Cliente Oculto</h1>
          <p className="text-sm text-muted-foreground">
            Créditos disponíveis: <span className="font-medium">{credits}</span>
          </p>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Configurar Análise
              </CardTitle>
              <CardDescription>
                Informe os dados do concorrente que deseja analisar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Telefone do alvo */}
                <div className="space-y-2">
                  <Label htmlFor="target_phone">
                    Telefone do Concorrente <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="target_phone"
                    name="target_phone"
                    type="tel"
                    placeholder="+55 11 99999-9999"
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: +55 (DDD) NÚMERO
                  </p>
                </div>

                {/* Nome da empresa (opcional) */}
                <div className="space-y-2">
                  <Label htmlFor="company_name">
                    Nome da Empresa (Opcional)
                  </Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    type="text"
                    placeholder="Ex: Empresa X Ltda"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se deixar vazio, a IA vai pesquisar automaticamente
                  </p>
                </div>

                {/* Tipo de Persona */}
                <div className="space-y-2">
                  <Label htmlFor="persona">
                    Tipo de Cliente <span className="text-destructive">*</span>
                  </Label>
                  <Select name="persona" defaultValue="interested" disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interested">
                        Cliente Interessado Genérico
                      </SelectItem>
                      <SelectItem value="price_hunter">
                        Caçador de Preço
                      </SelectItem>
                      <SelectItem value="competitor">
                        Concorrente Disfarçado
                      </SelectItem>
                      <SelectItem value="custom">
                        Personalizado
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define como a IA vai se comportar na conversa
                  </p>
                </div>

                {/* Profundidade da análise */}
                <div className="space-y-2">
                  <Label htmlFor="analysis_depth">
                    Profundidade da Análise <span className="text-destructive">*</span>
                  </Label>
                  <Select name="analysis_depth" defaultValue="quick" disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick">
                        Análise Rápida (3-5 perguntas)
                      </SelectItem>
                      <SelectItem value="deep">
                        Análise Profunda (10-15 perguntas)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Análises profundas consomem mais créditos mas geram insights mais detalhados
                  </p>
                </div>

                {/* Botões de ação */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || credits <= 0}
                    className="flex-1 bg-gradient-primary hover:opacity-90"
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {credits <= 0 ? "Sem Créditos" : "Iniciar Análise"}
                  </Button>
                </div>

                {credits <= 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
                    <p className="text-sm text-destructive font-medium">
                      Você não tem créditos disponíveis
                    </p>
                    <Button
                      variant="link"
                      className="text-destructive"
                      onClick={() => navigate("/dashboard/upgrade")}
                    >
                      Fazer upgrade do plano
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default NewAnalysis;
