-- Create integrations table to track integration status
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'ticketing', 'notification', 'threat_intel', 'siem'
  is_enabled BOOLEAN DEFAULT false,
  is_configured BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  last_successful_call TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  execution_mode TEXT DEFAULT 'simulated', -- 'real', 'simulated', 'disabled'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_logs table for compliance
CREATE TABLE public.compliance_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  actor_type TEXT NOT NULL, -- 'user', 'system', 'ai'
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  result TEXT NOT NULL, -- 'success', 'failure', 'pending'
  details JSONB DEFAULT '{}',
  execution_mode TEXT, -- 'real', 'simulated'
  tenant_id TEXT DEFAULT 'default',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create approval_requests table for human-in-the-loop
CREATE TABLE public.approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID REFERENCES public.incidents(id),
  playbook_id UUID REFERENCES public.playbooks(id),
  action_type TEXT NOT NULL,
  action_params JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired', 'auto_approved'
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  requested_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  sla_deadline TIMESTAMP WITH TIME ZONE,
  escalated_to TEXT,
  escalation_count INTEGER DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integrations
CREATE POLICY "Authenticated users can view integrations" 
ON public.integrations FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage integrations" 
ON public.integrations FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for audit logs (read-only for authenticated users)
CREATE POLICY "Authenticated users can view audit logs" 
ON public.compliance_audit_logs FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert audit logs" 
ON public.compliance_audit_logs FOR INSERT 
WITH CHECK (true);

-- RLS Policies for approval requests
CREATE POLICY "Authenticated users can view approval requests" 
ON public.approval_requests FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and analysts can manage approvals" 
ON public.approval_requests FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'soc_analyst')
  )
);

-- Insert default integrations
INSERT INTO public.integrations (name, display_name, type, is_enabled, is_configured, execution_mode) VALUES
  ('slack', 'Slack', 'notification', true, true, 'real'),
  ('virustotal', 'VirusTotal', 'threat_intel', true, true, 'real'),
  ('jira', 'Jira', 'ticketing', false, false, 'simulated'),
  ('servicenow', 'ServiceNow', 'ticketing', false, false, 'simulated'),
  ('pagerduty', 'PagerDuty', 'notification', false, false, 'simulated'),
  ('fortisiem', 'FortiSIEM', 'siem', false, false, 'simulated'),
  ('crowdstrike', 'CrowdStrike', 'edr', false, false, 'simulated'),
  ('sentinelone', 'SentinelOne', 'edr', false, false, 'simulated');

-- Update trigger for integrations
CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();