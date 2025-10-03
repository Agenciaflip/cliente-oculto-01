import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Plus, Eye } from "lucide-react";

interface Analysis {
  id: string;
  target_phone: string;
  company_name: string;
  status: string;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Dados mockados para demonstração
  const profile = {
    subscription_tier: 'premium',
    credits_remaining: 10,
  };

  const analyses: Analysis[] = [
    {
      id: '1',
      target_phone: '+55 11 98765-4321',
      company_name: 'Exemplo Corp',
      status: 'completed',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '2',
      target_phone: '+55 11 91234-5678',
      company_name: 'Teste Ltda',
      status: 'analyzing',
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: '3',
      target_phone: '+55 11 99876-5432',
      company_name: 'Demo Inc',
      status: 'pending',
      created_at: new Date(Date.now() - 259200000).toISOString(),
    },
  ];

  const handleSignOut = () => {
    logout();
    navigate("/auth");
  };

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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cliente Oculto AI</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Plano</p>
              <p className="font-medium capitalize">{profile.subscription_tier}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Créditos</p>
              <p className="font-medium">{profile.credits_remaining}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card className="shadow-medium hover:shadow-strong transition-shadow cursor-pointer"
                onClick={() => navigate("/dashboard/new")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Nova Análise
              </CardTitle>
              <CardDescription>
                Inicie uma análise de cliente oculto
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Total de Análises</CardTitle>
              <CardDescription className="text-3xl font-bold">
                {analyses.length}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Créditos Disponíveis</CardTitle>
              <CardDescription className="text-3xl font-bold">
                {profile.credits_remaining}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Analyses */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Análises Recentes</CardTitle>
            <CardDescription>
              Suas últimas análises de cliente oculto
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  Nenhuma análise ainda
                </p>
                <Button onClick={() => navigate("/dashboard/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Análise
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {analyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/dashboard/analysis/${analysis.id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{analysis.target_phone}</p>
                        {analysis.company_name && (
                          <span className="text-sm text-muted-foreground">
                            • {analysis.company_name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(analysis.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(analysis.status)}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
