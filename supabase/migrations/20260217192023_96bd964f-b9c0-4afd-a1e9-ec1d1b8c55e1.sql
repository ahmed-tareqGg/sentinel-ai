-- AI Response Cache table for Offline Cache System
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  context_route TEXT,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[]
);

-- Index for fast hash lookups
CREATE INDEX IF NOT EXISTS idx_ai_cache_query_hash ON public.ai_response_cache (query_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_last_used ON public.ai_response_cache (last_used_at DESC);

-- RLS: allow service role full access, authenticated users can read
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cache"
  ON public.ai_response_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage cache"
  ON public.ai_response_cache FOR ALL
  USING (true)
  WITH CHECK (true);
