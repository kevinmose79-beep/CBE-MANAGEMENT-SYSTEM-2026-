import { describe, it, expect } from 'vitest';
import {
  discoverTerminalAssessments,
  filterEligibleTerminalAssessments,
  validateAndExtractMaxMarks,
  isExamEligibleForTerminal,
} from '../services/terminalAssessmentDiscovery';
import { calculateLearningAreaTerminalResult } from '../services/terminalResultsEngine';
import { Examination, Mark, MarkResolution, Student, ClassStream } from '../types';

describe('T-12 Terminal Assessment Discovery & Eligibility Layer', () => {
  const mockClassStreamA: ClassStream = {
    id: 'class-g7a',
    stream_id: 'stream-g7a-uuid',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
    status: 'Active',
  };

  const mockClassStreamB: ClassStream = {
    id: 'class-g7b',
    stream_id: 'stream-g7b-uuid',
    class_name: 'Grade 7',
    stream: 'West',
    education_level: 'Junior School',
    status: 'Active',
  };

  const mockStudentA: Student = {
    id: 'std-alice',
    first_name: 'Alice',
    last_name: 'Wanjiku',
    full_name: 'Alice Wanjiku',
    gender: 'F',
    admission_number: 'ADM-001',
    class_id: 'class-g7a',
    stream_id: 'stream-g7a-uuid',
    grade: 'Grade 7',
    education_level: 'Junior School',
    active: true,
    enrolment_status: 'active',
    admission_date: '2026-01-05',
    intake_year: 2026,
    intake_term: 'Term 1',
  };

  const mockStudentB: Student = {
    id: 'std-bob',
    first_name: 'Bob',
    last_name: 'Otieno',
    full_name: 'Bob Otieno',
    gender: 'M',
    admission_number: 'ADM-002',
    class_id: 'class-g7b',
    stream_id: 'stream-g7b-uuid',
    grade: 'Grade 7',
    education_level: 'Junior School',
    active: true,
    enrolment_status: 'active',
    admission_date: '2026-01-05',
    intake_year: 2026,
    intake_term: 'Term 1',
  };

  const createExam = (overrides: Partial<Examination>): Examination => ({
    id: 'exam-' + Math.random().toString(36).substring(2, 9),
    exam_name: 'Assessment',
    term: 'Term 1',
    year: 2026,
    academic_year_id: 'year-2026-uuid',
    term_id: 'term-1-uuid',
    status: 'Approved',
    exam_type: 'CAT',
    max_marks: 50,
    start_date: '2026-02-10',
    approved_classes: ['stream-g7a-uuid', 'stream-g7b-uuid'],
    ...overrides,
  });

  // Test 1: One eligible Approved assessment is discovered
  it('Test 1: One eligible Approved assessment is discovered', async () => {
    const exam1 = createExam({ id: 'exam-1', exam_name: 'Opener Assessment', max_marks: 100 });
    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1],
    });

    expect(result.contributingAssessments).toHaveLength(1);
    expect(result.contributingAssessments[0].id).toBe('exam-1');
    expect(result.contributingAssessments[0].max_marks).toBe(100);
    expect(result.contributingAssessments[0].out_of).toBe(100);
  });

  // Test 2: Two eligible Approved assessments are discovered
  it('Test 2: Two eligible Approved assessments are discovered', async () => {
    const exam1 = createExam({ id: 'exam-1', exam_name: 'CAT 1', max_marks: 40, start_date: '2026-02-01' });
    const exam2 = createExam({ id: 'exam-2', exam_name: 'CAT 2', max_marks: 60, start_date: '2026-03-01' });

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1, exam2],
    });

    expect(result.contributingAssessments).toHaveLength(2);
    expect(result.contributingAssessments.map((a) => a.id)).toEqual(['exam-1', 'exam-2']);
  });

  // Test 3: Three eligible Approved assessments are discovered
  it('Test 3: Three eligible Approved assessments are discovered', async () => {
    const exam1 = createExam({ id: 'exam-1', exam_name: 'Opener', max_marks: 50, start_date: '2026-01-15' });
    const exam2 = createExam({ id: 'exam-2', exam_name: 'Mid-Term', max_marks: 50, start_date: '2026-02-20' });
    const exam3 = createExam({ id: 'exam-3', exam_name: 'End-Term', max_marks: 100, start_date: '2026-03-25' });

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1, exam2, exam3],
    });

    expect(result.contributingAssessments).toHaveLength(3);
    expect(result.contributingAssessments.map((a) => a.id)).toEqual(['exam-1', 'exam-2', 'exam-3']);
  });

  // Test 4: Four or more eligible assessments are discovered (no hard-coded assessment count)
  it('Test 4: Four or more eligible assessments are discovered proving dynamic count', async () => {
    const exam1 = createExam({ id: 'exam-1', exam_name: 'Assessment 1', start_date: '2026-01-10' });
    const exam2 = createExam({ id: 'exam-2', exam_name: 'Assessment 2', start_date: '2026-01-25' });
    const exam3 = createExam({ id: 'exam-3', exam_name: 'Assessment 3', start_date: '2026-02-10' });
    const exam4 = createExam({ id: 'exam-4', exam_name: 'Assessment 4', start_date: '2026-02-25' });
    const exam5 = createExam({ id: 'exam-5', exam_name: 'Assessment 5', start_date: '2026-03-10' });

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1, exam2, exam3, exam4, exam5],
    });

    expect(result.contributingAssessments).toHaveLength(5);
    expect(result.assessmentCount).toBe(5);
  });

  // Test 5: Draft assessment is excluded from official Terminal discovery
  it('Test 5: Draft assessment is excluded from official Terminal discovery', async () => {
    const examApproved = createExam({ id: 'exam-app', exam_name: 'Official CAT', status: 'Approved' });
    const examDraft = createExam({ id: 'exam-draft', exam_name: 'Draft CAT', status: 'Draft' });

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [examApproved, examDraft],
    });

    expect(result.contributingAssessments).toHaveLength(1);
    expect(result.contributingAssessments[0].id).toBe('exam-app');
  });

  // Test 6: Archived assessment is excluded
  it('Test 6: Archived assessment is excluded from Terminal discovery', async () => {
    const examApproved = createExam({ id: 'exam-app', exam_name: 'Current CAT', status: 'Approved' });
    const examArchived = createExam({ id: 'exam-arch', exam_name: 'Old Archived CAT', status: 'Archived' as any });

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [examApproved, examArchived],
    });

    expect(result.contributingAssessments).toHaveLength(1);
    expect(result.contributingAssessments[0].id).toBe('exam-app');
  });

  // Test 7: Provisional assessment is excluded from official Terminal discovery
  it('Test 7: Provisional assessment is excluded from official Terminal discovery', async () => {
    const examApproved = createExam({ id: 'exam-app', exam_name: 'Approved CAT', status: 'Approved' });
    const examProvisional = createExam({
      id: 'exam-prov',
      exam_name: 'Provisional CAT',
      status: 'Provisional',
      approved_classes: [], // not yet approved for any stream
    });

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      isProvisionalMode: false,
      examinations: [examApproved, examProvisional],
    });

    expect(result.contributingAssessments).toHaveLength(1);
    expect(result.contributingAssessments[0].id).toBe('exam-app');
  });

  // Test 8: Provisional assessment is included only when explicit provisional mode is enabled
  it('Test 8: Provisional assessment is included only when explicit provisional mode is enabled', async () => {
    const examApproved = createExam({ id: 'exam-app', exam_name: 'Approved CAT', status: 'Approved' });
    const examProvisional = createExam({
      id: 'exam-prov',
      exam_name: 'Provisional CAT',
      status: 'Provisional',
      approved_classes: [],
    });

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      isProvisionalMode: true,
      examinations: [examApproved, examProvisional],
    });

    expect(result.contributingAssessments).toHaveLength(2);
    expect(result.isProvisionalMode).toBe(true);
  });

  // Test 9: Assessment approved for Stream A is discoverable for a learner in Stream A
  it('Test 9: Assessment approved for Stream A is discoverable for a learner in Stream A', async () => {
    const examStreamAOnly = createExam({
      id: 'exam-stream-a',
      exam_name: 'Stream A Specific Approval CAT',
      status: 'Provisional',
      approved_classes: ['stream-g7a-uuid'], // Approved ONLY for Stream A
    });

    const resultA = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      isProvisionalMode: false,
      examinations: [examStreamAOnly],
    });

    expect(resultA.contributingAssessments).toHaveLength(1);
    expect(resultA.contributingAssessments[0].id).toBe('exam-stream-a');
  });

  // Test 10: The same assessment is not incorrectly discovered for Stream B when approval rules say it is not approved there
  it('Test 10: The same assessment is not discovered for Stream B when not approved there', async () => {
    const examStreamAOnly = createExam({
      id: 'exam-stream-a',
      exam_name: 'Stream A Specific Approval CAT',
      status: 'Provisional',
      approved_classes: ['stream-g7a-uuid'], // Approved ONLY for Stream A
    });

    const resultB = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentB, // Student in Stream B
      classStream: mockClassStreamB,
      isProvisionalMode: false,
      examinations: [examStreamAOnly],
    });

    expect(resultB.contributingAssessments).toHaveLength(0);
  });

  // Test 11: An eligible assessment with no mark row is still discovered (critical Examination-first test)
  it('Test 11: An eligible assessment with no mark row is still discovered (Examination-First)', async () => {
    const exam1 = createExam({ id: 'exam-1', exam_name: 'CAT 1' });
    const exam2 = createExam({ id: 'exam-2', exam_name: 'CAT 2' });

    // Student Alice only has a mark row for exam-1. exam-2 has NO mark row in DB.
    const studentMarks: Mark[] = [
      {
        id: 'mark-1',
        exam_id: 'exam-1',
        student_id: mockStudentA.id,
        subject_id: 'sub-math',
        score: 45,
        percentage: 90,
        status: 'Normal',
      },
    ];

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1, exam2],
      marks: studentMarks,
      subjectId: 'sub-math',
    });

    // BOTH assessments must be discovered!
    expect(result.contributingAssessments).toHaveLength(2);
    expect(result.contributingAssessments.map((a) => a.id)).toEqual(['exam-1', 'exam-2']);

    // When fed into terminal calculation engine, exam-2 must trigger INCOMPLETE (X)
    const terminalResult = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: result.contributingAssessments,
      marks: result.marks,
    });

    expect(terminalResult.isComplete).toBe(false);
    expect(terminalResult.status).toBe('INCOMPLETE (X)');
    expect(terminalResult.terminalPercentage).toBeNull();
    expect(terminalResult.cbePerformanceLevel).toBeNull();
    expect(terminalResult.points).toBeNull();
  });

  // Test 12: A genuine zero mark remains a mark and is not treated as missing
  it('Test 12: A genuine zero mark remains a mark and is not treated as missing', async () => {
    const exam1 = createExam({ id: 'exam-1', exam_name: 'CAT 1', max_marks: 50 });
    const exam2 = createExam({ id: 'exam-2', exam_name: 'CAT 2', max_marks: 50 });

    const studentMarks: Mark[] = [
      {
        id: 'mark-1',
        exam_id: 'exam-1',
        student_id: mockStudentA.id,
        subject_id: 'sub-math',
        score: 40,
        percentage: 80,
        status: 'Normal',
      },
      {
        id: 'mark-2',
        exam_id: 'exam-2',
        student_id: mockStudentA.id,
        subject_id: 'sub-math',
        score: 0, // Genuine zero!
        percentage: 0,
        status: 'Normal',
      },
    ];

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1, exam2],
      marks: studentMarks,
      subjectId: 'sub-math',
    });

    expect(result.contributingAssessments).toHaveLength(2);
    expect(result.marks).toHaveLength(2);

    const terminalResult = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: result.contributingAssessments,
      marks: result.marks,
    });

    // (80% + 0%) / 2 = 40%, complete!
    expect(terminalResult.isComplete).toBe(true);
    expect(terminalResult.terminalPercentage).toBe(40);
  });

  // Test 13: A learner admitted after an assessment is excluded when existing eligibility rules say they were not required to take it
  it('Test 13: A learner admitted after an assessment date is excluded from that assessment', async () => {
    const examEarly = createExam({
      id: 'exam-early',
      exam_name: 'Early Assessment',
      start_date: '2026-01-10',
    });
    const examLate = createExam({
      id: 'exam-late',
      exam_name: 'Late Assessment',
      start_date: '2026-03-01',
    });

    // Student Charlie admitted mid-term on 2026-02-15 with no marks for examEarly
    const studentCharlie: Student = {
      ...mockStudentA,
      id: 'std-charlie',
      admission_date: '2026-02-15',
    };

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: studentCharlie,
      classStream: mockClassStreamA,
      examinations: [examEarly, examLate],
      marks: [],
    });

    // Only examLate is required for Charlie
    expect(result.contributingAssessments).toHaveLength(1);
    expect(result.contributingAssessments[0].id).toBe('exam-late');
  });

  // Test 14: A learner from another academic year is excluded
  it('Test 14: A learner from another academic year is excluded', async () => {
    const exam2026 = createExam({
      id: 'exam-2026',
      year: 2026,
      academic_year_id: 'year-2026-uuid',
    });

    // Student admitted in 2027
    const studentFutureYear: Student = {
      ...mockStudentA,
      intake_year: 2027,
    };

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: studentFutureYear,
      classStream: mockClassStreamA,
      examinations: [exam2026],
    });

    expect(result.contributingAssessments).toHaveLength(0);
  });

  // Test 15: A learner from another term is excluded
  it('Test 15: A learner from another term is excluded', async () => {
    const examTerm1 = createExam({
      id: 'exam-term1',
      term: 'Term 1',
      term_id: 'term-1-uuid',
      year: 2026,
    });

    // Student admitted in Term 2 of 2026
    const studentTerm2Intake: Student = {
      ...mockStudentA,
      intake_year: 2026,
      intake_term: 'Term 2',
    };

    const result = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: studentTerm2Intake,
      classStream: mockClassStreamA,
      examinations: [examTerm1],
    });

    expect(result.contributingAssessments).toHaveLength(0);
  });

  // Test 16: An assessment for another Learning Area is excluded
  it('Test 16: An assessment for another Learning Area is excluded', async () => {
    const examMathSpecific = createExam({
      id: 'exam-math-pract',
      exam_name: 'Mathematics Practical Test',
      ...({ subject_id: 'sub-math' } as any),
    });
    const examEnglishSpecific = createExam({
      id: 'exam-eng-oral',
      exam_name: 'English Oral Test',
      ...({ subject_id: 'sub-eng' } as any),
    });

    // Discovering for Mathematics
    const resultMath = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [examMathSpecific, examEnglishSpecific],
      subjectId: 'sub-math',
    });

    expect(resultMath.contributingAssessments).toHaveLength(1);
    expect(resultMath.contributingAssessments[0].id).toBe('exam-math-pract');
  });

  // Test 17: A deleted assessment disappears from fresh Supabase discovery
  it('Test 17: A deleted assessment disappears from fresh discovery', async () => {
    const exam1 = createExam({ id: 'exam-1', exam_name: 'CAT 1' });
    const exam2 = createExam({ id: 'exam-2', exam_name: 'CAT 2' });

    // Initial discovery with both exams
    const initial = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1, exam2],
    });
    expect(initial.contributingAssessments).toHaveLength(2);

    // After deletion of exam-2 in Supabase, the fresh query contains only exam-1
    const afterDelete = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1], // exam-2 was deleted
    });
    expect(afterDelete.contributingAssessments).toHaveLength(1);
    expect(afterDelete.contributingAssessments[0].id).toBe('exam-1');
  });

  // Test 18: An assessment reopened to Draft disappears from official Terminal discovery
  it('Test 18: An assessment reopened to Draft disappears from official Terminal discovery', async () => {
    const exam1 = createExam({ id: 'exam-1', exam_name: 'CAT 1', status: 'Approved' });
    const exam2Approved = createExam({ id: 'exam-2', exam_name: 'CAT 2', status: 'Approved' });

    const beforeReopen = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1, exam2Approved],
    });
    expect(beforeReopen.contributingAssessments).toHaveLength(2);

    // exam-2 is reopened to Draft
    const exam2Draft = { ...exam2Approved, status: 'Draft' as const };
    const afterReopen = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1, exam2Draft],
    });
    expect(afterReopen.contributingAssessments).toHaveLength(1);
    expect(afterReopen.contributingAssessments[0].id).toBe('exam-1');
  });

  // Test 19: An assessment with missing/invalid maximum score is not silently assigned 100
  it('Test 19: An assessment with missing or invalid maximum score explicitly fails without falling back to 100', () => {
    const examMissingMax = createExam({
      id: 'exam-bad',
      exam_name: 'Corrupted Exam',
      max_marks: null as any,
    });

    expect(() => {
      validateAndExtractMaxMarks(examMissingMax);
    }).toThrow(/missing or invalid maximum score/);

    const examZeroMax = createExam({
      id: 'exam-zero',
      exam_name: 'Zero Max Exam',
      max_marks: 0,
    });

    expect(() => {
      validateAndExtractMaxMarks(examZeroMax);
    }).toThrow(/missing or invalid maximum score/);
  });

  // Test 20: Resolved Y remains associated with its original assessment and is not duplicated
  it('Test 20: Resolved Y remains associated with its original assessment and is not duplicated', async () => {
    const exam1 = createExam({ id: 'exam-1', exam_name: 'CAT 1', max_marks: 50 });
    const exam2 = createExam({ id: 'exam-2', exam_name: 'CAT 2', max_marks: 50 });

    const marks: Mark[] = [
      {
        id: 'mark-1',
        exam_id: 'exam-1',
        student_id: mockStudentA.id,
        subject_id: 'sub-math',
        score: 40, // 80%
        percentage: 80,
        status: 'Normal',
      },
      {
        id: 'mark-2',
        exam_id: 'exam-2',
        student_id: mockStudentA.id,
        subject_id: 'sub-math',
        score: null,
        percentage: null,
        status: 'Y',
        irregularity_reason: 'Hospitalized',
      },
    ];

    const resolutions: MarkResolution[] = [
      {
        id: 'res-1',
        mark_id: 'mark-2',
        resolved_score: 35, // 70%
        previous_status: 'Y',
        resolution_reason: 'Special Medical Assessment approved by Headteacher',
        resolved_by: 'teacher-admin-uuid',
        resolved_at: '2026-03-20T10:00:00Z',
      },
    ];

    const discovery = await discoverTerminalAssessments({
      academicYearId: 'year-2026-uuid',
      termId: 'term-1-uuid',
      student: mockStudentA,
      classStream: mockClassStreamA,
      examinations: [exam1, exam2],
      marks,
      resolutions,
      subjectId: 'sub-math',
    });

    expect(discovery.contributingAssessments).toHaveLength(2);
    expect(discovery.marks).toHaveLength(2);
    expect(discovery.resolutions).toHaveLength(1);

    // Pass discovery output directly to pure terminalResultsEngine
    const terminalResult = calculateLearningAreaTerminalResult({
      subjectId: 'sub-math',
      contributingAssessments: discovery.contributingAssessments,
      marks: discovery.marks,
    });

    // (80% + 70%) / 2 = 75%
    expect(terminalResult.isComplete).toBe(true);
    expect(terminalResult.terminalPercentage).toBe(75);
    expect(terminalResult.assessmentTrail[1].resolvedFromY).toBe(true);
    expect(terminalResult.assessmentTrail[1].displayScore).toBe('35/50');
    expect(terminalResult.assessmentTrail[1].resolutionReason).toBe(
      'Special Medical Assessment approved by Headteacher'
    );
  });
});
