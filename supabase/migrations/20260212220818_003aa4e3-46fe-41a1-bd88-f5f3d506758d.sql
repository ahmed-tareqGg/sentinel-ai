-- Add display_name column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Drop restrictive SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;

-- Create a single policy that allows all authenticated users to read profiles
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to read user_roles (for role badges)
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Managers can view all roles" ON public.user_roles;

CREATE POLICY "Authenticated users can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Also allow managers to view all roles (for management)
CREATE POLICY "Managers can view all roles for management"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'users:manage'::text));