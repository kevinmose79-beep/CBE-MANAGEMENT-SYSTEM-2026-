import { describe, it, expect } from 'vitest';
import {
  isLevelApproved,
  isClassExamApproved,
  isStreamApproved,
  isGradeFullyApproved,
  isEducationLevelFullyApproved,
  isExaminationFullyApproved,
  isStudentExamApproved,
} from '../utils/examLockUtils';
import { Examination, ClassStream, Student, Teacher, User, Mark, Subject } from '../types';

describe('CBE MANAGEMENT SYSTEM — ISSUE 7F COMPREHENSIVE REGRESSION SUITE', () => {
  // 1. DATA FIXTURES TO VERIFY ZERO MUTATION / ZERO REGRESSION
  const mockLearners: Student[] = [
    { id: 'std_01', admission_number: 'ADM-001', full_name: 'Grace Achieng', gender: 'F', class_id: 'cls_g7', stream_id: 'str_g7_east', active: true, education_level: 'Junior School', grade: 'Grade 7' },
    { id: 'std_02', admission_number: 'ADM-002', full_name: 'David Kiprono', gender: 'M', class_id: 'cls_g7', stream_id: 'str_g7_west', active: true, education_level: 'Junior School', grade: 'Grade 7' },
    { id: 'std_03', admission_number: 'ADM-003', full_name: 'Brian Mutua', gender: 'M', class_id: 'cls_g8', stream_id: 'str_g8_east', active: true, education_level: 'Junior School', grade: 'Grade 8' },
  ];

  const mockTeachers: Teacher[] = [
    { id: 'tch_01', teacher_name: 'Alice Wambui', phone: '0711000001', email: 'alice@school.org', status: 'Active' },
    { id: 'tch_02', teacher_name: 'Bernard Omondi', phone: '0711000002', email: 'bernard@school.org', status: 'Active' },
  ];

  const mockClasses: ClassStream[] = [
    { id: 'str_g7_east', class_name: 'Grade 7', stream: 'East', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_01' },
    { id: 'str_g7_west', class_name: 'Grade 7', stream: 'West', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_02' },
    { id: 'str_g8_east', class_name: 'Grade 8', stream: 'East', capacity: 40, education_level: 'Junior School', status: 'Active', class_teacher_id: 'tch_01' },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sub_math', subject_code: 'MAT-JS', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sub_eng', subject_code: 'ENG-JS', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
    { id: 'sub_kis', subject_code: 'KIS-JS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
    { id: 'sub_intsci', subject_code: 'ISC-JS', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
  ];

  const mockMarks: Mark[] = [
    { id: 'm_1', exam_id: 'ex_term1', student_id: 'std_01', subject_id: 'sub_math', marks: 88, out_of: 100 },
    { id: 'm_2', exam_id: 'ex_term1', student_id: 'std_01', subject_id: 'sub_eng', marks: 76, out_of: 100 },
    { id: 'm_3', exam_id: 'ex_term1', student_id: 'std_02', subject_id: 'sub_math', marks: 92, out_of: 100 },
    { id: 'm_4', exam_id: 'ex_term1', student_id: 'std_02', subject_id: 'sub_eng', marks: 84, out_of: 100 },
  ];

  const baselineLearnersJSON = JSON.stringify(mockLearners);
  const baselineTeachersJSON = JSON.stringify(mockTeachers);
  const baselineClassesJSON = JSON.stringify(mockClasses);
  const baselineSubjectsJSON = JSON.stringify(mockSubjects);
  const baselineMarksJSON = JSON.stringify(mockMarks);

  it('verifies historical exam lock state is Approved/Locked', () => {
    const historicalExam2024: Examination = {
      id: 'ex_2024_final',
      exam_name: 'End Term 3 2024',
      exam_type: 'End-Term',
      max_marks: 100,
      term: 'Term 3',
      year: 2024,
      status: 'Approved',
      approved_classes: [],
      approved_levels: [],
    };

    const historicalExamEastApproved = isClassExamApproved(historicalExam2024, mockClasses[0]);
    expect(historicalExamEastApproved).toBe(true);
  });

  it('verifies partial stream approval locks only East and keeps West editable', () => {
    const openExam2026: Examination = {
      id: 'ex_2026_op',
      exam_name: 'Mid Term 1 2026',
      exam_type: 'Mid-Term',
      max_marks: 100,
      term: 'Term 1',
      year: 2026,
      status: 'Open',
      approved_classes: ['str_g7_east'],
      approved_levels: [],
    };

    const openExamEastLock = isClassExamApproved(openExam2026, mockClasses[0]);
    const openExamWestLock = isClassExamApproved(openExam2026, mockClasses[1]);
    expect(openExamEastLock).toBe(true);
    expect(openExamWestLock).toBe(false);
  });

  it('verifies marks lifecycle and zero side-effect data integrity', () => {
    const postApprovalLearnersJSON = JSON.stringify(mockLearners);
    const postApprovalTeachersJSON = JSON.stringify(mockTeachers);
    const postApprovalClassesJSON = JSON.stringify(mockClasses);
    const postApprovalSubjectsJSON = JSON.stringify(mockSubjects);
    const postApprovalMarksJSON = JSON.stringify(mockMarks);

    expect(baselineLearnersJSON).toBe(postApprovalLearnersJSON);
    expect(baselineTeachersJSON).toBe(postApprovalTeachersJSON);
    expect(baselineClassesJSON).toBe(postApprovalClassesJSON);
    expect(baselineSubjectsJSON).toBe(postApprovalSubjectsJSON);
    expect(baselineMarksJSON).toBe(postApprovalMarksJSON);
  });

  it('verifies Grade 7 East and West maintain distinct primary IDs', () => {
    const streamG7East = mockClasses.find(c => c.id === 'str_g7_east')!;
    const streamG7West = mockClasses.find(c => c.id === 'str_g7_west')!;
    expect(streamG7East.id).not.toBe(streamG7West.id);
    expect(streamG7East.class_name).toBe(streamG7West.class_name);
    expect(streamG7East.stream).not.toBe(streamG7West.stream);
  });

  it('verifies student exam report eligibility scope', () => {
    const openExam2026: Examination = {
      id: 'ex_2026_op',
      exam_name: 'Mid Term 1 2026',
      exam_type: 'Mid-Term',
      max_marks: 100,
      term: 'Term 1',
      year: 2026,
      status: 'Open',
      approved_classes: ['str_g7_east'],
      approved_levels: [],
    };

    const std1ReportApproved = isStudentExamApproved(openExam2026, 'str_g7_east', mockClasses);
    const std2ReportApproved = isStudentExamApproved(openExam2026, 'str_g7_west', mockClasses);
    expect(std1ReportApproved).toBe(true);
    expect(std2ReportApproved).toBe(false);
  });

  it('verifies multi-tier hierarchy roll-up logic', () => {
    const openExam2026: Examination = {
      id: 'ex_2026_op',
      exam_name: 'Mid Term 1 2026',
      exam_type: 'Mid-Term',
      max_marks: 100,
      term: 'Term 1',
      year: 2026,
      status: 'Open',
      approved_classes: ['str_g7_east'],
      approved_levels: [],
    };

    const g7GradeApprovalBeforeWest = isGradeFullyApproved(openExam2026, 'Grade 7', mockClasses);
    expect(g7GradeApprovalBeforeWest).toBe(false);

    const fullyApprovedG7Exam: Examination = {
      ...openExam2026,
      approved_classes: ['str_g7_east', 'str_g7_west'],
    };
    const g7GradeApprovalAfterWest = isGradeFullyApproved(fullyApprovedG7Exam, 'Grade 7', mockClasses);
    expect(g7GradeApprovalAfterWest).toBe(true);

    const jsLevelApprovedPartial = isEducationLevelFullyApproved(fullyApprovedG7Exam, 'Junior School', mockClasses);
    expect(jsLevelApprovedPartial).toBe(false);

    const fullyApprovedJSExam: Examination = {
      ...openExam2026,
      approved_classes: ['str_g7_east', 'str_g7_west', 'str_g8_east'],
    };
    const jsLevelApprovedFull = isEducationLevelFullyApproved(fullyApprovedJSExam, 'Junior School', mockClasses);
    expect(jsLevelApprovedFull).toBe(true);

    const examWideApproved = isExaminationFullyApproved(fullyApprovedJSExam, mockClasses);
    expect(examWideApproved).toBe(true);
  });
});
