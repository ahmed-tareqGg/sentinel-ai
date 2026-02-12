
-- Private chat channels with password protection
CREATE TABLE public.private_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_by_id UUID NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.private_channels ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see channel names (to know they exist)
CREATE POLICY "Authenticated users can view private channels"
  ON public.private_channels FOR SELECT TO authenticated
  USING (true);

-- Any authenticated user can create
CREATE POLICY "Authenticated users can create private channels"
  ON public.private_channels FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only creator can delete
CREATE POLICY "Creator can delete own channel"
  ON public.private_channels FOR DELETE TO authenticated
  USING (created_by_id = auth.uid());

-- Function to create a private channel with hashed password
CREATE OR REPLACE FUNCTION public.create_private_channel(_name TEXT, _password TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  
  INSERT INTO public.private_channels (name, created_by, created_by_id, password_hash)
  VALUES (_name, COALESCE(v_email, 'unknown'), auth.uid(), extensions.crypt(_password, extensions.gen_salt('bf')))
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to verify private channel password
CREATE OR REPLACE FUNCTION public.verify_channel_password(_channel_id UUID, _password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT password_hash INTO v_hash
  FROM public.private_channels
  WHERE id = _channel_id;
  
  IF v_hash IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_hash = extensions.crypt(_password, v_hash);
END;
$$;
