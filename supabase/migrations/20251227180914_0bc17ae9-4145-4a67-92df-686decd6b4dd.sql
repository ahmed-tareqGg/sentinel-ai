-- Fix search path for update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix search path for generate_incident_number function
CREATE OR REPLACE FUNCTION public.generate_incident_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(incident_number FROM 5) AS INTEGER)), 0) + 1 
  INTO next_num FROM public.incidents;
  NEW.incident_number := 'INC-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;