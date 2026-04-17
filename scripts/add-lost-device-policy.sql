-- ============================================
-- SPORS Chat & Scanner RLS Policies
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- 1. Chat Rooms: Allow any authenticated user to read rooms
-- (Finders need to access rooms they participate in)
CREATE POLICY "Anyone can view chat rooms"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (true);

-- 2. Chat Rooms: Allow authenticated users to create rooms
CREATE POLICY "Authenticated users can create chat rooms"
ON public.chat_rooms
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Chat Rooms: Allow updating rooms (e.g., closing them)
CREATE POLICY "Authenticated users can update chat rooms"
ON public.chat_rooms
FOR UPDATE
TO authenticated
USING (true);

-- 4. Chat Messages: Allow reading messages in any room
CREATE POLICY "Anyone can read chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (true);

-- 5. Chat Messages: Allow sending messages
CREATE POLICY "Anyone can insert chat messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Chat Messages: Allow marking messages as read
CREATE POLICY "Anyone can update chat messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (true);

-- 7. Beacon Logs: Allow any authenticated user to insert
-- (Finders need to report location sightings)
CREATE POLICY "Anyone can insert beacon logs"
ON public.beacon_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 8. Beacon Logs: Allow reading beacon logs
CREATE POLICY "Anyone can read beacon logs"
ON public.beacon_logs
FOR SELECT
TO authenticated
USING (true);

-- 9. Devices: Allow finders to update last_seen location
CREATE POLICY "Anyone can update device location"
ON public.devices
FOR UPDATE
TO authenticated
USING (status = 'lost')
WITH CHECK (status = 'lost');

-- 10. Lost Reports: Allow reading/updating for chat recovery flow
CREATE POLICY "Anyone can read lost reports"
ON public.lost_reports
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone can update lost reports"
ON public.lost_reports
FOR UPDATE
TO authenticated
USING (true);
