
-- private_channels: restrict INSERT to own channels
DROP POLICY IF EXISTS "Authenticated users can create private channels" ON public.private_channels;
CREATE POLICY "Users can create own private channels" ON public.private_channels
  FOR INSERT TO authenticated
  WITH CHECK (created_by_id = auth.uid());

-- playbook_feedback: restrict INSERT to own feedback
DROP POLICY IF EXISTS "Allow authenticated users to insert playbook_feedback" ON public.playbook_feedback;
CREATE POLICY "Users can insert own playbook_feedback" ON public.playbook_feedback
  FOR INSERT TO authenticated
  WITH CHECK (analyst_id = auth.uid());
