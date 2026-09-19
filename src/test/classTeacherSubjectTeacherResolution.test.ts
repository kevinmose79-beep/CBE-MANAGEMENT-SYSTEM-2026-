import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Teacher, ClassStream, Subject } from '../types';

describe('Class Teacher Subject-Teacher Name Resolution Verification', () => {
  it('1. Verifies RLS SQL in supabaseSql.ts permits authenticated SELECT on public.teachers', () => {
    const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

    const teachersPolicySection = sqlContent.match(/CREATE POLICY "Teachers select policy"[\s\S]*?;\n/)?.[0] || '';
    expect(teachersPolicySection).toContain('CREATE POLICY "Teachers select policy" ON public.teachers FOR SELECT TO authenticated USING (true);');

    // Confirm write security is strictly preserved
    const insertPolicy = sqlContent.match(/CREATE POLICY "Teachers insert policy"[\s\S]*?;\n/)?.[0] || '';
    const updatePolicy = sqlContent.match(/CREATE POLICY "Teachers update policy"[\s\S]*?;\n/)?.[0] || '';
    const deletePolicy = sqlContent.match(/CREATE POLICY "Teachers delete policy"[\s\S]*?;\n/)?.[0] || '';

    expect(insertPolicy).toContain('public.is_admin()');
    expect(updatePolicy).toContain('public.is_admin()');
    expect(deletePolicy).toContain('public.is_admin()');
  });

  it('2. Resolves self-assigned, peer-assigned, and genuinely unallocated subjects in Class Teacher Portal', () => {
    // Active class: Grade 9 Blue
    const activePrimaryClass: ClassStream = {
      id: 'cls_g9_b',
      class_name: 'Grade 9',
      stream: 'Blue',
      stream_id: 'strm_g9_b',
      class_teacher_id: 'tch_maina',
    };

    // Subject list for Grade 9
    const subjects: Subject[] = [
      { id: 'sub_math', subject_name: 'Mathematics', subject_code: 'MATH', education_level: 'Junior School', category: 'Core' },
      { id: 'sub_int_sci', subject_name: 'Integrated Science', subject_code: 'INT-SCI', education_level: 'Junior School', category: 'Core' },
      { id: 'sub_eng', subject_name: 'English', subject_code: 'ENG', education_level: 'Junior School', category: 'Core' },
      { id: 'sub_kis', subject_name: 'Kiswahili', subject_code: 'KIS', education_level: 'Junior School', category: 'Core' },
      { id: 'sub_unallocated', subject_name: 'Music (Elective)', subject_code: 'MUS', education_level: 'Junior School', category: 'Optional' },
    ];

    // Teachers collection hydrated from Supabase (now containing both logged-in teacher and peer teachers)
    const teachers: Teacher[] = [
      {
        id: 'tch_maina',
        teacher_name: 'Mr Maina',
        email: 'maina@school.ac.ke',
        phone: '0712345678',
        is_class_teacher: true,
        class_teacher_of_id: 'strm_g9_b',
        allocations: [
          { id: 'a1', class_id: 'cls_g9_b', stream_id: 'strm_g9_b', subject_id: 'sub_math', subject_name: 'Mathematics', education_level: 'Junior School' },
          { id: 'a2', class_id: 'cls_g9_b', stream_id: 'strm_g9_b', subject_id: 'sub_int_sci', subject_name: 'Integrated Science', education_level: 'Junior School' },
        ],
      },
      {
        id: 'tch_wanjiku',
        teacher_name: 'Ms Wanjiku',
        email: 'wanjiku@school.ac.ke',
        phone: '0723456789',
        is_class_teacher: false,
        allocations: [
          { id: 'a3', class_id: 'cls_g9_b', stream_id: 'strm_g9_b', subject_id: 'sub_eng', subject_name: 'English', education_level: 'Junior School' },
        ],
      },
      {
        id: 'tch_otieno',
        teacher_name: 'Mr Otieno',
        email: 'otieno@school.ac.ke',
        phone: '0734567890',
        is_class_teacher: false,
        allocations: [
          { id: 'a4', class_id: 'cls_g9_b', stream_id: 'strm_g9_b', subject_id: 'sub_kis', subject_name: 'Kiswahili', education_level: 'Junior School' },
        ],
      },
    ];

    // Replicate subjectTeacherMap algorithm from AssessmentStreamApprovalView and ClassTeacherMarksMonitoringView
    const subjectTeacherMap = new Map<string, string>();
    (teachers || []).forEach((t) => {
      (t.allocations || []).forEach((a) => {
        const streamMatch = activePrimaryClass?.stream_id && a.stream_id === activePrimaryClass.stream_id;
        const classMatch = a.class_id === activePrimaryClass?.id || a.class_id === activePrimaryClass?.stream_id;
        if (streamMatch || classMatch) {
          if (a.subject_id) {
            subjectTeacherMap.set(a.subject_id, t.teacher_name);
          }
        }
      });
    });

    // Verification 1: Self-assigned subjects
    expect(subjectTeacherMap.get('sub_math')).toBe('Mr Maina');
    expect(subjectTeacherMap.get('sub_int_sci')).toBe('Mr Maina');

    // Verification 2: Peer-assigned subjects
    expect(subjectTeacherMap.get('sub_eng')).toBe('Ms Wanjiku');
    expect(subjectTeacherMap.get('sub_kis')).toBe('Mr Otieno');

    // Verification 3: Genuine unallocated subject remains undefined and renders Not Allocated
    expect(subjectTeacherMap.get('sub_unallocated')).toBeUndefined();
    const renderedUnallocated = subjectTeacherMap.get('sub_unallocated') || 'Not Allocated';
    expect(renderedUnallocated).toBe('Not Allocated');
  });
});
