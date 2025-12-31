-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('critical', 'warning', 'info')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to create notifications for new incidents
CREATE OR REPLACE FUNCTION public.handle_new_incident_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_user RECORD;
BEGIN
  -- Only trigger for High or Critical incidents
  IF NEW.risk_level IN ('High', 'Critical') THEN
    -- Find all admins and soc_analysts
    FOR admin_user IN 
      SELECT user_id FROM public.user_roles 
      WHERE role IN ('admin', 'soc_analyst')
    LOOP
      INSERT INTO public.notifications (
        user_id,
        incident_id,
        title,
        message,
        type
      ) VALUES (
        admin_user.user_id,
        NEW.id,
        NEW.incident_number || ' - ' || NEW.risk_level,
        COALESCE(NEW.message, 'New security incident detected'),
        CASE 
          WHEN NEW.risk_level = 'Critical' THEN 'critical'
          ELSE 'warning'
        END
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS on_incident_created_notify ON public.incidents;
CREATE TRIGGER on_incident_created_notify
  AFTER INSERT ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_incident_notification();
