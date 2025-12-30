-- Create system_settings table for Safe Mode and other settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT 'false'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and modify system settings
CREATE POLICY "Admins can view system settings"
  ON public.system_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update system settings"
  ON public.system_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert system settings"
  ON public.system_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default safe_mode setting
INSERT INTO public.system_settings (key, value) 
VALUES ('safe_mode', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add soft delete columns to incidents table
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

-- Create index for faster queries on non-deleted incidents
CREATE INDEX IF NOT EXISTS idx_incidents_deleted_at ON public.incidents(deleted_at) WHERE deleted_at IS NULL;