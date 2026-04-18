-- Add installation_id to track which physical handset is linked to which device record
ALTER TABLE devices ADD COLUMN IF NOT EXISTS installation_id TEXT;
CREATE INDEX IF NOT EXISTS idx_devices_installation_id ON devices(installation_id);
