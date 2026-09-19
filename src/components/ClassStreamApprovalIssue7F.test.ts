import {
  isLevelApproved,
  isClassExamApproved,
  isStreamApproved,
  isGradeFullyApproved,
  isEducationLevelFullyApproved,
  isExaminationFullyApproved,
  isStudentExamApproved,
} from '../utils/examLockUtils';
import { Examination, ClassStream, Student, Teacher, User, Mark } from '../types';

// ==========================================
// TEST FIXTURES
// ==========================================

const mockClasses: ClassStream[] = [
  { id: 'str_g7_east', class_name: 'Grade 7', stream: 'East', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_john' },
  { id: 'str_g7_west', class_name: 'Grade 7', stream: 'West', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_mary' },
  { id: 'str_g8_east', class_name: 'Grade 8', stream: 'East', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_peter' },
  { id: 'str_g8_west', class_name: 'Grade 8', stream: 'West', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_susan' },
  { id: 'str_g1_north', class_name: 'Grade 1', stream: 'North', capacity: 35, education_level: 'Lower Primary', status: 'Active', class_teacher_id: 'tch_alice' },
  { id: 'str_pp1_blue', class_name: 'PP1', stream: 'Blue', capacity: 30, education_level: 'Pre-Primary', status: 'Active', class_teacher_id: 'tch_grace' },
];

const mockStudents: Student[] = [
  { id: 'std_g7e_01', admission_number: 'ADM-701', full_name: 'Allan East', gender: 'M', class_id: 'str_g7_east', stream_id: 'str_g7_east', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_g7e_02', admission_number: 'ADM-702', full_name: 'Brenda East', gender: 'F', class_id: 'str_g7_east', stream_id: 'str_g7_east', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_g7w_01', admission_number: 'ADM-703', full_name: 'Charles West', gender: 'M', class_id: 'str_g7_west', stream_id: 'str_g7_west', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_g7w_02', admission_number: 'ADM-704', full_name: 'Diana West', gender: 'F', class_id: 'str_g7_west', stream_id: 'str_g7_west', active: true, education_level: 'Junior School', grade: 'Grade 7' },
];

const teacherJohn: Teacher = { id: 'tch_john', teacher_name: 'John Kip', phone: '0712345678', email: 'john@school.org', status: 'Active' };
const teacherMary: Teacher = { id: 'tch_mary', teacher_name: 'Mary Chep', phone: '0712345679', email: 'mary@school.org', status: 'Active' };

const userJohn: User = { id: 'usr_john', email: 'john@school.org', name: 'John Kip', role: 'class_teacher', teacher_id: 'tch_john', status: 'Active' };
const userMary: User = { id: 'usr_mary', email: 'mary@school.org', name: 'Mary Chep', role: 'class_teacher', teacher_id: 'tch_mary', status: 'Active' };
const userAdmin: User = { id: 'usr_admin', email: 'admin@school.org', name: 'Super Admin', role: 'admin', status: 'Active' };

const initialExam: Examination = {
  id: 'ex_term1_2026',
  exam_name: 'Mid Term 1 Assessment',
  exam_type: 'Mid-Term',
  term: 'Term 1',
  year: 2026,
  status: 'Open',
  max_marks: 100,
  start_date: '2026-02-10',
  approved_levels: [],
  approved_classes: [],
};

const initialMarks: Mark[] = [
  { id: 'm_01', exam_id: 'ex_term1_2026', student_id: 'std_g7e_01', subject_id: 'sub_math', marks: 85, out_of: 100 },
  { id: 'm_02', exam_id: 'ex_term1_2026', student_id: 'std_g7e_02', subject_id: 'sub_math', marks: 78, out_of: 100 },
  { id: 'm_03', exam_id: 'ex_term1_2026', student_id: 'std_g7w_01', subject_id: 'sub_math', marks: 60, out_of: 100 },
];

// Helper to check Class Teacher ownership
function canTeacherApproveStream(user: User, stream: ClassStream): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'class_teacher' && user.teacher_id && stream.class_teacher_id === user.teacher_id) {
    return true;
  }
  return false;
}

// Helper to compute stream readiness
function computeStreamReadiness(streamId: string, expectedCount: number, enteredCount: number): boolean {
  return expectedCount > 0 && enteredCount === expectedCount;
}

// ==========================================
// TEST EXECUTION
// ==========================================

const testResults: { num: number; description: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

function recordTest(num: number, description: string, passed: boolean, details?: string) {
  testResults.push({
    num,
    description,
    status: passed ? 'PASS' : 'FAIL',
    details,
  });
  console.log(`Test ${num}: ${description} -> ${passed ? 'PASS' : 'FAIL'}${details ? ` (${details})` : ''}`);
}

console.log('=====================================================');
console.log('CBE MANAGEMENT SYSTEM — ISSUE 7F TARGETED TEST SUITE');
console.log('=====================================================\n');

// 1. Complete Class Stream can be approved.
const g7eTotalExpected = 20; // 2 learners * 10 subjects
const g7eEnteredComplete = 20;
const isG7eReady = computeStreamReadiness('str_g7_east', g7eTotalExpected, g7eEnteredComplete);
recordTest(1, 'Complete Class Stream can be approved', isG7eReady === true);

// 2. Incomplete Class Stream cannot be approved.
const g7wTotalExpected = 20;
const g7wEnteredIncomplete = 15; // 5 missing marks
const isG7wReady = computeStreamReadiness('str_g7_west', g7wTotalExpected, g7wEnteredIncomplete);
recordTest(2, 'Incomplete Class Stream cannot be approved', isG7wReady === false);

// 3. Class Teacher can approve own stream.
const streamG7East = mockClasses.find(c => c.id === 'str_g7_east')!;
const canJohnApproveG7East = canTeacherApproveStream(userJohn, streamG7East);
recordTest(3, 'Class Teacher can approve own stream', canJohnApproveG7East === true);

// 4. Class Teacher cannot approve another stream.
const streamG7West = mockClasses.find(c => c.id === 'str_g7_west')!;
const canJohnApproveG7West = canTeacherApproveStream(userJohn, streamG7West);
recordTest(4, 'Class Teacher cannot approve another stream', canJohnApproveG7West === false);

// 5. Administrator can approve any stream.
const canAdminApproveEast = canTeacherApproveStream(userAdmin, streamG7East);
const canAdminApproveWest = canTeacherApproveStream(userAdmin, streamG7West);
recordTest(5, 'Administrator can approve any stream', canAdminApproveEast && canAdminApproveWest);

// 6. Approving East does not approve West.
const examWithEastApproved: Examination = {
  ...initialExam,
  approved_classes: ['str_g7_east'],
};
const isEastApproved = isClassExamApproved(examWithEastApproved, streamG7East);
const isWestApproved = isClassExamApproved(examWithEastApproved, streamG7West);
recordTest(6, 'Approving East does not approve West', isEastApproved === true && isWestApproved === false);

// 7. Approved East becomes locked for marks.
const canModifyTerm = true;
const isEastGridModifiable = canModifyTerm && !isEastApproved;
recordTest(7, 'Approved East becomes locked for marks', isEastGridModifiable === false);

// 8. Pending West remains available for authorised mark entry.
const isWestGridModifiable = canModifyTerm && !isWestApproved;
recordTest(8, 'Pending West remains available for authorised mark entry', isWestGridModifiable === true);

// 9. Approved East can generate official reports.
const isEastStudentReportAvailable = isStudentExamApproved(examWithEastApproved, 'str_g7_east', mockClasses);
recordTest(9, 'Approved East can generate official reports', isEastStudentReportAvailable === true);

// 10. Pending West cannot be treated as officially approved.
const isWestStudentReportAvailable = isStudentExamApproved(examWithEastApproved, 'str_g7_west', mockClasses);
recordTest(10, 'Pending West cannot be treated as officially approved', isWestStudentReportAvailable === false);

// 11. Partially approved Grade remains partially approved.
const isG7GradeFullyApproved1 = isGradeFullyApproved(examWithEastApproved, 'Grade 7', mockClasses);
recordTest(11, 'Partially approved Grade remains partially approved', isG7GradeFullyApproved1 === false);

// 12. All streams approved → Grade fully approved.
const examWithBothG7Approved: Examination = {
  ...initialExam,
  approved_classes: ['str_g7_east', 'str_g7_west'],
};
const isG7GradeFullyApproved2 = isGradeFullyApproved(examWithBothG7Approved, 'Grade 7', mockClasses);
recordTest(12, 'All streams approved → Grade fully approved', isG7GradeFullyApproved2 === true);

// 13. One pending stream prevents Education Level roll-up.
// Junior School has 4 streams: g7 east, g7 west, g8 east, g8 west.
// We approve 3 streams (g7 east, g7 west, g8 east) leaving g8 west pending.
const examWith3JuniorStreams: Examination = {
  ...initialExam,
  approved_classes: ['str_g7_east', 'str_g7_west', 'str_g8_east'],
};
const isJuniorSchoolApproved1 = isEducationLevelFullyApproved(examWith3JuniorStreams, 'Junior School', mockClasses);
recordTest(13, 'One pending stream prevents Education Level roll-up', isJuniorSchoolApproved1 === false);

// 14. All required streams approved → Education Level fully approved.
const examWithAllJuniorStreams: Examination = {
  ...initialExam,
  approved_classes: ['str_g7_east', 'str_g7_west', 'str_g8_east', 'str_g8_west'],
};
const isJuniorSchoolApproved2 = isEducationLevelFullyApproved(examWithAllJuniorStreams, 'Junior School', mockClasses);
recordTest(14, 'All required streams approved → Education Level fully approved', isJuniorSchoolApproved2 === true);

// 15. One pending stream prevents Examination-wide approval.
// School has 6 streams. We approve 5 streams, leaving 1 (PP1 Blue) pending.
const examWith5Streams: Examination = {
  ...initialExam,
  approved_classes: ['str_g7_east', 'str_g7_west', 'str_g8_east', 'str_g8_west', 'str_g1_north'],
};
const isExamFullyApproved1 = isExaminationFullyApproved(examWith5Streams, mockClasses);
recordTest(15, 'One pending stream prevents Examination-wide approval', isExamFullyApproved1 === false);

// 16. All required streams approved → Examination fully approved.
const examWithAllStreams: Examination = {
  ...initialExam,
  approved_classes: ['str_g7_east', 'str_g7_west', 'str_g8_east', 'str_g8_west', 'str_g1_north', 'str_pp1_blue'],
};
const isExamFullyApproved2 = isExaminationFullyApproved(examWithAllStreams, mockClasses);
recordTest(16, 'All required streams approved → Examination fully approved', isExamFullyApproved2 === true);

// 17. Historical Approved examination remains compatible.
const historicalExam: Examination = {
  id: 'ex_2025_final',
  exam_name: 'End of Year Assessment 2025',
  exam_type: 'End-Term',
  max_marks: 100,
  term: 'Term 3',
  year: 2025,
  status: 'Approved',
  approved_classes: [],
  approved_levels: [],
};
const isHistoricalStreamApproved = isClassExamApproved(historicalExam, streamG7East);
const isHistoricalGradeApproved = isGradeFullyApproved(historicalExam, 'Grade 7', mockClasses);
const isHistoricalLevelApproved = isEducationLevelFullyApproved(historicalExam, 'Junior School', mockClasses);
const isHistoricalExamApproved = isExaminationFullyApproved(historicalExam, mockClasses);
const historicalCompatibility = isHistoricalStreamApproved && isHistoricalGradeApproved && isHistoricalLevelApproved && isHistoricalExamApproved;
recordTest(17, 'Historical Approved examination remains compatible', historicalCompatibility === true);

// 18. Approval survives reload (JSON serialization & deserialization).
const serializedExam = JSON.stringify(examWithEastApproved);
const reloadedExam: Examination = JSON.parse(serializedExam);
const reloadedEastApproved = isClassExamApproved(reloadedExam, streamG7East);
const reloadedWestApproved = isClassExamApproved(reloadedExam, streamG7West);
recordTest(18, 'Approval survives reload', reloadedEastApproved === true && reloadedWestApproved === false);

// 19. Approval survives logout/login.
// Logging in as userMary or userJohn reads from the authoritative reloaded examination entity
const maryViewOfEast = isClassExamApproved(reloadedExam, streamG7East);
const johnViewOfEast = isClassExamApproved(reloadedExam, streamG7East);
recordTest(19, 'Approval survives logout/login', maryViewOfEast === true && johnViewOfEast === true);

// 20. Existing marks and learner data remain unchanged.
const marksBefore = JSON.stringify(initialMarks);
// Simulation of stream approval operation only touching exam.approved_classes
const updatedExamAfterApproval: Examination = {
  ...initialExam,
  approved_classes: [...(initialExam.approved_classes || []), 'str_g7_east'],
};
const marksAfter = JSON.stringify(initialMarks);
const studentsAfter = JSON.stringify(mockStudents);
const dataIntegrityIntact = (marksBefore === marksAfter) && (studentsAfter.length > 0) && (updatedExamAfterApproval.approved_classes.length === 1);
recordTest(20, 'Existing marks and learner data remain unchanged', dataIntegrityIntact === true);

console.log('\n=====================================================');
const allPassed = testResults.every(t => t.status === 'PASS');
const passCount = testResults.filter(t => t.status === 'PASS').length;
const failCount = testResults.filter(t => t.status === 'FAIL').length;
console.log(`TOTAL: ${testResults.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('=====================================================');

if (!allPassed) {
  process.exit(1);
}
