import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const dummyMark = {
    id: 'test-id-1234',
    student_id: '123e4567-e89b-12d3-a456-426614174000',
    subject_id: 'sb_up_sst', // Does not exist
    exam_id: 'b354bcc6-ee20-4ced-a651-ed5aecd91603',
    marks: 10
  };
  
  // Let's just try to query subjects by ID again to be absolutely sure.
  const { data: subs } = await supabase.from('subjects').select('*').in('id', ['sb_up_sst', 'sb_up_cre']);
  console.log('Subjects with those literal string IDs:', subs);
}
run();
