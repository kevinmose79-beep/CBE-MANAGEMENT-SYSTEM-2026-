import { Examination, ExamType } from '../types';

/**
 * Centralized Presentation Layer Helper for Examination Display.
 *
 * Enforces the strict rule:
 * - "CAT" (Continuous Assessment Test) may exist internally in database schemas, types, and historical records.
 * - "CAT" must NEVER be displayed in the UI, Android WebView, PDFs, tables, or graphs.
 * - NEVER alters underlying objects or writes back converted values to the database.
 */

/**
 * Normalizes an examination name for the user-facing presentation layer.
 * Replaces legacy "CAT" / "Continuous Assessment Test" terminology with standard "Assessment"
 * while preserving numbers, terms, and academic years.
 *
 * Examples:
 * - "CAT 1 - Term 1 2026" -> "Assessment 1 - Term 1 2026"
 * - "CAT 1 Assessment" -> "Assessment 1"
 * - "CAT 2" -> "Assessment 2"
 * - "CAT" -> "Assessment"
 * - "Continuous Assessment Test 1" -> "Assessment 1"
 * - "Opener Assessment - Term 1 2026" -> "Opener Assessment - Term 1 2026"
 */
export function getDisplayExamName(examOrName?: { exam_name?: string } | string | null): string {
  if (!examOrName) return '';
  const raw = typeof examOrName === 'string' ? examOrName : examOrName.exam_name || '';
  if (!raw) return '';

  return raw
    // Continuous Assessment Test X / Continuous Assessment X
    .replace(/\bContinuous\s+Assessment\s+Test\s+(\d+)\b/gi, 'Assessment $1')
    .replace(/\bContinuous\s+Assessment\s+Test\b/gi, 'Assessment')
    .replace(/\bContinuous\s+Assessment\s+(\d+)\b/gi, 'Assessment $1')
    .replace(/\bContinuous\s+Assessment\b/gi, 'Assessment')
    // CAT X (e.g. CAT 1, CAT 2, CAT-1, CAT_1)
    .replace(/\bCAT[\s\-_]*(\d+)\s+Assessment\b/gi, 'Assessment $1')
    .replace(/\bCAT[\s\-_]*(\d+)\b/gi, 'Assessment $1')
    // Standalone CAT
    .replace(/\bCAT\b/gi, 'Assessment')
    .trim();
}

/**
 * Normalizes an examination type for the user-facing presentation layer.
 * Replaces legacy 'CAT' type with 'Assessment'.
 */
export function getDisplayExamType(examOrType?: { exam_type?: string } | string | null): string {
  if (!examOrType) return 'Assessment';
  const raw = typeof examOrType === 'string' ? examOrType : examOrType.exam_type || '';
  if (!raw) return 'Assessment';

  if (raw === 'CAT' || raw.toUpperCase() === 'CAT') {
    return 'Assessment';
  }
  if (raw === 'Opener' || raw.toUpperCase() === 'OPENER') {
    return 'Opener Assessment';
  }
  if (raw === 'Mid-Term' || raw.toUpperCase() === 'MID-TERM') {
    return 'Mid-Term Assessment';
  }
  if (raw === 'End-Term' || raw.toUpperCase() === 'END-TERM') {
    return 'End-Term Assessment';
  }
  if (raw === 'Custom' || raw.toUpperCase() === 'CUSTOM') {
    return 'Custom Assessment';
  }

  return getDisplayExamName(raw);
}

/**
 * Formats a clean, short milestone label for charts and progression tables.
 */
export function getDisplayMilestoneLabel(shortLabel?: string): string {
  if (!shortLabel) return '';
  return getDisplayExamName(shortLabel);
}

/**
 * Formats all-caps text into clean title casing while preserving CBE acronyms.
 */
export function formatExamTitleCase(text: string): string {
  if (!text) return '';
  const acronyms = new Set(['KJSEA', 'KPSEA', 'KCPE', 'KCSE', 'CBC', 'CBE', 'KNEC', 'STEM', 'CAT', 'CAS', 'SST', 'CRE', 'IRE', 'HRE']);

  // If string has mixed lowercase, return as-is (trimmed)
  const isAllCaps = text === text.toUpperCase() && /[A-Z]/.test(text);
  if (!isAllCaps) {
    return text.trim();
  }

  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (acronyms.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Removes redundant trailing (Term X YYYY) or Term X YYYY from exam titles for clean dropdowns.
 */
export function getCleanExamDropdownTitle(examOrName?: { exam_name?: string } | string | null): string {
  if (!examOrName) return '';
  const raw = typeof examOrName === 'string' ? examOrName : examOrName.exam_name || '';
  if (!raw) return '';

  const normalized = getDisplayExamName(raw);
  const titleCased = formatExamTitleCase(normalized);

  // Strip redundant trailing term and year patterns
  const cleaned = titleCased
    .replace(/\s*\(?\s*Term\s*\d+\s*(?:•|\s*[-/]?\s*)\s*\d{4}\s*\)?/gi, '')
    .replace(/\s*\(?\s*Term\s*\d+\s*\)?/gi, '')
    .replace(/\s*\(?\s*\d{4}\s*\)?/gi, '')
    .trim();

  return cleaned || titleCased;
}

export interface ExamDropdownGroup {
  label: string;
  exams: {
    exam: Examination;
    label: string;
  }[];
}

/**
 * Groups and formats examinations for clean, mobile-optimized select dropdowns.
 */
export function groupExamsForDropdown(
  exams: Examination[],
  activeYear?: number,
  activeTerm?: string
): ExamDropdownGroup[] {
  if (!exams || exams.length === 0) return [];

  const activeGroup: Examination[] = [];
  const otherGroup: Examination[] = [];

  exams.forEach((ex) => {
    const isCurrentSession =
      (activeYear !== undefined && ex.year === activeYear) &&
      (activeTerm !== undefined && ex.term === activeTerm);

    if (isCurrentSession) {
      activeGroup.push(ex);
    } else {
      otherGroup.push(ex);
    }
  });

  const groups: ExamDropdownGroup[] = [];

  if (activeGroup.length > 0) {
    const sessionLabel = activeTerm && activeYear
      ? `ACTIVE SESSION (${activeTerm} • ${activeYear})`
      : 'ACTIVE SESSION';

    groups.push({
      label: sessionLabel,
      exams: activeGroup.map((ex) => {
        const cleanTitle = getCleanExamDropdownTitle(ex);
        const statusBadge = ex.status && ex.status !== 'Published' ? ` [${ex.status}]` : '';
        return {
          exam: ex,
          label: `${cleanTitle}${statusBadge}`,
        };
      }),
    });
  }

  if (otherGroup.length > 0) {
    const historicalLabel = activeGroup.length > 0 ? 'PREVIOUS SESSIONS' : 'ALL ASSESSMENTS';
    groups.push({
      label: historicalLabel,
      exams: otherGroup.map((ex) => {
        const cleanTitle = getCleanExamDropdownTitle(ex);
        const termYear = ex.term || ex.year ? ` (${[ex.term, ex.year].filter(Boolean).join(' ')})` : '';
        const statusBadge = ex.status && ex.status !== 'Published' ? ` [${ex.status}]` : '';
        return {
          exam: ex,
          label: `${cleanTitle}${termYear}${statusBadge}`,
        };
      }),
    });
  }

  return groups;
}

