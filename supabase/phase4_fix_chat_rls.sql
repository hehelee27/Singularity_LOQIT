-- Fix chat RLS policies to allow both owners and finders to participate in chat
-- This addresses the "Unable to send message" bug for finders

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "chat_messages_room_owner" ON chat_messages;

-- Create separate policies for different operations

-- Owners can do everything with their chat messages
CREATE POLICY "chat_messages_owner_all" ON chat_messages 
FOR ALL USING (
  EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id AND r.owner_id = auth.uid())
);

-- Anyone can insert messages (finder, owner, or system) - the sender_role is tracked
CREATE POLICY "chat_messages_insert_any" ON chat_messages 
FOR INSERT WITH CHECK (
  sender_role IN ('owner', 'finder', 'system')
  AND EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id)
);

-- Anyone can read messages in active chat rooms (needed for finders to see conversation)
CREATE POLICY "chat_messages_select_active" ON chat_messages 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id)
);

-- Fix chat_rooms policy to allow finders to access rooms
DROP POLICY IF EXISTS "chat_rooms_owner" ON chat_rooms;

-- Owners can do everything with their chat rooms
CREATE POLICY "chat_rooms_owner_all" ON chat_rooms 
FOR ALL USING (owner_id = auth.uid());

-- Anyone can read chat rooms (finder_token provides access control)
CREATE POLICY "chat_rooms_select_any" ON chat_rooms 
FOR SELECT USING (true);

-- Enable realtime for chat_messages table (required for real-time subscriptions)
-- Note: Run this in Supabase Dashboard > Database > Replication
-- Or use the command below:
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Update the check constraint to allow 'system' sender_role
-- First drop the old constraint, then add new one
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_role_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_role_check 
  CHECK (sender_role IN ('owner', 'finder', 'system'));
