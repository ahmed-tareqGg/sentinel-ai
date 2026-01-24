-- Fix validate_agent_license ambiguity + NULL handling to prevent 500s

-- Ensure sensible defaults (prevents NULL math/comparisons)
ALTER TABLE public.agent_licenses
  ALTER COLUMN active_agents SET DEFAULT 0;

UPDATE public.agent_licenses
SET active_agents = 0
WHERE active_agents IS NULL;

ALTER TABLE public.agent_licenses
  ALTER COLUMN max_agents SET DEFAULT 1;

UPDATE public.agent_licenses
SET max_agents = 1
WHERE max_agents IS NULL;

-- Replace function with alias-qualified UPDATE and COALESCE
CREATE OR REPLACE FUNCTION public.validate_agent_license(_license_key text)
RETURNS TABLE(
  is_valid boolean,
  license_type text,
  organization_name text,
  expires_at timestamp with time zone,
  days_remaining integer,
  max_agents integer,
  active_agents integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record RECORD;
  v_days_left integer;
  v_active integer;
  v_max integer;
BEGIN
  -- Find license
  SELECT al.*, EXTRACT(DAY FROM (al.expires_at - now()))::INTEGER as days_left
  INTO v_record
  FROM public.agent_licenses al
  WHERE al.license_key = _license_key
    AND al.is_active = true
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE,
                        NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, 'Invalid license key'::TEXT;
    RETURN;
  END IF;

  v_days_left := v_record.days_left;
  v_active := COALESCE(v_record.active_agents, 0);
  v_max := COALESCE(v_record.max_agents, 1);

  -- Check expiration
  IF v_record.expires_at < now() THEN
    RETURN QUERY SELECT false, v_record.license_type, v_record.organization_name,
                        v_record.expires_at, v_days_left, v_max,
                        v_active, 'License has expired'::TEXT;
    RETURN;
  END IF;

  -- Check agent limit
  IF v_active >= v_max AND v_record.license_type != 'unlimited' THEN
    RETURN QUERY SELECT false, v_record.license_type, v_record.organization_name,
                        v_record.expires_at, v_days_left, v_max,
                        v_active, 'Maximum agent limit reached'::TEXT;
    RETURN;
  END IF;

  -- Update last validated + increment active_agents
  UPDATE public.agent_licenses al
  SET last_validated = now(),
      active_agents = COALESCE(al.active_agents, 0) + 1,
      updated_at = now()
  WHERE al.id = v_record.id;

  RETURN QUERY SELECT true, v_record.license_type, v_record.organization_name,
                      v_record.expires_at, v_days_left, v_max,
                      v_active + 1, NULL::TEXT;
END;
$function$;