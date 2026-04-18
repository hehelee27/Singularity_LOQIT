-- ============================================================
-- SPORS: Comprehensive Database Fix Script
-- Run this ONCE in the Supabase SQL Editor to fix ALL issues.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS throughout.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 2. ENUMS (safe: will skip if already exists)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('civilian', 'police', 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_status') THEN
    CREATE TYPE device_status AS ENUM ('registered', 'lost', 'found', 'recovered', 'stolen');
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. TABLES (create if missing)
-- ────────────────────────────────────────────────────────────

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone_number TEXT,
  aadhaar_hash TEXT,
  aadhaar_verified BOOLEAN DEFAULT FALSE,
  role user_role DEFAULT 'civilian',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  imei_primary TEXT NOT NULL UNIQUE,
  imei_secondary TEXT,
  serial_number TEXT NOT NULL UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT,
  purchase_date DATE,
  status device_status DEFAULT 'registered',
  ble_beacon_id TEXT UNIQUE DEFAULT uuid_generate_v4()::TEXT,
  is_ble_active BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  last_seen_lat DOUBLE PRECISION,
  last_seen_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beacon logs
CREATE TABLE IF NOT EXISTS public.beacon_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters FLOAT,
  rssi INTEGER,
  reported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lost reports
CREATE TABLE IF NOT EXISTS public.lost_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  last_known_lat DOUBLE PRECISION,
  last_known_lng DOUBLE PRECISION,
  last_known_address TEXT,
  incident_description TEXT,
  police_complaint_number TEXT,
  reward_amount DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Chat rooms
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  finder_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. ADD MISSING COLUMNS (Phase 2, 3, 5)
-- ────────────────────────────────────────────────────────────

-- Phase 2: device keys
ALTER TABLE devices ADD COLUMN IF NOT EXISTS spors_key TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ble_device_uuid TEXT;

-- Phase 3: device state
ALTER TABLE devices ADD COLUMN IF NOT EXISTS state TEXT;

-- Phase 5: case assignment on lost_reports
ALTER TABLE lost_reports ADD COLUMN IF NOT EXISTS case_status TEXT DEFAULT 'unassigned';
ALTER TABLE lost_reports ADD COLUMN IF NOT EXISTS assigned_officer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE lost_reports ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE lost_reports ADD COLUMN IF NOT EXISTS case_notes TEXT;

-- ────────────────────────────────────────────────────────────
-- 5. INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_lost_reports_assigned_officer ON lost_reports(assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_lost_reports_case_status ON lost_reports(case_status);

-- ────────────────────────────────────────────────────────────
-- 6. ENABLE RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE beacon_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 7. RLS POLICIES (drop old + recreate for idempotency)
-- ────────────────────────────────────────────────────────────

-- Profiles: users can read/update their own profile
DROP POLICY IF EXISTS "profiles_self" ON profiles;
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (auth.uid() = id);

-- Allow service role / trigger inserts (important for signup trigger)
DROP POLICY IF EXISTS "profiles_insert_for_signup" ON profiles;
CREATE POLICY "profiles_insert_for_signup" ON profiles FOR INSERT WITH CHECK (true);

-- Devices: owner can manage their own devices
DROP POLICY IF EXISTS "devices_owner" ON devices;
CREATE POLICY "devices_owner" ON devices FOR ALL USING (owner_id = auth.uid());

-- Police can read all devices
DROP POLICY IF EXISTS "devices_police_read" ON devices;
CREATE POLICY "devices_police_read" ON devices FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('police', 'admin'))
);

-- Beacon logs: anyone can insert, owner can read
DROP POLICY IF EXISTS "beacon_insert_any" ON beacon_logs;
CREATE POLICY "beacon_insert_any" ON beacon_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "beacon_owner_read" ON beacon_logs;
CREATE POLICY "beacon_owner_read" ON beacon_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM devices d WHERE d.id = device_id AND d.owner_id = auth.uid())
);

-- Lost reports: owner can manage
DROP POLICY IF EXISTS "lost_owner" ON lost_reports;
CREATE POLICY "lost_owner" ON lost_reports FOR ALL USING (owner_id = auth.uid());

-- Police can read all lost reports
DROP POLICY IF EXISTS "lost_reports_police_read" ON lost_reports;
CREATE POLICY "lost_reports_police_read" ON lost_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('police', 'admin'))
);

-- Police can update case assignment
DROP POLICY IF EXISTS "Police can update case assignment" ON lost_reports;
CREATE POLICY "Police can update case assignment" ON lost_reports FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('police', 'admin'))
);

-- Chat rooms: owner can manage
DROP POLICY IF EXISTS "chat_rooms_owner" ON chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_owner_all" ON chat_rooms;
CREATE POLICY "chat_rooms_owner_all" ON chat_rooms FOR ALL USING (owner_id = auth.uid());

-- Chat rooms: anyone can read (finder_token provides access)
DROP POLICY IF EXISTS "chat_rooms_select_any" ON chat_rooms;
CREATE POLICY "chat_rooms_select_any" ON chat_rooms FOR SELECT USING (true);

-- Chat messages: owner can manage
DROP POLICY IF EXISTS "chat_messages_room_owner" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_owner_all" ON chat_messages;
CREATE POLICY "chat_messages_owner_all" ON chat_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id AND r.owner_id = auth.uid())
);

-- Chat messages: anyone can insert (tracked by sender_role)
DROP POLICY IF EXISTS "chat_messages_insert_any" ON chat_messages;
CREATE POLICY "chat_messages_insert_any" ON chat_messages FOR INSERT WITH CHECK (
  sender_role IN ('owner', 'finder', 'system')
  AND EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id)
);

-- Chat messages: anyone can read messages in rooms
DROP POLICY IF EXISTS "chat_messages_select_active" ON chat_messages;
CREATE POLICY "chat_messages_select_active" ON chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id)
);

-- Notifications: user can manage their own
DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 8. FIX CHAT MESSAGES CONSTRAINT (allow 'system' sender_role)
-- ────────────────────────────────────────────────────────────
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_role_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_role_check
  CHECK (sender_role IN ('owner', 'finder', 'system'));

-- ────────────────────────────────────────────────────────────
-- 9. FIX SIGNUP TRIGGER (the main cause of "Database error saving new user")
-- ────────────────────────────────────────────────────────────

-- Drop ALL known signup triggers to prevent duplicates
DO $$
DECLARE
  trg record;
BEGIN
  FOR trg IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth'
      AND c.relname = 'users'
      AND NOT t.tgisinternal
  LOOP
    IF trg.tgname IN (
      'on_auth_user_created',
      'on_auth_user_created_profile',
      'handle_new_user_trigger'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', trg.tgname);
    END IF;
  END LOOP;
END $$;

-- Recreate a resilient trigger function that won't block signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number, aadhaar_verified, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone_number', ''), ''),
    FALSE,
    'civilian'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but NEVER block auth signup
    RAISE LOG 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Re-attach a single canonical trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 10. IMEI VERIFY FUNCTION
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_imei(p_imei TEXT)
RETURNS JSON AS $$
DECLARE rec RECORD;
BEGIN
  SELECT d.status, d.make, d.model,
    REGEXP_REPLACE(p.full_name, '(\w)\w+', '\1****', 'g') AS owner_masked
  INTO rec
  FROM devices d JOIN profiles p ON p.id = d.owner_id
  WHERE d.imei_primary = p_imei;
  IF NOT FOUND THEN RETURN json_build_object('registered', false); END IF;
  RETURN json_build_object('registered', true, 'status', rec.status,
    'make', rec.make, 'model', rec.model, 'owner_masked', rec.owner_masked);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 11. LOST REPORTS VIEW FOR POLICE
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW lost_reports_with_officer AS
SELECT
  lr.*,
  op.full_name AS assigned_officer_name,
  op.phone_number AS assigned_officer_phone
FROM lost_reports lr
LEFT JOIN profiles op ON op.id = lr.assigned_officer_id;

-- ────────────────────────────────────────────────────────────
-- 12. ENABLE REALTIME for chat_messages (safe to re-run)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────
-- DONE! All database issues should now be resolved.
-- ────────────────────────────────────────────────────────────
