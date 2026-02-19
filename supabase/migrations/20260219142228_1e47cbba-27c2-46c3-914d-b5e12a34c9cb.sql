
-- Fix 1: Restrict raw_logs INSERT to service role only (edge functions bypass RLS via service role)
DROP POLICY IF EXISTS "System can insert raw logs" ON public.raw_logs;

CREATE POLICY "Only service role can insert raw logs"
ON public.raw_logs FOR INSERT
WITH CHECK (false);

-- Fix 2: Make chat-attachments bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'chat-attachments';

-- Drop the public "anyone can view" policy and replace with authenticated-only
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;

CREATE POLICY "Authenticated users can view chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');
