-- Add playbook learning and AI suggestions tables

-- Table for playbook feedback from analysts
CREATE TABLE public.playbook_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID REFERENCES public.playbooks(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  execution_id UUID REFERENCES public.playbook_executions(id) ON DELETE SET NULL,
  analyst_id UUID,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('correct', 'incorrect', 'modified')),
  notes TEXT,
  suggested_actions JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for playbook learning metrics (per tenant support ready)
CREATE TABLE public.playbook_learning (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID REFERENCES public.playbooks(id) ON DELETE CASCADE UNIQUE,
  approval_count INTEGER DEFAULT 0,
  rejection_count INTEGER DEFAULT 0,
  modification_count INTEGER DEFAULT 0,
  auto_execution_threshold NUMERIC(5,2) DEFAULT 85.0,
  confidence_adjustment NUMERIC(5,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tenant_id UUID -- For future MSSP support
);

-- Table for AI-suggested playbooks
CREATE TABLE public.playbook_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  suggested_conditions JSONB NOT NULL,
  suggested_actions JSONB NOT NULL,
  reasoning TEXT NOT NULL,
  pattern_source TEXT, -- e.g., 'repeated_incidents', 'analyst_behavior', 'manual_actions'
  confidence_score NUMERIC(5,2),
  incident_count INTEGER, -- Number of incidents that triggered this suggestion
  sample_incident_ids TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed', 'converted')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  converted_playbook_id UUID REFERENCES public.playbooks(id) ON DELETE SET NULL
);

-- Add AI explanation fields to playbook_executions
ALTER TABLE public.playbook_executions 
ADD COLUMN IF NOT EXISTS ai_explanation TEXT,
ADD COLUMN IF NOT EXISTS decision_factors JSONB,
ADD COLUMN IF NOT EXISTS execution_mode TEXT DEFAULT 'real';

-- Add autonomy settings to integrations table for Autonomous SOC Mode
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS autonomous_mode_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_execution_threshold NUMERIC(5,2) DEFAULT 85.0;

-- MITRE coverage tracking table
CREATE TABLE public.mitre_coverage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technique_id TEXT NOT NULL UNIQUE,
  technique_name TEXT NOT NULL,
  tactic TEXT NOT NULL,
  detection_count INTEGER DEFAULT 0,
  last_detected TIMESTAMP WITH TIME ZONE,
  has_playbook BOOLEAN DEFAULT false,
  playbook_ids TEXT[],
  coverage_status TEXT DEFAULT 'not_covered' CHECK (coverage_status IN ('covered', 'partial', 'not_covered')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert common MITRE techniques
INSERT INTO public.mitre_coverage (technique_id, technique_name, tactic) VALUES
  ('T1071', 'Application Layer Protocol', 'Command and Control'),
  ('T1059', 'Command and Scripting Interpreter', 'Execution'),
  ('T1078', 'Valid Accounts', 'Defense Evasion'),
  ('T1110', 'Brute Force', 'Credential Access'),
  ('T1566', 'Phishing', 'Initial Access'),
  ('T1486', 'Data Encrypted for Impact', 'Impact'),
  ('T1027', 'Obfuscated Files or Information', 'Defense Evasion'),
  ('T1053', 'Scheduled Task/Job', 'Execution'),
  ('T1036', 'Masquerading', 'Defense Evasion'),
  ('T1055', 'Process Injection', 'Defense Evasion'),
  ('T1105', 'Ingress Tool Transfer', 'Command and Control'),
  ('T1140', 'Deobfuscate/Decode Files or Information', 'Defense Evasion'),
  ('T1203', 'Exploitation for Client Execution', 'Execution'),
  ('T1204', 'User Execution', 'Execution'),
  ('T1547', 'Boot or Logon Autostart Execution', 'Persistence'),
  ('T1048', 'Exfiltration Over Alternative Protocol', 'Exfiltration'),
  ('T1567', 'Exfiltration Over Web Service', 'Exfiltration'),
  ('T1041', 'Exfiltration Over C2 Channel', 'Exfiltration'),
  ('T1190', 'Exploit Public-Facing Application', 'Initial Access'),
  ('T1133', 'External Remote Services', 'Initial Access')
ON CONFLICT (technique_id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.playbook_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitre_coverage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read playbook_feedback" ON public.playbook_feedback
  FOR SELECT TO authenticated USING (true);
  
CREATE POLICY "Allow authenticated users to insert playbook_feedback" ON public.playbook_feedback
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read playbook_learning" ON public.playbook_learning
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update playbook_learning" ON public.playbook_learning
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert playbook_learning" ON public.playbook_learning
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read playbook_suggestions" ON public.playbook_suggestions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage playbook_suggestions" ON public.playbook_suggestions
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read mitre_coverage" ON public.mitre_coverage
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update mitre_coverage" ON public.mitre_coverage
  FOR UPDATE TO authenticated USING (true);