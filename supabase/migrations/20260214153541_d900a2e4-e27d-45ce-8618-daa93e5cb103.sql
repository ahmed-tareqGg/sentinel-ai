
CREATE OR REPLACE FUNCTION public.trigger_escalation_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role TEXT;
BEGIN
  IF NEW.escalated_to IS NOT NULL AND (OLD.escalated_to IS DISTINCT FROM NEW.escalated_to) THEN
    v_target_role := NEW.escalated_to;

    INSERT INTO public.notifications (user_id, type, title, body, icon, severity, link, reference_id, reference_type, metadata)
    SELECT 
      ur.user_id,
      'escalation',
      '🚨 Incident Escalated to You — ' || NEW.incident_number,
      COALESCE(NEW.escalation_reason, 'An incident has been escalated to your tier for review'),
      '🚨',
      CASE WHEN NEW.risk_level = 'Critical' THEN 'critical' ELSE 'warning' END,
      '/incidents/' || NEW.id,
      NEW.id::TEXT,
      'incident',
      jsonb_build_object(
        'event_type', NEW.event_type, 
        'risk_level', NEW.risk_level,
        'escalated_from', NEW.escalated_from,
        'escalated_to', NEW.escalated_to
      )
    FROM public.user_roles ur
    WHERE ur.role = v_target_role::public.app_role;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Also fix the approval trigger with the same cast
CREATE OR REPLACE FUNCTION public.trigger_approval_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, icon, severity, link, reference_id, reference_type, metadata)
  SELECT 
    ur.user_id, 
    'approval',
    '⏳ Approval Required: ' || NEW.action_type,
    COALESCE(NEW.reason, 'A new action requires your approval'),
    '⏳',
    'warning',
    '/approvals',
    NEW.id::TEXT,
    'approval_request',
    jsonb_build_object('action_type', NEW.action_type)
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::public.app_role, 'ciso'::public.app_role, 'soc_manager'::public.app_role, 'soc_tier_2'::public.app_role, 'soc_tier_3'::public.app_role);
  
  RETURN NEW;
END;
$$;
