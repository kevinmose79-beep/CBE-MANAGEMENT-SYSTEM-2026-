import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { canUserAccessClassComparison, getAccessibleClassesForComparison } from '../utils/rbacUtils';
import { generateClassPerformanceComparison } from '../services/classComparisonEngine';
import type { User, Teacher, Student, ClassStream, Subject, Mark, Grade, Examination } from '../types';

describe('Surgical Fix Verification — Class Teacher Class Performance Comparison', () => {
  const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  it('verifies public.students RLS policy allows class teachers to read all streams within their assigned grade', () => {
    expect(sqlContent).toContain('CREATE POLICY "Class Teacher select roster" ON public.students FOR SELECT');
    expect(sqlContent).toContain('st.class_teacher_id = t.id');
    expect(sqlContent).toContain('other_st.class_id = st.class_id');
  });

  it('verifies public.marks RLS policy allows class teachers to read all marks within their assigned grade', () => {
    expect(sqlContent).toContain('CREATE POLICY "Marks select policy" ON public.marks FOR SELECT');
    expect(sqlContent).toContain('st.class_teacher_id = t.id');
    expect(sqlContent).toContain('other_st.class_id = st.class_id');
  });

  it('verifies class teacher has RBAC permission for class comparison strictly for their assigned grade level', () => {
    const classTeacherUser: User = {
      id: 'usr-ct-1',
      name: 'David Maina',
      email: 'maina@school.ke',
      username: 'maina',
      role: 'class_teacher',
      teacher_id: 't-maina-uuid',
    };

    const teachers: Teacher[] = [
      {
        id: 't-maina-uuid',
        user_id: 'usr-ct-1',
        teacher_name: 'David Maina',
        email: 'maina@school.ke',
        phone: '0712345678',
        is_class_teacher: true,
        class_teacher_of_id: 'stream-9-blue',
      },
      {
        id: 't-kamau-uuid',
        user_id: 'usr-ct-2',
        teacher_name: 'Sarah Kamau',
        email: 'kamau@school.ke',
        phone: '0712345679',
        is_class_teacher: true,
        class_teacher_of_id: 'stream-9-red',
      },
    ];

    const classes: ClassStream[] = [
      { id: 'grade-9', class_name: 'Grade 9', stream: 'Blue', stream_id: 'stream-9-blue', class_teacher_id: 't-maina-uuid' },
      { id: 'grade-9', class_name: 'Grade 9', stream: 'Red', stream_id: 'stream-9-red', class_teacher_id: 't-kamau-uuid' },
      { id: 'grade-8', class_name: 'Grade 8', stream: 'East', stream_id: 'stream-8-east', class_teacher_id: 't-other-uuid' },
    ];

    // 1. RBAC check
    expect(canUserAccessClassComparison(classTeacherUser)).toBe(true);

    // 2. Accessible classes scope check
    const accessibleComparisonClasses = getAccessibleClassesForComparison(classTeacherUser, teachers[0], classes);
    const classNames = accessibleComparisonClasses.map((c) => c.class_name);
    expect(classNames).toContain('Grade 9');
    expect(classNames).not.toContain('Grade 8');
  });

  it('verifies generateClassPerformanceComparison successfully generates stream comparisons when marks from all streams are present', () => {
    const examination = {
      id: 'exam-end-term-1',
      exam_name: 'End Term 1 2026',
      term: 'Term 1',
      academic_year: '2026',
      status: 'Published',
      is_active: true,
    } as any as Examination;

    const classes = [
      { id: 'grade-9', class_name: 'Grade 9', stream: 'Blue', stream_id: 'stream-9-blue', class_teacher_id: 't-maina-uuid' },
      { id: 'grade-9', class_name: 'Grade 9', stream: 'Red', stream_id: 'stream-9-red', class_teacher_id: 't-kamau-uuid' },
    ] as any as ClassStream[];

    const students = [
      { id: 'std-b1', admission_number: 'ADM-001', first_name: 'Alice', last_name: 'Blue', grade: 'Grade 9', stream: 'Blue', class_id: 'grade-9', stream_id: 'stream-9-blue', is_active: true },
      { id: 'std-b2', admission_number: 'ADM-002', first_name: 'Bob', last_name: 'Blue', grade: 'Grade 9', stream: 'Blue', class_id: 'grade-9', stream_id: 'stream-9-blue', is_active: true },
      { id: 'std-r1', admission_number: 'ADM-101', first_name: 'Charlie', last_name: 'Red', grade: 'Grade 9', stream: 'Red', class_id: 'grade-9', stream_id: 'stream-9-red', is_active: true },
      { id: 'std-r2', admission_number: 'ADM-102', first_name: 'Diana', last_name: 'Red', grade: 'Grade 9', stream: 'Red', class_id: 'grade-9', stream_id: 'stream-9-red', is_active: true },
    ] as any as Student[];

    const subjects = [
      { id: 'sub-math', subject_code: 'MATH', subject_name: 'Mathematics', is_active: true },
      { id: 'sub-eng', subject_code: 'ENG', subject_name: 'English', is_active: true },
    ] as any as Subject[];

    const marks = [
      // Alice (Blue)
      { id: 'm1', student_id: 'std-b1', subject_id: 'sub-math', exam_id: 'exam-end-term-1', score: 80 },
      { id: 'm2', student_id: 'std-b1', subject_id: 'sub-eng', exam_id: 'exam-end-term-1', score: 70 },
      // Bob (Blue)
      { id: 'm3', student_id: 'std-b2', subject_id: 'sub-math', exam_id: 'exam-end-term-1', score: 60 },
      { id: 'm4', student_id: 'std-b2', subject_id: 'sub-eng', exam_id: 'exam-end-term-1', score: 50 },
      // Charlie (Red)
      { id: 'm5', student_id: 'std-r1', subject_id: 'sub-math', exam_id: 'exam-end-term-1', score: 75 },
      { id: 'm6', student_id: 'std-r1', subject_id: 'sub-eng', exam_id: 'exam-end-term-1', score: 85 },
      // Diana (Red)
      { id: 'm7', student_id: 'std-r2', subject_id: 'sub-math', exam_id: 'exam-end-term-1', score: 65 },
      { id: 'm8', student_id: 'std-r2', subject_id: 'sub-eng', exam_id: 'exam-end-term-1', score: 75 },
    ] as any as Mark[];

    const grades = [
      { id: 'g-ee', grade_name: 'Exceeding Expectations', min_score: 80, max_score: 100, points: 4, remarks: 'EE' },
      { id: 'g-me', grade_name: 'Meeting Expectations', min_score: 60, max_score: 79, points: 3, remarks: 'ME' },
      { id: 'g-ae', grade_name: 'Approaching Expectations', min_score: 40, max_score: 59, points: 2, remarks: 'AE' },
      { id: 'g-be', grade_name: 'Below Expectations', min_score: 0, max_score: 39, points: 1, remarks: 'BE' },
    ] as any as Grade[];

    const comparison = generateClassPerformanceComparison(
      examination,
      'Grade 9',
      students,
      classes,
      subjects,
      marks,
      grades
    );

    expect(comparison.streams.length).toBe(2);
    const blueStream = comparison.streams.find((s) => s.name === 'Blue');
    const redStream = comparison.streams.find((s) => s.name === 'Red');

    expect(blueStream).toBeDefined();
    expect(redStream).toBeDefined();
    expect(blueStream!.learnerCount).toBe(2);
    expect(redStream!.learnerCount).toBe(2);

    const blueRanking = comparison.aggregateComparison.stream_rankings.find((s) => s.stream_name === 'Blue');
    const redRanking = comparison.aggregateComparison.stream_rankings.find((s) => s.stream_name === 'Red');

    expect(blueRanking).toBeDefined();
    expect(redRanking).toBeDefined();
    expect(blueRanking!.assessed_count).toBe(2);
    expect(redRanking!.assessed_count).toBe(2);

    // Blue avg total marks = ((80+70) + (60+50)) / 2 = (150 + 110) / 2 = 130
    // Red avg total marks = ((75+85) + (65+75)) / 2 = (160 + 140) / 2 = 150
    expect(blueRanking!.average_marks).toBeCloseTo(130, 1);
    expect(redRanking!.average_marks).toBeCloseTo(150, 1);

    // Subject breakdown
    expect(comparison.rows.length).toBe(2);
    const mathRow = comparison.rows.find((r) => r.subject_code === 'MATH');
    expect(mathRow).toBeDefined();
    expect(mathRow!.stream_means[blueStream!.id].mean_percentage).toBe(70); // (80 + 60)/2
    expect(mathRow!.stream_means[redStream!.id].mean_percentage).toBe(70);  // (75 + 65)/2
  });
});
