-- Create agent_licenses table for license management
CREATE TABLE public.agent_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT NOT NULL UNIQUE,
  license_hash TEXT NOT NULL,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE,
  organization_name TEXT,
  license_type TEXT NOT NULL DEFAULT 'standard' CHECK (license_type IN ('trial', 'standard', 'enterprise', 'unlimited')),
  max_agents INTEGER DEFAULT 1,
  active_agents INTEGER DEFAULT 0,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_validated TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage licenses" 
ON public.agent_licenses 
FOR ALL 
USING (public.has_permission(auth.uid(), 'system:configure'));

CREATE POLICY "Analysts can view licenses" 
ON public.agent_licenses 
FOR SELECT 
USING (public.has_permission(auth.uid(), 'incidents:read'));

-- Create function to generate license key
CREATE OR REPLACE FUNCTION public.generate_agent_license(
  _data_source_id UUID,
  _organization_name TEXT,
  _license_type TEXT DEFAULT 'standard',
  _max_agents INTEGER DEFAULT 1,
  _expires_days INTEGER DEFAULT 365
)
RETURNS TABLE(license_key TEXT, license_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key TEXT;
  v_license_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Generate secure license key: SOCM-XXXX-XXXX-XXXX-XXXX
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

-- Create function to validate license
CREATE OR REPLACE FUNCTION public.validate_agent_license(_license_key TEXT)
RETURNS TABLE(
  is_valid BOOLEAN,
  license_type TEXT,
  organization_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  days_remaining INTEGER,
  max_agents INTEGER,
  active_agents INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Find license
  SELECT al.*, 
         EXTRACT(DAY FROM (al.expires_at - now()))::INTEGER as days_left
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
  
  -- Check expiration
  IF v_record.expires_at < now() THEN
    RETURN QUERY SELECT false, v_record.license_type, v_record.organization_name, 
                        v_record.expires_at, v_record.days_left, v_record.max_agents, 
                        v_record.active_agents, 'License has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check agent limit
  IF v_record.active_agents >= v_record.max_agents AND v_record.license_type != 'unlimited' THEN
    RETURN QUERY SELECT false, v_record.license_type, v_record.organization_name, 
                        v_record.expires_at, v_record.days_left, v_record.max_agents, 
                        v_record.active_agents, 'Maximum agent limit reached'::TEXT;
    RETURN;
  END IF;
  
  -- Update last validated
  UPDATE public.agent_licenses 
  SET last_validated = now(), 
      active_agents = active_agents + 1,
      updated_at = now()
  WHERE id = v_record.id;
  
  RETURN QUERY SELECT true, v_record.license_type, v_record.organization_name, 
                      v_record.expires_at, v_record.days_left, v_record.max_agents, 
                      v_record.active_agents + 1, NULL::TEXT;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_agent_licenses_updated_at
  BEFORE UPDATE ON public.agent_licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_licenses;