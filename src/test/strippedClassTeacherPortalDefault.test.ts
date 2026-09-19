import './setupLocalStorage';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEffectiveRole, getActiveTeacher, isTabAllowedForRole } from '../utils/rbacUtils';
import { api, setStorage, KEYS, getSupabaseClient } from '../lib/storage';
import { mapSupabaseUserToAppUser } from '../services/authService';
import { Teacher, ClassStream, User } from '../types';

describe('CBE Management System — Stripped Class Teacher Portal Defaulting Suite', () => {
  const teacherId = 'tch_stripped_test_01';
  const classId = 'cls_grade_4_east';

  const mockTeacherAssigned: Teacher = {
    id: teacherId,
    teacher_name: 'Jane Muthoni',
    email: 'jane.muthoni@school.ac.ke',
    tsc_number: 'TSC-778899',
    phone: '0712345678',
    is_class_teacher: true,
    class_teacher_of_id: classId,
    status: 'Active',
  };

  const mockTeacherStripped: Teacher = {
    id: teacherId,
    teacher_name: 'Jane Muthoni',
    email: 'jane.muthoni@school.ac.ke',
    tsc_number: 'TSC-778899',
    phone: '0712345678',
    is_class_teacher: false,
    class_teacher_of_id: undefined,
    status: 'Active',
  };

  const mockTeacherStaleFlag: Teacher = {
    id: teacherId,
    teacher_name: 'Jane Muthoni',
    email: 'jane.muthoni@school.ac.ke',
    tsc_number: 'TSC-778899',
    phone: '0712345678',
    is_class_teacher: true, // Stale boolean flag in database
    class_teacher_of_id: undefined, // but no class is assigned
    status: 'Active',
  };

  const mockClass: ClassStream = {
    id: classId,
    class_name: 'Grade 4',
    stream: 'East',
    class_teacher_id: teacherId,
    education_level: 'Lower Primary',
    status: 'Active',
  };

  const mockClassReassigned: ClassStream = {
    id: classId,
    class_name: 'Grade 4',
    stream: 'East',
    class_teacher_id: 'tch_other_02',
    education_level: 'Lower Primary',
    status: 'Active',
  };

  const mockUser: User = {
    id: 'usr_jane_01',
    name: 'Jane Muthoni',
    email: 'jane.muthoni@school.ac.ke',
    role: 'class_teacher',
    teacher_id: teacherId,
    status: 'Active',
  };

  beforeEach(() => {
    localStorage.clear();
    setStorage(KEYS.TEACHERS, [mockTeacherAssigned]);
    setStorage(KEYS.CLASSES, [mockClass]);
    setStorage(KEYS.USERS, [mockUser]);
  });

  it('resolves effective role to class_teacher when teacher has an active class assignment', () => {
    const role = getEffectiveRole(mockUser, mockTeacherAssigned, [mockClass]);
    expect(role).toBe('class_teacher');
  });

  it('surgically defaults effective role to subject_teacher when class is stripped (no class_teacher_of_id)', () => {
    const role = getEffectiveRole(mockUser, mockTeacherStripped, [mockClassReassigned]);
    expect(role).toBe('subject_teacher');
  });

  it('surgically defaults effective role to subject_teacher even if is_class_teacher is true but no class matches or is assigned', () => {
    const role = getEffectiveRole(mockUser, mockTeacherStaleFlag, [mockClassReassigned]);
    expect(role).toBe('subject_teacher');
  });

  it('restricts tabs when teacher is stripped off class — denies class_teacher specific tabs and allows subject_teacher tabs', () => {
    // When assigned
    expect(isTabAllowedForRole(mockUser, 'students', mockTeacherAssigned, [mockClass])).toBe(true);
    expect(isTabAllowedForRole(mockUser, 'class-marks-monitoring', mockTeacherAssigned, [mockClass])).toBe(true);

    // When stripped
    expect(isTabAllowedForRole(mockUser, 'students', mockTeacherStripped, [mockClassReassigned])).toBe(false);
    expect(isTabAllowedForRole(mockUser, 'class-marks-monitoring', mockTeacherStripped, [mockClassReassigned])).toBe(false);
    expect(isTabAllowedForRole(mockUser, 'dashboard', mockTeacherStripped, [mockClassReassigned])).toBe(true);
    expect(isTabAllowedForRole(mockUser, 'marks-entry', mockTeacherStripped, [mockClassReassigned])).toBe(true);
    expect(isTabAllowedForRole(mockUser, 'reports', mockTeacherStripped, [mockClassReassigned])).toBe(true);
  });

  it('updates local User cache and state role when updateTeacher is called with class assignment stripped', async () => {
    const client = getSupabaseClient();
    if (client) {
      vi.spyOn(client.auth, 'getSession').mockResolvedValue({
        data: { session: { access_token: 'valid-test-token' } as any },
        error: null,
      });
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as any);

    await api.updateTeacher(mockTeacherStripped);

    const updatedUsers = api.getUsers();
    const updatedUser = updatedUsers.find((u) => u.teacher_id === teacherId);
    expect(updatedUser?.role).toBe('subject_teacher');

    fetchSpy.mockRestore();
  });

  it('mapSupabaseUserToAppUser maps stripped class teacher to subject_teacher during session resolution', () => {
    setStorage(KEYS.TEACHERS, [mockTeacherStripped]);
    const sbUser = {
      id: 'usr_jane_01',
      email: 'jane.muthoni@school.ac.ke',
      user_metadata: { role: 'class_teacher' },
    };

    const resolved = mapSupabaseUserToAppUser(sbUser);
    expect(resolved.role).toBe('subject_teacher');
  });
});
