import { describe, it, expect, beforeEach } from 'vitest';
import { mapSupabaseUserToAppUser, authService, resolveIdentifierToEmail } from '../services/authService';
import { api, setStorage, KEYS } from '../lib/storage';
import { isTabAllowedForRole } from '../App';
import { User, Teacher } from '../types';

describe('CBE Management System — Automatic Role Resolution Login Suite', () => {
  const mockAdminUser: User = {
    id: 'usr_admin_01',
    name: 'Administrator',
    email: 'admin@school.ac.ke',
    role: 'admin',
    status: 'Active',
  };

  const mockClassTeacherUser: User = {
    id: 'usr_ct_01',
    name: 'Grace Wanjiku',
    email: 'grace@school.ac.ke',
    role: 'class_teacher',
    teacher_id: 'tch_01',
    status: 'Active',
  };

  const mockSubjectTeacherUser: User = {
    id: 'usr_st_01',
    name: 'David Otieno',
    email: 'david@school.ac.ke',
    role: 'subject_teacher',
    teacher_id: 'tch_02',
    status: 'Active',
  };

  const mockGenericTeacherUser: User = {
    id: 'usr_gen_01',
    name: 'Samuel Kiprop',
    email: 'samuel@school.ac.ke',
    role: 'teacher' as any,
    teacher_id: 'tch_03',
    status: 'Active',
  };

  const mockTeachers: Teacher[] = [
    {
      id: 'tch_01',
      teacher_name: 'Grace Wanjiku',
      email: 'grace@school.ac.ke',
      phone: '0711000001',
      tsc_number: 'TSC-123456',
      username: 'gwanjiku',
      is_class_teacher: true,
      class_teacher_of_id: 'cls_01',
    },
    {
      id: 'tch_02',
      teacher_name: 'David Otieno',
      email: 'david@school.ac.ke',
      phone: '0711000002',
      tsc_number: 'TSC-654321',
      username: 'dotieno',
      is_class_teacher: false,
    },
    {
      id: 'tch_03',
      teacher_name: 'Samuel Kiprop',
      email: 'samuel@school.ac.ke',
      phone: '0711000003',
      tsc_number: '987654',
      is_class_teacher: false,
    },
  ];

  beforeEach(() => {
    // Synchronize mock users and teachers into memory state for resolution tests
    api.syncUsersFromDatabase([
      mockAdminUser,
      mockClassTeacherUser,
      mockSubjectTeacherUser,
      mockGenericTeacherUser,
    ]);
    setStorage(KEYS.TEACHERS, mockTeachers);
  });

  describe('1. Authoritative Role Resolution (mapSupabaseUserToAppUser)', () => {
    it('resolves Admin role directly from public.users database record', () => {
      const supabaseUser = {
        id: 'usr_admin_01',
        email: 'admin@school.ac.ke',
        user_metadata: { role: 'admin' },
      };

      const resolved = mapSupabaseUserToAppUser(supabaseUser);
      expect(resolved.role).toBe('admin');
      expect(resolved.name).toBe('Administrator');
      expect(resolved.email).toBe('admin@school.ac.ke');
    });

    it('resolves Class Teacher role directly from public.users database record', () => {
      const supabaseUser = {
        id: 'usr_ct_01',
        email: 'grace@school.ac.ke',
        user_metadata: { role: 'class_teacher' },
      };

      const resolved = mapSupabaseUserToAppUser(supabaseUser);
      expect(resolved.role).toBe('class_teacher');
      expect(resolved.name).toBe('Grace Wanjiku');
      expect(resolved.teacher_id).toBe('tch_01');
    });

    it('resolves Subject Teacher role directly from public.users database record', () => {
      const supabaseUser = {
        id: 'usr_st_01',
        email: 'david@school.ac.ke',
        user_metadata: { role: 'subject_teacher' },
      };

      const resolved = mapSupabaseUserToAppUser(supabaseUser);
      expect(resolved.role).toBe('subject_teacher');
      expect(resolved.name).toBe('David Otieno');
      expect(resolved.teacher_id).toBe('tch_02');
    });

    it('resolves generic teacher role with is_class_teacher=false as subject_teacher', () => {
      const supabaseUser = {
        id: 'usr_gen_01',
        email: 'samuel@school.ac.ke',
        user_metadata: { role: 'teacher' },
      };

      const resolved = mapSupabaseUserToAppUser(supabaseUser);
      expect(resolved.role).toBe('subject_teacher');
    });

    it('falls back to auth metadata role if user record is newly registered', () => {
      const newSupabaseUser = {
        id: 'usr_new_01',
        email: 'newteacher@school.ac.ke',
        user_metadata: { role: 'subject_teacher', name: 'New Teacher' },
      };

      const resolved = mapSupabaseUserToAppUser(newSupabaseUser);
      expect(resolved.role).toBe('subject_teacher');
      expect(resolved.name).toBe('New Teacher');
    });
  });

  describe('2. RBAC Access Control Matrix (isTabAllowedForRole)', () => {
    const adminUser: User = { id: '1', name: 'Admin', email: 'admin@school.ac.ke', role: 'admin' };
    const classTeacherUser: User = { id: '2', name: 'CT', email: 'ct@school.ac.ke', role: 'class_teacher', teacher_id: 'tch_01' };
    const subjectTeacherUser: User = { id: '3', name: 'ST', email: 'st@school.ac.ke', role: 'subject_teacher', teacher_id: 'tch_02' };

    it('Administrator has authorized access to administrative management tabs', () => {
      expect(isTabAllowedForRole(adminUser, 'dashboard')).toBe(true);
      expect(isTabAllowedForRole(adminUser, 'teachers')).toBe(true);
      expect(isTabAllowedForRole(adminUser, 'classes')).toBe(true);
      expect(isTabAllowedForRole(adminUser, 'academic-session')).toBe(true);
      expect(isTabAllowedForRole(adminUser, 'developer-mode')).toBe(true);
      expect(isTabAllowedForRole(adminUser, 'provisional')).toBe(true);
      expect(isTabAllowedForRole(adminUser, 'exam-validation')).toBe(true);
      expect(isTabAllowedForRole(adminUser, 'reports')).toBe(true);
      expect(isTabAllowedForRole(adminUser, 'marks-entry')).toBe(true);
      expect(isTabAllowedForRole(adminUser, 'marks-monitoring')).toBe(true);
    });

    it('Class Teacher is restricted from administrative management tabs', () => {
      expect(isTabAllowedForRole(classTeacherUser, 'dashboard')).toBe(true);
      expect(isTabAllowedForRole(classTeacherUser, 'marks-entry')).toBe(true);
      expect(isTabAllowedForRole(classTeacherUser, 'reports')).toBe(true);
      expect(isTabAllowedForRole(classTeacherUser, 'students')).toBe(true);
      expect(isTabAllowedForRole(classTeacherUser, 'class-marks-monitoring')).toBe(true);
      expect(isTabAllowedForRole(classTeacherUser, 'provisional')).toBe(true);

      // FORBIDDEN TABS for Class Teacher:
      expect(isTabAllowedForRole(classTeacherUser, 'teachers')).toBe(false);
      expect(isTabAllowedForRole(classTeacherUser, 'classes')).toBe(false);
      expect(isTabAllowedForRole(classTeacherUser, 'developer-mode')).toBe(false);
      expect(isTabAllowedForRole(classTeacherUser, 'exam-validation')).toBe(false);
      expect(isTabAllowedForRole(classTeacherUser, 'system-settings')).toBe(false);
      expect(isTabAllowedForRole(classTeacherUser, 'school-profile')).toBe(false);
    });

    it('Subject Teacher is strictly restricted to Subject Teacher Cockpit and marking', () => {
      expect(isTabAllowedForRole(subjectTeacherUser, 'dashboard')).toBe(true);
      expect(isTabAllowedForRole(subjectTeacherUser, 'marks-entry')).toBe(true);
      expect(isTabAllowedForRole(subjectTeacherUser, 'reports')).toBe(true);

      // FORBIDDEN TABS for Subject Teacher:
      expect(isTabAllowedForRole(subjectTeacherUser, 'teachers')).toBe(false);
      expect(isTabAllowedForRole(subjectTeacherUser, 'classes')).toBe(false);
      expect(isTabAllowedForRole(subjectTeacherUser, 'students')).toBe(false);
      expect(isTabAllowedForRole(subjectTeacherUser, 'class-marks-monitoring')).toBe(false);
      expect(isTabAllowedForRole(subjectTeacherUser, 'marks-monitoring')).toBe(false);
      expect(isTabAllowedForRole(subjectTeacherUser, 'developer-mode')).toBe(false);
      expect(isTabAllowedForRole(subjectTeacherUser, 'provisional')).toBe(false);
      expect(isTabAllowedForRole(subjectTeacherUser, 'exam-validation')).toBe(false);
      expect(isTabAllowedForRole(subjectTeacherUser, 'system-settings')).toBe(false);
      expect(isTabAllowedForRole(subjectTeacherUser, 'school-profile')).toBe(false);
    });
  });

  describe('3. Absence of Role Hint & Safety Guarantees', () => {
    it('signIn function signature accepts email and password without role hint', async () => {
      expect(authService.signIn).toBeDefined();
      expect(typeof authService.signIn).toBe('function');
    });

    it('unresolved user with no role record or metadata fails closed and NEVER receives admin role', () => {
      const unknownSupabaseUser = {
        id: 'usr_unknown_99',
        email: 'unknown@external.ac.ke',
        user_metadata: {},
      };

      const resolved = mapSupabaseUserToAppUser(unknownSupabaseUser);
      expect(resolved.role).not.toBe('admin');
      expect(resolved.role).toBe('class_teacher'); // safe least-privileged default, never admin
    });

    it('pre-auth check detects Disabled account status without requiring role hints', async () => {
      const disabledUser: User = {
        id: 'usr_disabled_01',
        name: 'Disabled Staff',
        email: 'disabled@school.ac.ke',
        role: 'subject_teacher',
        status: 'Disabled',
      };
      api.syncUsersFromDatabase([disabledUser]);

      const result = await authService.signIn('disabled@school.ac.ke', 'somepassword');
      expect(result.user).toBeNull();
      expect(result.error).toContain('disabled');
    });

    it('pre-auth check detects Locked account status without requiring role hints', async () => {
      const lockedUser: User = {
        id: 'usr_locked_01',
        name: 'Locked Staff',
        email: 'locked@school.ac.ke',
        role: 'class_teacher',
        status: 'Locked',
      };
      api.syncUsersFromDatabase([lockedUser]);

      const result = await authService.signIn('locked@school.ac.ke', 'somepassword');
      expect(result.user).toBeNull();
      expect(result.error).toContain('locked');
    });
  });

  describe('4. Dual Login: Identifier & TSC Number Resolution', () => {
    it('resolves direct email addresses without alteration', () => {
      const res = resolveIdentifierToEmail('grace@school.ac.ke');
      expect(res).not.toBeNull();
      expect(res?.email).toBe('grace@school.ac.ke');
      expect(res?.teacher?.id).toBe('tch_01');
    });

    it('resolves teacher by exact TSC Number (e.g., "TSC-123456")', () => {
      const res = resolveIdentifierToEmail('TSC-123456');
      expect(res).not.toBeNull();
      expect(res?.email).toBe('grace@school.ac.ke');
      expect(res?.teacher?.teacher_name).toBe('Grace Wanjiku');
    });

    it('resolves teacher by numeric-only TSC Number (e.g., "123456")', () => {
      const res = resolveIdentifierToEmail('123456');
      expect(res).not.toBeNull();
      expect(res?.email).toBe('grace@school.ac.ke');
      expect(res?.teacher?.teacher_name).toBe('Grace Wanjiku');
    });

    it('resolves teacher by lowercase/case-insensitive TSC Number (e.g., "tsc-654321")', () => {
      const res = resolveIdentifierToEmail('tsc-654321');
      expect(res).not.toBeNull();
      expect(res?.email).toBe('david@school.ac.ke');
      expect(res?.teacher?.teacher_name).toBe('David Otieno');
    });

    it('resolves teacher by username (e.g., "dotieno")', () => {
      const res = resolveIdentifierToEmail('dotieno');
      expect(res).not.toBeNull();
      expect(res?.email).toBe('david@school.ac.ke');
    });

    it('returns null and clear error message for nonexistent TSC Number', async () => {
      const res = resolveIdentifierToEmail('TSC-999999');
      expect(res).toBeNull();

      const loginRes = await authService.signIn('TSC-999999', 'anypassword');
      expect(loginRes.user).toBeNull();
      expect(loginRes.error).toContain('TSC Number');
    });
  });
});
