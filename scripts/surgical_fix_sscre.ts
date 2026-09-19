import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function run() {
  const { error } = await supabase.rpc('execute_sql', {
    sql_query: "ALTER TABLE public.examinations ADD COLUMN IF NOT EXISTS ss_cre_structure TEXT;"
  });
  if (error) {
    console.error('Failed to add column via rpc, trying fallback...', error);
  } else {
    console.log('Successfully added ss_cre_structure to examinations via RPC');
  }
}
run();
