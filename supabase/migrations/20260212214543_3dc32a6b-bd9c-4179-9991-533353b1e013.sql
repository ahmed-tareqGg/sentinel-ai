
-- Add reactions table for emoji reactions on messages
CREATE TABLE public.chat_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all reactions" ON public.chat_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add reactions" ON public.chat_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.chat_reactions FOR DELETE USING (auth.uid() = user_id);

-- Add pinned and priority to chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Add realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
