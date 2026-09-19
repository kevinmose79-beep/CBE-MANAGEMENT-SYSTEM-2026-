import { getFilteredStudents } from '../utils/filterUtils';
import { Student, ClassStream, Examination } from '../types';

const mockClasses: ClassStream[] = [
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', capacity: 40, education_level: 'Junior School', status: 'Active' },
  { id: 'cls_8w', class_name: 'Grade 8', stream: 'West', capacity: 40, education_level: 'Junior School', status: 'Active' },
];

const mockStudents: Student[] = [
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
    stream_id: '',
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

const mockExam: Examination = {
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

// 1. Test ClassStream ID filtering
const res1 = getFilteredStudents(mockStudents, mockClasses, 'Grade 8', 'cls_8e', mockExam);
console.log('Test 1 (Grade 8 + cls_8e):', res1.length === 2 ? 'PASS' : 'FAIL', res1.map(s => s.id));

// 2. Test Stream Name filtering
const res2 = getFilteredStudents(mockStudents, mockClasses, 'Grade 8', 'East', mockExam);
console.log('Test 2 (Grade 8 + East):', res2.length === 2 ? 'PASS' : 'FAIL', res2.map(s => s.id));

// 3. Test All streams
const res3 = getFilteredStudents(mockStudents, mockClasses, 'Grade 8', 'all', mockExam);
console.log('Test 3 (Grade 8 + all):', res3.length === 3 ? 'PASS' : 'FAIL', res3.map(s => s.id));

if (res1.length === 2 && res2.length === 2 && res3.length === 3) {
  console.log('ALL AUDIT TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('SOME AUDIT TESTS FAILED!');
  process.exit(1);
}
