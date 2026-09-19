import { describe, it, expect } from 'vitest';
import {
  getTimeOfDayGreeting,
  formatDisplayName,
  getFirstName,
  formatGreeting,
  formatGreetingFirstName,
} from '../utils/greetingUtils';

describe('Greeting Utility & Time Boundary Verification', () => {
  it('1. Returns "Good morning" for hours 00:00 through 11:59', () => {
    const earlyMorning = new Date(2026, 7, 16, 0, 0, 0); // 00:00
    const morning9am = new Date(2026, 7, 16, 9, 30, 0); // 09:30
    const lateMorning = new Date(2026, 7, 16, 11, 59, 59); // 11:59:59

    expect(getTimeOfDayGreeting(earlyMorning)).toBe('Good morning');
    expect(getTimeOfDayGreeting(morning9am)).toBe('Good morning');
    expect(getTimeOfDayGreeting(lateMorning)).toBe('Good morning');
  });

  it('2. Returns "Good afternoon" for hours 12:00 through 16:59', () => {
    const noon = new Date(2026, 7, 16, 12, 0, 0); // 12:00
    const afternoon2pm = new Date(2026, 7, 16, 14, 15, 0); // 14:15
    const lateAfternoon = new Date(2026, 7, 16, 16, 59, 59); // 16:59:59

    expect(getTimeOfDayGreeting(noon)).toBe('Good afternoon');
    expect(getTimeOfDayGreeting(afternoon2pm)).toBe('Good afternoon');
    expect(getTimeOfDayGreeting(lateAfternoon)).toBe('Good afternoon');
  });

  it('3. Returns "Good evening" for hours 17:00 through 23:59', () => {
    const evening5pm = new Date(2026, 7, 16, 17, 0, 0); // 17:00
    const evening7pm = new Date(2026, 7, 16, 19, 45, 0); // 19:45
    const lateNight = new Date(2026, 7, 16, 23, 59, 59); // 23:59:59

    expect(getTimeOfDayGreeting(evening5pm)).toBe('Good evening');
    expect(getTimeOfDayGreeting(evening7pm)).toBe('Good evening');
    expect(getTimeOfDayGreeting(lateNight)).toBe('Good evening');
  });

  it('4. Formats display names into clean title case without screaming uppercase', () => {
    expect(formatDisplayName('STACY JORDAN')).toBe('Stacy Jordan');
    expect(formatDisplayName('BRIAN AYIECHA')).toBe('Brian Ayiecha');
    expect(formatDisplayName('brian')).toBe('Brian');
    expect(formatDisplayName('Stacy Jordan')).toBe('Stacy Jordan');
    expect(formatDisplayName('  KEVIN   MOSE  ')).toBe('Kevin Mose');
    expect(formatDisplayName('')).toBe('');
    expect(formatDisplayName(null)).toBe('');
    expect(formatDisplayName(undefined)).toBe('');
  });

  it('5. Extracts first name accurately handling honorifics', () => {
    expect(getFirstName('STACY JORDAN')).toBe('Stacy');
    expect(getFirstName('Brian Ayiecha')).toBe('Brian');
    expect(getFirstName('Tr. Stacy Jordan')).toBe('Stacy');
    expect(getFirstName('Teacher Kevin')).toBe('Kevin');
    expect(getFirstName('Dr. Jane Doe')).toBe('Jane');
    expect(getFirstName('brian')).toBe('Brian');
    expect(getFirstName('')).toBe('');
    expect(getFirstName(null)).toBe('');
    expect(getFirstName(undefined)).toBe('');
  });

  it('6. Formats first-name workspace greetings (e.g. "Good afternoon, Stacy")', () => {
    const morningDate = new Date(2026, 7, 16, 9, 0, 0);
    const afternoonDate = new Date(2026, 7, 16, 15, 30, 0);
    const eveningDate = new Date(2026, 7, 16, 18, 0, 0);

    expect(formatGreetingFirstName('STACY JORDAN', afternoonDate)).toBe('Good afternoon, Stacy');
    expect(formatGreetingFirstName('BRIAN AYIECHA', morningDate)).toBe('Good morning, Brian');
    expect(formatGreetingFirstName('MARY WANJIKU', eveningDate)).toBe('Good evening, Mary');
    expect(formatGreetingFirstName('', morningDate)).toBe('Good morning');
    expect(formatGreetingFirstName(null, afternoonDate)).toBe('Good afternoon');
  });

  it('7. Formats complete sentence-case greetings with user names across roles', () => {
    const morningDate = new Date(2026, 7, 16, 8, 30, 0);
    const afternoonDate = new Date(2026, 7, 16, 14, 0, 0);
    const eveningDate = new Date(2026, 7, 16, 19, 0, 0);

    // Administrator
    expect(formatGreeting('Brian', morningDate)).toBe('Good morning, Brian');
    expect(formatGreeting('SYSTEM ADMINISTRATOR', afternoonDate)).toBe('Good afternoon, System Administrator');

    // Safe fallbacks when name is missing
    expect(formatGreeting('', morningDate)).toBe('Good morning');
    expect(formatGreeting(null, afternoonDate)).toBe('Good afternoon');
    expect(formatGreeting(undefined, eveningDate)).toBe('Good evening');
  });
});
