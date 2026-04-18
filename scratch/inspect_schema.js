require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for schema inspection

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectSchema() {
  console.log('Inspecting Database Schema for project:', supabaseUrl)
  
  // 1. Check all tables in public schema
  const { data: tables, error: tableError } = await supabase
    .from('_rpc_helper_') // Dummy to trigger a generic query if possible, or use RPC
    .select('table_name')
    .limit(0)
    .catch(() => ({ data: null }))

  console.log('Attempting to find table names...')
  
  // High level check: List everything that might be a device table
  const searchTables = ['devices', 'loqit_devices', 'user_devices', 'beacons', 'registered_devices']
  
  for (const t of searchTables) {
    const { count, error } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true })
      
    if (!error) {
      console.log(`Found table: "${t}" | Row count: ${count}`)
    } else {
      console.log(`Table "${t}" not found or error:`, error.message)
    }
  }
}

inspectSchema()
