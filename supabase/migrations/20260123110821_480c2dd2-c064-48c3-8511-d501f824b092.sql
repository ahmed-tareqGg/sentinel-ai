-- Drop the existing check constraint and add a new one with all valid statuses
ALTER TABLE public.raw_logs DROP CONSTRAINT IF EXISTS raw_logs_processing_status_check;

-- Add new constraint that includes all valid processing statuses
ALTER TABLE public.raw_logs ADD CONSTRAINT raw_logs_processing_status_check 
CHECK (processing_status IS NULL OR processing_status IN ('pending', 'analyzed', 'incident_created', 'benign', 'ignored', 'error'));