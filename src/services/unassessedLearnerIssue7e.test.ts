import { describe, it, expect } from 'vitest';
import { calculateExamResults, CBE_8_POINT_GRADES } from './analysisEngine';
import { Student, School, Examination, ClassStream, Subject, Mark } from '../types';
import { formatPercentage } from '../utils/markUtils';

describe('Unassessed Learner Status Audit & Fix (Issue 7E)', () => {
  it('correctly handles unassessed learner vs genuine zero vs partial learner', () => {
    const school: School = {
      id: 'sch_01',
      school_name: 'Kilimani Pre-Primary and Primary School',
      county: 'Nairobi',
      email: 'info@kilimani.sc.ke',
      motto: 'Strive to Excel',
      logo_url: '',
    };

    const ppSubjects: Subject[] = [
      { id: 'sub_pp_math', subject_code: 'PP-MATH', subject_name: 'Mathematical Activities', category: 'Core' },
      { id: 'sub_pp_pca', subject_code: 'PP-PCA', subject_name: 'Psychomotor & Creative Activities', category: 'Core' },
      { id: 'sub_pp_cre', subject_code: 'PP-CRE', subject_name: 'Christian Religious Education Activities', category: 'Core' },
      { id: 'sub_pp_env', subject_code: 'PP-ENV', subject_name: 'Environmental Activities', category: 'Core' },
      { id: 'sub_pp_lang', subject_code: 'PP-LANG', subject_name: 'Language Activities', category: 'Core' },
    ];

    const pp1Class: ClassStream = {
      id: 'cls_pp1_north',
      class_name: 'PP1',
      stream: 'North',
      education_level: 'Pre-Primary',
      allocated_subject_ids: ppSubjects.map(s => s.id),
    };

    const examPP1: Examination = {
      id: 'exam_2025_pp1_mid',
      exam_name: 'Mid Term 1 Examination',
      term: 'Term 1',
      academic_year_id: 'ay_2025',
      year: 2025,
      exam_type: 'Mid-Term',
      max_marks: 100,
      start_date: '2025-02-10',
      end_date: '2025-02-15',
      status: 'Published',
    };

    const studentJonKopps: Student = {
      id: 'std_jon_kopps',
      admission_number: 'ADM-101',
      full_name: 'Jon Kopps',
      grade: 'PP1',
      class_id: 'cls_pp1_north',
      gender: 'M',
      active: true,
    };

    const studentGenuineZero: Student = {
      id: 'std_genuine_zero',
      admission_number: 'ADM-102',
      full_name: 'Zero Learner',
      grade: 'PP1',
      class_id: 'cls_pp1_north',
      gender: 'F',
      active: true,
    };

    const studentPartial: Student = {
      id: 'std_partial',
      admission_number: 'ADM-103',
      full_name: 'Partial Learner',
      grade: 'PP1',
      class_id: 'cls_pp1_north',
      gender: 'M',
      active: true,
    };

    const studentAllX: Student = {
      id: 'std_absent',
      admission_number: 'ADM-104',
      full_name: 'Absent Learner',
      grade: 'PP1',
      class_id: 'cls_pp1_north',
      gender: 'F',
      active: true,
    };

    const studentHigh: Student = {
      id: 'std_high',
      admission_number: 'ADM-100',
      full_name: 'Top Learner',
      grade: 'PP1',
      class_id: 'cls_pp1_north',
      gender: 'F',
      active: true,
    };

    const cohortStudents = [studentHigh, studentGenuineZero, studentJonKopps, studentPartial, studentAllX];

    const marks: Mark[] = [
      // Top Learner (90 in all 5 subjects)
      { id: 'm_h1', exam_id: examPP1.id, student_id: studentHigh.id, subject_id: 'sub_pp_math', marks: 90 },
      { id: 'm_h2', exam_id: examPP1.id, student_id: studentHigh.id, subject_id: 'sub_pp_pca', marks: 90 },
      { id: 'm_h3', exam_id: examPP1.id, student_id: studentHigh.id, subject_id: 'sub_pp_cre', marks: 90 },
      { id: 'm_h4', exam_id: examPP1.id, student_id: studentHigh.id, subject_id: 'sub_pp_env', marks: 90 },
      { id: 'm_h5', exam_id: examPP1.id, student_id: studentHigh.id, subject_id: 'sub_pp_lang', marks: 90 },

      // Genuine Zero (0 in all 5 subjects)
      { id: 'm_z1', exam_id: examPP1.id, student_id: studentGenuineZero.id, subject_id: 'sub_pp_math', marks: 0 },
      { id: 'm_z2', exam_id: examPP1.id, student_id: studentGenuineZero.id, subject_id: 'sub_pp_pca', marks: 0 },
      { id: 'm_z3', exam_id: examPP1.id, student_id: studentGenuineZero.id, subject_id: 'sub_pp_cre', marks: 0 },
      { id: 'm_z4', exam_id: examPP1.id, student_id: studentGenuineZero.id, subject_id: 'sub_pp_env', marks: 0 },
      { id: 'm_z5', exam_id: examPP1.id, student_id: studentGenuineZero.id, subject_id: 'sub_pp_lang', marks: 0 },

      // Jon Kopps (no marks entered at all)

      // Partial Learner (only math entered with 80)
      { id: 'm_p1', exam_id: examPP1.id, student_id: studentPartial.id, subject_id: 'sub_pp_math', marks: 80 },

      // Absent Learner (X in all subjects)
      { id: 'm_a1', exam_id: examPP1.id, student_id: studentAllX.id, subject_id: 'sub_pp_math', marks: 'X' as any },
      { id: 'm_a2', exam_id: examPP1.id, student_id: studentAllX.id, subject_id: 'sub_pp_pca', marks: 'X' as any },
      { id: 'm_a3', exam_id: examPP1.id, student_id: studentAllX.id, subject_id: 'sub_pp_cre', marks: 'X' as any },
      { id: 'm_a4', exam_id: examPP1.id, student_id: studentAllX.id, subject_id: 'sub_pp_env', marks: 'X' as any },
      { id: 'm_a5', exam_id: examPP1.id, student_id: studentAllX.id, subject_id: 'sub_pp_lang', marks: 'X' as any },
    ];

    const results = calculateExamResults(
      examPP1.id,
      cohortStudents,
      marks,
      CBE_8_POINT_GRADES,
      [pp1Class],
      ppSubjects
    );

    function generateRowForStudent(r: any, student: Student) {
      const isUnassessed = (r.subject_count || 0) === 0;
      const streamRank = r.is_complete ? String(r.position) : '-';
      const overallPos = r.is_complete ? String(r.class_position || r.position) : '-';
      const totalMarks = r.total_marks;
      const avgPct = r.is_complete ? formatPercentage(r.average, true) : `${Math.round(r.average)}% (P)`;
      const totalPts = r.is_complete ? String(r.total_points) : '-';
      const avgPts = r.is_complete ? (r.average_points?.toFixed(2) || (r.subject_count > 0 ? (r.total_points / r.subject_count).toFixed(2) : '-')) : '-';
      const cbeLevel = isUnassessed ? '-' : (r.performance_level || '-');
      let gradeCode = isUnassessed ? 'Pending' : (r.is_complete ? (r.grade_code || '-') : `Prov (${r.grade_code || 'CBE'})`);

      return {
        streamRank,
        overallPos,
        totalMarks,
        avgPct,
        totalPts,
        avgPts,
        cbeLevel,
        gradeCode,
      };
    }

    // A. Test Jon Kopps (Unassessed)
    const jonRes = results.find(r => r.student_id === 'std_jon_kopps')!;
    expect(jonRes).toBeDefined();
    expect(jonRes.is_complete).toBe(false);
    expect(jonRes.status).toBe('Provisional');
    expect(jonRes.position).toBe(0);
    expect(jonRes.class_position).toBe(0);
    expect(jonRes.subject_count).toBe(0);
    expect(jonRes.performance_level).toBe('-');
    expect(jonRes.grade_code).toBe('-');
    expect(jonRes.points).toBe(0);

    const jonRow = generateRowForStudent(jonRes, studentJonKopps);
    expect(jonRow.streamRank).toBe('-');
    expect(jonRow.overallPos).toBe('-');
    expect(jonRow.totalMarks).toBe(0);
    expect(jonRow.avgPct).toBe('0% (P)');
    expect(jonRow.totalPts).toBe('-');
    expect(jonRow.avgPts).toBe('-');
    expect(jonRow.cbeLevel).toBe('-');
    expect(jonRow.gradeCode).toBe('Pending');

    // B. Test Genuine Zero (Scored 0 in all subjects)
    const zeroRes = results.find(r => r.student_id === 'std_genuine_zero')!;
    expect(zeroRes).toBeDefined();
    expect(zeroRes.is_complete).toBe(true);
    expect(zeroRes.status).toBe('Complete');
    expect(zeroRes.position).toBe(2);
    expect(zeroRes.class_position).toBe(2);
    expect(zeroRes.subject_count).toBe(5);
    expect(zeroRes.performance_level).toBe('BE');
    expect(zeroRes.grade_code).toBe('BE');
    expect(zeroRes.points).toBe(1);

    const zeroRow = generateRowForStudent(zeroRes, studentGenuineZero);
    expect(zeroRow.streamRank).toBe('2');
    expect(zeroRow.overallPos).toBe('2');
    expect(zeroRow.totalMarks).toBe(0);
    expect(zeroRow.avgPct).toBe('0%');
    expect(zeroRow.totalPts).toBe('5');
    expect(zeroRow.avgPts).toBe('1.00');
    expect(zeroRow.cbeLevel).toBe('BE');
    expect(zeroRow.gradeCode).toBe('BE');

    // C. Test Partial Learner (1 subject 80)
    const partialRes = results.find(r => r.student_id === 'std_partial')!;
    expect(partialRes.is_complete).toBe(false);
    expect(partialRes.position).toBe(0);
    expect(partialRes.subject_count).toBe(1);
    expect(partialRes.performance_level).toBe('EE');
    expect(partialRes.grade_code).toBe('EE');

    const partialRow = generateRowForStudent(partialRes, studentPartial);
    expect(partialRow.streamRank).toBe('-');
    expect(partialRow.overallPos).toBe('-');
    expect(partialRow.totalMarks).toBe(80);
    expect(partialRow.avgPct).toBe('80% (P)');
    expect(partialRow.totalPts).toBe('-');
    expect(partialRow.avgPts).toBe('-');
    expect(partialRow.cbeLevel).toBe('EE');
    expect(partialRow.gradeCode).toBe('Prov (EE)');

    // D. Test All-X Learner
    const absentRes = results.find(r => r.student_id === 'std_absent')!;
    expect(absentRes.is_complete).toBe(false);
    expect(absentRes.position).toBe(0);
    expect(absentRes.subject_count).toBe(0);
    expect(absentRes.performance_level).toBe('-');
    expect(absentRes.grade_code).toBe('-');

    const absentRow = generateRowForStudent(absentRes, studentAllX);
    expect(absentRow.streamRank).toBe('-');
    expect(absentRow.cbeLevel).toBe('-');
    expect(absentRow.gradeCode).toBe('Pending');
  });
});
