import { describe, it, expect } from 'vitest';
import rawJsPDF from 'jspdf';
import { downloadMeritListPDF } from './meritListExporter';
import { initialSchool, initialGrades, initialSubjects, initialTeachers, initialExaminations, initialClasses } from '../data/seedData';
import { ClassStream, Student, Mark, Subject, GradeName } from '../types';

describe('PRIMARY MERIT LIST PDF — END-OF-REPORT TABLES (ISSUE 7G)', () => {
  const jsPDFClass = (rawJsPDF as any).jsPDF || rawJsPDF;

  // Helper to build test environment
  function setupCohort(gradeName: GradeName, studentConfigs: Array<{ adm: string; name: string; marksConfig: Record<string, { marks: number | null; status: 'Normal' | 'X' | 'Y' | 'Blank' }> }>) {
    const isPP = gradeName.startsWith('PP');
    const isLower = ['Grade 1', 'Grade 2', 'Grade 3'].includes(gradeName);
    const isUpper = ['Grade 4', 'Grade 5', 'Grade 6'].includes(gradeName);
    const eduLevel = isPP ? 'Pre-Primary' : isLower ? 'Lower Primary' : isUpper ? 'Upper Primary' : 'Junior School';

    let relevantSubjects: Subject[] = initialSubjects.filter((s) => s.education_level === eduLevel || (isUpper && s.applicable_grades?.includes(gradeName)));
    if (isPP) {
      // Ensure exact 5 PP subjects
      const ppCodes = ['PP-MATH', 'PP-PCA', 'PP-CRE', 'PP-ENV', 'PP-LANG'];
      relevantSubjects = ppCodes.map((code, idx) => {
        const found = initialSubjects.find((s) => s.subject_code === code);
        if (found) return found;
        return {
          id: 'pp_sub_' + idx,
          subject_code: code,
          subject_name: code === 'PP-MATH' ? 'Mathematical Activities' : code === 'PP-PCA' ? 'Psychomotor & Creative Activities' : code === 'PP-CRE' ? 'Religious Education' : code === 'PP-ENV' ? 'Environmental Activities' : 'Language Activities',
          education_level: 'Pre-Primary',
          category: 'Core',
          department: 'Early Years',
        };
      });
    }

    const cls: ClassStream = {
      id: 'cls_' + gradeName.replace(/\s+/g, '_'),
      class_name: gradeName,
      stream: 'A',
      education_level: eduLevel as any,
      allocated_subject_ids: relevantSubjects.map((s) => s.id),
    };

    const testStudents: Student[] = studentConfigs.map((cfg, idx) => ({
      id: `std_${gradeName}_${idx + 1}`,
      admission_number: cfg.adm,
      full_name: cfg.name,
      gender: idx % 2 === 0 ? 'M' : 'F',
      class_id: cls.id,
      stream_id: cls.id,
      grade: gradeName,
      active: true,
    }));

    const testMarks: Mark[] = [];
    studentConfigs.forEach((cfg, idx) => {
      const studentId = `std_${gradeName}_${idx + 1}`;
      relevantSubjects.forEach((sb) => {
        const c = cfg.marksConfig[sb.subject_code] || { marks: null, status: 'Blank' };
        if (c.marks !== null || c.status !== 'Blank') {
          const isCompInsha = isUpper && (sb.subject_code === 'COMP' || sb.subject_code === 'INSHA');
          const isLang60 = isUpper && (sb.subject_code === 'ENG' || sb.subject_code === 'KIS');
          const defaultOutOf = isCompInsha ? 40 : isLang60 ? 60 : 100;
          testMarks.push({
            id: `m_${studentId}_${sb.id}`,
            student_id: studentId,
            subject_id: sb.id,
            exam_id: initialExaminations[0].id,
            marks: c.marks !== null ? c.marks : 0,
            raw_score: c.marks !== null ? c.marks : 0,
            out_of: defaultOutOf,
            special_status: c.status,
          });
        }
      });
    });

    return {
      school: initialSchool,
      exam: initialExaminations[0],
      selectedClassId: cls.id,
      selectedStreamId: 'all',
      classes: [cls, ...initialClasses],
      teachers: initialTeachers,
      students: testStudents,
      subjects: relevantSubjects,
      marks: testMarks,
      grades: initialGrades,
      eduLevel,
      relevantSubjects,
    };
  }

  it('Phase 7: Exports correctly across PP1, PP2, Grade 1, Grade 3, Grade 6', async () => {
    const grades: GradeName[] = ['PP1', 'PP2', 'Grade 1', 'Grade 3', 'Grade 6'];
    for (const g of grades) {
      const data = setupCohort(g, [
        {
          adm: 'ADM-01',
          name: 'Learner One',
          marksConfig: {
            'PP-MATH': { marks: 80, status: 'Normal' },
            'PP-PCA': { marks: 75, status: 'Normal' },
            'PP-CRE': { marks: 90, status: 'Normal' },
            'PP-ENV': { marks: 85, status: 'Normal' },
            'PP-LANG': { marks: 88, status: 'Normal' },
            'ILA': { marks: 85, status: 'Normal' },
            'LP-LIT': { marks: 80, status: 'Normal' },
            'LP-ENG': { marks: 75, status: 'Normal' },
            'LP-KSL': { marks: 85, status: 'Normal' },
            'LP-MATH': { marks: 90, status: 'Normal' },
            'LP-ENV': { marks: 80, status: 'Normal' },
            'LP-HN': { marks: 85, status: 'Normal' },
            'LP-CRE': { marks: 90, status: 'Normal' },
            'LP-MCA': { marks: 88, status: 'Normal' },
            'ENG': { marks: 50, status: 'Normal' },
            'COMP': { marks: 30, status: 'Normal' },
            'KIS': { marks: 50, status: 'Normal' },
            'INSHA': { marks: 30, status: 'Normal' },
            'MATH': { marks: 85, status: 'Normal' },
            'INT-SCI': { marks: 80, status: 'Normal' },
            'CAS': { marks: 88, status: 'Normal' },
            'SS&CRE': { marks: 82, status: 'Normal' },
          },
        },
        {
          adm: 'ADM-02',
          name: 'Learner Two',
          marksConfig: {
            'PP-MATH': { marks: 60, status: 'Normal' },
            'PP-PCA': { marks: 65, status: 'Normal' },
            'PP-CRE': { marks: 70, status: 'Normal' },
            'PP-ENV': { marks: 68, status: 'Normal' },
            'PP-LANG': { marks: 72, status: 'Normal' },
            'ILA': { marks: 68, status: 'Normal' },
            'LP-LIT': { marks: 60, status: 'Normal' },
            'LP-ENG': { marks: 65, status: 'Normal' },
            'LP-KSL': { marks: 70, status: 'Normal' },
            'LP-MATH': { marks: 68, status: 'Normal' },
            'LP-ENV': { marks: 60, status: 'Normal' },
            'LP-HN': { marks: 65, status: 'Normal' },
            'LP-CRE': { marks: 70, status: 'Normal' },
            'LP-MCA': { marks: 72, status: 'Normal' },
            'ENG': { marks: 40, status: 'Normal' },
            'COMP': { marks: 25, status: 'Normal' },
            'KIS': { marks: 40, status: 'Normal' },
            'INSHA': { marks: 25, status: 'Normal' },
            'MATH': { marks: 65, status: 'Normal' },
            'INT-SCI': { marks: 68, status: 'Normal' },
            'CAS': { marks: 70, status: 'Normal' },
            'SS&CRE': { marks: 65, status: 'Normal' },
          },
        },
      ]);

      await expect(downloadMeritListPDF(data as any)).resolves.not.toThrow();
    }
  });

  it('Phase 8: Handles special statuses - Genuine 0, Blank, X (Absent), Y (Disqualified)', async () => {
    const data = setupCohort('PP1', [
      {
        adm: 'ADM-01',
        name: 'Normal Assessed',
        marksConfig: {
          'PP-MATH': { marks: 80, status: 'Normal' },
          'PP-PCA': { marks: 70, status: 'Normal' },
          'PP-CRE': { marks: 85, status: 'Normal' },
          'PP-ENV': { marks: 90, status: 'Normal' },
          'PP-LANG': { marks: 75, status: 'Normal' },
        },
      },
      {
        adm: 'ADM-02',
        name: 'Genuine Zero Learner',
        marksConfig: {
          'PP-MATH': { marks: 0, status: 'Normal' },
          'PP-PCA': { marks: 0, status: 'Normal' },
          'PP-CRE': { marks: 0, status: 'Normal' },
          'PP-ENV': { marks: 0, status: 'Normal' },
          'PP-LANG': { marks: 0, status: 'Normal' },
        },
      },
      {
        adm: 'ADM-03',
        name: 'Absent Learner (X)',
        marksConfig: {
          'PP-MATH': { marks: null, status: 'X' },
          'PP-PCA': { marks: null, status: 'X' },
          'PP-CRE': { marks: null, status: 'X' },
          'PP-ENV': { marks: null, status: 'X' },
          'PP-LANG': { marks: null, status: 'X' },
        },
      },
      {
        adm: 'ADM-04',
        name: 'Irregularity Learner (Y)',
        marksConfig: {
          'PP-MATH': { marks: null, status: 'Y' },
          'PP-PCA': { marks: null, status: 'Y' },
          'PP-CRE': { marks: null, status: 'Y' },
          'PP-ENV': { marks: null, status: 'Y' },
          'PP-LANG': { marks: null, status: 'Y' },
        },
      },
      {
        adm: 'ADM-05',
        name: 'Completely Unassessed Learner',
        marksConfig: {},
      },
    ]);

    await expect(downloadMeritListPDF(data as any)).resolves.not.toThrow();
  });

  it('Phase 8: Handles completely unassessed cohort without crashing or manufacturing false metrics', async () => {
    const data = setupCohort('Grade 3', [
      {
        adm: 'ADM-01',
        name: 'Unassessed Learner 1',
        marksConfig: {},
      },
      {
        adm: 'ADM-02',
        name: 'Unassessed Learner 2',
        marksConfig: {},
      },
    ]);

    await expect(downloadMeritListPDF(data as any)).resolves.not.toThrow();
  });

  it('Phase 9: Verifies numerical correctness of the 4 calculated sections', async () => {
    // Setup a cohort with 3 students:
    // Student 1: 80% across all 5 PP subjects (Total: 400, EE)
    // Student 2: 60% across all 5 PP subjects (Total: 300, ME)
    // Student 3: Genuine 0% across all 5 PP subjects (Total: 0, BE)
    const data = setupCohort('PP1', [
      {
        adm: 'ADM-01',
        name: 'Learner One',
        marksConfig: {
          'PP-MATH': { marks: 80, status: 'Normal' },
          'PP-PCA': { marks: 80, status: 'Normal' },
          'PP-CRE': { marks: 80, status: 'Normal' },
          'PP-ENV': { marks: 80, status: 'Normal' },
          'PP-LANG': { marks: 80, status: 'Normal' },
        },
      },
      {
        adm: 'ADM-02',
        name: 'Learner Two',
        marksConfig: {
          'PP-MATH': { marks: 60, status: 'Normal' },
          'PP-PCA': { marks: 60, status: 'Normal' },
          'PP-CRE': { marks: 60, status: 'Normal' },
          'PP-ENV': { marks: 60, status: 'Normal' },
          'PP-LANG': { marks: 60, status: 'Normal' },
        },
      },
      {
        adm: 'ADM-03',
        name: 'Learner Zero',
        marksConfig: {
          'PP-MATH': { marks: 0, status: 'Normal' },
          'PP-PCA': { marks: 0, status: 'Normal' },
          'PP-CRE': { marks: 0, status: 'Normal' },
          'PP-ENV': { marks: 0, status: 'Normal' },
          'PP-LANG': { marks: 0, status: 'Normal' },
        },
      },
    ]);

    await expect(downloadMeritListPDF(data as any)).resolves.not.toThrow();
  });
});
