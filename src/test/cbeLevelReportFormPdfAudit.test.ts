import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  generateLowerPrimaryReportPDF,
  generateUpperPrimaryReportPDF,
  generateJuniorSchoolReportPDF,
  PDFReportData,
} from '../services/pdfReportGenerator';
import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Teacher,
  Grade,
  Mark,
} from '../types';

describe('CBE LEVEL Report Form PDF Presentation Verification', () => {
  const mockSchool: School = {
    id: 'sch-01',
    school_name: 'ST. TERESA CBE ACADEMY',
    county: 'Nairobi',
    email: 'info@st-teresa.edu',
    phone: '0712345678',
    address: 'P.O. BOX 100, NAIROBI',
  };

  const mockPrimaryGrades: Grade[] = [
    { id: 'gr-1', grade_code: 'EE', performance_level: 'EE', minimum_score: 75, maximum_score: 100, points: 4, remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
    { id: 'gr-2', grade_code: 'ME', performance_level: 'ME', minimum_score: 50, maximum_score: 74, points: 3, remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
    { id: 'gr-3', grade_code: 'AE', performance_level: 'AE', minimum_score: 21, maximum_score: 49, points: 2, remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
    { id: 'gr-4', grade_code: 'BE', performance_level: 'BE', minimum_score: 0, maximum_score: 20, points: 1, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
  ];

  const mockGrades: Grade[] = [
    { id: 'gr-1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Outstanding Performance', descriptor: 'Exceeding Expectations' },
    { id: 'gr-2', grade_code: 'EE2', performance_level: 'EE', minimum_score: 75, maximum_score: 89, points: 7, remarks: 'Excellent Performance', descriptor: 'Exceeding Expectations' },
    { id: 'gr-3', grade_code: 'ME1', performance_level: 'ME', minimum_score: 58, maximum_score: 74, points: 6, remarks: 'Good Performance', descriptor: 'Meeting Expectations' },
    { id: 'gr-4', grade_code: 'ME2', performance_level: 'ME', minimum_score: 41, maximum_score: 57, points: 5, remarks: 'Satisfactory Performance', descriptor: 'Meeting Expectations' },
    { id: 'gr-5', grade_code: 'AE1', performance_level: 'AE', minimum_score: 31, maximum_score: 40, points: 4, remarks: 'Developing Competency', descriptor: 'Approaching Expectations' },
    { id: 'gr-6', grade_code: 'AE2', performance_level: 'AE', minimum_score: 21, maximum_score: 30, points: 3, remarks: 'Needs More Practice', descriptor: 'Approaching Expectations' },
    { id: 'gr-7', grade_code: 'BE1', performance_level: 'BE', minimum_score: 11, maximum_score: 20, points: 2, remarks: 'Requires Intervention', descriptor: 'Below Expectations' },
    { id: 'gr-8', grade_code: 'BE2', performance_level: 'BE', minimum_score: 0, maximum_score: 10, points: 1, remarks: 'Immediate Support Required', descriptor: 'Below Expectations' },
  ];

  const mockExam: Examination = {
    id: 'ex-01',
    exam_name: 'Term 2 Main Assessment 2026',
    term: 'Term 2',
    year: 2026,
    max_marks: 100,
    exam_type: 'End-Term',
    start_date: '2026-06-01',
    end_date: '2026-06-10',
    status: 'Approved',
  };

  const mockClasses: ClassStream[] = [
    { id: 'cls-g2', class_name: 'Grade 2', stream: 'A', class_teacher_id: 'tr-01' },
    { id: 'cls-g5', class_name: 'Grade 5', stream: 'A', class_teacher_id: 'tr-01' },
    { id: 'cls-g7', class_name: 'Grade 7', stream: 'A', class_teacher_id: 'tr-01' },
  ];

  const subjects: Subject[] = [
    { id: 'sb-1', subject_name: 'English Language', subject_code: 'ENG', category: 'Core', department: 'Languages' },
    { id: 'sb-2', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core', department: 'Languages' },
    { id: 'sb-3', subject_name: 'Mathematics', subject_code: 'MAT', category: 'Core', department: 'Mathematics' },
  ];

  const teachers: Teacher[] = [
    {
      id: 'tr-01',
      teacher_name: 'Mwalimu Omari',
      email: 'omari@st-teresa.edu',
      phone: '0722000000',
      allocations: [
        { id: 'al-1', education_level: 'Lower Primary', class_id: 'cls-g2', stream_id: 'cls-g2', subject_id: 'sb-1' },
        { id: 'al-2', education_level: 'Lower Primary', class_id: 'cls-g2', stream_id: 'cls-g2', subject_id: 'sb-2' },
        { id: 'al-3', education_level: 'Lower Primary', class_id: 'cls-g2', stream_id: 'cls-g2', subject_id: 'sb-3' },
        { id: 'al-4', education_level: 'Upper Primary', class_id: 'cls-g5', stream_id: 'cls-g5', subject_id: 'sb-1' },
        { id: 'al-5', education_level: 'Upper Primary', class_id: 'cls-g5', stream_id: 'cls-g5', subject_id: 'sb-2' },
        { id: 'al-6', education_level: 'Upper Primary', class_id: 'cls-g5', stream_id: 'cls-g5', subject_id: 'sb-3' },
        { id: 'al-7', education_level: 'Junior School', class_id: 'cls-g7', stream_id: 'cls-g7', subject_id: 'sb-1' },
        { id: 'al-8', education_level: 'Junior School', class_id: 'cls-g7', stream_id: 'cls-g7', subject_id: 'sb-2' },
        { id: 'al-9', education_level: 'Junior School', class_id: 'cls-g7', stream_id: 'cls-g7', subject_id: 'sb-3' },
      ],
    },
  ];

  const primaryTestCases: { score: number; expectedGradeCode: string; forbiddenString: string }[] = [
    { score: 95, expectedGradeCode: 'EE', forbiddenString: 'EE (EE1)' },
    { score: 80, expectedGradeCode: 'EE', forbiddenString: 'EE (EE2)' },
    { score: 65, expectedGradeCode: 'ME', forbiddenString: 'ME (ME1)' },
    { score: 50, expectedGradeCode: 'ME', forbiddenString: 'ME (ME2)' },
    { score: 35, expectedGradeCode: 'AE', forbiddenString: 'AE (AE1)' },
    { score: 25, expectedGradeCode: 'AE', forbiddenString: 'AE (AE2)' },
    { score: 15, expectedGradeCode: 'BE', forbiddenString: 'BE (BE1)' },
    { score: 5, expectedGradeCode: 'BE', forbiddenString: 'BE (BE2)' },
  ];

  const juniorTestCases: { score: number; expectedGradeCode: string; forbiddenString: string }[] = [
    { score: 95, expectedGradeCode: 'EE1', forbiddenString: 'EE (EE1)' },
    { score: 80, expectedGradeCode: 'EE2', forbiddenString: 'EE (EE2)' },
    { score: 65, expectedGradeCode: 'ME1', forbiddenString: 'ME (ME1)' },
    { score: 50, expectedGradeCode: 'ME2', forbiddenString: 'ME (ME2)' },
    { score: 35, expectedGradeCode: 'AE1', forbiddenString: 'AE (AE1)' },
    { score: 25, expectedGradeCode: 'AE2', forbiddenString: 'AE (AE2)' },
    { score: 15, expectedGradeCode: 'BE1', forbiddenString: 'BE (BE1)' },
    { score: 5, expectedGradeCode: 'BE2', forbiddenString: 'BE (BE2)' },
  ];

  describe('Lower Primary Report Form PDF', () => {
    primaryTestCases.forEach(({ score, expectedGradeCode, forbiddenString }) => {
      it(`renders "${expectedGradeCode}" (and NOT "${forbiddenString}") for average ${score}%`, async () => {
        const student: Student = {
          id: `std-lp-${expectedGradeCode}`,
          admission_number: `ADM-LP-${expectedGradeCode}`,
          full_name: 'Amani Baraka',
          first_name: 'Amani',
          last_name: 'Baraka',
          gender: 'F',
          class_id: 'cls-g2',
          grade: 'Grade 2',
          active: true,
        };

        const marks: Mark[] = subjects.map((sb, idx) => ({
          id: `mk-lp-${expectedGradeCode}-${idx}`,
          student_id: student.id,
          subject_id: sb.id,
          exam_id: mockExam.id,
          marks: score,
          special_status: 'Normal',
        }));

        const pdfData: PDFReportData = {
          student,
          school: mockSchool,
          classes: mockClasses,
          subjects,
          exam: mockExam,
          marks,
          grades: mockPrimaryGrades,
          teachers,
          allStudents: [student],
          nextTermOpeningDate: '2026-09-01',
        };

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const renderedTexts: string[] = [];
        const originalText = doc.text.bind(doc);
        doc.text = function (text: any, ...args: any[]) {
          if (typeof text === 'string') {
            renderedTexts.push(text);
          } else if (Array.isArray(text)) {
            text.forEach((t) => typeof t === 'string' && renderedTexts.push(t));
          }
          return (originalText as any)(text, ...args);
        } as any;

        await generateLowerPrimaryReportPDF(pdfData, doc);

        expect(renderedTexts.some((t) => t.includes(expectedGradeCode))).toBe(true);
        expect(renderedTexts.some((t) => t.includes(forbiddenString))).toBe(false);
      });
    });

    it('renders "Pending" for an incomplete assessment in Lower Primary', async () => {
      const student: Student = {
        id: 'std-lp-pending',
        admission_number: 'ADM-LP-PENDING',
        full_name: 'Zawadi Musa',
        first_name: 'Zawadi',
        last_name: 'Musa',
        gender: 'M',
        class_id: 'cls-g2',
        grade: 'Grade 2',
        active: true,
      };

      const marks: Mark[] = [
        {
          id: 'mk-lp-pen-1',
          student_id: student.id,
          subject_id: subjects[0].id,
          exam_id: mockExam.id,
          marks: 70,
          special_status: 'Normal',
        },
      ];

      const pdfData: PDFReportData = {
        student,
        school: mockSchool,
        classes: mockClasses,
        subjects,
        exam: mockExam,
        marks,
        grades: mockGrades,
        teachers,
        allStudents: [student],
        nextTermOpeningDate: '2026-09-01',
        aggregateRanking: {
          stream_rank: 1,
          stream_total: 1,
          overall_rank: 1,
          overall_total: 1,
          is_complete: false,
          total_marks: 70,
          average: 70,
          total_points: 6,
          performance_level: 'ME',
          grade_code: 'ME1',
        },
      };

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const renderedTexts: string[] = [];
      const originalText = doc.text.bind(doc);
      doc.text = function (text: any, ...args: any[]) {
        if (typeof text === 'string') {
          renderedTexts.push(text);
        }
        return (originalText as any)(text, ...args);
      } as any;

      await generateLowerPrimaryReportPDF(pdfData, doc);
      expect(renderedTexts).toContain('Pending');
      expect(renderedTexts).not.toContain('ME (ME1)');
    });
  });

  describe('Upper Primary Report Form PDF', () => {
    primaryTestCases.forEach(({ score, expectedGradeCode, forbiddenString }) => {
      it(`renders "${expectedGradeCode}" (and NOT "${forbiddenString}") for average ${score}%`, async () => {
        const student: Student = {
          id: `std-up-${expectedGradeCode}`,
          admission_number: `ADM-UP-${expectedGradeCode}`,
          full_name: 'Faith Njeri',
          first_name: 'Faith',
          last_name: 'Njeri',
          gender: 'F',
          class_id: 'cls-g5',
          grade: 'Grade 5',
          active: true,
        };

        const marks: Mark[] = subjects.map((sb, idx) => ({
          id: `mk-up-${expectedGradeCode}-${idx}`,
          student_id: student.id,
          subject_id: sb.id,
          exam_id: mockExam.id,
          marks: score,
          special_status: 'Normal',
        }));

        const pdfData: PDFReportData = {
          student,
          school: mockSchool,
          classes: mockClasses,
          subjects,
          exam: mockExam,
          marks,
          grades: mockPrimaryGrades,
          teachers,
          allStudents: [student],
          nextTermOpeningDate: '2026-09-01',
        };

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const renderedTexts: string[] = [];
        const originalText = doc.text.bind(doc);
        doc.text = function (text: any, ...args: any[]) {
          if (typeof text === 'string') {
            renderedTexts.push(text);
          } else if (Array.isArray(text)) {
            text.forEach((t) => typeof t === 'string' && renderedTexts.push(t));
          }
          return (originalText as any)(text, ...args);
        } as any;

        await generateUpperPrimaryReportPDF(pdfData, doc);

        expect(renderedTexts.some((t) => t.includes(expectedGradeCode))).toBe(true);
        expect(renderedTexts.some((t) => t.includes(forbiddenString))).toBe(false);
      });
    });

    it('renders "Pending" for an incomplete assessment in Upper Primary', async () => {
      const student: Student = {
        id: 'std-up-pending',
        admission_number: 'ADM-UP-PENDING',
        full_name: 'David Kimani',
        first_name: 'David',
        last_name: 'Kimani',
        gender: 'M',
        class_id: 'cls-g5',
        grade: 'Grade 5',
        active: true,
      };

      const marks: Mark[] = [
        {
          id: 'mk-up-pen-1',
          student_id: student.id,
          subject_id: subjects[0].id,
          exam_id: mockExam.id,
          marks: 85,
          special_status: 'Normal',
        },
      ];

      const pdfData: PDFReportData = {
        student,
        school: mockSchool,
        classes: mockClasses,
        subjects,
        exam: mockExam,
        marks,
        grades: mockGrades,
        teachers,
        allStudents: [student],
        nextTermOpeningDate: '2026-09-01',
        aggregateRanking: {
          stream_rank: 1,
          stream_total: 1,
          overall_rank: 1,
          overall_total: 1,
          is_complete: false,
          total_marks: 85,
          average: 85,
          total_points: 7,
          performance_level: 'EE',
          grade_code: 'EE2',
        },
      };

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const renderedTexts: string[] = [];
      const originalText = doc.text.bind(doc);
      doc.text = function (text: any, ...args: any[]) {
        if (typeof text === 'string') {
          renderedTexts.push(text);
        }
        return (originalText as any)(text, ...args);
      } as any;

      await generateUpperPrimaryReportPDF(pdfData, doc);
      expect(renderedTexts).toContain('Pending');
      expect(renderedTexts).not.toContain('EE (EE2)');
    });
  });

  describe('Junior School Report Form PDF', () => {
    juniorTestCases.forEach(({ score, expectedGradeCode, forbiddenString }) => {
      it(`renders "${expectedGradeCode}" (and NOT "${forbiddenString}") for average ${score}%`, async () => {
        const student: Student = {
          id: `std-js-${expectedGradeCode}`,
          admission_number: `ADM-JS-${expectedGradeCode}`,
          full_name: 'Victor Ochieng',
          first_name: 'Victor',
          last_name: 'Ochieng',
          gender: 'M',
          class_id: 'cls-g7',
          grade: 'Grade 7',
          active: true,
        };

        const marks: Mark[] = subjects.map((sb, idx) => ({
          id: `mk-js-${expectedGradeCode}-${idx}`,
          student_id: student.id,
          subject_id: sb.id,
          exam_id: mockExam.id,
          marks: score,
          special_status: 'Normal',
        }));

        const pdfData: PDFReportData = {
          student,
          school: mockSchool,
          classes: mockClasses,
          subjects,
          exam: mockExam,
          marks,
          grades: mockGrades,
          teachers,
          allStudents: [student],
          nextTermOpeningDate: '2026-09-01',
        };

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const renderedTexts: string[] = [];
        const originalText = doc.text.bind(doc);
        doc.text = function (text: any, ...args: any[]) {
          if (typeof text === 'string') {
            renderedTexts.push(text);
          } else if (Array.isArray(text)) {
            text.forEach((t) => typeof t === 'string' && renderedTexts.push(t));
          }
          return (originalText as any)(text, ...args);
        } as any;

        await generateJuniorSchoolReportPDF(pdfData, doc);

        expect(renderedTexts).toContain(expectedGradeCode);
        expect(renderedTexts).not.toContain(forbiddenString);
      });
    });

    it('renders "Pending" for an incomplete assessment in Junior School', async () => {
      const student: Student = {
        id: 'std-js-pending',
        admission_number: 'ADM-JS-PENDING',
        full_name: 'Grace Wanjiku',
        first_name: 'Grace',
        last_name: 'Wanjiku',
        gender: 'F',
        class_id: 'cls-g7',
        grade: 'Grade 7',
        active: true,
      };

      const marks: Mark[] = [
        {
          id: 'mk-js-pen-1',
          student_id: student.id,
          subject_id: subjects[0].id,
          exam_id: mockExam.id,
          marks: 92,
          special_status: 'Normal',
        },
      ];

      const pdfData: PDFReportData = {
        student,
        school: mockSchool,
        classes: mockClasses,
        subjects,
        exam: mockExam,
        marks,
        grades: mockGrades,
        teachers,
        allStudents: [student],
        nextTermOpeningDate: '2026-09-01',
        aggregateRanking: {
          stream_rank: 1,
          stream_total: 1,
          overall_rank: 1,
          overall_total: 1,
          is_complete: false,
          total_marks: 92,
          average: 92,
          total_points: 8,
          performance_level: 'EE',
          grade_code: 'EE1',
        },
      };

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const renderedTexts: string[] = [];
      const originalText = doc.text.bind(doc);
      doc.text = function (text: any, ...args: any[]) {
        if (typeof text === 'string') {
          renderedTexts.push(text);
        }
        return (originalText as any)(text, ...args);
      } as any;

      await generateJuniorSchoolReportPDF(pdfData, doc);
      expect(renderedTexts).toContain('Pending');
      expect(renderedTexts).not.toContain('EE (EE1)');
    });
  });
});
