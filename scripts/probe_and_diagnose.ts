import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Authorised list from user prompt
interface ExpectedAllocation {
  teacherName: string;
  learningArea: string; // Canonical name in public.subjects
  streamName: string; // e.g. "Grade 7 Red"
}

const AUTHORISED_ALLOCATIONS: ExpectedAllocation[] = [
  // Mr Gideon (7)
  { teacherName: 'Mr Gideon', learningArea: 'Pre-Technical Studies', streamName: 'Grade 7 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Pre-Technical Studies', streamName: 'Grade 7 Blue' },
  { teacherName: 'Mr Gideon', learningArea: 'Pre-Technical Studies', streamName: 'Grade 8 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Pre-Technical Studies', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Social Studies', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Social Studies', streamName: 'Grade 7 Red' },
  { teacherName: 'Mr Gideon', learningArea: 'Agriculture', streamName: 'Grade 8 Blue' },

  // Madam Caroline (7)
  { teacherName: 'Madam Caroline', learningArea: 'English', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'English', streamName: 'Grade 9 Red' },
  { teacherName: 'Madam Caroline', learningArea: 'Christian Religious Education', streamName: 'Grade 8 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'Christian Religious Education', streamName: 'Grade 9 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'Christian Religious Education', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'Social Studies', streamName: 'Grade 8 Blue' },
  { teacherName: 'Madam Caroline', learningArea: 'Social Studies', streamName: 'Grade 9 Blue' },

  // Madam Christine (7)
  { teacherName: 'Madam Christine', learningArea: 'Integrated Science', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Christine', learningArea: 'Integrated Science', streamName: 'Grade 8 Blue' },
  { teacherName: 'Madam Christine', learningArea: 'Integrated Science', streamName: 'Grade 8 Red' },
  { teacherName: 'Madam Christine', learningArea: 'Integrated Science', streamName: 'Grade 9 Red' },
  { teacherName: 'Madam Christine', learningArea: 'Agriculture', streamName: 'Grade 7 Red' },
  { teacherName: 'Madam Christine', learningArea: 'Agriculture', streamName: 'Grade 8 Red' },
  { teacherName: 'Madam Christine', learningArea: 'Christian Religious Education', streamName: 'Grade 7 Red' },

  // Mr Brian Ayiecha (7)
  { teacherName: 'BRIAN AYIECHA', learningArea: 'English', streamName: 'Grade 9 Blue' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'English', streamName: 'Grade 8 Blue' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'English', streamName: 'Grade 7 Red' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'Social Studies', streamName: 'Grade 7 Blue' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'Social Studies', streamName: 'Grade 8 Red' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'Christian Religious Education', streamName: 'Grade 8 Red' },
  { teacherName: 'BRIAN AYIECHA', learningArea: 'Creative Arts and Sports', streamName: 'Grade 8 Red' },

  // Mr Maina (5)
  { teacherName: 'Mr Maina', learningArea: 'Integrated Science', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Maina', learningArea: 'Integrated Science', streamName: 'Grade 9 Blue' },
  { teacherName: 'Mr Maina', learningArea: 'Mathematics', streamName: 'Grade 7 Red' },
  { teacherName: 'Mr Maina', learningArea: 'Mathematics', streamName: 'Grade 8 Blue' },
  { teacherName: 'Mr Maina', learningArea: 'Mathematics', streamName: 'Grade 9 Blue' },

  // Madam Vivian (6)
  { teacherName: 'Madam Vivian', learningArea: 'Kiswahili', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Vivian', learningArea: 'Kiswahili', streamName: 'Grade 7 Red' },
  { teacherName: 'Madam Vivian', learningArea: 'Kiswahili', streamName: 'Grade 9 Red' },
  { teacherName: 'Madam Vivian', learningArea: 'Creative Arts and Sports', streamName: 'Grade 7 Red' },
  { teacherName: 'Madam Vivian', learningArea: 'Creative Arts and Sports', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Vivian', learningArea: 'Agriculture', streamName: 'Grade 9 Blue' },

  // Mr Patrick (5)
  { teacherName: 'Mr Patrick', learningArea: 'Mathematics', streamName: 'Grade 7 Blue' },
  { teacherName: 'Mr Patrick', learningArea: 'Mathematics', streamName: 'Grade 8 Red' },
  { teacherName: 'Mr Patrick', learningArea: 'Mathematics', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Patrick', learningArea: 'Pre-Technical Studies', streamName: 'Grade 8 Blue' },
  { teacherName: 'Mr Patrick', learningArea: 'Pre-Technical Studies', streamName: 'Grade 9 Blue' },

  // Madam Grace (2)
  { teacherName: 'Madam Grace', learningArea: 'Creative Arts and Sports', streamName: 'Grade 8 Blue' },
  { teacherName: 'Madam Grace', learningArea: 'English', streamName: 'Grade 8 Red' },

  // Mr Eric (3)
  { teacherName: 'Mr Eric', learningArea: 'Creative Arts and Sports', streamName: 'Grade 9 Blue' },
  { teacherName: 'Mr Eric', learningArea: 'Creative Arts and Sports', streamName: 'Grade 9 Red' },
  { teacherName: 'Mr Eric', learningArea: 'Kiswahili', streamName: 'Grade 8 Red' },

  // Mr Charles (1)
  { teacherName: 'Mr Charles', learningArea: 'Kiswahili', streamName: 'Grade 8 Blue' },

  // Madam Angela (2)
  { teacherName: 'Madam Angela', learningArea: 'Kiswahili', streamName: 'Grade 9 Blue' },
  { teacherName: 'Madam Angela', learningArea: 'Christian Religious Education', streamName: 'Grade 9 Red' },

  // Madam Faith (1)
  { teacherName: 'Madam Faith', learningArea: 'Agriculture', streamName: 'Grade 9 Red' },
];

const AUTHORISED_CLASS_TEACHERS = [
  { teacherName: 'Mr Gideon', streamName: 'Grade 7 Red' },
  { teacherName: 'Madam Caroline', streamName: 'Grade 7 Blue' },
  { teacherName: 'Madam Christine', streamName: 'Grade 8 Red' },
  { teacherName: 'BRIAN AYIECHA', streamName: 'Grade 8 Blue' },
  { teacherName: 'Mr Maina', streamName: 'Grade 9 Blue' },
  { teacherName: 'Madam Vivian', streamName: 'Grade 9 Red' },
];

async function probeAndDiagnose() {
  console.log('=== STEP 2: PROBE & DIAGNOSE ===');

  // Load database lookups
  const { data: teachers } = await supabaseAdmin.from('teachers').select('*');
  const { data: users } = await supabaseAdmin.from('users').select('*');
  const { data: classes } = await supabaseAdmin.from('classes').select('*');
  const { data: streams } = await supabaseAdmin.from('streams').select('*');
  const { data: subjects } = await supabaseAdmin.from('subjects').select('*');
  const { data: allocations } = await supabaseAdmin.from('teacher_subjects').select('*');

  const classMap = new Map(classes?.map(c => [c.id, c.class_name]));
  const streamMap = new Map(streams?.map(s => [s.id, {
    id: s.id,
    class_id: s.class_id,
    className: classMap.get(s.class_id),
    streamName: s.stream_name,
    fullName: `${classMap.get(s.class_id)} ${s.stream_name}`,
    class_teacher_id: s.class_teacher_id
  }]));

  const streamByName = new Map<string, any>();
  streamMap.forEach(s => streamByName.set(s.fullName, s));

  const teacherMap = new Map(teachers?.map(t => [t.id, t]));
  const teacherByName = new Map<string, any>();
  teachers?.forEach(t => {
    teacherByName.set(t.teacher_name.toLowerCase(), t);
  });

  const subjectMap = new Map(subjects?.map(s => [s.id, s]));
  const subjectByName = new Map<string, any>();
  // Match Junior School canonical subjects
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

  // Build key for an allocation: `${teacherName.toLowerCase()}::${learningArea}::${streamFullName}`
  const existingAllocMap = new Map<string, any[]>();
  allocations?.forEach(a => {
    const t = teacherMap.get(a.teacher_id);
    const sub = subjectMap.get(a.subject_id);
    const strm = streamMap.get(a.stream_id);
    const key = `${t?.teacher_name.toLowerCase()}::${sub?.subject_name}::${strm?.fullName}`;
    if (!existingAllocMap.has(key)) existingAllocMap.set(key, []);
    existingAllocMap.get(key)!.push(a);
  });

  console.log(`\nAuthorised count: ${AUTHORISED_ALLOCATIONS.length}`);
  console.log(`Current DB allocations count: ${allocations?.length}`);

  // Reconcile
  const reconciliationTable: any[] = [];
  const foundDbIds = new Set<string>();

  for (const exp of AUTHORISED_ALLOCATIONS) {
    const key = `${exp.teacherName.toLowerCase()}::${exp.learningArea}::${exp.streamName}`;
    const matches = existingAllocMap.get(key);

    if (!matches || matches.length === 0) {
      reconciliationTable.push({
        Teacher: exp.teacherName,
        'Learning Area': exp.learningArea,
        Stream: exp.streamName,
        Expected: 'YES',
        Found: 'NO',
        Status: 'MISSING'
      });
    } else {
      matches.forEach(m => foundDbIds.add(m.id));
      if (matches.length === 1) {
        reconciliationTable.push({
          Teacher: exp.teacherName,
          'Learning Area': exp.learningArea,
          Stream: exp.streamName,
          Expected: 'YES',
          Found: 'YES (1)',
          Status: 'CORRECT'
        });
      } else {
        reconciliationTable.push({
          Teacher: exp.teacherName,
          'Learning Area': exp.learningArea,
          Stream: exp.streamName,
          Expected: 'YES',
          Found: `YES (${matches.length})`,
          Status: 'DUPLICATE'
        });
      }
    }
  }

  // Unauthorised allocations (in DB but not in authorised list)
  const unauthorisedAllocations: any[] = [];
  allocations?.forEach(a => {
    if (!foundDbIds.has(a.id)) {
      const t = teacherMap.get(a.teacher_id);
      const sub = subjectMap.get(a.subject_id);
      const strm = streamMap.get(a.stream_id);
      unauthorisedAllocations.push({
        id: a.id,
        Teacher: t?.teacher_name,
        'Learning Area': sub?.subject_name,
        Stream: strm?.fullName,
        Status: 'UNAUTHORISED / WRONG'
      });
    }
  });

  console.log('\n--- RECONCILIATION TABLE (54 EXPECTED ALLOCATIONS) ---');
  console.table(reconciliationTable);

  const missingCount = reconciliationTable.filter(r => r.Status === 'MISSING').length;
  const correctCount = reconciliationTable.filter(r => r.Status === 'CORRECT').length;
  console.log(`Summary: CORRECT = ${correctCount}, MISSING = ${missingCount}`);

  console.log(`\n--- UNAUTHORISED / WRONG ALLOCATIONS IN DB (${unauthorisedAllocations.length}) ---`);
  console.table(unauthorisedAllocations);

  // Check Class Teachers
  console.log('\n--- CLASS TEACHER DESIGNATIONS AUDIT ---');
  for (const ct of AUTHORISED_CLASS_TEACHERS) {
    const strm = streamByName.get(ct.streamName);
    const teacher = teacherByName.get(ct.teacherName.toLowerCase());
    const assignedTeacher = teacherMap.get(strm?.class_teacher_id);
    const isCorrect = strm?.class_teacher_id === teacher?.id;
    console.log(`Stream: ${ct.streamName} | Expected CT: ${ct.teacherName} | Actual in DB: ${assignedTeacher?.teacher_name} | Match: ${isCorrect ? 'CORRECT' : 'WRONG'}`);
  }

  // Check Teacher Roles in public.users
  console.log('\n--- TEACHER ROLES AUDIT IN public.users ---');
  for (const t of teachers || []) {
    const u = users?.find(user => user.id === t.user_id || user.teacher_id === t.id);
    const isCT = AUTHORISED_CLASS_TEACHERS.some(ct => ct.teacherName.toLowerCase() === t.teacher_name.toLowerCase());
    const expectedRole = isCT ? 'class_teacher' : 'subject_teacher';
    const roleMatch = u?.role === expectedRole;
    console.log(`Teacher: ${t.teacher_name.padEnd(20)} | Expected Role: ${expectedRole.padEnd(16)} | Actual Role in public.users: ${u?.role} | Match: ${roleMatch ? 'CORRECT' : 'WRONG'}`);
  }
}

probeAndDiagnose().catch(e => console.error(e));
