/**
 * Greeting utility for CBE Management System dashboards.
 * Provides British English time-of-day greetings in standard sentence case.
 */

/**
 * Returns time-based greeting for given date (defaults to current browser local time):
 * - 00:00 - 11:59 -> "Good morning"
 * - 12:00 - 16:59 -> "Good afternoon"
 * - 17:00 - 23:59 -> "Good evening"
 */
export function getTimeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 0 && hour < 12) {
    return 'Good morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

/**
 * Formats a user or teacher name into clean title case without excessive uppercase.
 * e.g., "STACY JORDAN" -> "Stacy Jordan", "brian" -> "Brian", "BRIAN AYIECHA" -> "Brian Ayiecha".
 */
export function formatDisplayName(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Extracts and formats the first name from a full name, handling common prefixes gracefully.
 * e.g., "STACY JORDAN" -> "Stacy", "Brian Ayiecha" -> "Brian", "Tr. Stacy Jordan" -> "Stacy".
 */
export function getFirstName(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  const honorifics = ['tr', 'tr.', 'teacher', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'dr', 'dr.', 'madam', 'mwalimu'];
  if (parts.length > 1 && honorifics.includes(parts[0].toLowerCase())) {
    const rawFirst = parts[1];
    return rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
  }

  const rawFirst = parts[0];
  return rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
}

/**
 * Produces the complete personalized greeting, e.g. "Good morning, Stacy Jordan".
 * If name is empty or missing, safely falls back to the time-of-day greeting (e.g. "Good morning").
 */
export function formatGreeting(name?: string | null, date: Date = new Date()): string {
  const greeting = getTimeOfDayGreeting(date);
  const formattedName = formatDisplayName(name);
  if (!formattedName) {
    return greeting;
  }
  return `${greeting}, ${formattedName}`;
}

/**
 * Produces a warm, personalized workspace greeting with first name, e.g. "Good afternoon, Stacy".
 * If name is empty or missing, safely falls back to the time-of-day greeting (e.g. "Good afternoon").
 */
export function formatGreetingFirstName(name?: string | null, date: Date = new Date()): string {
  const greeting = getTimeOfDayGreeting(date);
  const firstName = getFirstName(name);
  if (!firstName) {
    return greeting;
  }
  return `${greeting}, ${firstName}`;
}
