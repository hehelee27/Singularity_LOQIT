-- ============================================
-- Additional SPORS RLS Policies + Notifications Table
-- Run this in Supabase SQL Editor
-- ============================================

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'general',
  reference_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow deleting chat messages (needed for device deletion cascade)
CREATE POLICY "Anyone can delete chat messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (true);

-- Allow deleting chat rooms (needed for device deletion cascade)
CREATE POLICY "Anyone can delete chat rooms"
ON public.chat_rooms
FOR DELETE
TO authenticated
USING (true);

-- Allow deleting beacon logs (needed for device deletion cascade)
CREATE POLICY "Anyone can delete beacon logs"
ON public.beacon_logs
FOR DELETE
TO authenticated
USING (true);

-- Allow deleting lost reports (needed for device deletion cascade)
CREATE POLICY "Anyone can delete lost reports"
ON public.lost_reports
FOR DELETE
TO authenticated
USING (true);

-- Notifications: Allow users to read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Notifications: Allow updating own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Notifications: Allow system to insert notifications
CREATE POLICY "Anyone can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);
