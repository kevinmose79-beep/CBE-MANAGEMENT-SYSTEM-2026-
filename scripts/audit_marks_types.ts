import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: cols } = await supabase.from('marks').select('*').limit(1);
  if (cols && cols.length > 0) {
    for (const [k, v] of Object.entries(cols[0])) {
      console.log(`${k}: ${typeof v} / ${v}`);
    }
  }
}
run();
