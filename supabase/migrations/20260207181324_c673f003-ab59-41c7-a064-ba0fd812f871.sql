-- ============================================
-- GRC FRAMEWORK - COMPLETE DATABASE SCHEMA
-- ============================================

-- 1. Create control_status enum for lifecycle
DO $$ BEGIN
  CREATE TYPE public.control_status AS ENUM (
    'not_implemented',
    'planned', 
    'partially_implemented',
    'fully_implemented'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create risk_likelihood enum
DO $$ BEGIN
  CREATE TYPE public.risk_likelihood AS ENUM (
    'rare',
    'unlikely', 
    'possible',
    'likely',
    'almost_certain'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create risk_impact enum
DO $$ BEGIN
  CREATE TYPE public.risk_impact AS ENUM (
    'negligible',
    'minor', 
    'moderate',
    'major',
    'catastrophic'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Add missing columns to compliance_controls
ALTER TABLE public.compliance_controls 
ADD COLUMN IF NOT EXISTS control_status public.control_status DEFAULT 'not_implemented',
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS sla_days INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS next_review_date DATE,
ADD COLUMN IF NOT EXISTS gap_identified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gap_description TEXT,
ADD COLUMN IF NOT EXISTS remediation_plan TEXT,
ADD COLUMN IF NOT EXISTS remediation_due_date DATE;

-- 5. Create Risk Register table
CREATE TABLE IF NOT EXISTS public.risk_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE CASCADE,
  risk_id VARCHAR(50) NOT NULL,
  risk_title VARCHAR(255) NOT NULL,
  risk_description TEXT,
  risk_category VARCHAR(100),
  likelihood public.risk_likelihood DEFAULT 'possible',
  impact public.risk_impact DEFAULT 'moderate',
  inherent_risk_score INTEGER GENERATED ALWAYS AS (
    CASE likelihood
      WHEN 'rare' THEN 1
      WHEN 'unlikely' THEN 2
      WHEN 'possible' THEN 3
      WHEN 'likely' THEN 4
      WHEN 'almost_certain' THEN 5
    END *
    CASE impact
      WHEN 'negligible' THEN 1
      WHEN 'minor' THEN 2
      WHEN 'moderate' THEN 3
      WHEN 'major' THEN 4
      WHEN 'catastrophic' THEN 5
    END
  ) STORED,
  residual_likelihood public.risk_likelihood,
  residual_impact public.risk_impact,
  residual_risk_score INTEGER GENERATED ALWAYS AS (
    CASE residual_likelihood
      WHEN 'rare' THEN 1
      WHEN 'unlikely' THEN 2
      WHEN 'possible' THEN 3
      WHEN 'likely' THEN 4
      WHEN 'almost_certain' THEN 5
      ELSE 0
    END *
    CASE residual_impact
      WHEN 'negligible' THEN 1
      WHEN 'minor' THEN 2
      WHEN 'moderate' THEN 3
      WHEN 'major' THEN 4
      WHEN 'catastrophic' THEN 5
      ELSE 0
    END
  ) STORED,
  mitigation_strategy TEXT,
  mitigation_status VARCHAR(50) DEFAULT 'open',
  risk_owner UUID REFERENCES auth.users(id),
  treatment_option VARCHAR(50) DEFAULT 'mitigate',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6. Create GRC Audit Trail table (enhanced)
CREATE TABLE IF NOT EXISTS public.grc_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  entity_name VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  change_summary TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Create Control Mapping Rules table
CREATE TABLE IF NOT EXISTS public.control_mapping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  match_field VARCHAR(100) NOT NULL,
  match_operator VARCHAR(20) DEFAULT 'contains',
  match_value TEXT NOT NULL,
  evidence_type VARCHAR(50) DEFAULT 'automated',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 8. Create Control Gap Analysis table
CREATE TABLE IF NOT EXISTS public.control_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID REFERENCES public.compliance_controls(id) ON DELETE CASCADE UNIQUE,
  gap_status VARCHAR(50) DEFAULT 'open',
  gap_severity VARCHAR(20) DEFAULT 'medium',
  gap_description TEXT,
  identified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  identified_by UUID REFERENCES auth.users(id),
  remediation_plan TEXT,
  remediation_owner UUID REFERENCES auth.users(id),
  target_date DATE,
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES auth.users(id)
);

-- 9. Enable RLS on new tables
ALTER TABLE public.risk_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grc_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_mapping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_gaps ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for risk_register
CREATE POLICY "Authenticated users can view risks" ON public.risk_register
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "GRC roles can manage risks" ON public.risk_register
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'compliance:manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'compliance:manage'));

-- 11. RLS Policies for grc_audit_trail
CREATE POLICY "Authenticated users can view audit trail" ON public.grc_audit_trail
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can insert audit entries" ON public.grc_audit_trail
  FOR INSERT TO authenticated WITH CHECK (true);

-- 12. RLS Policies for control_mapping_rules
CREATE POLICY "Authenticated users can view mapping rules" ON public.control_mapping_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "GRC roles can manage mapping rules" ON public.control_mapping_rules
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'compliance:manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'compliance:manage'));

-- 13. RLS Policies for control_gaps
CREATE POLICY "Authenticated users can view gaps" ON public.control_gaps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "GRC roles can manage gaps" ON public.control_gaps
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'compliance:manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'compliance:manage'));

-- 14. Function to log GRC audit events
CREATE OR REPLACE FUNCTION public.log_grc_audit(
  _action TEXT,
  _entity_type TEXT,
  _entity_id UUID,
  _entity_name TEXT DEFAULT NULL,
  _old_value JSONB DEFAULT NULL,
  _new_value JSONB DEFAULT NULL,
  _change_summary TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  INSERT INTO public.grc_audit_trail (
    actor_id, actor_email, action, entity_type, entity_id, 
    entity_name, old_value, new_value, change_summary
  ) VALUES (
    auth.uid(), v_user_email, _action, _entity_type, _entity_id,
    _entity_name, _old_value, _new_value, _change_summary
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- 15. Function to calculate control coverage
CREATE OR REPLACE FUNCTION public.calculate_control_coverage(
  _standard TEXT DEFAULT NULL
)
RETURNS TABLE(
  total_controls INTEGER,
  applicable_controls INTEGER,
  implemented_controls INTEGER,
  partially_implemented INTEGER,
  planned_controls INTEGER,
  not_implemented INTEGER,
  coverage_percentage NUMERIC,
  gap_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_controls,
    COUNT(*) FILTER (WHERE cc.applicable IN ('yes', NULL))::INTEGER AS applicable_controls,
    COUNT(*) FILTER (WHERE cc.control_status = 'fully_implemented')::INTEGER AS implemented_controls,
    COUNT(*) FILTER (WHERE cc.control_status = 'partially_implemented')::INTEGER AS partially_implemented,
    COUNT(*) FILTER (WHERE cc.control_status = 'planned')::INTEGER AS planned_controls,
    COUNT(*) FILTER (WHERE cc.control_status = 'not_implemented')::INTEGER AS not_implemented,
    ROUND(
      (COUNT(*) FILTER (WHERE cc.control_status = 'fully_implemented')::NUMERIC / 
       NULLIF(COUNT(*) FILTER (WHERE cc.applicable IN ('yes', NULL)), 0) * 100), 2
    ) AS coverage_percentage,
    COUNT(*) FILTER (WHERE cg.id IS NOT NULL AND cg.gap_status = 'open')::INTEGER AS gap_count
  FROM public.compliance_controls cc
  LEFT JOIN public.control_gaps cg ON cg.control_id = cc.id
  WHERE (_standard IS NULL OR cc.standard = _standard);
END;
$$;

-- 16. Function to identify gaps automatically
CREATE OR REPLACE FUNCTION public.identify_control_gaps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gap_count INTEGER := 0;
BEGIN
  -- Insert gaps for applicable controls with no evidence and not implemented
  INSERT INTO public.control_gaps (control_id, gap_status, gap_severity, gap_description, identified_by)
  SELECT 
    cc.id,
    'open',
    CASE 
      WHEN cc.priority = 'critical' THEN 'critical'
      WHEN cc.priority = 'high' THEN 'high'
      ELSE 'medium'
    END,
    'Control is applicable but has no evidence and is not fully implemented',
    auth.uid()
  FROM public.compliance_controls cc
  LEFT JOIN public.compliance_evidence ce ON ce.control_id = cc.id
  WHERE cc.applicable IN ('yes', NULL)
    AND cc.control_status != 'fully_implemented'
    AND ce.id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.control_gaps cg WHERE cg.control_id = cc.id)
  ON CONFLICT (control_id) DO NOTHING;
  
  GET DIAGNOSTICS v_gap_count = ROW_COUNT;
  RETURN v_gap_count;
END;
$$;

-- 17. Trigger to auto-log control changes
CREATE OR REPLACE FUNCTION public.trigger_control_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log significant changes
    IF OLD.control_status IS DISTINCT FROM NEW.control_status OR
       OLD.implemented IS DISTINCT FROM NEW.implemented OR
       OLD.applicable IS DISTINCT FROM NEW.applicable OR
       OLD.owner IS DISTINCT FROM NEW.owner THEN
      
      PERFORM public.log_grc_audit(
        'control_updated',
        'compliance_control',
        NEW.id,
        NEW.control_code || ' - ' || NEW.title,
        jsonb_build_object(
          'status', OLD.control_status,
          'implemented', OLD.implemented,
          'applicable', OLD.applicable,
          'owner', OLD.owner
        ),
        jsonb_build_object(
          'status', NEW.control_status,
          'implemented', NEW.implemented,
          'applicable', NEW.applicable,
          'owner', NEW.owner
        ),
        'Control updated'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_control_audit ON public.compliance_controls;
CREATE TRIGGER trigger_control_audit
  AFTER UPDATE ON public.compliance_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_control_audit();

-- 18. Trigger to auto-map incidents to controls
CREATE OR REPLACE FUNCTION public.auto_map_incident_to_controls()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Map based on MITRE technique
  IF NEW.mitre_technique IS NOT NULL THEN
    INSERT INTO public.compliance_evidence (
      control_id, evidence_type, source, reference_id, title, description
    )
    SELECT 
      cmr.control_id,
      'incident',
      'SOCMind Auto-Mapping',
      NEW.incident_number,
      'Incident Detection: ' || NEW.event_type,
      'Automated evidence from incident ' || NEW.incident_number || ' - ' || COALESCE(NEW.message, '')
    FROM public.control_mapping_rules cmr
    WHERE cmr.is_active = true
      AND cmr.source_type = 'incident'
      AND (
        (cmr.match_field = 'mitre_technique' AND NEW.mitre_technique ILIKE '%' || cmr.match_value || '%')
        OR (cmr.match_field = 'event_type' AND NEW.event_type ILIKE '%' || cmr.match_value || '%')
        OR (cmr.match_field = 'classification' AND NEW.classification ILIKE '%' || cmr.match_value || '%')
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_map_incident ON public.incidents;
CREATE TRIGGER trigger_auto_map_incident
  AFTER INSERT ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_map_incident_to_controls();

-- 19. Add compliance:manage permission to GRC roles
INSERT INTO public.role_permissions (role, permission)
VALUES 
  ('admin', 'compliance:manage'),
  ('ciso', 'compliance:manage'),
  ('grc_engineer', 'compliance:manage'),
  ('soc_manager', 'compliance:manage')
ON CONFLICT DO NOTHING;

-- 20. Create default control mapping rules for ISO 27001
INSERT INTO public.control_mapping_rules (control_id, source_type, match_field, match_value, evidence_type)
SELECT 
  cc.id,
  'incident',
  'mitre_technique',
  CASE 
    WHEN cc.control_code LIKE 'A.5.%' THEN 'policy'
    WHEN cc.control_code LIKE 'A.6.%' THEN 'access'
    WHEN cc.control_code LIKE 'A.7.%' THEN 'hr'
    WHEN cc.control_code LIKE 'A.8.%' THEN 'asset'
    WHEN cc.control_code LIKE 'A.9.%' THEN 'access_control'
    WHEN cc.control_code LIKE 'A.10.%' THEN 'cryptography'
    WHEN cc.control_code LIKE 'A.11.%' THEN 'physical'
    WHEN cc.control_code LIKE 'A.12.%' THEN 'operations'
    WHEN cc.control_code LIKE 'A.13.%' THEN 'network'
    WHEN cc.control_code LIKE 'A.14.%' THEN 'development'
    WHEN cc.control_code LIKE 'A.15.%' THEN 'supplier'
    WHEN cc.control_code LIKE 'A.16.%' THEN 'incident'
    WHEN cc.control_code LIKE 'A.17.%' THEN 'continuity'
    WHEN cc.control_code LIKE 'A.18.%' THEN 'compliance'
    ELSE 'general'
  END,
  'automated'
FROM public.compliance_controls cc
WHERE cc.standard = 'ISO27001'
ON CONFLICT DO NOTHING;

-- 21. Update existing controls to use new status enum
UPDATE public.compliance_controls
SET control_status = 
  CASE 
    WHEN implemented = true THEN 'fully_implemented'::public.control_status
    WHEN status = 'planned' THEN 'planned'::public.control_status
    WHEN status = 'partial' THEN 'partially_implemented'::public.control_status
    ELSE 'not_implemented'::public.control_status
  END
WHERE control_status IS NULL;