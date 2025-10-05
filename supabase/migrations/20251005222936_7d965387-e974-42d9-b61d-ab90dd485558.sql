-- Function que retorna email de um user_id (somente para admins)
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  -- Verificar se quem está chamando é admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Buscar email de auth.users
  SELECT email INTO _email
  FROM auth.users
  WHERE id = _user_id;
  
  RETURN _email;
END;
$$;

-- Function para buscar TODOS os usuários com emails (para admin)
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  plan text,
  credits_remaining integer,
  subscription_tier text,
  created_at timestamptz,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se é admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id as user_id,
    u.email,
    p.full_name,
    p.plan,
    p.credits_remaining,
    p.subscription_tier::text,
    p.created_at,
    p.last_activity_at
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Function para deletar usuário (dados do banco)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_analyses integer;
  deleted_messages integer;
BEGIN
  -- Verificar se é admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Impedir admin de deletar a si mesmo
  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  
  -- Deletar dados relacionados
  DELETE FROM conversation_messages WHERE analysis_id IN (
    SELECT id FROM analysis_requests WHERE user_id = _target_user_id
  );
  GET DIAGNOSTICS deleted_messages = ROW_COUNT;
  
  DELETE FROM sales_analysis WHERE analysis_id IN (
    SELECT id FROM analysis_requests WHERE user_id = _target_user_id
  );
  
  DELETE FROM analysis_metrics WHERE analysis_id IN (
    SELECT id FROM analysis_requests WHERE user_id = _target_user_id
  );
  
  DELETE FROM analysis_requests WHERE user_id = _target_user_id;
  GET DIAGNOSTICS deleted_analyses = ROW_COUNT;
  
  DELETE FROM support_messages WHERE ticket_id IN (
    SELECT id FROM support_tickets WHERE user_id = _target_user_id
  );
  
  DELETE FROM support_tickets WHERE user_id = _target_user_id;
  DELETE FROM subscriptions WHERE user_id = _target_user_id;
  DELETE FROM usage_tracking WHERE user_id = _target_user_id;
  DELETE FROM user_roles WHERE user_id = _target_user_id;
  DELETE FROM profiles WHERE id = _target_user_id;
  
  RETURN json_build_object(
    'deleted_analyses', deleted_analyses,
    'deleted_messages', deleted_messages,
    'success', true
  );
END;
$$;