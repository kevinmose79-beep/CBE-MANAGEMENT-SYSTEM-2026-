import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getAccessibleStudents,
  getAccessibleClasses,
  getAccessibleSubjects,
} from '../utils/rbacUtils';
import { User, Teacher, Student, ClassStream, Subject } from '../types';

describe('Subject Teacher Learner Access & RLS Verification', () => {
  it('verifies src/lib/supabaseSql.ts defines Teacher select assigned students policy and allocated_students view', () => {
    const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

    expect(sqlContent).toContain('CREATE POLICY "Teacher select assigned students" ON public.students FOR SELECT');
    expect(sqlContent).toContain('CREATE OR REPLACE VIEW public.allocated_students');
    expect(sqlContent).toContain('GRANT SELECT ON public.allocated_students TO authenticated');
    expect(sqlContent).toContain('CREATE POLICY "Class Teacher select roster" ON public.students');
    expect(sqlContent).toContain('CREATE POLICY "Admin full access students" ON public.students');
  });

  it('verifies getAccessibleStudents correctly filters learners for subject teachers', () => {
    const subjectTeacherUser: User = {
      id: 'usr_subj_1',
      name: 'Teacher Science',
      username: 'teacher.science',
      role: 'subject_teacher',
      email: 'science@school.ac.ke',
      teacher_id: 'tch_subj_1',
    };

    const activeTeacher: Teacher = {
      id: 'tch_subj_1',
      user_id: 'usr_subj_1',
      teacher_name: 'Mr. Science',
      phone: '+254700000001',
      email: 'science@school.ac.ke',
      is_class_teacher: false,
      allocations: [
        {
          id: 'alloc_1',
          class_name: 'Grade 7',
          stream: 'East',
          stream_id: 'strm_g7_east',
          class_id: 'cls_g7',
          subject_id: 'subj_integ_sci',
          subject_name: 'Integrated Science',
          education_level: 'Junior School',
        },
      ],
    };

    const classes: ClassStream[] = [
      {
        id: 'cls_g7',
        class_name: 'Grade 7',
        stream: 'East',
        stream_id: 'strm_g7_east',
        education_level: 'Junior School',
      },
      {
        id: 'cls_g7',
        class_name: 'Grade 7',
        stream: 'West',
        stream_id: 'strm_g7_west',
        education_level: 'Junior School',
      },
    ];

    const students: Student[] = [
      {
        id: 'std_1',
        admission_number: 'ADM-101',
        full_name: 'Kiprono Koech',
        gender: 'M',
        class_id: 'cls_g7',
        stream_id: 'strm_g7_east',
        active: true,
      },
      {
        id: 'std_2',
        admission_number: 'ADM-102',
        full_name: 'Amina Mohamed',
        gender: 'F',
        class_id: 'cls_g7',
        stream_id: 'strm_g7_west',
        active: true,
      },
    ];

    const accessible = getAccessibleStudents(subjectTeacherUser, activeTeacher, students, classes);

    // Subject teacher should only access student 1 in Grade 7 East
    expect(accessible).toHaveLength(1);
    expect(accessible[0].id).toBe('std_1');
    expect(accessible[0].full_name).toBe('Kiprono Koech');
  });

  it('verifies getAccessibleClasses and getAccessibleSubjects for subject teachers', () => {
    const subjectTeacherUser: User = {
      id: 'usr_subj_1',
      name: 'Teacher Math',
      username: 'teacher.math',
      role: 'subject_teacher',
      email: 'math@school.ac.ke',
      teacher_id: 'tch_subj_1',
    };

    const activeTeacher: Teacher = {
      id: 'tch_subj_1',
      user_id: 'usr_subj_1',
      teacher_name: 'Mrs. Math',
      phone: '+254700000002',
      email: 'math@school.ac.ke',
      is_class_teacher: false,
      allocations: [
        {
          id: 'alloc_2',
          class_name: 'Grade 8',
          stream: 'North',
          stream_id: 'strm_g8_north',
          class_id: 'cls_g8',
          subject_id: 'subj_math',
          subject_name: 'Mathematics',
          education_level: 'Junior School',
        },
      ],
    };

    const classes: ClassStream[] = [
      {
        id: 'cls_g8',
        class_name: 'Grade 8',
        stream: 'North',
        stream_id: 'strm_g8_north',
        education_level: 'Junior School',
      },
      {
        id: 'cls_g8',
        class_name: 'Grade 8',
        stream: 'South',
        stream_id: 'strm_g8_south',
        education_level: 'Junior School',
      },
    ];

    const subjects: Subject[] = [
      {
        id: 'subj_math',
        subject_name: 'Mathematics',
        subject_code: 'MATH',
        category: 'Core',
        education_level: 'Junior School',
      },
      {
        id: 'subj_eng',
        subject_name: 'English',
        subject_code: 'ENG',
        category: 'Core',
        education_level: 'Junior School',
      },
    ];

    const accessibleClasses = getAccessibleClasses(subjectTeacherUser, activeTeacher, classes);
    expect(accessibleClasses).toHaveLength(1);
    expect(accessibleClasses[0].stream_id).toBe('strm_g8_north');

    const accessibleSubjects = getAccessibleSubjects(subjectTeacherUser, activeTeacher, subjects, 'strm_g8_north', classes);
    expect(accessibleSubjects).toHaveLength(1);
    expect(accessibleSubjects[0].id).toBe('subj_math');
  });
});
