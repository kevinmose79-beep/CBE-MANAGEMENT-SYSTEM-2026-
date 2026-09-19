import { describe, it, expect, beforeEach } from 'vitest';
import { api, KEYS, setStorage } from '../lib/storage';
import { computeExamReadiness } from '../utils/examReadinessUtils';
import { Examination, ClassStream, User } from '../types';

// Pure Node localStorage polyfill
const storageMap = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) || null,
    setItem: (key: string, value: string) => storageMap.set(key, value),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  };
}

describe('Results Approval In-Scope Scoping & Status Engine', () => {
  const mockAdminUser: User = {
    id: 'u_admin_01',
    username: 'admin',
    email: 'admin@school.ac.ke',
    role: 'admin',
    name: 'Administrator',
  };

  const mockClasses: ClassStream[] = [
    {
      id: 'st_g9_east',
      stream_id: 'st_g9_east',
      class_name: 'Grade 9',
      stream: 'East',
      education_level: 'Junior School',
      status: 'Active',
    },
    {
      id: 'st_g9_west',
      stream_id: 'st_g9_west',
      class_name: 'Grade 9',
      stream: 'West',
      education_level: 'Junior School',
      status: 'Active',
    },
    {
      id: 'st_g1_north',
      stream_id: 'st_g1_north',
      class_name: 'Grade 1',
      stream: 'North',
      education_level: 'Lower Primary',
      status: 'Active',
    },
    {
      id: 'st_pp1_south',
      stream_id: 'st_pp1_south',
      class_name: 'PP1',
      stream: 'South',
      education_level: 'Pre-Primary',
      status: 'Active',
    },
  ];

  const grade9Exam: Examination = {
    id: 'exam_g9_opener',
    exam_name: 'Grade 9 Opener Assessment',
    exam_type: 'Opener',
    term: 'Term 1',
    year: 2026,
    education_level: 'Junior School',
    class_id: 'Grade 9',
    status: 'Provisional',
    max_marks: 100,
    approved_classes: [],
    approved_levels: [],
  };

  beforeEach(() => {
    storageMap.clear();
    setStorage(KEYS.CLASSES, mockClasses);
    setStorage(KEYS.EXAMS, [grade9Exam]);
  });

  it('1. computeExamReadiness correctly scopes totalStreams to ONLY in-scope levels', () => {
    const readiness = computeExamReadiness(grade9Exam, mockClasses, [], [], []);

    expect(readiness.totalStreamsCount).toBe(2);
    expect(readiness.levelGroups['Junior School'].totalStreams).toBe(2);
    expect(readiness.levelGroups['Pre-Primary'].totalStreams).toBe(0);
    expect(readiness.levelGroups['Lower Primary'].totalStreams).toBe(0);
    expect(readiness.levelGroups['Upper Primary'].totalStreams).toBe(0);
  });

  it('2. updateExaminationClassApproval transitions exam.status to Approved when all in-scope streams are approved', async () => {

    // Approve Grade 9 East
    const updated1 = await api.updateExaminationClassApproval('exam_g9_opener', 'st_g9_east', true, mockAdminUser);
    expect(updated1.approved_classes).toContain('st_g9_east');
    expect(updated1.status).toBe('Provisional');

    // Approve Grade 9 West (all 2/2 in-scope streams approved)
    const updated2 = await api.updateExaminationClassApproval('exam_g9_opener', 'st_g9_west', true, mockAdminUser);
    expect(updated2.approved_classes).toContain('st_g9_west');
    expect(updated2.status).toBe('Approved');

    // Reopen Grade 9 East -> status drops back to Provisional
    const reopened = await api.updateExaminationClassApproval('exam_g9_opener', 'st_g9_east', false, mockAdminUser);
    expect(reopened.approved_classes).not.toContain('st_g9_east');
    expect(reopened.status).toBe('Provisional');
  });
});
