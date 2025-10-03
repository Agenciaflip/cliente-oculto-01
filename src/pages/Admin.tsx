import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserData {
  id: string;
  email: string;
  subscription_tier: string;
  credits_remaining: number;
  analyses_count: number;
  last_analysis?: string;
}

interface AnalysisData {
  id: string;
  target_phone: string;
  company_name: string;
  status: string;
  persona: string;
  created_at: string;
  messages_count: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, subscription_tier, credits_remaining')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const usersData: UserData[] = [];
      
      for (const profile of profiles || []) {
        // Get analyses count
        const { count } = await supabase
          .from('analysis_requests')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id);

        // Get last analysis
        const { data: lastAnalysis } = await supabase
          .from('analysis_requests')
          .select('created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        usersData.push({
          id: profile.id,
          email: 'Usuário ' + profile.id.substring(0, 8),
          subscription_tier: profile.subscription_tier,
          credits_remaining: profile.credits_remaining,
          analyses_count: count || 0,
          last_analysis: lastAnalysis?.created_at,
        });
      }

      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const loadUserAnalyses = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('analysis_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const analysesData: AnalysisData[] = [];
      
      for (const analysis of data || []) {
        const { count } = await supabase
          .from('conversation_messages')
          .select('*', { count: 'exact', head: true })
          .eq('analysis_id', analysis.id);

        analysesData.push({
          id: analysis.id,
          target_phone: analysis.target_phone,
          company_name: analysis.company_name || 'N/A',
          status: analysis.status,
          persona: analysis.persona,
          created_at: analysis.created_at,
          messages_count: count || 0,
        });
      }

      setAnalyses(analysesData);
      setSelectedUserId(userId);
    } catch (error) {
      console.error('Error loading analyses:', error);
      toast.error("Erro ao carregar análises");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      processing: "default",
      chatting: "default",
      completed: "outline",
      failed: "destructive",
      timeout: "destructive",
    };

    const labels: Record<string, string> = {
      pending: "Pendente",
      processing: "Processando",
      chatting: "Conversando",
      completed: "Concluída",
      failed: "Falhou",
      timeout: "Timeout",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Painel Administrativo</h1>
            <p className="text-muted-foreground mt-2">Gerencie usuários e análises</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Usuários ({users.length})
              </CardTitle>
              <CardDescription>Lista de todos os usuários da plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Créditos</TableHead>
                      <TableHead>Análises</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium font-mono text-xs">
                          {user.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.subscription_tier}</Badge>
                        </TableCell>
                        <TableCell>{user.credits_remaining}</TableCell>
                        <TableCell>{user.analyses_count}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => loadUserAnalyses(user.id)}
                          >
                            Ver Análises
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Análises do Usuário
              </CardTitle>
              <CardDescription>
                {selectedUserId 
                  ? `Análises selecionadas (${analyses.length})`
                  : "Selecione um usuário para ver suas análises"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedUserId ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Msgs</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyses.map((analysis) => (
                        <TableRow key={analysis.id}>
                          <TableCell className="font-medium">{analysis.target_phone}</TableCell>
                          <TableCell>{analysis.company_name}</TableCell>
                          <TableCell>{getStatusBadge(analysis.status)}</TableCell>
                          <TableCell>{analysis.messages_count}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/dashboard/analysis/${analysis.id}`)}
                            >
                              Ver Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Selecione um usuário para visualizar suas análises
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;
