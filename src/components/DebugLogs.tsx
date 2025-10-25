import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface DebugLogsProps {
  analysisId: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  data?: any;
}

export function DebugLogs({ analysisId }: DebugLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Escutar por mudanças no metadata da análise
    const channel = supabase
      .channel(`debug-logs-${analysisId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'analysis_requests',
          filter: `id=eq.${analysisId}`
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.metadata?.debug_logs) {
            setLogs(newData.metadata.debug_logs);
          }
        }
      )
      .subscribe();

    // Carregar logs iniciais
    loadLogs();

    return () => {
      channel.unsubscribe();
    };
  }, [analysisId]);

  async function loadLogs() {
    const { data } = await supabase
      .from('analysis_requests')
      .select('metadata')
      .eq('id', analysisId)
      .single();

    if (data?.metadata?.debug_logs) {
      setLogs(data.metadata.debug_logs);
    }
  }

  // Atalho de teclado: Ctrl+Shift+D para mostrar/esconder
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 text-white px-3 py-1 rounded text-xs hover:bg-gray-700"
        >
          🐛 Debug Logs
        </button>
      </div>
    );
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '📋';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 z-50">
      <Card className="shadow-xl border-2 border-gray-700">
        <CardHeader className="pb-3 bg-gray-900 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              🐛 Debug Logs (Ctrl+Shift+D)
            </CardTitle>
            <button
              onClick={() => setIsVisible(false)}
              className="hover:bg-gray-800 rounded px-2"
            >
              ✕
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-96 bg-black text-gray-100 overflow-y-auto">
            <div className="p-3 space-y-2 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhum log ainda. Aguardando atividade...
                </p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="border-l-2 border-gray-700 pl-2 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${getLevelColor(log.level)}`} />
                      <span className="text-gray-500 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {log.level}
                      </Badge>
                    </div>
                    <div className="text-gray-200 whitespace-pre-wrap">
                      {getLevelIcon(log.level)} {log.message}
                    </div>
                    {log.data && (
                      <details className="mt-1">
                        <summary className="text-gray-500 cursor-pointer hover:text-gray-400">
                          Ver dados
                        </summary>
                        <pre className="text-[10px] text-gray-400 mt-1 overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
