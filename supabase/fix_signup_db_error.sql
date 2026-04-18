-- Fix signup failures caused by broken/duplicate auth->profile triggers.
-- Run this once in Supabase SQL Editor for your project.

-- Optional safety: ensure extension used elsewhere exists.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure profiles table exists with expected columns.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone_number text,
  aadhaar_hash text,
  aadhaar_verified boolean DEFAULT false,
  role public.user_role DEFAULT 'civilian',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Drop any known signup triggers that may double-insert profiles.
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
    IF trg.tgname IN ('on_auth_user_created', 'on_auth_user_created_profile', 'handle_new_user_trigger') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', trg.tgname);
    END IF;
  END LOOP;
END
$$;

-- Recreate a resilient trigger function.
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
    -- Avoid blocking auth signup if profile insert fails unexpectedly.
    RAISE LOG 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Attach a single canonical trigger.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Helpful index for lookup.
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
