import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { error } = await supabase.from('subjects').insert({
    id: '12345678-1234-1234-1234-1234567890ab',
    subject_code: 'SST',
    subject_name: 'Social Studies Upper',
    category: 'Core',
    learning_area: 'Upper Primary'
  });
  console.log('Unique code error?', error);
}
run();
