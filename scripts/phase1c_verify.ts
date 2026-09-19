import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const targetId = 'b354bcc6-ee20-4ced-a651-ed5aecd91603';
  const openerId = 'e33680c9-e071-493e-9a4a-a49bce6c1742';
  
  // Grade 9
  const g9Opener = '0b7d0d82-2014-4d55-a067-d045b3b289e2';
  const g9Kjsea = 'd510e285-d5b9-4a42-9bd1-94ffbb3587ce';

  console.log('--- Initial State ---');
  let { data: initialTarget } = await supabase.from('examinations').select('id, exam_name, ss_cre_structure').eq('id', targetId).maybeSingle();
  console.log('Target Assessment:', initialTarget);
  
  console.log('\n--- Testing A ---');
  await supabase.from('examinations').update({ ss_cre_structure: 'A' }).eq('id', targetId);
  let { data: stateA } = await supabase.from('examinations').select('id, exam_name, ss_cre_structure').eq('id', targetId).maybeSingle();
  console.log('Target Assessment A:', stateA);

  console.log('\n--- Testing B ---');
  await supabase.from('examinations').update({ ss_cre_structure: 'B' }).eq('id', targetId);
  let { data: stateB } = await supabase.from('examinations').select('id, exam_name, ss_cre_structure').eq('id', targetId).maybeSingle();
  console.log('Target Assessment B:', stateB);

  console.log('\n--- Testing C ---');
  await supabase.from('examinations').update({ ss_cre_structure: 'C' }).eq('id', targetId);
  let { data: stateC } = await supabase.from('examinations').select('id, exam_name, ss_cre_structure').eq('id', targetId).maybeSingle();
  console.log('Target Assessment C:', stateC);

  console.log('\n--- Historical Protection ---');
  let { data: opener } = await supabase.from('examinations').select('id, exam_name, ss_cre_structure').eq('id', openerId).maybeSingle();
  console.log('Grade 6 Opener:', opener);
  
  let { data: g9OpenerData } = await supabase.from('examinations').select('id, exam_name, ss_cre_structure').eq('id', g9Opener).maybeSingle();
  let { data: g9KjseaData } = await supabase.from('examinations').select('id, exam_name, ss_cre_structure').eq('id', g9Kjsea).maybeSingle();
  console.log('Grade 9 Opener:', g9OpenerData);
  console.log('Grade 9 KJSEA:', g9KjseaData);
}
run();
