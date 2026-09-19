import { describe, it, expect, beforeEach } from 'vitest';
import { resolveIdentifierToEmail, resolveIdentifierToEmailAsync, authService } from '../services/authService';
import { api, setStorage, KEYS } from '../lib/storage';
import { User, Teacher, Student } from '../types';

describe('Phase 6B — Learner Admission Number Login Resolution Suite', () => {
  const mockAdminUser: User = {
    id: 'usr_admin_01',
    name: 'Administrator',
    email: 'admin@school.ac.ke',
    role: 'admin',
    status: 'Active',
  };

  const mockTeacherUser: User = {
    id: 'usr_teacher_01',
    name: 'Grace Wanjiku',
    email: 'grace@school.ac.ke',
    role: 'class_teacher',
    teacher_id: 'tch_01',
    tsc_number: 'TSC-123456',
    username: 'gwanjiku',
    status: 'Active',
  };

  const mockTeacher: Teacher = {
    id: 'tch_01',
    teacher_name: 'Grace Wanjiku',
    email: 'grace@school.ac.ke',
    phone: '0711000001',
    tsc_number: 'TSC-123456',
    username: 'gwanjiku',
    is_class_teacher: true,
  };

  const mockStudentWithAccount: Student = {
    id: 'std_01',
    admission_number: 'ADM-2024-001',
    full_name: 'Brian Ayiecha',
    gender: 'M',
    class_id: 'cls_01',
    stream_id: 'st_01',
    active: true,
  };

  const mockStudentWithoutAccount: Student = {
    id: 'std_02',
    admission_number: 'ADM-2024-002',
    full_name: 'Amina Mohamed',
    gender: 'F',
    class_id: 'cls_01',
    stream_id: 'st_01',
    active: true,
  };

  const mockLearnerUser: User = {
    id: 'usr_learner_01',
    name: 'Brian Ayiecha',
    email: 'adm-2024-001@learner.cbe.ac.ke',
    role: 'learner',
    student_id: 'std_01',
    status: 'Active',
  };

  beforeEach(() => {
    // Reset cache and synchronize mock records
    setStorage(KEYS.TEACHERS, [mockTeacher]);
    setStorage(KEYS.STUDENTS, [mockStudentWithAccount, mockStudentWithoutAccount]);
    api.syncUsersFromDatabase([mockAdminUser, mockTeacherUser, mockLearnerUser]);
  });

  describe('Test 1 — Admission Number Resolves to Registered Learner Email', () => {
    it('resolves ADM-2024-001 to adm-2024-001@learner.cbe.ac.ke and returns linked learner and student', () => {
      const resolved = resolveIdentifierToEmail('ADM-2024-001');
      expect(resolved).not.toBeNull();
      expect(resolved?.email).toBe('adm-2024-001@learner.cbe.ac.ke');
      expect(resolved?.user?.role).toBe('learner');
      expect(resolved?.user?.student_id).toBe('std_01');
      expect(resolved?.student?.admission_number).toBe('ADM-2024-001');
    });
  });

  describe('Test 2 — Case and Whitespace Handling', () => {
    it('resolves lowercase admission number "adm-2024-001"', () => {
      const resolved = resolveIdentifierToEmail('adm-2024-001');
      expect(resolved).not.toBeNull();
      expect(resolved?.email).toBe('adm-2024-001@learner.cbe.ac.ke');
    });

    it('resolves admission number with leading/trailing whitespace "  ADM-2024-001  "', () => {
      const resolved = resolveIdentifierToEmail('  ADM-2024-001  ');
      expect(resolved).not.toBeNull();
      expect(resolved?.email).toBe('adm-2024-001@learner.cbe.ac.ke');
    });
  });

  describe('Test 3 — Unknown Admission Number', () => {
    it('returns null for unknown admission number ADM-9999-999', () => {
      const resolved = resolveIdentifierToEmail('ADM-9999-999');
      expect(resolved).toBeNull();
    });
  });

  describe('Test 4 — Student Without Learner User Profile', () => {
    it('returns null when student exists in students table but has no public.users learner record', () => {
      const resolved = resolveIdentifierToEmail('ADM-2024-002');
      expect(resolved).toBeNull();
    });
  });

  describe('Test 5 — Staff Email Regression', () => {
    it('continues resolving admin email directly without modification', () => {
      const resolved = resolveIdentifierToEmail('admin@school.ac.ke');
      expect(resolved).not.toBeNull();
      expect(resolved?.email).toBe('admin@school.ac.ke');
      expect(resolved?.user?.role).toBe('admin');
    });

    it('continues resolving teacher email directly', () => {
      const resolved = resolveIdentifierToEmail('grace@school.ac.ke');
      expect(resolved).not.toBeNull();
      expect(resolved?.email).toBe('grace@school.ac.ke');
      expect(resolved?.teacher?.tsc_number).toBe('TSC-123456');
    });
  });

  describe('Test 6 — Teacher TSC Number Regression', () => {
    it('continues resolving TSC-123456 to teacher email', () => {
      const resolved = resolveIdentifierToEmail('TSC-123456');
      expect(resolved).not.toBeNull();
      expect(resolved?.email).toBe('grace@school.ac.ke');
      expect(resolved?.teacher?.teacher_name).toBe('Grace Wanjiku');
    });

    it('continues resolving numeric-only TSC 123456 to teacher email', () => {
      const resolved = resolveIdentifierToEmail('123456');
      expect(resolved).not.toBeNull();
      expect(resolved?.email).toBe('grace@school.ac.ke');
    });
  });

  describe('Test 7 — Username Regression', () => {
    it('continues resolving teacher username "gwanjiku" to teacher email', () => {
      const resolved = resolveIdentifierToEmail('gwanjiku');
      expect(resolved).not.toBeNull();
      expect(resolved?.email).toBe('grace@school.ac.ke');
    });
  });

  describe('Test 8 — No Database Mutation / Safe Read-Only Resolution', () => {
    it('does not mutate students or users arrays during resolution', () => {
      const initialStudentCount = api.getStudents().length;
      const initialUserCount = api.getUsers().length;

      resolveIdentifierToEmail('ADM-2024-001');
      resolveIdentifierToEmail('ADM-9999-999');

      expect(api.getStudents().length).toBe(initialStudentCount);
      expect(api.getUsers().length).toBe(initialUserCount);
    });
  });
});
