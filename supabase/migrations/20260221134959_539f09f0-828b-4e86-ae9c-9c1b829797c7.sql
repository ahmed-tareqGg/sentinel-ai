
-- ============================================================
-- 1. FIX: Functions without search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_compliance_controls_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.ai_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. FIX: Tighten overly permissive RLS policies
-- ============================================================

-- === incident_evidence: restrict to users with incident permissions ===
DROP POLICY IF EXISTS "Authenticated users can delete evidence" ON public.incident_evidence;
CREATE POLICY "Permission-based evidence delete" ON public.incident_evidence
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'incident:update_status'));

DROP POLICY IF EXISTS "Authenticated users can insert evidence" ON public.incident_evidence;
CREATE POLICY "Permission-based evidence insert" ON public.incident_evidence
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'evidence:link'));

-- === incident_iocs: restrict to users with incident permissions ===
DROP POLICY IF EXISTS "Authenticated users can delete IOCs" ON public.incident_iocs;
CREATE POLICY "Permission-based IOC delete" ON public.incident_iocs
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'incident:update_status'));

DROP POLICY IF EXISTS "Authenticated users can insert IOCs" ON public.incident_iocs;
CREATE POLICY "Permission-based IOC insert" ON public.incident_iocs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'evidence:link'));

DROP POLICY IF EXISTS "Authenticated users can update IOCs" ON public.incident_iocs;
CREATE POLICY "Permission-based IOC update" ON public.incident_iocs
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'incident:update_status'));

-- === incident_reports: restrict insert to users with report permissions ===
DROP POLICY IF EXISTS "Authenticated users can insert reports" ON public.incident_reports;
CREATE POLICY "Permission-based report insert" ON public.incident_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'reports:view'));

-- === mitre_coverage: restrict update to managers/admins ===
DROP POLICY IF EXISTS "Allow authenticated users to update mitre_coverage" ON public.mitre_coverage;
CREATE POLICY "Managers can update mitre_coverage" ON public.mitre_coverage
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'settings:manage'));

-- === playbook_learning: restrict to playbook permissions ===
DROP POLICY IF EXISTS "Allow authenticated users to insert playbook_learning" ON public.playbook_learning;
CREATE POLICY "Permission-based playbook_learning insert" ON public.playbook_learning
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'playbook:execute_real'));

DROP POLICY IF EXISTS "Allow authenticated users to update playbook_learning" ON public.playbook_learning;
CREATE POLICY "Permission-based playbook_learning update" ON public.playbook_learning
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'playbook:execute_real'));

-- === playbook_suggestions: restrict management to playbook permissions ===
DROP POLICY IF EXISTS "Allow authenticated users to manage playbook_suggestions" ON public.playbook_suggestions;
CREATE POLICY "Permission-based playbook_suggestions manage" ON public.playbook_suggestions
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'playbook:simulate'))
  WITH CHECK (public.has_permission(auth.uid(), 'playbook:simulate'));

-- === raw_logs: restrict update to admins only ===
DROP POLICY IF EXISTS "System can update raw logs" ON public.raw_logs;
CREATE POLICY "Admins can update raw logs" ON public.raw_logs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
