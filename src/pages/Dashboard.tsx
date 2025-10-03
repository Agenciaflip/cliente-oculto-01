import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Plus, Eye, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  subscription_tier: string;
  credits_remaining: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Setup auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false); // Marca como carregado após receber estado
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false); // Marca como carregado
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Só redireciona se terminou de carregar E não tem usuário
    if (!isLoading && !user) {
      navigate("/auth");
      return;
    }

    if (!user) return; // Ainda carregando ou sem usuário


    // Fetch profile
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier, credits_remaining")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      setProfile(data);
    };

    // Check admin role
    const checkAdminRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
    };

    // Fetch analyses
    const fetchAnalyses = async () => {
      const { data, error } = await supabase
        .from("analysis_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Error fetching analyses:", error);
        return;
      }

      setAnalyses(data || []);
    };

    fetchProfile();
    fetchAnalyses();
    checkAdminRole();
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Sem usuário (já redirecionou no useEffect)
  if (!user || !profile) {
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
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </Button>
            )}
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
