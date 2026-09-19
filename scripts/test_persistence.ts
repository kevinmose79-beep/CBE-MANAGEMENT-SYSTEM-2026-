import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const testExamId = 'e33680c9-e071-493e-9a4a-a49bce6c1742'; // Grade 6 Opener Assessment Term 3 2026 - untouched
  const targetExamId = 'b354bcc6-ee20-4ced-a651-ed5aecd91603'; // GRADE 6 KPSEA SECOND TRIAL TERM 3 2026

  // 1. Initial State
  let { data: initialData } = await supabase.from('examinations').select('exam_name, ss_cre_structure').eq('id', targetExamId).maybeSingle();
  console.log('Initial target state:', initialData);

  // 2. Set Structure A
  await supabase.from('examinations').update({ ss_cre_structure: 'A' }).eq('id', targetExamId);
  let { data: stateA } = await supabase.from('examinations').select('exam_name, ss_cre_structure').eq('id', targetExamId).maybeSingle();
  console.log('State after setting A:', stateA);

  // 3. Set Structure C
  await supabase.from('examinations').update({ ss_cre_structure: 'C' }).eq('id', targetExamId);
  let { data: stateC } = await supabase.from('examinations').select('exam_name, ss_cre_structure').eq('id', targetExamId).maybeSingle();
  console.log('State after setting C:', stateC);

  // 4. Verify historical assessment is untouched
  let { data: openerData } = await supabase.from('examinations').select('exam_name, ss_cre_structure').eq('id', testExamId).maybeSingle();
  console.log('Grade 6 Opener state:', openerData);
}
run();
