import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing from .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function clearCivilians() {
  console.log('--- Clearing all Civilian users ---')

  // 1. Get all profiles where role is civilian
  const { data: civilians, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'civilian')

  if (profileError) {
    console.error('Error fetching civilian profiles:', profileError.message)
    return
  }

  if (!civilians || civilians.length === 0) {
    console.log('No civilian users found.')
    return
  }

  console.log(`Found ${civilians.length} civilian users. Deleting...`)

  for (const civilian of civilians) {
    console.log(`Deleting user: ${civilian.full_name} (${civilian.id})`)
    
    // 2. Delete from auth.users (this will cascade delete from profiles due to FK if configured, 
    // but profiles.id usually has a reference to auth.users.id)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(civilian.id)
    
    if (deleteError) {
      console.error(`Failed to delete user ${civilian.id}:`, deleteError.message)
    } else {
      console.log(`Successfully deleted ${civilian.id}`)
    }
  }

  console.log('--- Cleanup complete ---')
}

clearCivilians()
