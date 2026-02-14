
-- Notification preferences per user
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- In-app notification toggles
  in_app_incidents BOOLEAN NOT NULL DEFAULT true,
  in_app_assignments BOOLEAN NOT NULL DEFAULT true,
  in_app_escalations BOOLEAN NOT NULL DEFAULT true,
  in_app_approvals BOOLEAN NOT NULL DEFAULT true,
  in_app_mentions BOOLEAN NOT NULL DEFAULT true,
  in_app_system BOOLEAN NOT NULL DEFAULT true,
  -- Email notification toggles
  email_critical_incidents BOOLEAN NOT NULL DEFAULT true,
  email_assignments BOOLEAN NOT NULL DEFAULT true,
  email_escalations BOOLEAN NOT NULL DEFAULT true,
  email_approvals BOOLEAN NOT NULL DEFAULT false,
  email_mentions BOOLEAN NOT NULL DEFAULT false,
  email_digest BOOLEAN NOT NULL DEFAULT false,
  -- Sound
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create preferences for new users
CREATE OR REPLACE FUNCTION public.ensure_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_notification_preferences ON auth.users;

-- Helper: check if user wants in-app notification of a given type
CREATE OR REPLACE FUNCTION public.user_wants_notification(_user_id UUID, _type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT CASE _type
    WHEN 'incident' THEN np.in_app_incidents
    WHEN 'assignment' THEN np.in_app_assignments
    WHEN 'escalation' THEN np.in_app_escalations
    WHEN 'approval' THEN np.in_app_approvals
    WHEN 'chat_mention' THEN np.in_app_mentions
    WHEN 'system' THEN np.in_app_system
    ELSE true
  END INTO v_result
  FROM public.notification_preferences np
  WHERE np.user_id = _user_id;
  
  RETURN COALESCE(v_result, true); -- default to true if no prefs
END;
$$;

-- Helper: check if user wants email notification of a given type  
CREATE OR REPLACE FUNCTION public.user_wants_email(_user_id UUID, _type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT CASE _type
    WHEN 'incident' THEN np.email_critical_incidents
    WHEN 'assignment' THEN np.email_assignments
    WHEN 'escalation' THEN np.email_escalations
    WHEN 'approval' THEN np.email_approvals
    WHEN 'chat_mention' THEN np.email_mentions
    ELSE false
  END INTO v_result
  FROM public.notification_preferences np
  WHERE np.user_id = _user_id;
  
  RETURN COALESCE(v_result, false);
END;
$$;

-- Update notify_user to respect preferences
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _type text, _title text, _body text DEFAULT NULL::text, _icon text DEFAULT NULL::text, _severity text DEFAULT 'info'::text, _link text DEFAULT NULL::text, _reference_id text DEFAULT NULL::text, _reference_type text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_email TEXT;
  v_wants_email BOOLEAN;
BEGIN
  -- Check if user wants this type of in-app notification
  IF NOT public.user_wants_notification(_user_id, _type) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, icon, severity, link, reference_id, reference_type, metadata)
  VALUES (_user_id, _type, _title, _body, _icon, _severity, _link, _reference_id, _reference_type, _metadata)
  RETURNING id INTO v_id;
  
  -- Check email preference and queue email for critical/important
  v_wants_email := public.user_wants_email(_user_id, _type);
  IF v_wants_email AND _severity IN ('critical', 'warning') THEN
    SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
    IF v_email IS NOT NULL THEN
      -- Fire-and-forget email via edge function (using pg_net if available, otherwise skip)
      BEGIN
        PERFORM net.http_post(
          url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body := jsonb_build_object(
            'to', v_email,
            'subject', _title,
            'body', COALESCE(_body, ''),
            'severity', _severity,
            'link', _link,
            'type', _type
          )
        );
      EXCEPTION WHEN OTHERS THEN
        -- Silently fail if pg_net not available
        NULL;
      END;
    END IF;
  END IF;
  
  RETURN v_id;
END;
$$;

-- Update notify_all_users to respect preferences
CREATE OR REPLACE FUNCTION public.notify_all_users(_type text, _title text, _body text DEFAULT NULL::text, _icon text DEFAULT NULL::text, _severity text DEFAULT 'info'::text, _link text DEFAULT NULL::text, _reference_id text DEFAULT NULL::text, _reference_type text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, icon, severity, link, reference_id, reference_type, metadata)
  SELECT 
    ur.user_id, _type, _title, _body, _icon, _severity, _link, _reference_id, _reference_type, _metadata
  FROM public.user_roles ur
  JOIN public.user_access ua ON ua.user_id = ur.user_id AND ua.approved = true
  WHERE public.user_wants_notification(ur.user_id, _type);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;

-- Insert default preferences for existing users
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
