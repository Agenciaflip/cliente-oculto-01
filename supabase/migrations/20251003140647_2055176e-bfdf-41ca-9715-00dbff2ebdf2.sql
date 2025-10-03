-- Reset stuck analyses that are in 'processing' but have recent messages (< 15 minutes)
-- This happens when the system incorrectly moves to processing while conversation is still active

UPDATE analysis_requests
SET 
  status = 'chatting',
  last_message_at = NOW()
WHERE 
  status = 'processing'
  AND last_message_at > NOW() - INTERVAL '15 minutes';

-- Also reset the specific stuck analysis if it exists
UPDATE analysis_requests
SET 
  status = 'chatting',
  last_message_at = NOW()
WHERE 
  id = '568ac207-e270-49c9-9d26-3c2fa065d648'
  AND status = 'processing';