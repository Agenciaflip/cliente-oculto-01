import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesAnalysis } from "./SalesAnalysis";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, AlertCircle } from "lucide-react";

interface Analysis {
  id: string;
  target_phone: string;
  company_name: string;
  status: string;
  created_at: string;
}

interface SalesAnalysisTabProps {
  analyses: Analysis[];
  userId: string;
}

export const SalesAnalysisTab = ({ analyses, userId }: SalesAnalysisTabProps) => {
  const [salesAnalyses, setSalesAnalyses] = useState<Record<string, any>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const completedAnalyses = analyses.filter(a => a.status === 'completed');

  useEffect(() => {
    loadSalesAnalyses();
  }, [completedAnalyses.length]);

  const loadSalesAnalyses = async () => {
    if (completedAnalyses.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sales_analysis')
        .select('*')
        .in('analysis_id', completedAnalyses.map(a => a.id));

      if (error) throw error;

      const analysesMap: Record<string, any> = {};
      data?.forEach(analysis => {
        analysesMap[analysis.analysis_id] = analysis;
      });

      setSalesAnalyses(analysesMap);
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSalesAnalysis = async (analysisId: string) => {
    setGenerating(analysisId);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-sales-conversation', {
        body: { analysis_id: analysisId }
      });

      if (error) throw error;

      toast({
        title: "✅ Análise gerada com sucesso!",
        description: "A análise de vendas está pronta para visualização."
      });

      await loadSalesAnalyses();
    } catch (error: any) {
      console.error('Erro ao gerar análise:', error);
      toast({
        title: "❌ Erro ao gerar análise",
        description: error.message || "Ocorreu um erro ao processar a análise.",
        variant: "destructive"
      });
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (completedAnalyses.length === 0) {
    return (
      <Card className="shadow-medium">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma análise completa</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            A análise de vendas está disponível apenas para análises concluídas.
            Complete uma análise primeiro para visualizar insights de vendas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {completedAnalyses.map(analysis => {
        const salesAnalysis = salesAnalyses[analysis.id];

        return (
          <Card key={analysis.id} className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div>
                  <div className="text-lg">{analysis.company_name || 'Empresa'}</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {analysis.target_phone}
                  </div>
                </div>
                {!salesAnalysis && (
                  <Button
                    onClick={() => generateSalesAnalysis(analysis.id)}
                    disabled={generating === analysis.id}
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generating === analysis.id ? 'Gerando...' : 'Gerar Análise de Vendas'}
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                Criada em {new Date(analysis.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </CardDescription>
            </CardHeader>
            {salesAnalysis && (
              <CardContent>
                <SalesAnalysis analysis={salesAnalysis} />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};
