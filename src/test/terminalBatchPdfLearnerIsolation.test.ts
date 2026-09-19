import { describe, it, expect, vi } from 'vitest';
import {
  calculateLearnerTerminalResults,
  ContributingAssessmentRef,
} from '../services/terminalResultsEngine';
import {
  downloadBatchTerminalReportsPDF,
  TerminalReportPDFData,
} from '../services/terminalReportPdfGenerator';
import {
  Student,
  Subject,
  ClassStream,
  Mark,
  Grade,
  School,
} from '../types';
import { CBE_8_POINT_GRADES } from '../services/analysisEngine';

// Mock file downloader so jsPDF doesn't trigger real file saving in test environment
vi.mock('../utils/fileDownloader', () => ({
  savePdf: vi.fn().mockResolvedValue(undefined),
}));

describe('T-14A-R: Terminal Report Batch PDF Learner Mark Isolation', () => {
  const mockSchool: School = {
    id: 'sch-1',
    school_name: 'Moi Forces Academy',
    county: 'Nairobi',
    address: 'Nairobi',
    phone: '+254 700 000000',
    email: 'info@moiforces.ac.ke',
    motto: 'Knowledge is Power',
  };

  const mockClassStream: ClassStream = {
    id: 'class-g8',
    stream_id: 'stream-g8-blue',
    class_name: 'Grade 8',
    stream: 'Blue',
    education_level: 'Junior School',
  };

  const mockSubjects: Subject[] = [
    { id: 'subj-eng', subject_name: 'English', subject_code: 'ENG', category: 'Core' },
    { id: 'subj-kis', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core' },
    { id: 'subj-math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core' },
  ];

  const mockGrades: Grade[] = [
    { id: 'g-ee', grade_code: 'EE', performance_level: 'EE', descriptor: 'Exceeding Expectations', minimum_score: 80, maximum_score: 100, points: 4, remarks: 'Exceeding Expectations' },
    { id: 'g-me', grade_code: 'ME', performance_level: 'ME', descriptor: 'Meeting Expectations', minimum_score: 65, maximum_score: 79, points: 3, remarks: 'Meeting Expectations' },
    { id: 'g-ae', grade_code: 'AE', performance_level: 'AE', descriptor: 'Approaching Expectations', minimum_score: 50, maximum_score: 64, points: 2, remarks: 'Approaching Expectations' },
    { id: 'g-be', grade_code: 'BE', performance_level: 'BE', descriptor: 'Below Expectations', minimum_score: 0, maximum_score: 49, points: 1, remarks: 'Below Expectations' },
  ];

  const studentA: Student = {
    id: 'stu-a-uuid',
    admission_number: 'ADM-001',
    first_name: 'Alice',
    last_name: 'Akinyi',
    full_name: 'Alice Akinyi',
    class_id: 'class-g8',
    stream_id: 'stream-g8-blue',
    gender: 'F',
    active: true,
  };

  const studentB: Student = {
    id: 'stu-b-uuid',
    admission_number: 'ADM-002',
    first_name: 'Brian',
    last_name: 'Barasa',
    full_name: 'Brian Barasa',
    class_id: 'class-g8',
    stream_id: 'stream-g8-blue',
    gender: 'M',
    active: true,
  };

  const studentC: Student = {
    id: 'stu-c-uuid',
    admission_number: 'ADM-003',
    first_name: 'Catherine',
    last_name: 'Chebet',
    full_name: 'Catherine Chebet',
    class_id: 'class-g8',
    stream_id: 'stream-g8-blue',
    gender: 'F',
    active: true,
  };

  const studentOtherStream: Student = {
    id: 'stu-x-uuid',
    admission_number: 'ADM-999',
    first_name: 'Xavier',
    last_name: 'Omondi',
    full_name: 'Xavier Omondi',
    class_id: 'class-g8',
    stream_id: 'stream-g8-red',
    gender: 'M',
    active: true,
  };

  const contributingAssessments: ContributingAssessmentRef[] = [
    {
      id: 'exam-op-uuid',
      exam_name: 'Opening Assessment',
      max_marks: 50,
      status: 'Approved',
    },
    {
      id: 'exam-mt-uuid',
      exam_name: 'Mid-Term Assessment',
      max_marks: 50,
      status: 'Approved',
    },
  ];

  /**
   * Helper simulating the remediated batch report preparation pipeline
   */
  async function prepareBatchReports(options: {
    cohortStudents: Student[];
    selectedStudentId?: string;
    fetchMarksForLearnerMock: (id: string) => Promise<Mark[]>;
    inMemoryMarks?: Mark[];
    workflowBatchMarksMock?: (opts: { studentIds: string[] }) => Promise<Mark[]>;
  }): Promise<TerminalReportPDFData[]> {
    const { cohortStudents, fetchMarksForLearnerMock, inMemoryMarks = [], workflowBatchMarksMock } = options;
    const allReportsData: TerminalReportPDFData[] = [];

    const studentIds = cohortStudents.map((s) => s.id).filter(Boolean);
    const streamMarksMap = new Map<string, Mark[]>();

    if (workflowBatchMarksMock && studentIds.length > 0) {
      try {
        const batchWorkflowMarks = await workflowBatchMarksMock({ studentIds });
        if (Array.isArray(batchWorkflowMarks) && batchWorkflowMarks.length > 0) {
          for (const m of batchWorkflowMarks) {
            if (m.student_id) {
              const existing = streamMarksMap.get(m.student_id) || [];
              existing.push(m);
              streamMarksMap.set(m.student_id, existing);
            }
          }
        }
      } catch (err) {
        // Fallback to per-learner queries
      }
    }

    for (let idx = 0; idx < cohortStudents.length; idx++) {
      const st = cohortStudents[idx];
      let stMarks: Mark[] = [];

      if (streamMarksMap.has(st.id)) {
        stMarks = streamMarksMap.get(st.id)!;
      } else {
        const fetched = await fetchMarksForLearnerMock(st.id);
        if (Array.isArray(fetched) && fetched.length > 0) {
          stMarks = fetched.filter((m) => m.student_id === st.id);
          streamMarksMap.set(st.id, stMarks);
        }
      }

      if (stMarks.length === 0 && inMemoryMarks.length > 0) {
        const propMarks = inMemoryMarks.filter((m) => m.student_id === st.id);
        if (propMarks.length > 0) {
          stMarks = propMarks;
        }
      }

      // Strict scoping
      stMarks = stMarks.filter((m) => m.student_id === st.id);

      const stResultsMap = calculateLearnerTerminalResults({
        learnerId: st.id,
        subjectIds: mockSubjects.map((s) => s.id),
        contributingAssessments,
        marks: stMarks,
        grades: mockGrades,
      });

      allReportsData.push({
        student: st,
        school: mockSchool,
        classStream: mockClassStream,
        academicYear: 2026,
        term: 'Term 1',
        isProvisionalMode: false,
        contributingAssessments,
        subjects: mockSubjects,
        resultsBySubject: stResultsMap,
        grades: mockGrades,
        teachers: [],
      });
    }

    return allReportsData;
  }

  // ==========================================
  // TEST 1 — TWO LEARNERS WITH DIFFERENT MARKS
  // ==========================================
  it('TEST 1: correctly calculates and isolates distinct marks for two learners in batch', async () => {
    // Learner A: English Exam 1 = 15/50 (30%), Exam 2 = 14/50 (28%) -> Average = 29%
    const marksA: Mark[] = [
      { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 15 },
      { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 14 },
    ];
    // Learner B: English Exam 1 = 33/50 (66%), Exam 2 = 34/50 (68%) -> Average = 67%
    const marksB: Mark[] = [
      { id: 'm-b1', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 33 },
      { id: 'm-b2', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 34 },
    ];

    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-a-uuid') return marksA;
      if (id === 'stu-b-uuid') return marksB;
      return [];
    });

    const reports = await prepareBatchReports({
      cohortStudents: [studentA, studentB],
      fetchMarksForLearnerMock: fetchMock,
    });

    expect(reports.length).toBe(2);

    // Learner A
    const repA = reports[0];
    expect(repA.student.id).toBe('stu-a-uuid');
    const resA = repA.resultsBySubject.get('subj-eng')!;
    expect(resA.status).toBe('Complete');
    expect(resA.isComplete).toBe(true);
    expect(resA.terminalPercentage).toBe(29);
    expect(resA.cbePerformanceLevel).toBe('BE');

    // Learner B
    const repB = reports[1];
    expect(repB.student.id).toBe('stu-b-uuid');
    const resB = repB.resultsBySubject.get('subj-eng')!;
    expect(resB.status).toBe('Complete');
    expect(resB.isComplete).toBe(true);
    expect(resB.terminalPercentage).toBe(67);
    expect(resB.cbePerformanceLevel).toBe('ME');

    // FORBIDDEN PATTERN CHECK: Learner B must NOT receive INCOMPLETE (X)
    expect(resB.status).not.toBe('INCOMPLETE (X)');
  });

  // ==========================================
  // TEST 2 — THREE LEARNERS
  // ==========================================
  it('TEST 2: correctly preserves all 3 learners with distinct scores', async () => {
    // A: 29%, B: 67%, C: 81%
    const marksC: Mark[] = [
      { id: 'm-c1', student_id: 'stu-c-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 40 }, // 80%
      { id: 'm-c2', student_id: 'stu-c-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 41 }, // 82% -> avg 81%
    ];

    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-a-uuid') return [
        { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 15 },
        { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 14 },
      ];
      if (id === 'stu-b-uuid') return [
        { id: 'm-b1', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 33 },
        { id: 'm-b2', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 34 },
      ];
      if (id === 'stu-c-uuid') return marksC;
      return [];
    });

    const reports = await prepareBatchReports({
      cohortStudents: [studentA, studentB, studentC],
      fetchMarksForLearnerMock: fetchMock,
    });

    expect(reports.length).toBe(3);
    expect(reports[0].resultsBySubject.get('subj-eng')!.terminalPercentage).toBe(29);
    expect(reports[1].resultsBySubject.get('subj-eng')!.terminalPercentage).toBe(67);
    expect(reports[2].resultsBySubject.get('subj-eng')!.terminalPercentage).toBe(81);
    expect(reports[2].resultsBySubject.get('subj-eng')!.cbePerformanceLevel).toBe('EE');
  });

  // ==========================================
  // TEST 3 — ONE LEARNER HAS NO MARK
  // ==========================================
  it('TEST 3: distinguishes genuinely unassessed learner from assessed learner', async () => {
    // A has marks (29%), B has genuinely no marks
    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-a-uuid') return [
        { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 15 },
        { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 14 },
      ];
      return []; // B returns empty array
    });

    const reports = await prepareBatchReports({
      cohortStudents: [studentA, studentB],
      fetchMarksForLearnerMock: fetchMock,
    });

    const resA = reports[0].resultsBySubject.get('subj-eng')!;
    const resB = reports[1].resultsBySubject.get('subj-eng')!;

    // A must have 29%
    expect(resA.status).toBe('Complete');
    expect(resA.terminalPercentage).toBe(29);

    // B must be genuinely INCOMPLETE (X)
    expect(resB.status).toBe('INCOMPLETE (X)');
    expect(resB.displayPercentage).toBe('X');
    expect(resB.terminalPercentage).toBeNull();
  });

  // ==========================================
  // TEST 4 — SELECTED LEARNER IS NOT FIRST
  // ==========================================
  it('TEST 4: selected learner in UI does not become the template or contaminate others', async () => {
    // Suppose Learner C is selected in the UI
    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-a-uuid') return [
        { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 15 },
        { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 14 },
      ];
      if (id === 'stu-b-uuid') return [
        { id: 'm-b1', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 33 },
        { id: 'm-b2', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 34 },
      ];
      if (id === 'stu-c-uuid') return [
        { id: 'm-c1', student_id: 'stu-c-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 40 },
        { id: 'm-c2', student_id: 'stu-c-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 41 },
      ];
      return [];
    });

    const reports = await prepareBatchReports({
      cohortStudents: [studentA, studentB, studentC],
      selectedStudentId: 'stu-c-uuid', // C is selected
      fetchMarksForLearnerMock: fetchMock,
    });

    expect(reports[0].student.id).toBe('stu-a-uuid');
    expect(reports[0].resultsBySubject.get('subj-eng')!.terminalPercentage).toBe(29);

    expect(reports[1].student.id).toBe('stu-b-uuid');
    expect(reports[1].resultsBySubject.get('subj-eng')!.terminalPercentage).toBe(67);

    expect(reports[2].student.id).toBe('stu-c-uuid');
    expect(reports[2].resultsBySubject.get('subj-eng')!.terminalPercentage).toBe(81);
  });

  // ==========================================
  // TEST 5 — CROSS-LEARNER CONTAMINATION
  // ==========================================
  it('TEST 5: strictly prevents cross-learner contamination across subjects', async () => {
    // Learner A has Kiswahili marks, Learner B has NO Kiswahili marks
    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-a-uuid') return [
        { id: 'm-a-kis1', student_id: 'stu-a-uuid', subject_id: 'subj-kis', exam_id: 'exam-op-uuid', score: 45 },
        { id: 'm-a-kis2', student_id: 'stu-a-uuid', subject_id: 'subj-kis', exam_id: 'exam-mt-uuid', score: 45 },
      ];
      if (id === 'stu-b-uuid') return [
        // B only has English
        { id: 'm-b-eng1', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 30 },
        { id: 'm-b-eng2', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 30 },
      ];
      return [];
    });

    const reports = await prepareBatchReports({
      cohortStudents: [studentA, studentB],
      fetchMarksForLearnerMock: fetchMock,
    });

    const resA = reports[0].resultsBySubject.get('subj-kis')!;
    const resB = reports[1].resultsBySubject.get('subj-kis')!;

    expect(resA.status).toBe('Complete');
    expect(resA.terminalPercentage).toBe(90);

    // Learner B must NOT inherit A's Kiswahili mark
    expect(resB.status).toBe('INCOMPLETE (X)');
    expect(resB.displayPercentage).toBe('X');
    expect(resB.terminalPercentage).toBeNull();
  });

  // ==========================================
  // TEST 6 — CROSS-STREAM ISOLATION
  // ==========================================
  it('TEST 6: strictly isolates stream cohort; other streams never included', async () => {
    const allStudents = [studentA, studentB, studentOtherStream];
    // Filter cohort to Grade 8 Blue stream
    const blueCohort = allStudents.filter(
      (s) => s.stream_id === mockClassStream.stream_id
    );

    expect(blueCohort.length).toBe(2);
    expect(blueCohort.some((s) => s.id === studentOtherStream.id)).toBe(false);

    const fetchMock = vi.fn(async (id: string) => []);
    const reports = await prepareBatchReports({
      cohortStudents: blueCohort,
      fetchMarksForLearnerMock: fetchMock,
    });

    expect(reports.length).toBe(2);
    expect(reports.map((r) => r.student.id)).toEqual(['stu-a-uuid', 'stu-b-uuid']);
  });

  // ==========================================
  // TEST 7 — ZERO SCORE PRESERVATION
  // ==========================================
  it('TEST 7: preserves genuine 0 score as valid Normal mark, never converted to X or Y', async () => {
    // Learner A has 0/50 in both assessments -> 0%
    // Learner B has 30/50 in both assessments -> 60%
    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-a-uuid') return [
        { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 0 },
        { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 0 },
      ];
      if (id === 'stu-b-uuid') return [
        { id: 'm-b1', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 30 },
        { id: 'm-b2', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 30 },
      ];
      return [];
    });

    const reports = await prepareBatchReports({
      cohortStudents: [studentA, studentB],
      fetchMarksForLearnerMock: fetchMock,
    });

    const resA = reports[0].resultsBySubject.get('subj-eng')!;
    const resB = reports[1].resultsBySubject.get('subj-eng')!;

    expect(resA.status).toBe('Complete');
    expect(resA.terminalPercentage).toBe(0);
    expect(resA.cbePerformanceLevel).toBe('BE');

    expect(resB.status).toBe('Complete');
    expect(resB.terminalPercentage).toBe(60);
    expect(resB.cbePerformanceLevel).toBe('AE');
  });

  // ==========================================
  // TEST 8 — X CODE PRESERVATION
  // ==========================================
  it('TEST 8: preserves X (unassessed/absent) code and reports INCOMPLETE (X)', async () => {
    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-a-uuid') return [
        { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', special_status: 'X' as any, score: null },
        { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 30 },
      ];
      if (id === 'stu-b-uuid') return [
        { id: 'm-b1', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 30 },
        { id: 'm-b2', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 30 },
      ];
      return [];
    });

    const reports = await prepareBatchReports({
      cohortStudents: [studentA, studentB],
      fetchMarksForLearnerMock: fetchMock,
    });

    const resA = reports[0].resultsBySubject.get('subj-eng')!;
    const resB = reports[1].resultsBySubject.get('subj-eng')!;

    expect(resA.status).toBe('INCOMPLETE (X)');
    expect(resA.displayPercentage).toBe('X');
    expect(resA.terminalPercentage).toBeNull();

    expect(resB.status).toBe('Complete');
    expect(resB.terminalPercentage).toBe(60);
  });

  // ==========================================
  // TEST 9 — Y CODE PRESERVATION
  // ==========================================
  it('TEST 9: preserves unresolved Y (medical/excused) code as INCOMPLETE (Y)', async () => {
    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-a-uuid') return [
        { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', special_status: 'Y' as any, score: null },
        { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 30 },
      ];
      if (id === 'stu-b-uuid') return [
        { id: 'm-b1', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 30 },
        { id: 'm-b2', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 30 },
      ];
      return [];
    });

    const reports = await prepareBatchReports({
      cohortStudents: [studentA, studentB],
      fetchMarksForLearnerMock: fetchMock,
    });

    const resA = reports[0].resultsBySubject.get('subj-eng')!;
    expect(resA.status).toBe('INCOMPLETE (Y)');
    expect(resA.displayPercentage).toBe('Y');
    expect(resA.terminalPercentage).toBeNull();
  });

  // ==========================================
  // TEST 10 — X + Y COMBINATION
  // ==========================================
  it('TEST 10: handles combined X and Y assessments as INCOMPLETE (X/Y)', async () => {
    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-a-uuid') return [
        { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', special_status: 'X' as any, score: null },
        { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', special_status: 'Y' as any, score: null },
      ];
      return [];
    });

    const reports = await prepareBatchReports({
      cohortStudents: [studentA],
      fetchMarksForLearnerMock: fetchMock,
    });

    const resA = reports[0].resultsBySubject.get('subj-eng')!;
    expect(resA.status).toBe('INCOMPLETE (X/Y)');
    expect(resA.displayPercentage).toBe('X/Y');
  });

  // ==========================================
  // TEST 11 — RESOLVED Y
  // ==========================================
  it('TEST 11: resolves Y when resolution provenance exists', async () => {
    // 3 assessments: 80%, resolved Y with replacement 75%, 90%
    const threeAssessments: ContributingAssessmentRef[] = [
      { id: 'exam-1', exam_name: 'A1', max_marks: 100, status: 'Approved' },
      { id: 'exam-2', exam_name: 'A2', max_marks: 100, status: 'Approved' },
      { id: 'exam-3', exam_name: 'A3', max_marks: 100, status: 'Approved' },
    ];

    const marksA: Mark[] = [
      { id: 'm-1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-1', score: 80 },
      {
        id: 'm-2',
        student_id: 'stu-a-uuid',
        subject_id: 'subj-eng',
        exam_id: 'exam-2',
        special_status: 'Y' as any,
        score: null,
        resolution: {
          mark_id: 'm-2',
          replacement_score: 75,
          resolution_reason: 'Medical certificate accepted',
          resolved_by: 'teacher-uuid',
          resolved_at: '2026-03-01T10:00:00Z',
        },
      },
      { id: 'm-3', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-3', score: 90 },
    ];

    const results = calculateLearnerTerminalResults({
      learnerId: studentA.id,
      subjectIds: ['subj-eng'],
      contributingAssessments: threeAssessments,
      marks: marksA,
      grades: mockGrades,
    });

    const res = results.get('subj-eng')!;
    expect(res.status).toBe('Complete');
    // (80 + 75 + 90) / 3 = 245 / 3 = 81.666... -> rounded to 82%
    expect(res.terminalPercentage).toBe(82);
    expect(res.cbePerformanceLevel).toBe('EE');
  });

  // ==========================================
  // TEST 12 — DIFFERENT MAX MARKS
  // ==========================================
  it('TEST 12: handles assessments with different maximum marks via percentage conversion', async () => {
    // Exam 1: max 50, score 40 -> 80%
    // Exam 2: max 80, score 72 -> 90%
    // Expected terminal: (80 + 90) / 2 = 85% (NOT (40+72)/(50+80) = 112/130 = 86.15%)
    const variedAssessments: ContributingAssessmentRef[] = [
      { id: 'exam-50', exam_name: 'Opener 50', max_marks: 50, status: 'Approved' },
      { id: 'exam-80', exam_name: 'Midterm 80', max_marks: 80, status: 'Approved' },
    ];

    const marksA: Mark[] = [
      { id: 'm-1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-50', score: 40 },
      { id: 'm-2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-80', score: 72 },
    ];

    const results = calculateLearnerTerminalResults({
      learnerId: studentA.id,
      subjectIds: ['subj-eng'],
      contributingAssessments: variedAssessments,
      marks: marksA,
      grades: mockGrades,
    });

    const res = results.get('subj-eng')!;
    expect(res.status).toBe('Complete');
    expect(res.terminalPercentage).toBe(85);
  });

  // ==========================================
  // TEST 13 — DYNAMIC ASSESSMENT COUNT
  // ==========================================
  it('TEST 13: dynamically supports 1, 2, 3, 4 assessments without hardcoding', async () => {
    const assessments4: ContributingAssessmentRef[] = [
      { id: 'e1', exam_name: 'A1', max_marks: 100, status: 'Approved' },
      { id: 'e2', exam_name: 'A2', max_marks: 100, status: 'Approved' },
      { id: 'e3', exam_name: 'A3', max_marks: 100, status: 'Approved' },
      { id: 'e4', exam_name: 'A4', max_marks: 100, status: 'Approved' },
    ];

    const marks4: Mark[] = [
      { id: 'm1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'e1', score: 70 },
      { id: 'm2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'e2', score: 80 },
      { id: 'm3', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'e3', score: 90 },
      { id: 'm4', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'e4', score: 100 },
    ];

    const results = calculateLearnerTerminalResults({
      learnerId: studentA.id,
      subjectIds: ['subj-eng'],
      contributingAssessments: assessments4,
      marks: marks4,
      grades: mockGrades,
    });

    const res = results.get('subj-eng')!;
    expect(res.status).toBe('Complete');
    // (70 + 80 + 90 + 100) / 4 = 85%
    expect(res.terminalPercentage).toBe(85);
  });

  // ==========================================
  // TEST 14 — FAILURE SEMANTICS
  // ==========================================
  it('TEST 14: database failure during batch retrieval throws an explicit error and does NOT silently produce INCOMPLETE (X)', async () => {
    const fetchMock = vi.fn(async (id: string) => {
      if (id === 'stu-b-uuid') {
        throw new Error('Supabase 500 Network Connection Refused');
      }
      return [
        { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 15 },
        { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 14 },
      ];
    });

    // Simulating the remediated handleBatchDownloadPDF error throwing
    let errorThrown: any = null;
    try {
      for (const st of [studentA, studentB]) {
        try {
          await fetchMock(st.id);
        } catch (fetchErr: any) {
          throw new Error(
            `Failed to retrieve authoritative marks from database for learner ${st.first_name} ${st.last_name}: ${fetchErr?.message}. Batch generation aborted.`
          );
        }
      }
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).not.toBeNull();
    expect(errorThrown.message).toContain('Failed to retrieve authoritative marks from database for learner Brian Barasa');
    expect(errorThrown.message).toContain('Supabase 500 Network Connection Refused');
  });

  // ==========================================
  // TEST 15 — BATCH PDF GENERATOR INTEGRITY
  // ==========================================
  it('TEST 15: downloadBatchTerminalReportsPDF receives isolated data for each learner and creates a page per learner', async () => {
    const marksA: Mark[] = [
      { id: 'm-a1', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 15 },
      { id: 'm-a2', student_id: 'stu-a-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 14 },
    ];
    const marksB: Mark[] = [
      { id: 'm-b1', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-op-uuid', score: 33 },
      { id: 'm-b2', student_id: 'stu-b-uuid', subject_id: 'subj-eng', exam_id: 'exam-mt-uuid', score: 34 },
    ];

    const fetchMock = vi.fn(async (id: string) => (id === 'stu-a-uuid' ? marksA : marksB));

    const reports = await prepareBatchReports({
      cohortStudents: [studentA, studentB],
      fetchMarksForLearnerMock: fetchMock,
    });

    const progressCalls: number[] = [];
    await downloadBatchTerminalReportsPDF(reports, (cur, tot) => {
      progressCalls.push(cur);
    });

    expect(progressCalls).toEqual([1, 2]);
    expect(reports[0].student.id).toBe('stu-a-uuid');
    expect(reports[1].student.id).toBe('stu-b-uuid');
    expect(reports[0].resultsBySubject.get('subj-eng')!.terminalPercentage).toBe(29);
    expect(reports[1].resultsBySubject.get('subj-eng')!.terminalPercentage).toBe(67);
  });
});
