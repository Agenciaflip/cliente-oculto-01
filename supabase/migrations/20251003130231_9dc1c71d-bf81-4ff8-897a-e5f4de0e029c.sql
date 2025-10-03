-- Remove old cron job if exists
SELECT cron.unschedule('monitor-conversations-every-30s');

-- Create trigger function to call monitor-conversations
CREATE OR REPLACE FUNCTION trigger_monitor_conversations()
RETURNS trigger AS $$
BEGIN
  -- Only trigger if it's an unprocessed user message
  IF NEW.role = 'user' AND (NEW.metadata->>'processed')::boolean = false THEN
    PERFORM net.http_post(
      url := 'https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/monitor-conversations',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0am5ibXZmampwaGxqY2F2cm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTAxMTYsImV4cCI6MjA3NDk4NjExNn0.S6BQiIp1yYE6sfT9jyAMBLXdaSsL-KvlgNlWuU3X0hk"}'::jsonb,
      body := json_build_object('analysis_id', NEW.analysis_id)::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on conversation_messages
DROP TRIGGER IF EXISTS on_message_insert ON conversation_messages;

CREATE TRIGGER on_message_insert
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_monitor_conversations();