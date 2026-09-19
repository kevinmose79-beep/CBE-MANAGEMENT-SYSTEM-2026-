import { describe, it, expect, vi } from 'vitest';
import {
  calculateExamResults,
  getGradeForMark,
  CBE_8_POINT_GRADES,
} from '../services/analysisEngine';
import {
  getLearnerClassAtExamTime,
  getStreamCohortStudentIds,
} from '../services/historicalContextResolver';
import {
  createReportCardPDFDoc,
} from '../services/pdfReportGenerator';
import { Student, Mark, Examination, Subject, ClassStream, School, Grade } from '../types';

// Mock jsPDF and jspdf-autotable
const textCalls: string[] = [];
vi.mock('jspdf', () => {
  const MockDoc = function () {
    return {
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
        getNumberOfPages: () => 1,
      },
      setPage: vi.fn(),
      addImage: vi.fn(),
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn((txt: any) => {
        if (typeof txt === 'string') textCalls.push(txt);
      }),
      setDrawColor: vi.fn(),
      setFillColor: vi.fn(),
      setLineWidth: vi.fn(),
      line: vi.fn(),
      rect: vi.fn(),
      roundedRect: vi.fn(),
      save: vi.fn(),
    };
  };
  return {
    default: MockDoc,
    jsPDF: MockDoc,
  };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn((doc: any) => {
    if (doc) {
      doc.lastAutoTable = { finalY: 120 };
    }
  }),
}));

describe('CBE Management System 2026 — Final Live Verification Suite', () => {
  const mockSchool: School = {
    id: 'school-001',
    school_name: 'CBE Academy',
    motto: 'Knowledge is Power',
    phone: '+254 700 123456',
    email: 'info@cbeacademy.ac.ke',
    principal_name: 'Dr. Jane Muthoni',
    county: 'Nairobi',
  };

  const grade9ClassParent: ClassStream = {
    id: 'cls_grade9_parent',
    class_name: 'Grade 9',
    stream: 'Default',
    education_level: 'Junior School',
  };

  const class9Blue: ClassStream = {
    id: 'cls_9b',
    stream_id: 'cls_9b',
    class_name: 'Grade 9',
    stream: 'Blue',
    education_level: 'Junior School',
    allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'],
  };

  const class9Alpha: ClassStream = {
    id: 'cls_9a',
    stream_id: 'cls_9a',
    class_name: 'Grade 9',
    stream: 'Alpha',
    education_level: 'Junior School',
    allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'],
  };

  const mockClasses: ClassStream[] = [grade9ClassParent, class9Blue, class9Alpha];

  const mockSubjects: Subject[] = [
    { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_kis', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_mat', subject_code: 'MATH', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_sci', subject_code: 'INT-SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_cas', subject_code: 'CAS', subject_name: 'Creative Arts and Sports', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_sst', subject_code: 'SST', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_cre', subject_code: 'CRE', subject_name: 'Christian Religious Education', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_agn', subject_code: 'AGN', subject_name: 'Agriculture', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_pts', subject_code: 'PRE-TECH', subject_name: 'Pre-Technical Studies', education_level: 'Junior School', category: 'Core' },
  ];

  // Quinn Taylor: ADM 300 in Grade 9 Blue
  const quinnTaylor: Student = {
    id: 'std_quinn',
    admission_number: '300',
    full_name: 'Quinn Taylor',
    gender: 'F',
    class_id: 'cls_grade9_parent',
    stream_id: 'cls_9b',
    grade: 'Grade 9',
    active: true,
  };

  // Alpha Sibling Learner: ADM 301 in Grade 9 Alpha
  const alphaLearner: Student = {
    id: 'std_alpha',
    admission_number: '301',
    full_name: 'Alpha Sibling Learner',
    gender: 'M',
    class_id: 'cls_grade9_parent',
    stream_id: 'cls_9a',
    grade: 'Grade 9',
    active: true,
  };

  const examOpener1: Examination = {
    id: 'ex_opener1_2026',
    exam_name: 'Opener 1 — Term 2, 2026',
    term: 'Term 2',
    year: 2026,
    exam_type: 'CAT',
    status: 'Approved',
    approved_classes: ['cls_9b', 'cls_9a'],
    max_marks: 100,
    start_date: '2026-05-10T08:00:00Z',
  };

  const mockMarks: Mark[] = [
    // Alpha Learner (Total: 9 * 80 = 720)
    ...mockSubjects.map((s, idx) => ({
      id: `m_alpha_${idx}`,
      student_id: 'std_alpha',
      exam_id: 'ex_opener1_2026',
      subject_id: s.id,
      marks: 80,
      raw_score: 80,
      out_of: 100,
      special_status: 'Normal' as const,
    })),
    // Quinn Taylor (Total: 9 * 75 = 675)
    ...mockSubjects.map((s, idx) => ({
      id: `m_quinn_${idx}`,
      student_id: 'std_quinn',
      exam_id: 'ex_opener1_2026',
      subject_id: s.id,
      marks: 75,
      raw_score: 75,
      out_of: 100,
      special_status: 'Normal' as const,
    })),
  ];

  const allGrade9Students = [quinnTaylor, alphaLearner];

  const examResults = calculateExamResults(
    examOpener1.id,
    allGrade9Students,
    mockMarks,
    CBE_8_POINT_GRADES,
    mockClasses,
    mockSubjects
  );

  it('1. Verifies Quinn in Admin Individual Assessment (Stream Rank 1 / 1, Grade Rank 2 / 2)', () => {
    const quinnCohort = getStreamCohortStudentIds(quinnTaylor, allGrade9Students, examOpener1, mockClasses);
    const quinnStreamResults = examResults.filter((r) => quinnCohort.has(r.student_id));
    const quinnStreamAssessed = quinnStreamResults.filter((r) => r.is_complete !== false).length;

    const gradeCohort = allGrade9Students.filter((s) => s.grade === quinnTaylor.grade);
    const gradeCohortResults = examResults.filter((r) => gradeCohort.some((s) => s.id === r.student_id));
    const gradeAssessed = gradeCohortResults.filter((r) => r.is_complete !== false).length;

    const quinnRes = examResults.find((r) => r.student_id === quinnTaylor.id)!;
    expect(quinnRes).toBeDefined();
    expect(quinnRes.class_position).toBe(1);
    expect(quinnRes.position).toBe(2);
    expect(quinnStreamAssessed).toBe(1);
    expect(gradeAssessed).toBe(2);

    const streamRankDisplay = `${quinnRes.class_position} out of ${quinnStreamAssessed} learner${quinnStreamAssessed !== 1 ? 's' : ''}`;
    const gradeRankDisplay = `${quinnRes.position} out of ${gradeAssessed} in cohort`;

    expect(streamRankDisplay).toBe('1 out of 1 learner');
    expect(gradeRankDisplay).toBe('2 out of 2 in cohort');
  });

  it('2. Verifies the Sibling Stream (Alpha Learner: Stream Rank 1 / 1, Grade Rank 1 / 2)', () => {
    const alphaCohort = getStreamCohortStudentIds(alphaLearner, allGrade9Students, examOpener1, mockClasses);
    const alphaStreamResults = examResults.filter((r) => alphaCohort.has(r.student_id));
    const alphaStreamAssessed = alphaStreamResults.filter((r) => r.is_complete !== false).length;

    const gradeCohort = allGrade9Students.filter((s) => s.grade === alphaLearner.grade);
    const gradeCohortResults = examResults.filter((r) => gradeCohort.some((s) => s.id === r.student_id));
    const gradeAssessed = gradeCohortResults.filter((r) => r.is_complete !== false).length;

    const alphaRes = examResults.find((r) => r.student_id === alphaLearner.id)!;
    expect(alphaRes).toBeDefined();
    expect(alphaRes.class_position).toBe(1);
    expect(alphaRes.position).toBe(1);
    expect(alphaStreamAssessed).toBe(1);
    expect(gradeAssessed).toBe(2);

    const streamRankDisplay = `${alphaRes.class_position} out of ${alphaStreamAssessed} learner${alphaStreamAssessed !== 1 ? 's' : ''}`;
    const gradeRankDisplay = `${alphaRes.position} out of ${gradeAssessed} in cohort`;

    expect(streamRankDisplay).toBe('1 out of 1 learner');
    expect(gradeRankDisplay).toBe('1 out of 2 in cohort');
  });

  it('3. Verifies Admin Batch Reports (Blue: 1 / 1, Alpha: 1 / 1)', () => {
    allGrade9Students.forEach((student) => {
      const cohort = getStreamCohortStudentIds(student, allGrade9Students, examOpener1, mockClasses);
      const streamRes = examResults.filter((r) => cohort.has(r.student_id));
      const denominator = streamRes.filter((r) => r.is_complete !== false).length;
      expect(denominator).toBe(1);
    });
  });

  it('4. Verifies Grade Ranking Was NOT Changed (Grade Denominator = 2)', () => {
    const grade9StudentIds = new Set(allGrade9Students.filter((s) => s.grade === 'Grade 9').map((s) => s.id));
    const grade9Results = examResults.filter((r) => grade9StudentIds.has(r.student_id));
    const gradeDenominator = grade9Results.filter((r) => r.is_complete !== false).length;
    expect(gradeDenominator).toBe(2);
  });

  it('5. Verifies a Multi-Learner Stream (Stream-specific denominator)', () => {
    const mockClass8East: ClassStream = {
      id: 'cls_8e',
      stream_id: 'cls_8e',
      class_name: 'Grade 8',
      stream: 'East',
      education_level: 'Junior School',
    };
    const mockClass8West: ClassStream = {
      id: 'cls_8w',
      stream_id: 'cls_8w',
      class_name: 'Grade 8',
      stream: 'West',
      education_level: 'Junior School',
    };

    const g8EastStudents: Student[] = Array.from({ length: 6 }, (_, i) => ({
      id: `std_g8_e_${i + 1}`,
      admission_number: `80${i + 1}`,
      full_name: `G8 East Learner ${i + 1}`,
      gender: i % 2 === 0 ? 'M' : 'F',
      class_id: 'cls_8e',
      stream_id: 'cls_8e',
      grade: 'Grade 8',
      active: true,
    }));

    const g8WestStudents: Student[] = Array.from({ length: 4 }, (_, i) => ({
      id: `std_g8_w_${i + 1}`,
      admission_number: `81${i + 1}`,
      full_name: `G8 West Learner ${i + 1}`,
      gender: i % 2 === 0 ? 'M' : 'F',
      class_id: 'cls_8w',
      stream_id: 'cls_8w',
      grade: 'Grade 8',
      active: true,
    }));

    const allG8Students = [...g8EastStudents, ...g8WestStudents];
    const g8Classes = [mockClass8East, mockClass8West];

    const g8Marks: Mark[] = [];
    allG8Students.forEach((st, sIdx) => {
      mockSubjects.forEach((sub, subIdx) => {
        g8Marks.push({
          id: `mk_g8_${sIdx}_${subIdx}`,
          student_id: st.id,
          exam_id: examOpener1.id,
          subject_id: sub.id,
          marks: 50 + sIdx * 3,
          raw_score: 50 + sIdx * 3,
          out_of: 100,
          special_status: 'Normal',
        });
      });
    });

    const g8Results = calculateExamResults(
      examOpener1.id,
      allG8Students,
      g8Marks,
      CBE_8_POINT_GRADES,
      g8Classes,
      mockSubjects
    );

    const eastCohort = getStreamCohortStudentIds(g8EastStudents[0], allG8Students, examOpener1, g8Classes);
    const eastAssessed = g8Results.filter((r) => eastCohort.has(r.student_id) && r.is_complete !== false).length;
    expect(eastAssessed).toBe(6);

    const westCohort = getStreamCohortStudentIds(g8WestStudents[0], allG8Students, examOpener1, g8Classes);
    const westAssessed = g8Results.filter((r) => westCohort.has(r.student_id) && r.is_complete !== false).length;
    expect(westAssessed).toBe(4);
  });

  it('6. Verifies Single-Learner Streams (Denominator = 1, not 2, 0, or NaN)', () => {
    const quinnCohort = getStreamCohortStudentIds(quinnTaylor, allGrade9Students, examOpener1, mockClasses);
    expect(quinnCohort.size).toBe(1);
    expect(quinnCohort.has(quinnTaylor.id)).toBe(true);
  });

  it('7. Verifies Provisional Learners Remain Unranked', () => {
    const incompleteStudent: Student = {
      id: 'std_incomplete',
      admission_number: '399',
      full_name: 'Incomplete Learner',
      gender: 'M',
      class_id: 'cls_grade9_parent',
      stream_id: 'cls_9b',
      grade: 'Grade 9',
      active: true,
    };
    const incompleteMarks: Mark[] = [
      {
        id: 'm_inc_1',
        student_id: 'std_incomplete',
        exam_id: examOpener1.id,
        subject_id: 'sb_eng',
        marks: 60,
        raw_score: 60,
        out_of: 100,
        special_status: 'Normal',
      },
    ];
    const resultsWithIncomplete = calculateExamResults(
      examOpener1.id,
      [quinnTaylor, alphaLearner, incompleteStudent],
      [...mockMarks, ...incompleteMarks],
      CBE_8_POINT_GRADES,
      mockClasses,
      mockSubjects
    );
    const incRes = resultsWithIncomplete.find((r) => r.student_id === incompleteStudent.id)!;
    expect(incRes.status).toBe('Provisional');
    expect(incRes.is_complete).toBe(false);
    expect(incRes.position).toBe(0);
    expect(incRes.class_position).toBe(0);
  });

  it('8. Verifies Historical Context Cohort Resolution', () => {
    const historicalStudent: Student = {
      id: 'std_hist',
      admission_number: '199',
      full_name: 'Historical Student',
      gender: 'F',
      class_id: 'cls_8e',
      stream_id: 'cls_8e',
      grade: 'Grade 8',
      active: true,
      promotion_history: [
        {
          id: 'promo_1',
          student_id: 'std_hist',
          from_grade: 'Grade 7' as any,
          to_grade: 'Grade 8' as any,
          from_class_id: 'cls_7e',
          date_promoted: '2026-01-05T00:00:00Z',
        },
      ],
    };
    const exam2025: Examination = {
      id: 'ex_2025_t1',
      exam_name: 'Term 1 Exam 2025',
      term: 'Term 1',
      year: 2025,
      exam_type: 'End-Term',
      status: 'Approved',
      max_marks: 100,
      start_date: '2025-03-01T00:00:00Z',
    };
    const histContext = getLearnerClassAtExamTime(historicalStudent, exam2025, [
      { id: 'cls_7e', class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
      { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
    ]);
    expect(histContext.is_historical).toBe(true);
    expect(histContext.grade).toBe('Grade 7');
    expect(histContext.class_id).toBe('cls_7e');
  });

  it('9. Verifies Official Junior School PDF Report Generation', async () => {
    const jsPdfDoc = await createReportCardPDFDoc({
      student: quinnTaylor,
      exam: examOpener1,
      marks: mockMarks,
      subjects: mockSubjects,
      classes: mockClasses,
      grades: CBE_8_POINT_GRADES,
      school: mockSchool,
      allStudents: allGrade9Students,
      nextTermOpeningDate: '4th May 2026',
    });
    expect(jsPdfDoc).toBeDefined();
    expect(textCalls.some((t) => t.includes('1 of 1') || t.includes('1 / 1'))).toBe(true);
    expect(textCalls.some((t) => t.includes('2 of 2') || t.includes('2 / 2'))).toBe(true);
  });

  it('10. Verifies Upper and Lower Primary PDF Report Generators', async () => {
    const upClass: ClassStream = { id: 'cls_g5_b', class_name: 'Grade 5', stream: 'Blue', education_level: 'Upper Primary' };
    const upStudent: Student = { id: 'std_up', admission_number: '501', full_name: 'Upper Student', gender: 'M', class_id: 'cls_g5_b', stream_id: 'cls_g5_b', grade: 'Grade 5', active: true };
    const upExam: Examination = { id: 'ex_up', exam_name: 'UP Exam', term: 'Term 1', year: 2026, exam_type: 'End-Term', max_marks: 100, status: 'Approved' };
    const upPdfDoc = await createReportCardPDFDoc({
      student: upStudent,
      exam: upExam,
      marks: [],
      subjects: mockSubjects,
      classes: [upClass],
      grades: CBE_8_POINT_GRADES,
      school: mockSchool,
      allStudents: [upStudent],
      nextTermOpeningDate: '4th May 2026',
    });
    expect(upPdfDoc).toBeDefined();

    const lpClass: ClassStream = { id: 'cls_g2_b', class_name: 'Grade 2', stream: 'Blue', education_level: 'Lower Primary' };
    const lpStudent: Student = { id: 'std_lp', admission_number: '201', full_name: 'Lower Student', gender: 'F', class_id: 'cls_g2_b', stream_id: 'cls_g2_b', grade: 'Grade 2', active: true };
    const lpPdfDoc = await createReportCardPDFDoc({
      student: lpStudent,
      exam: upExam,
      marks: [],
      subjects: mockSubjects,
      classes: [lpClass],
      grades: CBE_8_POINT_GRADES,
      school: mockSchool,
      allStudents: [lpStudent],
      nextTermOpeningDate: '4th May 2026',
    });
    expect(lpPdfDoc).toBeDefined();
  });
});
