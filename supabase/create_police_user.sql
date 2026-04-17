-- SQL Script to Create Police User
-- Run this in your Supabase SQL Editor

-- First, you need to create an auth user via the Supabase Dashboard or signup
-- Then use this SQL to update their role to police

-- Replace 'USER_EMAIL_HERE' with the actual email after signup
UPDATE profiles 
SET role = 'police'::user_role
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE'
);

-- Verify it worked
SELECT 
  p.id,
  p.full_name,
  p.role,
  u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'police';
