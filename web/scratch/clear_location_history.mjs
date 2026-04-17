import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Point to the root .env
const envPath = path.join(process.cwd(), '../.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=')
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/^"|"$/g, '')
})

const supabaseUrl = env['EXPO_PUBLIC_SUPABASE_URL']
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearLocationHistory() {
  console.log('🧹 Starting cleanup of location records...')

  try {
    const { error: logError } = await supabase.from('beacon_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (logError) throw logError
    console.log('✅ Deleted all beacon log history.')

    const { error: deviceError } = await supabase.from('devices').update({
      last_seen_at: null,
      last_seen_lat: null,
      last_seen_lng: null
    }).neq('id', '00000000-0000-0000-0000-000000000000')

    if (deviceError) throw deviceError
    console.log('✅ Reset "Last Seen" coordinates for all devices.')

    console.log('\n✨ Database cleared! Now we can start a fresh accuracy test.')
  } catch (err) {
    console.error('❌ Cleanup failed:', err)
  }
}

clearLocationHistory()
