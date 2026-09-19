import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const compId = 'd5a58359-a4d4-4c92-89dd-4ef9f3d98df6'; // COMP
  
  const { data: compMarks } = await supabase.from('marks').select('*').eq('subject_id', compId).limit(5);
  console.log('Sample COMP Marks:', compMarks);
}
run();
