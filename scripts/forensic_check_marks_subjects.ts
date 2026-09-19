import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

async function checkJuniorSchoolMarks() {
  const { data: marks } = await supabaseAdmin
    .from('marks')
    .select('id, student_id, subject_id, exam_id, score, students(class_id, stream_id, classes(class_name)), subjects(id, subject_name, subject_code, learning_area)');

  console.log('Total marks records in DB:', marks?.length);

  const subjectUsage = new Map<string, { name: string, code: string, learning_area: string, count: number, classes: Set<string> }>();

  marks?.forEach((m: any) => {
    const sub = m.subjects;
    if (!sub) return;
    const clsName = m.students?.classes?.class_name || 'Unknown';
    if (!subjectUsage.has(sub.id)) {
      subjectUsage.set(sub.id, {
        name: sub.subject_name,
        code: sub.subject_code,
        learning_area: sub.learning_area,
        count: 0,
        classes: new Set()
      });
    }
    const entry = subjectUsage.get(sub.id)!;
    entry.count++;
    entry.classes.add(clsName);
  });

  console.log('\nSubjects used in marks by class:');
  for (const [id, info] of subjectUsage.entries()) {
    console.log(`- ${info.name} [${info.code}] (${info.learning_area}) -> id: ${id}, marksCount: ${info.count}, classes: ${Array.from(info.classes).join(', ')}`);
  }
}

checkJuniorSchoolMarks();
