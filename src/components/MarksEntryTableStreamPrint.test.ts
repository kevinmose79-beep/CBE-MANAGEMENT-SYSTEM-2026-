import { getFilteredStudents } from '../utils/filterUtils';
import { Student, ClassStream, Examination } from '../types';

const classes: ClassStream[] = [
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', capacity: 40, education_level: 'Junior School', status: 'Active' },
  { id: 'cls_8w', class_name: 'Grade 8', stream: 'West', capacity: 40, education_level: 'Junior School', status: 'Active' },
];

const students: Student[] = [
  {
    id: 'std_09',
    admission_number: 'ADM-2024-009',
    full_name: 'Cynthia Mbao',
    gender: 'F',
    class_id: 'cls_8e',
    stream_id: 'cls_8e',
    active: true,
    education_level: 'Junior School',
    grade: 'Grade 8',
  },
  {
    id: 'std_10',
    admission_number: 'ADM-2024-010',
    full_name: 'Victor Kiptoo',
    gender: 'M',
    class_id: 'cls_8e',
    stream_id: 'cls_8e',
    active: true,
    education_level: 'Junior School',
    grade: 'Grade 8',
  },
  {
    id: 'std_11',
    admission_number: 'ADM-2024-011',
    full_name: 'David Wekesa',
    gender: 'M',
    class_id: 'cls_8w',
    stream_id: 'cls_8w',
    active: true,
    education_level: 'Junior School',
    grade: 'Grade 8',
  },
];

const exam: Examination = {
  id: 'ex_01',
  exam_name: 'Opener 1',
  exam_type: 'CAT',
  term: 'Term 2',
  year: 2026,
  class_id: 'cls_8e',
  status: 'Draft',
  max_marks: 100,
  start_date: '2026-05-10',
};

// Test when keying in marks for Grade 8 East (cls_8e)
const selectedClassId = 'cls_8e';
const selectedClassObj = classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId);

const classIdParam = selectedClassObj ? selectedClassObj.class_name : selectedClassId;
const streamIdParam = selectedClassObj ? selectedClassObj.id : selectedClassId;

const filteredCohort = getFilteredStudents(students, classes, classIdParam, streamIdParam, exam);

console.log('Filtered Cohort Length:', filteredCohort.length);
console.log('Filtered Student IDs:', filteredCohort.map((s) => s.id));

if (filteredCohort.length === 2 && !filteredCohort.some((s) => s.id === 'std_11')) {
  console.log('✓ PASS: Print Performance PDF in marks entry grid is strictly restricted to Grade 8 East stream');
} else {
  console.error('✗ FAIL: Cohort was not strictly restricted to Grade 8 East stream');
  process.exit(1);
}
