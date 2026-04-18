-- Add email_verified column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.email_verified IS 'Tracks if the user has completed the custom n8n email verification flow.';
