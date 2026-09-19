import { describe, it, expect } from 'vitest';
import { getShortCbeCode, getMeritListDisplayCode } from '../types';
import { downloadMeritListPDF } from './meritListExporter';
import { initialSchool, initialExaminations, initialGrades, initialClasses, initialTeachers, initialSubjects } from '../data/seedData';
import { Student, Mark, GradeName } from '../types';

describe('Upper Primary vs Junior School Subject Labels in Merit List Exporter', () => {
  it('maps Grade 4-6 / Upper Primary Science and Technology to SCT, NOT INT-SCI', () => {
    // With explicit code SCT
    expect(getShortCbeCode('SCT', 'Science and Technology', 'Upper Primary')).toBe('SCT');
// removed
    expect(getMeritListDisplayCode('SCT', 'Science and Technology', 'Upper Primary')).toBe('SCT');

    // With name Science and Technology
    expect(getShortCbeCode('SCI', 'Science and Technology', 'Upper Primary')).toBe('SCT');
// removed
  });

  it('maps Grade 4-6 / Upper Primary Creative Arts to CA, NOT CAS', () => {
    // With explicit code CA
    expect(getShortCbeCode('CA', 'Creative Arts', 'Upper Primary')).toBe('CAS');
// removed
    expect(getMeritListDisplayCode('CA', 'Creative Arts', 'Upper Primary')).toBe('CAS');

    // With name Creative Arts
    expect(getShortCbeCode('CA', 'Creative Arts', 'Upper Primary')).toBe('CAS');
  });

  it('supports Integrated Science INT-SCI in both Upper Primary and Junior School', () => {
    // Upper Primary Integrated Science
    expect(getShortCbeCode('INT-SCI', 'Integrated Science', 'Upper Primary')).toBe('INT-SCI');
// removed
    expect(getMeritListDisplayCode('INT-SCI', 'Integrated Science', 'Upper Primary')).toBe('INT SCI');

    // Junior School Integrated Science
    expect(getShortCbeCode('INT-SCI', 'Integrated Science', 'Junior School')).toBe('INT-SCI');
// removed
  });

  it('supports Upper Primary Social Studies & CRE merged as SS&CRE', () => {
    expect(getShortCbeCode('SS&CRE', 'Social Studies&CRE', 'Upper Primary')).toBe('SS&CRE');
// removed
    expect(getMeritListDisplayCode('SS&CRE', 'Social Studies&CRE', 'Upper Primary')).toBe('SS&CRE');
    expect(getShortCbeCode('SS & CRE', 'Social Studies & CRE', 'Upper Primary')).toBe('SS&CRE');
  });

  it('preserves Junior School Grade 7-9 Integrated Science as INT-SCI and Creative Arts & Sports as CAS', () => {
    // Junior School Science
    expect(getShortCbeCode('INT-SCI', 'Integrated Science', 'Junior School')).toBe('INT-SCI');
// removed
// removed
// removed

    // Junior School Creative Arts & Sports
    expect(getShortCbeCode('CAS', 'Creative Arts and Sports', 'Junior School')).toBe('CAS');
// removed
// removed
  });

  it('exports Grade 6 Upper Primary Merit List PDF with SCT and CA successfully without error', async () => {
    const cls = initialClasses.find((c) => c.class_name === 'Grade 6') || initialClasses[0];
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

    const testStudents: Student[] = [
      { id: 'std_g6_1', admission_number: 'ADM-G6-01', full_name: 'Jane Doe', gender: 'F', class_id: cls.id, stream_id: cls.id, grade: 'Grade 6' as GradeName, active: true },
      { id: 'std_g6_2', admission_number: 'ADM-G6-02', full_name: 'John Kamau', gender: 'M', class_id: cls.id, stream_id: cls.id, grade: 'Grade 6' as GradeName, active: true },
    ];

    const testMarks: Mark[] = [
      { id: 'm1', student_id: 'std_g6_1', subject_id: 'sub_eng', exam_id: initialExaminations[0].id, marks: 82, raw_score: 82, out_of: 100, special_status: 'Normal' },
      { id: 'm1_kis', student_id: 'std_g6_1', subject_id: 'sub_kis', exam_id: initialExaminations[0].id, marks: 75, raw_score: 75, out_of: 100, special_status: 'Normal' },
      { id: 'm1_math', student_id: 'std_g6_1', subject_id: 'sub_math', exam_id: initialExaminations[0].id, marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },
      { id: 'm2', student_id: 'std_g6_1', subject_id: 'sub_sct', exam_id: initialExaminations[0].id, marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
      { id: 'm3', student_id: 'std_g6_1', subject_id: 'sub_ca', exam_id: initialExaminations[0].id, marks: 88, raw_score: 88, out_of: 100, special_status: 'Normal' },
      { id: 'm1_agr', student_id: 'std_g6_1', subject_id: 'sub_agr', exam_id: initialExaminations[0].id, marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
      { id: 'm1_ss', student_id: 'std_g6_1', subject_id: 'sub_ss', exam_id: initialExaminations[0].id, marks: 68, raw_score: 68, out_of: 100, special_status: 'Normal' },
      { id: 'm1_cre', student_id: 'std_g6_1', subject_id: 'sub_cre', exam_id: initialExaminations[0].id, marks: 72, raw_score: 72, out_of: 100, special_status: 'Normal' },

      { id: 'm4', student_id: 'std_g6_2', subject_id: 'sub_eng', exam_id: initialExaminations[0].id, marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
      { id: 'm2_kis', student_id: 'std_g6_2', subject_id: 'sub_kis', exam_id: initialExaminations[0].id, marks: 65, raw_score: 65, out_of: 100, special_status: 'Normal' },
      { id: 'm2_math', student_id: 'std_g6_2', subject_id: 'sub_math', exam_id: initialExaminations[0].id, marks: 72, raw_score: 72, out_of: 100, special_status: 'Normal' },
      { id: 'm5', student_id: 'std_g6_2', subject_id: 'sub_sct', exam_id: initialExaminations[0].id, marks: 65, raw_score: 65, out_of: 100, special_status: 'Normal' },
      { id: 'm6', student_id: 'std_g6_2', subject_id: 'sub_ca', exam_id: initialExaminations[0].id, marks: 74, raw_score: 74, out_of: 100, special_status: 'Normal' },
      { id: 'm2_agr', student_id: 'std_g6_2', subject_id: 'sub_agr', exam_id: initialExaminations[0].id, marks: 62, raw_score: 62, out_of: 100, special_status: 'Normal' },
      { id: 'm2_ss', student_id: 'std_g6_2', subject_id: 'sub_ss', exam_id: initialExaminations[0].id, marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
      { id: 'm2_cre', student_id: 'std_g6_2', subject_id: 'sub_cre', exam_id: initialExaminations[0].id, marks: 64, raw_score: 64, out_of: 100, special_status: 'Normal' },
    ];

    const meritListData = {
      school: initialSchool,
      exam: initialExaminations[0],
      selectedClassId: cls.id,
      selectedStreamId: 'all',
      classes: [cls, ...initialClasses],
      teachers: initialTeachers,
      students: testStudents,
      subjects: upperPrimarySubjects,
      marks: testMarks,
      grades: initialGrades,
      eduLevel: 'Upper Primary',
      relevantSubjects: upperPrimarySubjects,
    };

    await expect(downloadMeritListPDF(meritListData as any)).resolves.not.toThrow();
  });
});
