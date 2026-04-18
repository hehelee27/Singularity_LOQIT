-- ============================================
-- SPORS Chat Fix - Run this in Supabase SQL Editor
-- This fixes all chat-related issues
-- ============================================

-- Step 1: Add message_text column if it doesn't exist
-- (Schema uses 'content' but app expects 'message_text')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_messages'
      AND column_name = 'message_text'
  ) THEN
    ALTER TABLE public.chat_messages ADD COLUMN message_text TEXT;
    -- Copy existing content to message_text
    UPDATE public.chat_messages SET message_text = content WHERE message_text IS NULL;
  END IF;
END $$;

-- Step 2: Drop ALL existing restrictive chat policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_rooms'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_rooms', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_messages', pol.policyname);
  END LOOP;
END $$;

-- Step 3: Create correct chat_rooms policies
-- Anyone authenticated can READ chat rooms (needed for finders)
CREATE POLICY "chat_rooms_select_authenticated"
ON public.chat_rooms FOR SELECT
TO authenticated
USING (true);

-- Anyone authenticated can INSERT chat rooms (finder creates room)
CREATE POLICY "chat_rooms_insert_authenticated"
ON public.chat_rooms FOR INSERT
TO authenticated
WITH CHECK (true);

-- Anyone authenticated can UPDATE chat rooms (close room etc.)
CREATE POLICY "chat_rooms_update_authenticated"
ON public.chat_rooms FOR UPDATE
TO authenticated
USING (true);

-- Anyone authenticated can DELETE chat rooms (device deletion cascade)
CREATE POLICY "chat_rooms_delete_authenticated"
ON public.chat_rooms FOR DELETE
TO authenticated
USING (true);

-- Step 4: Create correct chat_messages policies
-- Anyone authenticated can READ messages in any room
CREATE POLICY "chat_messages_select_authenticated"
ON public.chat_messages FOR SELECT
TO authenticated
USING (true);

-- Anyone authenticated can INSERT messages
CREATE POLICY "chat_messages_insert_authenticated"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (true);

-- Anyone authenticated can UPDATE messages (mark as read)
CREATE POLICY "chat_messages_update_authenticated"
ON public.chat_messages FOR UPDATE
TO authenticated
USING (true);

-- Anyone authenticated can DELETE messages (cascade delete)
CREATE POLICY "chat_messages_delete_authenticated"
ON public.chat_messages FOR DELETE
TO authenticated
USING (true);

-- Step 5: Also fix beacon_logs policies for the finder
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beacon_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.beacon_logs', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "beacon_logs_select_authenticated"
ON public.beacon_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "beacon_logs_insert_authenticated"
ON public.beacon_logs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "beacon_logs_delete_authenticated"
ON public.beacon_logs FOR DELETE
TO authenticated
USING (true);

-- Step 6: Fix devices policy - allow anyone to view lost devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'devices'
      AND policyname = 'devices_view_lost'
  ) THEN
    CREATE POLICY "devices_view_lost"
    ON public.devices FOR SELECT
    TO authenticated
    USING (status = 'lost' OR owner_id = auth.uid());
  END IF;
END $$;

-- Step 7: Fix lost_reports - allow anyone to view active reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lost_reports'
      AND policyname = 'lost_reports_view_active'
  ) THEN
    CREATE POLICY "lost_reports_view_active"
    ON public.lost_reports FOR SELECT
    TO authenticated
    USING (is_active = true OR owner_id = auth.uid());
  END IF;
END $$;

-- Step 8: Fix notifications table
DO $$
DECLARE
  pol RECORD;
BEGIN
  -- Drop and recreate notification policies
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_any"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Done! All chat, beacon, and notification policies are now correct.
