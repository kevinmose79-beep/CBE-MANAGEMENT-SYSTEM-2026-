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

interface AuthorisedAllocation {
  teacherName: string;
  learningArea: string;
  streamName: string; // e.g. "Grade 7 Red"
}

const AUTHORISED_ALLOCATIONS: AuthorisedAllocation[] = [
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

async function executeSurgicalFix() {
  console.log('=== STAGE 4: SURGICAL FIX OF TEACHER ALLOCATIONS ===');

  // 1. Fetch current database state
  const { data: teachers } = await supabaseAdmin.from('teachers').select('*');
  const { data: classes } = await supabaseAdmin.from('classes').select('*');
  const { data: streams } = await supabaseAdmin.from('streams').select('*');
  const { data: currentAllocs } = await supabaseAdmin.from('teacher_subjects').select('*');

  const classMap = new Map(classes?.map(c => [c.id, c.class_name]));
  const streamMap = new Map<string, { id: string; class_id: string }>();
  streams?.forEach(s => {
    const fullName = `${classMap.get(s.class_id)} ${s.stream_name}`;
    streamMap.set(fullName, { id: s.id, class_id: s.class_id });
  });

  const teacherByName = new Map<string, any>();
  teachers?.forEach(t => {
    teacherByName.set(t.teacher_name.toLowerCase(), t);
  });

  // Prepare desired allocation records
  const desiredKeys = new Set<string>();
  const desiredRecords: Array<{
    key: string;
    teacher_id: string;
    subject_id: string;
    class_id: string;
    stream_id: string;
    teacherName: string;
    learningArea: string;
    streamName: string;
  }> = [];

  for (const alloc of AUTHORISED_ALLOCATIONS) {
    const t = teacherByName.get(alloc.teacherName.toLowerCase());
    if (!t) throw new Error(`Teacher not found: ${alloc.teacherName}`);

    const subId = JUNIOR_SUBJECT_IDS[alloc.learningArea];
    if (!subId) throw new Error(`Subject not found: ${alloc.learningArea}`);

    const strm = streamMap.get(alloc.streamName);
    if (!strm) throw new Error(`Stream not found: ${alloc.streamName}`);

    const key = `${t.id}::${subId}::${strm.id}`;
    desiredKeys.add(key);

    desiredRecords.push({
      key,
      teacher_id: t.id,
      subject_id: subId,
      class_id: strm.class_id,
      stream_id: strm.id,
      teacherName: alloc.teacherName,
      learningArea: alloc.learningArea,
      streamName: alloc.streamName
    });
  }

  console.log(`Total desired allocations: ${desiredRecords.length}`);

  // Classify existing DB allocations
  const toRetain: any[] = [];
  const toDeleteIds: string[] = [];

  currentAllocs?.forEach(ca => {
    const key = `${ca.teacher_id}::${ca.subject_id}::${ca.stream_id}`;
    if (desiredKeys.has(key)) {
      toRetain.push(ca);
    } else {
      toDeleteIds.push(ca.id);
    }
  });

  console.log(`Current DB allocations count: ${currentAllocs?.length}`);
  console.log(`Allocations to retain (already correct): ${toRetain.length}`);
  console.log(`Unauthorised allocations to delete: ${toDeleteIds.length}`);

  // Delete unauthorised allocations
  if (toDeleteIds.length > 0) {
    console.log(`Deleting ${toDeleteIds.length} unauthorised allocations from public.teacher_subjects...`);
    const { error: delErr } = await supabaseAdmin
      .from('teacher_subjects')
      .delete()
      .in('id', toDeleteIds);

    if (delErr) {
      throw new Error(`Failed to delete unauthorised allocations: ${delErr.message}`);
    }
    console.log(`✓ Deleted ${toDeleteIds.length} unauthorised allocations successfully.`);
  }

  // Determine missing allocations to insert
  const retainedKeys = new Set(toRetain.map(r => `${r.teacher_id}::${r.subject_id}::${r.stream_id}`));
  const toInsert = desiredRecords.filter(dr => !retainedKeys.has(dr.key));

  console.log(`Missing authorised allocations to insert: ${toInsert.length}`);

  if (toInsert.length > 0) {
    const payload = toInsert.map(ti => ({
      teacher_id: ti.teacher_id,
      subject_id: ti.subject_id,
      class_id: ti.class_id,
      stream_id: ti.stream_id,
    }));

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('teacher_subjects')
      .insert(payload)
      .select();

    if (insErr) {
      throw new Error(`Failed to insert authorised allocations: ${insErr.message}`);
    }
    console.log(`✓ Inserted ${inserted?.length} authorised allocations successfully.`);
  }

  console.log('\nSurgical modification complete. Proceeding to Stage 5 & 6 testing and verification...');
}

executeSurgicalFix().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
