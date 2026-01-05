-- Create data_sources table for managing log sources/agents
CREATE TABLE public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('linux_agent', 'windows_agent', 'siem', 'syslog', 'api', 'cloud')),
  hostname TEXT,
  ip_address TEXT,
  os_type TEXT CHECK (os_type IN ('linux', 'windows', 'macos', 'other')),
  os_version TEXT,
  agent_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending', 'error')),
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  last_log_received TIMESTAMP WITH TIME ZONE,
  logs_received_today INTEGER DEFAULT 0,
  logs_received_total BIGINT DEFAULT 0,
  api_key_hash TEXT,
  config JSONB DEFAULT '{}',
  log_types TEXT[] DEFAULT ARRAY['auth', 'system', 'security'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create agent_api_keys table for secure agent authentication
CREATE TABLE public.agent_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  key_hash TEXT NOT NULL, -- bcrypt hash of full key
  name TEXT NOT NULL,
  last_used TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create log_ingestion_stats table for tracking ingestion metrics
CREATE TABLE public.log_ingestion_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hour INTEGER CHECK (hour >= 0 AND hour <= 23),
  log_type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  bytes_received BIGINT DEFAULT 0,
  incidents_created INTEGER DEFAULT 0,
  UNIQUE(data_source_id, date, hour, log_type)
);

-- Enable RLS
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_ingestion_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_sources
CREATE POLICY "Authenticated users can view data sources"
  ON public.data_sources FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "SOC managers can manage data sources"
  ON public.data_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'ciso', 'soc_manager', 'soc_tier_3')
    )
  );

-- RLS Policies for agent_api_keys
CREATE POLICY "Only managers can view API keys"
  ON public.agent_api_keys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'ciso', 'soc_manager')
    )
  );

CREATE POLICY "Only managers can manage API keys"
  ON public.agent_api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'ciso', 'soc_manager')
    )
  );

-- RLS Policies for log_ingestion_stats
CREATE POLICY "Authenticated users can view stats"
  ON public.log_ingestion_stats FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert stats"
  ON public.log_ingestion_stats FOR INSERT
  WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON public.data_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create function to generate agent API key
CREATE OR REPLACE FUNCTION public.generate_agent_api_key(
  _data_source_id UUID,
  _name TEXT,
  _expires_days INTEGER DEFAULT 365
)
RETURNS TABLE(api_key TEXT, key_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_prefix TEXT;
  v_key_id UUID;
BEGIN
  -- Generate a secure random key
  v_key := 'socm_' || encode(gen_random_bytes(32), 'hex');
  v_prefix := substring(v_key from 1 for 12);
  
  -- Insert the key record
  INSERT INTO public.agent_api_keys (
    data_source_id,
    key_prefix,
    key_hash,
    name,
    expires_at,
    created_by
  )
  VALUES (
    _data_source_id,
    v_prefix,
    crypt(v_key, gen_salt('bf')),
    _name,
    CASE WHEN _expires_days > 0 THEN now() + (_expires_days || ' days')::interval ELSE NULL END,
    auth.uid()
  )
  RETURNING id INTO v_key_id;
  
  RETURN QUERY SELECT v_key, v_key_id;
END;
$$;

-- Create function to verify agent API key
CREATE OR REPLACE FUNCTION public.verify_agent_api_key(_api_key TEXT)
RETURNS TABLE(
  data_source_id UUID,
  data_source_name TEXT,
  key_id UUID,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_record RECORD;
BEGIN
  v_prefix := substring(_api_key from 1 for 12);
  
  SELECT ak.id, ak.data_source_id, ak.key_hash, ak.is_active, ak.expires_at, ds.name
  INTO v_record
  FROM public.agent_api_keys ak
  JOIN public.data_sources ds ON ds.id = ak.data_source_id
  WHERE ak.key_prefix = v_prefix
  AND ak.is_active = true
  AND (ak.expires_at IS NULL OR ak.expires_at > now())
  LIMIT 1;
  
  IF v_record IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::UUID, false;
    RETURN;
  END IF;
  
  -- Verify the key hash
  IF v_record.key_hash = crypt(_api_key, v_record.key_hash) THEN
    -- Update last used
    UPDATE public.agent_api_keys SET last_used = now() WHERE id = v_record.id;
    RETURN QUERY SELECT v_record.data_source_id, v_record.name, v_record.id, true;
  ELSE
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::UUID, false;
  END IF;
END;
$$;