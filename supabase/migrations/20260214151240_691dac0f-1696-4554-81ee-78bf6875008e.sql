
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'incident', 'chat_mention', 'approval', 'assignment', 'escalation', 'system'
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT, -- emoji or icon name
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT, -- URL to navigate to
  reference_id TEXT, -- incident_id, message_id, etc.
  reference_type TEXT, -- 'incident', 'chat_message', 'approval_request'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_date ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_reference ON public.notifications (reference_type, reference_id);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- System can insert notifications (service role)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notification for all authenticated users (for broadcast like new incidents)
CREATE OR REPLACE FUNCTION public.notify_all_users(
  _type TEXT,
  _title TEXT,
  _body TEXT DEFAULT NULL,
  _icon TEXT DEFAULT NULL,
  _severity TEXT DEFAULT 'info',
  _link TEXT DEFAULT NULL,
  _reference_id TEXT DEFAULT NULL,
  _reference_type TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, icon, severity, link, reference_id, reference_type, metadata)
  SELECT 
    ur.user_id, _type, _title, _body, _icon, _severity, _link, _reference_id, _reference_type, _metadata
  FROM public.user_roles ur
  JOIN public.user_access ua ON ua.user_id = ur.user_id AND ua.approved = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to create notification for specific user
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id UUID,
  _type TEXT,
  _title TEXT,
  _body TEXT DEFAULT NULL,
  _icon TEXT DEFAULT NULL,
  _severity TEXT DEFAULT 'info',
  _link TEXT DEFAULT NULL,
  _reference_id TEXT DEFAULT NULL,
  _reference_type TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, icon, severity, link, reference_id, reference_type, metadata)
  VALUES (_user_id, _type, _title, _body, _icon, _severity, _link, _reference_id, _reference_type, _metadata)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Trigger: auto-create notifications on new incidents
CREATE OR REPLACE FUNCTION public.trigger_incident_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_severity TEXT;
  v_icon TEXT;
BEGIN
  -- Determine severity and icon
  v_severity := CASE 
    WHEN NEW.risk_level = 'Critical' THEN 'critical'
    WHEN NEW.risk_level = 'High' THEN 'warning'
    ELSE 'info'
  END;
  v_icon := CASE 
    WHEN NEW.risk_level = 'Critical' THEN '🚨'
    WHEN NEW.risk_level = 'High' THEN '⚠️'
    ELSE '📋'
  END;

  -- Notify all approved users
  PERFORM public.notify_all_users(
    'incident',
    v_icon || ' ' || NEW.incident_number || ' — ' || NEW.risk_level,
    LEFT(COALESCE(NEW.message, NEW.event_type), 150),
    v_icon,
    v_severity,
    '/incidents/' || NEW.id,
    NEW.id::TEXT,
    'incident',
    jsonb_build_object('event_type', NEW.event_type, 'risk_level', NEW.risk_level, 'src_ip', NEW.src_ip)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incident_notification
AFTER INSERT ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.trigger_incident_notification();

-- Trigger: notify user on incident assignment
CREATE OR REPLACE FUNCTION public.trigger_assignment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.incident_owner_id IS NOT NULL AND (OLD.incident_owner_id IS DISTINCT FROM NEW.incident_owner_id) THEN
    PERFORM public.notify_user(
      NEW.incident_owner_id,
      'assignment',
      '📌 Incident Assigned to You',
      NEW.incident_number || ' — ' || NEW.event_type,
      '📌',
      CASE WHEN NEW.risk_level = 'Critical' THEN 'critical' WHEN NEW.risk_level = 'High' THEN 'warning' ELSE 'info' END,
      '/incidents/' || NEW.id,
      NEW.id::TEXT,
      'incident',
      jsonb_build_object('incident_number', NEW.incident_number, 'event_type', NEW.event_type)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignment_notification
AFTER UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.trigger_assignment_notification();

-- Trigger: notify on chat mention
CREATE OR REPLACE FUNCTION public.trigger_chat_mention_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mentioned_id UUID;
  v_clean_content TEXT;
BEGIN
  IF NEW.mentions IS NOT NULL AND array_length(NEW.mentions, 1) > 0 THEN
    -- Clean content from mention markup
    v_clean_content := regexp_replace(NEW.content, '@\[[^\]]+\]\([^)]+\)', '', 'g');
    v_clean_content := LEFT(TRIM(v_clean_content), 120);
    
    FOREACH v_mentioned_id IN ARRAY NEW.mentions
    LOOP
      -- Don't notify yourself
      IF v_mentioned_id != NEW.sender_id THEN
        PERFORM public.notify_user(
          v_mentioned_id,
          'chat_mention',
          '💬 ' || COALESCE(NEW.sender_name, NEW.sender_email, 'Someone') || ' mentioned you',
          v_clean_content,
          '💬',
          'info',
          '/team-chat',
          NEW.id::TEXT,
          'chat_message',
          jsonb_build_object('channel', NEW.channel, 'sender', NEW.sender_name)
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_mention_notification
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_chat_mention_notification();

-- Trigger: notify on new approval request
CREATE OR REPLACE FUNCTION public.trigger_approval_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Notify all users with approval permissions (managers+)
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
  WHERE ur.role IN ('admin', 'ciso', 'soc_manager');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approval_notification
AFTER INSERT ON public.approval_requests
FOR EACH ROW
EXECUTE FUNCTION public.trigger_approval_notification();
