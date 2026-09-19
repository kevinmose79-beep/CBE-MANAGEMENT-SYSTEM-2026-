import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const targetExamId = 'b354bcc6-ee20-4ced-a651-ed5aecd91603'; // GRADE 6 KPSEA SECOND TRIAL TERM 3 2026

  await supabase.from('examinations').update({ ss_cre_structure: null }).eq('id', targetExamId);
  console.log('Reset test target to null');
}
run();
