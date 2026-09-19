import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

async function checkAllMarksSubjects() {
  const { data: marks } = await supabaseAdmin.from('marks').select('subject_id');
  const distinctSubjectIds = Array.from(new Set(marks?.map(m => m.subject_id) || []));
  console.log('Unique subject IDs in marks:', distinctSubjectIds.length);

  const { data: subs } = await supabaseAdmin
    .from('subjects')
    .select('id, subject_name, subject_code, learning_area')
    .in('id', distinctSubjectIds);

  console.log('Subjects with marks in DB:');
  console.table(subs);
}

checkAllMarksSubjects();
