import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('examinations').select('ss_cre_structure').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success, ss_cre_structure exists', data);
  }
}
run();
