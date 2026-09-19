/**
 * CBE Management System — User-Friendly Error Handling & Translation
 *
 * Core Principle:
 * "Coding makes the system smart; good design makes that intelligence understandable to humans."
 *
 * Translates technical errors, database codes, and network exceptions into
 * calm, plain-English notifications suitable for teachers and staff.
 */

export function getUserFriendlyErrorMessage(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred. Please try again.',
  options?: { students?: Array<{ id: string; first_name?: string; last_name?: string; adm_no?: string; name?: string }> }
): string {
  if (!error) return fallbackMessage;

  const raw = typeof error === 'string' 
    ? error 
    : (error as any)?.message || (error as any)?.error_description || (error as any)?.details || '';

  const str = String(raw).toLowerCase();

  // Calculation Engine Validation Failures
  if (
    str.includes('calculation engine validation failed') ||
    str.includes('total marks obtained') ||
    str.includes('exceeds maximum') ||
    str.includes('average percentage') ||
    (str.includes('cbe level') && str.includes('does not correspond'))
  ) {
    return formatCalculationValidationError(String(raw), options?.students);
  }

  // Specific marks timeout message
  if (str.includes('saving marks timed out')) {
    return raw;
  }

  // Network & Fetch failures
  if (
    str.includes('failed to fetch') ||
    str.includes('networkerror') ||
    str.includes('network request failed') ||
    str.includes('err_connection_refused') ||
    str.includes('err_name_not_resolved') ||
    str.includes('load failed') ||
    str.includes('abort') ||
    str.includes('timeout')
  ) {
    return 'Unable to reach the server. Please check your internet connection or try again in a moment.';
  }

  // Incorrect Password / Invalid Credentials
  if (
    str.includes('invalid login credentials') ||
    str.includes('invalid_grant') ||
    str.includes('invalid password') ||
    str.includes('invalid credentials')
  ) {
    return 'Incorrect password. Please verify and try again.';
  }

  // Session & Authentication Expiry
  if (
    str.includes('jwt') ||
    str.includes('token') ||
    str.includes('session expired') ||
    str.includes('invalid claim') ||
    str.includes('auth/invalid-email') ||
    str.includes('refresh_token_not_found')
  ) {
    return 'Your sign-in session has expired. Please sign in again.';
  }

  // PostgreSQL Unique Constraint Violation (23505)
  if (str.includes('23505') || str.includes('duplicate key') || str.includes('already exists') || str.includes('unique constraint')) {
    if (str.includes('admission_number')) return 'A learner with this admission number already exists.';
    if (str.includes('subject_code') || str.includes('code')) return 'A learning area with this code already exists.';
    if (str.includes('class_name') || str.includes('stream_name')) return 'A class or stream with this name already exists.';
    if (str.includes('tsc_number') || str.includes('national_id')) return 'A teacher with this TSC / National ID number already exists.';
    return 'This record already exists in the system.';
  }

  // PostgreSQL Foreign Key Violation (23503)
  if (str.includes('23503') || str.includes('violates foreign key') || str.includes('referenced from table') || str.includes('is still referenced')) {
    return 'Cannot complete this action because other active records depend on this item.';
  }

  // PostgreSQL Row-Level Security / Permission Denied (42501)
  if (str.includes('42501') || str.includes('row-level security') || str.includes('permission denied') || str.includes('not authorized') || str.includes('unauthorized')) {
    return 'Access restricted: You do not have permission to modify this data.';
  }

  // Database Connection / Configuration
  if (str.includes('invalid api key') || str.includes('apikey') || str.includes('project not found') || str.includes('database connection unavailable')) {
    return 'Database service is currently unreachable. Please verify your connection or contact the administrator.';
  }

  const hasUuid = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(String(raw));

  // If already a clean user-facing sentence (starts with capital, no raw JSON, SQL syntax, stack trace, or UUIDs)
  if (
    typeof raw === 'string' &&
    raw.length > 5 &&
    raw.length < 150 &&
    !hasUuid &&
    !raw.includes('{"') &&
    !raw.includes('TypeError:') &&
    !raw.includes('Error:') &&
    !raw.includes('Postgres') &&
    !raw.includes('SELECT ') &&
    !raw.includes('INSERT ') &&
    !raw.includes('UPDATE ') &&
    !raw.includes('DELETE ')
  ) {
    return raw;
  }

  return fallbackMessage;
}

function formatCalculationValidationError(
  raw: string,
  students?: Array<{ id: string; first_name?: string; last_name?: string; adm_no?: string; name?: string }>
): string {
  const str = String(raw);

  const exceedsMaxRegex = /Student\s+result\s+(\d+|[a-zA-Z0-9_-]+)(?:\s*\(([^)]+)\))?:\s*total\s+marks\s+obtained\s*\((\d+(?:\.\d+)?)\)\s*exceeds\s+maximum\s*\((\d+(?:\.\d+)?)\)/gi;

  const bulletItems: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = exceedsMaxRegex.exec(str)) !== null) {
    const resIdentifier = match[1];
    const uuid = match[2];
    const obtained = match[3];
    const max = match[4];

    let displayName = `Learner ${resIdentifier}`;
    if (students && students.length > 0) {
      const found = students.find((s) => (uuid && s.id === uuid) || s.id === resIdentifier || s.adm_no === resIdentifier);
      if (found) {
        displayName = (found.first_name && found.last_name) ? `${found.first_name} ${found.last_name}` : (found.name || displayName);
      }
    }

    bulletItems.push(`• ${displayName} — ${obtained} marks entered; maximum allowed is ${max}.`);
  }

  if (bulletItems.length > 0) {
    return [
      'Some marks need to be checked.',
      '',
      'The following learners have marks above the maximum allowed:',
      ...bulletItems,
      '',
      'Please review the affected marks before continuing.',
    ].join('\n');
  }

  if (str.toLowerCase().includes('exceeds maximum') || str.toLowerCase().includes('total marks obtained')) {
    return [
      'Some marks need to be checked.',
      '',
      'One or more learners have marks that exceed the maximum allowed for this assessment.',
      '',
      'Please review the affected marks before continuing.',
    ].join('\n');
  }

  if (str.toLowerCase().includes('average percentage') || str.toLowerCase().includes('out of bounds')) {
    return [
      'Some marks need to be checked.',
      '',
      'One or more learners have percentage scores outside the valid range (0–100%).',
      '',
      'Please review the affected marks before continuing.',
    ].join('\n');
  }

  if (str.toLowerCase().includes('cbe level') || str.toLowerCase().includes('does not correspond')) {
    return [
      'Some assessment settings need to be checked.',
      '',
      'The calculated CBE levels do not correspond to the target grade scale.',
      '',
      'Please review assessment settings before continuing.',
    ].join('\n');
  }

  return [
    'Some marks need to be checked.',
    '',
    'An assessment calculation validation condition requires review.',
    '',
    'Please review the affected marks before continuing.',
  ].join('\n');
}
