import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  discoverTerminalAssessments,
  filterEligibleTerminalAssessments,
} from '../services/terminalAssessmentDiscovery';
import {
  calculateLearnerTerminalResults,
  ContributingAssessmentRef,
} from '../services/terminalResultsEngine';
import {
  Student,
  ClassStream,
  Examination,
  Mark,
  Grade,
  Subject,
} from '../types';
import { api } from '../lib/storage';
import { CBE_8_POINT_GRADES } from '../services/analysisEngine';

describe('Terminal Results — Mark Hydration & Resolution Regression Tests', () => {
  // Production Specimen Fixtures
  const academicYear2026 = '69ebb4c9-8f38-43ec-81c1-bb41d7488363';
  const term3 = '4da99451-11a0-4488-b84f-086bff5e2126';

  const grade9Blue: ClassStream = {
    id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
    stream_id: '95e8ff02-6d67-433f-a417-2d74e2012793',
    class_name: 'Grade 9',
    stream: 'Blue',
    education_level: 'Junior School',
  };

  const simonMuiruri: Student = {
    id: '4444e036-0d6f-4859-8f5e-e35b104e8155',
    admission_number: '102',
    full_name: 'Simon Muiruri',
    first_name: 'Simon',
    last_name: 'Muiruri',
    class_id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
    stream_id: '95e8ff02-6d67-433f-a417-2d74e2012793',
    grade: 'Grade 9',
    gender: 'M',
    active: true,
  };

  const learnerB: Student = {
    id: 'bbbb0000-0000-0000-0000-000000000002',
    admission_number: '103',
    full_name: 'Mary Wanjiku',
    first_name: 'Mary',
    last_name: 'Wanjiku',
    class_id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
    stream_id: '95e8ff02-6d67-433f-a417-2d74e2012793',
    grade: 'Grade 9',
    gender: 'F',
    active: true,
  };

  const learnerC: Student = {
    id: 'cccc0000-0000-0000-0000-000000000003',
    admission_number: '104',
    full_name: 'John Kamau',
    first_name: 'John',
    last_name: 'Kamau',
    class_id: '0e49e9b0-0a82-4f4b-9109-685b0103a54c',
    stream_id: '95e8ff02-6d67-433f-a417-2d74e2012793',
    grade: 'Grade 9',
    gender: 'M',
    active: true,
  };

  const englishSubject: Subject = {
    id: '823eba35-ac51-4ac8-be57-fcbeee88151c',
    subject_code: 'ENG',
    subject_name: 'English',
    department: 'Languages',
    category: 'Core',
  };

  const grade9SubjectIds = [
    '823eba35-ac51-4ac8-be57-fcbeee88151c', // English
    'subj-02-kiswahili',
    'subj-03-math',
    'subj-04-science',
    'subj-05-creative-arts',
    'subj-06-social-studies',
    'subj-07-cre',
    'subj-08-agriculture',
    'subj-09-pre-tech',
  ];

  const openerExam: Examination = {
    id: '0b7d0d82-2014-4d55-a067-d045b3b289e2',
    exam_name: 'Opener Assessment Term 3',
    exam_type: 'Opener',
    academic_year_id: academicYear2026,
    term_id: term3,
    status: 'Approved',
    approved_classes: [grade9Blue.stream_id!, 'other-stream'],
    term: 'Term 3',
    year: 2026,
    max_marks: 100,
  };

  const provisionalExam: Examination = {
    id: 'exam-prov-0001-0000-0000-000000000001',
    exam_name: 'Mid-Term Assessment Term 3',
    exam_type: 'Mid-Term',
    academic_year_id: academicYear2026,
    term_id: term3,
    status: 'Provisional',
    approved_classes: [],
    term: 'Term 3',
    year: 2026,
    max_marks: 100,
  };

  const standardGrades: Grade[] = CBE_8_POINT_GRADES;

  // Simon's production authoritative mark for English
  const simonEnglishMark: Mark = {
    id: 'eabf07a1-bc6c-4a9c-ae6c-4d1045d21d08',
    student_id: simonMuiruri.id,
    subject_id: englishSubject.id,
    exam_id: openerExam.id,
    marks: 29,
    raw_score: 29,
    out_of: 100,
    special_status: 'Normal',
    status: 'Normal',
  };

  // Learner B's mark for English
  const learnerBEnglishMark: Mark = {
    id: 'mark-b-0000-0000-0000-000000000001',
    student_id: learnerB.id,
    subject_id: englishSubject.id,
    exam_id: openerExam.id,
    marks: 75,
    raw_score: 75,
    out_of: 100,
    special_status: 'Normal',
    status: 'Normal',
  };

  it('Test 1 — Simon English mark resolves accurately to 29% AE2 3 points with complete assessment trail', async () => {
    // When Simon's authoritative mark is supplied (e.g. hydrated from Supabase)
    const discovered = await discoverTerminalAssessments({
      academicYearId: academicYear2026,
      termId: term3,
      student: simonMuiruri,
      classStream: grade9Blue,
      isProvisionalMode: false,
      examinations: [openerExam],
      marks: [simonEnglishMark],
    });

    expect(discovered.contributingAssessments).toHaveLength(1);
    expect(discovered.contributingAssessments[0].id).toBe(openerExam.id);
    expect(discovered.marks).toHaveLength(1);
    expect(discovered.marks[0].student_id).toBe(simonMuiruri.id);
    expect(discovered.marks[0].raw_score).toBe(29);

    const terminalResults = calculateLearnerTerminalResults({
      learnerId: simonMuiruri.id,
      subjectIds: [englishSubject.id],
      contributingAssessments: discovered.contributingAssessments,
      marks: discovered.marks,
      grades: standardGrades,
    });

    const englishResult = terminalResults.get(englishSubject.id);
    expect(englishResult).toBeDefined();
    expect(englishResult!.isComplete).toBe(true);
    expect(englishResult!.status).toBe('Complete');
    expect(englishResult!.terminalPercentage).toBe(29);
    expect(englishResult!.cbePerformanceLevel).toBe('AE2');
    expect(englishResult!.points).toBe(3);

    // Verify Assessment Trail
    expect(englishResult!.assessmentTrail).toHaveLength(1);
    const trailItem = englishResult!.assessmentTrail[0];
    expect(trailItem.examId).toBe(openerExam.id);
    expect(trailItem.examName).toBe('Opener Assessment Term 3');
    expect(trailItem.rawScore).toBe(29);
    expect(trailItem.outOf).toBe(100);
    expect(trailItem.displayScore).toBe('29%');
    expect(trailItem.status).toBe('Normal');
  });

  it('Test 2 — Simon summary metrics: 9 Learning Areas, Complete: 1, Incomplete: 8', async () => {
    const discovered = await discoverTerminalAssessments({
      academicYearId: academicYear2026,
      termId: term3,
      student: simonMuiruri,
      classStream: grade9Blue,
      isProvisionalMode: false,
      examinations: [openerExam],
      marks: [simonEnglishMark], // Only English has an entered mark
    });

    const terminalResults = calculateLearnerTerminalResults({
      learnerId: simonMuiruri.id,
      subjectIds: grade9SubjectIds,
      contributingAssessments: discovered.contributingAssessments,
      marks: discovered.marks,
      grades: standardGrades,
    });

    expect(terminalResults.size).toBe(9);

    let completeCount = 0;
    let incompleteCount = 0;
    for (const subId of grade9SubjectIds) {
      const res = terminalResults.get(subId);
      if (res?.isComplete) {
        completeCount++;
      } else {
        incompleteCount++;
      }
    }

    expect(completeCount).toBe(1);
    expect(incompleteCount).toBe(8);

    // English is complete
    expect(terminalResults.get(englishSubject.id)!.isComplete).toBe(true);
    // The other 8 subjects are incomplete with X
    for (const subId of grade9SubjectIds.filter((id) => id !== englishSubject.id)) {
      const res = terminalResults.get(subId)!;
      expect(res.isComplete).toBe(false);
      expect(res.status).toBe('INCOMPLETE (X)');
      expect(res.displayPercentage).toBe('X');
    }
  });

  it('Test 3 — Learner with no marks: All 9 Learning Areas resolve as INCOMPLETE (X), not zero', async () => {
    const discovered = await discoverTerminalAssessments({
      academicYearId: academicYear2026,
      termId: term3,
      student: learnerC, // Learner C has no marks
      classStream: grade9Blue,
      isProvisionalMode: false,
      examinations: [openerExam],
      marks: [], // Empty marks
    });

    const terminalResults = calculateLearnerTerminalResults({
      learnerId: learnerC.id,
      subjectIds: grade9SubjectIds,
      contributingAssessments: discovered.contributingAssessments,
      marks: discovered.marks,
      grades: standardGrades,
    });

    let completeCount = 0;
    let incompleteCount = 0;
    for (const subId of grade9SubjectIds) {
      const res = terminalResults.get(subId)!;
      if (res.isComplete) {
        completeCount++;
      } else {
        incompleteCount++;
      }
      expect(res.isComplete).toBe(false);
      expect(res.status).toBe('INCOMPLETE (X)');
      expect(res.displayPercentage).toBe('X');
      expect(res.terminalPercentage).toBeNull();
    }

    expect(completeCount).toBe(0);
    expect(incompleteCount).toBe(9);
  });

  it('Test 4 — Official Mode: Discovers only approved exams, preserves Official eligibility', async () => {
    // Opener is Approved; ProvisionalExam is Provisional
    const discovered = await discoverTerminalAssessments({
      academicYearId: academicYear2026,
      termId: term3,
      student: simonMuiruri,
      classStream: grade9Blue,
      isProvisionalMode: false, // Official Mode
      examinations: [openerExam, provisionalExam],
      marks: [simonEnglishMark],
    });

    // Only openerExam is eligible in Official mode
    expect(discovered.contributingAssessments).toHaveLength(1);
    expect(discovered.contributingAssessments[0].id).toBe(openerExam.id);
    expect(discovered.isProvisionalMode).toBe(false);

    const terminalResults = calculateLearnerTerminalResults({
      learnerId: simonMuiruri.id,
      subjectIds: [englishSubject.id],
      contributingAssessments: discovered.contributingAssessments,
      marks: discovered.marks,
      grades: standardGrades,
    });

    expect(terminalResults.get(englishSubject.id)!.isComplete).toBe(true);
    expect(terminalResults.get(englishSubject.id)!.terminalPercentage).toBe(29);
  });

  it('Test 5 — Provisional Mode: Discovers both Approved and Provisional exams governed by T-12', async () => {
    // Simon also has a mark in the provisional exam
    const simonProvMark: Mark = {
      id: 'mark-prov-simon',
      student_id: simonMuiruri.id,
      subject_id: englishSubject.id,
      exam_id: provisionalExam.id,
      marks: 35,
      raw_score: 35,
      out_of: 100,
      special_status: 'Normal',
      status: 'Normal',
    };

    const discovered = await discoverTerminalAssessments({
      academicYearId: academicYear2026,
      termId: term3,
      student: simonMuiruri,
      classStream: grade9Blue,
      isProvisionalMode: true, // Provisional Mode
      examinations: [openerExam, provisionalExam],
      marks: [simonEnglishMark, simonProvMark],
    });

    // Both exams eligible in Provisional mode
    expect(discovered.contributingAssessments).toHaveLength(2);
    expect(discovered.isProvisionalMode).toBe(true);

    const terminalResults = calculateLearnerTerminalResults({
      learnerId: simonMuiruri.id,
      subjectIds: [englishSubject.id],
      contributingAssessments: discovered.contributingAssessments,
      marks: discovered.marks,
      grades: standardGrades,
    });

    // Equal weighting: (29 + 35) / 2 = 32%
    const engRes = terminalResults.get(englishSubject.id)!;
    expect(engRes.isComplete).toBe(true);
    expect(engRes.terminalPercentage).toBe(32);
    expect(engRes.assessmentTrail).toHaveLength(2);
  });

  it('Test 6 — Cross-Learner Isolation: Learner A gets A marks, B gets B marks, no leakage to C', async () => {
    const combinedCache = [simonEnglishMark, learnerBEnglishMark];

    // Discover for Simon
    const discoveredSimon = await discoverTerminalAssessments({
      academicYearId: academicYear2026,
      termId: term3,
      student: simonMuiruri,
      classStream: grade9Blue,
      isProvisionalMode: false,
      examinations: [openerExam],
      marks: combinedCache,
    });

    // Discover for Learner B
    const discoveredB = await discoverTerminalAssessments({
      academicYearId: academicYear2026,
      termId: term3,
      student: learnerB,
      classStream: grade9Blue,
      isProvisionalMode: false,
      examinations: [openerExam],
      marks: combinedCache,
    });

    // Discover for Learner C
    const discoveredC = await discoverTerminalAssessments({
      academicYearId: academicYear2026,
      termId: term3,
      student: learnerC,
      classStream: grade9Blue,
      isProvisionalMode: false,
      examinations: [openerExam],
      marks: combinedCache,
    });

    // Simon's marks only contain Simon
    expect(discoveredSimon.marks).toHaveLength(1);
    expect(discoveredSimon.marks[0].student_id).toBe(simonMuiruri.id);
    expect(discoveredSimon.marks[0].raw_score).toBe(29);

    // Learner B's marks only contain Learner B
    expect(discoveredB.marks).toHaveLength(1);
    expect(discoveredB.marks[0].student_id).toBe(learnerB.id);
    expect(discoveredB.marks[0].raw_score).toBe(75);

    // Learner C's marks are empty (no leakage)
    expect(discoveredC.marks).toHaveLength(0);

    // Calculate Simon
    const resSimon = calculateLearnerTerminalResults({
      learnerId: simonMuiruri.id,
      subjectIds: [englishSubject.id],
      contributingAssessments: discoveredSimon.contributingAssessments,
      marks: discoveredSimon.marks,
      grades: standardGrades,
    });
    expect(resSimon.get(englishSubject.id)!.terminalPercentage).toBe(29);

    // Calculate Learner B
    const resB = calculateLearnerTerminalResults({
      learnerId: learnerB.id,
      subjectIds: [englishSubject.id],
      contributingAssessments: discoveredB.contributingAssessments,
      marks: discoveredB.marks,
      grades: standardGrades,
    });
    expect(resB.get(englishSubject.id)!.terminalPercentage).toBe(75);

    // Calculate Learner C
    const resC = calculateLearnerTerminalResults({
      learnerId: learnerC.id,
      subjectIds: [englishSubject.id],
      contributingAssessments: discoveredC.contributingAssessments,
      marks: discoveredC.marks,
      grades: standardGrades,
    });
    expect(resC.get(englishSubject.id)!.isComplete).toBe(false);
    expect(resC.get(englishSubject.id)!.displayPercentage).toBe('X');
  });

  it('Test 7 — Special Status Regression: Genuine zero, X, Y, and resolved Y are preserved', async () => {
    const zeroMark: Mark = {
      id: 'mark-zero',
      student_id: simonMuiruri.id,
      subject_id: 'subj-02-kiswahili',
      exam_id: openerExam.id,
      marks: 0,
      raw_score: 0,
      out_of: 100,
      special_status: 'Normal',
      status: 'Normal',
    };

    const yMark: Mark = {
      id: 'mark-y',
      student_id: simonMuiruri.id,
      subject_id: 'subj-03-math',
      exam_id: openerExam.id,
      marks: 40,
      raw_score: 40,
      out_of: 100,
      special_status: 'Y',
      status: 'Y',
    };

    const resolvedYMark: Mark = {
      id: 'mark-resolved-y',
      student_id: simonMuiruri.id,
      subject_id: 'subj-04-science',
      exam_id: openerExam.id,
      marks: 60,
      raw_score: 60,
      out_of: 100,
      special_status: 'Normal',
      status: 'Normal',
      resolution: {
        id: 'res-1',
        mark_id: 'mark-resolved-y',
        original_status: 'Y',
        resolution_reason: 'score_given',
        replacement_score: 60,
        resolved_score: 60,
        resolved_by: 'teacher-1',
        resolved_at: '2026-09-01T00:00:00Z',
      },
    };

    const terminalResults = calculateLearnerTerminalResults({
      learnerId: simonMuiruri.id,
      subjectIds: ['subj-02-kiswahili', 'subj-03-math', 'subj-04-science'],
      contributingAssessments: [{
        id: openerExam.id,
        exam_name: openerExam.exam_name,
        status: 'Approved',
        max_marks: 100,
        out_of: 100,
      }],
      marks: [zeroMark, yMark, resolvedYMark],
      grades: standardGrades,
    });

    // Genuine zero must be 0% Complete (not X)
    const zeroRes = terminalResults.get('subj-02-kiswahili')!;
    expect(zeroRes.isComplete).toBe(true);
    expect(zeroRes.terminalPercentage).toBe(0);
    expect(zeroRes.displayPercentage).toBe('0%');

    // Y mark unresolved must be Incomplete (Y)
    const yRes = terminalResults.get('subj-03-math')!;
    expect(yRes.isComplete).toBe(false);
    expect(yRes.status).toBe('INCOMPLETE (Y)');
    expect(yRes.displayPercentage).toBe('Y');

    // Resolved Y mark must be Complete with resolved score
    const resolvedRes = terminalResults.get('subj-04-science')!;
    expect(resolvedRes.isComplete).toBe(true);
    expect(resolvedRes.terminalPercentage).toBe(60);
    expect(resolvedRes.displayPercentage).toBe('60%');
  });

  it('Test 8 — Authoritative mark mapping: api.mapDatabaseMarks unpacks remarks JSON safely', () => {
    const rawDbRow = {
      id: 'db-mark-1',
      student_id: simonMuiruri.id,
      subject_id: englishSubject.id,
      exam_id: openerExam.id,
      marks: 29,
      remarks: JSON.stringify({
        raw_score: 29,
        out_of: 100,
        special_status: 'Normal',
        irregularity_reason: null,
      }),
    };

    const mapped = api.mapDatabaseMarks([rawDbRow]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].raw_score).toBe(29);
    expect(mapped[0].out_of).toBe(100);
    expect(mapped[0].special_status).toBe('Normal');
  });
});
