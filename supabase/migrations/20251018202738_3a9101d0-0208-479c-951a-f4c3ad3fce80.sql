-- =========================================
-- CORREÇÃO COMPLETA DO SISTEMA DE MONITORAMENTO
-- =========================================

-- 1. Instalar TRIGGER que invoca monitor-conversations
CREATE TRIGGER conversation_messages_notify_monitor 
AFTER INSERT ON public.conversation_messages 
FOR EACH ROW 
EXECUTE FUNCTION public.trigger_monitor_conversations();

-- 2. Habilitar Realtime para analysis_requests (conversation_messages já está)
ALTER TABLE public.analysis_requests REPLICA IDENTITY FULL;

-- Verificar se analysis_requests já está na publicação antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'analysis_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_requests;
  END IF;
END $$;