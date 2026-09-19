import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

async function checkExamSubjects() {
  console.log('--- CHECKING MARKS & EXAMINATION SUBJECTS FOR JUNIOR SCHOOL ---');

  // Check examination_subjects or marks for Junior School
  const { data: marksSample } = await supabaseAdmin
    .from('marks')
    .select('subject_id, subjects(subject_name, subject_code, learning_area)')
    .limit(50);

  const distinctSubjectIds = new Map();
  marksSample?.forEach(m => {
    if (m.subject_id && !distinctSubjectIds.has(m.subject_id)) {
      distinctSubjectIds.set(m.subject_id, m.subjects);
    }
  });

  console.log('Distinct subjects in marks:');
  console.log(Array.from(distinctSubjectIds.entries()));

  // Let's also check all 9 junior school subject IDs:
  const targetSubjects = [
    'English',
    'Kiswahili',
    'Mathematics',
    'Integrated Science',
    'Creative Arts and Sports',
    'Agriculture',
    'Pre-Technical Studies',
    'Christian Religious Education',
    'Social Studies'
  ];

  const { data: allSubjects } = await supabaseAdmin
    .from('subjects')
    .select('*')
    .in('subject_name', targetSubjects);

  console.log('\nAll candidate subjects:');
  allSubjects?.forEach(s => {
    console.log(`id: ${s.id} | code: ${s.subject_code} | name: ${s.subject_name} | learning_area: ${s.learning_area}`);
  });
}

checkExamSubjects();
