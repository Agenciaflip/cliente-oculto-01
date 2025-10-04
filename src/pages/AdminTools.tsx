import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AdminTools = () => {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingPromote, setLoadingPromote] = useState(false);

  const handleReset = async () => {
    if (!token) {
      toast.error("Informe o RESET_TOKEN");
      return;
    }
    try {
      setLoadingReset(true);
      const { data, error } = await supabase.functions.invoke('admin-reset-users', {
        headers: { 'x-reset-token': token },
      });
      if (error) throw error;
      toast.success(`Reset concluído: ${data?.deletedUsers ?? 0} usuários removidos`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Falha ao resetar');
    } finally {
      setLoadingReset(false);
    }
  };

  const handlePromote = async () => {
    if (!token || !email) {
      toast.error("Informe o RESET_TOKEN e o e-mail");
      return;
    }
    try {
      setLoadingPromote(true);
      const { data, error } = await supabase.functions.invoke('admin-promote-user', {
        headers: { 'x-reset-token': token },
        body: { email },
      });
      if (error) throw error;
      toast.success(`Usuário ${data?.email ?? email} promovido a admin`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Falha ao promover');
    } finally {
      setLoadingPromote(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Ferramentas de Administração (temporárias)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="token">RESET_TOKEN</Label>
            <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o RESET_TOKEN" />
          </div>

          <Button onClick={handleReset} disabled={loadingReset} className="w-full">
            {loadingReset ? 'Resetando...' : 'Resetar TODOS os usuários e dados'}
          </Button>

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <Label htmlFor="email">E-mail para promover a admin</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <Button onClick={handlePromote} disabled={loadingPromote} variant="secondary" className="w-full">
            {loadingPromote ? 'Promovendo...' : 'Promover para Admin'}
          </Button>

          <p className="text-xs text-muted-foreground">
            Segurança: a ação só é executada se o RESET_TOKEN correto for enviado no cabeçalho.
          </p>
        </CardContent>
      </Card>
    </main>
  );
};

export default AdminTools;
