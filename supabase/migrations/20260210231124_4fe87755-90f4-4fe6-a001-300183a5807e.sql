
-- IOCs table
CREATE TABLE public.incident_iocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  ioc_type TEXT NOT NULL CHECK (ioc_type IN ('ip', 'domain', 'url', 'file_hash', 'email', 'user', 'process')),
  value TEXT NOT NULL,
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high', 'critical')),
  source TEXT DEFAULT 'manual',
  notes TEXT,
  added_by UUID,
  added_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_iocs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read IOCs" ON public.incident_iocs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert IOCs" ON public.incident_iocs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update IOCs" ON public.incident_iocs
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete IOCs" ON public.incident_iocs
  FOR DELETE TO authenticated USING (true);

-- Evidence/Attachments table
CREATE TABLE public.incident_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('log', 'screenshot', 'report', 'pcap', 'config', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT,
  file_url TEXT,
  file_size INTEGER,
  source TEXT DEFAULT 'manual',
  linked_ioc_id UUID REFERENCES public.incident_iocs(id),
  added_by UUID,
  added_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read evidence" ON public.incident_evidence
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert evidence" ON public.incident_evidence
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete evidence" ON public.incident_evidence
  FOR DELETE TO authenticated USING (true);

-- Investigation Reports table
CREATE TABLE public.incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'investigation' CHECK (report_type IN ('investigation', 'executive', 'technical')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'markdown' CHECK (format IN ('markdown', 'html', 'pdf')),
  generated_by UUID,
  generated_by_email TEXT,
  generated_by_role TEXT,
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reports" ON public.incident_reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert reports" ON public.incident_reports
  FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_iocs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_evidence;

-- Create storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('incident-evidence', 'incident-evidence', false, 20971520)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incident-evidence');

CREATE POLICY "Authenticated users can read evidence files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'incident-evidence');
