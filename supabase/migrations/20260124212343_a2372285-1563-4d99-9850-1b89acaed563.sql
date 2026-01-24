-- Make licenses active by default
ALTER TABLE public.agent_licenses
  ALTER COLUMN is_active SET DEFAULT true;

UPDATE public.agent_licenses
SET is_active = true
WHERE is_active IS NULL;

-- Bindings table to track unique agents per license (by hardware_id)
CREATE TABLE IF NOT EXISTS public.agent_license_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.agent_licenses(id) ON DELETE CASCADE,
  hardware_id text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_license_bindings_license_hardware_uidx
  ON public.agent_license_bindings (license_id, hardware_id);

CREATE INDEX IF NOT EXISTS agent_license_bindings_last_seen_idx
  ON public.agent_license_bindings (license_id, last_seen_at DESC);

ALTER TABLE public.agent_license_bindings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agent_license_bindings'
      AND policyname = 'Admins manage license bindings'
  ) THEN
    CREATE POLICY "Admins manage license bindings"
    ON public.agent_license_bindings
    FOR ALL
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'ciso'::public.app_role)
      OR public.has_role(auth.uid(), 'soc_manager'::public.app_role)
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'ciso'::public.app_role)
      OR public.has_role(auth.uid(), 'soc_manager'::public.app_role)
    );
  END IF;
END $$;

-- Replace validate_agent_license to avoid incrementing on every validate
-- and enforce agent limit by unique hardware_id within a rolling window.
DROP FUNCTION IF EXISTS public.validate_agent_license(text);

CREATE OR REPLACE FUNCTION public.validate_agent_license(
  _license_key text,
  _hardware_id text DEFAULT NULL
)
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
  v_active_count integer;
  v_max integer;
  v_is_new_binding boolean := false;
  v_window interval := interval '2 hours';
BEGIN
  SELECT al.*, EXTRACT(DAY FROM (al.expires_at - now()))::INTEGER AS days_left
  INTO v_record
  FROM public.agent_licenses al
  WHERE al.license_key = _license_key
    AND COALESCE(al.is_active, true) = true
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ,
                        NULL::INTEGER, NULL::INTEGER, NULL::INTEGER,
                        'Invalid or inactive license key'::TEXT;
    RETURN;
  END IF;

  v_days_left := v_record.days_left;
  v_max := COALESCE(v_record.max_agents, 1);

  IF v_record.expires_at < now() THEN
    RETURN QUERY SELECT false, v_record.license_type, v_record.organization_name,
                        v_record.expires_at, v_days_left, v_max,
                        COALESCE(v_record.active_agents, 0), 'License has expired'::TEXT;
    RETURN;
  END IF;

  -- If hardware_id missing, do not mutate counters; just validate expiry/active
  IF _hardware_id IS NULL OR length(trim(_hardware_id)) = 0 THEN
    RETURN QUERY SELECT true, v_record.license_type, v_record.organization_name,
                        v_record.expires_at, v_days_left, v_max,
                        COALESCE(v_record.active_agents, 0), NULL::TEXT;
    RETURN;
  END IF;

  -- Count active bindings in rolling window
  SELECT count(*)::int
  INTO v_active_count
  FROM public.agent_license_bindings b
  WHERE b.license_id = v_record.id
    AND b.is_active = true
    AND b.last_seen_at > now() - v_window;

  -- Is this a new hardware?
  PERFORM 1
  FROM public.agent_license_bindings b
  WHERE b.license_id = v_record.id
    AND b.hardware_id = _hardware_id
  LIMIT 1;

  IF NOT FOUND THEN
    v_is_new_binding := true;
  END IF;

  -- Enforce max agents only for non-unlimited licenses
  IF v_record.license_type != 'unlimited' AND v_is_new_binding AND v_active_count >= v_max THEN
    RETURN QUERY SELECT false, v_record.license_type, v_record.organization_name,
                        v_record.expires_at, v_days_left, v_max,
                        v_active_count, 'Maximum agent limit reached'::TEXT;
    RETURN;
  END IF;

  -- Upsert binding + bump last_seen
  INSERT INTO public.agent_license_bindings (license_id, hardware_id, first_seen_at, last_seen_at, is_active)
  VALUES (v_record.id, _hardware_id, now(), now(), true)
  ON CONFLICT (license_id, hardware_id)
  DO UPDATE SET last_seen_at = now(), is_active = true;

  -- Recompute active count (may have increased if new)
  SELECT count(*)::int
  INTO v_active_count
  FROM public.agent_license_bindings b
  WHERE b.license_id = v_record.id
    AND b.is_active = true
    AND b.last_seen_at > now() - v_window;

  UPDATE public.agent_licenses al
  SET last_validated = now(),
      active_agents = v_active_count,
      updated_at = now()
  WHERE al.id = v_record.id;

  RETURN QUERY SELECT true, v_record.license_type, v_record.organization_name,
                      v_record.expires_at, v_days_left, v_max,
                      v_active_count, NULL::TEXT;
END;
$function$;

-- Ensure generate_agent_license inserts active licenses explicitly
-- (both overloads are kept)
CREATE OR REPLACE FUNCTION public.generate_agent_license(
  _data_source_id uuid,
  _organization_name text,
  _license_type text DEFAULT 'standard'::text,
  _max_agents integer DEFAULT 1,
  _expires_days integer DEFAULT 365
)
RETURNS TABLE(license_key text, license_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key TEXT;
  v_license_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_key := 'SOCM-' || 
           upper(substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 4)) || '-' ||
           upper(substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 4)) || '-' ||
           upper(substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 4)) || '-' ||
           upper(substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 4));

  v_expires_at := now() + (_expires_days || ' days')::interval;

  INSERT INTO public.agent_licenses (
    license_key,
    license_hash,
    data_source_id,
    organization_name,
    license_type,
    max_agents,
    expires_at,
    created_by,
    is_active
  )
  VALUES (
    v_key,
    extensions.crypt(v_key, extensions.gen_salt('bf')),
    _data_source_id,
    _organization_name,
    _license_type,
    _max_agents,
    v_expires_at,
    auth.uid(),
    true
  )
  RETURNING id INTO v_license_id;

  RETURN QUERY SELECT v_key, v_license_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_agent_license(
  _data_source_id uuid,
  _organization_name text,
  _license_type text DEFAULT 'standard'::text,
  _max_agents integer DEFAULT 1,
  _expires_days integer DEFAULT 365,
  _expires_hours integer DEFAULT NULL::integer
)
RETURNS TABLE(license_key text, license_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key TEXT;
  v_license_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_hours INTEGER;
BEGIN
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
    created_by,
    is_active
  )
  VALUES (
    v_key,
    extensions.crypt(v_key, extensions.gen_salt('bf')),
    _data_source_id,
    _organization_name,
    _license_type,
    _max_agents,
    v_expires_at,
    auth.uid(),
    true
  )
  RETURNING id INTO v_license_id;

  RETURN QUERY SELECT v_key, v_license_id;
END;
$function$;