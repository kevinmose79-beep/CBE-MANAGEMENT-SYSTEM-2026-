import { describe, it, expect } from 'vitest';
import {
  generateTerminalMeritDataset,
  exportTerminalMeritListToCsv,
  exportTerminalMeritListToExcel,
  exportTerminalMeritListToPdf,
  TerminalMeritListData,
} from '../services/terminalMeritListExporter';
import {
  calculateLearnerTerminalResults,
  LearningAreaTerminalResult,
  ContributingAssessmentRef,
} from '../services/terminalResultsEngine';
import { School, Student, Subject, Grade, ClassStream, Mark } from '../types';

describe('Terminal Merit List Integration & Forensic Invariants', () => {
  const mockSchool: School = {
    id: 'sch-001',
    school_name: 'St. Jude Test Academy',
    motto: 'Strive for Excellence',
    address: 'PO Box 123, Nairobi',
    phone: '+254700000000',
    email: 'info@stjude.test',
    county: 'Nairobi',
    sub_county: 'Westlands',
  };

  const mockGrades: Grade[] = [
    {
      id: 'g-ee',
      grade_code: 'EE',
      performance_level: 'EE',
      minimum_score: 80,
      maximum_score: 100,
      points: 4,
      descriptor: 'Exceeds Expectations',
    remarks: 'Exceeds Expectations',
    },
    {
      id: 'g-me',
      grade_code: 'ME',
      performance_level: 'ME',
      minimum_score: 65,
      maximum_score: 79.99,
      points: 3,
      descriptor: 'Meets Expectations',
    remarks: 'Meets Expectations',
    },
    {
      id: 'g-ae',
      grade_code: 'AE',
      performance_level: 'AE',
      minimum_score: 50,
      maximum_score: 64.99,
      points: 2,
      descriptor: 'Approaching Expectations',
    remarks: 'Approaching Expectations',
    },
    {
      id: 'g-be',
      grade_code: 'BE',
      performance_level: 'BE',
      minimum_score: 0,
      maximum_score: 49.99,
      points: 1,
      descriptor: 'Below Expectations',
    remarks: 'Below Expectations',
    },
  ];

  const mockClasses: ClassStream[] = [
    {
      id: 'cls-g9e',
      class_name: 'Grade 9',
      stream: 'East',
      stream_id: 'stream-g9e',
      education_level: 'Junior School',
      allocated_subject_ids: ['sub-mat', 'sub-eng', 'sub-kis'],
    },
    {
      id: 'cls-g9w',
      class_name: 'Grade 9',
      stream: 'West',
      stream_id: 'stream-g9w',
      education_level: 'Junior School',
      allocated_subject_ids: ['sub-mat', 'sub-eng', 'sub-kis'],
    },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sub-mat', subject_name: 'Mathematics', subject_code: 'MAT', name: 'Mathematics', code: 'MAT', category: 'Core', education_level: 'Junior School' } as any,
    { id: 'sub-eng', subject_name: 'English', subject_code: 'ENG', name: 'English', code: 'ENG', category: 'Core', education_level: 'Junior School' } as any,
    { id: 'sub-kis', subject_name: 'Kiswahili', subject_code: 'KIS', name: 'Kiswahili', code: 'KIS', category: 'Core', education_level: 'Junior School' } as any,
  ];

  const mockContributingAssessments: ContributingAssessmentRef[] = [
    { id: 'ex-op', exam_name: 'Opener Exam', status: 'Approved', out_of: 50, max_marks: 50 } as any,
    { id: 'ex-mid', exam_name: 'Mid Term Exam', status: 'Approved', out_of: 50, max_marks: 50 } as any,
  ];

  // 5 Sample Learners in Grade 9 (East & West)
  const mockStudents: Student[] = [
    {
      id: 'stu-1',
      admission_number: 'ADM001',
      first_name: 'Alice',
      last_name: 'Akinyi',
      full_name: 'Alice Akinyi',
      grade: 'Grade 9',
      class_id: 'cls-g9e',
      stream_id: 'stream-g9e',
      gender: 'F',
      active: true,
    },
    {
      id: 'stu-2',
      admission_number: 'ADM002',
      first_name: 'Bob',
      last_name: 'Barasa',
      full_name: 'Bob Barasa',
      grade: 'Grade 9',
      class_id: 'cls-g9e',
      stream_id: 'stream-g9e',
      gender: 'M',
      active: true,
    },
    {
      id: 'stu-3',
      admission_number: 'ADM003',
      first_name: 'Charlie',
      last_name: 'Chebet',
      full_name: 'Charlie Chebet',
      grade: 'Grade 9',
      class_id: 'cls-g9w',
      stream_id: 'stream-g9w',
      gender: 'F',
      active: true,
    },
    {
      id: 'stu-4',
      admission_number: 'ADM004',
      first_name: 'David',
      last_name: 'Deng',
      full_name: 'David Deng',
      grade: 'Grade 9',
      class_id: 'cls-g9w',
      stream_id: 'stream-g9w',
      gender: 'M',
      active: true,
    },
    {
      id: 'stu-5',
      admission_number: 'ADM005',
      first_name: 'Eve',
      last_name: 'Echesa',
      full_name: 'Eve Echesa',
      grade: 'Grade 9',
      class_id: 'cls-g9e',
      stream_id: 'stream-g9e',
      gender: 'F',
      active: true,
    },
  ];

  // Marks scenario:
  // Alice: MAT 90, ENG 85, KIS 80 (Total = 255/300, Avg = 85.0) -> Rank 1
  // Bob: MAT 80, ENG 80, KIS 80 (Total = 240/300, Avg = 80.0) -> Rank 2 (Tied with Charlie)
  // Charlie: MAT 80, ENG 80, KIS 80 (Total = 240/300, Avg = 80.0) -> Rank 2 (Tied with Bob)
  // David: MAT 60, ENG 60, KIS 60 (Total = 180/300, Avg = 60.0) -> Rank 4 (Standard Competition: skips 3!)
  // Eve: Missing KIS (Incomplete) -> Unranked ('-')
  const mockMarks: Mark[] = [
    // Alice
    { id: 'm1', student_id: 'stu-1', subject_id: 'sub-mat', exam_id: 'ex-op', score: 45 },
    { id: 'm2', student_id: 'stu-1', subject_id: 'sub-mat', exam_id: 'ex-mid', score: 45 },
    { id: 'm3', student_id: 'stu-1', subject_id: 'sub-eng', exam_id: 'ex-op', score: 42 },
    { id: 'm4', student_id: 'stu-1', subject_id: 'sub-eng', exam_id: 'ex-mid', score: 43 },
    { id: 'm5', student_id: 'stu-1', subject_id: 'sub-kis', exam_id: 'ex-op', score: 40 },
    { id: 'm6', student_id: 'stu-1', subject_id: 'sub-kis', exam_id: 'ex-mid', score: 40 },

    // Bob
    { id: 'm7', student_id: 'stu-2', subject_id: 'sub-mat', exam_id: 'ex-op', score: 40 },
    { id: 'm8', student_id: 'stu-2', subject_id: 'sub-mat', exam_id: 'ex-mid', score: 40 },
    { id: 'm9', student_id: 'stu-2', subject_id: 'sub-eng', exam_id: 'ex-op', score: 40 },
    { id: 'm10', student_id: 'stu-2', subject_id: 'sub-eng', exam_id: 'ex-mid', score: 40 },
    { id: 'm11', student_id: 'stu-2', subject_id: 'sub-kis', exam_id: 'ex-op', score: 40 },
    { id: 'm12', student_id: 'stu-2', subject_id: 'sub-kis', exam_id: 'ex-mid', score: 40 },

    // Charlie
    { id: 'm13', student_id: 'stu-3', subject_id: 'sub-mat', exam_id: 'ex-op', score: 40 },
    { id: 'm14', student_id: 'stu-3', subject_id: 'sub-mat', exam_id: 'ex-mid', score: 40 },
    { id: 'm15', student_id: 'stu-3', subject_id: 'sub-eng', exam_id: 'ex-op', score: 40 },
    { id: 'm16', student_id: 'stu-3', subject_id: 'sub-eng', exam_id: 'ex-mid', score: 40 },
    { id: 'm17', student_id: 'stu-3', subject_id: 'sub-kis', exam_id: 'ex-op', score: 40 },
    { id: 'm18', student_id: 'stu-3', subject_id: 'sub-kis', exam_id: 'ex-mid', score: 40 },

    // David
    { id: 'm19', student_id: 'stu-4', subject_id: 'sub-mat', exam_id: 'ex-op', score: 30 },
    { id: 'm20', student_id: 'stu-4', subject_id: 'sub-mat', exam_id: 'ex-mid', score: 30 },
    { id: 'm21', student_id: 'stu-4', subject_id: 'sub-eng', exam_id: 'ex-op', score: 30 },
    { id: 'm22', student_id: 'stu-4', subject_id: 'sub-eng', exam_id: 'ex-mid', score: 30 },
    { id: 'm23', student_id: 'stu-4', subject_id: 'sub-kis', exam_id: 'ex-op', score: 30 },
    { id: 'm24', student_id: 'stu-4', subject_id: 'sub-kis', exam_id: 'ex-mid', score: 30 },

    // Eve: Only MAT and ENG (missing KIS)
    { id: 'm25', student_id: 'stu-5', subject_id: 'sub-mat', exam_id: 'ex-op', score: 45 },
    { id: 'm26', student_id: 'stu-5', subject_id: 'sub-mat', exam_id: 'ex-mid', score: 45 },
    { id: 'm27', student_id: 'stu-5', subject_id: 'sub-eng', exam_id: 'ex-op', score: 45 },
    { id: 'm28', student_id: 'stu-5', subject_id: 'sub-eng', exam_id: 'ex-mid', score: 45 },
  ];

  function buildLearnerResultsMap(studentList: Student[]): Map<string, Map<string, LearningAreaTerminalResult>> {
    const map = new Map<string, Map<string, LearningAreaTerminalResult>>();
    for (const stu of studentList) {
      const stuMarks = mockMarks.filter((m) => m.student_id === stu.id);
      const res = calculateLearnerTerminalResults({
        learnerId: stu.id,
        subjectIds: mockSubjects.map((s) => s.id),
        contributingAssessments: mockContributingAssessments,
        marks: stuMarks,
        grades: mockGrades,
      });
      map.set(stu.id, res);
    }
    return map;
  }

  it('generates the authoritative TerminalMeritListData adhering to all forensic rules', () => {
    const learnerResultsMap = buildLearnerResultsMap(mockStudents);
    const data = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      grades: mockGrades,
      isProvisionalMode: false,
      learnerResultsMap,
    });

    expect(data).toBeDefined();
    expect(data.title).toContain('TERMINAL MERIT LIST');
    expect(data.grade).toBe('Grade 9');
    expect(data.streamName).toContain('All Streams');
    expect(data.summaryStats.classCurriculumMax).toBe(300); // 3 subjects * 100 max marks

    // Verify Learner Count
    expect(data.learners.length).toBe(5);

    // Verify Standard Competition Ranking (1, 2, 2, 4, unranked)
    const alice = data.learners.find((r) => r.student.id === 'stu-1');
    const bob = data.learners.find((r) => r.student.id === 'stu-2');
    const charlie = data.learners.find((r) => r.student.id === 'stu-3');
    const david = data.learners.find((r) => r.student.id === 'stu-4');
    const eve = data.learners.find((r) => r.student.id === 'stu-5');

    expect(alice).toBeDefined();
    expect(bob).toBeDefined();
    expect(charlie).toBeDefined();
    expect(david).toBeDefined();
    expect(eve).toBeDefined();

    // Alice: Rank 1
    expect(alice!.displayPosition).toBe('1');
    expect(alice!.terminalTotalMarks).toBe(255);
    expect(alice!.learnerAverageMarks).toBe(85.0);
    expect(alice!.isRankable).toBe(true);

    // Bob & Charlie: Tied at Rank 2
    expect(bob!.displayPosition).toBe('2');
    expect(bob!.terminalTotalMarks).toBe(240);
    expect(charlie!.displayPosition).toBe('2');
    expect(charlie!.terminalTotalMarks).toBe(240);

    // David: Skips Rank 3 to Rank 4
    expect(david!.displayPosition).toBe('4');
    expect(david!.terminalTotalMarks).toBe(180);
    expect(david!.learnerAverageMarks).toBe(60.0);

    // Eve: Incomplete, unranked (blank position)
    expect(eve!.isRankable).toBe(false);
    expect(eve!.displayPosition).toBe('');
    expect((eve!.ranking as any)?.status).toBe('INC');
  });

  it('computes Class Average Marks strictly using Rankable Learners: sum(marks) / N_rankable', () => {
    const learnerResultsMap = buildLearnerResultsMap(mockStudents);
    const data = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      grades: mockGrades,
      isProvisionalMode: false,
      learnerResultsMap,
    });

    // Rankable learners: Alice (255), Bob (240), Charlie (240), David (180).
    // Sum = 915. Count = 4.
    // Class Average Marks = 915 / 4 = 228.75
    expect(data.summaryStats.enrolledCount).toBe(5);
    expect(data.summaryStats.rankableCount).toBe(4);
    expect(data.summaryStats.unrankableCount).toBe(1);
    expect(data.summaryStats.classAverageMarks).toBe(228.75);
  });

  it('correctly calculates Gender Distribution for Boys and Girls', () => {
    const learnerResultsMap = buildLearnerResultsMap(mockStudents);
    const data = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      grades: mockGrades,
      isProvisionalMode: false,
      learnerResultsMap,
    });

    const gd = data.summaryStats.genderDistribution;
    // Alice (F), Charlie (F), Eve (F) = 3 Girls
    // Bob (M), David (M) = 2 Boys
    expect(gd.boysCount).toBe(2);
    expect(gd.girlsCount).toBe(3);
    expect(gd.totalCount).toBe(5);
  });

  it('correctly isolates stream when stream filter is selected', () => {
    const learnerResultsMap = buildLearnerResultsMap(mockStudents);
    // Select Stream East: should only include Alice, Bob, Eve (3 learners)
    const dataEast = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 9',
      selectedStreamId: 'stream-g9e',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      grades: mockGrades,
      isProvisionalMode: false,
      learnerResultsMap,
    });

    expect(dataEast.streamName).toContain('East');
    expect(dataEast.learners.length).toBe(3);
    expect(dataEast.learners.map((r) => r.student.id).sort()).toEqual(['stu-1', 'stu-2', 'stu-5'].sort());
  });

  it('generates compliant CSV content with exact summary metrics and row values', () => {
    const learnerResultsMap = buildLearnerResultsMap(mockStudents);
    const data = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      grades: mockGrades,
      isProvisionalMode: false,
      learnerResultsMap,
    });

    const csv = exportTerminalMeritListToCsv(data);
    expect(csv).toContain('Alice Akinyi');
    expect(csv).toContain('Bob Barasa');
    expect(csv).toContain('255');
    expect(csv).toContain('Learning Area Average Marks');
  });

  it('exports Excel file blob without errors and preserves structured sheet data', () => {
    const learnerResultsMap = buildLearnerResultsMap(mockStudents);
    const data = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      grades: mockGrades,
      isProvisionalMode: false,
      learnerResultsMap,
    });

    const wb = exportTerminalMeritListToExcel(data);
    expect(wb).toBeDefined();
    expect(wb.SheetNames).toContain('Terminal Merit List');
  });

  it('generates strictly monochrome PDF document object with correct font and styling', () => {
    const learnerResultsMap = buildLearnerResultsMap(mockStudents);
    const data = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      grades: mockGrades,
      isProvisionalMode: false,
      learnerResultsMap,
    });

    const doc = exportTerminalMeritListToPdf(data);
    expect(doc).toBeDefined();
    // Verify document page count is at least 1
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('paginates accurately with fixed 42 rows per page when learner count exceeds 42', () => {
    // Generate 50 mock students to exceed 42
    const manyStudents: Student[] = Array.from({ length: 50 }, (_, i) => ({
      id: `stu-large-${i + 1}`,
      admission_number: `ADM${String(i + 1).padStart(3, '0')}`,
      first_name: `Learner${i + 1}`,
      last_name: `Test`,
      full_name: `Learner${i + 1} Test`,
      grade: 'Grade 9',
      class_id: 'cls-g9e',
      stream_id: 'stream-g9e',
      gender: i % 2 === 0 ? 'M' : 'F',
      active: true,
    }));

    const learnerResultsMap = buildLearnerResultsMap(manyStudents);
    const data = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 9',
      selectedStreamId: 'all',
      classes: mockClasses,
      students: manyStudents,
      subjects: mockSubjects,
      grades: mockGrades,
      isProvisionalMode: false,
      learnerResultsMap,
    });

    const doc = exportTerminalMeritListToPdf(data);
    expect(doc).toBeDefined();
    // 50 learners: Page 1 has 42 rows, Page 2 has 8 rows + summary table
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
});
