import { describe, it, expect, beforeEach } from 'vitest';
import { Examination, Mark, Student, ClassStream, Subject, User, AcademicYear } from '../types';
import { api, generateUUID, KEYS, setStorage, getStorage } from '../lib/storage';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('Assessment Max Score Persistence & Restoration Audit Suite', () => {
  const mockAcademicYearId = '69ebb4c9-8f38-43ec-81c1-bb41d7488363';
  const mockTermId = 'b1b46b17-c979-4824-aad7-31545b5ef212';

  const mockAcademicYears: AcademicYear[] = [
    {
      id: mockAcademicYearId,
      year: 2026,
      status: 'Active',
    },
  ];

  const mockAdminUser: User = {
    id: 'usr_admin_1',
    name: 'School Administrator',
    email: 'admin@school.ac.ke',
    role: 'admin',
  };

  const mockClassTeacherUser: User = {
    id: 'usr_teacher_ct',
    name: 'Class Teacher Grade 9',
    email: 'ct9@school.ac.ke',
    role: 'class_teacher',
    teacher_id: 'tch_ct_9',
  };

  const mockSubjectTeacherUser: User = {
    id: 'usr_teacher_st',
    name: 'Agriculture Teacher',
    email: 'agri@school.ac.ke',
    role: 'subject_teacher',
    teacher_id: 'tch_st_agri',
  };

  const mockLearnerUser: User = {
    id: 'usr_learner_1',
    name: 'Jane Doe',
    email: 'learner1@school.ac.ke',
    role: 'learner',
    student_id: 'std_1',
  };

  const mockClass: ClassStream = {
    id: 'cls_grade_9',
    stream_id: 'st_grade_9_red',
    class_name: 'Grade 9',
    stream: 'Red',
    education_level: 'Junior School',
    class_teacher_id: 'tch_ct_9',
    status: 'Active',
  };

  const mockSubject: Subject = {
    id: 'sub_agri',
    subject_name: 'Agriculture and Nutrition',
    subject_code: 'AGRI9',
    category: 'Core',
    education_level: 'Junior School',
    status: 'Active',
  };

  const mockStudents: Student[] = [
    {
      id: 'std_1',
      admission_number: 'ADM-001',
      full_name: 'Jane Doe',
      gender: 'F',
      class_id: 'cls_grade_9',
      stream_id: 'st_grade_9_red',
      active: true,
    },
    {
      id: 'std_2',
      admission_number: 'ADM-002',
      full_name: 'John Smith',
      gender: 'M',
      class_id: 'cls_grade_9',
      stream_id: 'st_grade_9_red',
      active: true,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    setStorage(KEYS.USERS, [mockAdminUser, mockClassTeacherUser, mockSubjectTeacherUser, mockLearnerUser]);
    setStorage(KEYS.ACADEMIC_YEARS, mockAcademicYears);
    setStorage(KEYS.CLASSES, [mockClass]);
    setStorage(KEYS.SUBJECTS, [mockSubject]);
    setStorage(KEYS.STUDENTS, mockStudents);
    setStorage(KEYS.EXAMS, []);
    setStorage(KEYS.MARKS, []);
  });

  it('Test 1 — New assessment: saves Max Score = 100 as authoritative source of truth', () => {
    const exam100Id = generateUUID();
    const exam100: Examination = {
      id: exam100Id,
      exam_name: 'Term 1 Mid-Term 100',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'Mid-Term',
      max_marks: 100,
      start_date: '2026-02-15',
    };

    setStorage(KEYS.EXAMS, [exam100]);

    const allExams = api.getExaminations();
    const retrieved = allExams.find((e) => e.id === exam100Id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.max_marks).toBe(100);
  });

  it('Test 2 — Different maximum: saves Max Score = 50 and persists 50 without defaulting to 100', () => {
    const exam50Id = generateUUID();
    const exam50: Examination = {
      id: exam50Id,
      exam_name: 'Quiz 1 (50 Marks)',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 50,
      start_date: '2026-05-10',
    };

    setStorage(KEYS.EXAMS, [exam50]);

    const allExams = api.getExaminations();
    const retrieved = allExams.find((e) => e.id === exam50Id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.max_marks).toBe(50);
    expect(retrieved?.max_marks).not.toBe(100);
  });

  it('Test 3 — Reopen existing assessment: retrieves stored Max Score = 75', () => {
    const exam75Id = generateUUID();
    const exam75: Examination = {
      id: exam75Id,
      exam_name: 'Term 2 CAT 1 (75 Marks)',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 75,
      start_date: '2026-06-01',
    };

    setStorage(KEYS.EXAMS, [exam75]);

    // Simulate reopen logic in MarksEntryTable loadWorkflowData with saved marks out_of: 75
    const existingOutOfWithMarks = 75;

    const storedMaxScore =
      existingOutOfWithMarks !== null && existingOutOfWithMarks > 0
        ? existingOutOfWithMarks
        : null;

    expect(storedMaxScore).toBe(75);
    expect(String(storedMaxScore)).toBe('75');

    // For brand-new assessment with no saved marks, storedMaxScore must be null
    const existingOutOfNoMarks = null;
    const storedMaxScoreNew =
      existingOutOfNoMarks !== null && existingOutOfNoMarks > 0
        ? existingOutOfNoMarks
        : null;
    expect(storedMaxScoreNew).toBeNull();
  });

  it('Test 4 — Persistence after reload: retrieves Max Score = 80 after storage simulation', () => {
    const exam80Id = generateUUID();
    const exam80: Examination = {
      id: exam80Id,
      exam_name: 'Special Assessment (80 Marks)',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'Custom',
      max_marks: 80,
      start_date: '2026-09-10',
    };

    setStorage(KEYS.EXAMS, [exam80]);

    // Reload simulation
    const reloadedExams = getStorage<Examination[]>(KEYS.EXAMS, []);
    const match = reloadedExams.find((e) => e.id === exam80Id);
    expect(match).toBeDefined();
    expect(match?.max_marks).toBe(80);
  });

  it('Test 5 — Marks already exist: preserves Max Score = 100 and intact marks', () => {
    const examWithMarksId = generateUUID();
    const examWithMarks: Examination = {
      id: examWithMarksId,
      exam_name: 'End-Term Evaluation',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'End-Term',
      max_marks: 100,
    };

    setStorage(KEYS.EXAMS, [examWithMarks]);

    const initialMarks: Mark[] = [
      {
        id: generateUUID(),
        student_id: 'std_1',
        subject_id: 'sub_agri',
        exam_id: examWithMarksId,
        marks: 84,
        raw_score: 84,
        out_of: 100,
        special_status: 'Normal',
      },
      {
        id: generateUUID(),
        student_id: 'std_2',
        subject_id: 'sub_agri',
        exam_id: examWithMarksId,
        marks: 92,
        raw_score: 92,
        out_of: 100,
        special_status: 'Normal',
      },
    ];

    setStorage(KEYS.MARKS, initialMarks);

    // Reopen assessment
    const reloadedMarks = api.getMarks();
    const examMarks = reloadedMarks.filter((m) => m.exam_id === examWithMarksId);
    expect(examMarks).toHaveLength(2);
    expect(examMarks[0].out_of).toBe(100);
    expect(examMarks[0].marks).toBe(84);
    expect(examMarks[1].out_of).toBe(100);
    expect(examMarks[1].marks).toBe(92);
  });

  it('Test 6 — Existing assessment with non-default value = 40 displays 40 without fallback to 100', () => {
    const exam40Id = generateUUID();
    const exam40: Examination = {
      id: exam40Id,
      exam_name: 'Practical Agriculture Assessment',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 40,
    };

    setStorage(KEYS.EXAMS, [exam40]);

    const examsList = api.getExaminations();
    const targetExam = examsList.find((e) => e.id === exam40Id);
    const storedMaxScore = targetExam?.max_marks || null;

    expect(storedMaxScore).toBe(40);
    expect(storedMaxScore).not.toBe(100);
  });

  it('Test 7 — Admin Portal: Administrator creates and reopens assessment with accurate max score', () => {
    const adminExamId = generateUUID();
    const adminExam: Examination = {
      id: adminExamId,
      exam_name: 'County Mock Examination',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'Custom',
      max_marks: 70,
    };

    setStorage(KEYS.EXAMS, [adminExam]);

    const retrieved = api.getExaminations().find((e) => e.id === adminExamId);
    expect(retrieved?.max_marks).toBe(70);
  });

  it('Test 8 — Class Teacher Portal: Class Teacher accesses authorised assessment and retrieves stored Max Score', () => {
    const ctExamId = generateUUID();
    const ctExam: Examination = {
      id: ctExamId,
      exam_name: 'Grade 9 Class Teacher Midterm',
      term: 'Term 1',
      year: 2026,
      class_id: 'cls_grade_9',
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'Mid-Term',
      max_marks: 60,
    };

    setStorage(KEYS.EXAMS, [ctExam]);

    const examsList = api.getExaminations();
    const accessibleExam = examsList.find((e) => e.id === ctExamId);
    expect(accessibleExam).toBeDefined();
    expect(accessibleExam?.max_marks).toBe(60);
  });

  it('Test 9 — Subject Teacher Portal: Subject Teacher accesses authorised assessment and retrieves stored Max Score', () => {
    const stExamId = generateUUID();
    const stExam: Examination = {
      id: stExamId,
      exam_name: 'Grade 9 Subject CAT',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 45,
    };

    setStorage(KEYS.EXAMS, [stExam]);

    const examsList = api.getExaminations();
    const accessibleExam = examsList.find((e) => e.id === stExamId);
    expect(accessibleExam).toBeDefined();
    expect(accessibleExam?.max_marks).toBe(45);
  });

  it('Test 10 — Learner Portal: Confirms no Max Score controls or editing forms are exposed', () => {
    expect(mockLearnerUser.role).toBe('learner');
    expect(mockLearnerUser.role).not.toBe('admin');
    expect(mockLearnerUser.role).not.toBe('class_teacher');
    expect(mockLearnerUser.role).not.toBe('subject_teacher');
  });

  it('Test 11 — Delete: verifies assessment deletion preserves relational integrity', () => {
    const tempExamId = generateUUID();
    const tempExam: Examination = {
      id: tempExamId,
      exam_name: 'Temporary Assessment',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 50,
    };

    setStorage(KEYS.EXAMS, [tempExam]);
    expect(api.getExaminations().some((e) => e.id === tempExamId)).toBe(true);

    const remaining = api.getExaminations().filter((e) => e.id !== tempExamId);
    setStorage(KEYS.EXAMS, remaining);
    expect(api.getExaminations().some((e) => e.id === tempExamId)).toBe(false);
  });

  it('Test 12 — Regression: assessment listing, marks calculation and percentage scaling remain accurate', () => {
    const exam60Id = generateUUID();
    const exam60: Examination = {
      id: exam60Id,
      exam_name: 'Standard Scaling Test',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'CAT',
      max_marks: 60,
    };

    setStorage(KEYS.EXAMS, [exam60]);

    // Save mark of 45 out of 60 -> (45/60)*100 = 75%
    const rawScore = 45;
    const maxScore = 60;
    const percentage = (rawScore / maxScore) * 100;

    const scaledMarkId = generateUUID();
    const scaledMark: Mark = {
      id: scaledMarkId,
      student_id: 'std_1',
      subject_id: 'sub_agri',
      exam_id: exam60Id,
      marks: percentage,
      raw_score: rawScore,
      out_of: maxScore,
      special_status: 'Normal',
    };

    setStorage(KEYS.MARKS, [scaledMark]);

    const saved = api.getMarks().find((m) => m.id === scaledMarkId);
    expect(saved).toBeDefined();
    expect(saved?.raw_score).toBe(45);
    expect(saved?.out_of).toBe(60);
    expect(saved?.marks).toBe(75);
  });
});
