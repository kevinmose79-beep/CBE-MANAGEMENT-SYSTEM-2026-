import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('teacher_subjects').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('teacher_subjects works');
  }
}
run();
