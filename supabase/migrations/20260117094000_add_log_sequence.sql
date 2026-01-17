-- Add sequential ID to raw_logs
ALTER TABLE public.raw_logs 
ADD COLUMN log_sequence BIGINT GENERATED ALWAYS AS IDENTITY;

-- Create index for faster sorting/lookup by sequence
CREATE INDEX idx_raw_logs_sequence ON public.raw_logs(log_sequence DESC);
