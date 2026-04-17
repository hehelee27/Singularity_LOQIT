import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const accessToken = process.env.SUPABASE_ACCESS_TOKEN

if (!supabaseUrl || !serviceRoleKey || !accessToken) {
  console.error(
    'Missing env vars. Required: EXPO_PUBLIC_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN'
  )
  process.exit(1)
}

const refMatch = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i)
if (!refMatch) {
  console.error('Invalid Supabase URL format:', supabaseUrl)
  process.exit(1)
}
const projectRef = refMatch[1]

async function applySignupFix() {
  const sqlPath = path.resolve(process.cwd(), 'supabase', 'fix_signup_db_error.sql')
  const query = await fs.readFile(sqlPath, 'utf8')

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed SQL apply (${response.status}): ${text}`)
  }
}

async function createTestUser() {
  const email = `spors.auto.${Date.now()}@example.com`
  const password = 'Spors@12345'

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'SPORS Auto User',
        phone_number: '+911234567890',
      },
    }),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Failed user create (${response.status}): ${text}`)
  }

  return { email, password }
}

try {
  console.log('Applying signup DB fix...')
  await applySignupFix()

  console.log('Creating test user...')
  const creds = await createTestUser()

  console.log('DONE')
  console.log(JSON.stringify(creds, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
