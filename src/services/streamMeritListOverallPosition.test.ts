import { calculateExamResults, validateCalculationData } from './analysisEngine';
import { getFilteredStudents } from '../utils/filterUtils';
import { Student, Mark, Examination, Subject, ClassStream, Grade } from '../types';

console.log('=== RUNNING STREAM MERIT LIST OVERALL POSITION TESTS ===');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✓ PASS: ${msg}`);
    testsPassed++;
  } else {
    console.error(`✗ FAIL: ${msg}`);
    testsFailed++;
  }
}

// Setup test data
const mockExam: Examination = {
  id: 'exam-t3-2026',
  exam_name: 'Opener Assessment Term 3 2026',
  exam_type: 'Opener',
  term: 'Term 3',
  year: 2026,
  max_marks: 100,
  start_date: '2026-09-01',
  end_date: '2026-09-05',
  status: 'Approved',
};

const mockClasses: ClassStream[] = [
  { id: 'cls-g9', stream_id: 'str-blue', class_name: 'Grade 9', stream: 'Blue', education_level: 'Junior School' },
  { id: 'cls-g9', stream_id: 'str-red', class_name: 'Grade 9', stream: 'Red', education_level: 'Junior School' },
];

const mockSubjects: Subject[] = [
  { id: 'sub-eng', subject_code: 'ENG', subject_name: 'English', category: 'Core', education_level: 'Junior School' },
  { id: 'sub-kis', subject_code: 'KIS', subject_name: 'Kiswahili', category: 'Core', education_level: 'Junior School' },
  { id: 'sub-mat', subject_code: 'MAT', subject_name: 'Mathematics', category: 'Core', education_level: 'Junior School' },
];

const mockGrades: Grade[] = [
  { id: 'g-ee', grade_code: 'EE', descriptor: 'Exceeding Expectations', performance_level: 'EE', minimum_score: 80, maximum_score: 100, points: 4, remarks: 'Exceeding' },
  { id: 'g-me', grade_code: 'ME', descriptor: 'Meeting Expectations', performance_level: 'ME', minimum_score: 60, maximum_score: 79, points: 3, remarks: 'Meeting' },
  { id: 'g-ae', grade_code: 'AE', descriptor: 'Approaching Expectations', performance_level: 'AE', minimum_score: 40, maximum_score: 59, points: 2, remarks: 'Approaching' },
  { id: 'g-be', grade_code: 'BE', descriptor: 'Below Expectations', performance_level: 'BE', minimum_score: 0, maximum_score: 39, points: 1, remarks: 'Below' },
];

// 4 students in Blue, 4 students in Red (8 total in Grade 9)
const mockStudents: Student[] = [
  // Blue Stream
  { id: 's-blue-1', admission_number: 'ADM-B1', full_name: 'Faith Blue 1', gender: 'F', class_id: 'cls-g9', stream_id: 'str-blue', active: true, grade: 'Grade 9' },
  { id: 's-blue-2', admission_number: 'ADM-B2', full_name: 'Mercy Blue 2', gender: 'F', class_id: 'cls-g9', stream_id: 'str-blue', active: true, grade: 'Grade 9' },
  { id: 's-blue-3', admission_number: 'ADM-B3', full_name: 'Rey Blue 3', gender: 'M', class_id: 'cls-g9', stream_id: 'str-blue', active: true, grade: 'Grade 9' },
  { id: 's-blue-4', admission_number: 'ADM-B4', full_name: 'Liz Blue 4', gender: 'F', class_id: 'cls-g9', stream_id: 'str-blue', active: true, grade: 'Grade 9' },
  // Red Stream
  { id: 's-red-1', admission_number: 'ADM-R1', full_name: 'Tabitha Red 1', gender: 'F', class_id: 'cls-g9', stream_id: 'str-red', active: true, grade: 'Grade 9' },
  { id: 's-red-2', admission_number: 'ADM-R2', full_name: 'Diana Red 2', gender: 'F', class_id: 'cls-g9', stream_id: 'str-red', active: true, grade: 'Grade 9' },
  { id: 's-red-3', admission_number: 'ADM-R3', full_name: 'Esther Red 3', gender: 'F', class_id: 'cls-g9', stream_id: 'str-red', active: true, grade: 'Grade 9' },
  { id: 's-red-4', admission_number: 'ADM-R4', full_name: 'Grace Red 4', gender: 'F', class_id: 'cls-g9', stream_id: 'str-red', active: true, grade: 'Grade 9' },
];

// Marks distribution to verify competition rankings:
// Tabitha (Red 1): 95 + 95 + 95 = 285 (Overall #1)
// Faith (Blue 1): 90 + 90 + 90 = 270 (Stream Blue #1, Overall #2)
// Diana (Red 2): 85 + 85 + 85 = 255 (Stream Red #2, Overall #3)
// Mercy (Blue 2): 80 + 80 + 80 = 240 (Stream Blue #2, Overall #4)
// Esther (Red 3): 80 + 80 + 80 = 240 (Stream Red #3, Overall #4 - Tied with Mercy!)
// Rey (Blue 3): 75 + 75 + 75 = 225 (Stream Blue #3, Overall #6)
// Liz (Blue 4): 70 + 70 + 70 = 210 (Stream Blue #4, Overall #7)
// Grace (Red 4): 60 + 60 + 60 = 180 (Stream Red #4, Overall #8)

const mockMarks: Mark[] = [
  // Tabitha (285)
  { id: 'm1', exam_id: 'exam-t3-2026', student_id: 's-red-1', subject_id: 'sub-eng', score: 95, out_of: 100 },
  { id: 'm2', exam_id: 'exam-t3-2026', student_id: 's-red-1', subject_id: 'sub-kis', score: 95, out_of: 100 },
  { id: 'm3', exam_id: 'exam-t3-2026', student_id: 's-red-1', subject_id: 'sub-mat', score: 95, out_of: 100 },
  // Faith (270)
  { id: 'm4', exam_id: 'exam-t3-2026', student_id: 's-blue-1', subject_id: 'sub-eng', score: 90, out_of: 100 },
  { id: 'm5', exam_id: 'exam-t3-2026', student_id: 's-blue-1', subject_id: 'sub-kis', score: 90, out_of: 100 },
  { id: 'm6', exam_id: 'exam-t3-2026', student_id: 's-blue-1', subject_id: 'sub-mat', score: 90, out_of: 100 },
  // Diana (255)
  { id: 'm7', exam_id: 'exam-t3-2026', student_id: 's-red-2', subject_id: 'sub-eng', score: 85, out_of: 100 },
  { id: 'm8', exam_id: 'exam-t3-2026', student_id: 's-red-2', subject_id: 'sub-kis', score: 85, out_of: 100 },
  { id: 'm9', exam_id: 'exam-t3-2026', student_id: 's-red-2', subject_id: 'sub-mat', score: 85, out_of: 100 },
  // Mercy (240)
  { id: 'm10', exam_id: 'exam-t3-2026', student_id: 's-blue-2', subject_id: 'sub-eng', score: 80, out_of: 100 },
  { id: 'm11', exam_id: 'exam-t3-2026', student_id: 's-blue-2', subject_id: 'sub-kis', score: 80, out_of: 100 },
  { id: 'm12', exam_id: 'exam-t3-2026', student_id: 's-blue-2', subject_id: 'sub-mat', score: 80, out_of: 100 },
  // Esther (240)
  { id: 'm13', exam_id: 'exam-t3-2026', student_id: 's-red-3', subject_id: 'sub-eng', score: 80, out_of: 100 },
  { id: 'm14', exam_id: 'exam-t3-2026', student_id: 's-red-3', subject_id: 'sub-kis', score: 80, out_of: 100 },
  { id: 'm15', exam_id: 'exam-t3-2026', student_id: 's-red-3', subject_id: 'sub-mat', score: 80, out_of: 100 },
  // Rey (225)
  { id: 'm16', exam_id: 'exam-t3-2026', student_id: 's-blue-3', subject_id: 'sub-eng', score: 75, out_of: 100 },
  { id: 'm17', exam_id: 'exam-t3-2026', student_id: 's-blue-3', subject_id: 'sub-kis', score: 75, out_of: 100 },
  { id: 'm18', exam_id: 'exam-t3-2026', student_id: 's-blue-3', subject_id: 'sub-mat', score: 75, out_of: 100 },
  // Liz (210)
  { id: 'm19', exam_id: 'exam-t3-2026', student_id: 's-blue-4', subject_id: 'sub-eng', score: 70, out_of: 100 },
  { id: 'm20', exam_id: 'exam-t3-2026', student_id: 's-blue-4', subject_id: 'sub-kis', score: 70, out_of: 100 },
  { id: 'm21', exam_id: 'exam-t3-2026', student_id: 's-blue-4', subject_id: 'sub-mat', score: 70, out_of: 100 },
  // Grace (180)
  { id: 'm22', exam_id: 'exam-t3-2026', student_id: 's-red-4', subject_id: 'sub-eng', score: 60, out_of: 100 },
  { id: 'm23', exam_id: 'exam-t3-2026', student_id: 's-red-4', subject_id: 'sub-kis', score: 60, out_of: 100 },
  { id: 'm24', exam_id: 'exam-t3-2026', student_id: 's-red-4', subject_id: 'sub-mat', score: 60, out_of: 100 },
];

function testStreamMeritListOverallPosition() {
  const selectedClassId = 'cls-g9';
  const selectedStreamId = 'str-blue';

  const targetStudents = getFilteredStudents(mockStudents, mockClasses, selectedClassId, selectedStreamId, mockExam);
  assert(targetStudents.length === 4, 'Target students in Blue stream is 4');

  const classCohortStudents = (selectedClassId as string) !== 'all'
    ? getFilteredStudents(mockStudents, mockClasses, selectedClassId, 'all', mockExam)
    : mockStudents;
  assert(classCohortStudents.length === 8, 'Class cohort students across Grade 9 is 8');

  // Calculate results across full general class cohort
  const allCohortResults = calculateExamResults(mockExam.id, classCohortStudents, mockMarks, mockGrades, mockClasses, mockSubjects);
  assert(allCohortResults.length === 8, 'All cohort results has 8 learners');

  // Filter for Blue stream
  const targetStudentIdSet = new Set(targetStudents.map(s => s.id));
  const results = allCohortResults.filter(r => targetStudentIdSet.has(r.student_id));
  results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));

  assert(results.length === 4, 'Filtered stream results has 4 learners');

  const faithResult = results.find(r => r.student_id === 's-blue-1');
  const mercyResult = results.find(r => r.student_id === 's-blue-2');
  const reyResult = results.find(r => r.student_id === 's-blue-3');
  const lizResult = results.find(r => r.student_id === 's-blue-4');

  // Faith: #1 in Stream Blue, #2 in Grade 9 overall (Tabitha in Red is #1 with 285)
  assert(faithResult?.class_position === 1, `Faith STR POS is 1 (got ${faithResult?.class_position})`);
  assert(faithResult?.position === 2, `Faith OVR POS is 2 (got ${faithResult?.position})`);

  // Mercy: #2 in Stream Blue, tied #4 in Grade 9 overall (with Esther in Red)
  assert(mercyResult?.class_position === 2, `Mercy STR POS is 2 (got ${mercyResult?.class_position})`);
  assert(mercyResult?.position === 4, `Mercy OVR POS is 4 (got ${mercyResult?.position})`);

  // Rey: #3 in Stream Blue, #6 in Grade 9 overall
  assert(reyResult?.class_position === 3, `Rey STR POS is 3 (got ${reyResult?.class_position})`);
  assert(reyResult?.position === 6, `Rey OVR POS is 6 (got ${reyResult?.position})`);

  // Liz: #4 in Stream Blue, #7 in Grade 9 overall
  assert(lizResult?.class_position === 4, `Liz STR POS is 4 (got ${lizResult?.class_position})`);
  assert(lizResult?.position === 7, `Liz OVR POS is 7 (got ${lizResult?.position})`);

  // Verify denominator formatting
  const totalGeneralClassLearners = classCohortStudents.length;
  const faithOvrDisplay = `${faithResult?.position} of ${totalGeneralClassLearners}`;
  assert(faithOvrDisplay === '2 of 8', `Faith formatted OVR POS display is "2 of 8" (got "${faithOvrDisplay}")`);

  const faithStrDisplay = `${faithResult?.class_position} of ${targetStudents.length}`;
  assert(faithStrDisplay === '1 of 4', `Faith formatted STR POS display is "1 of 4" (got "${faithStrDisplay}")`);

  // Validation
  const validation = validateCalculationData(results, mockMarks, mockGrades, mockSubjects);
  assert(validation.isValid, 'Stream merit list calculation passes validation');
}

testStreamMeritListOverallPosition();

console.log(`==================================================`);
console.log(`STREAM MERIT LIST TESTS: ${testsPassed}/${testsPassed + testsFailed} PASSED`);
console.log(`==================================================`);

if (testsFailed > 0) {
  process.exit(1);
}
