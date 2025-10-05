import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Loader2, Users, BarChart3, Activity, CheckCircle, Search, Plus, TrendingUp, Target, Award, Eye, MessageSquare, Send, Clock, AlertCircle, CheckCircle2, Trash2, Shield, ShieldOff } from "lucide-react";
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
  isAdmin: boolean;
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

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null };
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

const Admin = () => {
  const { user, logout } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [salesAnalyses, setSalesAnalyses] = useState<SalesAnalysisData[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Filtros
  const [userSearch, setUserSearch] = useState("");
  const [userPlanFilter, setUserPlanFilter] = useState("all");
  const [analysisSearch, setAnalysisSearch] = useState("");
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState("all");
  const [analysisPersonaFilter, setAnalysisPersonaFilter] = useState("all");
  const [salesSearch, setSalesSearch] = useState("");
  const [salesScoreFilter, setSalesScoreFilter] = useState("all");
  const [salesMethodologyFilter, setSalesMethodologyFilter] = useState("all");
  const [supportStatusFilter, setSupportStatusFilter] = useState("all");
  
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
      loadTickets();
    }
  }, [isAdmin, adminLoading, supportStatusFilter]);

  // Realtime updates para análises
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('admin-analyses-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analysis_requests'
        },
        (payload) => {
          console.log('Análise atualizada em tempo real:', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
      subscribeToMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar usuários com emails usando a function segura
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_all_users_for_admin');

      if (usersError) throw usersError;

      // Buscar análises de cada usuário para métricas e verificar se é admin
      const usersWithMetrics = await Promise.all(
        (usersData || []).map(async (userData: any) => {
          const { data: analyses } = await supabase
            .from('analysis_requests')
            .select('id, status')
            .eq('user_id', userData.user_id);

          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userData.user_id)
            .eq('role', 'admin')
            .maybeSingle();

          const totalAnalyses = analyses?.length || 0;
          const completedAnalyses = analyses?.filter((a) => a.status === 'completed').length || 0;
          const successRate = totalAnalyses > 0 ? Math.round((completedAnalyses / totalAnalyses) * 100) : 0;

          return {
            id: userData.user_id,
            email: userData.email,
            fullName: userData.full_name,
            plan: userData.plan || 'free',
            credits: userData.credits_remaining || 0,
            totalAnalyses,
            completedAnalyses,
            successRate,
            lastActivity: userData.last_activity_at,
            createdAt: userData.created_at,
            isAdmin: !!roleData
          };
        })
      );

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

        const userEmail = usersWithMetrics.find(u => u.id === analysis.user_id)?.email || 'N/A';

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

      setUsers(usersWithMetrics);
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

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`⚠️ ATENÇÃO: Tem certeza que deseja excluir o usuário ${userEmail}?\n\nEsta ação irá:\n- Deletar todas as análises do usuário\n- Deletar todas as mensagens\n- Deletar todos os dados permanentemente\n\nEsta ação NÃO pode ser desfeita!`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: userId }
      });

      if (error) throw error;

      toast.success(`✅ Usuário ${userEmail} excluído com sucesso!`);
      await loadData();
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      toast.error(`❌ Erro ao excluir usuário: ${error.message}`);
    }
  };

  const handleToggleAdmin = async (userId: string, userEmail: string, currentlyAdmin: boolean) => {
    const action = currentlyAdmin ? 'demote' : 'promote';
    const actionText = currentlyAdmin ? 'remover permissões de admin' : 'promover a admin';

    if (!confirm(`Tem certeza que deseja ${actionText} do usuário ${userEmail}?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-toggle-role', {
        body: { user_id: userId, action }
      });

      if (error) throw error;

      toast.success(`✅ ${currentlyAdmin ? 'Permissões removidas' : 'Usuário promovido'} com sucesso!`);
      await loadData();
    } catch (error: any) {
      console.error('Erro ao alterar role:', error);
      toast.error(`❌ Erro: ${error.message}`);
    }
  };

  const loadTickets = async () => {
    try {
      let query = supabase
        .from("support_tickets")
        .select(`
          *,
          profiles!inner(full_name)
        `)
        .order("updated_at", { ascending: false });

      if (supportStatusFilter !== "all") {
        query = query.eq("status", supportStatusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
      toast.error('Erro ao carregar tickets');
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const subscribeToMessages = (ticketId: string) => {
    const channel = supabase
      .channel(`admin-ticket-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: user!.id,
        sender_type: "admin",
        message: newMessage.trim(),
      });

      if (error) throw error;

      // Atualizar status para in_progress se estiver open
      if (selectedTicket.status === "open") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress" })
          .eq("id", selectedTicket.id);
        
        setSelectedTicket({ ...selectedTicket, status: "in_progress" });
        loadTickets();
      }
      setNewMessage("");
      toast.success("Mensagem enviada!");
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error("Erro ao enviar mensagem");
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", ticketId);

      if (error) throw error;

      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
      loadTickets();
      toast.success("Status atualizado!");
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error("Erro ao atualizar status");
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
            <TabsTrigger value="support">
              <MessageSquare className="h-4 w-4 mr-2" />
              Suporte ({tickets.filter(t => t.status === 'open').length})
            </TabsTrigger>
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
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {userData.email}
                            {userData.isAdmin && (
                              <Badge variant="default" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{userData.plan}</Badge></TableCell>
                        <TableCell>{userData.credits}</TableCell>
                        <TableCell>{userData.totalAnalyses}</TableCell>
                        <TableCell>{userData.completedAnalyses}</TableCell>
                        <TableCell>{userData.successRate}%</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(userData.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
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
                            
                            <Button
                              size="sm"
                              variant={userData.isAdmin ? "secondary" : "outline"}
                              onClick={() => handleToggleAdmin(userData.id, userData.email, userData.isAdmin)}
                              title={userData.isAdmin ? "Remover permissões de admin" : "Promover a admin"}
                            >
                              {userData.isAdmin ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteUser(userData.id, userData.email)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
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
                      <TableHead>Ações</TableHead>
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
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/analysis/${analysis.id}`)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
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

          {/* Tab: Suporte */}
          <TabsContent value="support" className="space-y-4">
            <div className="grid grid-cols-3 gap-6">
              {/* Lista de Tickets */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Tickets
                  </CardTitle>
                  <Select value={supportStatusFilter} onValueChange={setSupportStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="open">Abertos</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="closed">Fechados</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTicket?.id === ticket.id
                          ? "bg-accent border-primary"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-sm flex-1">{ticket.subject}</p>
                        {ticket.status === 'open' && <AlertCircle className="h-4 w-4 text-green-500" />}
                        {ticket.status === 'in_progress' && <Clock className="h-4 w-4 text-yellow-500" />}
                        {ticket.status === 'closed' && <CheckCircle2 className="h-4 w-4 text-gray-500" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {ticket.status === 'open' ? 'Aberto' : ticket.status === 'in_progress' ? 'Em Andamento' : 'Fechado'}
                        </Badge>
                        <span className={`text-xs ${
                          ticket.priority === 'urgent' ? 'text-red-500' :
                          ticket.priority === 'high' ? 'text-orange-500' :
                          ticket.priority === 'normal' ? 'text-gray-500' : 'text-blue-500'
                        }`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ticket.profiles?.full_name || 'Usuário'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ticket.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                  {tickets.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum ticket encontrado
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Chat do Ticket */}
              <Card className="col-span-2">
                {selectedTicket ? (
                  <>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{selectedTicket.subject}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {selectedTicket.profiles?.full_name || 'Usuário'} • Criado em {format(new Date(selectedTicket.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={selectedTicket.status}
                            onValueChange={(value) => handleUpdateTicketStatus(selectedTicket.id, value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Aberto</SelectItem>
                              <SelectItem value="in_progress">Em Andamento</SelectItem>
                              <SelectItem value="closed">Fechado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col h-[500px]">
                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${
                              msg.sender_type === "admin" ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[80%] p-3 rounded-lg ${
                                msg.sender_type === "admin"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              <p className="text-sm font-medium mb-1">
                                {msg.sender_type === "admin" ? "Você (Admin)" : "Usuário"}
                              </p>
                              <p className="text-sm">{msg.message}</p>
                              <p className="text-xs opacity-70 mt-1">
                                {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Input */}
                      {selectedTicket.status !== "closed" && (
                        <div className="flex gap-2 border-t pt-4">
                          <Textarea
                            placeholder="Digite sua resposta..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            rows={3}
                          />
                          <Button onClick={handleSendMessage} size="icon">
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </>
                ) : (
                  <CardContent className="flex items-center justify-center h-[600px]">
                    <p className="text-muted-foreground">
                      Selecione um ticket para visualizar
                    </p>
                  </CardContent>
                )}
              </Card>
            </div>
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
