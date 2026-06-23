
-- Tighten chat-attachments uploads to user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Users can upload own chat attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Restrict incident-evidence to authorized SOC roles only
DROP POLICY IF EXISTS "Authenticated users can upload evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read evidence files" ON storage.objects;

CREATE POLICY "SOC users can upload incident evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incident-evidence'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'ciso')
      OR public.has_role(auth.uid(), 'soc_manager')
      OR public.has_role(auth.uid(), 'soc_tier_3')
      OR public.has_role(auth.uid(), 'soc_tier_2')
      OR public.has_role(auth.uid(), 'soc_tier_1')
      OR public.has_role(auth.uid(), 'grc_engineer')
    )
  );

CREATE POLICY "SOC users can read incident evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'ciso')
      OR public.has_role(auth.uid(), 'soc_manager')
      OR public.has_role(auth.uid(), 'soc_tier_3')
      OR public.has_role(auth.uid(), 'soc_tier_2')
      OR public.has_role(auth.uid(), 'soc_tier_1')
      OR public.has_role(auth.uid(), 'grc_engineer')
    )
  );

CREATE POLICY "Admins and managers can delete incident evidence" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'ciso')
      OR public.has_role(auth.uid(), 'soc_manager')
    )
  );
