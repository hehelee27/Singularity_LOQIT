require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(url, key)

async function diagnose() {
  console.log('\n=== LOQIT BLE DIAGNOSIS ===\n')

  // 1. Show ALL devices
  const { data: all, error: e1 } = await supabase.from('devices').select('id, make, model, status, ble_device_uuid, ble_beacon_id, installation_id').limit(50)
  if (e1) { console.error('DB Error:', e1); return }
  
  console.log(`Total devices in DB: ${all?.length || 0}`)
  all?.forEach(d => {
    console.log(`  [${d.status.toUpperCase()}] ${d.make} ${d.model}`)
    console.log(`    id:               ${d.id}`)
    console.log(`    ble_device_uuid:  ${d.ble_device_uuid || '(null)'}`)
    console.log(`    ble_beacon_id:    ${d.ble_beacon_id || '(null)'}`)
    console.log(`    installation_id:  ${d.installation_id || '(null)'}`)
    console.log('')
  })

  // 2. Show LOST devices specifically
  const lost = all?.filter(d => d.status === 'lost') || []
  console.log(`\nLost devices: ${lost.length}`)
  lost.forEach(d => {
    console.log(`  >>> ${d.make} ${d.model} — uuid: ${d.ble_device_uuid || 'NULL'}, beacon: ${d.ble_beacon_id || 'NULL'}`)
  })

  // 3. Key question
  console.log('\n=== KEY QUESTION ===')
  console.log('For BLE scanning to work, the LOST device must be:')
  console.log('  1. Running the LOQIT app')
  console.log('  2. Actively BROADCASTING its BLE signal (startBroadcasting)')
  console.log('  3. Have a valid ble_device_uuid in the database')
  console.log('')
  console.log('A phone does NOT emit BLE signals on its own.')
  console.log('The LOQIT app on the LOST phone must be running and broadcasting.')
}

diagnose()
