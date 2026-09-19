import { describe, it, expect, beforeEach } from 'vitest';
import { api, setStorage, KEYS } from '../lib/storage';
import { authService, resolveIdentifierToEmail } from '../services/authService';
import { Student, User, ClassStream, Mark } from '../types';

describe('Phase 6D.7.1 — Safe Learner Deactivation & Reactivation Lifecycle', () => {
  const mockClass: ClassStream = {
    id: 'class-uuid-grade-7a',
    stream_id: 'stream-uuid-grade-7a',
    class_name: 'Grade 7',
    stream: 'A',
    education_level: 'Junior School',
  };

  const activeLearner: Student = {
    id: 'student-uuid-test-001',
    admission_number: 'ADM-2026-701',
    full_name: 'Faith Chebet',
    first_name: 'Faith',
    last_name: 'Chebet',
    gender: 'F',
    grade: 'Grade 7',
    class_id: 'class-uuid-grade-7a',
    stream_id: 'stream-uuid-grade-7a',
    active: true,
  };

  const activeLearnerUser: User = {
    id: 'user-uuid-faith-001',
    name: 'Faith Chebet',
    email: 'adm-2026-701@learner.cbe.ac.ke',
    role: 'learner',
    student_id: 'student-uuid-test-001',
    status: 'Active',
  };

  const sampleMark: Mark = {
    id: 'mark-uuid-faith-math',
    student_id: 'student-uuid-test-001',
    exam_id: 'exam-uuid-term1',
    subject_id: 'subj-uuid-math',
    marks: 85,
    entered_by_teacher_id: 'teacher-uuid-david',
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    setStorage(KEYS.CLASSES, [mockClass]);
    setStorage(KEYS.STUDENTS, [{ ...activeLearner }]);
    setStorage(KEYS.USERS, [{ ...activeLearnerUser }]);
    setStorage(KEYS.MARKS, [{ ...sampleMark }]);
    setStorage(KEYS.LOGIN_LOGS, []);
  });

  it('Part 1 & 2: Updates student active status and synchronizes user account status', async () => {
    // 1. Initially active
    const initialStudent = api.getStudents().find((s) => s.id === activeLearner.id);
    const initialUser = api.getUsers().find((u) => u.student_id === activeLearner.id);
    expect(initialStudent?.active).toBe(true);
    expect(initialUser?.status).toBe('Active');

    // 2. Deactivate learner
    await api.updateStudent({
      ...activeLearner,
      active: false,
    });

    const deactivatedStudent = api.getStudents().find((s) => s.id === activeLearner.id);
    const deactivatedUser = api.getUsers().find((u) => u.student_id === activeLearner.id);

    expect(deactivatedStudent?.active).toBe(false);
    expect(deactivatedUser?.status).toBe('Disabled');

    // 3. Confirm student UUID and admission number were preserved
    expect(deactivatedStudent?.id).toBe(activeLearner.id);
    expect(deactivatedStudent?.admission_number).toBe('ADM-2026-701');
  });

  it('Part 6 & 7: Rejects login resolution and sign-in for deactivated learner', async () => {
    // Deactivate learner
    await api.updateStudent({
      ...activeLearner,
      active: false,
    });

    // 1. Test identifier resolution
    const resolved = resolveIdentifierToEmail('ADM-2026-701');
    expect(resolved?.inactive).toBe(true);
    expect(resolved?.error).toContain('This learner account is inactive or transferred');

    // 2. Test sign-in by Admission Number
    const signInResult = await authService.signIn('ADM-2026-701', 'Learner@123', 'learner');
    expect(signInResult.user).toBeNull();
    expect(signInResult.error).toBe('This learner account is inactive or transferred. Please contact school administration.');

    // 3. Test sign-in by direct Email
    const emailSignInResult = await authService.signIn('adm-2026-701@learner.cbe.ac.ke', 'Learner@123', 'learner');
    expect(emailSignInResult.user).toBeNull();
    expect(emailSignInResult.error).toBe('This learner account is inactive or transferred. Please contact school administration.');

    // 4. Verify login failure was recorded in login logs
    const loginLogs = api.getLoginLogs();
    expect(loginLogs.length).toBeGreaterThan(0);
    const latestLog = loginLogs[0];
    expect(latestLog.status).toBe('Failed');
    expect(latestLog.reason).toContain('inactive or transferred');
  });

  it('Part 9: Filters inactive learners out of active rosters while preserving marks', async () => {
    const activeStudent2: Student = {
      id: 'student-uuid-test-002',
      admission_number: 'ADM-2026-702',
      full_name: 'Brian Kiprono',
      gender: 'M',
      grade: 'Grade 7',
      class_id: 'class-uuid-grade-7a',
      stream_id: 'stream-uuid-grade-7a',
      active: true,
    };

    setStorage(KEYS.STUDENTS, [
      { ...activeLearner, active: false }, // Deactivated
      activeStudent2,                      // Active
    ]);

    const allStudents = api.getStudents();

    // Roster filter simulation for MarksEntry / SubjectTeacherCockpit
    const activeRoster = allStudents.filter(
      (s) => s.active !== false && (s.stream_id === 'stream-uuid-grade-7a' || s.class_id === 'class-uuid-grade-7a')
    );

    expect(activeRoster.length).toBe(1);
    expect(activeRoster[0].id).toBe('student-uuid-test-002');
    expect(activeRoster[0].full_name).toBe('BRIAN KIPRONO');

    // Confirm historical marks for deactivated learner remain completely intact
    const allMarks = api.getMarks();
    const faithMarks = allMarks.filter((m) => m.student_id === activeLearner.id);
    expect(faithMarks.length).toBe(1);
    expect(faithMarks[0].marks).toBe(85);
  });

  it('Part 10 & 12: Successfully reactivates learner, restoring access and active roster presence', async () => {
    // 1. Start from deactivated state
    await api.updateStudent({
      ...activeLearner,
      active: false,
    });

    // 2. Reactivate learner
    await api.updateStudent({
      ...activeLearner,
      active: true,
    });

    const reactivatedStudent = api.getStudents().find((s) => s.id === activeLearner.id);
    const reactivatedUser = api.getUsers().find((u) => u.student_id === activeLearner.id);

    expect(reactivatedStudent?.active).toBe(true);
    expect(reactivatedUser?.status).toBe('Active');

    // 3. Identifier resolution now succeeds
    const resolved = resolveIdentifierToEmail('ADM-2026-701');
    expect(resolved?.inactive).toBeUndefined();
    expect(resolved?.email).toBe('adm-2026-701@learner.cbe.ac.ke');

    // 4. Academic marks remain unchanged
    const allMarks = api.getMarks();
    const faithMarks = allMarks.filter((m) => m.student_id === activeLearner.id);
    expect(faithMarks.length).toBe(1);
    expect(faithMarks[0].marks).toBe(85);
  });
});
