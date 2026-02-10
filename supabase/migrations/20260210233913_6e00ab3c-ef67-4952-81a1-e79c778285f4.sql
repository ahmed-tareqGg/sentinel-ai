
-- Add missing columns to soar_actions for full executor support
ALTER TABLE public.soar_actions
  ADD COLUMN IF NOT EXISTS action_id TEXT,
  ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'ip',
  ADD COLUMN IF NOT EXISTS duration_seconds INT,
  ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_result JSONB,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS rollback_available BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requested_by UUID,
  ADD COLUMN IF NOT EXISTS requested_by_role TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Drop old check constraint if exists and add new one with more statuses
DO $$ BEGIN
  ALTER TABLE public.soar_actions DROP CONSTRAINT IF EXISTS soar_actions_status_check;
  ALTER TABLE public.soar_actions ADD CONSTRAINT soar_actions_status_check 
    CHECK (status IN ('pending', 'approved', 'dispatched', 'executing', 'completed', 'failed', 'rolled_back', 'rejected', 'expired'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Index for agent polling
CREATE INDEX IF NOT EXISTS idx_soar_actions_ds_status ON public.soar_actions(data_source_id, status);
CREATE INDEX IF NOT EXISTS idx_soar_actions_incident ON public.soar_actions(incident_id);
