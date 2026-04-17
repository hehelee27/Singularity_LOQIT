-- ============================================================
-- LOQIT: Anti-Theft Mode Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Table: protection_settings (per-device config)
CREATE TABLE IF NOT EXISTS public.protection_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT FALSE,
  sim_watch BOOLEAN DEFAULT TRUE,
  motion_watch BOOLEAN DEFAULT TRUE,
  camera_capture BOOLEAN DEFAULT FALSE,
  ble_broadcast BOOLEAN DEFAULT TRUE,
  lock_message TEXT DEFAULT 'This device belongs to its rightful owner. Contact LOQIT to return it.',
  alert_phone TEXT,
  enabled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: anti_theft_events (tamper log)
CREATE TABLE IF NOT EXISTS public.anti_theft_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'sim_change' | 'motion_alert' | 'camera_capture' | 'manual_trigger'
  event_data JSONB,         -- carrier names, image_url, accelerometer delta, etc.
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_anti_theft_events_device ON public.anti_theft_events(device_id);
CREATE INDEX IF NOT EXISTS idx_anti_theft_events_owner ON public.anti_theft_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_anti_theft_events_type ON public.anti_theft_events(event_type);
CREATE INDEX IF NOT EXISTS idx_protection_settings_device ON public.protection_settings(device_id);

-- RLS
ALTER TABLE public.protection_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anti_theft_events ENABLE ROW LEVEL SECURITY;

-- Policies: owner can manage their own protection settings
DROP POLICY IF EXISTS "protection_owner" ON public.protection_settings;
CREATE POLICY "protection_owner" ON public.protection_settings
  FOR ALL USING (owner_id = auth.uid());

-- Policies: owner can see their own theft events
DROP POLICY IF EXISTS "theft_events_owner" ON public.anti_theft_events;
CREATE POLICY "theft_events_owner" ON public.anti_theft_events
  FOR ALL USING (owner_id = auth.uid());

-- Police can read all theft events for investigation
DROP POLICY IF EXISTS "theft_events_police_read" ON public.anti_theft_events;
CREATE POLICY "theft_events_police_read" ON public.anti_theft_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('police', 'admin'))
  );

-- Realtime for live tamper alerts
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.anti_theft_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
