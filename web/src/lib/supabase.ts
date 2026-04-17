import { createClient } from '@supabase/supabase-js'

function resolveSupabaseUrl(): string {
  const api = import.meta.env.VITE_SUPABASE_API_URL
  const raw = import.meta.env.VITE_SUPABASE_URL || ''

  if (api && api.startsWith('https://')) return api

  if (raw.startsWith('https://') && raw.includes('.supabase.co')) return raw

  if (raw && !raw.startsWith('http')) {
    return `https://${raw}.supabase.co`
  }

  console.warn('Could not resolve a valid Supabase URL. Check VITE_SUPABASE_API_URL or VITE_SUPABASE_URL.')
  return 'https://placeholder.supabase.co'
}

const supabaseUrl = resolveSupabaseUrl()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_ANON_KEY environment variable.')
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)
