import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('examinations').select('id, exam_name, ss_cre_structure');
  if (error) {
    console.error('Error fetching examinations:', error);
  } else {
    console.log(`Successfully fetched ${data.length} examinations.`);
    console.log('Sample:', data.slice(0, 3));
    const openers = data.filter(d => d.exam_name.includes('Opener'));
    console.log('Openers:', openers);
  }
}
run();
