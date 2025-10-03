import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Activity, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface Profile {
  id: string;
  subscription_tier: string;
  credits_remaining: number;
}

interface Analysis {
  id: string;
  user_id: string;
  status: string;
  target_phone: string;
  company_name: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_message_at: string | null;
}

interface MessageCount {
  analysis_id: string;
  count: number;
}

const Admin = () => {
  const { loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading) {
      loadData();
    }
  }, [adminLoading]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar perfis
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      // Carregar análises
      const { data: analysesData, error: analysesError } = await supabase
        .from('analysis_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (analysesError) throw analysesError;
      setAnalyses(analysesData || []);

      // Carregar contagem de mensagens por análise
      const { data: messagesData, error: messagesError } = await supabase
        .from('conversation_messages')
        .select('analysis_id');

      if (messagesError) throw messagesError;

      const counts: Record<string, number> = {};
      messagesData?.forEach((msg) => {
        counts[msg.analysis_id] = (counts[msg.analysis_id] || 0) + 1;
      });
      setMessageCounts(counts);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      processing: "outline",
      chatting: "default",
      completed: "default",
      error: "destructive",
    };
    
    return (
      <Badge variant={variants[status] || "outline"}>
        {status}
      </Badge>
    );
  };

  const getAnalysisCountForUser = (userId: string) => {
    return analyses.filter(a => a.user_id === userId).length;
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const totalUsers = profiles.length;
  const totalAnalyses = analyses.length;
  const activeAnalyses = analyses.filter(a => a.status === 'chatting' || a.status === 'processing').length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Painel Administrativo</h1>
              <p className="text-muted-foreground mt-1">Gerencie usuários e análises</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Análises</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAnalyses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Análises Ativas</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAnalyses}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>Lista de todos os usuários cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID do Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Análises</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-mono text-xs">{profile.id.slice(0, 8)}...</TableCell>
                    <TableCell>
                      <Badge variant="outline">{profile.subscription_tier}</Badge>
                    </TableCell>
                    <TableCell>{profile.credits_remaining}</TableCell>
                    <TableCell>{getAnalysisCountForUser(profile.id)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Tabela de Análises */}
        <Card>
          <CardHeader>
            <CardTitle>Análises Recentes</CardTitle>
            <CardDescription>Todas as análises do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagens</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Última mensagem</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyses.map((analysis) => (
                  <TableRow key={analysis.id}>
                    <TableCell className="font-medium">{analysis.company_name || 'N/A'}</TableCell>
                    <TableCell>{analysis.target_phone}</TableCell>
                    <TableCell>{getStatusBadge(analysis.status)}</TableCell>
                    <TableCell>{messageCounts[analysis.id] || 0}</TableCell>
                    <TableCell>{format(new Date(analysis.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>
                      {analysis.last_message_at 
                        ? format(new Date(analysis.last_message_at), 'dd/MM/yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/dashboard/analysis/${analysis.id}`)}
                      >
                        Ver Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
