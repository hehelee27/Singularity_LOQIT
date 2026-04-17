import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xeykhdyanzjkymlfwseo.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleWtoZHlhbnpqa3ltbGZ3c2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzM1NjIsImV4cCI6MjA5MDEwOTU2Mn0.XSkxceiFbDqODroiNIcN7tu9yJcaAGk8UmdCUVdrC3o'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const email = `spors.test.${Date.now()}@example.com`
const password = 'Spors@12345'

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: 'SPORS Test User',
      phone_number: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    },
  },
})

if (error) {
  console.error('Signup failed:', error.message)
  process.exit(1)
}

console.log('USER_CREATED')
console.log(JSON.stringify({
  email,
  password,
  userId: data.user?.id ?? null,
  emailConfirmed: !!data.user?.email_confirmed_at,
}, null, 2))
