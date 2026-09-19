import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const engId = '823eba35-ac51-4ac8-be57-fcbeee88151c'; // ENG
  const compId = 'd5a58359-a4d4-4c92-89dd-4ef9f3d98df6'; // COMP
  
  // Find a student who has both marks
  const { data: engMarks } = await supabase.from('marks').select('*').eq('subject_id', engId).limit(50);
  for (let em of engMarks || []) {
     const { data: compMarks } = await supabase.from('marks').select('*').eq('student_id', em.student_id).eq('subject_id', compId);
     if (compMarks && compMarks.length > 0) {
        console.log('--- Found pair! ---');
        console.log('Student ID:', em.student_id);
        console.log('Exam ID:', em.exam_id);
        console.log('ENG Mark:', em);
        console.log('COMP Mark:', compMarks[0]);
        break;
     }
  }
}
run();
