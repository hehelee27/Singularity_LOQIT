require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) throw new Error('Missing URL')

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDevice() {
  console.log('Querying URL:', supabaseUrl)
  console.log('Inspecting first 20 devices from devices table...')
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .limit(20)
    
  if (error) {
    console.error('Error querying:', error)
    return
  }

  if (data && data.length > 0) {
    console.log(`Found ${data.length} devices total.`)
    data.forEach(d => {
      console.log(`- [${d.id}] ${d.make} ${d.model} | Status: ${d.status} | UUID: ${d.ble_device_uuid}`)
    })
  } else {
    console.log('Zero devices found in this project database. Please check if you are logged in correctly.')
  }
}

checkDevice()
