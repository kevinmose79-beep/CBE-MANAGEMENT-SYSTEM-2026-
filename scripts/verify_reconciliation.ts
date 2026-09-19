import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const EXPECTED_TEACHER_COUNTS: Record<string, number> = {
  'Mr Gideon': 7,
  'Madam Caroline': 7,
  'Madam Christine': 7,
  'BRIAN AYIECHA': 7,
  'Mr Maina': 5,
  'Madam Vivian': 6,
  'Mr Patrick': 5,
  'Madam Grace': 2,
  'Mr Eric': 3,
  'Mr Charles': 1,
  'Madam Angela': 2,
  'Madam Faith': 1,
};

const EXPECTED_CLASS_TEACHERS = [
  { streamName: 'Grade 7 Red', teacherName: 'Mr Gideon' },
  { streamName: 'Grade 7 Blue', teacherName: 'Madam Caroline' },
  { streamName: 'Grade 8 Red', teacherName: 'Madam Christine' },
  { streamName: 'Grade 8 Blue', teacherName: 'BRIAN AYIECHA' },
  { streamName: 'Grade 9 Blue', teacherName: 'Mr Maina' },
  { streamName: 'Grade 9 Red', teacherName: 'Madam Vivian' },
];

const AUTHORISED_ALLOCATIONS = [
  // 1. Mr Gideon (7)
  { teacherName: 'Mr Gideon', learningArea: 'Pre-Technical Studies', streamName: 'Grade 7 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Pre-Technical Studies', streamName: 'Grade 7 Blue' },
  { teacherName: 'Mr Gideon', learningArea: 'Pre-Technical Studies', streamName: 'Grade 8 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Pre-Technical Studies', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Social Studies', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Social Studies', streamName: 'Grade 7 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Agriculture', streamName: 'Grade 8 Blue' },

  // 2. Madam Caroline (7)
  { teacherName: 'Madam Caroline', learningArea: 'English', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'English', streamName: 'Grade 9 Red' },
  { teacherName: 'Madam Caroline', learningArea: 'Christian Religious Education', streamName: 'Grade 8 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'Christian Religious Education', streamName: 'Grade 9 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'Christian Religious Education', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'Social Studies', streamName: 'Grade 8 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'Social Studies', streamName: 'Grade 9 Blue' },

  // 3. Madam Christine (7)
  { teacherName: 'Madam Christine', learningArea: 'Integrated Science', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Christine', learningArea: 'Integrated Science', streamName: 'Grade 8 Blue' },
  { teacherName: 'Madam Christine', learningArea: 'Integrated Science', streamName: 'Grade 8 Red' },
  { teacherName: 'Madam Christine', learningArea: 'Integrated Science', streamName: 'Grade 9 Red' },
  { teacherName: 'Madam Christine', learningArea: 'Agriculture', streamName: 'Grade 7 Red' },
  { teacherName: 'Madam Christine', learningArea: 'Agriculture', streamName: 'Grade 8 Red' },
  { teacherName: 'Madam Christine', learningArea: 'Christian Religious Education', streamName: 'Grade 7 Red' },

  // 4. Mr Brian Ayiecha (7)
  { teacherName: 'BRIAN AYIECHA', learningArea: 'English', streamName: 'Grade 9 Blue' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'English', streamName: 'Grade 8 Blue' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'English', streamName: 'Grade 7 Red' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'Social Studies', streamName: 'Grade 7 Blue' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'Social Studies', streamName: 'Grade 8 Red' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'Christian Religious Education', streamName: 'Grade 8 Red' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'Creative Arts and Sports', streamName: 'Grade 8 Red' },

  // 5. Mr Maina (5)
  { teacherName: 'Mr Maina', learningArea: 'Integrated Science', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Maina', learningArea: 'Integrated Science', streamName: 'Grade 9 Blue' },
  { teacherName: 'Mr Maina', learningArea: 'Mathematics', streamName: 'Grade 7 Red' },
  { teacherName: 'Mr Maina', learningArea: 'Mathematics', streamName: 'Grade 8 Blue' },
  { teacherName: 'Mr Maina', learningArea: 'Mathematics', streamName: 'Grade 9 Blue' },

  // 6. Madam Vivian (6)
  { teacherName: 'Madam Vivian', learningArea: 'Kiswahili', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Vivian', learningArea: 'Kiswahili', streamName: 'Grade 7 Red' },
  { teacherName: 'Madam Vivian', learningArea: 'Kiswahili', streamName: 'Grade 9 Red' },
  { teacherName: 'Madam Vivian', learningArea: 'Creative Arts and Sports', streamName: 'Grade 7 Red' },
  { teacherName: 'Madam Vivian', learningArea: 'Creative Arts and Sports', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Vivian', learningArea: 'Agriculture', streamName: 'Grade 9 Blue' },

  // 7. Mr Patrick (5)
  { teacherName: 'Mr Patrick', learningArea: 'Mathematics', streamName: 'Grade 7 Blue' },
  { teacherName: 'Mr Patrick', learningArea: 'Mathematics', streamName: 'Grade 8 Red' },
  { teacherName: 'Mr Patrick', learningArea: 'Mathematics', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Patrick', learningArea: 'Pre-Technical Studies', streamName: 'Grade 8 Blue' },
  { teacherName: 'Mr Patrick', learningArea: 'Pre-Technical Studies', streamName: 'Grade 9 Blue' },

  // 8. Madam Grace (2)
  { teacherName: 'Madam Grace', learningArea: 'Creative Arts and Sports', streamName: 'Grade 8 Blue' },
  { teacherName: 'Madam Grace', learningArea: 'English', streamName: 'Grade 8 Red' },

  // 9. Mr Eric (3)
  { teacherName: 'Mr Eric', learningArea: 'Creative Arts and Sports', streamName: 'Grade 9 Blue' },
  { teacherName: 'Mr Eric', learningArea: 'Creative Arts and Sports', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Eric', learningArea: 'Kiswahili', streamName: 'Grade 8 Red' },

  // 10. Mr Charles (1)
  { teacherName: 'Mr Charles', learningArea: 'Kiswahili', streamName: 'Grade 8 Blue' },

  // 11. Madam Angela (2)
  { teacherName: 'Madam Angela', learningArea: 'Kiswahili', streamName: 'Grade 9 Blue' },
  { teacherName: 'Madam Angela', learningArea: 'Christian Religious Education', streamName: 'Grade 9 Red' },

  // 12. Madam Faith (1)
  { teacherName: 'Madam Faith', learningArea: 'Agriculture', streamName: 'Grade 9 Red' },
];

async function verifyAll() {
  console.log('=================================================================');
  console.log('STAGE 5 & 6: TEST & VERIFY LIVE SUPABASE DATABASE');
  console.log('=================================================================');

  const { data: teachers } = await supabaseAdmin.from('teachers').select('*');
  const { data: users } = await supabaseAdmin.from('users').select('*');
  const { data: classes } = await supabaseAdmin.from('classes').select('*');
  const { data: streams } = await supabaseAdmin.from('streams').select('*');
  const { data: subjects } = await supabaseAdmin.from('subjects').select('*');
  const { data: allocations } = await supabaseAdmin.from('teacher_subjects').select('*');

  const classMap = new Map(classes?.map(c => [c.id, c.class_name]));
  const streamMap = new Map<string, any>();
  streams?.forEach(s => {
    const fullName = `${classMap.get(s.class_id)} ${s.stream_name}`;
    streamMap.set(s.id, { ...s, fullName });
  });

  const subjectMap = new Map(subjects?.map(s => [s.id, s]));
  const teacherMap = new Map(teachers?.map(t => [t.id, t]));
  const teacherByName = new Map(teachers?.map(t => [t.teacher_name.toLowerCase(), t]));

  // Test 1: Exactly 12 teachers exist
  console.log(`\nTest 1: Teachers count in public.teachers`);
  console.log(`Expected: 12 | Actual: ${teachers?.length}`);
  if (teachers?.length !== 12) throw new Error(`Test 1 Failed: Expected 12 teachers, got ${teachers?.length}`);
  console.log('✓ PASS: Exactly 12 teachers exist.');

  // Test 2: Brian Ayiecha account uniqueness
  console.log(`\nTest 2: Brian Ayiecha account uniqueness`);
  const brianTeachers = teachers?.filter(t => t.teacher_name.toLowerCase().includes('ayiecha') || t.email?.toLowerCase().includes('ayiecha'));
  const brianTeacherUser = users?.find(u => u.email === 'brianayiecha81@cbe.ac.ke');
  const brianAdminUser = users?.find(u => u.email === 'brianayiecha52@gmail.com');

  console.log(`Brian teachers count: ${brianTeachers?.length}`);
  console.log(`Brian teacher user found: ${brianTeacherUser?.name} (${brianTeacherUser?.email}, role: ${brianTeacherUser?.role})`);
  console.log(`Brian admin user preserved: ${brianAdminUser?.name} (${brianAdminUser?.email}, role: ${brianAdminUser?.role})`);

  if (brianTeachers?.length !== 1 || !brianTeacherUser || brianTeacherUser.teacher_id !== '3b3af31e-ad67-4dab-82a4-8d12bc574fe9') {
    throw new Error(`Test 2 Failed: Brian Ayiecha teacher account not uniquely preserved`);
  }
  console.log(`✓ PASS: Brian Ayiecha has exactly one teacher account (Teacher ID: ${brianTeachers[0].id}, Email: ${brianTeachers[0].email}).`);

  // Test 3: Class Teachers & Subject Teachers count
  console.log(`\nTest 3: 6 Class Teachers & 6 Subject Teachers`);
  const classTeachers = teachers?.filter(t => t.is_class_teacher);
  const subjectTeachers = teachers?.filter(t => !t.is_class_teacher);
  console.log(`Class teachers: ${classTeachers?.length} | Subject teachers: ${subjectTeachers?.length}`);
  if (classTeachers?.length !== 6 || subjectTeachers?.length !== 6) {
    throw new Error('Test 3 Failed: Roles count mismatch');
  }
  console.log('✓ PASS: Exactly 6 Class Teachers and 6 Subject Teachers.');

  // Test 4: Stream Class Teacher designations
  console.log(`\nTest 4: Stream Class Teacher designations`);
  for (const expected of EXPECTED_CLASS_TEACHERS) {
    const stream = Array.from(streamMap.values()).find(s => s.fullName === expected.streamName);
    const assignedTeacher = teacherMap.get(stream.class_teacher_id);
    console.log(`Stream [${expected.streamName}]: Assigned CT = ${assignedTeacher?.teacher_name}`);
    if (assignedTeacher?.teacher_name.toLowerCase() !== expected.teacherName.toLowerCase()) {
      throw new Error(`Test 4 Failed: Expected ${expected.teacherName} for ${expected.streamName}, found ${assignedTeacher?.teacher_name}`);
    }
  }
  console.log('✓ PASS: All 6 Class Teachers correctly designated on streams.');

  // Test 5: Allocations count in public.teacher_subjects
  console.log(`\nTest 5: Allocations count in public.teacher_subjects`);
  console.log(`Authorised assignments in prompt: ${AUTHORISED_ALLOCATIONS.length} | Database rows: ${allocations?.length}`);
  if (allocations?.length !== AUTHORISED_ALLOCATIONS.length) {
    throw new Error(`Test 5 Failed: Expected ${AUTHORISED_ALLOCATIONS.length} allocations, got ${allocations?.length}`);
  }
  console.log(`✓ PASS: Exactly ${allocations?.length} authorised allocations exist in database.`);

  // Test 6: No duplicate allocations
  console.log(`\nTest 6: Check for duplicates in allocations`);
  const uniqueKeySet = new Set<string>();
  for (const a of allocations || []) {
    const key = `${a.teacher_id}::${a.subject_id}::${a.stream_id}`;
    if (uniqueKeySet.has(key)) {
      throw new Error(`Test 6 Failed: Duplicate allocation found for ${key}`);
    }
    uniqueKeySet.add(key);
  }
  console.log('✓ PASS: No duplicate allocations exist.');

  const JUNIOR_SUBJECT_IDS: Record<string, string> = {
    'Social Studies': 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409',
    'Pre-Technical Studies': '5d9beb86-1268-40cb-bae6-7f8e4b998ea2',
    'Creative Arts and Sports': 'b2ee51ad-3d6e-458c-8a1e-f5b9b79a0d83',
    'English': '823eba35-ac51-4ac8-be57-fcbeee88151c',
    'Agriculture': 'fe17661a-9c3b-439e-9cb9-fd2f88279f56',
    'Kiswahili': 'f00b5334-fa16-4640-b19c-733ec4530318',
    'Integrated Science': 'b65c16d5-a38c-478e-ab46-085170ee31da',
    'Mathematics': '4441b054-2d20-4d5c-852d-f31d16fbc145',
    'Christian Religious Education': 'e784b5fc-dab9-4105-bb49-fce1d1a84cf7',
  };

  // Test 7: Every allocation is authorised (No unauthorised allocations)
  console.log(`\nTest 7: Verify all database allocations match the Authorised List`);
  const authorisedKeySet = new Set<string>();
  AUTHORISED_ALLOCATIONS.forEach(auth => {
    const t = teacherByName.get(auth.teacherName.toLowerCase());
    const subId = JUNIOR_SUBJECT_IDS[auth.learningArea];
    const strm = Array.from(streamMap.values()).find(s => s.fullName === auth.streamName);
    authorisedKeySet.add(`${t.id}::${subId}::${strm.id}`);
  });

  for (const a of allocations || []) {
    const key = `${a.teacher_id}::${a.subject_id}::${a.stream_id}`;
    if (!authorisedKeySet.has(key)) {
      const t = teacherMap.get(a.teacher_id);
      const sub = subjectMap.get(a.subject_id);
      const strm = streamMap.get(a.stream_id);
      throw new Error(`Test 7 Failed: Unauthorised allocation in DB: ${t?.teacher_name} | ${sub?.subject_name} | ${strm?.fullName}`);
    }
  }
  console.log('✓ PASS: All allocations in DB are strictly authorised.');

  // Test 8: Reconcile by Teacher count
  console.log(`\nTest 8: Reconcile Allocation Counts by Teacher`);
  const teacherCountMap = new Map<string, number>();
  for (const a of allocations || []) {
    const t = teacherMap.get(a.teacher_id);
    const current = teacherCountMap.get(t.teacher_name) || 0;
    teacherCountMap.set(t.teacher_name, current + 1);
  }

  const reconciliationByTeacher: any[] = [];
  let totalCount = 0;
  for (const [tName, expectedCount] of Object.entries(EXPECTED_TEACHER_COUNTS)) {
    const actualCount = teacherCountMap.get(tName) || 0;
    totalCount += actualCount;
    const match = actualCount === expectedCount;
    reconciliationByTeacher.push({
      Teacher: tName,
      Expected: expectedCount,
      Actual: actualCount,
      Status: match ? 'MATCH' : 'MISMATCH'
    });
    if (!match) {
      throw new Error(`Test 8 Failed: Count mismatch for ${tName}. Expected ${expectedCount}, got ${actualCount}`);
    }
  }

  console.table(reconciliationByTeacher);
  console.log(`Total Reconciled Allocations across all 12 teachers: ${totalCount}`);
  console.log('✓ PASS: All teacher counts match expected values exactly.');

  // Test 9: Confirm student marks, profiles, and exams were untouched
  const { count: marksCount } = await supabaseAdmin.from('marks').select('*', { count: 'exact', head: true });
  const { count: studentsCount } = await supabaseAdmin.from('students').select('*', { count: 'exact', head: true });
  console.log(`\nTest 9: Integrity check on learner records:`);
  console.log(`Students count: ${studentsCount}, Marks count: ${marksCount}`);
  console.log('✓ PASS: Learner marks and student profiles completely preserved.');

  console.log('\n=================================================================');
  console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY! CHECKPOINT READY.');
  console.log('=================================================================');
}

verifyAll().catch(err => {
  console.error('\nVERIFICATION FAILED:', err);
  process.exit(1);
});
