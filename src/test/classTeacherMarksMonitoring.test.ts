import { describe, it, expect } from 'vitest';
import {
  User,
  Teacher,
  ClassStream,
  Student,
  Subject,
  Examination,
  Mark,
  getAllocatedSubjectsForClass,
} from '../types';
import {
  getActiveTeacher,
  getAccessiblePrimaryClasses,
} from '../utils/rbacUtils';
import { evaluateMark } from '../utils/markUtils';
import { ROLE_ALLOWED_TABS } from '../App';

describe('Class Teacher Assessment Marks Monitoring Module Verification', () => {
  // Test Data Fixtures
  const teacherEast: Teacher = {
    id: 'tch_east_01',
    user_id: 'usr_ct_east',
    teacher_name: 'Mrs. Joyce Kemunto',
    email: 'joyce@school.com',
    phone: '0712345678',
    is_class_teacher: true,
    class_teacher_of_id: 'stream_g7_east',
    allocations: [
      {
        id: 'alloc_01',
        education_level: 'Junior School',
        class_id: 'cls_grade_7_east',
        class_name: 'Grade 7',
        stream: 'East',
        stream_id: 'stream_g7_east',
        subject_id: 'sub_mat',
        subject_code: 'MAT',
        subject_name: 'Mathematics',
      },
    ],
  };

  const userEast: User = {
    id: 'usr_ct_east',
    username: 'joyce_ct',
    name: 'Mrs. Joyce Kemunto',
    email: 'joyce@school.com',
    role: 'class_teacher',
  };

  const userSubjectTeacher: User = {
    id: 'usr_st_chem',
    username: 'john_st',
    name: 'Mr. John Maina',
    email: 'john@school.com',
    role: 'subject_teacher',
  };

  const classes: ClassStream[] = [
    {
      id: 'cls_grade_7_east',
      class_name: 'Grade 7',
      stream: 'East',
      stream_id: 'stream_g7_east',
      class_teacher_id: 'tch_east_01',
      allocated_subject_ids: ['sub_mat', 'sub_eng', 'sub_sci'],
    },
    {
      id: 'cls_grade_7_north',
      class_name: 'Grade 7',
      stream: 'North',
      stream_id: 'stream_g7_north',
      class_teacher_id: 'tch_north_02',
      allocated_subject_ids: ['sub_mat', 'sub_eng', 'sub_sci'],
    },
  ];

  const subjects: Subject[] = [
    { id: 'sub_mat', subject_name: 'Mathematics', subject_code: 'MAT', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_sci', subject_name: 'Integrated Science', subject_code: 'SCI', category: 'Core', education_level: 'Junior School' },
    { id: 'sub_french', subject_name: 'French', subject_code: 'FRE', category: 'Elective', education_level: 'Junior School' },
  ];

  const students: Student[] = [
    {
      id: 'std_east_01',
      admission_number: '1001',
      full_name: 'Brian Kiprono',
      gender: 'M',
      active: true,
      class_id: 'cls_grade_7_east',
      stream_id: 'stream_g7_east',
      grade: 'Grade 7',
    },
    {
      id: 'std_east_02',
      admission_number: '1002',
      full_name: 'Faith Moraa',
      gender: 'F',
      active: true,
      class_id: 'cls_grade_7_east',
      stream_id: 'stream_g7_east',
      grade: 'Grade 7',
    },
    // Sibling stream student
    {
      id: 'std_north_01',
      admission_number: '2001',
      full_name: 'Kevin Ochieng',
      gender: 'M',
      active: true,
      class_id: 'cls_grade_7_north',
      stream_id: 'stream_g7_north',
      grade: 'Grade 7',
    },
  ];

  const exam: Examination = {
    id: 'exam_midterm_2026',
    exam_name: 'Mid-Term Exam',
    term: 'Term 2',
    year: 2026,
    max_marks: 100,
    exam_type: 'Mid-Term',
    status: 'Draft',
  };

  it('1. RBAC: Strictly allows class-marks-monitoring for class_teacher and denies subject_teacher', () => {
    expect(ROLE_ALLOWED_TABS.class_teacher).toContain('class-marks-monitoring');
    expect(ROLE_ALLOWED_TABS.subject_teacher).not.toContain('class-marks-monitoring');
  });

  it('2. Scope Isolation: Resolves ONLY assigned class stream for Class Teacher', () => {
    const activeTch = getActiveTeacher(userEast, [teacherEast]);
    expect(activeTch?.id).toBe('tch_east_01');

    const primaryClasses = getAccessiblePrimaryClasses(userEast, activeTch, classes);
    expect(primaryClasses.length).toBe(1);
    expect(primaryClasses[0].stream_id).toBe('stream_g7_east');
    expect(primaryClasses[0].stream).toBe('East');

    // Filter students by stream_id
    const scopedStudents = students.filter((s) => s.stream_id === primaryClasses[0].stream_id);
    expect(scopedStudents.length).toBe(2);
    expect(scopedStudents.map((s) => s.admission_number)).toEqual(['1001', '1002']);

    // Sibling stream student Kevin Ochieng (North) MUST NOT be present
    expect(scopedStudents.some((s) => s.admission_number === '2001')).toBe(false);
  });

  it('3. Subject Resolution: Resolves only applicable subjects for the stream', () => {
    const activeClass = classes[0];
    const streamSubjects = getAllocatedSubjectsForClass(activeClass, subjects);
    expect(streamSubjects.map((s) => s.id)).toEqual(['sub_eng', 'sub_mat', 'sub_sci']);
    expect(streamSubjects.some((s) => s.id === 'sub_french')).toBe(false);
  });

  it('4. Mark Evaluation: Numeric 0 is a VALID completed mark, not missing', () => {
    const markZero: Mark = {
      id: 'm_01',
      student_id: 'std_east_01',
      subject_id: 'sub_mat',
      exam_id: 'exam_midterm_2026',
      marks: 0,
      raw_score: 0,
      out_of: 100,
    };

    const evalResult = evaluateMark(markZero);
    expect(evalResult.status).toBe('Normal');
    expect(evalResult.rawScore).toBe(0);
    expect(evalResult.percentage).toBe(0);
    expect(evalResult.displayScore).toBe('0');
  });

  it('5. Mark Evaluation: X is Absent, Y is Irregularity, and null is Blank/Missing', () => {
    const markX: Mark = {
      id: 'm_x',
      student_id: 'std_east_01',
      subject_id: 'sub_eng',
      exam_id: 'exam_midterm_2026',
      marks: 0,
      special_status: 'X',
    };

    const evalX = evaluateMark(markX);
    expect(evalX.status).toBe('X');
    expect(evalX.displayStatus).toContain('Missing Mark');

    const markY: Mark = {
      id: 'm_y',
      student_id: 'std_east_02',
      subject_id: 'sub_sci',
      exam_id: 'exam_midterm_2026',
      marks: 0,
      special_status: 'Y',
      irregularity_reason: 'Medical Absence',
    };

    const evalY = evaluateMark(markY);
    expect(evalY.status).toBe('Y');
    expect(evalY.irregularityReason).toBe('Medical Absence');

    const evalBlank = evaluateMark(null);
    expect(evalBlank.status).toBe('Blank');
  });

  it('6. Subject Name & Code Resolution: handles standard subject_name and subject_code schema safely', () => {
    const testSub: Subject = {
      id: 'sub_test_geo',
      subject_name: 'Geography',
      subject_code: 'GEO',
      category: 'Core',
    };

    const subCode =
      testSub.subject_code ||
      (testSub as any).code ||
      (testSub.subject_name ? testSub.subject_name.substring(0, 3).toUpperCase() : 'SUB');
    const subName = testSub.subject_name || (testSub as any).name || 'Subject';

    expect(subCode).toBe('GEO');
    expect(subName).toBe('Geography');

    // Test with missing subject_code falling back to substring of subject_name safely
    const testSubNoCode: Subject = {
      id: 'sub_test_his',
      subject_name: 'History',
      subject_code: '',
      category: 'Core',
    };

    const fallbackCode =
      testSubNoCode.subject_code ||
      (testSubNoCode as any).code ||
      (testSubNoCode.subject_name ? testSubNoCode.subject_name.substring(0, 3).toUpperCase() : 'SUB');
    expect(fallbackCode).toBe('HIS');
  });

  it('7. Needs Attention Filtering: Learner with missing mark requires attention; X/Y/score 0 do not count as missing', () => {
    // Student 1: All marks present (including numeric 0 and X)
    const marksStudent1 = [
      evaluateMark({ id: 'm1', student_id: 'std1', subject_id: 'sub_mat', marks: 0, exam_id: 'exam1' }), // Normal (0)
      evaluateMark({ id: 'm2', student_id: 'std1', subject_id: 'sub_eng', marks: 0, special_status: 'X', exam_id: 'exam1' }), // Absent (X)
      evaluateMark({ id: 'm3', student_id: 'std1', subject_id: 'sub_sci', marks: 0, special_status: 'Y', exam_id: 'exam1' }), // Irregularity (Y)
    ];

    const missingCountStd1 = marksStudent1.filter((m) => m.status === 'Blank').length;
    expect(missingCountStd1).toBe(0);

    // Student 2: Has a missing (Blank) mark
    const marksStudent2 = [
      evaluateMark({ id: 'm4', student_id: 'std2', subject_id: 'sub_mat', marks: 75, exam_id: 'exam1' }),
      evaluateMark(null), // Blank / Missing
      evaluateMark({ id: 'm6', student_id: 'std2', subject_id: 'sub_sci', marks: 80, exam_id: 'exam1' }),
    ];

    const missingCountStd2 = marksStudent2.filter((m) => m.status === 'Blank').length;
    expect(missingCountStd2).toBe(1);

    // Needs Attention rule: missingCount > 0
    expect(missingCountStd1 > 0).toBe(false); // Student 1 does not require missing mark attention
    expect(missingCountStd2 > 0).toBe(true); // Student 2 requires attention
  });
});
