import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  canUserAccessClassComparison,
  isTabAllowedForRole,
  getAccessibleClassesForComparison,
  getAccessibleStudentsForComparison,
} from '../utils/rbacUtils';
import { User, Teacher, ClassStream, Student } from '../types';

describe('Class Performance Comparison RBAC Authorization Matrix', () => {
  const mockClasses: ClassStream[] = [
    {
      id: 'cls_grade7_north',
      class_name: 'Grade 7',
      stream: 'North',
      stream_id: 'str_7_north',
      class_teacher_id: 'tch_class_teacher',
      education_level: 'Junior School',
    },
    {
      id: 'cls_grade7_south',
      class_name: 'Grade 7',
      stream: 'South',
      stream_id: 'str_7_south',
      class_teacher_id: 'tch_other_teacher',
      education_level: 'Junior School',
    },
  ];

  const adminUser: User = {
    id: 'usr_admin',
    name: 'Administrator',
    email: 'admin@school.ac.ke',
    role: 'admin',
  };

  const classTeacherUser: User = {
    id: 'usr_class_teacher',
    name: 'Mr. Class Teacher',
    email: 'classteacher@school.ac.ke',
    role: 'class_teacher',
    teacher_id: 'tch_class_teacher',
  };

  const classTeacherObj: Teacher = {
    id: 'tch_class_teacher',
    user_id: 'usr_class_teacher',
    teacher_name: 'Mr. Class Teacher',
    phone: '0712345678',
    email: 'classteacher@school.ac.ke',
    class_teacher_of_id: 'str_7_north',
    allocations: [
      {
        id: 'alloc_1',
        education_level: 'Junior School',
        class_id: 'cls_grade7_north',
        stream_id: 'str_7_north',
        subject_id: 'sub_mat',
        subject_name: 'Mathematics',
      },
    ],
  };

  const subjectTeacherUser: User = {
    id: 'usr_subject_teacher',
    name: 'Ms. Subject Teacher',
    email: 'subjectteacher@school.ac.ke',
    role: 'subject_teacher',
    teacher_id: 'tch_subject_teacher',
  };

  const subjectTeacherObj: Teacher = {
    id: 'tch_subject_teacher',
    user_id: 'usr_subject_teacher',
    teacher_name: 'Ms. Subject Teacher',
    phone: '0723456789',
    email: 'subjectteacher@school.ac.ke',
    allocations: [
      {
        id: 'alloc_2',
        education_level: 'Junior School',
        class_id: 'cls_grade7_north',
        stream_id: 'str_7_north',
        subject_id: 'sub_eng',
        subject_name: 'English',
      },
    ],
  };

  const learnerUser: User = {
    id: 'usr_learner',
    name: 'Learner One',
    email: 'learner@school.ac.ke',
    role: 'learner',
  };

  // --- 1. CORE RBAC PERMISSION MATRIX ---
  describe('1. Role-Based Access Policy Matrix', () => {
    it('Admin Portal: ALLOWS Class Performance Comparison', () => {
      const allowed = canUserAccessClassComparison(adminUser, null, mockClasses);
      expect(allowed).toBe(true);
    });

    it('Stream Class Teacher Portal: ALLOWS Class Performance Comparison (within authorized scope)', () => {
      const allowed = canUserAccessClassComparison(classTeacherUser, classTeacherObj, mockClasses);
      expect(allowed).toBe(true);
    });

    it('Subject Teacher Portal: STRICTLY BLOCKS Class Performance Comparison', () => {
      const allowed = canUserAccessClassComparison(subjectTeacherUser, subjectTeacherObj, mockClasses);
      expect(allowed).toBe(false);
    });

    it('Subject Teacher without Teacher object: STRICTLY BLOCKS Class Performance Comparison', () => {
      const allowed = canUserAccessClassComparison(subjectTeacherUser, null, mockClasses);
      expect(allowed).toBe(false);
    });

    it('Learner Portal: STRICTLY BLOCKS Class Performance Comparison', () => {
      const allowed = canUserAccessClassComparison(learnerUser, null, mockClasses);
      expect(allowed).toBe(false);
    });

    it('Anonymous/Null User: STRICTLY BLOCKS Class Performance Comparison', () => {
      const allowed = canUserAccessClassComparison(null, null, mockClasses);
      expect(allowed).toBe(false);
    });
  });

  // --- 2. REPORTS TAB LEVEL PERMISSIONS ---
  describe('2. Reports Tab Level Access', () => {
    it('Admin is allowed to access Reports tab', () => {
      expect(isTabAllowedForRole(adminUser, 'reports', null, mockClasses)).toBe(true);
    });

    it('Stream Class Teacher is allowed to access Reports tab', () => {
      expect(isTabAllowedForRole(classTeacherUser, 'reports', classTeacherObj, mockClasses)).toBe(true);
    });

    it('Subject Teacher is allowed to access Reports tab (for legitimate Subject Analysis)', () => {
      expect(isTabAllowedForRole(subjectTeacherUser, 'reports', subjectTeacherObj, mockClasses)).toBe(true);
    });

    it('Learner is NOT allowed to access Reports tab', () => {
      expect(isTabAllowedForRole(learnerUser, 'reports', null, mockClasses)).toBe(false);
    });
  });

  // --- 3. STATE BYPASS AND DEFENSIVE GUARDS AUDIT ---
  describe('3. Defensive State Bypass & Rendering Audit in ReportsView.tsx', () => {
    const reportsViewPath = path.resolve(process.cwd(), 'src/components/ReportsView.tsx');
    const reportsViewSource = fs.readFileSync(reportsViewPath, 'utf-8');

    it('ReportsView imports canUserAccessClassComparison from rbacUtils', () => {
      expect(reportsViewSource).toContain('canUserAccessClassComparison');
    });

    it('ReportsView computes canAccessComparison using canUserAccessClassComparison', () => {
      expect(reportsViewSource).toContain(
        'canUserAccessClassComparison(currentUser || null, activeTeacher, classes)'
      );
    });

    it('ReportsView guards Class Performance Comparison tab button with canAccessComparison', () => {
      expect(reportsViewSource).toMatch(
        /\{canAccessComparison\s*&&\s*\(\s*<button[\s\S]*?id="class-comparison-tab-btn"/
      );
    });

    it('ReportsView guards ClassPerformanceComparisonView component rendering with canAccessComparison', () => {
      expect(reportsViewSource).toMatch(
        /reportTab === 'class_comparison'\s*&&\s*canAccessComparison/
      );
    });

    it('ReportsView contains defensive state correction effect to reset tab if unauthorized', () => {
      expect(reportsViewSource).toContain(
        "!canAccessComparison && reportTab === 'class_comparison'"
      );
      expect(reportsViewSource).toContain("setReportTab('subject')");
    });

    it('ReportsView prevents comparison mode network fetch if not authorized', () => {
      expect(reportsViewSource).toContain(
        "const isComparisonMode = reportTab === 'class_comparison' && canAccessComparison;"
      );
    });
  });

  // --- 4. MULTI-STREAM VISIBILITY FOR CLASS TEACHERS IN COMPARISON MODE ---
  describe('4. Multi-Stream Visibility for Class Teachers in Comparison Mode', () => {
    const northStudent: Student = {
      id: 'std_north_1',
      admission_number: 'ADM-001',
      full_name: 'Alice North',
      grade: 'Grade 7',
      class_id: 'cls_grade7_north',
      stream_id: 'str_7_north',
      gender: 'F',
      active: true,
    };

    const southStudent: Student = {
      id: 'std_south_1',
      admission_number: 'ADM-002',
      full_name: 'Bob South',
      grade: 'Grade 7',
      class_id: 'cls_grade7_south',
      stream_id: 'str_7_south',
      gender: 'M',
      active: true,
    };

    const mockStudents: Student[] = [northStudent, southStudent];

    it('getAccessibleClassesForComparison: Class Teacher assigned to North stream can see BOTH North and South streams of Grade 7', () => {
      const compClasses = getAccessibleClassesForComparison(
        classTeacherUser,
        classTeacherObj,
        mockClasses
      );
      expect(compClasses).toHaveLength(2);
      expect(compClasses.some((c) => c.stream_id === 'str_7_north')).toBe(true);
      expect(compClasses.some((c) => c.stream_id === 'str_7_south')).toBe(true);
    });

    it('getAccessibleStudentsForComparison: Class Teacher assigned to North stream can see learners from BOTH streams in comparison mode', () => {
      const compStudents = getAccessibleStudentsForComparison(
        classTeacherUser,
        classTeacherObj,
        mockStudents,
        mockClasses
      );
      expect(compStudents).toHaveLength(2);
      expect(compStudents.some((s) => s.id === 'std_north_1')).toBe(true);
      expect(compStudents.some((s) => s.id === 'std_south_1')).toBe(true);
    });

    it('getAccessibleClassesForComparison: Admin can see all classes across all grades and streams', () => {
      const compClasses = getAccessibleClassesForComparison(adminUser, null, mockClasses);
      expect(compClasses).toHaveLength(2);
    });

    it('getAccessibleStudentsForComparison: Admin can see all students', () => {
      const compStudents = getAccessibleStudentsForComparison(
        adminUser,
        null,
        mockStudents,
        mockClasses
      );
      expect(compStudents).toHaveLength(2);
    });

    it('getAccessibleClassesForComparison: Subject Teacher gets empty array (strictly blocked)', () => {
      const compClasses = getAccessibleClassesForComparison(
        subjectTeacherUser,
        subjectTeacherObj,
        mockClasses
      );
      expect(compClasses).toHaveLength(0);
    });

    it('getAccessibleStudentsForComparison: Subject Teacher gets empty array (strictly blocked)', () => {
      const compStudents = getAccessibleStudentsForComparison(
        subjectTeacherUser,
        subjectTeacherObj,
        mockStudents,
        mockClasses
      );
      expect(compStudents).toHaveLength(0);
    });
  });
});
