-- Create soar_actions table for tracking automated response actions
CREATE TABLE IF NOT EXISTS public.soar_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target TEXT,
  status TEXT DEFAULT 'pending',
  execution_mode TEXT DEFAULT 'live',
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.soar_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view soar_actions"
ON public.soar_actions FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert soar_actions"
ON public.soar_actions FOR INSERT
WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_soar_actions_incident ON public.soar_actions(incident_id);
CREATE INDEX idx_soar_actions_type ON public.soar_actions(action_type);