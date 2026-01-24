-- Add demo_user permissions to role_permissions table
INSERT INTO public.role_permissions (role, permission) VALUES
  ('demo_user', 'incident:read'),
  ('demo_user', 'logs:read'),
  ('demo_user', 'dashboard:read'),
  ('demo_user', 'compliance:read'),
  ('demo_user', 'reports:read'),
  ('demo_user', 'integrations:read'),
  ('demo_user', 'analytics:read'),
  ('demo_user', 'playbooks:read'),
  ('demo_user', 'mitre:read')
ON CONFLICT (role, permission) DO NOTHING;

-- Create function to check if user is demo user
CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
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
      AND role = 'demo_user'
  )
$$;