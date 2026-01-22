-- 1. Create compliance_controls table (ISO 27001, SOC2, GDPR controls)
CREATE TABLE IF NOT EXISTS public.compliance_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard TEXT NOT NULL, -- ISO27001 / SOC2 / GDPR
  control_code TEXT NOT NULL, -- A.8.15
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view compliance controls"
ON public.compliance_controls FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage compliance controls"
ON public.compliance_controls FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Create control_rules table (auto-mapping rules)
CREATE TABLE IF NOT EXISTS public.control_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE CASCADE,
  match_action TEXT NOT NULL,
  match_resource TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.control_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view control rules"
ON public.control_rules FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage control rules"
ON public.control_rules FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create control_evidence table (links audit logs to controls)
CREATE TABLE IF NOT EXISTS public.control_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE CASCADE,
  audit_log_id UUID,
  compliance_audit_log_id UUID,
  status TEXT CHECK (status IN ('compliant', 'non-compliant')) DEFAULT 'compliant',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.control_evidence ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view control evidence"
ON public.control_evidence FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert control evidence"
ON public.control_evidence FOR INSERT
WITH CHECK (true);

-- 4. Create compliance_reports table
CREATE TABLE IF NOT EXISTS public.compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID,
  summary JSONB,
  file_url TEXT,
  status TEXT DEFAULT 'completed'
);

-- Enable RLS
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view compliance reports"
ON public.compliance_reports FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage compliance reports"
ON public.compliance_reports FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_control_evidence_control ON public.control_evidence(control_id);
CREATE INDEX IF NOT EXISTS idx_control_evidence_audit ON public.control_evidence(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_control_rules_action ON public.control_rules(match_action);
CREATE INDEX IF NOT EXISTS idx_compliance_controls_standard ON public.compliance_controls(standard);

-- 6. Insert ISO 27001 Annex A Controls (key ones for SOC)
INSERT INTO public.compliance_controls (standard, control_code, title, description, category) VALUES
-- Organizational controls
('ISO27001', 'A.5.1', 'Policies for information security', 'Information security policy and topic-specific policies', 'Organizational'),
('ISO27001', 'A.5.7', 'Threat intelligence', 'Information about information security threats collected and analyzed', 'Organizational'),
('ISO27001', 'A.5.17', 'Authentication information', 'Allocation and management of authentication information', 'Organizational'),
('ISO27001', 'A.5.23', 'Information security for cloud services', 'Cloud services management processes', 'Organizational'),
('ISO27001', 'A.5.24', 'Information security incident management', 'Planning and preparation for incident management', 'Organizational'),
('ISO27001', 'A.5.25', 'Assessment and decision on information security events', 'Information security events assessed and decided as incidents', 'Organizational'),
('ISO27001', 'A.5.26', 'Response to information security incidents', 'Incidents responded to according to documented procedures', 'Organizational'),
('ISO27001', 'A.5.27', 'Learning from information security incidents', 'Knowledge gained from incidents used to strengthen controls', 'Organizational'),
('ISO27001', 'A.5.28', 'Collection of evidence', 'Procedures for evidence collection and preservation', 'Organizational'),
('ISO27001', 'A.5.30', 'ICT readiness for business continuity', 'ICT readiness planned and implemented', 'Organizational'),
-- People controls
('ISO27001', 'A.6.3', 'Information security awareness, education and training', 'Personnel and interested parties receive appropriate awareness', 'People'),
-- Physical controls
('ISO27001', 'A.7.4', 'Physical security monitoring', 'Premises continuously monitored for unauthorized access', 'Physical'),
-- Technological controls
('ISO27001', 'A.8.2', 'Privileged access rights', 'Allocation and use of privileged access rights restricted and managed', 'Technological'),
('ISO27001', 'A.8.5', 'Secure authentication', 'Secure authentication technologies and procedures implemented', 'Technological'),
('ISO27001', 'A.8.7', 'Protection against malware', 'Protection against malware implemented and supported by awareness', 'Technological'),
('ISO27001', 'A.8.8', 'Management of technical vulnerabilities', 'Information about vulnerabilities obtained and appropriate measures taken', 'Technological'),
('ISO27001', 'A.8.15', 'Logging', 'Logs recording activities, exceptions, faults produced and protected', 'Technological'),
('ISO27001', 'A.8.16', 'Monitoring activities', 'Networks, systems and applications monitored for anomalous behavior', 'Technological'),
('ISO27001', 'A.8.20', 'Networks security', 'Networks and network devices secured and protected', 'Technological'),
('ISO27001', 'A.8.28', 'Secure coding', 'Secure coding principles applied to software development', 'Technological'),
-- SOC 2 Trust Principles
('SOC2', 'CC6.1', 'Security - Logical and Physical Access', 'Logical access to the system and physical access to data centers restricted', 'Security'),
('SOC2', 'CC6.2', 'Security - System Operations', 'Security events identified and responded to', 'Security'),
('SOC2', 'CC6.3', 'Security - Change Management', 'Changes to infrastructure and software authorized and implemented', 'Security'),
('SOC2', 'CC7.1', 'Availability - System Monitoring', 'System capacity and availability monitored', 'Availability'),
('SOC2', 'CC7.2', 'Availability - Incident Response', 'Incidents identified and responded to meet availability objectives', 'Availability'),
('SOC2', 'CC8.1', 'Confidentiality - Data Protection', 'Confidential information protected during processing', 'Confidentiality'),
-- GDPR
('GDPR', 'Art.5', 'Principles of processing', 'Personal data processed lawfully, fairly and transparently', 'Processing'),
('GDPR', 'Art.25', 'Data protection by design', 'Data protection implemented by design and default', 'Design'),
('GDPR', 'Art.32', 'Security of processing', 'Appropriate technical and organizational measures', 'Security'),
('GDPR', 'Art.33', 'Notification of breach', 'Personal data breach notified to supervisory authority', 'Breach')
ON CONFLICT DO NOTHING;

-- 7. Insert control rules for auto-mapping
INSERT INTO public.control_rules (control_id, match_action, match_resource) 
SELECT c.id, r.match_action, r.match_resource
FROM public.compliance_controls c
CROSS JOIN (VALUES
  ('A.8.15', 'ingest_log', 'raw_logs'),
  ('A.8.15', 'log_received', 'raw_logs'),
  ('A.8.16', 'analyze_log', 'incident'),
  ('A.8.16', 'create_incident', 'incident'),
  ('A.5.24', 'create_incident', 'incident'),
  ('A.5.25', 'classify_incident', 'incident'),
  ('A.5.26', 'execute_playbook', 'playbook'),
  ('A.5.26', 'close_incident', 'incident'),
  ('A.5.27', 'view_analytics', 'analytics'),
  ('A.5.28', 'export_incident', 'incident'),
  ('A.5.28', 'generate_report', 'report'),
  ('A.5.17', 'login', 'user'),
  ('A.5.17', 'signup', 'user'),
  ('A.8.2', 'set_user_role', 'user'),
  ('A.8.2', 'approve_user_access', 'user'),
  ('A.8.5', 'login', 'user'),
  ('CC6.1', 'login', 'user'),
  ('CC6.1', 'set_user_role', 'user'),
  ('CC6.2', 'create_incident', 'incident'),
  ('CC6.2', 'execute_playbook', 'playbook'),
  ('CC7.2', 'execute_playbook', 'playbook'),
  ('CC7.2', 'close_incident', 'incident'),
  ('Art.32', 'login', 'user'),
  ('Art.33', 'create_incident', 'incident')
) AS r(control_code, match_action, match_resource)
WHERE c.control_code = r.control_code
ON CONFLICT DO NOTHING;

-- 8. Create function to auto-map audit logs to controls
CREATE OR REPLACE FUNCTION public.auto_map_audit_to_controls()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert evidence for matching control rules
  INSERT INTO public.control_evidence (control_id, compliance_audit_log_id, status)
  SELECT cr.control_id, NEW.id, 
    CASE WHEN NEW.result = 'success' THEN 'compliant' ELSE 'non-compliant' END
  FROM public.control_rules cr
  WHERE cr.match_action = NEW.action
    AND (cr.match_resource IS NULL OR cr.match_resource = NEW.resource_type);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Create trigger for auto-mapping
DROP TRIGGER IF EXISTS trigger_auto_map_audit ON public.compliance_audit_logs;
CREATE TRIGGER trigger_auto_map_audit
AFTER INSERT ON public.compliance_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.auto_map_audit_to_controls();