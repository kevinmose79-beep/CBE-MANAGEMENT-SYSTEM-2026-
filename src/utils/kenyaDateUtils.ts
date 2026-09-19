/**
 * Kenya Timezone & Calendar Utilities
 * 
 * Authoritative timezone: Africa/Nairobi (EAT, UTC+3)
 * Standardizes Kenyan academic calendar date evaluation and timestamp formatting.
 */

export const KENYA_TIMEZONE = 'Africa/Nairobi';

/**
 * Returns the current calendar date in Africa/Nairobi as 'YYYY-MM-DD'.
 * Uses Intl.DateTimeFormat with timeZone: 'Africa/Nairobi' so it is 100% independent
 * of the user's device/browser timezone and UTC zero.
 * 
 * Handles midnight boundary properly from 00:00:00 EAT onwards.
 */
export function getKenyaCalendarToday(customDate?: Date | string | number): string {
  const d = customDate ? (customDate instanceof Date ? customDate : new Date(customDate)) : new Date();
  
  // 'en-CA' outputs standard ISO format 'YYYY-MM-DD'
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KENYA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  return formatter.format(d);
}

/**
 * Returns tomorrow's calendar date in Africa/Nairobi as 'YYYY-MM-DD'.
 */
export function getKenyaCalendarTomorrow(customDate?: Date | string | number): string {
  const todayStr = getKenyaCalendarToday(customDate);
  const [y, m, d] = todayStr.split('-').map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
  return getKenyaCalendarToday(nextDay);
}

/**
 * Returns the current local time in Africa/Nairobi as 'HH:MM:SS'.
 */
export function getKenyaTime(customDate?: Date | string | number): string {
  const d = customDate ? (customDate instanceof Date ? customDate : new Date(customDate)) : new Date();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KENYA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Formats an instant/timestamp (Date or ISO string) to Kenya Time formatted string.
 * Example: '17 August 2026, 14:30' or '17/08/2026 14:30:00'
 */
export function formatKenyaDateTime(
  dateInput: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: KENYA_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options,
  };

  return new Intl.DateTimeFormat('en-GB', defaultOptions).format(d);
}

/**
 * Formats a calendar date (YYYY-MM-DD) or timestamp for display in Kenyan format:
 * e.g., '24 August 2026' or '24/08/2026'
 */
export function formatKenyaDate(
  dateInput: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '';
  
  // If already a plain YYYY-MM-DD string, avoid timezone offset shifts by parsing parts
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, day] = dateInput.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, day, 12, 0, 0)); // Noon UTC is midday everywhere
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: KENYA_TIMEZONE,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      ...options,
    }).format(d);
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KENYA_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(d);
}

/**
 * Formats exact timestamp for PDF report headers and score sheets in Kenya EAT.
 * Output format: 'DD.MM.YYYY at HH:MM:SS'
 */
export function formatKenyaPdfTimestamp(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KENYA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  return `${map.day}.${map.month}.${map.year} at ${map.hour}:${map.minute}:${map.second}`;
}

/**
 * Formats an assessment creation timestamp for UI display in Kenya EAT.
 * Output format: '20 Aug 2026, 10:34 AM' (or '20 Aug 2026' if date-only)
 */
export function formatAssessmentCreationDate(
  dateInput: Date | string | number | undefined | null
): string {
  if (!dateInput) return '';

  // If plain YYYY-MM-DD date string without time
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: KENYA_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).formatToParts(dateObj);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    return `${map.day} ${map.month} ${map.year}`.trim();
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KENYA_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const period = map.dayPeriod ? map.dayPeriod.toUpperCase() : '';
  return `${map.day} ${map.month} ${map.year}, ${map.hour}:${map.minute} ${period}`.trim();
}
