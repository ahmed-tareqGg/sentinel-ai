-- Create raw_logs table for storing all incoming logs before incident creation
CREATE TABLE public.raw_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  log_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  hostname TEXT,
  ip_address TEXT,
  raw_payload JSONB NOT NULL,
  parsed_message TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'analyzed', 'incident_created', 'ignored', 'error')),
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  mitre_technique TEXT,
  analyzed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_raw_logs_timestamp ON public.raw_logs(timestamp DESC);
CREATE INDEX idx_raw_logs_data_source ON public.raw_logs(data_source_id);
CREATE INDEX idx_raw_logs_processing_status ON public.raw_logs(processing_status);
CREATE INDEX idx_raw_logs_log_type ON public.raw_logs(log_type);
CREATE INDEX idx_raw_logs_severity ON public.raw_logs(severity);
CREATE INDEX idx_raw_logs_hostname ON public.raw_logs(hostname);

-- Enable RLS
ALTER TABLE public.raw_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view raw logs"
ON public.raw_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert raw logs"
ON public.raw_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update raw logs"
ON public.raw_logs FOR UPDATE
USING (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.raw_logs;