import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

export interface TeacherProvisionPlan {
  name: string;
  email: string;
  role: 'class_teacher' | 'subject_teacher';
  is_class_teacher: boolean;
  classTeacherStreamName?: string;
  isExisting?: boolean;
  existingTeacherId?: string;
  allocations: Array<{
    subjectName: string;
    classStream: string;
  }>;
}

export const TEACHER_PLANS: TeacherProvisionPlan[] = [
  {
    name: 'Mr Gideon',
    email: 'gideon@cbe.ac.ke',
    role: 'class_teacher',
    is_class_teacher: true,
    classTeacherStreamName: 'Grade 7 Red',
    allocations: [
      { subjectName: 'Pre-Technical Studies', classStream: 'Grade 7 Red' },
      { subjectName: 'Pre-Technical Studies', classStream: 'Grade 7 Blue' },
      { subjectName: 'Pre-Technical Studies', classStream: 'Grade 8 Red' },
      { subjectName: 'Pre-Technical Studies', classStream: 'Grade 9 Red' },
      { subjectName: 'Social Studies', classStream: 'Grade 7 Red' },
      { subjectName: 'Social Studies', classStream: 'Grade 9 Red' },
      { subjectName: 'Agriculture', classStream: 'Grade 8 Blue' },
    ]
  },
  {
    name: 'Madam Caroline',
    email: 'caroline@cbe.ac.ke',
    role: 'class_teacher',
    is_class_teacher: true,
    classTeacherStreamName: 'Grade 7 Blue',
    allocations: [
      { subjectName: 'English', classStream: 'Grade 7 Blue' },
      { subjectName: 'English', classStream: 'Grade 9 Red' },
      { subjectName: 'Christian Religious Education', classStream: 'Grade 7 Blue' },
      { subjectName: 'Christian Religious Education', classStream: 'Grade 8 Blue' },
      { subjectName: 'Christian Religious Education', classStream: 'Grade 9 Blue' },
      { subjectName: 'Social Studies', classStream: 'Grade 8 Blue' },
      { subjectName: 'Social Studies', classStream: 'Grade 9 Blue' },
    ]
  },
  {
    name: 'Madam Christine',
    email: 'christine@cbe.ac.ke',
    role: 'class_teacher',
    is_class_teacher: true,
    classTeacherStreamName: 'Grade 8 Red',
    allocations: [
      { subjectName: 'Integrated Science', classStream: 'Grade 7 Blue' },
      { subjectName: 'Integrated Science', classStream: 'Grade 8 Red' },
      { subjectName: 'Integrated Science', classStream: 'Grade 8 Blue' },
      { subjectName: 'Agriculture', classStream: 'Grade 7 Red' },
      { subjectName: 'Agriculture', classStream: 'Grade 7 Blue' },
      { subjectName: 'Agriculture', classStream: 'Grade 8 Red' },
      { subjectName: 'Christian Religious Education', classStream: 'Grade 7 Red' },
    ]
  },
  {
    name: 'BRIAN AYIECHA',
    email: 'brianayiecha81@cbe.ac.ke',
    role: 'class_teacher',
    is_class_teacher: true,
    classTeacherStreamName: 'Grade 8 Blue',
    isExisting: true,
    existingTeacherId: '3b3af31e-ad67-4dab-82a4-8d12bc574fe9',
    allocations: [
      { subjectName: 'English', classStream: 'Grade 7 Red' },
      { subjectName: 'English', classStream: 'Grade 8 Blue' },
      { subjectName: 'English', classStream: 'Grade 9 Blue' },
      { subjectName: 'Social Studies', classStream: 'Grade 7 Blue' },
      { subjectName: 'Social Studies', classStream: 'Grade 8 Red' },
      { subjectName: 'Christian Religious Education', classStream: 'Grade 8 Red' },
      { subjectName: 'Creative Arts and Sports', classStream: 'Grade 8 Red' },
    ]
  },
  {
    name: 'Mr Maina',
    email: 'maina@cbe.ac.ke',
    role: 'class_teacher',
    is_class_teacher: true,
    classTeacherStreamName: 'Grade 9 Blue',
    allocations: [
      { subjectName: 'Integrated Science', classStream: 'Grade 7 Red' },
      { subjectName: 'Integrated Science', classStream: 'Grade 9 Red' },
      { subjectName: 'Integrated Science', classStream: 'Grade 9 Blue' },
      { subjectName: 'Mathematics', classStream: 'Grade 7 Red' },
      { subjectName: 'Mathematics', classStream: 'Grade 8 Blue' },
      { subjectName: 'Mathematics', classStream: 'Grade 9 Blue' },
    ]
  },
  {
    name: 'Madam Vivian',
    email: 'vivian@cbe.ac.ke',
    role: 'class_teacher',
    is_class_teacher: true,
    classTeacherStreamName: 'Grade 9 Red',
    allocations: [
      { subjectName: 'Kiswahili', classStream: 'Grade 7 Blue' },
      { subjectName: 'Kiswahili', classStream: 'Grade 7 Red' },
      { subjectName: 'Kiswahili', classStream: 'Grade 9 Red' },
      { subjectName: 'Creative Arts and Sports', classStream: 'Grade 7 Red' },
      { subjectName: 'Creative Arts and Sports', classStream: 'Grade 7 Blue' },
      { subjectName: 'Agriculture', classStream: 'Grade 9 Blue' },
    ]
  },
  {
    name: 'Mr Patrick',
    email: 'patrick@cbe.ac.ke',
    role: 'subject_teacher',
    is_class_teacher: false,
    allocations: [
      { subjectName: 'Mathematics', classStream: 'Grade 7 Blue' },
      { subjectName: 'Mathematics', classStream: 'Grade 8 Red' },
      { subjectName: 'Mathematics', classStream: 'Grade 9 Red' },
      { subjectName: 'Pre-Technical Studies', classStream: 'Grade 8 Blue' },
      { subjectName: 'Pre-Technical Studies', classStream: 'Grade 9 Blue' },
    ]
  },
  {
    name: 'Madam Grace',
    email: 'grace@cbe.ac.ke',
    role: 'subject_teacher',
    is_class_teacher: false,
    allocations: [
      { subjectName: 'Creative Arts and Sports', classStream: 'Grade 8 Blue' },
      { subjectName: 'English', classStream: 'Grade 8 Red' },
    ]
  },
  {
    name: 'Mr Eric',
    email: 'eric@cbe.ac.ke',
    role: 'subject_teacher',
    is_class_teacher: false,
    allocations: [
      { subjectName: 'Creative Arts and Sports', classStream: 'Grade 9 Blue' },
      { subjectName: 'Creative Arts and Sports', classStream: 'Grade 9 Red' },
      { subjectName: 'Kiswahili', classStream: 'Grade 8 Red' },
    ]
  },
  {
    name: 'Mr Charles',
    email: 'charles@cbe.ac.ke',
    role: 'subject_teacher',
    is_class_teacher: false,
    allocations: [
      { subjectName: 'Kiswahili', classStream: 'Grade 8 Blue' },
    ]
  },
  {
    name: 'Madam Angela',
    email: 'angela@cbe.ac.ke',
    role: 'subject_teacher',
    is_class_teacher: false,
    allocations: [
      { subjectName: 'Kiswahili', classStream: 'Grade 9 Blue' },
      { subjectName: 'Christian Religious Education', classStream: 'Grade 9 Red' },
    ]
  },
  {
    name: 'Madam Faith',
    email: 'faith@cbe.ac.ke',
    role: 'subject_teacher',
    is_class_teacher: false,
    allocations: [
      { subjectName: 'Agriculture', classStream: 'Grade 9 Red' },
    ]
  }
];

async function runDryRun() {
  console.log('=== DRY RUN: VALIDATING CLASSES, STREAMS, AND SUBJECTS ===');

  // Load classes
  const { data: classes } = await supabaseAdmin.from('classes').select('id, class_name');
  const classMap = new Map<string, string>(); // 'Grade 7' -> id
  classes?.forEach(c => classMap.set(c.class_name, c.id));

  // Load streams
  const { data: streams } = await supabaseAdmin.from('streams').select('id, class_id, stream_name, class_teacher_id');
  const streamMap = new Map<string, { stream_id: string; class_id: string }>(); // 'Grade 7 Red' -> { stream_id, class_id }

  streams?.forEach(s => {
    const cls = classes?.find(c => c.id === s.class_id);
    if (cls) {
      streamMap.set(`${cls.class_name} ${s.stream_name}`, {
        stream_id: s.id,
        class_id: s.class_id
      });
    }
  });

  // Load Junior School subjects
  const { data: subjects } = await supabaseAdmin.from('subjects').select('id, subject_name, subject_code, learning_area');
  // We need Junior School subjects (Grade 4–9 / Grade 7–9 / PP1–Grade 9)
  const subjectMap = new Map<string, string>(); // subjectName -> id

  const targetSubjectConfigs = [
    { name: 'English', id: '823eba35-ac51-4ac8-be57-fcbeee88151c' },
    { name: 'Kiswahili', id: 'f00b5334-fa16-4640-b19c-733ec4530318' },
    { name: 'Mathematics', id: '4441b054-2d20-4d5c-852d-f31d16fbc145' },
    { name: 'Integrated Science', id: 'b65c16d5-a38c-478e-ab46-085170ee31da' },
    { name: 'Creative Arts and Sports', id: 'b2ee51ad-3d6e-458c-8a1e-f5b9b79a0d83' },
    { name: 'Agriculture', id: 'fe17661a-9c3b-439e-9cb9-fd2f88279f56' },
    { name: 'Pre-Technical Studies', id: '5d9beb86-1268-40cb-bae6-7f8e4b998ea2' },
    { name: 'Christian Religious Education', id: 'e784b5fc-dab9-4105-bb49-fce1d1a84cf7' },
    { name: 'Social Studies', id: 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409' }
  ];

  for (const cfg of targetSubjectConfigs) {
    const found = subjects?.find(s => s.id === cfg.id);
    if (!found) {
      throw new Error(`Configured subject ID ${cfg.id} for ${cfg.name} not found in database!`);
    }
    subjectMap.set(cfg.name, found.id);
  }

  console.log('All 9 Junior School Subjects successfully verified against database.');

  // Validate all plans
  let totalAllocs = 0;
  for (const tp of TEACHER_PLANS) {
    console.log(`\nValidating plan for: ${tp.name} (${tp.role}) - ${tp.allocations.length} allocations`);
    if (tp.classTeacherStreamName) {
      const strm = streamMap.get(tp.classTeacherStreamName);
      if (!strm) throw new Error(`Stream not found: ${tp.classTeacherStreamName}`);
      console.log(`  -> Class teacher of: ${tp.classTeacherStreamName} (stream_id: ${strm.stream_id})`);
    }

    for (const alloc of tp.allocations) {
      totalAllocs++;
      const strm = streamMap.get(alloc.classStream);
      if (!strm) throw new Error(`Stream not found for alloc: ${alloc.classStream}`);
      const subId = subjectMap.get(alloc.subjectName);
      if (!subId) throw new Error(`Subject not found for alloc: ${alloc.subjectName}`);
    }
  }

  console.log(`\nTotal allocations validated: ${totalAllocs} / 54`);
  console.log('DRY RUN COMPLETE AND 100% VERIFIED!');
}

runDryRun();
