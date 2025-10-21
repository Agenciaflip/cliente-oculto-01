-- Add INSERT policy to profiles table to allow users to create their own profile
CREATE POLICY "Users can create own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);