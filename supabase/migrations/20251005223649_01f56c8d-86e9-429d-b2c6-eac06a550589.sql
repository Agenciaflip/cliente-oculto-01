-- Drop and recreate get_all_users_for_admin with correct types
DROP FUNCTION IF EXISTS public.get_all_users_for_admin();

CREATE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  plan text,
  credits_remaining integer,
  subscription_tier subscription_tier,
  created_at timestamptz,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    p.subscription_tier,
    p.created_at,
    p.last_activity_at
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;