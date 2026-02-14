
-- Fix: approval notification trigger should also notify soc_tier_2 users
CREATE OR REPLACE FUNCTION public.trigger_approval_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify all users with approval permissions (tier2+ managers)
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
  WHERE ur.role IN ('admin', 'ciso', 'soc_manager', 'soc_tier_2', 'soc_tier_3');
  
  RETURN NEW;
END;
$$;

-- Add new trigger for escalation notifications to target tier
CREATE OR REPLACE FUNCTION public.trigger_escalation_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role TEXT;
BEGIN
  -- Only fire when escalated_to changes
  IF NEW.escalated_to IS NOT NULL AND (OLD.escalated_to IS DISTINCT FROM NEW.escalated_to) THEN
    v_target_role := NEW.escalated_to;

    -- Notify all users of the target role
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
    WHERE ur.role = v_target_role;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the escalation trigger on incidents table
DROP TRIGGER IF EXISTS trg_escalation_notification ON public.incidents;
CREATE TRIGGER trg_escalation_notification
  AFTER UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_escalation_notification();
