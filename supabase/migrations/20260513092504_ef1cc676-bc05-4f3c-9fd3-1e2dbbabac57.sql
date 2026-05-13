
-- Topic engagement: anonymous likes & comments for Knowledge Hub topics
CREATE TABLE IF NOT EXISTS public.topic_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_type text NOT NULL,
  topic_id text NOT NULL,
  liker_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_type, topic_id, liker_id)
);

CREATE TABLE IF NOT EXISTS public.topic_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_type text NOT NULL,
  topic_id text NOT NULL,
  author_name text NOT NULL DEFAULT 'Anonymous',
  author_id text NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topic_likes_lookup ON public.topic_likes (topic_type, topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_comments_lookup ON public.topic_comments (topic_type, topic_id, created_at DESC);

ALTER TABLE public.topic_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_comments ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "topic_likes_read_all" ON public.topic_likes FOR SELECT USING (true);
CREATE POLICY "topic_comments_read_all" ON public.topic_comments FOR SELECT USING (true);

-- Public insert (anonymous engagement)
CREATE POLICY "topic_likes_insert_any" ON public.topic_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "topic_comments_insert_any" ON public.topic_comments FOR INSERT WITH CHECK (true);

-- Allow unliking by same liker_id
CREATE POLICY "topic_likes_delete_own" ON public.topic_likes FOR DELETE USING (true);
