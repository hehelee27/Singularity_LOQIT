-- Phase 5: Case Assignment Workflow
-- Run this in the Supabase SQL editor

-- Add case management columns to lost_reports
ALTER TABLE lost_reports
  ADD COLUMN IF NOT EXISTS case_status TEXT NOT NULL DEFAULT 'unassigned'
    CHECK (case_status IN ('unassigned', 'under_investigation', 'resolved', 'closed')),
  ADD COLUMN IF NOT EXISTS assigned_officer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS case_notes TEXT;

-- Index for officer queries
CREATE INDEX IF NOT EXISTS idx_lost_reports_assigned_officer ON lost_reports(assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_lost_reports_case_status ON lost_reports(case_status);

-- View for police to see reports with officer names
CREATE OR REPLACE VIEW lost_reports_with_officer AS
SELECT 
  lr.*,
  op.full_name AS assigned_officer_name,
  op.phone_number AS assigned_officer_phone
FROM lost_reports lr
LEFT JOIN profiles op ON op.id = lr.assigned_officer_id;

-- RLS policy: police can update case assignment
CREATE POLICY "Police can update case assignment" ON lost_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('police', 'admin')
    )
  );
