require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(url, key)

async function fixUuids() {
  console.log('\n=== Fixing NULL ble_device_uuid fields ===\n')

  // Get all devices where ble_device_uuid is null but ble_beacon_id exists
  const { data, error } = await supabase
    .from('devices')
    .select('id, make, model, status, ble_device_uuid, ble_beacon_id')
    .is('ble_device_uuid', null)
    .not('ble_beacon_id', 'is', null)

  if (error) { console.error('Query error:', error); return }
  if (!data?.length) { console.log('No devices need fixing.'); return }

  console.log(`Found ${data.length} device(s) with missing UUID:\n`)

  for (const dev of data) {
    console.log(`  Fixing: ${dev.make} ${dev.model} (${dev.status})`)
    console.log(`    Copying beacon_id -> device_uuid: ${dev.ble_beacon_id}`)

    const { error: updateErr } = await supabase
      .from('devices')
      .update({ ble_device_uuid: dev.ble_beacon_id })
      .eq('id', dev.id)

    if (updateErr) {
      console.error(`    FAILED:`, updateErr.message)
    } else {
      console.log(`    ✅ Fixed!`)
    }
  }

  // Verify
  console.log('\n=== Verification ===\n')
  const { data: verify } = await supabase.from('devices').select('make, model, status, ble_device_uuid, ble_beacon_id')
  verify?.forEach(d => {
    console.log(`  [${d.status.toUpperCase()}] ${d.make} ${d.model}`)
    console.log(`    uuid:   ${d.ble_device_uuid || 'NULL'}`)
    console.log(`    beacon: ${d.ble_beacon_id || 'NULL'}`)
  })
}

fixUuids()
