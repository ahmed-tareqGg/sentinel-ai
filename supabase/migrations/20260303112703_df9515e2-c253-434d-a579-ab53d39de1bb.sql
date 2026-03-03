
-- 1. Add columns for multi-agent support and timeout handling
ALTER TABLE public.soar_actions 
  ADD COLUMN IF NOT EXISTS assigned_agent text,
  ADD COLUMN IF NOT EXISTS timeout_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 5;

-- 2. Performance indexes for polling
CREATE INDEX IF NOT EXISTS idx_soar_actions_status ON public.soar_actions(status);
CREATE INDEX IF NOT EXISTS idx_soar_actions_status_priority ON public.soar_actions(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_soar_actions_dispatched_timeout ON public.soar_actions(status, timeout_at) WHERE status = 'dispatched';

-- 3. Atomic claim function — prevents race conditions with FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_soar_actions(
  _agent_hostname text,
  _agent_role text DEFAULT 'executor',
  _limit integer DEFAULT 10,
  _timeout_minutes integer DEFAULT 10
)
RETURNS SETOF public.soar_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action RECORD;
  v_ids uuid[];
BEGIN
  -- First requeue any stale dispatched actions that have timed out
  UPDATE public.soar_actions
  SET status = 'approved',
      assigned_agent = NULL,
      timeout_at = NULL,
      retry_count = COALESCE(retry_count, 0) + 1,
      updated_at = now()
  WHERE status = 'dispatched'
    AND timeout_at < now()
    AND COALESCE(retry_count, 0) < 3;

  -- Mark timed-out actions with too many retries as failed
  UPDATE public.soar_actions
  SET status = 'failed',
      error_message = 'Timed out after ' || COALESCE(retry_count, 0) || ' retries',
      completed_at = now(),
      updated_at = now()
  WHERE status = 'dispatched'
    AND timeout_at < now()
    AND COALESCE(retry_count, 0) >= 3;

  -- Atomically claim approved actions using FOR UPDATE SKIP LOCKED
  -- This prevents two executors from claiming the same action
  SELECT array_agg(id) INTO v_ids
  FROM (
    SELECT id
    FROM public.soar_actions
    WHERE status = 'approved'
      AND (approved_by IS NOT NULL OR requires_approval = false)
    ORDER BY COALESCE(priority, 5) DESC, created_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  ) sub;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Atomically update all claimed actions
  UPDATE public.soar_actions
  SET status = 'dispatched',
      assigned_agent = _agent_hostname,
      dispatched_at = now(),
      timeout_at = now() + make_interval(mins => _timeout_minutes),
      updated_at = now()
  WHERE id = ANY(v_ids);

  -- Return the claimed actions
  RETURN QUERY
  SELECT * FROM public.soar_actions WHERE id = ANY(v_ids);
END;
$$;

-- 4. Function to get action stats for monitoring
CREATE OR REPLACE FUNCTION public.soar_action_stats()
RETURNS TABLE(
  status text,
  count bigint,
  oldest timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT status, count(*), min(created_at)
  FROM public.soar_actions
  GROUP BY status
  ORDER BY count DESC;
$$;
