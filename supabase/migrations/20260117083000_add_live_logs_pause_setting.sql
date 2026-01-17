-- Add live_logs_paused setting to system_settings table
INSERT INTO public.system_settings (key, value) 
VALUES ('live_logs_paused', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
