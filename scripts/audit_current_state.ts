import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase service role key or URL');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runAudit() {
  console.log('=== STEP 1: AUDITING SUPABASE POSTGRESQL ===');

  // 1. Teachers
  const { data: teachers, error: tErr } = await supabaseAdmin
    .from('teachers')
    .select('*')
    .order('teacher_name');
  if (tErr) throw tErr;

  console.log(`\nTeachers in public.teachers (${teachers.length}):`);
  teachers.forEach(t => {
    console.log(`  ID: ${t.id} | Name: ${t.teacher_name} | Email: ${t.email} | IsCT: ${t.is_class_teacher} | UserID: ${t.user_id}`);
  });

  // 2. Users
  const { data: users, error: uErr } = await supabaseAdmin
    .from('users')
    .select('*')
    .order('name');
  if (uErr) throw uErr;

  console.log(`\nUsers in public.users (${users.length}):`);
  users.forEach(u => {
    console.log(`  ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role} | TeacherID: ${u.teacher_id}`);
  });

  // 3. Streams & Class Teachers
  const { data: classes } = await supabaseAdmin.from('classes').select('*');
  const classMap = new Map(classes?.map(c => [c.id, c.class_name]));

  const { data: streams, error: sErr } = await supabaseAdmin
    .from('streams')
    .select('*')
    .order('class_id');
  if (sErr) throw sErr;

  console.log(`\nStreams in public.streams (${streams.length}):`);
  streams.forEach(s => {
    const clsName = classMap.get(s.class_id);
    const teacher = teachers.find(t => t.id === s.class_teacher_id);
    console.log(`  ID: ${s.id} | ${clsName} ${s.stream_name} | CT ID: ${s.class_teacher_id} (${teacher ? teacher.teacher_name : 'None'})`);
  });

  // 4. Subjects
  const { data: subjects, error: subErr } = await supabaseAdmin
    .from('subjects')
    .select('*')
    .order('subject_name');
  if (subErr) throw subErr;

  console.log(`\nRelevant Junior School Subjects in public.subjects:`);
  subjects.forEach(s => {
    console.log(`  ID: ${s.id} | Code: ${s.subject_code} | Name: "${s.subject_name}" | Area: "${s.learning_area}"`);
  });

  // 5. Existing teacher_subjects allocations
  const { data: allocations, error: aErr } = await supabaseAdmin
    .from('teacher_subjects')
    .select('*');
  if (aErr) throw aErr;

  console.log(`\nCurrent Allocations in public.teacher_subjects (${allocations.length}):`);
  const subjectMap = new Map(subjects.map(s => [s.id, s.subject_name]));
  const streamNameMap = new Map(streams.map(s => [s.id, `${classMap.get(s.class_id)} ${s.stream_name}`]));
  const teacherNameMap = new Map(teachers.map(t => [t.id, t.teacher_name]));

  allocations.forEach(a => {
    console.log(`  ID: ${a.id} | Teacher: ${teacherNameMap.get(a.teacher_id)} | Subject: ${subjectMap.get(a.subject_id)} | Stream: ${streamNameMap.get(a.stream_id)}`);
  });
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
