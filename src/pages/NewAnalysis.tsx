import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Sparkles, CalendarIcon } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const NewAnalysis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState(0);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState<string>("14:00");
  const [isScheduled, setIsScheduled] = useState(false);

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
    const cnpj = formData.get("cnpj") as string;
    const city = formData.get("city") as string;
    const businessSegment = formData.get("business_segment") as string;
    const competitorDescription = formData.get("competitor_description") as string;
    const competitorUrl = formData.get("competitor_url") as string;
    const investigationGoals = formData.get("investigation_goals") as string;
    const aiGender = formData.get("ai_gender") as string;

    try {
      // Validar agendamento se habilitado
      let scheduledStartAt = null;
      if (isScheduled && scheduledDate) {
        const [hours, minutes] = scheduledTime.split(':');
        const scheduled = new Date(scheduledDate);
        scheduled.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // Validar que está no futuro
        if (scheduled <= new Date()) {
          toast({
            title: "Erro de agendamento",
            description: "A data/hora deve estar no futuro",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        
        scheduledStartAt = scheduled.toISOString();
      }

      // Determinar qual instância Evolution usar
      const evolutionInstance = aiGender === 'female' 
        ? 'clienteoculto-mulher' 
        : 'felipedisparo';

      // Criar registro de análise no banco
      const { data: analysis, error: createError} = await supabase
        .from("analysis_requests")
        .insert([{
          user_id: user.id,
          target_phone: targetPhone,
          company_name: companyName || null,
          cnpj: cnpj || null,
          city: city,
          business_segment: businessSegment,
          persona: 'ideal_client' as any,
          analysis_depth: 'intermediate',
          competitor_description: competitorDescription,
          competitor_url: competitorUrl || null,
          investigation_goals: investigationGoals || null,
          ai_gender: aiGender,
          evolution_instance: evolutionInstance,
          status: "pending" as any,
          processing_stage: "awaiting_research",
          scheduled_start_at: scheduledStartAt,
          timeout_minutes: 120, // 2 horas
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
        description: "Processamento iniciado automaticamente...",
      });

      // 🚀 TRIGGER AUTOMÁTICO - Invocar process-analysis
      supabase.functions.invoke('process-analysis', {
        body: { analysis_id: analysis.id }
      }).then(() => {
        console.log('Process-analysis invoked successfully');
      }).catch((err) => {
        console.error('Error invoking process-analysis:', err);
      });

      // Redirecionar IMEDIATAMENTE para a página de detalhes
      navigate(`/dashboard/analysis/${analysis.id}`);

    } catch (error: any) {
      console.error("Error creating analysis:", error);
      toast({
        title: "Erro ao criar análise",
        description: error.message,
        variant: "destructive",
      });
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
                    placeholder="Ex: Della Panificadora"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se deixar vazio, a IA vai pesquisar automaticamente
                  </p>
                </div>

                {/* CNPJ (opcional) */}
                <div className="space-y-2">
                  <Label htmlFor="cnpj">
                    CNPJ (Opcional)
                  </Label>
                  <Input
                    id="cnpj"
                    name="cnpj"
                    type="text"
                    placeholder="00.000.000/0000-00"
                    disabled={isLoading}
                    maxLength={18}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ajuda a encontrar a empresa específica
                  </p>
                </div>

                {/* Cidade (obrigatório) */}
                <div className="space-y-2">
                  <Label htmlFor="city">
                    Cidade <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="city"
                    name="city"
                    type="text"
                    placeholder="Ex: São Paulo, Goiânia, Rio de Janeiro"
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cidade onde a empresa está localizada
                  </p>
                </div>

                {/* Segmento de Atuação (obrigatório) */}
                <div className="space-y-2">
                  <Label htmlFor="business_segment">
                    Segmento de Atuação <span className="text-destructive">*</span>
                  </Label>
                  <Select name="business_segment" required disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alimentacao">Alimentação (Restaurantes, Padarias, etc)</SelectItem>
                      <SelectItem value="saude">Saúde (Clínicas, Consultórios, etc)</SelectItem>
                      <SelectItem value="beleza">Beleza (Salões, Barbearias, etc)</SelectItem>
                      <SelectItem value="educacao">Educação (Escolas, Cursos, etc)</SelectItem>
                      <SelectItem value="comercio">Comércio (Lojas, Varejo, etc)</SelectItem>
                      <SelectItem value="servicos">Serviços (Manutenção, Consultoria, etc)</SelectItem>
                      <SelectItem value="tecnologia">Tecnologia (TI, Software, etc)</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ajuda a criar perguntas mais relevantes
                  </p>
                </div>

                {/* Persona */}
                <div className="space-y-2">
                  <Label>Persona do Cliente Oculto <span className="text-destructive">*</span></Label>
                  <Select name="ai_gender" defaultValue="male" disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">👨‍💼 Bruno (35 anos, Gerente Comercial)</SelectItem>
                      <SelectItem value="female">👩‍🏫 Fernanda (38 anos, Coordenadora Pedagógica)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Escolha qual persona vai interagir com a empresa
                  </p>
                </div>

                {/* Agendamento */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="schedule"
                      checked={isScheduled}
                      onCheckedChange={(checked) => setIsScheduled(checked as boolean)}
                      disabled={isLoading}
                    />
                    <Label htmlFor="schedule" className="cursor-pointer">
                      🕐 Agendar início da análise
                    </Label>
                  </div>

                  {isScheduled && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      {/* Date Picker */}
                      <div className="space-y-2">
                        <Label>Data de Início</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !scheduledDate && "text-muted-foreground"
                              )}
                              disabled={isLoading}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduledDate ? format(scheduledDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={scheduledDate}
                              onSelect={setScheduledDate}
                              disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Time Picker */}
                      <div className="space-y-2">
                        <Label>Horário</Label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* NOVOS CAMPOS */}
                
                {/* Descrição do Concorrente */}
                <div className="space-y-2">
                  <Label htmlFor="competitor_description">
                    Descreva o Concorrente <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="competitor_description"
                    name="competitor_description"
                    placeholder="Exemplo: Empresa que vende produtos de limpeza automotiva, especializada em cera e polish. Atende público B2C e B2B. Possui loja física e e-commerce."
                    required
                    disabled={isLoading}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Forneça detalhes sobre produtos/serviços, público-alvo e diferenciais conhecidos. Quanto mais detalhes, mais assertiva será a análise.
                  </p>
                </div>

                {/* URL do Concorrente */}
                <div className="space-y-2">
                  <Label htmlFor="competitor_url">
                    Site do Concorrente (Opcional)
                  </Label>
                  <Input
                    id="competitor_url"
                    name="competitor_url"
                    type="url"
                    placeholder="https://www.exemplo.com.br"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cole o link do site do concorrente para a IA ter mais contexto.
                  </p>
                </div>

                {/* Objetivos da Investigação */}
                <div className="space-y-2">
                  <Label htmlFor="investigation_goals">
                    O que você deseja descobrir? (Opcional)
                  </Label>
                  <Textarea
                    id="investigation_goals"
                    name="investigation_goals"
                    placeholder="Exemplo: preços de produtos específicos, formas de pagamento aceitas, disponibilidade de agenda, tempo de resposta, políticas de desconto, condições de entrega"
                    disabled={isLoading}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Liste as informações específicas que deseja descobrir. A IA direcionará perguntas para capturar esses dados.
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
