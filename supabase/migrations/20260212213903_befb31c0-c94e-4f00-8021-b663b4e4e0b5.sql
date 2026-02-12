
-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  sender_email TEXT,
  sender_name TEXT,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'general',
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all messages
CREATE POLICY "Authenticated users can read chat messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own messages
CREATE POLICY "Users can send chat messages"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- Users can update their own messages
CREATE POLICY "Users can edit own messages"
ON public.chat_messages FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.chat_messages FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Index for channel queries
CREATE INDEX idx_chat_messages_channel ON public.chat_messages(channel, created_at DESC);

-- Index for mention lookups
CREATE INDEX idx_chat_messages_mentions ON public.chat_messages USING GIN(mentions);

-- Index for incident-linked messages
CREATE INDEX idx_chat_messages_incident ON public.chat_messages(incident_id) WHERE incident_id IS NOT NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Update timestamp trigger
CREATE TRIGGER update_chat_messages_updated_at
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
