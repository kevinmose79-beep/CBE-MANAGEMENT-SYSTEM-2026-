import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

async function printMappings() {
  const { data: classes } = await supabaseAdmin
    .from('classes')
    .select('id, class_name, grade_level')
    .in('class_name', ['Grade 7', 'Grade 8', 'Grade 9'])
    .order('grade_level');

  console.log('--- CLASSES ---');
  console.table(classes);

  const { data: streams } = await supabaseAdmin
    .from('streams')
    .select('id, class_id, stream_name, class_teacher_id')
    .in('class_id', classes!.map(c => c.id));

  console.log('--- STREAMS ---');
  const streamMap = streams!.map(s => {
    const cls = classes!.find(c => c.id === s.class_id);
    return {
      stream_id: s.id,
      class_id: s.class_id,
      class_name: cls?.class_name,
      stream_name: s.stream_name,
      class_teacher_id: s.class_teacher_id,
      full_label: `${cls?.class_name} ${s.stream_name}`
    };
  });
  console.table(streamMap);

  console.log('--- JUNIOR SCHOOL SUBJECTS ---');
  const jsSubjectNames = [
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

  const { data: subs } = await supabaseAdmin
    .from('subjects')
    .select('id, subject_name, subject_code, category, learning_area')
    .in('subject_name', jsSubjectNames);

  console.table(subs);
}

printMappings();
