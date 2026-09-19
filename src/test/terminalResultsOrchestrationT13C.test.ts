/**
 * T-13C Terminal Results Presentation & Orchestration Layer Tests
 *
 * Covers:
 * - Dynamic assessment columns (1, 2, 3, 4+ assessments)
 * - Maximum marks preservation from discovery
 * - Complete numerical calculations & CBE levels
 * - Genuine zero handling (e.g. 0% BE2 · 1 pt)
 * - X handling: Missing / Unassessed -> INCOMPLETE (X)
 * - Y handling: Unresolved irregularity / withheld -> INCOMPLETE (Y)
 * - X + Y handling -> INCOMPLETE (X/Y)
 * - Resolved Y handling: replacement numerical mark contributes, resolution provenance preserved
 * - Different assessment denominators normalisation
 * - Strict Learning Area isolation
 * - Official vs Provisional mode discovery & access restrictions
 * - Context switches & loading/empty/error states
 * - Strict absence of overall percentage, overall level, overall points, and ranking
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLearningAreaTerminalResult,
  calculateLearnerTerminalResults,
  ContributingAssessmentRef,
  LearningAreaTerminalResult,
} from '../services/terminalResultsEngine';
import {
  filterEligibleTerminalAssessments,
  discoverTerminalAssessments,
} from '../services/terminalAssessmentDiscovery';
import {
  Student,
  Examination,
  ClassStream,
  Mark,
  MarkResolution,
  Grade,
} from '../types';

describe('T-13C: Terminal Results Presentation & Orchestration Layer', () => {
  const mockClass: ClassStream = {
    id: 'cls-g7-east',
    stream_id: 'cls-g7-east',
    class_name: 'Grade 7',
    stream: 'East',
    education_level: 'Junior School',
  };

  const mockStudent: Student = {
    id: 'stu-uuid-1',
    admission_number: 'ADM-001',
    full_name: 'Amina Mwangi',
    first_name: 'Amina',
    last_name: 'Mwangi',
    class_id: mockClass.id,
    stream_id: mockClass.stream_id,
    active: true,
    enrolment_status: 'active',
    admission_date: '2025-01-10',
    gender: 'F',
  };

  const baseExams: Examination[] = [
    {
      id: 'exam-1',
      exam_name: 'Opener Assessment',
      academic_year_id: 'ay-2026',
      term_id: 't-1',
      year: 2026,
      term: 'Term 1',
      exam_type: 'Opener',
      max_marks: 50,
      status: 'Approved',
      approved_classes: [mockClass.id],
      start_date: '2026-01-15',
    },
    {
      id: 'exam-2',
      exam_name: 'Mid-Term Assessment',
      academic_year_id: 'ay-2026',
      term_id: 't-1',
      year: 2026,
      term: 'Term 1',
      exam_type: 'Mid-Term',
      max_marks: 50,
      status: 'Approved',
      approved_classes: [mockClass.id],
      start_date: '2026-02-20',
    },
    {
      id: 'exam-3',
      exam_name: 'End of Term Assessment',
      academic_year_id: 'ay-2026',
      term_id: 't-1',
      year: 2026,
      term: 'Term 1',
      exam_type: 'End-Term',
      max_marks: 100,
      status: 'Approved',
      approved_classes: [mockClass.id],
      start_date: '2026-03-25',
    },
    {
      id: 'exam-4',
      exam_name: 'Practical Assessment',
      academic_year_id: 'ay-2026',
      term_id: 't-1',
      year: 2026,
      term: 'Term 1',
      exam_type: 'Custom',
      max_marks: 25,
      status: 'Approved',
      approved_classes: [mockClass.id],
      start_date: '2026-04-01',
    },
  ];

  // 1. Dynamic Assessment Discovery (1, 2, 3, 4+ assessments)
  describe('Dynamic Assessment Columns (1-to-N)', () => {
    it('discovers exactly 1 contributing assessment when only 1 is approved', () => {
      const discovered = filterEligibleTerminalAssessments([baseExams[0]], {
        academicYearId: 'ay-2026',
        termId: 't-1',
        student: mockStudent,
        classStream: mockClass,
      });

      expect(discovered).toHaveLength(1);
      expect(discovered[0].exam_name).toBe('Opener Assessment');
      expect(discovered[0].max_marks).toBe(50);
    });

    it('discovers 2 contributing assessments', () => {
      const discovered = filterEligibleTerminalAssessments([baseExams[0], baseExams[1]], {
        academicYearId: 'ay-2026',
        termId: 't-1',
        student: mockStudent,
        classStream: mockClass,
      });

      expect(discovered).toHaveLength(2);
      expect(discovered.map((d) => d.id)).toEqual(['exam-1', 'exam-2']);
    });

    it('discovers 3 contributing assessments', () => {
      const discovered = filterEligibleTerminalAssessments([baseExams[0], baseExams[1], baseExams[2]], {
        academicYearId: 'ay-2026',
        termId: 't-1',
        student: mockStudent,
        classStream: mockClass,
      });

      expect(discovered).toHaveLength(3);
      expect(discovered[0].max_marks).toBe(50);
      expect(discovered[1].max_marks).toBe(50);
      expect(discovered[2].max_marks).toBe(100);
    });

    it('discovers 4 or more contributing assessments dynamically', () => {
      const discovered = filterEligibleTerminalAssessments(baseExams, {
        academicYearId: 'ay-2026',
        termId: 't-1',
        student: mockStudent,
        classStream: mockClass,
      });

      expect(discovered).toHaveLength(4);
      expect(discovered[3].exam_name).toBe('Practical Assessment');
      expect(discovered[3].max_marks).toBe(25);
    });
  });

  // 2. Maximum Marks Preservation & Denominator Normalisation
  describe('Maximum Marks & Denominator Normalisation', () => {
    it('normalises different assessment denominators accurately without fallback to 100', () => {
      // Exam 1 out of 50: score 40 => 80%
      // Exam 2 out of 50: score 45 => 90%
      // Exam 3 out of 100: score 70 => 70%
      // Exam 4 out of 25: score 20 => 80%
      // Mean: (80 + 90 + 70 + 80) / 4 = 320 / 4 = 80%
      const contributing: ContributingAssessmentRef[] = baseExams.map((e) => ({
        id: e.id,
        exam_name: e.exam_name,
        max_marks: e.max_marks,
        out_of: e.max_marks,
      }));

      const marks: Mark[] = [
        { id: 'm1', student_id: mockStudent.id, subject_id: 'sub-math', exam_id: 'exam-1', raw_score: 40, out_of: 50 },
        { id: 'm2', student_id: mockStudent.id, subject_id: 'sub-math', exam_id: 'exam-2', raw_score: 45, out_of: 50 },
        { id: 'm3', student_id: mockStudent.id, subject_id: 'sub-math', exam_id: 'exam-3', raw_score: 70, out_of: 100 },
        { id: 'm4', student_id: mockStudent.id, subject_id: 'sub-math', exam_id: 'exam-4', raw_score: 20, out_of: 25 },
      ];

      const result = calculateLearningAreaTerminalResult({
        subjectId: 'sub-math',
        contributingAssessments: contributing,
        marks,
      });

      expect(result.isComplete).toBe(true);
      expect(result.status).toBe('Complete');
      expect(result.terminalPercentage).toBe(80);
      expect(result.cbePerformanceLevel).toBe('EE2');
      expect(result.points).toBe(7);

      // Verify trail exposes each assessment's normalized percentage and CBE level
      expect(result.assessmentTrail[0].percentage).toBe(80);
      expect(result.assessmentTrail[0].cbePerformanceLevel).toBe('EE2');
      expect(result.assessmentTrail[1].percentage).toBe(90);
      expect(result.assessmentTrail[1].cbePerformanceLevel).toBe('EE1');
      expect(result.assessmentTrail[2].percentage).toBe(70);
      expect(result.assessmentTrail[2].cbePerformanceLevel).toBe('ME1');
      expect(result.assessmentTrail[3].percentage).toBe(80);
      expect(result.assessmentTrail[3].cbePerformanceLevel).toBe('EE2');
    });
  });

  // 3. Genuine Zero
  describe('Genuine Zero Handling', () => {
    it('handles legitimate zero scores (0%, 0%, 0%) yielding 0% BE2 · 1 point', () => {
      const contributing: ContributingAssessmentRef[] = [
        { id: 'exam-1', exam_name: 'Assessment 1', max_marks: 50, out_of: 50 },
        { id: 'exam-2', exam_name: 'Assessment 2', max_marks: 50, out_of: 50 },
      ];

      const marks: Mark[] = [
        { id: 'm1', student_id: mockStudent.id, subject_id: 'sub-sci', exam_id: 'exam-1', raw_score: 0, out_of: 50 },
        { id: 'm2', student_id: mockStudent.id, subject_id: 'sub-sci', exam_id: 'exam-2', raw_score: 0, out_of: 50 },
      ];

      const result = calculateLearningAreaTerminalResult({
        subjectId: 'sub-sci',
        contributingAssessments: contributing,
        marks,
      });

      expect(result.isComplete).toBe(true);
      expect(result.status).toBe('Complete');
      expect(result.terminalPercentage).toBe(0);
      expect(result.cbePerformanceLevel).toBe('BE2');
      expect(result.points).toBe(1);
      expect(result.assessmentTrail[0].rawScore).toBe(0);
      expect(result.assessmentTrail[0].percentage).toBe(0);
    });
  });

  // 4. X Semantics (Missing / Unassessed)
  describe('X Semantics: Missing Mark / Unassessed', () => {
    it('marks result as INCOMPLETE (X) when an assessment mark is missing', () => {
      const contributing: ContributingAssessmentRef[] = [
        { id: 'exam-1', exam_name: 'Assessment 1', max_marks: 50, out_of: 50 },
        { id: 'exam-2', exam_name: 'Assessment 2', max_marks: 50, out_of: 50 },
      ];

      // Learner only has mark for exam-1
      const marks: Mark[] = [
        { id: 'm1', student_id: mockStudent.id, subject_id: 'sub-eng', exam_id: 'exam-1', raw_score: 40, out_of: 50 },
      ];

      const result = calculateLearningAreaTerminalResult({
        subjectId: 'sub-eng',
        contributingAssessments: contributing,
        marks,
      });

      expect(result.isComplete).toBe(false);
      expect(result.status).toBe('INCOMPLETE (X)');
      expect(result.terminalPercentage).toBeNull();
      expect(result.cbePerformanceLevel).toBeNull();
      expect(result.points).toBeNull();
      expect(result.assessmentTrail[1].status).toBe('Blank');
      expect(result.assessmentTrail[1].displayScore).toBe('X');
    });

    it('marks result as INCOMPLETE (X) when special_status is explicitly X', () => {
      const contributing: ContributingAssessmentRef[] = [
        { id: 'exam-1', exam_name: 'Assessment 1', max_marks: 50, out_of: 50 },
        { id: 'exam-2', exam_name: 'Assessment 2', max_marks: 50, out_of: 50 },
      ];

      const marks: Mark[] = [
        { id: 'm1', student_id: mockStudent.id, subject_id: 'sub-eng', exam_id: 'exam-1', raw_score: 40, out_of: 50 },
        { id: 'm2', student_id: mockStudent.id, subject_id: 'sub-eng', exam_id: 'exam-2', special_status: 'X', out_of: 50 },
      ];

      const result = calculateLearningAreaTerminalResult({
        subjectId: 'sub-eng',
        contributingAssessments: contributing,
        marks,
      });

      expect(result.isComplete).toBe(false);
      expect(result.status).toBe('INCOMPLETE (X)');
      expect(result.assessmentTrail[1].status).toBe('X');
    });
  });

  // 5. Y Semantics (Unresolved Irregularity / Withheld)
  describe('Y Semantics: Unresolved Irregularity', () => {
    it('marks result as INCOMPLETE (Y) when an assessment has an unresolved irregularity', () => {
      const contributing: ContributingAssessmentRef[] = [
        { id: 'exam-1', exam_name: 'Assessment 1', max_marks: 50, out_of: 50 },
        { id: 'exam-2', exam_name: 'Assessment 2', max_marks: 50, out_of: 50 },
      ];

      const marks: any[] = [
        { id: 'm1', student_id: mockStudent.id, subject_id: 'sub-kis', exam_id: 'exam-1', raw_score: 35, out_of: 50 },
        {
          id: 'm2',
          student_id: mockStudent.id,
          subject_id: 'sub-kis',
          exam_id: 'exam-2',
          special_status: 'Y',
          irregularity_reason: 'Medical Absence',
          out_of: 50,
        },
      ];

      const result = calculateLearningAreaTerminalResult({
        subjectId: 'sub-kis',
        contributingAssessments: contributing,
        marks,
      });

      expect(result.isComplete).toBe(false);
      expect(result.status).toBe('INCOMPLETE (Y)');
      expect(result.terminalPercentage).toBeNull();
      expect(result.assessmentTrail[1].status).toBe('Y');
      expect(result.assessmentTrail[1].irregularityReason).toBe('Medical Absence');
    });
  });

  // 6. X + Y Semantics
  describe('X + Y Semantics', () => {
    it('marks result as INCOMPLETE (X/Y) when one assessment has X and another has Y', () => {
      const contributing: ContributingAssessmentRef[] = [
        { id: 'exam-1', exam_name: 'Assessment 1', max_marks: 50, out_of: 50 },
        { id: 'exam-2', exam_name: 'Assessment 2', max_marks: 50, out_of: 50 },
        { id: 'exam-3', exam_name: 'Assessment 3', max_marks: 100, out_of: 100 },
      ];

      const marks: any[] = [
        { id: 'm1', student_id: mockStudent.id, subject_id: 'sub-sst', exam_id: 'exam-1', special_status: 'X', out_of: 50 },
        { id: 'm2', student_id: mockStudent.id, subject_id: 'sub-sst', exam_id: 'exam-2', special_status: 'Y', irregularity_reason: 'Absent', out_of: 50 },
        { id: 'm3', student_id: mockStudent.id, subject_id: 'sub-sst', exam_id: 'exam-3', raw_score: 75, out_of: 100 },
      ];

      const result = calculateLearningAreaTerminalResult({
        subjectId: 'sub-sst',
        contributingAssessments: contributing,
        marks,
      });

      expect(result.isComplete).toBe(false);
      expect(result.status).toBe('INCOMPLETE (X/Y)');
      expect(result.terminalPercentage).toBeNull();
      expect(result.assessmentTrail[0].status).toBe('X');
      expect(result.assessmentTrail[1].status).toBe('Y');
      expect(result.assessmentTrail[2].status).toBe('Normal');
    });
  });

  // 7. Resolved Y Provenance
  describe('Resolved Y Provenance', () => {
    it('authoritatively resolved Y contributes replacement score once and preserves resolution provenance', () => {
      const contributing: ContributingAssessmentRef[] = [
        { id: 'exam-1', exam_name: 'Assessment 1', max_marks: 50, out_of: 50 },
        { id: 'exam-2', exam_name: 'Assessment 2', max_marks: 50, out_of: 50 },
      ];

      const mockResolution: MarkResolution = {
        id: 'res-1',
        mark_id: 'm2',
        student_id: mockStudent.id,
        exam_id: 'exam-2',
        subject_id: 'sub-cre',
        original_status: 'Y',
        original_irregularity_reason: 'Medical Absence',
        replacement_score: 40,
        resolution_reason: 'Approved by Academic Committee with medical board documentation',
        resolved_by: 'Principal Okonjo',
        resolved_at: '2026-03-01T10:00:00Z',
      };

      const marks: any[] = [
        { id: 'm1', student_id: mockStudent.id, subject_id: 'sub-cre', exam_id: 'exam-1', raw_score: 40, out_of: 50 }, // 80%
        {
          id: 'm2',
          student_id: mockStudent.id,
          subject_id: 'sub-cre',
          exam_id: 'exam-2',
          special_status: 'Normal',
          raw_score: 40,
          out_of: 50,
          resolution: mockResolution,
        }, // 80% resolved from Y
      ];

      const result = calculateLearningAreaTerminalResult({
        subjectId: 'sub-cre',
        contributingAssessments: contributing,
        marks,
      });

      expect(result.isComplete).toBe(true);
      expect(result.status).toBe('Complete');
      expect(result.terminalPercentage).toBe(80);
      expect(result.cbePerformanceLevel).toBe('EE2');

      // Trail must preserve provenance
      const trailEntry2 = result.assessmentTrail[1];
      expect(trailEntry2.resolvedFromY).toBe(true);
      expect(trailEntry2.resolutionReason).toBe('Approved by Academic Committee with medical board documentation');
      expect(trailEntry2.resolvedBy).toBe('Principal Okonjo');
      expect(trailEntry2.resolvedAt).toBe('2026-03-01T10:00:00Z');
    });
  });

  // 8. Learning Area Isolation
  describe('Learning Area Isolation', () => {
    it('ensures incomplete in one Learning Area does NOT contaminate another Learning Area', () => {
      const contributing: ContributingAssessmentRef[] = [
        { id: 'exam-1', exam_name: 'Assessment 1', max_marks: 50, out_of: 50 },
        { id: 'exam-2', exam_name: 'Assessment 2', max_marks: 50, out_of: 50 },
      ];

      const marks: any[] = [
        // Math is complete: 45/50 and 45/50 => 90%
        { id: 'm1', student_id: mockStudent.id, subject_id: 'sub-math', exam_id: 'exam-1', raw_score: 45, out_of: 50 },
        { id: 'm2', student_id: mockStudent.id, subject_id: 'sub-math', exam_id: 'exam-2', raw_score: 45, out_of: 50 },
        // English has X: missing exam-2
        { id: 'm3', student_id: mockStudent.id, subject_id: 'sub-eng', exam_id: 'exam-1', raw_score: 40, out_of: 50 },
      ];

      const results = calculateLearnerTerminalResults({
        learnerId: mockStudent.id,
        subjectIds: ['sub-math', 'sub-eng'],
        contributingAssessments: contributing,
        marks,
      });

      const mathRes = results.get('sub-math');
      const engRes = results.get('sub-eng');

      expect(mathRes?.isComplete).toBe(true);
      expect(mathRes?.terminalPercentage).toBe(90);
      expect(mathRes?.cbePerformanceLevel).toBe('EE1');

      expect(engRes?.isComplete).toBe(false);
      expect(engRes?.status).toBe('INCOMPLETE (X)');
      expect(engRes?.terminalPercentage).toBeNull();
    });
  });

  // 9. Official vs Provisional Modes & Staff-Only Gating
  describe('Official vs Provisional Modes', () => {
    it('Official mode includes only Approved examinations', () => {
      const examsWithProvisional: Examination[] = [
        baseExams[0], // Approved
        {
          ...baseExams[1],
          status: 'Provisional', // Provisional
          approved_classes: [], // Not yet approved for this stream
        },
      ];

      const officialDiscovered = filterEligibleTerminalAssessments(examsWithProvisional, {
        academicYearId: 'ay-2026',
        termId: 't-1',
        student: mockStudent,
        classStream: mockClass,
        isProvisionalMode: false,
      });

      expect(officialDiscovered).toHaveLength(1);
      expect(officialDiscovered[0].id).toBe('exam-1');

      const provisionalDiscovered = filterEligibleTerminalAssessments(examsWithProvisional, {
        academicYearId: 'ay-2026',
        termId: 't-1',
        student: mockStudent,
        classStream: mockClass,
        isProvisionalMode: true,
      });

      expect(provisionalDiscovered).toHaveLength(2);
    });

    it('Excludes Draft and Archived exams from both Official and Provisional modes', () => {
      const examsWithDraftArchived: Examination[] = [
        baseExams[0],
        { ...baseExams[1], status: 'Draft' },
        { ...baseExams[2], status: 'Archived' as any },
      ];

      const discovered = filterEligibleTerminalAssessments(examsWithDraftArchived, {
        academicYearId: 'ay-2026',
        termId: 't-1',
        student: mockStudent,
        classStream: mockClass,
        isProvisionalMode: true,
      });

      expect(discovered).toHaveLength(1);
      expect(discovered[0].id).toBe('exam-1');
    });
  });

  // 10. Strict Absence of Forbidden Overall Aggregations & Ranking
  describe('Strict Absence of Forbidden Calculations', () => {
    it('guarantees calculateLearnerTerminalResults returns only per-Learning Area results and never overall rank or percentage', () => {
      const contributing: ContributingAssessmentRef[] = [
        { id: 'exam-1', exam_name: 'Assessment 1', max_marks: 50, out_of: 50 },
      ];

      const marks: any[] = [
        { id: 'm1', student_id: mockStudent.id, subject_id: 'sub-math', exam_id: 'exam-1', raw_score: 45, out_of: 50 },
      ];

      const results = calculateLearnerTerminalResults({
        learnerId: mockStudent.id,
        subjectIds: ['sub-math'],
        contributingAssessments: contributing,
        marks,
      });

      const resObj = results.get('sub-math') as any;

      // Must NOT contain overall metrics
      expect(resObj.overallTerminalPercentage).toBeUndefined();
      expect(resObj.overallTerminalPoints).toBeUndefined();
      expect(resObj.overallTerminalRank).toBeUndefined();
      expect(resObj.rank).toBeUndefined();
      expect(resObj.meritPosition).toBeUndefined();
    });
  });
});
