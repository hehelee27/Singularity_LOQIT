// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type GenerateDeviceKeyBody = {
  id: string
  state: string
  imei_primary: string
  imei_secondary: string | null
  serial_number: string
}

type DevicesInsertWebhookPayload = {
  type?: string
  table?: string
  schema?: string
  record?: Partial<GenerateDeviceKeyBody>
  old_record?: Record<string, unknown> | null
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function formatUuidFromHex(hex32: string): string {
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20, 32)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: true, skipped: 'method_not_post' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const appSecret = Deno.env.get('APP_SECRET')
    if (!appSecret) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing APP_SECRET' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing Supabase environment variables' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as DevicesInsertWebhookPayload | Partial<GenerateDeviceKeyBody>
    const record = (body as DevicesInsertWebhookPayload).record ?? (body as Partial<GenerateDeviceKeyBody>)
    const { id, state, imei_primary, imei_secondary, serial_number } = record

    if (!id || !state || !imei_primary || !serial_number) {
      return new Response(JSON.stringify({ ok: true, skipped: 'missing_required_fields' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedState = String(state).trim().toUpperCase()
    const imeiPrimaryLast6 = String(imei_primary).slice(-6)
    const imeiSecondaryLast6 = String(imei_secondary ?? imei_primary).slice(-6)
    const serialLast4 = String(serial_number).slice(-4).toUpperCase()

    const payload = `${normalizedState}${imeiPrimaryLast6}${imeiSecondaryLast6}${serialLast4}`
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload + appSecret))
    const hashHex = toHex(hashBuffer)

    const checksum = hashHex.slice(0, 4).toUpperCase()
    const loqit_key = `${normalizedState}-${imeiPrimaryLast6}-${imeiSecondaryLast6}-${serialLast4}-${checksum}`

    const bleHex = hashHex.slice(0, 32)
    const ble_device_uuid = formatUuidFromHex(bleHex)

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { error: updateError } = await supabase
      .from('devices')
      .update({ loqit_key, ble_device_uuid })
      .eq('id', id)

    if (updateError) {
      return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, loqit_key, ble_device_uuid }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
