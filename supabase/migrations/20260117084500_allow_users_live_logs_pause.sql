-- Allow authenticated users to read and update the live_logs_paused setting
CREATE POLICY "Authenticated users can view live_logs_paused"
  ON public.system_settings FOR SELECT
  USING (auth.uid() IS NOT NULL AND key = 'live_logs_paused');

CREATE POLICY "Authenticated users can update live_logs_paused"
  ON public.system_settings FOR UPDATE
  USING (auth.uid() IS NOT NULL AND key = 'live_logs_paused')
  WITH CHECK (key = 'live_logs_paused');

CREATE POLICY "Authenticated users can insert live_logs_paused"
  ON public.system_settings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND key = 'live_logs_paused');
