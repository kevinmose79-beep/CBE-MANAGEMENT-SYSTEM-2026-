import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log('=================================================================');
  console.log('PHASE 1: LIVE DATABASE AUDIT FOR JUNIOR SCHOOL TEACHERS');
  console.log('=================================================================');

  // 1. Inspect existing teachers in public.teachers
  const { data: allTeachers, error: tErr } = await supabaseAdmin
    .from('teachers')
    .select('*');
  console.log('\n--- 1. PUBLIC.TEACHERS (Count:', allTeachers?.length || 0, ') ---');
  if (tErr) console.error('Error fetching teachers:', tErr);
  else console.log(JSON.stringify(allTeachers, null, 2));

  // 2. Inspect existing users in public.users
  const { data: allUsers, error: uErr } = await supabaseAdmin
    .from('users')
    .select('*');
  console.log('\n--- 2. PUBLIC.USERS (Count:', allUsers?.length || 0, ') ---');
  if (uErr) console.error('Error fetching users:', uErr);
  else console.log(JSON.stringify(allUsers, null, 2));

  // 3. Inspect auth.users
  const { data: authData, error: aErr } = await supabaseAdmin.auth.admin.listUsers();
  console.log('\n--- 3. AUTH.USERS (Count:', authData?.users?.length || 0, ') ---');
  if (aErr) console.error('Error fetching auth users:', aErr);
  else {
    console.log(authData.users.map(u => ({
      id: u.id,
      email: u.email,
      user_metadata: u.user_metadata,
      created_at: u.created_at
    })));
  }

  // 4. Inspect Classes for Junior School (Grade 7, Grade 8, Grade 9)
  const { data: classes, error: cErr } = await supabaseAdmin
    .from('classes')
    .select('*')
    .order('name');
  console.log('\n--- 4. PUBLIC.CLASSES (Count:', classes?.length || 0, ') ---');
  if (cErr) console.error('Error fetching classes:', cErr);
  else console.log(JSON.stringify(classes, null, 2));

  // 5. Inspect Streams for Grade 7, Grade 8, Grade 9
  const { data: streams, error: sErr } = await supabaseAdmin
    .from('streams')
    .select('*, classes(name, education_level)')
    .order('class_id');
  console.log('\n--- 5. PUBLIC.STREAMS (Count:', streams?.length || 0, ') ---');
  if (sErr) console.error('Error fetching streams:', sErr);
  else console.log(JSON.stringify(streams, null, 2));

  // 6. Inspect Learning Areas / Subjects
  const { data: subjects, error: subErr } = await supabaseAdmin
    .from('subjects')
    .select('*')
    .order('name');
  console.log('\n--- 6. PUBLIC.SUBJECTS (Count:', subjects?.length || 0, ') ---');
  if (subErr) console.error('Error fetching subjects:', subErr);
  else console.log(JSON.stringify(subjects, null, 2));

  // 7. Inspect existing teacher_subjects allocations
  const { data: teacherSubjects, error: tsErr } = await supabaseAdmin
    .from('teacher_subjects')
    .select('*, teachers(teacher_name), subjects(name), classes(name), streams(stream_name)');
  console.log('\n--- 7. PUBLIC.TEACHER_SUBJECTS (Count:', teacherSubjects?.length || 0, ') ---');
  if (tsErr) console.error('Error fetching teacher_subjects:', tsErr);
  else console.log(JSON.stringify(teacherSubjects, null, 2));

  // 8. Specific Search for Brian Ayiecha and candidate names
  const candidateNames = [
    'Brian', 'Ayiecha', 'Gideon', 'Caroline', 'Christine', 'Maina',
    'Vivian', 'Patrick', 'Grace', 'Eric', 'Charles', 'Angela', 'Faith'
  ];
  console.log('\n--- 8. SPECIFIC TEACHER SEARCH FOR 12 TEACHERS ---');
  for (const name of candidateNames) {
    const matchedT = (allTeachers || []).filter(t => 
      (t.teacher_name && t.teacher_name.toLowerCase().includes(name.toLowerCase())) ||
      (t.email && t.email.toLowerCase().includes(name.toLowerCase()))
    );
    const matchedU = (allUsers || []).filter(u =>
      (u.name && u.name.toLowerCase().includes(name.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(name.toLowerCase()))
    );
    console.log(`Search [${name}]:`, {
      teachers: matchedT.map(t => ({ id: t.id, name: t.teacher_name, email: t.email, is_class_teacher: t.is_class_teacher, user_id: t.user_id })),
      users: matchedU.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, teacher_id: u.teacher_id }))
    });
  }

  console.log('=================================================================');
  console.log('AUDIT QUERY COMPLETE');
  console.log('=================================================================');
}

runAudit();
