import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Loader2, Users, BarChart3, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserData {
  id: string;
  email: string;
  tier: string;
  credits: number;
  analysisCount: number;
  createdAt: string;
}

interface AnalysisData {
  id: string;
  userEmail: string;
  targetPhone: string;
  companyName: string | null;
  status: string;
  createdAt: string;
}

const Admin = () => {
  const { user, logout } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/dashboard');
      return;
    }

    if (!adminLoading && isAdmin) {
      loadData();
    }
  }, [isAdmin, adminLoading, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar usuários com profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar todos os usuários autenticados
      const { data: authData } = await supabase.auth.admin.listUsers();
      const authUsers = authData?.users || [];

      // Combinar dados
      const usersWithEmail = profilesData?.map(profile => {
        const authUser = authUsers.find(u => u.id === profile.id);
        return {
          id: profile.id,
          email: authUser?.email || 'N/A',
          tier: profile.subscription_tier,
          credits: profile.credits_remaining,
          analysisCount: 0,
          createdAt: profile.created_at
        };
      }) || [];

      // Buscar análises
      const { data: analysesData, error: analysesError } = await supabase
        .from('analysis_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (analysesError) throw analysesError;

      // Enriquecer com email do usuário
      const analysesWithEmail = analysesData?.map(analysis => {
        const userEmail = usersWithEmail.find(u => u.id === analysis.user_id)?.email || 'N/A';
        return {
          id: analysis.id,
          userEmail,
          targetPhone: analysis.target_phone,
          companyName: analysis.company_name,
          status: analysis.status,
          createdAt: analysis.created_at
        };
      }) || [];

      // Contar análises por usuário
      const userAnalysisCounts = analysesData?.reduce((acc, analysis) => {
        acc[analysis.user_id] = (acc[analysis.user_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const usersWithCounts = usersWithEmail.map(user => ({
        ...user,
        analysisCount: userAnalysisCounts[user.id] || 0
      }));

      setUsers(usersWithCounts);
      setAnalyses(analysesWithEmail);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/auth');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: 'Concluída', variant: 'default' as const },
      processing: { label: 'Processando', variant: 'secondary' as const },
      pending: { label: 'Pendente', variant: 'outline' as const },
      error: { label: 'Erro', variant: 'destructive' as const }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalAnalyses = users.reduce((sum, user) => sum + user.analysisCount, 0);
  const totalUsers = users.length;
  const activeAnalyses = analyses.filter(a => a.status === 'processing').length;

  return (
    <div className="min-h-screen bg-background">
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
              <div className="text-2xl font-bold">{activeAnalyses}</div>
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
                    <th className="text-left p-2">Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((userData) => (
                    <tr key={userData.id} className="border-b">
                      <td className="p-2 text-sm">{userData.email}</td>
                      <td className="p-2">
                        <Badge variant="secondary">{userData.tier}</Badge>
                      </td>
                      <td className="p-2">{userData.credits}</td>
                      <td className="p-2">{userData.analysisCount}</td>
                      <td className="p-2 text-sm">
                        {format(new Date(userData.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        Nenhum usuário encontrado
                      </td>
                    </tr>
                  )}
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
                      <td className="p-2 text-sm">{analysis.userEmail}</td>
                      <td className="p-2">{analysis.companyName || 'N/A'}</td>
                      <td className="p-2 text-sm">{analysis.targetPhone}</td>
                      <td className="p-2">{getStatusBadge(analysis.status)}</td>
                      <td className="p-2 text-sm">
                        {format(new Date(analysis.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                  {analyses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        Nenhuma análise encontrada
                      </td>
                    </tr>
                  )}
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
