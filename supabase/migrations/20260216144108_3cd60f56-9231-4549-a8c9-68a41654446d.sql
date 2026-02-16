
CREATE TABLE public.demo_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.demo_otp_codes ENABLE ROW LEVEL SECURITY;

-- No direct access needed - edge functions use service role
CREATE POLICY "No direct access" ON public.demo_otp_codes FOR ALL USING (false);
