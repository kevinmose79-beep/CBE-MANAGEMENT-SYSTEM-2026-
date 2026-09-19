import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { error } = await supabase.rpc('execute_sql', { sql_statement: 'ALTER TABLE subjects DROP CONSTRAINT subjects_subject_code_key;' }).catch(() => ({error: 'no rpc'}));
  console.log('Drop constraint error:', error);
}
run();
