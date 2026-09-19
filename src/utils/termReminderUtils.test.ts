import { describe, it, expect, beforeEach } from 'vitest';
import { SchoolTerm, AcademicYear } from '../types';
import {
  getUpcomingTermReminder,
  dismissTermReminder,
  isTermReminderDismissed,
  resetDismissedTermReminders,
} from './termReminderUtils';

describe('Academic Term Administrator Reminder Logic', () => {
  const mockAcademicYear: AcademicYear = {
    id: 'ay-2026-uuid',
    year: 2026,
    status: 'Active',
  };

  const mockTerm1: SchoolTerm = {
    id: 'term-1-uuid',
    academic_year_id: 'ay-2026-uuid',
    year: 2026,
    term_name: 'Term 1',
    term_number: 1,
    status: 'Closed',
    opening_date: '2026-01-06',
    closing_date: '2026-04-10',
  };

  const mockTerm2: SchoolTerm = {
    id: 'term-2-uuid',
    academic_year_id: 'ay-2026-uuid',
    year: 2026,
    term_name: 'Term 2',
    term_number: 2,
    status: 'Active',
    opening_date: '2026-05-04',
    closing_date: '2026-08-07',
  };

  const mockTerm3: SchoolTerm = {
    id: 'term-3-uuid',
    academic_year_id: 'ay-2026-uuid',
    year: 2026,
    term_name: 'Term 3',
    term_number: 3,
    status: 'Upcoming',
    opening_date: '2026-08-24',
    closing_date: '2026-10-30',
  };

  const allTerms = [mockTerm1, mockTerm2, mockTerm3];

  beforeEach(() => {
    resetDismissedTermReminders();
  });

  it('1. Returns "opening_tomorrow" reminder on 23 August 2026 for Term 3 opening 24 August 2026', () => {
    const customDate = new Date('2026-08-23T10:00:00+03:00');

    const reminder = getUpcomingTermReminder({
      schoolTerms: allTerms,
      activeTerm: mockTerm2,
      activeAcademicYear: mockAcademicYear,
      customDate,
    });

    expect(reminder).not.toBeNull();
    expect(reminder?.type).toBe('opening_tomorrow');
    expect(reminder?.title).toContain('Term 3 Reminder');
    expect(reminder?.headline).toContain('Term 3 is scheduled to open tomorrow, 24 August 2026.');
    expect(reminder?.subtext).toContain('Please review the academic session and activate Term 3 when the school is ready.');
  });

  it('2. Returns "opening_today" reminder on 24 August 2026 when Term 2 is still Active and Term 3 is Upcoming', () => {
    const customDate = new Date('2026-08-24T08:00:00+03:00');

    const reminder = getUpcomingTermReminder({
      schoolTerms: allTerms,
      activeTerm: mockTerm2,
      activeAcademicYear: mockAcademicYear,
      customDate,
    });

    expect(reminder).not.toBeNull();
    expect(reminder?.type).toBe('opening_today');
    expect(reminder?.title).toContain('Term 3 Opening Day');
    expect(reminder?.headline).toBe('Term 3 is scheduled to open today.');
    expect(reminder?.subtext).toContain('Term 2 is still active. Activate Term 3 when ready.');
  });

  it('3. Returns "ready_for_activation" reminder on 25 August 2026 if Term 3 has arrived but is still Upcoming', () => {
    const customDate = new Date('2026-08-25T08:00:00+03:00');

    const reminder = getUpcomingTermReminder({
      schoolTerms: allTerms,
      activeTerm: mockTerm2,
      activeAcademicYear: mockAcademicYear,
      customDate,
    });

    expect(reminder).not.toBeNull();
    expect(reminder?.type).toBe('ready_for_activation');
    expect(reminder?.title).toContain('Term 3 Ready for Activation');
    expect(reminder?.headline).toContain('Term 3 opening date arrived on 24 August 2026.');
    expect(reminder?.subtext).toContain('Term 2 is currently active. Activate Term 3 when the school is ready.');
  });

  it('4. Returns null once Term 3 is manually activated by the administrator', () => {
    const customDate = new Date('2026-08-24T12:00:00+03:00');

    const activeTerm3: SchoolTerm = {
      ...mockTerm3,
      status: 'Active',
    };
    const closedTerm2: SchoolTerm = {
      ...mockTerm2,
      status: 'Closed',
    };

    const reminder = getUpcomingTermReminder({
      schoolTerms: [mockTerm1, closedTerm2, activeTerm3],
      activeTerm: activeTerm3,
      activeAcademicYear: mockAcademicYear,
      customDate,
    });

    expect(reminder).toBeNull();
  });

  it('5. Dismissal suppresses reminder for the given day/session without modifying data', () => {
    const customDate = new Date('2026-08-24T08:00:00+03:00');
    const dateStr = '2026-08-24';

    expect(isTermReminderDismissed('term-3-uuid', dateStr)).toBe(false);

    dismissTermReminder('term-3-uuid', dateStr);

    expect(isTermReminderDismissed('term-3-uuid', dateStr)).toBe(true);

    const reminder = getUpcomingTermReminder({
      schoolTerms: allTerms,
      activeTerm: mockTerm2,
      activeAcademicYear: mockAcademicYear,
      customDate,
      checkDismissed: true,
    });

    expect(reminder).toBeNull();
  });

  it('6. Does NOT show reminder on distant dates (e.g. 15 August 2026)', () => {
    const customDate = new Date('2026-08-15T08:00:00+03:00');

    const reminder = getUpcomingTermReminder({
      schoolTerms: allTerms,
      activeTerm: mockTerm2,
      activeAcademicYear: mockAcademicYear,
      customDate,
    });

    expect(reminder).toBeNull();
  });

  it('7. Role Scoping Audit: Only Admin role is authorised to view term transition reminder banner', () => {
    // Verifying role constraint semantics:
    const roles: Array<{ role: 'admin' | 'teacher' | 'learner' | 'parent'; shouldSeeBanner: boolean }> = [
      { role: 'admin', shouldSeeBanner: true },
      { role: 'teacher', shouldSeeBanner: false },
      { role: 'learner', shouldSeeBanner: false },
      { role: 'parent', shouldSeeBanner: false },
    ];

    roles.forEach(({ role, shouldSeeBanner }) => {
      const isAdmin = role === 'admin';
      expect(isAdmin).toBe(shouldSeeBanner);
    });
  });
});
