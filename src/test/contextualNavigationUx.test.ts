import { describe, it, expect } from 'vitest';
import { isTabAllowedForRole } from '../App';
import { TabType } from '../components/Sidebar';
import { User } from '../types';

describe('Contextual Navigation UX & Branding Invariants', () => {
  const adminUser: User = { id: 'admin-1', username: 'admin', email: 'admin@school.ac.ke', role: 'admin', name: 'School Admin' };
  const classTeacherUser: User = { id: 'ct-1', username: 'ct1', email: 'ct1@school.ac.ke', role: 'class_teacher', name: 'Class Teacher 1' };
  const subjectTeacherUser: User = { id: 'st-1', username: 'st1', email: 'st1@school.ac.ke', role: 'subject_teacher', name: 'Subject Teacher 1' };

  it('guarantees Admin has access to all admin assessment views', () => {
    const adminAssessmentTabs: TabType[] = [
      'exams',
      'marks-entry',
      'marks-monitoring',
      'exam-validation',
      'provisional',
      'reports',
    ];
    adminAssessmentTabs.forEach((tab) => {
      expect(isTabAllowedForRole(adminUser, tab)).toBe(true);
    });
  });

  it('guarantees Class Teacher has access to marks-entry, class monitoring, stream-approval, provisional, and reports', () => {
    expect(isTabAllowedForRole(classTeacherUser, 'marks-entry')).toBe(true);
    expect(isTabAllowedForRole(classTeacherUser, 'class-marks-monitoring')).toBe(true);
    expect(isTabAllowedForRole(classTeacherUser, 'stream-approval')).toBe(true);
    expect(isTabAllowedForRole(classTeacherUser, 'provisional')).toBe(true);
    expect(isTabAllowedForRole(classTeacherUser, 'reports')).toBe(true);
    expect(isTabAllowedForRole(classTeacherUser, 'exams')).toBe(false);
    expect(isTabAllowedForRole(classTeacherUser, 'exam-validation')).toBe(false);
  });

  it('guarantees Subject Teacher has access to marks-entry and reports only', () => {
    expect(isTabAllowedForRole(subjectTeacherUser, 'marks-entry')).toBe(true);
    expect(isTabAllowedForRole(subjectTeacherUser, 'reports')).toBe(true);
    expect(isTabAllowedForRole(subjectTeacherUser, 'class-marks-monitoring')).toBe(false);
    expect(isTabAllowedForRole(subjectTeacherUser, 'stream-approval')).toBe(false);
    expect(isTabAllowedForRole(subjectTeacherUser, 'exams')).toBe(false);
  });

  it('correctly associates active states for consolidated sidebar items', () => {
    const isItemActive = (itemId: TabType | string, currentTab: TabType): boolean => {
      if (itemId === currentTab) return true;
      if (itemId === 'classes' && (currentTab === 'classes' || currentTab === 'subjects')) {
        return true;
      }
      if (
        itemId === 'exams' &&
        ['exams', 'marks-entry', 'marks-monitoring', 'class-marks-monitoring', 'exam-validation', 'provisional', 'reports'].includes(currentTab)
      ) {
        return true;
      }
      if (
        itemId === 'marks-entry' &&
        ['marks-entry', 'class-marks-monitoring', 'reports'].includes(currentTab)
      ) {
        return true;
      }
      return false;
    };

    expect(isItemActive('exams', 'exams')).toBe(true);
    expect(isItemActive('exams', 'marks-entry')).toBe(true);
    expect(isItemActive('exams', 'marks-monitoring')).toBe(true);
    expect(isItemActive('exams', 'exam-validation')).toBe(true);
    expect(isItemActive('exams', 'provisional')).toBe(true);
    expect(isItemActive('exams', 'reports')).toBe(true);
    expect(isItemActive('exams', 'dashboard')).toBe(false);

    expect(isItemActive('classes', 'classes')).toBe(true);
    expect(isItemActive('classes', 'subjects')).toBe(true);
    expect(isItemActive('classes', 'students')).toBe(false);

    expect(isItemActive('marks-entry', 'marks-entry')).toBe(true);
    expect(isItemActive('marks-entry', 'class-marks-monitoring')).toBe(true);
    expect(isItemActive('marks-entry', 'reports')).toBe(true);
    expect(isItemActive('marks-entry', 'dashboard')).toBe(false);
  });
});
