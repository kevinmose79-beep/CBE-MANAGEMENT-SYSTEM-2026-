import { SchoolTerm, AcademicYear } from '../types';
import { getKenyaCalendarToday, getKenyaCalendarTomorrow, formatKenyaDate } from './kenyaDateUtils';

export type TermReminderType = 'opening_tomorrow' | 'opening_today' | 'ready_for_activation';

export interface TermReminder {
  term: SchoolTerm;
  type: TermReminderType;
  title: string;
  headline: string;
  subtext: string;
  formattedOpeningDate: string;
  activeTermName?: string;
}

export interface TermReminderCheckParams {
  schoolTerms: SchoolTerm[];
  activeTerm?: SchoolTerm | null;
  activeAcademicYear?: AcademicYear | null;
  customDate?: Date | string | number;
  checkDismissed?: boolean;
}

const DISMISS_STORAGE_PREFIX = 'cbe_dismissed_term_reminder_';
const memoryDismissedSet = new Set<string>();

/**
 * Checks if a reminder for a specific term and date has been dismissed in the current session.
 */
export function isTermReminderDismissed(termId: string, dateStr: string): boolean {
  const key = `${DISMISS_STORAGE_PREFIX}${termId}_${dateStr}`;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem(key) === 'true';
    } catch {
      return memoryDismissedSet.has(key);
    }
  }
  return memoryDismissedSet.has(key);
}

/**
 * Records dismissal of a term reminder for the current session/calendar day.
 */
export function dismissTermReminder(termId: string, dateStr: string): void {
  const key = `${DISMISS_STORAGE_PREFIX}${termId}_${dateStr}`;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(key, 'true');
    } catch {
      memoryDismissedSet.add(key);
    }
  } else {
    memoryDismissedSet.add(key);
  }
}

/**
 * Clears in-memory and session storage dismissals (useful for testing).
 */
export function resetDismissedTermReminders(): void {
  memoryDismissedSet.clear();
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith(DISMISS_STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
}

/**
 * Evaluates whether an administrator reminder should be displayed for an upcoming or ready-to-open term.
 * 
 * Rules:
 * - Informational ONLY: Never calls api.setActiveTerm or mutates any term records.
 * - Respects Kenya calendar day boundaries (Africa/Nairobi).
 * - Identifies terms that are 'Upcoming' (or not yet Active) in the active academic year:
 *   1. Opening Tomorrow: opening_date === tomorrow
 *   2. Opening Today: opening_date === today
 *   3. Ready for Activation: opening_date is today or in past, but term is still Upcoming and another term is Active
 */
export function getUpcomingTermReminder({
  schoolTerms,
  activeTerm,
  activeAcademicYear,
  customDate,
  checkDismissed = true,
}: TermReminderCheckParams): TermReminder | null {
  if (!schoolTerms || schoolTerms.length === 0) return null;

  const todayStr = getKenyaCalendarToday(customDate);
  const tomorrowStr = getKenyaCalendarTomorrow(customDate);

  // Filter candidate terms:
  // Must belong to the active academic year (if specified) or match active year's year number.
  // Must be in 'Upcoming' status (or un-activated, not Closed, Locked, or Archived).
  const relevantYearId = activeAcademicYear?.id;
  const relevantYearNumber = activeAcademicYear?.year;

  const candidateTerms = schoolTerms.filter((t) => {
    // Exclude currently active term
    if (activeTerm && t.id === activeTerm.id && t.status === 'Active') return false;
    // Exclude closed/locked/archived terms
    if (t.status === 'Closed' || t.status === 'Locked' || t.status === 'Archived') return false;

    if (relevantYearId && t.academic_year_id && t.academic_year_id === relevantYearId) return true;
    if (relevantYearNumber && t.year === relevantYearNumber) return true;
    return false;
  });

  for (const term of candidateTerms) {
    if (!term.opening_date) continue;

    if (checkDismissed && isTermReminderDismissed(term.id, todayStr)) {
      continue;
    }

    const formattedOpeningDate = formatKenyaDate(term.opening_date);
    const hasOtherActiveTerm = Boolean(activeTerm && activeTerm.status === 'Active' && activeTerm.id !== term.id);
    const activeTermName = hasOtherActiveTerm ? activeTerm?.term_name : undefined;

    // 1. Opening Tomorrow
    if (term.opening_date === tomorrowStr) {
      return {
        term,
        type: 'opening_tomorrow',
        title: `🔔 ${term.term_name} Reminder`,
        headline: `${term.term_name} is scheduled to open tomorrow, ${formattedOpeningDate}.`,
        subtext: `Please review the academic session and activate ${term.term_name} when the school is ready.`,
        formattedOpeningDate,
        activeTermName,
      };
    }

    // 2. Opening Today
    if (term.opening_date === todayStr) {
      return {
        term,
        type: 'opening_today',
        title: `🔔 ${term.term_name} Opening Day`,
        headline: `${term.term_name} is scheduled to open today.`,
        subtext: hasOtherActiveTerm
          ? `${activeTermName} is still active. Activate ${term.term_name} when ready.`
          : `Activate ${term.term_name} when ready.`,
        formattedOpeningDate,
        activeTermName,
      };
    }

    // 3. Opening Date Arrived / In Past, but term is still Upcoming
    if (todayStr > term.opening_date && term.status === 'Upcoming') {
      return {
        term,
        type: 'ready_for_activation',
        title: `🔔 ${term.term_name} Ready for Activation`,
        headline: `${term.term_name} opening date arrived on ${formattedOpeningDate}.`,
        subtext: hasOtherActiveTerm
          ? `${activeTermName} is currently active. Activate ${term.term_name} when the school is ready.`
          : `Activate ${term.term_name} when ready.`,
        formattedOpeningDate,
        activeTermName,
      };
    }
  }

  return null;
}
