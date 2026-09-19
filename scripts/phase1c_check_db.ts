import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  let { data: all } = await supabase.from('examinations').select('id, exam_name, ss_cre_structure');
  console.log('All assessments with non-null structures:');
  console.log(all?.filter(a => a.ss_cre_structure !== null));
}
run();
