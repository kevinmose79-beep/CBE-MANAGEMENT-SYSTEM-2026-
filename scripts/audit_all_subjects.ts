import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: subs } = await supabase.from('subjects').select('*');
  console.log('All subjects code / name / learning_area:');
  for (let s of subs || []) {
     if (s.subject_code?.includes('SST') || s.subject_code?.includes('CRE') || s.subject_name?.includes('Social') || s.subject_name?.includes('Christian')) {
        console.dir(s, {depth:null});
     }
  }
}
run();
