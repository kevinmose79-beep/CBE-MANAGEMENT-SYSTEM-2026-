interface AssignmentDef {
  teacher: string;
  role: 'class_teacher' | 'subject_teacher';
  classTeacherOf?: string; // e.g. "Grade 7 Red"
  allocations: Array<{
    subject: string;
    classStream: string;
  }>;
}

const teachersPlan: AssignmentDef[] = [
  {
    teacher: 'Mr Gideon',
    role: 'class_teacher',
    classTeacherOf: 'Grade 7 Red',
    allocations: [
      { subject: 'Pre-Technical Studies', classStream: 'Grade 7 Red' },
      { subject: 'Pre-Technical Studies', classStream: 'Grade 7 Blue' },
      { subject: 'Pre-Technical Studies', classStream: 'Grade 8 Red' },
      { subject: 'Pre-Technical Studies', classStream: 'Grade 9 Red' },
      { subject: 'Social Studies', classStream: 'Grade 7 Red' },
      { subject: 'Social Studies', classStream: 'Grade 9 Red' },
      { subject: 'Agriculture', classStream: 'Grade 8 Blue' },
    ]
  },
  {
    teacher: 'Madam Caroline',
    role: 'class_teacher',
    classTeacherOf: 'Grade 7 Blue',
    allocations: [
      { subject: 'English', classStream: 'Grade 7 Blue' },
      { subject: 'English', classStream: 'Grade 9 Red' },
      { subject: 'CRE', classStream: 'Grade 7 Blue' },
      { subject: 'CRE', classStream: 'Grade 8 Blue' },
      { subject: 'CRE', classStream: 'Grade 9 Blue' },
      { subject: 'Social Studies', classStream: 'Grade 8 Blue' },
      { subject: 'Social Studies', classStream: 'Grade 9 Blue' },
    ]
  },
  {
    teacher: 'Madam Christine',
    role: 'class_teacher',
    classTeacherOf: 'Grade 8 Red',
    allocations: [
      { subject: 'Integrated Science', classStream: 'Grade 7 Blue' },
      { subject: 'Integrated Science', classStream: 'Grade 8 Red' },
      { subject: 'Integrated Science', classStream: 'Grade 8 Blue' },
      { subject: 'Agriculture', classStream: 'Grade 7 Red' },
      { subject: 'Agriculture', classStream: 'Grade 7 Blue' },
      { subject: 'Agriculture', classStream: 'Grade 8 Red' },
      { subject: 'CRE', classStream: 'Grade 7 Red' },
    ]
  },
  {
    teacher: 'Mr Brian Ayiecha',
    role: 'class_teacher',
    classTeacherOf: 'Grade 8 Blue',
    allocations: [
      { subject: 'English', classStream: 'Grade 7 Red' },
      { subject: 'English', classStream: 'Grade 8 Blue' },
      { subject: 'English', classStream: 'Grade 9 Blue' },
      { subject: 'Social Studies', classStream: 'Grade 7 Blue' },
      { subject: 'Social Studies', classStream: 'Grade 8 Red' },
      { subject: 'CRE', classStream: 'Grade 8 Red' },
      { subject: 'Creative Arts and Sports', classStream: 'Grade 8 Red' },
    ]
  },
  {
    teacher: 'Mr Maina',
    role: 'class_teacher',
    classTeacherOf: 'Grade 9 Blue',
    allocations: [
      { subject: 'Integrated Science', classStream: 'Grade 7 Red' },
      { subject: 'Integrated Science', classStream: 'Grade 9 Red' },
      { subject: 'Integrated Science', classStream: 'Grade 9 Blue' },
      { subject: 'Mathematics', classStream: 'Grade 7 Red' },
      { subject: 'Mathematics', classStream: 'Grade 8 Blue' },
      { subject: 'Mathematics', classStream: 'Grade 9 Blue' },
    ]
  },
  {
    teacher: 'Madam Vivian',
    role: 'class_teacher',
    classTeacherOf: 'Grade 9 Red',
    allocations: [
      { subject: 'Kiswahili', classStream: 'Grade 7 Blue' },
      { subject: 'Kiswahili', classStream: 'Grade 7 Red' },
      { subject: 'Kiswahili', classStream: 'Grade 9 Red' },
      { subject: 'Creative Arts and Sports', classStream: 'Grade 7 Red' },
      { subject: 'Creative Arts and Sports', classStream: 'Grade 7 Blue' },
      { subject: 'Agriculture', classStream: 'Grade 9 Blue' },
    ]
  },
  {
    teacher: 'Mr Patrick',
    role: 'subject_teacher',
    allocations: [
      { subject: 'Mathematics', classStream: 'Grade 7 Blue' },
      { subject: 'Mathematics', classStream: 'Grade 8 Red' },
      { subject: 'Mathematics', classStream: 'Grade 9 Red' },
      { subject: 'Pre-Technical Studies', classStream: 'Grade 8 Blue' },
      { subject: 'Pre-Technical Studies', classStream: 'Grade 9 Blue' },
    ]
  },
  {
    teacher: 'Madam Grace',
    role: 'subject_teacher',
    allocations: [
      { subject: 'Creative Arts and Sports', classStream: 'Grade 8 Blue' },
      { subject: 'English', classStream: 'Grade 8 Red' },
    ]
  },
  {
    teacher: 'Mr Eric',
    role: 'subject_teacher',
    allocations: [
      { subject: 'Creative Arts and Sports', classStream: 'Grade 9 Blue' },
      { subject: 'Creative Arts and Sports', classStream: 'Grade 9 Red' },
      { subject: 'Kiswahili', classStream: 'Grade 8 Red' },
    ]
  },
  {
    teacher: 'Mr Charles',
    role: 'subject_teacher',
    allocations: [
      { subject: 'Kiswahili', classStream: 'Grade 8 Blue' },
    ]
  },
  {
    teacher: 'Madam Angela',
    role: 'subject_teacher',
    allocations: [
      { subject: 'Kiswahili', classStream: 'Grade 9 Blue' },
      { subject: 'CRE', classStream: 'Grade 9 Red' },
    ]
  },
  {
    teacher: 'Madam Faith',
    role: 'subject_teacher',
    allocations: [
      { subject: 'Agriculture', classStream: 'Grade 9 Red' },
    ]
  }
];

const streams = [
  'Grade 7 Red',
  'Grade 7 Blue',
  'Grade 8 Red',
  'Grade 8 Blue',
  'Grade 9 Red',
  'Grade 9 Blue',
];

const subjects = [
  'English',
  'Kiswahili',
  'Mathematics',
  'Integrated Science',
  'Creative Arts and Sports',
  'Agriculture',
  'Pre-Technical Studies',
  'CRE',
  'Social Studies',
];

const grid = new Map<string, string>();
let totalCount = 0;
let conflicts = 0;

for (const t of teachersPlan) {
  for (const a of t.allocations) {
    totalCount++;
    const key = `${a.classStream} :: ${a.subject}`;
    if (grid.has(key)) {
      console.error(`CONFLICT DETECTED at ${key}: already assigned to ${grid.get(key)}, tried to assign ${t.teacher}`);
      conflicts++;
    } else {
      grid.set(key, t.teacher);
    }
  }
}

console.log(`Total assignments processed: ${totalCount}`);
console.log(`Total conflicts: ${conflicts}`);

let missing = 0;
for (const st of streams) {
  for (const sb of subjects) {
    const key = `${st} :: ${sb}`;
    if (!grid.has(key)) {
      console.error(`MISSING ASSIGNMENT: ${key}`);
      missing++;
    }
  }
}

console.log(`Total missing assignments: ${missing}`);
console.log(`Grid size (unique covered slots): ${grid.size} / ${streams.length * subjects.length}`);

if (totalCount === 54 && conflicts === 0 && missing === 0 && grid.size === 54) {
  console.log('PERFECT 54/54 COVERAGE MATRIX CONFIRMED! Zero conflicts, zero gaps.');
} else {
  console.error('VERIFICATION FAILED!');
}
