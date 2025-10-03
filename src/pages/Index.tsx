import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Zap, BarChart3, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Cliente Oculto AI
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Analise automaticamente a experiência do cliente dos seus concorrentes com inteligência artificial. 
            Descubra pontos fracos e oportunidades de negócio.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-gradient-primary hover:opacity-90 shadow-medium"
              onClick={() => navigate("/auth")}
            >
              Começar Grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/auth")}
            >
              Fazer Login
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            5 análises grátis • Sem cartão de crédito
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-medium">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">100% Automatizado</h3>
            <p className="text-muted-foreground">
              Nossa IA conversa como um cliente real via WhatsApp, sem intervenção manual.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-medium">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Análise Instantânea</h3>
            <p className="text-muted-foreground">
              Pesquisa sobre a empresa e gera perguntas estratégicas em segundos.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-medium">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Métricas Detalhadas</h3>
            <p className="text-muted-foreground">
              Dashboard completo com insights acionáveis e pontos de melhoria.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center bg-card p-12 rounded-2xl shadow-strong">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para analisar seus concorrentes?
          </h2>
          <p className="text-muted-foreground mb-8">
            Crie sua conta grátis e receba 5 análises para testar.
          </p>
          <Button 
            size="lg" 
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => navigate("/auth")}
          >
            Começar Agora
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
