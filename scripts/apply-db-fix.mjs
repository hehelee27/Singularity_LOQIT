#!/usr/bin/env node
/**
 * Apply the comprehensive database fix SQL to Supabase.
 * Uses the Supabase Management API to execute SQL statements.
 *
 * Usage: node scripts/apply-db-fix.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env vars from .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
}

const SUPABASE_PROJECT_ID = envVars.SUPABASE_PROJECT_ID;
const SUPABASE_ACCESS_TOKEN = envVars.SUPABASE_ACCESS_TOKEN;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = envVars.EXPO_PUBLIC_SUPABASE_URL;

if (!SUPABASE_PROJECT_ID || !SUPABASE_ACCESS_TOKEN) {
  console.error('Missing SUPABASE_PROJECT_ID or SUPABASE_ACCESS_TOKEN in .env');
  process.exit(1);
}

// Read the fix SQL
const sqlPath = path.join(__dirname, '..', 'supabase', 'fix_all_database_issues.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

console.log('🔧 Applying database fixes to Supabase project:', SUPABASE_PROJECT_ID);
console.log('   SQL file:', sqlPath);
console.log('   SQL length:', sql.length, 'chars');
console.log('');

// Try Management API first
async function applyViaManagementAPI() {
  const url = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query`;
  console.log('📡 Attempting via Supabase Management API...');

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await resp.text();

  if (resp.ok) {
    console.log('✅ Management API: SQL executed successfully!');
    try {
      const json = JSON.parse(text);
      console.log('   Response:', JSON.stringify(json).slice(0, 300));
    } catch {
      console.log('   Response:', text.slice(0, 300));
    }
    return true;
  } else {
    console.error('❌ Management API failed:', resp.status, resp.statusText);
    console.error('   Body:', text.slice(0, 500));
    return false;
  }
}

// Fallback: try via PostgREST RPC using service role key
async function applyViaServiceRole() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️  No service role key available for fallback.');
    return false;
  }

  // Split the SQL and execute critical parts via pg_catalog or rpc
  // This is limited - the Management API is preferred
  console.log('📡 Attempting fallback via service role RPC...');

  // We can try the Supabase /rest/v1/rpc endpoint with a custom function
  // But that requires the function to already exist. Let's just report.
  console.log('⚠️  Service-role fallback not applicable for DDL statements.');
  console.log('   Please use the Supabase SQL Editor instead.');
  return false;
}

async function main() {
  const ok = await applyViaManagementAPI();
  if (!ok) {
    const fallbackOk = await applyViaServiceRole();
    if (!fallbackOk) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log(' MANUAL STEP REQUIRED');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log(' 1. Go to: https://supabase.com/dashboard/project/' + SUPABASE_PROJECT_ID + '/sql');
      console.log(' 2. Open the file: supabase/fix_all_database_issues.sql');
      console.log(' 3. Paste the entire SQL content into the SQL Editor');
      console.log(' 4. Click "Run"');
      console.log('');
      console.log(' This will fix:');
      console.log('   ✓ "Database error saving new user" on signup');
      console.log('   ✓ Missing columns (spors_key, ble_device_uuid, state, case_status)');
      console.log('   ✓ Chat RLS policies for finders');
      console.log('   ✓ Police dashboard read access');
      console.log('   ✓ Realtime for chat messages');
      console.log('═══════════════════════════════════════════════════════');
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
