import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  console.log('--- 1. Live marks schema & uniqueness ---');
  // We already know the schema from phase 2a.
  // Check index or constraint via simple duplicate upsert attempt? Wait, read-only. We can't insert.
  
  console.log('--- 3. Real English + Comp Marks ---');
  // Find subjects for English, Comp
  const { data: engSubs } = await supabase.from('subjects').select('*').in('subject_code', ['ENG', 'COMP', 'ENG UP']);
  console.log('English Subs:', engSubs);
  
  const engIds = engSubs?.map(s => s.id) || [];
  
  // Find marks
  if (engIds.length > 0) {
    const { data: engMarks } = await supabase.from('marks').select('*').in('subject_id', engIds).limit(5);
    console.log('Sample English/Comp marks:', engMarks);
  }
  
  console.log('--- 8. Teacher Allocations for Eng/Comp ---');
  if (engIds.length > 0) {
    const { data: tchAlloc } = await supabase.from('teacher_allocations').select('*').in('subject_id', engIds).limit(3);
    console.log('Sample Teacher Allocations for Eng/Comp:', tchAlloc);
    // fallback check in teacher_subjects
    const { data: tsAlloc } = await supabase.from('teacher_subjects').select('*').in('subject_id', engIds).limit(3);
    console.log('Sample Teacher Subjects for Eng/Comp:', tsAlloc);
  }
}
run();
