import { describe, it, expect } from 'vitest';
import {
  getKenyaCalendarToday,
  getKenyaTime,
  formatKenyaDate,
  formatKenyaDateTime,
  formatKenyaPdfTimestamp,
  KENYA_TIMEZONE,
} from './kenyaDateUtils';
import { getTermStatusFromDates } from './termStatusUtils';

describe('Kenya Timezone & Calendar Standardisation', () => {
  it('identifies authoritative timezone as Africa/Nairobi', () => {
    expect(KENYA_TIMEZONE).toBe('Africa/Nairobi');
  });

  it('correctly evaluates midnight boundary (00:00:00 - 02:59:59 EAT) as the new day in Kenya', () => {
    // 2026-08-24 00:30:00 EAT is 2026-08-23 21:30:00 UTC
    const dateAtKenyaMidnight = new Date('2026-08-23T21:30:00.000Z');
    
    // In UTC date string it would say '2026-08-23' (wrong for Kenya)
    expect(dateAtKenyaMidnight.toISOString().split('T')[0]).toBe('2026-08-23');
    
    // In Kenya timezone it must evaluate to '2026-08-24' (opening date!)
    const kenyaCalendarDay = getKenyaCalendarToday(dateAtKenyaMidnight);
    expect(kenyaCalendarDay).toBe('2026-08-24');
  });

  it('aligns term status transition with Kenya calendar date at opening date', () => {
    // On opening day 2026-08-24 at 01:00:00 EAT (2026-08-23 22:00:00 UTC)
    const openingMorningEAT = new Date('2026-08-23T22:00:00.000Z');
    
    const status = getTermStatusFromDates('2026-08-24', '2026-11-20', undefined, openingMorningEAT);
    expect(status).toBe('Active');
  });

  it('formats calendar dates in Kenya format without timezone shift', () => {
    const formatted = formatKenyaDate('2026-08-24');
    expect(formatted).toContain('24');
    expect(formatted).toContain('August');
    expect(formatted).toContain('2026');
  });

  it('formats PDF timestamp in EAT (UTC+3)', () => {
    // 14:00 UTC is 17:00 EAT
    const instant = new Date('2026-08-17T14:00:00.000Z');
    const pdfTimestamp = formatKenyaPdfTimestamp(instant);
    expect(pdfTimestamp).toBe('17.08.2026 at 17:00:00');
  });

  it('correctly formats Kenya local time (EAT)', () => {
    const instant = new Date('2026-08-17T06:15:30.000Z'); // 09:15:30 EAT
    const timeStr = getKenyaTime(instant);
    expect(timeStr).toBe('09:15:30');
  });
});
