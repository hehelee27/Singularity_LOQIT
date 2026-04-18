-- ==========================================
-- LOQIT: HARDWARE PAIRING MIGRATION
-- ==========================================

-- 1. Add the column to track physical handsets
ALTER TABLE devices ADD COLUMN IF NOT EXISTS installation_id TEXT;

-- 2. Create an index for fast lookups (Used by AuthGate and ProtectionTask)
CREATE INDEX IF NOT EXISTS idx_devices_installation_id ON devices(installation_id);

-- 3. Update Row Level Security (RLS)
-- This ensures that your app has permission to write to this new column
DROP POLICY IF EXISTS "devices_owner_update_installation" ON devices;
CREATE POLICY "devices_owner_update_installation" 
ON devices FOR UPDATE 
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Optional: Verify the column exists
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'devices' AND column_name = 'installation_id';
