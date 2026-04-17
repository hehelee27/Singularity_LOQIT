import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzlogtmhkjrywhmbyuwa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6bG9ndG1oa2pyeXdobWJ5dXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzEyNTIsImV4cCI6MjA5MjAwNzI1Mn0.tXEQBi80nG5m_5h_llKix5DAwugwAdvKKzRKMDDhEcw';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);