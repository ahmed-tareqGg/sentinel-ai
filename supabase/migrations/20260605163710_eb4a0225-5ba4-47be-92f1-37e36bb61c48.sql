
-- =========================================================
-- 1. SOAR actions — restrict INSERT to authenticated users
--    with playbook permission (service role bypasses RLS)
-- =========================================================
DROP POLICY IF EXISTS "Service role can insert soar_actions" ON public.soar_actions;
DROP POLICY IF EXISTS "Authenticated users can view soar_actions" ON public.soar_actions;

CREATE POLICY "Authorized users can insert soar_actions"
  ON public.soar_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'playbook:execute_real'));

CREATE POLICY "Authenticated users can view soar_actions"
  ON public.soar_actions
  FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================
-- 2. AI response cache — drop overly permissive policy
--    (service_role bypasses RLS automatically)
-- =========================================================
DROP POLICY IF EXISTS "Service role can manage cache" ON public.ai_response_cache;
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.ai_response_cache;

CREATE POLICY "Authenticated users can read cache"
  ON public.ai_response_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================
-- 3. control_evidence — only service role can insert
-- =========================================================
DROP POLICY IF EXISTS "System can insert control evidence" ON public.control_evidence;

-- =========================================================
-- 4. compliance_audit_logs — only service role can insert
-- =========================================================
DROP POLICY IF EXISTS "System can insert audit logs" ON public.compliance_audit_logs;

-- =========================================================
-- 5. chat_reactions — restrict SELECT to authenticated
-- =========================================================
DROP POLICY IF EXISTS "Users can view all reactions" ON public.chat_reactions;

CREATE POLICY "Authenticated users can view reactions"
  ON public.chat_reactions
  FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================
-- 6. chat_read_receipts — restrict SELECT to authenticated
-- =========================================================
DROP POLICY IF EXISTS "Anyone can view read receipts" ON public.chat_read_receipts;

CREATE POLICY "Authenticated users can view read receipts"
  ON public.chat_read_receipts
  FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================
-- 7. topic_comments — authenticated-only, enforce author_id
-- =========================================================
DROP POLICY IF EXISTS "topic_comments_insert_any" ON public.topic_comments;
DROP POLICY IF EXISTS "topic_comments_read_all" ON public.topic_comments;

CREATE POLICY "topic_comments_read_authenticated"
  ON public.topic_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "topic_comments_insert_own"
  ON public.topic_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid()::text);

CREATE POLICY "topic_comments_delete_own"
  ON public.topic_comments
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid()::text);

-- =========================================================
-- 8. topic_likes — enforce ownership on DELETE & INSERT
-- =========================================================
DROP POLICY IF EXISTS "topic_likes_delete_own" ON public.topic_likes;
DROP POLICY IF EXISTS "topic_likes_insert_any" ON public.topic_likes;
DROP POLICY IF EXISTS "topic_likes_read_all" ON public.topic_likes;

CREATE POLICY "topic_likes_read_authenticated"
  ON public.topic_likes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "topic_likes_insert_own"
  ON public.topic_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (liker_id = auth.uid()::text);

CREATE POLICY "topic_likes_delete_own"
  ON public.topic_likes
  FOR DELETE
  TO authenticated
  USING (liker_id = auth.uid()::text);

-- =========================================================
-- 9. user_roles — each user sees only own row; managers see all
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =========================================================
-- 10. analyst_notes — require incidents:view permission
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view notes" ON public.analyst_notes;

CREATE POLICY "Permitted users can view notes"
  ON public.analyst_notes
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'incidents:view')
    OR author_id = auth.uid()
  );

-- =========================================================
-- 11. private_channels — hide password_hash from clients
-- =========================================================
REVOKE SELECT (password_hash) ON public.private_channels FROM authenticated;
REVOKE SELECT (password_hash) ON public.private_channels FROM anon;

-- Server-side verifier (still accessible via RPC to authenticated users)
CREATE OR REPLACE FUNCTION public.verify_private_channel_password(
  _channel_id uuid,
  _password   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  SELECT password_hash INTO v_hash
  FROM public.private_channels
  WHERE id = _channel_id;
  IF v_hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN extensions.crypt(_password, v_hash) = v_hash;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_private_channel_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_private_channel_password(uuid, text) TO authenticated;
