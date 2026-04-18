require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  console.log('Project:', supabaseUrl)
  
  // 1. Check if we can even talk to the DB
  const { data: test, error: testErr } = await supabase.from('profiles').select('count', { count: 'exact', head: true })
  if (testErr) {
    console.error('Core Connection Error:', testErr.message)
    return
  }
  console.log('Database Connection: OK (Profiles count:', test, ')')

  // 2. Look for the OnePlus Nord by direct text search across the whole 'devices' table
  console.log('Searching for any record containing "OnePlus" or "Nord"...')
  const { data: search, error: searchErr } = await supabase
    .from('devices')
    .select('*')
    
  if (searchErr) {
    console.error('Search Error:', searchErr.message)
  } else {
    console.log(`Found ${search.length} records in total.`)
    search.forEach(row => {
      const match = JSON.stringify(row).toLowerCase().includes('oneplus') || JSON.stringify(row).toLowerCase().includes('nord')
      if (match) {
        console.log('MATCH FOUND:', row)
      }
    })
  }
}

debug()
