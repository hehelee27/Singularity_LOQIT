import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fetch from 'node-fetch'

dotenv.config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const sendUrl = 'https://zore1803.app.n8n.cloud/webhook/send-verification'
const verifyUrl = 'https://zore1803.app.n8n.cloud/webhook/verify-otp'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testWorkflow() {
  const testEmail = 'ai_test_' + Math.random().toString(36).substring(7) + '@example.com'
  
  console.log(`\n--- STEP 1: Sending Verification to ${testEmail} ---`)
  try {
    const sendRes = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    })
    console.log(`Send Webhook Status: ${sendRes.status}`)
    const sendData = await sendRes.text()
    console.log(`Send Webhook Response: ${sendData}`)
  } catch (err) {
    console.error('Error calling send webhook:', err.message)
    return
  }

  console.log(`\n--- STEP 2: Checking Supabase for OTP ---`)
  // Wait a few seconds for n8n to process
  await new Promise(resolve => setTimeout(resolve, 3000))

  const { data, error } = await supabase
    .from('otp_verifications')
    .select('*')
    .eq('email', testEmail)
    .single()

  if (error || !data) {
    console.error('OTP record not found in Supabase. n8n might have failed to write to DB.')
    console.error('Error:', error?.message)
    return
  }

  console.log('OTP Record found in Supabase:', data)
  const otp = data.otp

  console.log(`\n--- STEP 3: Verifying OTP (${otp}) via n8n ---`)
  try {
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: otp })
    })
    const verifyData = await verifyRes.json()
    console.log('Verify Webhook Response:', verifyData)

    if (verifyData.status === 'verified') {
      console.log('\n✅ SUCCESS: The n8n workflow is working perfectly!')
    } else {
      console.log('\n❌ FAILED: The verification returned an error.')
    }
  } catch (err) {
    console.error('Error calling verify webhook:', err.message)
  }
}

testWorkflow()
