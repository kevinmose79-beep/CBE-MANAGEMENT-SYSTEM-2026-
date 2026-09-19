import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

async function runDetailedAudit() {
  console.log('=== FORENSIC PROBE: JUNIOR SCHOOL CLASSES & STREAMS ===');
  const { data: juniorClasses } = await supabaseAdmin
    .from('classes')
    .select('id, class_name, grade_level')
    .in('class_name', ['Grade 7', 'Grade 8', 'Grade 9'])
    .order('grade_level');
  console.log('Junior Classes:', juniorClasses);

  const classIds = juniorClasses?.map(c => c.id) || [];
  const { data: juniorStreams } = await supabaseAdmin
    .from('streams')
    .select('id, class_id, stream_name, class_teacher_id')
    .in('class_id', classIds);
  console.log('Junior Streams:', juniorStreams);

  console.log('\n=== FORENSIC PROBE: ALL SUBJECTS / LEARNING AREAS ===');
  const { data: allSubjects } = await supabaseAdmin
    .from('subjects')
    .select('id, subject_name, subject_code, category, learning_area')
    .order('subject_name');
  console.log('All Subjects:', allSubjects);

  console.log('\n=== FORENSIC PROBE: CURRENT TEACHERS & ALLOCATIONS ===');
  const { data: teachers } = await supabaseAdmin
    .from('teachers')
    .select('*');
  console.log('Teachers:', teachers);

  const { data: ts } = await supabaseAdmin
    .from('teacher_subjects')
    .select('id, teacher_id, subject_id, class_id, stream_id');
  console.log('Teacher Subjects allocations count:', ts?.length);
  console.log('Allocations:', ts);

  console.log('\n=== FORENSIC PROBE: MR BRIAN AYIECHA FULL PROFILE ===');
  const brianT = teachers?.find(t => t.email === 'brianayiecha81@cbe.ac.ke' || t.teacher_name.includes('BRIAN'));
  console.log('Brian Teacher Record:', brianT);

  const { data: brianUsers } = await supabaseAdmin
    .from('users')
    .select('*')
    .or(`email.ilike.%brian%,name.ilike.%brian%`);
  console.log('Brian Users Records:', brianUsers);

  const { data: brianAllocs } = await supabaseAdmin
    .from('teacher_subjects')
    .select('*, subjects(subject_name), classes(class_name), streams(stream_name)')
    .eq('teacher_id', brianT?.id);
  console.log('Brian Existing Allocations:', brianAllocs);
}

runDetailedAudit();
