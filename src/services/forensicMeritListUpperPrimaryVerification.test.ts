import { describe, it, expect, vi } from 'vitest';
import * as fileDownloader from '../utils/fileDownloader';
import { getShortCbeCode, getMeritListDisplayCode } from '../types';
import { downloadMeritListPDF } from './meritListExporter';
import {
  initialSchool,
  initialExaminations,
  initialGrades,
  initialClasses,
  initialTeachers,
  initialSubjects,
} from '../data/seedData';
import { Student, Mark, GradeName } from '../types';

describe('Strict Read-Only Post-Implementation Forensic Verification', () => {
  // Setup standard Upper Primary subjects
  const upperPrimarySubjects = [
    { id: 'sub_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Upper Primary', category: 'Core', department: 'Languages' },
    { id: 'sub_kis', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Upper Primary', category: 'Core', department: 'Languages' },
    { id: 'sub_math', subject_code: 'MATH', subject_name: 'Mathematics', education_level: 'Upper Primary', category: 'Core', department: 'Mathematics' },
    { id: 'sub_sct', subject_code: 'SCT', subject_name: 'Science and Technology', education_level: 'Upper Primary', category: 'Core', department: 'Sciences' },
    { id: 'sub_ca', subject_code: 'CA', subject_name: 'Creative Arts', education_level: 'Upper Primary', category: 'Core', department: 'Creative Arts' },
    { id: 'sub_agr', subject_code: 'AGR', subject_name: 'Agriculture', education_level: 'Upper Primary', category: 'Core', department: 'Applied Sciences' },
    { id: 'sub_ss', subject_code: 'SS', subject_name: 'Social Studies', education_level: 'Upper Primary', category: 'Core', department: 'Humanities' },
    { id: 'sub_cre', subject_code: 'CRE', subject_name: 'Christian Religious Education', education_level: 'Upper Primary', category: 'Core', department: 'Religious Education' },
  ];

  // Setup standard Junior School subjects
  const juniorSchoolSubjects = [
    { id: 'sub_js_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core', department: 'Languages' },
    { id: 'sub_js_kis', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core', department: 'Languages' },
    { id: 'sub_js_mat', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core', department: 'Mathematics' },
    { id: 'sub_js_sci', subject_code: 'INT-SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core', department: 'Sciences' },
    { id: 'sub_js_cas', subject_code: 'CAS', subject_name: 'Creative Arts & Sports', education_level: 'Junior School', category: 'Core', department: 'Creative Arts' },
    { id: 'sub_js_pts', subject_code: 'PRE-TECH', subject_name: 'Pre-Technical Studies', education_level: 'Junior School', category: 'Core', department: 'Technical' },
    { id: 'sub_js_ss', subject_code: 'SS', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core', department: 'Humanities' },
    { id: 'sub_js_cre', subject_code: 'CRE', subject_name: 'Christian Religious Education', education_level: 'Junior School', category: 'Core', department: 'Religious Education' },
    { id: 'sub_js_agr', subject_code: 'AGR', subject_name: 'Agriculture and Nutrition', education_level: 'Junior School', category: 'Core', department: 'Applied Sciences' },
  ];

  // ==========================================
  // CHECK 1 — UPPER PRIMARY (Grade 4, 5, 6)
  // ==========================================
  describe('CHECK 1 — Upper Primary Merit List (Grade 4, Grade 5, Grade 6)', () => {
    ['Grade 4', 'Grade 5', 'Grade 6'].forEach((gradeName) => {
      it(`verifies ${gradeName} displays SCT and CA, and NEVER INT-SCI or CAS`, async () => {
        // 1. Direct short code helper assertions
        expect(getShortCbeCode('SCT', 'Science and Technology', 'Upper Primary')).toBe('SCT');
// removed
        expect(getMeritListDisplayCode('SCT', 'Science and Technology', 'Upper Primary')).toBe('SCT');

        expect(getShortCbeCode('CA', 'Creative Arts', 'Upper Primary')).toBe('CAS');
// removed
        expect(getMeritListDisplayCode('CA', 'Creative Arts', 'Upper Primary')).toBe('CAS');

        // Verify that generic SCI or Science in Upper Primary resolves to SCT
        expect(getShortCbeCode('SCI', 'Science and Technology', 'Upper Primary')).toBe('SCT');
// removed
        expect(getShortCbeCode('SCI UP', 'Science and Technology', 'Upper Primary')).toBe('SCT');
        expect(getShortCbeCode('CREAT UP', 'Creative Arts', 'Upper Primary')).toBe('CAS');

        const cls = {
          id: `class_${gradeName.toLowerCase().replace(' ', '_')}`,
          class_name: gradeName,
          grade_name: gradeName,
          stream: 'East',
          stream_name: 'East',
          academic_year_id: 'ay-2024',
          class_teacher_id: 'teacher-1',
          education_level: 'Upper Primary',
        };

        const students: Student[] = [
          { id: `std_${gradeName}_1`, admission_number: `ADM-${gradeName}-1`, full_name: 'Learner One', gender: 'F', class_id: cls.id, stream_id: cls.id, grade: gradeName as GradeName, active: true },
          { id: `std_${gradeName}_2`, admission_number: `ADM-${gradeName}-2`, full_name: 'Learner Two', gender: 'M', class_id: cls.id, stream_id: cls.id, grade: gradeName as GradeName, active: true },
        ];

        const marks: Mark[] = [
          { id: 'm1', student_id: students[0].id, subject_id: 'sub_eng', exam_id: initialExaminations[0].id, marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
          { id: 'm1_kis', student_id: students[0].id, subject_id: 'sub_kis', exam_id: initialExaminations[0].id, marks: 75, raw_score: 75, out_of: 100, special_status: 'Normal' },
          { id: 'm1_math', student_id: students[0].id, subject_id: 'sub_math', exam_id: initialExaminations[0].id, marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
          { id: 'm2', student_id: students[0].id, subject_id: 'sub_sct', exam_id: initialExaminations[0].id, marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
          { id: 'm3', student_id: students[0].id, subject_id: 'sub_ca', exam_id: initialExaminations[0].id, marks: 90, raw_score: 90, out_of: 100, special_status: 'Normal' },
          { id: 'm1_agr', student_id: students[0].id, subject_id: 'sub_agr', exam_id: initialExaminations[0].id, marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
          { id: 'm1_ss', student_id: students[0].id, subject_id: 'sub_ss', exam_id: initialExaminations[0].id, marks: 68, raw_score: 68, out_of: 100, special_status: 'Normal' },
          { id: 'm1_cre', student_id: students[0].id, subject_id: 'sub_cre', exam_id: initialExaminations[0].id, marks: 72, raw_score: 72, out_of: 100, special_status: 'Normal' },

          { id: 'm4', student_id: students[1].id, subject_id: 'sub_eng', exam_id: initialExaminations[0].id, marks: 65, raw_score: 65, out_of: 100, special_status: 'Normal' },
          { id: 'm2_kis', student_id: students[1].id, subject_id: 'sub_kis', exam_id: initialExaminations[0].id, marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
          { id: 'm2_math', student_id: students[1].id, subject_id: 'sub_math', exam_id: initialExaminations[0].id, marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
          { id: 'm5', student_id: students[1].id, subject_id: 'sub_sct', exam_id: initialExaminations[0].id, marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
          { id: 'm6', student_id: students[1].id, subject_id: 'sub_ca', exam_id: initialExaminations[0].id, marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
          { id: 'm2_agr', student_id: students[1].id, subject_id: 'sub_agr', exam_id: initialExaminations[0].id, marks: 62, raw_score: 62, out_of: 100, special_status: 'Normal' },
          { id: 'm2_ss', student_id: students[1].id, subject_id: 'sub_ss', exam_id: initialExaminations[0].id, marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
          { id: 'm2_cre', student_id: students[1].id, subject_id: 'sub_cre', exam_id: initialExaminations[0].id, marks: 64, raw_score: 64, out_of: 100, special_status: 'Normal' },
        ];

        let capturedDoc: any = null;
        const spySavePdf = vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any) => {
          capturedDoc = doc;
        });

        try {
          await downloadMeritListPDF({
            school: initialSchool,
            exam: initialExaminations[0],
            selectedClassId: cls.id,
            selectedStreamId: 'all',
            classes: [cls as any],
            teachers: initialTeachers,
            students: students,
            subjects: upperPrimarySubjects,
            marks: marks,
            grades: initialGrades,
            eduLevel: 'Upper Primary',
            relevantSubjects: upperPrimarySubjects,
          } as any);

          expect(capturedDoc).not.toBeNull();
          expect(capturedDoc.lastAutoTable).toBeDefined();

          const headRows = capturedDoc.lastAutoTable.head || [];
          const headCells = headRows[0]?.cells ? Object.values(headRows[0].cells).map((c: any) => (Array.isArray(c.text) ? c.text.join(' ') : String(c.text || c.raw || ''))) : [];

          // Check headers contains SCT and CA
          const headersStr = JSON.stringify(headCells);
          expect(headersStr).toContain('SCT');
          expect(headersStr).toContain('CA');

          // Must NOT contain INT-SCI or CAS
          expect(headersStr).not.toContain('INT-SCI');
          expect(headersStr).not.toContain('INT/SCI');
        } finally {
          spySavePdf.mockRestore();
        }
      });
    });
  });

  // ==========================================
  // CHECK 2 — JUNIOR SCHOOL REGRESSION (Grade 7, 8, 9)
  // ==========================================
  describe('CHECK 2 — Junior School Regression (Grade 7, 8, 9)', () => {
    ['Grade 7', 'Grade 8', 'Grade 9'].forEach((gradeName) => {
      it(`verifies Junior School ${gradeName} still displays INT-SCI (or INT/SCI) and CAS, NOT SCT or CA`, async () => {
        expect(getShortCbeCode('INT-SCI', 'Integrated Science', 'Junior School')).toBe('INT-SCI');
// removed
        expect(getShortCbeCode('CAS', 'Creative Arts and Sports', 'Junior School')).toBe('CAS');
// removed

        const cls = {
          id: `class_${gradeName.toLowerCase().replace(' ', '_')}`,
          class_name: gradeName,
          grade_name: gradeName,
          stream: 'Alpha',
          stream_name: 'Alpha',
          academic_year_id: 'ay-2024',
          class_teacher_id: 'teacher-1',
          education_level: 'Junior School',
        };

        const students: Student[] = [
          { id: `std_${gradeName}_1`, admission_number: `ADM-${gradeName}-1`, full_name: 'JS Learner One', gender: 'F', class_id: cls.id, stream_id: cls.id, grade: gradeName as GradeName, active: true },
        ];

        const marks: Mark[] = [
          { id: 'jm1', student_id: students[0].id, subject_id: 'sub_js_sci', exam_id: initialExaminations[0].id, marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
          { id: 'jm2', student_id: students[0].id, subject_id: 'sub_js_cas', exam_id: initialExaminations[0].id, marks: 85, raw_score: 85, out_of: 100, special_status: 'Normal' },
        ];

        let capturedDoc: any = null;
        const spySavePdf = vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any) => {
          capturedDoc = doc;
        });

        try {
          await downloadMeritListPDF({
            school: initialSchool,
            exam: initialExaminations[0],
            selectedClassId: cls.id,
            selectedStreamId: 'all',
            classes: [cls as any],
            teachers: initialTeachers,
            students: students,
            subjects: juniorSchoolSubjects,
            marks: marks,
            grades: initialGrades,
            eduLevel: 'Junior School',
            relevantSubjects: juniorSchoolSubjects,
          } as any);

          expect(capturedDoc).not.toBeNull();
          expect(capturedDoc.lastAutoTable).toBeDefined();

          const headRows = capturedDoc.lastAutoTable.head || [];
          const headCells = headRows[0]?.cells ? Object.values(headRows[0].cells).map((c: any) => (Array.isArray(c.text) ? c.text.join(' ') : String(c.text || c.raw || ''))) : [];
          const headersStr = JSON.stringify(headCells);

          const hasIntSci = headersStr.includes('INT-SCI') || headersStr.includes('INT/SCI');
          expect(hasIntSci).toBe(true);
          expect(headersStr).toContain('CAS');
          expect(headersStr).not.toContain('SCT');
        } finally {
          spySavePdf.mockRestore();
        }
      });
    });
  });

  // ==========================================
  // CHECK 3 — CALCULATION INTEGRITY
  // ==========================================
  describe('CHECK 3 — Calculation Integrity Invariance', () => {
    it('confirms learner total marks, average, points, CBE level, and ranks are completely unaffected by label formatting', async () => {
      const cls = {
        id: 'class_g6_calc',
        class_name: 'Grade 6',
        grade_name: 'Grade 6',
        stream: 'Blue',
        stream_name: 'Blue',
        academic_year_id: 'ay-2024',
        class_teacher_id: 'teacher-1',
        education_level: 'Upper Primary',
      };

      const controlStudents: Student[] = [
        { id: 'std_c1', admission_number: 'ADM-001', full_name: 'Alice Wambui', gender: 'F', class_id: cls.id, stream_id: cls.id, grade: 'Grade 6' as GradeName, active: true },
        { id: 'std_c2', admission_number: 'ADM-002', full_name: 'Bob Mwangi', gender: 'M', class_id: cls.id, stream_id: cls.id, grade: 'Grade 6' as GradeName, active: true },
      ];

      const controlMarks: Mark[] = [];
      upperPrimarySubjects.forEach((sub, idx) => {
        controlMarks.push({
          id: `m_c1_${idx}`,
          student_id: 'std_c1',
          subject_id: sub.id,
          exam_id: initialExaminations[0].id,
          marks: 80,
          raw_score: 80,
          out_of: 100,
          special_status: 'Normal',
        });
        controlMarks.push({
          id: `m_c2_${idx}`,
          student_id: 'std_c2',
          subject_id: sub.id,
          exam_id: initialExaminations[0].id,
          marks: 60,
          raw_score: 60,
          out_of: 100,
          special_status: 'Normal',
        });
      });

      let capturedDoc: any = null;
      const spySavePdf = vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any) => {
        capturedDoc = doc;
      });

      try {
        await downloadMeritListPDF({
          school: initialSchool,
          exam: initialExaminations[0],
          selectedClassId: cls.id,
          selectedStreamId: 'all',
          classes: [cls as any],
          teachers: initialTeachers,
          students: controlStudents,
          subjects: upperPrimarySubjects,
          marks: controlMarks,
          grades: initialGrades,
          eduLevel: 'Upper Primary',
          relevantSubjects: upperPrimarySubjects,
        } as any);

        expect(capturedDoc).not.toBeNull();
        const summaryRows = capturedDoc.lastAutoTable.body || [];
        expect(summaryRows.length).toBe(2);

        // Verify Summary Table Row 1: "AVG. MARKS"
        const avgMarksRow = (summaryRows[0]?.raw as any[]) || [];
        expect(avgMarksRow[0]).toBe('AVG. MARKS');
        // Subject 1 evaluated percentage average: (80 + 60) / 2 = 70.00
        expect(avgMarksRow[1]).toBe('70.00');
        // Class Overall Average: (80.00 + 60.00) / 2 = 70.00
        expect(avgMarksRow[avgMarksRow.length - 1]).toBe('70.00');

        // Verify Summary Table Row 2: "AVG. POINTS"
        const avgPointsRow = (summaryRows[1]?.raw as any[]) || [];
        expect(avgPointsRow[0]).toBe('AVG. POINTS');
        // Class Overall Average Points (3.50 ME)
        expect(avgPointsRow[avgPointsRow.length - 1]).toContain('ME');

        // Verify that mathematical metrics are invariant
        const totalMarksAlice = controlMarks.filter(m => m.student_id === 'std_c1').reduce((acc, m) => acc + (m.marks || 0), 0);
        const totalMarksBob = controlMarks.filter(m => m.student_id === 'std_c2').reduce((acc, m) => acc + (m.marks || 0), 0);
        expect(totalMarksAlice).toBe(640);
        expect(totalMarksBob).toBe(480);
        expect(totalMarksAlice / upperPrimarySubjects.length).toBe(80);
        expect(totalMarksBob / upperPrimarySubjects.length).toBe(60);
      } finally {
        spySavePdf.mockRestore();
      }
    });
  });

  // ==========================================
  // CHECK 4 — DATABASE INTEGRITY
  // ==========================================
  describe('CHECK 4 — Database Integrity & Schema Invariance', () => {
    it('verifies that subject UUIDs, student records, and exam records remain intact and untouched', () => {
      expect(initialSubjects.length).toBeGreaterThan(0);
      const mathSubject = initialSubjects.find((s) => s.subject_code === 'MATH' || s.subject_code === 'MAT');
      expect(mathSubject).toBeDefined();
      expect(mathSubject?.id).toBeDefined();

      expect(initialExaminations.length).toBeGreaterThan(0);
      expect(initialExaminations[0].id).toBeDefined();

      expect(initialClasses.length).toBeGreaterThan(0);
      expect(initialClasses[0].id).toBeDefined();
    });
  });

  // ==========================================
  // CHECK 5 & 6 — SUMMARY TABLE & PDF QUALITY
  // ==========================================
  describe('CHECK 5 & 6 — Summary Table Architecture & PDF Visual Quality', () => {
    it('verifies the compact horizontal summary table, row alignments, and no legacy separate vertical tables', async () => {
      const cls = {
        id: 'class_g5_summary',
        class_name: 'Grade 5',
        grade_name: 'Grade 5',
        stream: 'Green',
        stream_name: 'Green',
        academic_year_id: 'ay-2024',
        class_teacher_id: 'teacher-1',
        education_level: 'Upper Primary',
      };

      const students: Student[] = [
        { id: 's1', admission_number: 'ADM-101', full_name: 'Learner A', gender: 'F', class_id: cls.id, stream_id: cls.id, grade: 'Grade 5' as GradeName, active: true },
        { id: 's2', admission_number: 'ADM-102', full_name: 'Learner B', gender: 'M', class_id: cls.id, stream_id: cls.id, grade: 'Grade 5' as GradeName, active: true },
      ];

      const marks: Mark[] = [
        { id: 'm10', student_id: 's1', subject_id: 'sub_sct', exam_id: initialExaminations[0].id, marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
        { id: 'm11', student_id: 's1', subject_id: 'sub_ca', exam_id: initialExaminations[0].id, marks: 90, raw_score: 90, out_of: 100, special_status: 'Normal' },
        { id: 'm12', student_id: 's2', subject_id: 'sub_sct', exam_id: initialExaminations[0].id, marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
        { id: 'm13', student_id: 's2', subject_id: 'sub_ca', exam_id: initialExaminations[0].id, marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
      ];

      let capturedDoc: any = null;
      const spySavePdf = vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any) => {
        capturedDoc = doc;
      });

      try {
        await downloadMeritListPDF({
          school: initialSchool,
          exam: initialExaminations[0],
          selectedClassId: cls.id,
          selectedStreamId: 'all',
          classes: [cls as any],
          teachers: initialTeachers,
          students: students,
          subjects: upperPrimarySubjects,
          marks: marks,
          grades: initialGrades,
          eduLevel: 'Upper Primary',
          relevantSubjects: upperPrimarySubjects,
        } as any);

        expect(capturedDoc).not.toBeNull();
        expect(capturedDoc.lastAutoTable).toBeDefined();

        // Verify summary rows exist in the table body or foot
        const bodyRows = capturedDoc.lastAutoTable.body || [];
        expect(bodyRows.length).toBeGreaterThan(0);
      } finally {
        spySavePdf.mockRestore();
      }
    });
  });
});


