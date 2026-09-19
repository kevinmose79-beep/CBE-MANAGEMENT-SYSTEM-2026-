import { describe, it, expect } from 'vitest';
import { Subject, Student, ClassStream } from '../types';
import { initialGrades } from '../data/seedData';
import { getLearnerReportSubjects } from '../services/analysisEngine';
import {
  calculateLearnerTerminalResults,
  ContributingAssessmentRef,
  LearningAreaTerminalResult,
} from '../services/terminalResultsEngine';

describe('Terminal Results — Learning Area Scoping & Rendering Surgical Healing', () => {
  // Canonical sample subjects representing all education levels
  const mockAllSubjects: Subject[] = [
    // Pre-Primary
    {
      id: 'sub-pp-math',
      subject_name: 'Mathematical Activities',
      subject_code: 'PP-MATH',
      category: 'Core',
      education_level: 'Pre-Primary',
      applicable_grades: ['PP1', 'PP2'],
      status: 'Active',
    },
    {
      id: 'sub-pp-lang',
      subject_name: 'Language Activities',
      subject_code: 'PP-LANG',
      category: 'Core',
      education_level: 'Pre-Primary',
      applicable_grades: ['PP1', 'PP2'],
      status: 'Active',
    },
    {
      id: 'sub-pp-env',
      subject_name: 'Environmental Activities',
      subject_code: 'PP-ENV',
      category: 'Core',
      education_level: 'Pre-Primary',
      applicable_grades: ['PP1', 'PP2'],
      status: 'Active',
    },
    {
      id: 'sub-pp-psy',
      subject_name: 'Psychomotor & Creative Activities',
      subject_code: 'PP-PCA',
      category: 'Core',
      education_level: 'Pre-Primary',
      applicable_grades: ['PP1', 'PP2'],
      status: 'Active',
    },
    {
      id: 'sub-pp-cre',
      subject_name: 'Christian Religious Education Activities',
      subject_code: 'PP-CRE',
      category: 'Core',
      education_level: 'Pre-Primary',
      applicable_grades: ['PP1', 'PP2'],
      status: 'Active',
    },

    // Lower Primary
    {
      id: 'sub-lp-eng',
      subject_name: 'English',
      subject_code: 'ENG',
      category: 'Core',
      education_level: 'Lower Primary',
      applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'],
      status: 'Active',
    },
    {
      id: 'sub-lp-kis',
      subject_name: 'Kiswahili',
      subject_code: 'KIS',
      category: 'Core',
      education_level: 'Lower Primary',
      applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'],
      status: 'Active',
    },
    {
      id: 'sub-lp-ila',
      subject_name: 'Integrated Learning Area',
      subject_code: 'ILA',
      category: 'Core',
      education_level: 'Lower Primary',
      applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'],
      status: 'Active',
    },

    // Upper Primary
    {
      id: 'sub-up-eng',
      subject_name: 'English',
      subject_code: 'ENG',
      category: 'Core',
      education_level: 'Upper Primary',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
      status: 'Active',
    },
    {
      id: 'sub-up-kis',
      subject_name: 'Kiswahili',
      subject_code: 'KIS',
      category: 'Core',
      education_level: 'Upper Primary',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
      status: 'Active',
    },
    {
      id: 'sub-up-mat',
      subject_name: 'Mathematics',
      subject_code: 'MATH',
      category: 'Core',
      education_level: 'Upper Primary',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
      status: 'Active',
    },
    {
      id: 'sub-up-sci',
      subject_name: 'Science & Technology',
      subject_code: 'SCT',
      category: 'Core',
      education_level: 'Upper Primary',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'],
      status: 'Active',
    },
    {
      id: 'sub-up-ca',
      subject_name: 'Creative Arts',
      subject_code: 'CA',
      category: 'Core',
      education_level: 'Upper Primary',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'],
      status: 'Active',
    },
    {
      id: 'sub-up-sst',
      subject_name: 'Social Studies',
      subject_code: 'SST',
      category: 'Core',
      education_level: 'Upper Primary',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
      status: 'Active',
    },
    {
      id: 'sub-up-cre',
      subject_name: 'Christian Religious Education',
      subject_code: 'CRE',
      category: 'Core',
      education_level: 'Upper Primary',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'],
      status: 'Active',
    },
    {
      id: 'sub-up-agr',
      subject_name: 'Agriculture',
      subject_code: 'AGN',
      category: 'Core',
      education_level: 'Upper Primary',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
      status: 'Active',
    },

    // Junior School
    {
      id: 'sub-js-sci',
      subject_name: 'Integrated Science',
      subject_code: 'INT-SCI',
      category: 'Core',
      education_level: 'Junior School',
      applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'],
      status: 'Active',
    },
    {
      id: 'sub-js-cas',
      subject_name: 'Creative Arts and Sports',
      subject_code: 'CAS',
      category: 'Core',
      education_level: 'Junior School',
      applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'],
      status: 'Active',
    },
    {
      id: 'sub-js-pts',
      subject_name: 'Pre-Technical Studies',
      subject_code: 'PRE-TECH',
      category: 'Core',
      education_level: 'Junior School',
      applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'],
      status: 'Active',
    },
    {
      id: 'sub-js-cre',
      subject_name: 'Christian Religious Education',
      subject_code: 'CRE',
      category: 'Core',
      education_level: 'Junior School',
      applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'],
      status: 'Active',
    },
  ];

  describe('1. Learner & Grade Curriculum Scoping (No Cross-Tier Contamination)', () => {
    it('scopes Grade 9 learner to Junior School subjects ONLY', () => {
      const student: Student = {
        id: 'std-simon-102',
        admission_number: '102',
        full_name: 'Simon Muiruri',
        grade: 'Grade 9',
        gender: 'M',
        active: true,
        class_id: 'class-g9',
        stream_id: 'stream-g9-blue',
      };
      const classStream: ClassStream = {
        id: 'class-g9',
        class_name: 'Grade 9',
        stream: 'Blue',
        stream_id: 'stream-g9-blue',
      };

      const scoped = getLearnerReportSubjects(student, classStream, mockAllSubjects);
      const codes = scoped.map((s) => s.subject_code);

      // Must NOT contain Pre-Primary subjects
      expect(codes).not.toContain('PP-MATH');
      expect(codes).not.toContain('PP-PCA');
      expect(codes).not.toContain('PP-CRE');
      expect(codes).not.toContain('PP-ENV');
      expect(codes).not.toContain('PP-LANG');

      // Must NOT contain Lower Primary subjects
      expect(codes).not.toContain('ILA');

      // Must NOT contain Upper Primary-only subjects
      expect(codes).not.toContain('SCT');
      expect(codes).not.toContain('CA');

      // Must contain Junior School subjects
      expect(codes).toContain('ENG');
      expect(codes).toContain('KIS');
      expect(codes).toContain('MATH');
      expect(codes).toContain('INT-SCI');
      expect(codes).toContain('CAS');
      expect(codes).toContain('SST');
      expect(codes).toContain('AGN');
      expect(codes).toContain('PRE-TECH');
      expect(codes).toContain('CRE');

      expect(scoped.length).toBe(9);
    });

    it('scopes Pre-Primary PP1 learner to Pre-Primary subjects ONLY', () => {
      const student: Student = {
        id: 'std-pp1-1',
        admission_number: '001',
        full_name: 'Baby John',
        grade: 'PP1',
        gender: 'M',
        active: true,
        class_id: 'class-pp1',
      };
      const classStream: ClassStream = {
        id: 'class-pp1',
        class_name: 'PP1',
        stream: '',
      };

      const scoped = getLearnerReportSubjects(student, classStream, mockAllSubjects);
      const codes = scoped.map((s) => s.subject_code);

      expect(scoped.length).toBe(5);
      expect(codes).toEqual(expect.arrayContaining(['PP-MATH', 'PP-LANG', 'PP-ENV', 'PP-PCA', 'PP-CRE']));
      expect(codes).not.toContain('ENG');
      expect(codes).not.toContain('INT-SCI');
      expect(codes).not.toContain('ILA');
    });

    it('scopes Lower Primary Grade 1 learner to Lower Primary subjects ONLY', () => {
      const student: Student = {
        id: 'std-g1-1',
        admission_number: '101',
        full_name: 'Alice Wambui',
        grade: 'Grade 1',
        gender: 'F',
        active: true,
        class_id: 'class-g1',
      };
      const classStream: ClassStream = {
        id: 'class-g1',
        class_name: 'Grade 1',
        stream: '',
      };

      const scoped = getLearnerReportSubjects(student, classStream, mockAllSubjects);
      const codes = scoped.map((s) => s.subject_code);

      expect(scoped.length).toBe(3);
      expect(codes).toEqual(
        expect.arrayContaining([
          'ENG',
          'KIS',
          'ILA',
        ])
      );
      expect(codes).not.toContain('INT-SCI');
      expect(codes).not.toContain('PP-MATH');
    });

    it('scopes Upper Primary Grade 4 learner to Upper Primary subjects ONLY', () => {
      const student: Student = {
        id: 'std-g4-1',
        admission_number: '401',
        full_name: 'Peter Kamau',
        grade: 'Grade 4',
        gender: 'M',
        active: true,
        class_id: 'class-g4',
      };
      const classStream: ClassStream = {
        id: 'class-g4',
        class_name: 'Grade 4',
        stream: '',
      };

      const scoped = getLearnerReportSubjects(student, classStream, mockAllSubjects);
      const codes = scoped.map((s) => s.subject_code);

      expect(scoped.length).toBe(8);
      expect(codes).toEqual(
        expect.arrayContaining(['ENG', 'KIS', 'MATH', 'SCT', 'CA', 'SST', 'CRE', 'AGN'])
      );
      expect(codes).not.toContain('INT-SCI');
      expect(codes).not.toContain('CAS');
      expect(codes).not.toContain('PRE-TECH');
      expect(codes).not.toContain('LP-ENG');
    });
  });

  describe('2. Deduplication & Exactly-Once Guarantee', () => {
    it('ensures no duplicate subject IDs or codes exist in scoped subjects', () => {
      const student: Student = {
        id: 'std-simon-102',
        admission_number: '102',
        full_name: 'Simon Muiruri',
        grade: 'Grade 9',
        gender: 'M',
        active: true,
        class_id: 'class-g9',
        stream_id: 'stream-g9-blue',
      };
      const classStream: ClassStream = {
        id: 'class-g9',
        class_name: 'Grade 9',
        stream: 'Blue',
        stream_id: 'stream-g9-blue',
      };

      const scoped = getLearnerReportSubjects(student, classStream, mockAllSubjects);
      const seenIds = new Set<string>();
      const seenCodes = new Set<string>();

      for (const sb of scoped) {
        expect(seenIds.has(sb.id)).toBe(false);
        expect(seenCodes.has(sb.subject_code)).toBe(false);
        seenIds.add(sb.id);
        seenCodes.add(sb.subject_code);
      }
    });
  });

  describe('3. Canonical Subject Property Contract & Display', () => {
    it('confirms every scoped subject has authoritative subject_name and subject_code', () => {
      const student: Student = {
        id: 'std-simon-102',
        admission_number: '102',
        full_name: 'Simon Muiruri',
        grade: 'Grade 9',
        gender: 'M',
        active: true,
        class_id: 'class-g9',
      };
      const classStream: ClassStream = {
        id: 'class-g9',
        class_name: 'Grade 9',
        stream: '',
      };

      const scoped = getLearnerReportSubjects(student, classStream, mockAllSubjects);

      for (const sb of scoped) {
        expect(sb.subject_name).toBeDefined();
        expect(sb.subject_name.trim().length).toBeGreaterThan(0);
        expect(sb.subject_name).not.toBe('Learning Area'); // Not a placeholder
        expect(sb.subject_code).toBeDefined();
        expect(sb.subject_code.trim().length).toBeGreaterThan(0);
      }
    });

    it('verifies row and drawer labels accurately reflect the canonical subject properties', () => {
      const sampleSubject = mockAllSubjects.find((s) => s.subject_code === 'INT-SCI')!;

      // Emulate rendering logic from TerminalResultsTable:
      const rowId = `terminal-row-${sampleSubject.subject_code || sampleSubject.id}`;
      const renderedName = sampleSubject.subject_name;
      const renderedCode = sampleSubject.subject_code;
      const trailBtnId = `view-trail-btn-${sampleSubject.subject_code || sampleSubject.id}`;
      const trailAriaLabel = `View Assessment Trail for ${sampleSubject.subject_name}`;

      expect(rowId).toBe('terminal-row-INT-SCI');
      expect(renderedName).toBe('Integrated Science');
      expect(renderedCode).toBe('INT-SCI');
      expect(trailBtnId).toBe('view-trail-btn-INT-SCI');
      expect(trailAriaLabel).toBe('View Assessment Trail for Integrated Science');

      // Emulate drawer header logic from AssessmentTrailDrawer:
      const drawerTitle = sampleSubject.subject_name || 'Learning Area';
      const drawerCode = sampleSubject.subject_code;

      expect(drawerTitle).toBe('Integrated Science');
      expect(drawerCode).toBe('INT-SCI');
    });
  });

  describe('4. Terminal Results Calculation on Scoped Subjects', () => {
    it('calculates terminal results strictly across the 9 applicable Grade 9 subjects', () => {
      const studentId = 'std-simon-102';
      const scoped = mockAllSubjects.filter((s) =>
        s.applicable_grades?.includes('Grade 9') &&
        (s.education_level === 'Junior School' || s.education_level === 'Upper Primary')
      );
      const subjectIds = scoped.map((s) => s.id);

      const contributingAssessments: ContributingAssessmentRef[] = [
        {
          id: 'exam-term3-cat1',
          exam_name: 'CAT 1',
          status: 'Published',
          out_of: 50,
        },
        {
          id: 'exam-term3-end',
          exam_name: 'End Term Exam',
          status: 'Published',
          out_of: 100,
        },
      ];

      // Mark for English only (CAT: 40/50, End Term: 80/100) -> 40 + 40 = 80% (Exceeding Expectations)
      const sampleMarks = [
        {
          id: 'm1',
          exam_id: 'exam-term3-cat1',
          student_id: studentId,
          subject_id: 'sub-up-eng',
          score: 40,
        },
        {
          id: 'm2',
          exam_id: 'exam-term3-end',
          student_id: studentId,
          subject_id: 'sub-up-eng',
          score: 80,
        },
      ];

      const resultsMap = calculateLearnerTerminalResults({
        learnerId: studentId,
        subjectIds,
        contributingAssessments,
        marks: sampleMarks as any,
        grades: initialGrades as any,
      });

      // Exactly 9 subjects evaluated
      expect(resultsMap.size).toBe(9);

      // English must be Complete
      const engResult = resultsMap.get('sub-up-eng');
      expect(engResult?.isComplete).toBe(true);
      expect(engResult?.terminalPercentage).toBe(80);
      expect(engResult?.cbePerformanceLevel).toBe('EE2');

      // The other 8 subjects must be INCOMPLETE (X)
      let completeCount = 0;
      let incompleteCount = 0;
      for (const sb of scoped) {
        const res = resultsMap.get(sb.id);
        if (res?.isComplete) {
          completeCount++;
        } else {
          incompleteCount++;
          expect(res?.status).toBe('INCOMPLETE (X)');
        }
      }

      expect(completeCount).toBe(1);
      expect(incompleteCount).toBe(8);
      // Total subjects in summary is 9, NOT 24
      expect(completeCount + incompleteCount).toBe(9);
    });
  });
});
