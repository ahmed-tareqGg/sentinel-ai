-- Fix PUBLIC_DATA_EXPOSURE: Restrict profiles table access
-- Drop the overly permissive policy that exposes all user emails
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (id = auth.uid());

-- Admins can view all profiles for user management
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));