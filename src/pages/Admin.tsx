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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Loader2, Users, BarChart3, Activity, CheckCircle, Search, Plus, TrendingUp, Target, Award, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { SalesAnalysis } from "@/components/SalesAnalysis";

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

interface SalesAnalysisData {
  id: string;
  analysisId: string;
  userEmail: string;
  userName: string | null;
  companyName: string | null;
  overallScore: number;
  conversionProbability: number | null;
  methodologies: string[];
  categories: any;
  competitivePositioning: string | null;
  recommendedActions: string[] | null;
  comparativeAnalysis: string | null;
  createdAt: string;
}

const Admin = () => {
  const { user, logout } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [salesAnalyses, setSalesAnalyses] = useState<SalesAnalysisData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [userSearch, setUserSearch] = useState("");
  const [userPlanFilter, setUserPlanFilter] = useState("all");
  const [analysisSearch, setAnalysisSearch] = useState("");
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState("all");
  const [analysisPersonaFilter, setAnalysisPersonaFilter] = useState("all");
  const [salesSearch, setSalesSearch] = useState("");
  const [salesScoreFilter, setSalesScoreFilter] = useState("all");
  const [salesMethodologyFilter, setSalesMethodologyFilter] = useState("all");
  
  // Dialog de adicionar créditos
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState<number>(0);
  const [addingCredits, setAddingCredits] = useState(false);
  
  // Drawer de detalhes da análise de vendas
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [selectedSalesAnalysis, setSelectedSalesAnalysis] = useState<any | null>(null);

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      loadData();
      loadSalesAnalyses();
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

  const loadSalesAnalyses = async () => {
    try {
      const { data: analysisData, error: analysisError } = await supabase
        .from('analysis_requests')
        .select(`
          id,
          company_name,
          target_phone,
          persona,
          user_id,
          metrics,
          created_at,
          profiles!inner(
            id,
            full_name
          )
        `)
        .eq('status', 'completed')
        .not('metrics', 'is', null)
        .order('created_at', { ascending: false });

      if (analysisError) throw analysisError;

      const processedSales: SalesAnalysisData[] = (analysisData || []).map((analysis: any) => ({
        id: analysis.id,
        analysisId: analysis.id,
        userEmail: analysis.user_id,
        userName: analysis.profiles?.full_name || null,
        companyName: analysis.company_name,
        overallScore: analysis.metrics?.overall_score || 0,
        conversionProbability: analysis.metrics?.customer_experience_score 
          ? Math.round((analysis.metrics.customer_experience_score / 10) * 100) 
          : null,
        methodologies: [],
        categories: analysis.metrics,
        competitivePositioning: null,
        recommendedActions: analysis.metrics?.recommendations || null,
        comparativeAnalysis: analysis.metrics?.summary || null,
        createdAt: analysis.created_at
      }));

      setSalesAnalyses(processedSales);
    } catch (error) {
      console.error('Erro ao carregar análises de vendas:', error);
      toast.error('Erro ao carregar análises de vendas');
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

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 8) return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Excelente</Badge>;
    if (score >= 6) return <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">Bom</Badge>;
    return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">Precisa Melhorar</Badge>;
  };

  const getBestCategory = (categories: any) => {
    if (!categories?.communication_quality) return 'N/A';
    const qualities = categories.communication_quality;
    const entries = Object.entries(qualities).map(([key, value]) => ({
      key,
      score: typeof value === 'number' ? value : 0
    }));
    if (entries.length === 0) return 'N/A';
    const best = entries.reduce((prev, curr) => curr.score > prev.score ? curr : prev);
    return `${best.key} (${best.score}/10)`;
  };

  const getWorstCategory = (categories: any) => {
    if (!categories?.communication_quality) return 'N/A';
    const qualities = categories.communication_quality;
    const entries = Object.entries(qualities).map(([key, value]) => ({
      key,
      score: typeof value === 'number' ? value : 0
    }));
    if (entries.length === 0) return 'N/A';
    const worst = entries.reduce((prev, curr) => curr.score < prev.score ? curr : prev);
    return `${worst.key} (${worst.score}/10)`;
  };

  const handleViewDetails = (salesAnalysis: SalesAnalysisData) => {
    const formattedAnalysis = {
      overall_score: salesAnalysis.overallScore,
      conversion_probability: salesAnalysis.conversionProbability,
      categories: salesAnalysis.categories,
      competitive_positioning: salesAnalysis.competitivePositioning,
      sales_methodology_detected: salesAnalysis.methodologies,
      recommended_actions: salesAnalysis.recommendedActions,
      comparative_analysis: salesAnalysis.comparativeAnalysis
    };
    setSelectedSalesAnalysis(formattedAnalysis);
    setDetailsDrawerOpen(true);
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

  const filteredSalesAnalyses = salesAnalyses.filter(sa => {
    const matchesSearch = sa.companyName?.toLowerCase().includes(salesSearch.toLowerCase()) ||
                         sa.userName?.toLowerCase().includes(salesSearch.toLowerCase());
    const matchesScore = salesScoreFilter === 'all' || 
      (salesScoreFilter === 'high' && sa.overallScore >= 8) ||
      (salesScoreFilter === 'medium' && sa.overallScore >= 6 && sa.overallScore < 8) ||
      (salesScoreFilter === 'low' && sa.overallScore < 6);
    const matchesMethodology = salesMethodologyFilter === 'all' || 
      sa.methodologies.includes(salesMethodologyFilter);
    return matchesSearch && matchesScore && matchesMethodology;
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

  // Métricas de Vendas
  const avgScore = salesAnalyses.length > 0 
    ? salesAnalyses.reduce((sum, sa) => sum + sa.overallScore, 0) / salesAnalyses.length 
    : 0;
  const avgConversion = salesAnalyses.length > 0
    ? salesAnalyses.reduce((sum, sa) => sum + (sa.conversionProbability || 0), 0) / salesAnalyses.length
    : 0;
  
  const methodologyCount = salesAnalyses.reduce((acc, sa) => {
    sa.methodologies.forEach(m => {
      acc[m] = (acc[m] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  
  const mostUsedMethodology = Object.entries(methodologyCount).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];
  const bestPerformer = salesAnalyses.length > 0
    ? salesAnalyses.reduce((best, curr) => curr.overallScore > best.overallScore ? curr : best)
    : null;

  // Insights de categorias
  const categoryAverages: Record<string, number> = {
    clarity: 0,
    empathy: 0,
    completeness: 0,
    professionalism: 0
  };
  
  if (salesAnalyses.length > 0) {
    salesAnalyses.forEach(sa => {
      if (sa.categories?.communication_quality) {
        const qualities = sa.categories.communication_quality;
        Object.entries(qualities).forEach(([key, value]) => {
          if (typeof value === 'number') {
            if (!categoryAverages[key]) categoryAverages[key] = 0;
            categoryAverages[key] += value;
          }
        });
      }
    });
    Object.keys(categoryAverages).forEach(key => {
      categoryAverages[key] = categoryAverages[key] / salesAnalyses.length;
    });
  }

  const categoryLabels: Record<string, string> = {
    clarity: 'Clareza',
    empathy: 'Empatia',
    completeness: 'Completude',
    professionalism: 'Profissionalismo'
  };

  const sortedCategories = Object.entries(categoryAverages)
    .map(([key, avg]) => ({ key, avg, label: categoryLabels[key] || key }))
    .sort((a, b) => b.avg - a.avg);

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
            <TabsTrigger value="sales">Análises de Vendas</TabsTrigger>
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

          {/* Tab: Análises de Vendas */}
          <TabsContent value="sales" className="space-y-4">
            {/* Cards de Métricas de Vendas */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Nota Média Geral</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgScore.toFixed(1)}/10</div>
                  <Progress value={(avgScore / 10) * 100} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">De todas as análises</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa Conv. Média</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgConversion.toFixed(0)}%</div>
                  <Progress value={avgConversion} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">Probabilidade de conversão</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Metodologia + Usada</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold truncate">{mostUsedMethodology[0]}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mostUsedMethodology[1]} vezes ({salesAnalyses.length > 0 ? Math.round((mostUsedMethodology[1] / salesAnalyses.length) * 100) : 0}%)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Melhor Performer</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold truncate">{bestPerformer?.userName || bestPerformer?.userEmail || 'N/A'}</div>
                  <p className="text-xs text-muted-foreground mt-1">Nota: {bestPerformer ? bestPerformer.overallScore.toFixed(1) : 0}/10</p>
                </CardContent>
              </Card>
            </div>

            {/* Card de Insights */}
            {sortedCategories.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>📈 Insights de Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-sm">Top 3 Categorias com Melhor Performance:</h4>
                    <div className="space-y-2">
                      {sortedCategories.slice(0, 3).map((cat, idx) => (
                        <div key={cat.key} className="flex items-center justify-between">
                          <span className="text-sm">{idx + 1}. {cat.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-green-600">{cat.avg.toFixed(1)}/10</span>
                            <Progress value={(cat.avg / 10) * 100} className="w-24 h-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-sm">Top 3 Categorias que Precisam Melhorar:</h4>
                    <div className="space-y-2">
                      {sortedCategories.slice(-3).reverse().map((cat, idx) => (
                        <div key={cat.key} className="flex items-center justify-between">
                          <span className="text-sm">{idx + 1}. {cat.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-yellow-600">{cat.avg.toFixed(1)}/10</span>
                            <Progress value={(cat.avg / 10) * 100} className="w-24 h-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-sm">📚 Distribuição de Metodologias:</h4>
                    <div className="space-y-2">
                      {Object.entries(methodologyCount)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([method, count]) => {
                          const percentage = salesAnalyses.length > 0 ? (count / salesAnalyses.length) * 100 : 0;
                          return (
                            <div key={method} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span>{method}</span>
                                <span className="text-muted-foreground">{percentage.toFixed(0)}%</span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabela de Análises de Vendas */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Análises de Vendas Completas</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar empresa ou usuário..."
                        className="pl-8 w-64"
                        value={salesSearch}
                        onChange={(e) => setSalesSearch(e.target.value)}
                      />
                    </div>
                    <Select value={salesScoreFilter} onValueChange={setSalesScoreFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Nota" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="high">Alta (8-10)</SelectItem>
                        <SelectItem value="medium">Média (6-8)</SelectItem>
                        <SelectItem value="low">Baixa (&lt;6)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={salesMethodologyFilter} onValueChange={setSalesMethodologyFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Metodologia" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {Object.keys(methodologyCount).map(method => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
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
                      <TableHead>Nota Geral</TableHead>
                      <TableHead>Conv. %</TableHead>
                      <TableHead>Metodologias</TableHead>
                      <TableHead>Melhor Cat.</TableHead>
                      <TableHead>Pior Cat.</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSalesAnalyses.map((salesAnalysis) => (
                      <TableRow key={salesAnalysis.id}>
                        <TableCell className="font-mono text-xs">{salesAnalysis.id.substring(0, 8)}</TableCell>
                        <TableCell className="text-sm">{salesAnalysis.userName || salesAnalysis.userEmail.substring(0, 20)}</TableCell>
                        <TableCell>{salesAnalysis.companyName || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${getScoreColor(salesAnalysis.overallScore)}`}>
                              {salesAnalysis.overallScore.toFixed(1)}
                            </span>
                            {getScoreBadge(salesAnalysis.overallScore)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{salesAnalysis.conversionProbability || 0}%</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {salesAnalysis.methodologies.slice(0, 2).map((method, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {method.split(' ')[0]}
                              </Badge>
                            ))}
                            {salesAnalysis.methodologies.length > 2 && (
                              <Badge variant="secondary" className="text-xs">+{salesAnalysis.methodologies.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-green-600">
                          {categoryLabels[getBestCategory(salesAnalysis.categories)] || getBestCategory(salesAnalysis.categories)}
                        </TableCell>
                        <TableCell className="text-sm text-red-600">
                          {categoryLabels[getWorstCategory(salesAnalysis.categories)] || getWorstCategory(salesAnalysis.categories)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(salesAnalysis.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewDetails(salesAnalysis)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSalesAnalyses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          Nenhuma análise de vendas encontrada
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

      {/* Drawer de Detalhes da Análise de Vendas */}
      <Drawer open={detailsDrawerOpen} onOpenChange={setDetailsDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Detalhes da Análise de Vendas</DrawerTitle>
            <DrawerDescription>Visualização completa da análise de performance de vendas</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-6">
            {selectedSalesAnalysis && (
              <SalesAnalysis analysis={selectedSalesAnalysis} />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Admin;
