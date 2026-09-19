import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: subs } = await supabase.from('subjects').select('*').in('subject_name', ['Social Studies', 'Christian Religious Education', 'Social Studies&CRE']);
  console.log('Relevant live subjects:');
  console.dir(subs, {depth: null});
}
run();
