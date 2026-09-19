import { describe, it, expect } from 'vitest';
import { getUserFriendlyErrorMessage } from '../utils/errorUtils';

describe('Surgical Authentication Error Message & Translation Tests', () => {
  it('Scenario 1: Wrong password with Supabase "Invalid login credentials" message', () => {
    const rawError = {
      name: 'AuthApiError',
      message: 'Invalid login credentials',
      status: 400,
    };
    const translated = getUserFriendlyErrorMessage(rawError);
    expect(translated).toBe('Incorrect password. Please verify and try again.');
  });

  it('Scenario 2: Wrong password with "invalid_grant" description', () => {
    const rawError = {
      error: 'invalid_grant',
      error_description: 'invalid login credentials',
    };
    const translated = getUserFriendlyErrorMessage(rawError);
    expect(translated).toBe('Incorrect password. Please verify and try again.');
  });

  it('Scenario 3: Wrong password string representation', () => {
    const translated = getUserFriendlyErrorMessage('Invalid login credentials');
    expect(translated).toBe('Incorrect password. Please verify and try again.');
  });

  it('Scenario 4: Genuinely expired session with "jwt expired"', () => {
    const rawError = {
      message: 'JWT expired: token has expired',
      status: 401,
    };
    const translated = getUserFriendlyErrorMessage(rawError);
    expect(translated).toBe('Your sign-in session has expired. Please sign in again.');
  });

  it('Scenario 5: Genuinely expired session with "session expired"', () => {
    const translated = getUserFriendlyErrorMessage('session expired');
    expect(translated).toBe('Your sign-in session has expired. Please sign in again.');
  });

  it('Scenario 6: Genuinely invalid token with "refresh_token_not_found"', () => {
    const rawError = {
      message: 'refresh_token_not_found: Invalid Refresh Token',
      status: 400,
    };
    const translated = getUserFriendlyErrorMessage(rawError);
    expect(translated).toBe('Your sign-in session has expired. Please sign in again.');
  });

  it('Scenario 7: Network failure retains friendly connection message', () => {
    const rawError = new TypeError('Failed to fetch');
    const translated = getUserFriendlyErrorMessage(rawError);
    expect(translated).toBe('Unable to reach the server. Please check your internet connection or try again in a moment.');
  });

  it('Scenario 8: Database unique constraint retains specific friendly message', () => {
    const rawError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "students_admission_number_key"',
    };
    const translated = getUserFriendlyErrorMessage(rawError);
    expect(translated).toBe('A learner with this admission number already exists.');
  });
});
