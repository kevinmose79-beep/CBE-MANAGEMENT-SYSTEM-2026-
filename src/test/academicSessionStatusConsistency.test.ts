import { describe, it, expect } from 'vitest';
import {
  getTermStatusFromDates,
  canPlanExams,
  canEnterMarks,
  canApproveExams,
  canGenerateReports,
  isTermModifiable,
  canViewTermData,
  getTermStatusMessage,
} from '../utils/termStatusUtils';
import { api } from '../lib/storage';

describe('Intelligent Academic Session Activation & Lifecycle Tests (Phase 4A)', () => {
  const openingDateFuture = '2027-08-24';
  const closingDateFuture = '2027-10-23';

  const openingDateCurrent = '2026-01-01';
  const closingDateCurrent = '2026-12-31';

  const openingDatePast = '2025-01-06';
  const closingDatePast = '2025-04-02';

  it('Test 1 — Future term, not activated evaluates to Upcoming and locks marks', () => {
    const status = getTermStatusFromDates(openingDateFuture, closingDateFuture, 'Upcoming');
    expect(status).toBe('Upcoming');
    expect(canEnterMarks(status)).toBe(false);
    expect(canPlanExams(status)).toBe(true);
    expect(canApproveExams(status)).toBe(false);
    expect(canGenerateReports(status)).toBe(false);
    expect(isTermModifiable(status)).toBe(false);
    expect(canViewTermData(status)).toBe(true);
  });

  it('Test 2 & Test 11 — Future term cannot become operationally Active before opening date (Calendar Dominates)', () => {
    // Even if explicitStatus was set to 'Active', calendar evaluation correctly enforces 'Upcoming'
    const status = getTermStatusFromDates(openingDateFuture, closingDateFuture, 'Active');
    expect(status).toBe('Upcoming');
    expect(canEnterMarks(status)).toBe(false);
    expect(canPlanExams(status)).toBe(true); // Exam planning allowed
    expect(canApproveExams(status)).toBe(false);
  });

  it('Test 3 — Future term produces clear user-facing explanation message', () => {
    const msg = getTermStatusMessage('Upcoming');
    expect(msg).toContain('Upcoming');
    expect(msg).toContain('Marks entry and examination approvals cannot be done until the term becomes Active');
  });

  it('Test 4 & Test 5 — Opening date reached / within dates automatically evaluates to Active', () => {
    const status = getTermStatusFromDates(openingDateCurrent, closingDateCurrent, 'Upcoming');
    expect(status).toBe('Active');
    expect(canEnterMarks(status)).toBe(true);
    expect(canPlanExams(status)).toBe(true);
    expect(canApproveExams(status)).toBe(true);
    expect(canGenerateReports(status)).toBe(true);
  });

  it('Test 6 — Post-closing behavior preserves explicit Active grace or Closed state', () => {
    // With explicit Active (grace period)
    const graceStatus = getTermStatusFromDates(openingDatePast, closingDatePast, 'Active');
    expect(graceStatus).toBe('Active');
    expect(canEnterMarks(graceStatus)).toBe(true);

    // Formally closed
    const closedStatus = getTermStatusFromDates(openingDatePast, closingDatePast, 'Closed');
    expect(closedStatus).toBe('Closed');
    expect(canEnterMarks(closedStatus)).toBe(false);
    expect(canGenerateReports(closedStatus)).toBe(true);
  });

  it('Test 7 — Explicitly Locked remains Locked regardless of dates', () => {
    const status = getTermStatusFromDates(openingDateCurrent, closingDateCurrent, 'Locked');
    expect(status).toBe('Locked');
    expect(canEnterMarks(status)).toBe(false);
    expect(canPlanExams(status)).toBe(false);
    expect(canGenerateReports(status)).toBe(true);
    expect(canViewTermData(status)).toBe(true);
  });

  it('Test 8 — Explicitly Archived remains Archived regardless of dates', () => {
    const status = getTermStatusFromDates(openingDatePast, closingDatePast, 'Archived');
    expect(status).toBe('Archived');
    expect(canEnterMarks(status)).toBe(false);
    expect(canPlanExams(status)).toBe(false);
    expect(canGenerateReports(status)).toBe(true);
    expect(canViewTermData(status)).toBe(true);
  });

  it('Test 9 — Active academic year and term storage invariants', () => {
    const activeYear = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();
    expect(activeYear).toBeDefined();
    expect(activeTerm).toBeDefined();
    expect(activeYear.status).toBe('Active');
  });

  it('Test 10 — Missing dates gracefully fallback to explicit status or Upcoming', () => {
    expect(getTermStatusFromDates(undefined, undefined, 'Active')).toBe('Active');
    expect(getTermStatusFromDates(undefined, undefined, 'Upcoming')).toBe('Upcoming');
    expect(getTermStatusFromDates(undefined, undefined, undefined)).toBe('Upcoming');
  });

  it('Test 12, 13, 14 — Operational permission matrix consistency', () => {
    // Upcoming
    expect(canPlanExams('Upcoming')).toBe(true);
    expect(canEnterMarks('Upcoming')).toBe(false);
    expect(canApproveExams('Upcoming')).toBe(false);
    expect(canGenerateReports('Upcoming')).toBe(false);

    // Active
    expect(canPlanExams('Active')).toBe(true);
    expect(canEnterMarks('Active')).toBe(true);
    expect(canApproveExams('Active')).toBe(true);
    expect(canGenerateReports('Active')).toBe(true);

    // Closed
    expect(canPlanExams('Closed')).toBe(false);
    expect(canEnterMarks('Closed')).toBe(false);
    expect(canApproveExams('Closed')).toBe(false);
    expect(canGenerateReports('Closed')).toBe(true);

    // Locked
    expect(canPlanExams('Locked')).toBe(false);
    expect(canEnterMarks('Locked')).toBe(false);
    expect(canApproveExams('Locked')).toBe(false);
    expect(canGenerateReports('Locked')).toBe(true);

    // Archived
    expect(canPlanExams('Archived')).toBe(false);
    expect(canEnterMarks('Archived')).toBe(false);
    expect(canApproveExams('Archived')).toBe(false);
    expect(canGenerateReports('Archived')).toBe(true);
  });

  it('Test 15 — Academic Year and Term deletion safety constraints', () => {
    // Active year cannot be deleted
    const activeYear = api.getActiveAcademicYear();
    const canDeleteActive = api.checkAcademicYearCanBeDeletedSync(activeYear.id);
    expect(canDeleteActive).toBe(false);
  });
});
