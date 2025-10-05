import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, User, Mail, Building } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    notification_email: "",
    company_logo: ""
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, notification_email, company_logo")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile({
        full_name: data.full_name || "",
        notification_email: data.notification_email || "",
        company_logo: data.company_logo || ""
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, company_logo: publicUrl }));
      
      toast({
        title: "Logo enviada com sucesso!",
        description: "Clique em salvar para confirmar as alterações."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar logo",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          notification_email: profile.notification_email,
          company_logo: profile.company_logo
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado!",
        description: "Suas configurações foram salvas com sucesso."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">⚙️ Configurações</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie seu perfil e preferências
            </p>
          </div>

          {/* Logo da Empresa */}
          <Card className="border-2 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle>Logo da Empresa</CardTitle>
              </div>
              <CardDescription>
                Sua logo aparecerá nos relatórios em PDF e no header do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.company_logo && (
                <div className="flex justify-center">
                  <img
                    src={profile.company_logo}
                    alt="Logo da empresa"
                    className="h-24 w-24 object-contain rounded-lg border-2 border-primary/20"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="logo" className="cursor-pointer">
                  <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/50 p-6 hover:border-primary transition-colors">
                    <Upload className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">
                      {uploading ? "Enviando..." : "Clique para fazer upload"}
                    </span>
                  </div>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                  />
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Informações Pessoais */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Informações Pessoais</CardTitle>
              </div>
              <CardDescription>
                Atualize suas informações de perfil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  value={profile.full_name}
                  onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Seu nome completo"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notificações */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <CardTitle>E-mail de Notificações</CardTitle>
              </div>
              <CardDescription>
                Receba atualizações e novidades da nossa equipe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail para Notificações</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.notification_email}
                  onChange={(e) => setProfile(prev => ({ ...prev, notification_email: e.target.value }))}
                  placeholder="seu@email.com"
                />
                <p className="text-xs text-muted-foreground">
                  Este e-mail será usado para enviar atualizações sobre o sistema
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={loading}
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {loading ? "Salvando..." : "💾 Salvar Alterações"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
