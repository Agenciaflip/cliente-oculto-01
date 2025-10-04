import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";

interface CategoryScore {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface SalesAnalysisResult {
  id: string;
  analysis_id: string;
  overall_score: number;
  categories: {
    rapport: CategoryScore;
    discovery: CategoryScore;
    value_presentation: CategoryScore;
    objection_handling: CategoryScore;
    closing: CategoryScore;
    professionalism: CategoryScore;
    customer_experience: CategoryScore;
  };
  competitive_positioning: string;
  sales_methodology_detected: string[];
  conversion_probability: number;
  recommended_actions: string[];
  comparative_analysis: string;
  created_at: string;
}

interface SalesAnalysisProps {
  analysis: SalesAnalysisResult;
}

const categoryLabels: Record<string, string> = {
  rapport: "Rapport e Relacionamento",
  discovery: "Descoberta e Qualificação (SPIN/BANT)",
  value_presentation: "Apresentação de Valor",
  objection_handling: "Gestão de Objeções",
  closing: "Técnicas de Fechamento",
  professionalism: "Profissionalismo",
  customer_experience: "Experiência do Cliente",
};

const getScoreColor = (score: number) => {
  if (score >= 8) return "text-green-600 dark:text-green-400";
  if (score >= 6) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
};

const getProgressColor = (score: number) => {
  if (score >= 8) return "bg-green-500";
  if (score >= 6) return "bg-yellow-500";
  return "bg-red-500";
};

export const SalesAnalysis = ({ analysis }: SalesAnalysisProps) => {
  const overallPercentage = (analysis.overall_score / 10) * 100;

  return (
    <div className="space-y-6">
      {/* Nota Geral */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Nota Geral da Análise</span>
            <span className={`text-4xl font-bold ${getScoreColor(analysis.overall_score)}`}>
              {analysis.overall_score.toFixed(1)}/10
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Progress value={overallPercentage} className="h-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium text-white mix-blend-difference">
                {overallPercentage.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              Probabilidade de Conversão
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-bold text-lg">{analysis.conversion_probability}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento por Categoria */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle>📊 Detalhamento por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {Object.entries(analysis.categories).map(([key, category]) => (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-medium">{categoryLabels[key]}</span>
                    <span className={`font-bold ${getScoreColor(category.score)}`}>
                      {category.score.toFixed(1)}/10
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="relative">
                      <Progress value={(category.score / 10) * 100} className="h-3" />
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {category.feedback}
                    </div>

                    {category.strengths.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Pontos Fortes
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {category.strengths.map((strength, idx) => (
                            <Badge key={idx} variant="outline" className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                              {strength}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {category.improvements.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
                          <AlertCircle className="h-4 w-4" />
                          Pontos a Melhorar
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {category.improvements.map((improvement, idx) => (
                            <Badge key={idx} variant="outline" className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                              {improvement}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Posicionamento Competitivo */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>🎯 Posicionamento Competitivo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.competitive_positioning}
          </p>
        </CardContent>
      </Card>

      {/* Metodologias Detectadas */}
      {analysis.sales_methodology_detected.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>📚 Metodologias de Vendas Detectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis.sales_methodology_detected.map((methodology, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm px-3 py-1">
                  {methodology}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações Recomendadas */}
      {analysis.recommended_actions.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>✅ Ações Recomendadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.recommended_actions.map((action, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Checkbox id={`action-${idx}`} className="mt-1" />
                  <label
                    htmlFor={`action-${idx}`}
                    className="text-sm leading-relaxed cursor-pointer"
                  >
                    {action}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análise Comparativa */}
      {analysis.comparative_analysis && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>📈 Análise Comparativa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.comparative_analysis}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
