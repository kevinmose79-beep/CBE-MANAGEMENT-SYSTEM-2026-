import '../testSetup';
import { lastDocPageCount, setLastDocPageCount } from './pdfTestWrapper';
import { generateProvisionalApprovalPDF } from './provisionalApprovalPdfExporter';
import { Student, ClassStream, Examination, Subject, Mark, Grade, School, Teacher } from '../types';

console.log('=== RUNNING DEF-PDF-01 PROVISIONAL APPROVAL PDF PAGE-BREAK RESERVATION TESTS ===\n');

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${message}`);
  } else {
    console.error(`✗ FAIL: ${message}`);
  }
}
const school: School = {
  id: 'sch1',
  school_name: 'Test Academy',
  county: 'Nairobi',
  address: '123 Test St',
  phone: '555-0100',
  email: 'info@test.edu',
  motto: 'Excellence In Learning',
};

const classes: ClassStream[] = [
  { id: 'cls_7a', class_name: 'Grade 7', stream: 'Alpha', education_level: 'Junior School', class_teacher_id: 'tch1', allocated_subject_ids: ['sb1', 'sb2'] },
];

const teachers: Teacher[] = [
  { id: 'tch1', teacher_name: 'Mr. John Teacher', email: 'john@test.edu', phone: '0700000000', allocations: [], is_class_teacher: true, class_teacher_of_id: 'cls_7a' },
];

const subjects: Subject[] = [
  { id: 'sb1', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
  { id: 'sb2', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
  { id: 'sb3', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
];

const grades: Grade[] = [
  { id: 'g1', grade_code: 'EE', minimum_score: 80, maximum_score: 100, points: 4, performance_level: 'EE', remarks: 'Exceeding Expectations', descriptor: 'Exceeding' },
  { id: 'g2', grade_code: 'ME', minimum_score: 65, maximum_score: 79, points: 3, performance_level: 'ME', remarks: 'Meeting Expectations', descriptor: 'Meeting' },
  { id: 'g3', grade_code: 'AE', minimum_score: 50, maximum_score: 64, points: 2, performance_level: 'AE', remarks: 'Approaching Expectations', descriptor: 'Approaching' },
  { id: 'g4', grade_code: 'BE', minimum_score: 0, maximum_score: 49, points: 1, performance_level: 'BE', remarks: 'Below Expectations', descriptor: 'Below' },
];

const exam: Examination = {
  id: 'ex1',
  exam_name: 'End Term 1 Exam',
  term: 'Term 1',
  year: 2025,
  status: 'Published',
  exam_type: 'End-Term',
  max_marks: 100,
};

// 1. Safe Single-Page Test (Small subject count)
const singleSubjects: Subject[] = [
  { id: 'sb1', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
  { id: 'sb2', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
];

const smallStudents: Student[] = [
  { id: 'st1', full_name: 'Alice Small', admission_number: 'ADM001', class_id: 'cls_7a', stream_id: 'cls_7a', grade: 'Grade 7', gender: 'F', active: true },
  { id: 'st2', full_name: 'Bob Small', admission_number: 'ADM002', class_id: 'cls_7a', stream_id: 'cls_7a', grade: 'Grade 7', gender: 'M', active: true },
];

const smallMarks: Mark[] = [
  { id: 'm1', student_id: 'st1', exam_id: 'ex1', subject_id: 'sb1', marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
  { id: 'm2', student_id: 'st2', exam_id: 'ex1', subject_id: 'sb1', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
];

setLastDocPageCount(0);
localStorage.setItem('cbe_classes', JSON.stringify(classes));
localStorage.setItem('cbe_subjects', JSON.stringify(singleSubjects));
try {
  await generateProvisionalApprovalPDF({
    exam,
    school,
    students: smallStudents,
    subjects: singleSubjects,
    marks: smallMarks,
    grades,
    classes,
    teachers,
    selectedClassId: 'cls_7a',
    approvalStatus: 'Provisional',
    approvalNotes: 'Audited and verified.',
  });
} catch (err) {
  console.error('ERROR in test 1:', err);
}

assert(lastDocPageCount === 2, `Standard report cleanly moves Section 4 and 5 sign-off grid to Page 2 to prevent signature/stamp overflow (actual pages: ${lastDocPageCount})`);

// 2. Near-Threshold / Multi-Subject Page-Break Test
// On A4 Portrait (297mm height, printable 282mm), Section 4 & 5 require 66mm space.
// With 12 subjects, Section 3 finalY reaches ~220mm.
// With old +55 reservation: 220 + 55 = 275 <= 282 -> NO page break, leaving only 62mm for 66mm content (causing stamp/signatures to overflow).
// With new +66 reservation: 220 + 66 = 286 > 282 -> correctly triggers doc.addPage() before Section 4 and 5.
const multiSubjects: Subject[] = Array.from({ length: 12 }, (_, i) => ({
  id: `sb_${i + 1}`,
  subject_code: `SUBJ${i + 1}`,
  subject_name: `Learning Area ${i + 1}`,
  education_level: 'Junior School',
  category: 'Core',
}));

const cohortStudents: Student[] = Array.from({ length: 10 }, (_, i) => ({
  id: `st_cohort_${i + 1}`,
  full_name: `Student Number ${i + 1}`,
  admission_number: `ADM${100 + i + 1}`,
  class_id: 'cls_7a',
  stream_id: 'cls_7a',
  grade: 'Grade 7',
  gender: i % 2 === 0 ? 'F' : 'M',
  active: true,
}));

const cohortMarks: Mark[] = cohortStudents.flatMap((s, sIdx) =>
  multiSubjects.map((sb, sbIdx) => ({
    id: `m_${s.id}_${sb.id}`,
    student_id: s.id,
    exam_id: 'ex1',
    subject_id: sb.id,
    marks: 60 + ((sIdx + sbIdx) % 35),
    raw_score: 60 + ((sIdx + sbIdx) % 35),
    out_of: 100,
    special_status: 'Normal',
  }))
);

const multiClasses: ClassStream[] = [
  { id: 'cls_7a', class_name: 'Grade 7', stream: 'Alpha', education_level: 'Junior School', class_teacher_id: 'tch1', allocated_subject_ids: multiSubjects.map((s) => s.id) },
];

setLastDocPageCount(0);
localStorage.setItem('cbe_classes', JSON.stringify(multiClasses));
localStorage.setItem('cbe_subjects', JSON.stringify(multiSubjects));
try {
  await generateProvisionalApprovalPDF({
    exam,
    school,
    students: cohortStudents,
    subjects: multiSubjects,
    marks: cohortMarks,
    grades,
    classes: multiClasses,
    teachers,
    selectedClassId: 'cls_7a',
    approvalStatus: 'Approved',
    approvalNotes: 'Approved for publication following full audit.',
  });
} catch (err) {
  console.error('ERROR in test 2:', err);
}

assert(lastDocPageCount === 2, `Near-threshold multi-subject report cleanly renders Section 4 and 5 sign-off grid on Page 2 without spilling to Page 3 (actual pages: ${lastDocPageCount})`);

console.log(`\nDEF-PDF-01 TEST SUMMARY: ${passed}/${total} tests passed.\n`);

if (passed !== total) {
  process.exit(1);
}
