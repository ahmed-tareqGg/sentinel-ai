-- Create correlation_rules table
CREATE TABLE public.correlation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  match_field TEXT NOT NULL DEFAULT 'src_ip',
  match_operator TEXT NOT NULL DEFAULT 'equals',
  match_value TEXT,
  event_type_filter TEXT[],
  threshold_count INTEGER NOT NULL DEFAULT 3,
  time_window_minutes INTEGER NOT NULL DEFAULT 10,
  severity_override INTEGER DEFAULT 4,
  incident_title_template TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  hits_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.correlation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view correlation rules"
ON public.correlation_rules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage correlation rules"
ON public.correlation_rules FOR ALL
TO authenticated
USING (
  public.has_permission(auth.uid(), 'playbooks:manage') OR
  public.has_permission(auth.uid(), 'system:admin')
)
WITH CHECK (
  public.has_permission(auth.uid(), 'playbooks:manage') OR
  public.has_permission(auth.uid(), 'system:admin')
);

-- Create correlation_rule_matches table for tracking
CREATE TABLE public.correlation_rule_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.correlation_rules(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  matched_logs JSONB,
  match_key TEXT,
  match_count INTEGER,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.correlation_rule_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view correlation matches"
ON public.correlation_rule_matches FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can insert correlation matches"
ON public.correlation_rule_matches FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_correlation_rules_updated_at
  BEFORE UPDATE ON public.correlation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add index for performance
CREATE INDEX idx_correlation_rules_active ON public.correlation_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_correlation_rule_matches_rule_id ON public.correlation_rule_matches(rule_id);
CREATE INDEX idx_correlation_rule_matches_triggered ON public.correlation_rule_matches(triggered_at DESC);