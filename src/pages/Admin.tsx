import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Loader2, Users, BarChart3, Activity, CheckCircle, Search, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// Interfaces e tipos
interface DataTableSearchableColumn<TData> {
  id: string;
  title: string;
  accessorKey?: keyof TData;
  cell?: ({ row }: { row: TData }) => React.ReactNode;
}

interface DataTableFilterableColumn<TData>
  extends Omit<DataTableSearchableColumn<TData>, "cell"> {
  options: { label: string; value: string }[];
}

interface UserData {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  credits: number;
  totalAnalyses: number;
  completedAnalyses: number;
  successRate: number;
  lastActivity: string | null;
  createdAt: string;
}

interface AnalysisData {
  id: string;
  userEmail: string;
  companyName: string | null;
  targetPhone: string;
  persona: string;
  analysisDepth: string;
  status: string;
  retryCount: number;
  experienceScore: number | null;
  createdAt: string;
  completedAt: string | null;
  duration: string | null;
}

const Admin = () => {
  const { user, logout } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [userSearch, setUserSearch] = useState("");
  const [userPlanFilter, setUserPlanFilter] = useState("all");
  const [analysisSearch, setAnalysisSearch] = useState("");
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState("all");
  const [analysisPersonaFilter, setAnalysisPersonaFilter] = useState("all");
  
  // Dialog de adicionar créditos
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState<number>(0);
  const [addingCredits, setAddingCredits] = useState(false);

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      loadData();
    }
  }, [isAdmin, adminLoading]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar profiles com contagem de análises
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          analysis_requests!user_id(
            id,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Processar dados dos usuários
      const usersData: UserData[] = (profilesData || []).map((profile: any) => {
        const analyses = profile.analysis_requests || [];
        const totalAnalyses = analyses.length;
        const completedAnalyses = analyses.filter((a: any) => a.status === 'completed').length;
        const successRate = totalAnalyses > 0 ? Math.round((completedAnalyses / totalAnalyses) * 100) : 0;

        return {
          id: profile.id,
          email: profile.id, // Temporário, vamos buscar do auth
          fullName: profile.full_name,
          plan: profile.plan || 'free',
          credits: profile.credits_remaining || 0,
          totalAnalyses,
          completedAnalyses,
          successRate,
          lastActivity: profile.last_activity_at,
          createdAt: profile.created_at
        };
      });

      // Buscar análises com métricas
      const { data: analysesData, error: analysesError } = await supabase
        .from('analysis_requests')
        .select(`
          *,
          analysis_metrics(experience_score)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (analysesError) throw analysesError;

      // Processar dados das análises
      const analysesProcessed: AnalysisData[] = (analysesData || []).map((analysis: any) => {
        const createdAt = new Date(analysis.created_at);
        const completedAt = analysis.completed_at ? new Date(analysis.completed_at) : null;
        const duration = completedAt 
          ? `${Math.round((completedAt.getTime() - createdAt.getTime()) / 60000)}min`
          : null;

        const userEmail = usersData.find(u => u.id === analysis.user_id)?.email || 'N/A';

        return {
          id: analysis.id,
          userEmail,
          companyName: analysis.company_name,
          targetPhone: analysis.target_phone,
          persona: analysis.persona || 'interested',
          analysisDepth: analysis.analysis_depth || 'quick',
          status: analysis.status,
          retryCount: analysis.retry_count || 0,
          experienceScore: analysis.analysis_metrics?.[0]?.experience_score || null,
          createdAt: analysis.created_at,
          completedAt: analysis.completed_at,
          duration
        };
      });

      setUsers(usersData);
      setAnalyses(analysesProcessed);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do painel');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/auth');
  };

  const handleAddCredits = async () => {
    if (!selectedUserId || creditsToAdd <= 0) {
      toast.error('Informe uma quantidade válida de créditos');
      return;
    }

    try {
      setAddingCredits(true);
      
      const user = users.find(u => u.id === selectedUserId);
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ credits_remaining: user.credits + creditsToAdd })
        .eq('id', selectedUserId);

      if (error) throw error;

      toast.success(`${creditsToAdd} créditos adicionados com sucesso!`);
      setDialogOpen(false);
      setCreditsToAdd(0);
      setSelectedUserId(null);
      await loadData();
    } catch (error) {
      console.error('Erro ao adicionar créditos:', error);
      toast.error('Erro ao adicionar créditos');
    } finally {
      setAddingCredits(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pendente', className: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20' },
      processing: { label: 'Processando', className: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' },
      completed: { label: 'Concluída', className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20' },
      failed: { label: 'Falhou', className: 'bg-red-500/10 text-red-500 hover:bg-red-500/20' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Filtros aplicados
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                         u.fullName?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesPlan = userPlanFilter === 'all' || u.plan === userPlanFilter;
    return matchesSearch && matchesPlan;
  });

  const filteredAnalyses = analyses.filter(a => {
    const matchesSearch = a.companyName?.toLowerCase().includes(analysisSearch.toLowerCase()) ||
                         a.targetPhone.includes(analysisSearch);
    const matchesStatus = analysisStatusFilter === 'all' || a.status === analysisStatusFilter;
    const matchesPersona = analysisPersonaFilter === 'all' || a.persona === analysisPersonaFilter;
    return matchesSearch && matchesStatus && matchesPersona;
  });

  // Métricas
  const totalUsers = users.length;
  const totalAnalyses = analyses.length;
  const processingAnalyses = analyses.filter(a => a.status === 'processing').length;
  const completedAnalyses = analyses.filter(a => a.status === 'completed').length;
  const failedAnalyses = analyses.filter(a => a.status === 'failed').length;
  const successRate = totalAnalyses > 0 
    ? Math.round((completedAnalyses / (completedAnalyses + failedAnalyses)) * 100) 
    : 0;

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
        {/* Métricas Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">Cadastrados na plataforma</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Análises</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAnalyses}</div>
              <p className="text-xs text-muted-foreground mt-1">Todas as análises criadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{processingAnalyses}</div>
              <p className="text-xs text-muted-foreground mt-1">Análises processando</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">{completedAnalyses} concluídas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="analyses">Análises</TabsTrigger>
          </TabsList>

          {/* Tab: Usuários */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Usuários Cadastrados</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por email..."
                        className="pl-8 w-64"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                      />
                    </div>
                    <Select value={userPlanFilter} onValueChange={setUserPlanFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Plano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Créditos</TableHead>
                      <TableHead>Total Análises</TableHead>
                      <TableHead>Completas</TableHead>
                      <TableHead>Taxa Sucesso</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((userData) => (
                      <TableRow key={userData.id}>
                        <TableCell className="font-medium">{userData.email}</TableCell>
                        <TableCell><Badge variant="secondary">{userData.plan}</Badge></TableCell>
                        <TableCell>{userData.credits}</TableCell>
                        <TableCell>{userData.totalAnalyses}</TableCell>
                        <TableCell>{userData.completedAnalyses}</TableCell>
                        <TableCell>{userData.successRate}%</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(userData.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Dialog open={dialogOpen && selectedUserId === userData.id} onOpenChange={(open) => {
                            setDialogOpen(open);
                            if (!open) setSelectedUserId(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setSelectedUserId(userData.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Créditos
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Adicionar Créditos</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Usuário</Label>
                                  <p className="text-sm text-muted-foreground">{userData.email}</p>
                                  <p className="text-xs text-muted-foreground">Créditos atuais: {userData.credits}</p>
                                </div>
                                <div>
                                  <Label htmlFor="credits">Quantidade de Créditos</Label>
                                  <Input
                                    id="credits"
                                    type="number"
                                    min="1"
                                    value={creditsToAdd}
                                    onChange={(e) => setCreditsToAdd(Number(e.target.value))}
                                    placeholder="Ex: 10"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={handleAddCredits} disabled={addingCredits}>
                                  {addingCredits ? 'Adicionando...' : 'Confirmar'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                    }
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Análises */}
          <TabsContent value="analyses" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Análises Realizadas</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar empresa ou telefone..."
                        className="pl-8 w-64"
                        value={analysisSearch}
                        onChange={(e) => setAnalysisSearch(e.target.value)}
                      />
                    </div>
                    <Select value={analysisStatusFilter} onValueChange={setAnalysisStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="processing">Processando</SelectItem>
                        <SelectItem value="completed">Concluída</SelectItem>
                        <SelectItem value="failed">Falhou</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={analysisPersonaFilter} onValueChange={setAnalysisPersonaFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Persona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="interested">Interessado</SelectItem>
                        <SelectItem value="skeptical">Cético</SelectItem>
                        <SelectItem value="demanding">Exigente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnalyses.map((analysis) => (
                      <TableRow key={analysis.id}>
                        <TableCell className="font-mono text-xs">{analysis.id.substring(0, 8)}</TableCell>
                        <TableCell className="text-sm">{analysis.userEmail}</TableCell>
                        <TableCell>{analysis.companyName || 'N/A'}</TableCell>
                        <TableCell className="text-sm">{analysis.targetPhone}</TableCell>
                        <TableCell><Badge variant="outline">{analysis.persona}</Badge></TableCell>
                        <TableCell>{getStatusBadge(analysis.status)}</TableCell>
                        <TableCell>{analysis.experienceScore ? `${analysis.experienceScore}/10` : '-'}</TableCell>
                        <TableCell>{analysis.retryCount}</TableCell>
                        <TableCell className="text-sm">{analysis.duration || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(analysis.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))
                    }
                    {filteredAnalyses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          Nenhuma análise encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
