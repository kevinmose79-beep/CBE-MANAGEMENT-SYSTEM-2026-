import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: allocations } = await supabase.from('teacher_allocations').select('*');
  console.log('Allocations related to SST/CRE/SS&CRE:');
  for (let a of allocations || []) {
    if (a.subject_id === 'sb_up_sst' || a.subject_id === 'sb_up_cre' || a.subject_id === 'f8255683-1d59-46a7-881a-04a25d45d972') {
      console.dir(a);
    }
  }
}
run();
