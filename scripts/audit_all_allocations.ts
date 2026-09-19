import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: allocations } = await supabase.from('teacher_allocations').select('*');
  console.log(`Total allocations: ${allocations?.length}`);
  
  if (allocations) {
    const sst = allocations.filter(a => a.subject_id?.includes('sst') || a.subject_id?.includes('cre') || a.subject_id?.includes('SST') || a.subject_id?.includes('CRE'));
    console.log('Any allocation matching sst or cre string:', sst);
  }
}
run();
