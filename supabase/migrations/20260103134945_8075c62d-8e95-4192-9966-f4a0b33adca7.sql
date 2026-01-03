
-- Create permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (role, permission)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policy for permissions
CREATE POLICY "Anyone can read permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (true);

-- Insert all role permissions
INSERT INTO public.role_permissions (role, permission) VALUES
-- SOC Tier 1 permissions
('soc_tier_1', 'incident:read'),
('soc_tier_1', 'incident:update_status'),
('soc_tier_1', 'incident:add_notes'),
('soc_tier_1', 'incident:escalate'),
('soc_tier_1', 'evidence:view'),

-- SOC Tier 2 permissions
('soc_tier_2', 'incident:read'),
('soc_tier_2', 'incident:update_status'),
('soc_tier_2', 'incident:add_notes'),
('soc_tier_2', 'incident:escalate'),
('soc_tier_2', 'evidence:view'),
('soc_tier_2', 'incident:assign'),
('soc_tier_2', 'playbook:simulate'),
('soc_tier_2', 'incident:update_severity'),
('soc_tier_2', 'evidence:link'),

-- SOC Tier 3 permissions
('soc_tier_3', 'incident:read'),
('soc_tier_3', 'incident:update_status'),
('soc_tier_3', 'incident:add_notes'),
('soc_tier_3', 'incident:escalate'),
('soc_tier_3', 'evidence:view'),
('soc_tier_3', 'incident:assign'),
('soc_tier_3', 'playbook:simulate'),
('soc_tier_3', 'incident:update_severity'),
('soc_tier_3', 'evidence:link'),
('soc_tier_3', 'playbook:execute_real'),
('soc_tier_3', 'incident:close'),
('soc_tier_3', 'incident:approve_actions'),
('soc_tier_3', 'containment:execute'),

-- SOC Manager permissions
('soc_manager', 'incident:read'),
('soc_manager', 'incident:update_status'),
('soc_manager', 'incident:add_notes'),
('soc_manager', 'incident:escalate'),
('soc_manager', 'evidence:view'),
('soc_manager', 'incident:assign'),
('soc_manager', 'playbook:simulate'),
('soc_manager', 'incident:update_severity'),
('soc_manager', 'evidence:link'),
('soc_manager', 'playbook:execute_real'),
('soc_manager', 'incident:close'),
('soc_manager', 'incident:approve_actions'),
('soc_manager', 'containment:execute'),
('soc_manager', 'incident:override'),
('soc_manager', 'team:manage_assignments'),
('soc_manager', 'analytics:view'),
('soc_manager', 'reports:view'),
('soc_manager', 'users:manage'),
('soc_manager', 'settings:view'),

-- GRC Engineer permissions
('grc_engineer', 'incident:read'),
('grc_engineer', 'audit_logs:read'),
('grc_engineer', 'compliance:view'),
('grc_engineer', 'reports:export'),
('grc_engineer', 'reports:view'),
('grc_engineer', 'evidence:view'),

-- CISO permissions
('ciso', 'incident:read'),
('ciso', 'incident:critical_view'),
('ciso', 'dashboard:executive'),
('ciso', 'reports:executive'),
('ciso', 'reports:view'),
('ciso', 'analytics:view'),
('ciso', 'audit_logs:read'),
('ciso', 'compliance:view'),
('ciso', 'incident:approve_actions'),
('ciso', 'users:manage'),
('ciso', 'settings:view'),
('ciso', 'settings:manage');

-- Create has_permission function
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  )
$$;

-- Function to get all permissions for a user
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT rp.permission)
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  WHERE ur.user_id = _user_id
$$;

-- Update existing users from old roles to new roles
UPDATE public.user_roles SET role = 'soc_tier_1' WHERE role = 'viewer';
UPDATE public.user_roles SET role = 'soc_tier_2' WHERE role = 'soc_analyst';
UPDATE public.user_roles SET role = 'ciso' WHERE role = 'admin';

-- Update handle_new_user function to use new default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Assign default SOC Tier 1 role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'soc_tier_1');
  
  RETURN NEW;
END;
$function$;
