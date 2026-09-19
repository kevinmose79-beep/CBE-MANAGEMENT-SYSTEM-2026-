import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runForensicAudit() {
  console.log('=============================================================');
  console.log('STAGE 1: AUDIT LIVE public.teacher_subjects TABLE');
  console.log('=============================================================');

  const { data: rows, error: allocError } = await supabase
    .from('teacher_subjects')
    .select(`
      id,
      teacher_id,
      teachers (
        teacher_name,
        email,
        is_class_teacher
      ),
      subject_id,
      subjects (
        subject_name,
        subject_code
      ),
      class_id,
      classes (
        class_name
      ),
      stream_id,
      streams (
        stream_name
      )
    `)
    .order('created_at', { ascending: true });

  if (allocError) {
    console.error('Error querying teacher_subjects:', allocError);
    process.exit(1);
  }

  console.log(`Total active rows retrieved from public.teacher_subjects: ${rows.length}`);

  // Format records with exact composite identity
  const formattedRows = rows.map((r: any, idx: number) => ({
    index: idx + 1,
    id: r.id,
    teacher_id: r.teacher_id,
    teacher_name: r.teachers?.teacher_name || 'UNKNOWN',
    subject_id: r.subject_id,
    subject_name: r.subjects?.subject_name || 'UNKNOWN',
    subject_code: r.subjects?.subject_code || 'UNKNOWN',
    class_id: r.class_id,
    class_name: r.classes?.class_name || 'UNKNOWN',
    stream_id: r.stream_id,
    stream_name: r.streams?.stream_name || 'UNKNOWN',
    full_stream: `${r.classes?.class_name} ${r.streams?.stream_name}`,
    composite_identity: `${r.teachers?.teacher_name} + ${r.subjects?.subject_name} + ${r.classes?.class_name} + ${r.streams?.stream_name}`
  }));

  console.log('\n=============================================================');
  console.log('STAGE 2: PROBE & MATHEMATICAL ANALYSIS OF PER-TEACHER COUNTS');
  console.log('=============================================================');

  const reportedCounts: Record<string, number> = {
    'Mr Gideon': 7,
    'Madam Caroline': 7,
    'Madam Christine': 7,
    'Mr Brian Ayiecha': 7,
    'Mr Maina': 5,
    'Madam Vivian': 6,
    'Mr Patrick': 5,
    'Madam Grace': 2,
    'Mr Eric': 3,
    'Mr Charles': 1,
    'Madam Angela': 2,
    'Madam Faith': 1
  };

  let mathematicalSum = 0;
  console.log('Teacher | Stated Count in Prompt');
  console.log('---------------------------------');
  for (const [t, c] of Object.entries(reportedCounts)) {
    console.log(`${t.padEnd(20)} | ${c}`);
    mathematicalSum += c;
  }
  console.log('---------------------------------');
  console.log(`MATHEMATICAL SUM OF REPORTED COUNTS: ${mathematicalSum}`);
  console.log(`PROMPT CLAIMED TOTAL: 54`);
  console.log(`ARITHMETIC DIFFERENCE: ${54 - mathematicalSum} allocation missing in prompt count summation!`);

  console.log('\n=============================================================');
  console.log('STAGE 3: RECONCILING AUTHORISED ALLOCATIONS REGISTER');
  console.log('=============================================================');

  // The 53 items from the prompt's authorized list
  const promptList = [
    // 1. Mr Gideon (7)
    { teacher: 'Mr Gideon', subject: 'Pre-Technical Studies', class: 'Grade 7', stream: 'Red' },
    { teacher: 'Mr Gideon', subject: 'Pre-Technical Studies', class: 'Grade 7', stream: 'Blue' },
    { teacher: 'Mr Gideon', subject: 'Pre-Technical Studies', class: 'Grade 8', stream: 'Red' },
    { teacher: 'Mr Gideon', subject: 'Pre-Technical Studies', class: 'Grade 9', stream: 'Red' },
    { teacher: 'Mr Gideon', subject: 'Social Studies', class: 'Grade 9', stream: 'Red' },
    { teacher: 'Mr Gideon', subject: 'Social Studies', class: 'Grade 7', stream: 'Red' },
    { teacher: 'Mr Gideon', subject: 'Agriculture', class: 'Grade 8', stream: 'Blue' },

    // 2. Madam Caroline (7)
    { teacher: 'Madam Caroline', subject: 'English', class: 'Grade 7', stream: 'Blue' },
    { teacher: 'Madam Caroline', subject: 'English', class: 'Grade 9', stream: 'Red' },
    { teacher: 'Madam Caroline', subject: 'Christian Religious Education', class: 'Grade 8', stream: 'Blue' },
    { teacher: 'Madam Caroline', subject: 'Christian Religious Education', class: 'Grade 9', stream: 'Blue' },
    { teacher: 'Madam Caroline', subject: 'Christian Religious Education', class: 'Grade 7', stream: 'Blue' },
    { teacher: 'Madam Caroline', subject: 'Social Studies', class: 'Grade 8', stream: 'Blue' },
    { teacher: 'Madam Caroline', subject: 'Social Studies', class: 'Grade 9', stream: 'Blue' },

    // 3. Madam Christine (7)
    { teacher: 'Madam Christine', subject: 'Integrated Science', class: 'Grade 7', stream: 'Blue' },
    { teacher: 'Madam Christine', subject: 'Integrated Science', class: 'Grade 8', stream: 'Blue' },
    { teacher: 'Madam Christine', subject: 'Integrated Science', class: 'Grade 8', stream: 'Red' },
    { teacher: 'Madam Christine', subject: 'Integrated Science', class: 'Grade 9', stream: 'Red' },
    { teacher: 'Madam Christine', subject: 'Agriculture', class: 'Grade 7', stream: 'Red' },
    { teacher: 'Madam Christine', subject: 'Agriculture', class: 'Grade 8', stream: 'Red' },
    { teacher: 'Madam Christine', subject: 'Christian Religious Education', class: 'Grade 7', stream: 'Red' },

    // 4. Mr Brian Ayiecha (7)
    { teacher: 'BRIAN AYIECHA', subject: 'English', class: 'Grade 9', stream: 'Blue' },
    { teacher: 'BRIAN AYIECHA', subject: 'English', class: 'Grade 8', stream: 'Blue' },
    { teacher: 'BRIAN AYIECHA', subject: 'English', class: 'Grade 7', stream: 'Red' },
    { teacher: 'BRIAN AYIECHA', subject: 'Social Studies', class: 'Grade 7', stream: 'Blue' },
    { teacher: 'BRIAN AYIECHA', subject: 'Social Studies', class: 'Grade 8', stream: 'Red' },
    { teacher: 'BRIAN AYIECHA', subject: 'Christian Religious Education', class: 'Grade 8', stream: 'Red' },
    { teacher: 'BRIAN AYIECHA', subject: 'Creative Arts and Sports', class: 'Grade 8', stream: 'Red' },

    // 5. Mr Maina (5)
    { teacher: 'Mr Maina', subject: 'Integrated Science', class: 'Grade 9', stream: 'Red' },
    { teacher: 'Mr Maina', subject: 'Integrated Science', class: 'Grade 9', stream: 'Blue' },
    { teacher: 'Mr Maina', subject: 'Mathematics', class: 'Grade 7', stream: 'Red' },
    { teacher: 'Mr Maina', subject: 'Mathematics', class: 'Grade 8', stream: 'Blue' },
    { teacher: 'Mr Maina', subject: 'Mathematics', class: 'Grade 9', stream: 'Blue' },

    // 6. Madam Vivian (6)
    { teacher: 'Madam Vivian', subject: 'Kiswahili', class: 'Grade 7', stream: 'Blue' },
    { teacher: 'Madam Vivian', subject: 'Kiswahili', class: 'Grade 7', stream: 'Red' },
    { teacher: 'Madam Vivian', subject: 'Kiswahili', class: 'Grade 9', stream: 'Red' },
    { teacher: 'Madam Vivian', subject: 'Creative Arts and Sports', class: 'Grade 7', stream: 'Red' },
    { teacher: 'Madam Vivian', subject: 'Creative Arts and Sports', class: 'Grade 7', stream: 'Blue' },
    { teacher: 'Madam Vivian', subject: 'Agriculture', class: 'Grade 9', stream: 'Blue' },

    // 7. Mr Patrick (5)
    { teacher: 'Mr Patrick', subject: 'Mathematics', class: 'Grade 7', stream: 'Blue' },
    { teacher: 'Mr Patrick', subject: 'Mathematics', class: 'Grade 8', stream: 'Red' },
    { teacher: 'Mr Patrick', subject: 'Mathematics', class: 'Grade 9', stream: 'Red' },
    { teacher: 'Mr Patrick', subject: 'Pre-Technical Studies', class: 'Grade 8', stream: 'Blue' },
    { teacher: 'Mr Patrick', subject: 'Pre-Technical Studies', class: 'Grade 9', stream: 'Blue' },

    // 8. Madam Grace (2)
    { teacher: 'Madam Grace', subject: 'Creative Arts and Sports', class: 'Grade 8', stream: 'Blue' },
    { teacher: 'Madam Grace', subject: 'English', class: 'Grade 8', stream: 'Red' },

    // 9. Mr Eric (3)
    { teacher: 'Mr Eric', subject: 'Creative Arts and Sports', class: 'Grade 9', stream: 'Blue' },
    { teacher: 'Mr Eric', subject: 'Creative Arts and Sports', class: 'Grade 9', stream: 'Red' },
    { teacher: 'Mr Eric', subject: 'Kiswahili', class: 'Grade 8', stream: 'Red' },

    // 10. Mr Charles (1)
    { teacher: 'Mr Charles', subject: 'Kiswahili', class: 'Grade 8', stream: 'Blue' },

    // 11. Madam Angela (2)
    { teacher: 'Madam Angela', subject: 'Kiswahili', class: 'Grade 9', stream: 'Blue' },
    { teacher: 'Madam Angela', subject: 'Christian Religious Education', class: 'Grade 9', stream: 'Red' },

    // 12. Madam Faith (1)
    { teacher: 'Madam Faith', subject: 'Agriculture', class: 'Grade 9', stream: 'Red' },
  ];

  console.log(`Number of items in prompt authorised list: ${promptList.length}`);

  // Build sets for comparison
  const dbCompositeMap = new Map<string, any>();
  formattedRows.forEach(r => {
    const key = `${r.teacher_name.toLowerCase()}::${r.subject_name.toLowerCase()}::${r.class_name.toLowerCase()}::${r.stream_name.toLowerCase()}`;
    dbCompositeMap.set(key, r);
  });

  const reconciliationReport: any[] = [];
  let correctCount = 0;
  let missingCount = 0;

  promptList.forEach((exp, idx) => {
    const key = `${exp.teacher.toLowerCase()}::${exp.subject.toLowerCase()}::${exp.class.toLowerCase()}::${exp.stream.toLowerCase()}`;
    const found = dbCompositeMap.get(key);
    if (found) {
      correctCount++;
      reconciliationReport.push({
        '#': idx + 1,
        Teacher: exp.teacher,
        'Learning Area': exp.subject,
        Class: exp.class,
        Stream: exp.stream,
        Status: 'CORRECT',
        'DB Primary Key': found.id
      });
    } else {
      missingCount++;
      reconciliationReport.push({
        '#': idx + 1,
        Teacher: exp.teacher,
        'Learning Area': exp.subject,
        Class: exp.class,
        Stream: exp.stream,
        Status: 'MISSING',
        'DB Primary Key': 'NONE'
      });
    }
  });

  console.table(reconciliationReport);

  // Check for unauthorized or duplicate rows in DB
  const authorisedKeySet = new Set(promptList.map(p => `${p.teacher.toLowerCase()}::${p.subject.toLowerCase()}::${p.class.toLowerCase()}::${p.stream.toLowerCase()}`));
  const dbKeyCounts = new Map<string, number>();
  const duplicateRows: any[] = [];
  const unauthorisedRows: any[] = [];

  formattedRows.forEach(r => {
    const key = `${r.teacher_name.toLowerCase()}::${r.subject_name.toLowerCase()}::${r.class_name.toLowerCase()}::${r.stream_name.toLowerCase()}`;
    dbKeyCounts.set(key, (dbKeyCounts.get(key) || 0) + 1);
    if ((dbKeyCounts.get(key) || 0) > 1) {
      duplicateRows.push(r);
    }
    if (!authorisedKeySet.has(key)) {
      unauthorisedRows.push(r);
    }
  });

  console.log('\n=============================================================');
  console.log('RECONCILIATION SUMMARY TOTALS');
  console.log('=============================================================');
  console.log(`- Expected Total from Prompt Itemized List: 53`);
  console.log(`- Expected Total from User Instruction Header: 54`);
  console.log(`- Actual DB Total: ${formattedRows.length}`);
  console.log(`- Correct Total: ${correctCount}`);
  console.log(`- Missing from Itemized List: ${missingCount}`);
  console.log(`- Unauthorised Total: ${unauthorisedRows.length}`);
  console.log(`- Duplicate Total: ${duplicateRows.length}`);

  console.log('\n=============================================================');
  console.log('JUNIOR SCHOOL CURRICULUM GRID ANALYSIS (6 Streams x 9 Subjects = 54 Slots)');
  console.log('=============================================================');

  // Let's audit all 54 slots of the Junior School Timetable
  const JUNIOR_STREAMS = [
    { class: 'Grade 7', stream: 'Red' },
    { class: 'Grade 7', stream: 'Blue' },
    { class: 'Grade 8', stream: 'Red' },
    { class: 'Grade 8', stream: 'Blue' },
    { class: 'Grade 9', stream: 'Red' },
    { class: 'Grade 9', stream: 'Blue' },
  ];

  const JUNIOR_SUBJECTS = [
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

  const gridAssignments = new Map<string, string[]>();
  formattedRows.forEach(r => {
    const slotKey = `${r.class_name} ${r.stream_name} :: ${r.subject_name}`;
    if (!gridAssignments.has(slotKey)) gridAssignments.set(slotKey, []);
    gridAssignments.get(slotKey)!.push(r.teacher_name);
  });

  const gridAudit: any[] = [];
  let doubleAssignedSlots: any[] = [];
  let unassignedSlots: any[] = [];

  let slotIndex = 1;
  for (const st of JUNIOR_STREAMS) {
    for (const sub of JUNIOR_SUBJECTS) {
      const slotKey = `${st.class} ${st.stream} :: ${sub}`;
      const teachersAssigned = gridAssignments.get(slotKey) || [];
      const status = teachersAssigned.length === 1 ? 'OK' : (teachersAssigned.length === 0 ? 'UNASSIGNED (EMPTY)' : 'DOUBLE ASSIGNED (CONFLICT)');
      
      if (teachersAssigned.length > 1) doubleAssignedSlots.push({ slotKey, teachersAssigned });
      if (teachersAssigned.length === 0) unassignedSlots.push(slotKey);

      gridAudit.push({
        '#': slotIndex++,
        Class: st.class,
        Stream: st.stream,
        'Learning Area': sub,
        'Assigned Teacher(s)': teachersAssigned.join(', ') || 'NONE',
        Status: status
      });
    }
  }

  console.log(`Total Curriculum Slots Audited: ${gridAudit.length} (Expected: 54)`);
  console.log(`Double Assigned Slots (Teacher Conflict):`, doubleAssignedSlots);
  console.log(`Unassigned Slots (No Teacher Assigned):`, unassignedSlots);
}

runForensicAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
