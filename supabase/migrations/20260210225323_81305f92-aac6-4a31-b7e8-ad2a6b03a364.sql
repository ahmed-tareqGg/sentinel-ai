
-- 1. Add ownership & escalation columns to incidents
ALTER TABLE public.incidents 
  ADD COLUMN IF NOT EXISTS incident_owner_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS incident_owner_role TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_from TEXT,
  ADD COLUMN IF NOT EXISTS escalated_to TEXT,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_reason TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 2. Create analyst_notes table
CREATE TABLE IF NOT EXISTS public.analyst_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_email TEXT,
  author_role TEXT,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'general', -- general, escalation, resolution, evidence
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analyst_notes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read notes
CREATE POLICY "Authenticated users can view notes"
  ON public.analyst_notes FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert their own notes
CREATE POLICY "Users can create notes"
  ON public.analyst_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Users can update their own notes
CREATE POLICY "Users can update own notes"
  ON public.analyst_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

-- Enable realtime for analyst_notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.analyst_notes;

-- 3. Update status values - we keep existing 'Open'/'In Progress'/'Closed' 
-- and add new statuses via the application layer (New, Assigned, Escalated, Resolved)
-- No enum constraint needed since status is TEXT

-- 4. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_analyst_notes_incident ON public.analyst_notes(incident_id);
CREATE INDEX IF NOT EXISTS idx_incidents_owner ON public.incidents(incident_owner_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
