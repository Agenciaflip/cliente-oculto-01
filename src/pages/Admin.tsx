import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Users, BarChart3, Activity } from "lucide-react";

interface UserData {
  id: string;
  email: string;
  subscription_tier: string;
  credits_remaining: number;
  analyses_count: number;
}

interface AnalysisData {
  id: string;
  user_email: string;
  target_phone: string;
  company_name: string;
  status: string;
  created_at: string;
}

const Admin = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);

  useEffect(() => {
    // Verifica se é admin
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }

    // Dados mockados de usuários
    setUsers([
      {
        id: '1',
        email: 'contato@agenciacafeonline.com.br',
        subscription_tier: 'Enterprise',
        credits_remaining: 1000,
        analyses_count: 15
      },
      {
        id: '2',
        email: 'cliente1@exemplo.com',
        subscription_tier: 'Pro',
        credits_remaining: 45,
        analyses_count: 8
      },
      {
        id: '3',
        email: 'cliente2@exemplo.com',
        subscription_tier: 'Free',
        credits_remaining: 3,
        analyses_count: 2
      }
    ]);

    // Dados mockados de análises
    setAnalyses([
      {
        id: '1',
        user_email: 'contato@agenciacafeonline.com.br',
        target_phone: '+5511999999999',
        company_name: 'Empresa A',
        status: 'completed',
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        user_email: 'cliente1@exemplo.com',
        target_phone: '+5511988888888',
        company_name: 'Empresa B',
        status: 'processing',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: '3',
        user_email: 'cliente2@exemplo.com',
        target_phone: '+5511977777777',
        company_name: 'Empresa C',
        status: 'completed',
        created_at: new Date(Date.now() - 7200000).toISOString()
      }
    ]);
  }, [user, navigate]);

  const handleSignOut = () => {
    logout();
    navigate('/auth');
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: { variant: "default" as const, label: "Concluída" },
      processing: { variant: "secondary" as const, label: "Processando" },
      pending: { variant: "outline" as const, label: "Pendente" }
    };
    const config = variants[status as keyof typeof variants] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const totalAnalyses = users.reduce((sum, user) => sum + user.analyses_count, 0);
  const totalUsers = users.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Button onClick={handleSignOut} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Análises</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAnalyses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Análises Ativas</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analyses.filter(a => a.status === 'processing').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
            <CardDescription>Gerenciar todos os usuários da plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Plano</th>
                    <th className="text-left p-2">Créditos</th>
                    <th className="text-left p-2">Análises</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="p-2">{user.email}</td>
                      <td className="p-2">
                        <Badge variant="secondary">{user.subscription_tier}</Badge>
                      </td>
                      <td className="p-2">{user.credits_remaining}</td>
                      <td className="p-2">{user.analyses_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Analyses */}
        <Card>
          <CardHeader>
            <CardTitle>Análises Recentes</CardTitle>
            <CardDescription>Todas as análises da plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Usuário</th>
                    <th className="text-left p-2">Empresa</th>
                    <th className="text-left p-2">Telefone</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((analysis) => (
                    <tr key={analysis.id} className="border-b">
                      <td className="p-2 text-sm">{analysis.user_email}</td>
                      <td className="p-2">{analysis.company_name}</td>
                      <td className="p-2 text-sm">{analysis.target_phone}</td>
                      <td className="p-2">{getStatusBadge(analysis.status)}</td>
                      <td className="p-2 text-sm">
                        {new Date(analysis.created_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
