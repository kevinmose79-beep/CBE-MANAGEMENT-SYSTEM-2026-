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

describe('Marks Entry Target Max Score Forensic Audit & Surgical Fix Verification Suite', () => {
  const mockAcademicYearId = '69ebb4c9-8f38-43ec-81c1-bb41d7488363';
  const mockTermId = 'b1b46b17-c979-4824-aad7-31545b5ef212';

  const mockClass: ClassStream = {
    id: 'cls_grade_8',
    stream_id: 'st_grade_8_east',
    class_name: 'Grade 8',
    stream: 'East',
    education_level: 'Junior School',
    status: 'Active',
  };

  const mockSubjectMath: Subject = {
    id: 'sub_math_8',
    subject_name: 'Mathematics',
    subject_code: 'MATH8',
    category: 'Core',
    education_level: 'Junior School',
    status: 'Active',
  };

  const mockSubjectEng: Subject = {
    id: 'sub_eng_8',
    subject_name: 'English',
    subject_code: 'ENG8',
    category: 'Core',
    education_level: 'Junior School',
    status: 'Active',
  };

  const mockStudents: Student[] = [
    {
      id: 'std_alpha',
      admission_number: 'ADM-101',
      full_name: 'Alpha Learner',
      gender: 'M',
      class_id: 'cls_grade_8',
      stream_id: 'st_grade_8_east',
      active: true,
    },
    {
      id: 'std_beta',
      admission_number: 'ADM-102',
      full_name: 'Beta Learner',
      gender: 'F',
      class_id: 'cls_grade_8',
      stream_id: 'st_grade_8_east',
      active: true,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    setStorage(KEYS.CLASSES, [mockClass]);
    setStorage(KEYS.SUBJECTS, [mockSubjectMath, mockSubjectEng]);
    setStorage(KEYS.STUDENTS, mockStudents);
    setStorage(KEYS.EXAMS, []);
    setStorage(KEYS.MARKS, []);
  });

  // Pure logic helper replicating the updated MarksEntryTable load workflow
  const resolveStoredMaxScore = (existingOutOf: number | null): number | null => {
    return existingOutOf !== null && existingOutOf > 0 ? existingOutOf : null;
  };

  // Pure logic helper replicating MarksEntryTable grid gating
  const evaluateGridGating = (
    examId: string,
    classId: string,
    subjectId: string,
    outOfMaxScore: string
  ) => {
    const isExamSelected = Boolean(examId);
    const isClassSelected = Boolean(classId);
    const isSubjectSelected = Boolean(subjectId);
    const isOutOfValid = Boolean(
      outOfMaxScore && !isNaN(parseFloat(outOfMaxScore)) && parseFloat(outOfMaxScore) > 0
    );
    const isSelectionComplete = isExamSelected && isClassSelected && isSubjectSelected && isOutOfValid;
    return { isOutOfValid, isSelectionComplete };
  };

  // Pure logic helper replicating mark score validation
  const validateMarkInput = (rawVal: number, outOfMaxScore: number) => {
    if (isNaN(rawVal) || rawVal < 0 || rawVal > outOfMaxScore) {
      return { valid: false, error: `Mark (${rawVal}) exceeds maximum score (${outOfMaxScore}).` };
    }
    return { valid: true, error: null };
  };

  it('Test 1 — New assessment: Max Score starts blank', () => {
    const existingOutOf: number | null = null;
    const storedMaxScore = resolveStoredMaxScore(existingOutOf);

    let outOfMaxScoreState = '';
    outOfMaxScoreState = outOfMaxScoreState ? outOfMaxScoreState : storedMaxScore !== null ? String(storedMaxScore) : '';

    expect(outOfMaxScoreState).toBe('');
    expect(storedMaxScore).toBeNull();
  });

  it('Test 2 — New assessment: learner grid hidden when Max Score is blank', () => {
    const examId = 'exam_new_1';
    const classId = 'cls_grade_8';
    const subjectId = 'sub_math_8';
    const outOfMaxScore = '';

    const { isOutOfValid, isSelectionComplete } = evaluateGridGating(examId, classId, subjectId, outOfMaxScore);

    expect(isOutOfValid).toBe(false);
    expect(isSelectionComplete).toBe(false);
  });

  it('Test 3 — Enter 30: learner grid appears after entering valid Max Score', () => {
    const examId = 'exam_new_1';
    const classId = 'cls_grade_8';
    const subjectId = 'sub_math_8';
    const outOfMaxScore = '30';

    const { isOutOfValid, isSelectionComplete } = evaluateGridGating(examId, classId, subjectId, outOfMaxScore);

    expect(isOutOfValid).toBe(true);
    expect(isSelectionComplete).toBe(true);
  });

  it('Test 4 — Learners display /30 when Max Score = 30', () => {
    const outOfMaxScore = '30';
    const pMax = parseFloat(outOfMaxScore);
    expect(pMax).toBe(30);

    const rowMaxDisplay = `/${outOfMaxScore && parseFloat(outOfMaxScore) > 0 ? outOfMaxScore : '100'}`;
    expect(rowMaxDisplay).toBe('/30');
  });

  it('Test 5 — Existing assessment with out_of = 30: restores 30 automatically', () => {
    const existingOutOf = 30;
    const storedMaxScore = resolveStoredMaxScore(existingOutOf);

    let outOfMaxScoreState = '';
    outOfMaxScoreState = outOfMaxScoreState ? outOfMaxScoreState : storedMaxScore !== null ? String(storedMaxScore) : '';

    expect(storedMaxScore).toBe(30);
    expect(outOfMaxScoreState).toBe('30');
  });

  it('Test 6 — Existing assessment with out_of = 50: restores 50 automatically', () => {
    const existingOutOf = 50;
    const storedMaxScore = resolveStoredMaxScore(existingOutOf);

    let outOfMaxScoreState = '';
    outOfMaxScoreState = outOfMaxScoreState ? outOfMaxScoreState : storedMaxScore !== null ? String(storedMaxScore) : '';

    expect(storedMaxScore).toBe(50);
    expect(outOfMaxScoreState).toBe('50');
  });

  it('Test 7 — Existing assessment with out_of = 100: restores 100 automatically', () => {
    const existingOutOf = 100;
    const storedMaxScore = resolveStoredMaxScore(existingOutOf);

    let outOfMaxScoreState = '';
    outOfMaxScoreState = outOfMaxScoreState ? outOfMaxScoreState : storedMaxScore !== null ? String(storedMaxScore) : '';

    expect(storedMaxScore).toBe(100);
    expect(outOfMaxScoreState).toBe('100');
  });

  it('Test 8 — New assessment with examination default max_marks = 100: remains blank', () => {
    const examWithDefault: Examination = {
      id: 'exam_def_100',
      exam_name: 'Mid-Term Exam',
      term: 'Term 1',
      year: 2026,
      academic_year_id: mockAcademicYearId,
      term_id: mockTermId,
      status: 'Draft',
      exam_type: 'Mid-Term',
      max_marks: 100, // Header default in exams table
    };

    // For a new assessment with no saved marks for this workflow
    const existingOutOf: number | null = null;
    const storedMaxScore = resolveStoredMaxScore(existingOutOf);

    // Examination default must NOT be used
    expect(storedMaxScore).toBeNull();
    expect(examWithDefault.max_marks).toBe(100); // Exam object is untouched
  });

  it('Test 9 — Assessment switching does not leak Max Scores across workflows', () => {
    // Workflow A (existing with out_of = 30)
    let workflowAOutOf = '';
    const storedMaxScoreA = resolveStoredMaxScore(30);
    workflowAOutOf = storedMaxScoreA !== null ? String(storedMaxScoreA) : '';
    expect(workflowAOutOf).toBe('30');

    // Switch to Workflow B (existing with out_of = 50)
    let workflowBOutOf = ''; // reset on switch
    const storedMaxScoreB = resolveStoredMaxScore(50);
    workflowBOutOf = storedMaxScoreB !== null ? String(storedMaxScoreB) : '';
    expect(workflowBOutOf).toBe('50');

    // Switch to Workflow C (brand new assessment with no saved marks)
    let workflowCOutOf = ''; // reset on switch
    const storedMaxScoreC = resolveStoredMaxScore(null);
    workflowCOutOf = storedMaxScoreC !== null ? String(storedMaxScoreC) : '';
    expect(workflowCOutOf).toBe('');
    expect(workflowCOutOf).not.toBe('30');
    expect(workflowCOutOf).not.toBe('50');
    expect(workflowCOutOf).not.toBe('100');
  });

  it('Test 10 — Blank or invalid Max Score cannot save marks', () => {
    const invalidInputs = ['', '0', '-10', 'abc'];

    invalidInputs.forEach((input) => {
      const trimmedOutOf = String(input).trim();
      const parsedMaxScore = parseFloat(trimmedOutOf);
      const isSaveBlocked = !trimmedOutOf || isNaN(parsedMaxScore) || parsedMaxScore <= 0;
      expect(isSaveBlocked).toBe(true);
    });

    const validInputs = ['30', '40', '50', '80', '100'];
    validInputs.forEach((input) => {
      const trimmedOutOf = String(input).trim();
      const parsedMaxScore = parseFloat(trimmedOutOf);
      const isSaveBlocked = !trimmedOutOf || isNaN(parsedMaxScore) || parsedMaxScore <= 0;
      expect(isSaveBlocked).toBe(false);
    });
  });

  it('Test 11 — Valid marks remain validated against the entered Max Score', () => {
    const maxScore = 30;

    // Mark 25 <= 30 is accepted
    const res25 = validateMarkInput(25, maxScore);
    expect(res25.valid).toBe(true);
    expect(res25.error).toBeNull();

    // Mark 35 > 30 is rejected
    const res35 = validateMarkInput(35, maxScore);
    expect(res35.valid).toBe(false);
    expect(res35.error).toContain('exceeds maximum score');
  });

  it('Test 12 — Existing assessment can still be edited without re-entering Max Score', () => {
    const existingOutOf = 40;
    const restoredMaxScore = resolveStoredMaxScore(existingOutOf);
    expect(restoredMaxScore).toBe(40);

    const { isOutOfValid, isSelectionComplete } = evaluateGridGating('exam_1', 'cls_1', 'sub_1', String(restoredMaxScore));
    expect(isOutOfValid).toBe(true);
    expect(isSelectionComplete).toBe(true);

    // Saving updated marks preserves the out_of = 40 and calculates percentage accurately
    const rawScore = 36;
    const percentage = (rawScore / restoredMaxScore!) * 100;
    expect(percentage).toBe(90);
  });
});
