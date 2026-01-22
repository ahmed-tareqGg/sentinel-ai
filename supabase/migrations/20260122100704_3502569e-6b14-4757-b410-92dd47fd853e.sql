-- Add new columns to compliance_controls table
ALTER TABLE compliance_controls 
ADD COLUMN IF NOT EXISTS control_category text,
ADD COLUMN IF NOT EXISTS applicable text DEFAULT 'yes',
ADD COLUMN IF NOT EXISTS justification text,
ADD COLUMN IF NOT EXISTS implemented boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS implementation_description text,
ADD COLUMN IF NOT EXISTS evidence_reference text,
ADD COLUMN IF NOT EXISTS risk_reference text,
ADD COLUMN IF NOT EXISTS comments text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Update control_category based on control_code for existing records
UPDATE compliance_controls SET control_category = 
  CASE 
    WHEN control_code LIKE 'A.5.%' THEN 'Organizational'
    WHEN control_code LIKE 'A.6.%' THEN 'People'
    WHEN control_code LIKE 'A.7.%' THEN 'Physical'
    WHEN control_code LIKE 'A.8.%' THEN 'Technological'
    ELSE category
  END
WHERE control_category IS NULL;

-- Set implemented based on existing status
UPDATE compliance_controls SET implemented = 
  CASE 
    WHEN status = 'implemented' THEN true
    ELSE false
  END
WHERE implemented IS NULL;

-- Create compliance_evidence table for structured evidence
CREATE TABLE IF NOT EXISTS compliance_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id uuid REFERENCES compliance_controls(id) ON DELETE CASCADE,
  evidence_type text NOT NULL, -- log | incident | policy | report | screenshot
  source text, -- SOCMind / Jira / ServiceNow
  reference_id text, -- incident_id / log_id
  title text NOT NULL,
  description text,
  file_url text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on compliance_evidence
ALTER TABLE compliance_evidence ENABLE ROW LEVEL SECURITY;

-- RLS policies for compliance_evidence
CREATE POLICY "Authenticated users can view evidence" 
ON compliance_evidence FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and GRC can manage evidence" 
ON compliance_evidence FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'grc_engineer', 'ciso')
  )
);

-- Create trigger for updated_at on compliance_controls
CREATE OR REPLACE FUNCTION update_compliance_controls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_compliance_controls_timestamp ON compliance_controls;
CREATE TRIGGER update_compliance_controls_timestamp
  BEFORE UPDATE ON compliance_controls
  FOR EACH ROW
  EXECUTE FUNCTION update_compliance_controls_updated_at();