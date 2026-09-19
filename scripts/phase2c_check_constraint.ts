import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: cols } = await supabase.from('subjects').select('subject_code');
  // Just seeing if there are duplicates already
  const codes = cols?.map(c => c.subject_code) || [];
  const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
  console.log('Dupe codes in DB:', dupes);
}
run();
