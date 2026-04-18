import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function runMigration() {
  console.log('Running migration: Adding email_verified to profiles...')
  
  const { error } = await supabase.rpc('exec_sql', { 
    sql_query: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;' 
  })

  // If RPC fails (might not exist), we fallback to a simple update to test if column exists
  if (error) {
    console.log('RPC exec_sql not found or failed. Trying direct query via REST (this might fail if RLS is tight).')
    const { error: alterError } = await supabase.from('profiles').select('email_verified').limit(1)
    if (alterError && alterError.message.includes('column "email_verified" does not exist')) {
        console.log('Column does not exist. Please run the SQL in your Supabase Dashboard SQL Editor:')
        console.log('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;')
    } else {
        console.log('Column seems to already exist or verified.')
    }
  } else {
    console.log('Migration successful!')
  }
}

runMigration()
