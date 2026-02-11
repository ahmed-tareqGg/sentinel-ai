
-- Threat Intelligence IOCs (enriched indicators)
CREATE TABLE public.threat_intel_iocs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ioc_type TEXT NOT NULL, -- ip, domain, url, file_hash, email
  value TEXT NOT NULL,
  threat_score INTEGER DEFAULT 0, -- 0-100
  confidence INTEGER DEFAULT 0, -- 0-100
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  first_seen TIMESTAMP WITH TIME ZONE,
  last_seen TIMESTAMP WITH TIME ZONE,
  source TEXT NOT NULL, -- virustotal, abuseipdb, alienvault, manual
  source_data JSONB DEFAULT '{}',
  country_code TEXT,
  isp TEXT,
  is_whitelisted BOOLEAN DEFAULT false,
  related_incident_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ioc_type, value, source)
);

ALTER TABLE public.threat_intel_iocs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view TI IOCs"
  ON public.threat_intel_iocs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users with incidents:write can insert TI IOCs"
  ON public.threat_intel_iocs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users with incidents:write can update TI IOCs"
  ON public.threat_intel_iocs FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users with incidents:write can delete TI IOCs"
  ON public.threat_intel_iocs FOR DELETE
  USING (public.has_permission(auth.uid(), 'incidents:write'));

-- Threat Feeds
CREATE TABLE public.threat_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- alienvault, abuseipdb, virustotal, custom
  feed_url TEXT,
  feed_type TEXT DEFAULT 'ioc', -- ioc, threat_actor, vulnerability
  is_active BOOLEAN DEFAULT true,
  last_fetched TIMESTAMP WITH TIME ZONE,
  fetch_interval_minutes INTEGER DEFAULT 60,
  total_iocs INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.threat_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view threat feeds"
  ON public.threat_feeds FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage threat feeds"
  ON public.threat_feeds FOR ALL
  USING (public.has_permission(auth.uid(), 'settings:write'));

-- Threat Actors
CREATE TABLE public.threat_actors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  description TEXT,
  motivation TEXT, -- financial, espionage, hacktivism, destruction
  sophistication TEXT, -- low, medium, high, advanced
  origin_country TEXT,
  target_sectors TEXT[] DEFAULT '{}',
  ttps TEXT[] DEFAULT '{}', -- MITRE ATT&CK TTPs
  associated_iocs UUID[] DEFAULT '{}',
  active_since TEXT,
  last_activity TIMESTAMP WITH TIME ZONE,
  source TEXT DEFAULT 'manual',
  source_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.threat_actors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view threat actors"
  ON public.threat_actors FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage threat actors"
  ON public.threat_actors FOR ALL
  USING (public.has_permission(auth.uid(), 'incidents:write'));

-- TI Enrichment Logs
CREATE TABLE public.ti_enrichment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ioc_value TEXT NOT NULL,
  ioc_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  request_status TEXT DEFAULT 'pending', -- pending, success, error, rate_limited
  response_data JSONB DEFAULT '{}',
  error_message TEXT,
  incident_id UUID REFERENCES public.incidents(id),
  requested_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ti_enrichment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view enrichment logs"
  ON public.ti_enrichment_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert enrichment logs"
  ON public.ti_enrichment_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_ti_iocs_type_value ON public.threat_intel_iocs(ioc_type, value);
CREATE INDEX idx_ti_iocs_source ON public.threat_intel_iocs(source);
CREATE INDEX idx_ti_iocs_threat_score ON public.threat_intel_iocs(threat_score DESC);
CREATE INDEX idx_ti_enrichment_ioc ON public.ti_enrichment_logs(ioc_value, provider);
CREATE INDEX idx_threat_actors_name ON public.threat_actors(name);

-- Updated at triggers
CREATE TRIGGER update_threat_intel_iocs_updated_at
  BEFORE UPDATE ON public.threat_intel_iocs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_threat_feeds_updated_at
  BEFORE UPDATE ON public.threat_feeds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_threat_actors_updated_at
  BEFORE UPDATE ON public.threat_actors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
