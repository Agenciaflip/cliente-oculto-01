-- Create user_roles table if not exists
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all analyses" ON public.analysis_requests;
DROP POLICY IF EXISTS "Admins can update all analyses" ON public.analysis_requests;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.conversation_messages;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Policy for user_roles table - only admins can manage
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy for users to view their own role
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Update analysis_requests policies to allow admin access
CREATE POLICY "Admins can view all analyses"
ON public.analysis_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all analyses"
ON public.analysis_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update conversation_messages policies to allow admin access
CREATE POLICY "Admins can view all messages"
ON public.conversation_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update profiles policies to allow admin access
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));