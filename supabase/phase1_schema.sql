-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role AS ENUM ('civilian', 'police', 'admin');
CREATE TYPE device_status AS ENUM ('registered', 'lost', 'found', 'recovered', 'stolen');

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
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

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
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
CREATE TABLE IF NOT EXISTS beacon_logs (
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
CREATE TABLE IF NOT EXISTS lost_reports (
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
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  finder_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('owner', 'finder')),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE beacon_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "devices_owner" ON devices FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "beacon_insert_any" ON beacon_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "beacon_owner_read" ON beacon_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM devices d WHERE d.id = device_id AND d.owner_id = auth.uid())
);
CREATE POLICY "lost_owner" ON lost_reports FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "chat_rooms_owner" ON chat_rooms FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "chat_messages_room_owner" ON chat_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id AND r.owner_id = auth.uid())
);
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- IMEI verify function (public, no auth needed)
-- Updated to check both primary and secondary IMEIs
CREATE OR REPLACE FUNCTION verify_imei(p_imei TEXT)
RETURNS JSON AS $$
DECLARE rec RECORD;
BEGIN
  SELECT d.status, d.make, d.model,
    REGEXP_REPLACE(p.full_name, '(\w)\w+', '\1****', 'g') AS owner_masked
  INTO rec
  FROM devices d JOIN profiles p ON p.id = d.owner_id
  WHERE d.imei_primary = p_imei OR d.imei_secondary = p_imei
  LIMIT 1;
  
  IF NOT FOUND THEN RETURN json_build_object('registered', false); END IF;
  RETURN json_build_object('registered', true, 'status', rec.status,
    'make', rec.make, 'model', rec.model, 'owner_masked', rec.owner_masked);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
