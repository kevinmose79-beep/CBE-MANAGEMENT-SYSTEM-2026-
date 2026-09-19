import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: cols, error } = await supabase.from('subjects').select('*').limit(1);
  console.log('Keys:', cols ? Object.keys(cols[0]) : null);
  console.log('Sample:', cols?.[0]);
}
run();
