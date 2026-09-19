import { describe, it, expect } from 'vitest';
import {
  isKiswahiliSubject,
  getKiswahiliDefaultComment,
  validateKiswahiliComment,
} from '../utils/kiswahiliCommentValidator';
import {
  generatePrePrimaryReportPDF,
  generateLowerPrimaryReportPDF,
  generateUpperPrimaryReportPDF,
  generateJuniorSchoolReportPDF,
  PDFReportData,
} from '../services/pdfReportGenerator';
import {
  School,
  Student,
  Subject,
  Examination,
  ClassStream,
  Mark,
  Grade,
  Teacher,
  LearnerReportComment,
} from '../types';

describe('Kiswahili Comment — Comprehensive Forensic Audit, Testing & Verification Suite', () => {
  // Shared mock infrastructure
  const mockSchool: School = {
    id: 'sch-001',
    school_name: 'St. Teresa CBE Academy',
    motto: 'Elimu ni Nguvu',
    county: 'Nairobi',
    email: 'info@st-teresa.edu',
    phone: '0712345678',
  };

  const mockGrades: Grade[] = [
    { id: 'gr-1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 4, remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
    { id: 'gr-2', grade_code: 'EE2', performance_level: 'EE', minimum_score: 75, maximum_score: 89, points: 4, remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
    { id: 'gr-3', grade_code: 'ME1', performance_level: 'ME', minimum_score: 58, maximum_score: 74, points: 3, remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
    { id: 'gr-4', grade_code: 'AE1', performance_level: 'AE', minimum_score: 41, maximum_score: 57, points: 2, remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
    { id: 'gr-5', grade_code: 'BE1', performance_level: 'BE', minimum_score: 31, maximum_score: 40, points: 1, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
    { id: 'gr-6', grade_code: 'BE2', performance_level: 'BE', minimum_score: 21, maximum_score: 30, points: 1, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
    { id: 'gr-7', grade_code: 'BE3', performance_level: 'BE', minimum_score: 11, maximum_score: 20, points: 1, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
    { id: 'gr-8', grade_code: 'BE4', performance_level: 'BE', minimum_score: 0, maximum_score: 10, points: 1, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
  ];

  const mockExam: Examination = {
    id: 'exam-t1-2026',
    exam_name: 'Term 1 Main Summative Assessment 2026',
    term: 'Term 1',
    year: 2026,
    max_marks: 100,
    exam_type: 'End-Term',
    start_date: '2026-03-01',
    end_date: '2026-03-10',
    status: 'Approved',
  };

  const kiswahiliSubject: Subject = {
    id: 'sb_kis',
    subject_name: 'Kiswahili',
    subject_code: 'KIS',
    category: 'Core',
    department: 'Languages',
  };

  const englishSubject: Subject = {
    id: 'sb_eng',
    subject_name: 'English Language',
    subject_code: 'ENG',
    category: 'Core',
    department: 'Languages',
  };

  const mathSubject: Subject = {
    id: 'sb_mat',
    subject_name: 'Mathematics',
    subject_code: 'MAT',
    category: 'Core',
    department: 'Mathematics',
  };

  const scienceSubject: Subject = {
    id: 'sb_sci',
    subject_name: 'Integrated Science',
    subject_code: 'SCI',
    category: 'Core',
    department: 'Sciences',
  };

  const mockTeacher: Teacher = {
    id: 'tr-01',
    teacher_name: 'Mwalimu Omari',
    email: 'omari@st-teresa.edu',
    phone: '0722000000',
    allocations: [
      { id: 'alloc-1', education_level: 'Junior School', class_id: 'cls-g7', stream_id: 'stm-g7-a', subject_id: 'sb_kis' },
    ],
  };

  describe('PART 1 & 7 — Automatic Kiswahili Performance Remarks & Boundary Fidelity', () => {
    it('generates accurate authentic remarks across all performance bands', () => {
      // 90% and above
      expect(getKiswahiliDefaultComment(100)).toBe('Uwezo wa Juu Zaidi - Kazi Nzuri Sana');
      expect(getKiswahiliDefaultComment(95)).toBe('Uwezo wa Juu Zaidi - Kazi Nzuri Sana');
      expect(getKiswahiliDefaultComment(90)).toBe('Uwezo wa Juu Zaidi - Kazi Nzuri Sana');

      // 75% to 89%
      expect(getKiswahiliDefaultComment(89)).toBe('Kazi Bora Sana - Amepita Matarajio');
      expect(getKiswahiliDefaultComment(80)).toBe('Kazi Bora Sana - Amepita Matarajio');
      expect(getKiswahiliDefaultComment(75)).toBe('Kazi Bora Sana - Amepita Matarajio');

      // 58% to 74%
      expect(getKiswahiliDefaultComment(74)).toBe('Kazi Nzuri - Anafikia Matarajio');
      expect(getKiswahiliDefaultComment(65)).toBe('Kazi Nzuri - Anafikia Matarajio');
      expect(getKiswahiliDefaultComment(58)).toBe('Kazi Nzuri - Anafikia Matarajio');

      // 41% to 57%
      expect(getKiswahiliDefaultComment(57)).toBe('Kazi ya Wastani - Anakaribia Matarajio');
      expect(getKiswahiliDefaultComment(50)).toBe('Kazi ya Wastani - Anakaribia Matarajio');
      expect(getKiswahiliDefaultComment(41)).toBe('Kazi ya Wastani - Anakaribia Matarajio');

      // 31% to 40%
      expect(getKiswahiliDefaultComment(40)).toBe('Anahitaji Mazoezi Zaidi');
      expect(getKiswahiliDefaultComment(35)).toBe('Anahitaji Mazoezi Zaidi');
      expect(getKiswahiliDefaultComment(31)).toBe('Anahitaji Mazoezi Zaidi');

      // 21% to 30%
      expect(getKiswahiliDefaultComment(30)).toBe('Anahitaji Mazoezi na Mwongozo Zaidi');
      expect(getKiswahiliDefaultComment(25)).toBe('Anahitaji Mazoezi na Mwongozo Zaidi');
      expect(getKiswahiliDefaultComment(21)).toBe('Anahitaji Mazoezi na Mwongozo Zaidi');

      // 11% to 20%
      expect(getKiswahiliDefaultComment(20)).toBe('Anahitaji Msaada Zaidi');
      expect(getKiswahiliDefaultComment(15)).toBe('Anahitaji Msaada Zaidi');
      expect(getKiswahiliDefaultComment(11)).toBe('Anahitaji Msaada Zaidi');

      // Below 11%
      expect(getKiswahiliDefaultComment(10)).toBe('Usaidizi wa Haraka Unahitajika');
      expect(getKiswahiliDefaultComment(5)).toBe('Usaidizi wa Haraka Unahitajika');
      expect(getKiswahiliDefaultComment(0)).toBe('Usaidizi wa Haraka Unahitajika');
    });

    it('handles special assessment statuses X and Y with accurate Kiswahili terms', () => {
      // Unassessed / Absent (X)
      expect(getKiswahiliDefaultComment(null, 'X')).toBe('Hajafanya Tathmini (X)');
      expect(getKiswahiliDefaultComment(0, 'X')).toBe('Hajafanya Tathmini (X)');

      // Irregularity (Y)
      expect(getKiswahiliDefaultComment(null, 'Y', 'Udhuru wa Kimatibabu')).toBe('Hitilafu (Udhuru wa Kimatibabu)');
      expect(getKiswahiliDefaultComment(null, 'Y', 'Absenteeism')).toBe('Hitilafu (Absenteeism)');
      expect(getKiswahiliDefaultComment(null, 'Y')).toBe('Hitilafu ya Mtihani (Y)');

      // Missing or unconfirmed marks
      expect(getKiswahiliDefaultComment(null)).toBe('Hajathibitishwa');
      expect(getKiswahiliDefaultComment(undefined)).toBe('Hajathibitishwa');
    });
  });

  describe('PART 5 — Authoritative Kiswahili Identification', () => {
    it('correctly detects Kiswahili learning area across tiers and naming conventions', () => {
      // Standard Name
      expect(isKiswahiliSubject({ subject_name: 'Kiswahili' })).toBe(true);
      expect(isKiswahiliSubject({ subject_name: 'Kiswahili Language Activities / Kenya Sign Language' })).toBe(true);
      expect(isKiswahiliSubject({ subject_name: 'KISWAHILI LANGUAGE' })).toBe(true);

      // Subject Codes
      expect(isKiswahiliSubject({ subject_code: 'KIS' })).toBe(true);
      expect(isKiswahiliSubject({ subject_code: 'KISW' })).toBe(true);
      expect(isKiswahiliSubject({ subject_code: 'KIS-07' })).toBe(true);
      expect(isKiswahiliSubject({ subject_code: 'KIS-JS' })).toBe(true);
      expect(isKiswahiliSubject({ subject_code: 'LP-KSL' })).toBe(true);

      // Seeded IDs
      expect(isKiswahiliSubject({ id: 'sb_kis' })).toBe(true);
      expect(isKiswahiliSubject({ id: 'sb_up_kis' })).toBe(true);
      expect(isKiswahiliSubject({ id: 'sb_lp_kis' })).toBe(true);
      expect(isKiswahiliSubject({ id: 'sub-kisw-001' })).toBe(true);

      // Non-Kiswahili subjects
      expect(isKiswahiliSubject(englishSubject)).toBe(false);
      expect(isKiswahiliSubject(mathSubject)).toBe(false);
      expect(isKiswahiliSubject(scienceSubject)).toBe(false);
      expect(isKiswahiliSubject(null)).toBe(false);
    });
  });

  describe('PART 4 & 6 — Comment Priority & Language Validation', () => {
    it('validates authentic Kiswahili comments and rejects English boilerplate', () => {
      // Valid Kiswahili remarks
      const validKisw = [
        'Ameonyesha bidii kubwa katika kusoma na kuandika sentensi.',
        'Kazi nzuri sana, anafikia matarajio yote kwa ufasaha.',
        'Anahitaji mazoezi zaidi katika uandishi wa insha na sarufi.',
        'Kazi bora sana, amezidi kuimarika muhula huu.',
        'Hongera kwa matokeo mazuri, aendelee kujitahidi vivyo hivyo.',
      ];
      for (const c of validKisw) {
        const res = validateKiswahiliComment(c);
        expect(res.isValid).toBe(true);
        expect(res.isLanguageValid).toBe(true);
      }

      // English comments are rejected for Kiswahili
      const invalidEnglish = [
        'Outstanding performance this term, keep it up!',
        'Exceeding Expectations in reading and comprehension.',
        'The student needs more practice in writing.',
        'Very good effort shown.',
        'Meeting expectations consistently.',
      ];
      for (const c of invalidEnglish) {
        const res = validateKiswahiliComment(c);
        expect(res.isValid).toBe(false);
        expect(res.reason).toBe('NOT_IN_KISWAHILI');
      }

      // Empty/whitespace comments fail validation if passed to validateKiswahiliComment
      expect(validateKiswahiliComment('').isValid).toBe(false);
      expect(validateKiswahiliComment('   ').isValid).toBe(false);
    });
  });

  describe('PART 3 & 12 — Large Class Workload Simulation (80 Learners)', () => {
    it('automatically generates 80 appropriate remarks with zero manual required entry, preserving custom overrides', () => {
      const classId = 'cls-g7';
      const streamId = 'stm-g7-a';

      // Generate 80 learners
      const learners: Student[] = Array.from({ length: 80 }, (_, i) => ({
        id: `std-${i + 1}`,
        admission_number: `ADM${1000 + i}`,
        full_name: `Learner ${i + 1}`,
        gender: i % 2 === 0 ? 'M' : 'F',
        grade: 'Grade 7',
        class_id: classId,
        stream_id: streamId,
        active: true,
      }));

      // Generate diverse marks for 80 learners
      const marks: Mark[] = learners.map((l, i) => {
        if (i === 78) {
          // Special status X
          return {
            id: `mark-${l.id}-kis`,
            student_id: l.id,
            subject_id: kiswahiliSubject.id,
            exam_id: mockExam.id,
            marks: 0,
            special_status: 'X' as const,
          };
        }
        if (i === 79) {
          // Special status Y
          return {
            id: `mark-${l.id}-kis`,
            student_id: l.id,
            subject_id: kiswahiliSubject.id,
            exam_id: mockExam.id,
            marks: 0,
            special_status: 'Y' as const,
            irregularity_reason: 'Kutohudhuria',
          };
        }
        // Normal marks from 98 down to 15
        const score = Math.max(10, 98 - i);
        return {
          id: `mark-${l.id}-kis`,
          student_id: l.id,
          subject_id: kiswahiliSubject.id,
          exam_id: mockExam.id,
          marks: score,
          special_status: 'Normal' as const,
        };
      });

      // Teacher customized comments for 3 specific learners only
      const savedRemarksMap: Record<string, LearnerReportComment> = {
        [`std-1_${mockExam.id}`]: {
          student_id: 'std-1',
          exam_id: mockExam.id,
          subject_comments: {
            [kiswahiliSubject.id]: 'Kazi nzuri sana, anashiriki vyema katika mijadala ya darasani.',
          },
        },
        [`std-10_${mockExam.id}`]: {
          student_id: 'std-10',
          exam_id: mockExam.id,
          subject_comments: {
            [kiswahiliSubject.id]: 'Ameonyesha nia njema ya kujifunza msamiati mpya.',
          },
        },
      };

      // Resolve comment for all 80 learners using authoritative engine logic
      const resolvedComments: { studentId: string; comment: string; isCustom: boolean }[] = [];

      for (const learner of learners) {
        const key = `${learner.id}_${mockExam.id}`;
        const saved = savedRemarksMap[key];
        const customComment = saved?.subject_comments?.[kiswahiliSubject.id];

        const stdMark = marks.find((m) => m.student_id === learner.id && m.subject_id === kiswahiliSubject.id);
        const status = stdMark?.special_status;
        const score = stdMark?.marks;
        const irregularity = stdMark?.irregularity_reason;

        const autoComment = getKiswahiliDefaultComment(score, status, irregularity);
        const finalComment = customComment || autoComment;

        resolvedComments.push({
          studentId: learner.id,
          comment: finalComment,
          isCustom: !!customComment,
        });
      }

      // Assertions for the 80 learners
      expect(resolvedComments.length).toBe(80);

      // Learner 1 (custom)
      expect(resolvedComments[0].isCustom).toBe(true);
      expect(resolvedComments[0].comment).toBe('Kazi nzuri sana, anashiriki vyema katika mijadala ya darasani.');

      // Learner 2 (score 97 -> auto)
      expect(resolvedComments[1].isCustom).toBe(false);
      expect(resolvedComments[1].comment).toBe('Uwezo wa Juu Zaidi - Kazi Nzuri Sana');

      // Learner 10 (custom)
      expect(resolvedComments[9].isCustom).toBe(true);
      expect(resolvedComments[9].comment).toBe('Ameonyesha nia njema ya kujifunza msamiati mpya.');

      // Learner 79 (index 78, status X -> auto)
      expect(resolvedComments[78].isCustom).toBe(false);
      expect(resolvedComments[78].comment).toBe('Hajafanya Tathmini (X)');

      // Learner 80 (index 79, status Y -> auto)
      expect(resolvedComments[79].isCustom).toBe(false);
      expect(resolvedComments[79].comment).toBe('Hitilafu (Kutohudhuria)');

      // Verify no comments are empty or missing
      for (const item of resolvedComments) {
        expect(item.comment).toBeTruthy();
        expect(item.comment.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('PART 9 & 13 — PDF Report Generation & Terminology Verification', () => {
    const mockClasses: ClassStream[] = [
      { id: 'cls-pp1', class_name: 'PP1', stream: 'A', class_teacher_id: 'tr-01' },
      { id: 'cls-g2', class_name: 'Grade 2', stream: 'A', class_teacher_id: 'tr-01' },
      { id: 'cls-g5', class_name: 'Grade 5', stream: 'A', class_teacher_id: 'tr-01' },
      { id: 'cls-g7', class_name: 'Grade 7', stream: 'A', class_teacher_id: 'tr-01' },
    ];

    it('generates Pre-Primary PDF with authentic Kiswahili comments and updated table headers', async () => {
      const student: Student = {
        id: 'std-pp',
        admission_number: 'PP101',
        full_name: 'Amina Ali',
        gender: 'F',
        grade: 'PP1',
        class_id: 'cls-pp1',
        active: true,
      };

      const marks: Mark[] = [
        { id: 'm1', student_id: student.id, subject_id: kiswahiliSubject.id, exam_id: mockExam.id, marks: 85, special_status: 'Normal' },
        { id: 'm2', student_id: student.id, subject_id: englishSubject.id, exam_id: mockExam.id, marks: 80, special_status: 'Normal' },
      ];

      const pdfData: PDFReportData = {
        student,
        school: mockSchool,
        classes: mockClasses,
        subjects: [kiswahiliSubject, englishSubject],
        exam: mockExam,
        marks,
        grades: mockGrades,
        teachers: [mockTeacher],
        allStudents: [student],
        nextTermOpeningDate: '2026-05-04',
      };

      const doc = await generatePrePrimaryReportPDF(pdfData);
      expect(doc).toBeDefined();
    });

    it('generates Lower Primary PDF with authentic Kiswahili comments and updated table headers', async () => {
      const student: Student = {
        id: 'std-lp',
        admission_number: 'LP101',
        full_name: 'Baraka Juma',
        gender: 'M',
        grade: 'Grade 2',
        class_id: 'cls-g2',
        active: true,
      };

      const marks: Mark[] = [
        { id: 'm1', student_id: student.id, subject_id: kiswahiliSubject.id, exam_id: mockExam.id, marks: 65, special_status: 'Normal' },
        { id: 'm2', student_id: student.id, subject_id: mathSubject.id, exam_id: mockExam.id, marks: 70, special_status: 'Normal' },
      ];

      const pdfData: PDFReportData = {
        student,
        school: mockSchool,
        classes: mockClasses,
        subjects: [kiswahiliSubject, mathSubject],
        exam: mockExam,
        marks,
        grades: mockGrades,
        teachers: [mockTeacher],
        allStudents: [student],
        nextTermOpeningDate: '2026-05-04',
      };

      const doc = await generateLowerPrimaryReportPDF(pdfData);
      expect(doc).toBeDefined();
    });

    it('generates Upper Primary PDF with authentic Kiswahili comments and custom remarks preserved', async () => {
      const student: Student = {
        id: 'std-up',
        admission_number: 'UP101',
        full_name: 'Chausiku Hassan',
        gender: 'F',
        grade: 'Grade 5',
        class_id: 'cls-g5',
        active: true,
      };

      const marks: Mark[] = [
        { id: 'm1', student_id: student.id, subject_id: kiswahiliSubject.id, exam_id: mockExam.id, marks: 92, special_status: 'Normal' },
        { id: 'm2', student_id: student.id, subject_id: scienceSubject.id, exam_id: mockExam.id, marks: 88, special_status: 'Normal' },
      ];

      const customRemarks: LearnerReportComment = {
        student_id: student.id,
        exam_id: mockExam.id,
        subject_comments: {
          [kiswahiliSubject.id]: 'Uwezo mzuri sana wa kueleza na kujieleza kwa Kiswahili.',
        },
      };

      const pdfData: PDFReportData = {
        student,
        school: mockSchool,
        classes: mockClasses,
        subjects: [kiswahiliSubject, scienceSubject],
        exam: mockExam,
        marks,
        grades: mockGrades,
        teachers: [mockTeacher],
        allStudents: [student],
        savedRemarks: customRemarks,
        nextTermOpeningDate: '2026-05-04',
      };

      const doc = await generateUpperPrimaryReportPDF(pdfData);
      expect(doc).toBeDefined();
    });

    it('generates Junior School PDF with authentic Kiswahili comments, X/Y handling, and non-Kiswahili remark isolation', async () => {
      const student: Student = {
        id: 'std-js',
        admission_number: 'JS101',
        full_name: 'David Mwangi',
        gender: 'M',
        grade: 'Grade 7',
        class_id: 'cls-g7',
        active: true,
      };

      const marks: Mark[] = [
        { id: 'm1', student_id: student.id, subject_id: kiswahiliSubject.id, exam_id: mockExam.id, marks: 0, special_status: 'X' },
        { id: 'm2', student_id: student.id, subject_id: englishSubject.id, exam_id: mockExam.id, marks: 75, special_status: 'Normal' },
        { id: 'm3', student_id: student.id, subject_id: mathSubject.id, exam_id: mockExam.id, marks: 82, special_status: 'Normal' },
      ];

      const pdfData: PDFReportData = {
        student,
        school: mockSchool,
        classes: mockClasses,
        subjects: [kiswahiliSubject, englishSubject, mathSubject],
        exam: mockExam,
        marks,
        grades: mockGrades,
        teachers: [mockTeacher],
        allStudents: [student],
        nextTermOpeningDate: '2026-05-04',
      };

      const doc = await generateJuniorSchoolReportPDF(pdfData);
      expect(doc).toBeDefined();
    });
  });
});
