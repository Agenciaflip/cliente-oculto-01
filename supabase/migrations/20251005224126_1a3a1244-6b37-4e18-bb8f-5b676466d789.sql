-- Fix get_all_users_for_admin with LEFT JOIN and proper type casting
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
    u.id AS user_id,
    u.email::text AS email,
    p.full_name,
    COALESCE(p.plan, 'free') AS plan,
    COALESCE(p.credits_remaining, 0) AS credits_remaining,
    COALESCE(p.subscription_tier, 'free'::subscription_tier) AS subscription_tier,
    COALESCE(p.created_at, u.created_at) AS created_at,
    p.last_activity_at
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  ORDER BY COALESCE(p.created_at, u.created_at) DESC;
END;
$$;

-- Backfill missing profiles
INSERT INTO public.profiles (id, subscription_tier, credits_remaining)
SELECT u.id, 'free'::subscription_tier, 5
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;