import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: cols } = await supabase.from('marks').select('*').limit(1);
  console.log('Marks row keys:', Object.keys(cols?.[0] || {}));
  
  // Also get subjects
  const { data: subs } = await supabase.from('subjects').select('*').in('subject_code', ['SS&CRE', 'SST', 'CRE', 'SST_UP', 'CRE_UP']);
  console.log('\nSubjects:');
  console.dir(subs, {depth: null});
  
  const { data: subs2 } = await supabase.from('subjects').select('*').in('id', ['f8255683-1d59-46a7-881a-04a25d45d972', '8cfcf4bb-8f7b-449b-b0b2-29fc2a05cf61', '6c61f237-db2e-4b72-b88d-71bcebba4103', 'b07908c6-5fae-4bc8-acc8-a89279549ea7', '76b8915f-f6bb-49fc-9eec-8c10be14efbc']);
  console.log('\nSubjects by specific IDs known from previous phases:');
  console.dir(subs2, {depth: null});
}
run();
