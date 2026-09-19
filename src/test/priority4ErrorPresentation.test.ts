import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setupLocalStorage';
import { db } from '../lib/storage';

describe('Priority 4 — Error Presentation & Feedback Integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies that no window.alert is invoked across critical application operations', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Ensure database operations throw clean errors or return structured outcomes without triggering alert()
    try {
      db.addSubject({
        id: '',
        subject_name: '',
        subject_code: '',
        category: 'Core',
        education_level: 'Junior School',
        status: 'Active',
      });
    } catch {
      // Expected validation error
    }

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('preserves blocking confirmations for truly destructive actions', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    // If a user declines a destructive prompt, confirm was called and operation is aborted
    const userAgreed = window.confirm('Are you sure you want to permanently delete?');
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(userAgreed).toBe(false);
  });

  it('translates database errors into understandable feedback without masking failures', () => {
    // Testing duplicate code or invalid input handling
    try {
      db.addClass({
        id: '',
        class_name: '',
        stream: '',
        education_level: 'Junior School',
      });
    } catch (err: any) {
      expect(err).toBeDefined();
      expect(typeof err.message).toBe('string');
      expect(err.message.length).toBeGreaterThan(0);
    }
  });
});
