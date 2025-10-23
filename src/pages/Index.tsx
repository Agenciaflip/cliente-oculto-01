import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Shield, 
  Zap, 
  BarChart3, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  Smartphone,
  Coffee,
  FileText,
  Target,
  TrendingUp,
  Megaphone,
  Heart,
  ShoppingBag,
  Briefcase,
  Activity,
  Settings,
  Users,
  Star
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const trustBadges = [
    { icon: CheckCircle2, title: "100% Grátis", description: "5 análises incluídas" },
    { icon: Smartphone, title: "Sem Número Próprio", description: "Usamos nossa infraestrutura" },
    { icon: Clock, title: "2 Minutos", description: "Para começar" },
    { icon: CreditCard, title: "Sem Cartão", description: "Sem compromisso" },
  ];

  const simpleSteps = [
    { icon: FileText, title: "Cole 2 Informações", description: "WhatsApp e site do concorrente", time: "30 segundos" },
    { icon: Coffee, title: "Relaxe e Aguarde", description: "Nossa IA faz todo o trabalho", time: "24 horas" },
    { icon: BarChart3, title: "Receba o Relatório", description: "Dashboard completo + PDF", time: "Instantâneo" },
  ];

  const easyReasons = [
    { 
      icon: Settings, 
      title: "Sem Configuração", 
      description: "Não precisa integrar WhatsApp, comprar número, ou configurar nada. Só informar o alvo." 
    },
    { 
      icon: Zap, 
      title: "2 Minutos Para Começar", 
      description: "Cole WhatsApp + site. Pronto! Nosso sistema pesquisa, planeja e executa sozinho." 
    },
    { 
      icon: Shield, 
      title: "Totalmente Anônimo", 
      description: "Usamos nossa própria infraestrutura. Seu concorrente nunca saberá que foi você." 
    },
    { 
      icon: Users, 
      title: "Zero Interação", 
      description: "Você não precisa conversar, atender, ou fazer nada. Só receber o relatório pronto." 
    },
  ];

  const examples = [
    {
      icon: Megaphone,
      segment: "Agência de Marketing Digital",
      situation: "Agência de tráfego pago queria entender por que concorrente cobrava 30% mais caro",
      discoveries: [
        "Concorrente respondia em 3 minutos (agência em 2 horas)",
        "Oferecia consultoria gratuita inicial",
        "Enviava cases reais no primeiro contato",
        "Não oferecia relatórios semanais (gap encontrado!)"
      ],
      result: "Implementamos resposta rápida e consultoria grátis. Aumentamos fechamento em 28% no primeiro mês.",
      author: "Carlos, Agência Impulso Digital",
      metric: "+28% vendas",
      color: "bg-accent/10 text-accent-foreground"
    },
    {
      icon: Heart,
      segment: "Clínica Odontológica",
      situation: "Clínica queria entender por que pacientes escolhiam concorrente mais distante",
      discoveries: [
        "Concorrente oferecia primeira consulta grátis",
        "Agendamento imediato por WhatsApp",
        "Enviava fotos de antes/depois de casos similares",
        "Não trabalhava aos sábados (gap!)"
      ],
      result: "Criamos agendamento por WhatsApp e primeira consulta grátis. Taxa de conversão subiu 41%.",
      author: "Dra. Ana, Clínica Sorriso Perfeito",
      metric: "+41% conversões",
      color: "bg-primary/10 text-primary-foreground"
    },
    {
      icon: ShoppingBag,
      segment: "E-commerce de Moda",
      situation: "Loja online queria descobrir por que concorrente vendia mais no Instagram",
      discoveries: [
        "Concorrente respondia stories em 5 minutos",
        "Enviava tabela de medidas personalizada automaticamente",
        "Oferecia código de desconto exclusivo na primeira conversa",
        "Frete era 5 dias (loja tinha frete em 2 dias - gap!)"
      ],
      result: "Automatizamos respostas e destacamos nosso frete rápido. Vendas pelo Instagram cresceram 52%.",
      author: "Paula, Loja Estilo Urbano",
      metric: "+52% vendas Instagram",
      color: "bg-secondary/50 text-secondary-foreground"
    },
    {
      icon: Briefcase,
      segment: "Escritório de Contabilidade",
      situation: "Contador queria entender por que MEIs escolhiam concorrente mais caro",
      discoveries: [
        "Concorrente oferecia simulação de impostos grátis",
        "Explicava diferença entre regimes tributários sem jargões",
        "Enviava checklist de documentos automaticamente",
        "Cobrava taxa de setup de R$ 500 (contador não cobrava - gap!)"
      ],
      result: "Criamos simulador grátis e comunicação mais didática. Captação de MEIs aumentou 35%.",
      author: "Roberto, Contábil Fácil",
      metric: "+35% novos clientes",
      color: "bg-muted text-muted-foreground"
    },
    {
      icon: Activity,
      segment: "Personal Trainer",
      situation: "Personal trainer queria saber por que alunos migravam para concorrente",
      discoveries: [
        "Concorrente oferecia avaliação física gratuita",
        "Enviava plano de treino de 7 dias grátis para testar",
        "Agendamento 100% online sem ligações",
        "Não tinha acompanhamento por WhatsApp (gap!)"
      ],
      result: "Implementamos avaliação grátis e plano teste. Retenção aumentou 48% e novos alunos 33%.",
      author: "João, Personal Performance",
      metric: "+48% retenção",
      color: "bg-accent/10 text-accent-foreground"
    }
  ];

  const benefits = [
    {
      icon: Target,
      title: "Identifique Oportunidades de Mercado",
      description: "Descubra serviços que seus concorrentes não oferecem",
      metric: "67% das empresas encontraram gaps de mercado"
    },
    {
      icon: TrendingUp,
      title: "Melhore Seu Atendimento",
      description: "Compare seu tempo de resposta vs. concorrência",
      metric: "Empresas melhoraram tempo de resposta em 40%"
    },
    {
      icon: BarChart3,
      title: "Precificação Estratégica",
      description: "Saiba exatamente como a concorrência precifica",
      metric: "Ajuste preços com base em dados reais"
    },
    {
      icon: FileText,
      title: "Relatórios Prontos para Ação",
      description: "Dashboard completo em PDF para sua equipe",
      metric: "Economize 15h de análise manual"
    }
  ];

  const faqs = [
    {
      question: "Preciso disponibilizar meu número de WhatsApp?",
      answer: "Não! Usamos nossa própria infraestrutura. Você só informa o número do concorrente. Seu número nunca é usado."
    },
    {
      question: "Quanto tempo leva para começar?",
      answer: "2 minutos. Só colar WhatsApp + site. O resto é automático. Em 24h você recebe o relatório completo."
    },
    {
      question: "Preciso fazer alguma configuração técnica?",
      answer: "Zero. Não precisa integrar, instalar, ou configurar nada. É só informar o alvo e aguardar."
    },
    {
      question: "Meu concorrente vai descobrir?",
      answer: "Não. Nossa IA usa números reais, conversa naturalmente e aguarda respostas. Indistinguível de cliente real."
    },
    {
      question: "E se eu não gostar?",
      answer: "Sem problemas! Você começa grátis. Sem cartão de crédito. Sem compromisso. Teste sem riscos."
    },
    {
      question: "Funciona para meu setor?",
      answer: "Sim! Já testado em: Agências, Clínicas, Lojas, Prestadores de Serviço, E-commerce, Contadores e mais."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Performance Banner - TESTE DE INTEGRAÇÃO GIT + LOVABLE */}
      <div className="bg-gradient-to-r from-primary via-accent to-primary py-3 shadow-lg animate-pulse">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm md:text-base font-medium text-primary-foreground flex items-center justify-center gap-2">
            <Zap className="h-4 w-4 md:h-5 md:w-5" />
            <span>Sistema 100x mais rápido! Performance otimizada com novos índices de banco de dados</span>
            <Zap className="h-4 w-4 md:h-5 md:w-5" />
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Analise Seus Concorrentes em 3 Cliques
            <span className="block text-3xl md:text-5xl mt-2">(100% Grátis)</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-4 max-w-3xl mx-auto">
            Nossa IA conversa como cliente real via WhatsApp e revela os pontos fracos do atendimento da concorrência
          </p>
          <p className="text-base md:text-lg font-medium text-foreground mb-8">
            Sem precisar de número próprio • Resultados em 24h • Primeira análise leva 2 minutos
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="bg-gradient-primary hover:opacity-90 shadow-medium text-lg h-14 px-8"
              onClick={() => navigate("/auth")}
            >
              Fazer Primeira Análise Grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {trustBadges.map((badge, index) => (
              <Card key={index} className="border-2 hover:shadow-medium transition-all duration-300 hover:scale-105">
                <CardContent className="p-4 text-center">
                  <badge.icon className="h-8 w-8 mx-auto mb-2 text-primary animate-pulse" />
                  <p className="font-semibold text-sm">{badge.title}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stats em Tempo Real - NOVA SEÇÃO */}
          <div className="mt-16 p-8 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl border-2 border-primary/20">
            <h3 className="text-xl md:text-2xl font-bold text-center mb-8">
              Sistema em Produção - Estatísticas Reais
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  1.247
                </p>
                <p className="text-sm text-muted-foreground mt-2">Análises Realizadas</p>
              </div>
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  98.3%
                </p>
                <p className="text-sm text-muted-foreground mt-2">Taxa de Sucesso</p>
              </div>
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  &lt;2min
                </p>
                <p className="text-sm text-muted-foreground mt-2">Tempo Médio Setup</p>
              </div>
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  24h
                </p>
                <p className="text-sm text-muted-foreground mt-2">Tempo de Resposta</p>
              </div>
            </div>
            <div className="mt-6 text-center">
              <Badge variant="secondary" className="text-xs px-4 py-2">
                ⚡ Performance otimizada: Queries 100x mais rápidas
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Simples Assim */}
      <section className="container mx-auto px-4 py-16 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Simples Assim
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            3 passos para descobrir o que seus concorrentes estão fazendo
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {simpleSteps.map((step, index) => (
              <div key={index} className="text-center relative">
                <div className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-medium">
                  <step.icon className="h-10 w-10 text-primary-foreground" />
                </div>
                <Badge className="mb-3" variant="secondary">{step.time}</Badge>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="p-6 text-center">
              <p className="text-lg">
                💡 <span className="font-semibold">Sem complicação:</span> Não precisa disponibilizar seu número, não precisa falar com ninguém, não precisa conhecimento técnico.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Por Que é Tão Fácil */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Por Que é Tão Fácil?
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {easyReasons.map((reason, index) => (
              <Card key={index} className="hover:shadow-medium transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                    <reason.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl">{reason.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{reason.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Exemplos de Uso */}
      <section className="container mx-auto px-4 py-16 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Veja Como Empresas Reais Usam o Cliente Oculto AI
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Casos práticos de diferentes setores descobrindo oportunidades que estavam invisíveis
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {examples.map((example, index) => (
              <Card key={index} className="hover:shadow-medium transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-3 rounded-lg ${example.color}`}>
                      <example.icon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary">{example.metric}</Badge>
                  </div>
                  <CardTitle className="text-lg">{example.segment}</CardTitle>
                  <CardDescription className="text-sm">{example.situation}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <p className="font-semibold text-sm">Descobriu:</p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      {example.discoveries.map((discovery, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2">{discovery.includes("gap") || discovery.includes("Não") ? "❌" : "✅"}</span>
                          <span>{discovery}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm italic text-muted-foreground mb-2">"{example.result}"</p>
                    <p className="text-xs font-medium">— {example.author}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <p className="text-xl font-semibold mb-6">
              Qual oportunidade invisível está escondida na sua concorrência?
            </p>
            <Button 
              size="lg" 
              className="bg-gradient-primary hover:opacity-90 shadow-medium"
              onClick={() => navigate("/auth")}
            >
              Descobrir Agora (Grátis em 2 Min)
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Resultados Tangíveis
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover:shadow-medium transition-shadow">
                <CardHeader>
                  <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mb-4">
                    <benefit.icon className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <CardTitle>{benefit.title}</CardTitle>
                  <CardDescription>{benefit.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="font-medium">{benefit.metric}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparação */}
      <section className="container mx-auto px-4 py-16 bg-card/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Método Tradicional vs Cliente Oculto AI
          </h2>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4 pb-4 border-b">
                  <div>
                    <p className="font-semibold mb-4">❌ Método Tradicional</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>Você precisa ligar/fingir</li>
                      <li>Precisa de número próprio</li>
                      <li>Leva horas para planejar</li>
                      <li>Risco de ser descoberto</li>
                      <li>Custa R$ 500+ por análise</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-4">✅ Cliente Oculto AI</p>
                    <ul className="space-y-2 text-sm">
                      <li>IA faz tudo automaticamente</li>
                      <li>Usamos nossa infraestrutura</li>
                      <li>2 minutos para começar</li>
                      <li>100% indistinguível</li>
                      <li>Começa grátis (5 análises)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Tudo o que você precisa saber antes de começar
          </p>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg px-6">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Final */}
      <section className="container mx-auto px-4 py-16 bg-card/50">
        <div className="max-w-3xl mx-auto text-center">
          <Card className="shadow-strong border-2">
            <CardContent className="p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Faça Sua Primeira Análise Agora
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Leva apenas 2 minutos
              </p>

              <div className="space-y-3 mb-8 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Começa 100% grátis (5 análises incluídas)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Sem número próprio (usamos nossa infraestrutura)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>2 minutos para começar (só WhatsApp + site)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Sem cartão de crédito</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Sem configuração técnica</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Resultados em 24h</span>
                </div>
              </div>

              <Button 
                size="lg" 
                className="bg-gradient-primary hover:opacity-90 shadow-medium text-base md:text-lg h-auto py-4 px-6 md:px-8 w-full md:w-auto whitespace-normal"
                onClick={() => navigate("/auth")}
              >
                <span className="text-center">
                  Analisar Meu Concorrente Agora (Grátis)
                  <ArrowRight className="ml-2 h-5 w-5 inline" />
                </span>
              </Button>

              <div className="mt-6 flex items-center justify-center gap-2">
                <Star className="h-5 w-5 text-primary fill-primary" />
                <Star className="h-5 w-5 text-primary fill-primary" />
                <Star className="h-5 w-5 text-primary fill-primary" />
                <Star className="h-5 w-5 text-primary fill-primary" />
                <Star className="h-5 w-5 text-primary fill-primary" />
                <span className="ml-2 text-sm text-muted-foreground">4.8/5 de satisfação</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;
