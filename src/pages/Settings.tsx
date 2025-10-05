import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, User, Mail, Building2 } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    notification_email: "",
    company_logo: "",
  });
  const [logoPreview, setLogoPreview] = useState<string>("");

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, notification_email, company_logo")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          full_name: data.full_name || "",
          notification_email: data.notification_email || "",
          company_logo: data.company_logo || "",
        });
        
        if (data.company_logo) {
          const { data: { publicUrl } } = supabase.storage
            .from("company-logos")
            .getPublicUrl(data.company_logo);
          setLogoPreview(publicUrl);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validação
    if (!file.type.match(/image\/(jpeg|png)/)) {
      toast({
        title: "Formato inválido",
        description: "Apenas JPG e PNG são permitidos",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Tamanho máximo: 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload para Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Atualizar perfil
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ company_logo: fileName })
        .eq("id", user?.id);

      if (updateError) throw updateError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("company-logos")
        .getPublicUrl(fileName);

      setLogoPreview(publicUrl);
      setProfile({ ...profile, company_logo: fileName });

      toast({
        title: "Logo atualizado!",
        description: "Seu logo foi salvo com sucesso",
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro ao fazer upload",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          notification_email: profile.notification_email,
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas",
      });
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Configurações do Perfil</h1>
          <p className="text-sm text-muted-foreground">Personalize suas informações e logo da empresa</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-6">
          {/* Logo da Empresa */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Logo da Empresa
              </CardTitle>
              <CardDescription>
                Seu logo aparecerá no dashboard e nos relatórios em PDF (JPG/PNG, max 2MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6 items-center">
                {/* Preview */}
                <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/30">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo da empresa"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <Building2 className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex-1">
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                      <Upload className="h-5 w-5" />
                      <div>
                        <p className="font-medium">
                          {uploading ? "Fazendo upload..." : "Escolher arquivo"}
                        </p>
                        <p className="text-sm text-muted-foreground">JPG ou PNG até 2MB</p>
                      </div>
                    </div>
                  </Label>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informações Pessoais */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>
                Atualize seu nome e email para notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  placeholder="Seu nome completo"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notification_email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email para Notificações
                </Label>
                <Input
                  id="notification_email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={profile.notification_email}
                  onChange={(e) => setProfile({ ...profile, notification_email: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  Receberá alertas quando análises forem concluídas
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
