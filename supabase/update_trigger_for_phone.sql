-- ============================================================
-- LOQIT: Phone Registration DB Trigger Update
-- Run this in the Supabase SQL Editor to allow users to sign
-- up with solely a Phone Number via Twilio without crashing
-- the 'auth.users' user-creation background trigger.
-- ============================================================

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
    -- We safely pull the designated phone strictly from the new Twilio logic payload
    COALESCE(NEW.phone, NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone_number', ''), '')),
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
    RAISE LOG 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
