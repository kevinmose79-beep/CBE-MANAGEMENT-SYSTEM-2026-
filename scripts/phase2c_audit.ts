import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  console.log('--- Checking Subjects ---');
  const { data: subs, error: subsErr } = await supabase.from('subjects').select('*').in('id', ['sb_up_sst', 'sb_up_cre', 'f8255683-1d59-46a7-881a-04a25d45d972', 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409', 'e784b5fc-dab9-4105-bb49-fce1d1a84cf7']);
  if (subsErr) console.error('Subs err:', subsErr);
  console.log('Subjects found:', subs);

  console.log('--- Checking Classes ---');
  const { data: classes, error: classesErr } = await supabase.from('classes').select('*').ilike('class_name', 'Grade%');
  if (classesErr) console.error('Classes err:', classesErr);
  console.log('Classes found:', classes?.map(c => c.class_name));
  const grade456 = classes?.filter(c => ['Grade 4', 'Grade 5', 'Grade 6'].includes(c.class_name));
  if (grade456 && grade456.length > 0) {
      console.log('Sample Class 4-6 allocated subjects:', grade456[0].allocated_subject_ids);
      console.log('All IDs for 4-6:', grade456.map(c => c.id));
  }
}
run();
