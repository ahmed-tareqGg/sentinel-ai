
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS denial_reason text;

-- Backfill from existing approved flag
UPDATE public.user_access
SET status = CASE WHEN approved THEN 'approved' ELSE 'pending' END
WHERE status = 'pending';

-- Constrain to known values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_access_status_check'
  ) THEN
    ALTER TABLE public.user_access
      ADD CONSTRAINT user_access_status_check
      CHECK (status IN ('pending', 'approved', 'blocked'));
  END IF;
END $$;

-- Keep approved in sync with status via trigger so older code still works
CREATE OR REPLACE FUNCTION public.user_access_sync_approved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.approved := (NEW.status = 'approved');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_access_sync_approved ON public.user_access;
CREATE TRIGGER trg_user_access_sync_approved
BEFORE INSERT OR UPDATE ON public.user_access
FOR EACH ROW EXECUTE FUNCTION public.user_access_sync_approved();
