import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: cols } = await supabase.from('marks').select('*').limit(1);
  
  // We can query pg_indexes or pg_constraint using raw sql via REST if possible, but let's just attempt a double insert and see what error it throws.
  const dummyMark = {
    id: 'test-id-1234',
    student_id: 'dummy',
    subject_id: 'dummy',
    exam_id: 'dummy',
    marks: 10
  };
  
  // Actually, we don't want to insert. Read-only rule.
  console.log('Read-only rule blocks dummy insert.');
}
run();
