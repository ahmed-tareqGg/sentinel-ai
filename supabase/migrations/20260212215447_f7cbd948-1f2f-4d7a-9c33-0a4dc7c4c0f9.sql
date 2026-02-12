
CREATE TABLE public.chat_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view read receipts" ON public.chat_read_receipts FOR SELECT USING (true);
CREATE POLICY "Users can mark as read" ON public.chat_read_receipts FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_read_receipts;
