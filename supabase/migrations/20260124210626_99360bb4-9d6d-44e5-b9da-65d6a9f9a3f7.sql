-- Fix agent_licenses access + support hour-based expiry

-- 1) Ensure admin role has baseline permissions used by backend RLS
INSERT INTO public.role_permissions (role, permission)
SELECT 'admin'::public.app_role, p
FROM unnest(ARRAY['users:manage','settings:manage','incident:read']) AS p
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = 'admin'::public.app_role AND rp.permission = p
);

-- 2) Update RLS policies so roles that can manage Data Sources can also view/manage licenses
DROP POLICY IF EXISTS "Admins can manage licenses" ON public.agent_licenses;
DROP POLICY IF EXISTS "Analysts can view licenses" ON public.agent_licenses;

CREATE POLICY "License managers can manage licenses"
ON public.agent_licenses
FOR ALL
USING (
  public.has_permission(auth.uid(), 'users:manage') OR
  public.has_permission(auth.uid(), 'settings:manage')
)
WITH CHECK (
  public.has_permission(auth.uid(), 'users:manage') OR
  public.has_permission(auth.uid(), 'settings:manage')
);

CREATE POLICY "Users can view licenses"
ON public.agent_licenses
FOR SELECT
USING (
  public.has_permission(auth.uid(), 'incident:read') OR
  public.has_permission(auth.uid(), 'users:manage') OR
  public.has_permission(auth.uid(), 'settings:manage')
);

-- 3) Update generator to allow expiry in hours (keep days for backwards compatibility)
CREATE OR REPLACE FUNCTION public.generate_agent_license(
  _data_source_id uuid,
  _organization_name text,
  _license_type text DEFAULT 'standard'::text,
  _max_agents integer DEFAULT 1,
  _expires_days integer DEFAULT 365,
  _expires_hours integer DEFAULT NULL
)
RETURNS TABLE(license_key text, license_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key TEXT;
  v_license_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_hours INTEGER;
BEGIN
  -- Generate secure license key: SOCM-XXXX-XXXX-XXXX-XXXX
  v_key := 'SOCM-' || 
           upper(substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 4)) || '-' ||
           upper(substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 4)) || '-' ||
           upper(substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 4)) || '-' ||
           upper(substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 4));

  v_hours := COALESCE(_expires_hours, GREATEST(_expires_days, 1) * 24);
  v_expires_at := now() + make_interval(hours => v_hours);
  
  INSERT INTO public.agent_licenses (
    license_key,
    license_hash,
    data_source_id,
    organization_name,
    license_type,
    max_agents,
    expires_at,
    created_by
  )
  VALUES (
    v_key,
    extensions.crypt(v_key, extensions.gen_salt('bf')),
    _data_source_id,
    _organization_name,
    _license_type,
    _max_agents,
    v_expires_at,
    auth.uid()
  )
  RETURNING id INTO v_license_id;
  
  RETURN QUERY SELECT v_key, v_license_id;
END;
$$;