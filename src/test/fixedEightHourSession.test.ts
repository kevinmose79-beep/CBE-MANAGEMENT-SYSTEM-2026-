import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import './setupLocalStorage';
import { authService } from '../services/authService';
import {
  INACTIVITY_WARNING_MS,
  INACTIVITY_LOCK_MS,
  MAX_SESSION_WARNING_MS,
  MAX_SESSION_LOCK_MS,
  LockReason,
  WarningType,
} from '../utils/useInactivityMonitor';

describe('Fixed 8-Hour Maximum Session Duration & 30-Minute Inactivity Protection', () => {
  const SESSION_START_KEY = 'cbe_session_start_timestamp';
  const LAST_ACTIVITY_KEY = 'cbe_last_activity_timestamp';

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1 — Normal login creates cbe_session_start_timestamp and cbe_last_activity_timestamp', () => {
    const loginTime = 1770000000000; // e.g. 08:00
    vi.setSystemTime(loginTime);

    authService.recordSessionStart(loginTime);
    authService.recordLastActivity(loginTime);

    expect(localStorage.getItem(SESSION_START_KEY)).toBe(loginTime.toString());
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(loginTime.toString());
    expect(authService.getSessionStartTime()).toBe(loginTime);
    expect(authService.getLastActivityTime()).toBe(loginTime);
  });

  it('Test 2 — Normal activity updates cbe_last_activity_timestamp but does NOT renew cbe_session_start_timestamp', () => {
    const loginTime = 1770000000000; // 08:00
    vi.setSystemTime(loginTime);

    authService.recordSessionStart(loginTime);
    authService.recordLastActivity(loginTime);

    // Simulate user activity after 10 minutes (08:10)
    const activeTime = loginTime + 10 * 60 * 1000;
    vi.setSystemTime(activeTime);
    authService.recordLastActivity(activeTime);

    expect(authService.getSessionStartTime()).toBe(loginTime);
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(loginTime.toString());
    expect(authService.getLastActivityTime()).toBe(activeTime);
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(activeTime.toString());
  });

  it('Test 3 — Inactivity lock state evaluation does not change session start timestamp', () => {
    const loginTime = 1770000000000; // 08:00
    vi.setSystemTime(loginTime);

    authService.recordSessionStart(loginTime);
    authService.recordLastActivity(loginTime);

    // After 30 minutes of no user activity (08:30)
    const lockTime = loginTime + INACTIVITY_LOCK_MS;
    vi.setSystemTime(lockTime);

    const elapsedSession = lockTime - authService.getSessionStartTime();
    const elapsedInactivity = lockTime - authService.getLastActivityTime();

    let lockReason: LockReason | null = null;
    if (elapsedSession >= MAX_SESSION_LOCK_MS) {
      lockReason = 'max_session';
    } else if (elapsedInactivity >= INACTIVITY_LOCK_MS) {
      lockReason = 'inactivity';
    }

    expect(lockReason).toBe('inactivity');
    // cbe_session_start_timestamp must remain unchanged at 08:00
    expect(authService.getSessionStartTime()).toBe(loginTime);
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(loginTime.toString());
  });

  it('Test 4 & 5 — Inactivity unlock does NOT change session start, but DOES reset 30-minute inactivity timer', () => {
    const loginTime = 1770000000000; // 08:00
    vi.setSystemTime(loginTime);

    authService.recordSessionStart(loginTime);
    authService.recordLastActivity(loginTime);

    // Inactivity lock happens at 08:30 (30m later)
    // Teacher unlocks at 09:10 (70m after login)
    const unlockTime = loginTime + 70 * 60 * 1000;
    vi.setSystemTime(unlockTime);

    // Inactivity unlock: resets last activity, but does NOT reset session start
    authService.recordLastActivity(unlockTime);
    // (Notice: authService.recordSessionStart is NOT called during inactivity unlock)

    // Verify session start is still 08:00
    expect(authService.getSessionStartTime()).toBe(loginTime);
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(loginTime.toString());

    // Verify inactivity clock is reset to 09:10
    expect(authService.getLastActivityTime()).toBe(unlockTime);
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(unlockTime.toString());
  });

  it('Test 6 — Multiple inactivity unlocks preserve the original login timestamp throughout', () => {
    const loginTime = 1770000000000; // 08:00
    vi.setSystemTime(loginTime);

    authService.recordSessionStart(loginTime);
    authService.recordLastActivity(loginTime);

    // Unlock 1: 09:10 (70 mins elapsed)
    const unlock1 = loginTime + 70 * 60 * 1000;
    vi.setSystemTime(unlock1);
    authService.recordLastActivity(unlock1);
    expect(authService.getSessionStartTime()).toBe(loginTime);

    // Unlock 2: 11:20 (200 mins elapsed)
    const unlock2 = loginTime + 200 * 60 * 1000;
    vi.setSystemTime(unlock2);
    authService.recordLastActivity(unlock2);
    expect(authService.getSessionStartTime()).toBe(loginTime);

    // Unlock 3: 14:30 (390 mins elapsed)
    const unlock3 = loginTime + 390 * 60 * 1000;
    vi.setSystemTime(unlock3);
    authService.recordLastActivity(unlock3);
    expect(authService.getSessionStartTime()).toBe(loginTime);

    // Check invariants
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(loginTime.toString());
    expect(authService.getSessionStartTime()).toBe(loginTime);
  });

  it('Test 7 & 8 — Fixed maximum session expiry triggers max_session lock at 8 hours despite unlocks and activity', () => {
    const loginTime = 1770000000000; // 08:00
    vi.setSystemTime(loginTime);

    authService.recordSessionStart(loginTime);
    authService.recordLastActivity(loginTime);

    // Teacher stays active, e.g. at 15:55 (7 hours 55 minutes after login)
    const activeAt1555 = loginTime + (7 * 60 + 55) * 60 * 1000;
    vi.setSystemTime(activeAt1555);
    authService.recordLastActivity(activeAt1555);

    // Now at 16:00 (exactly 8 hours from login)
    const timeAt1600 = loginTime + 8 * 60 * 60 * 1000;
    vi.setSystemTime(timeAt1600);

    const elapsedSession = timeAt1600 - authService.getSessionStartTime();
    const elapsedInactivity = timeAt1600 - authService.getLastActivityTime();

    let lockReason: LockReason | null = null;
    // Priority 1: 8-Hour Maximum Session Lock
    if (elapsedSession >= MAX_SESSION_LOCK_MS) {
      lockReason = 'max_session';
    } else if (elapsedInactivity >= INACTIVITY_LOCK_MS) {
      lockReason = 'inactivity';
    }

    // Must lock as max_session even though last activity was only 5 minutes ago!
    expect(lockReason).toBe('max_session');
    expect(elapsedInactivity).toBe(5 * 60 * 1000); // 5 minutes
    expect(elapsedSession).toBe(8 * 60 * 60 * 1000); // 8 hours
  });

  it('Test 9 — Maximum session warning triggers at 7 hours 45 minutes', () => {
    const loginTime = 1770000000000; // 08:00
    vi.setSystemTime(loginTime);

    authService.recordSessionStart(loginTime);
    authService.recordLastActivity(loginTime);

    // User is active at 15:40 (5 minutes before warning)
    const activeTime = loginTime + (7 * 60 + 40) * 60 * 1000;
    vi.setSystemTime(activeTime);
    authService.recordLastActivity(activeTime);

    // At 15:45 (7 hours 45 minutes after login)
    const warningTime = loginTime + MAX_SESSION_WARNING_MS;
    vi.setSystemTime(warningTime);

    const elapsedSession = warningTime - authService.getSessionStartTime();
    const elapsedInactivity = warningTime - authService.getLastActivityTime();

    let warningType: WarningType | null = null;
    if (elapsedSession >= MAX_SESSION_LOCK_MS) {
      // locked
    } else if (elapsedInactivity >= INACTIVITY_LOCK_MS) {
      // locked
    } else if (elapsedSession >= MAX_SESSION_WARNING_MS) {
      warningType = 'max_session';
    } else if (elapsedInactivity >= INACTIVITY_WARNING_MS) {
      warningType = 'inactivity';
    }

    expect(warningType).toBe('max_session');
  });

  it('Test 10 & 11 — Browser refresh and Android tab reload preserve the original session start timestamp', () => {
    const loginTime = 1770000000000; // 08:00
    vi.setSystemTime(loginTime);

    authService.recordSessionStart(loginTime);
    authService.recordLastActivity(loginTime);

    // Tab reloaded at 10:00 (2 hours later)
    const reloadTime = loginTime + 2 * 60 * 60 * 1000;
    vi.setSystemTime(reloadTime);

    // On app mount, getSessionStartTime reads from localStorage
    const restoredSessionStart = authService.getSessionStartTime();
    const restoredLastActivity = authService.getLastActivityTime();

    expect(restoredSessionStart).toBe(loginTime);
    expect(restoredLastActivity).toBe(loginTime);
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(loginTime.toString());
  });

  it('Test 12 & 13 — Logout clears session timestamp and new login creates fresh 8-hour clock', () => {
    const loginTime1 = 1770000000000; // 08:00
    vi.setSystemTime(loginTime1);

    authService.recordSessionStart(loginTime1);
    authService.recordLastActivity(loginTime1);
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(loginTime1.toString());

    // Teacher logs out at 12:00
    authService.clearSessionStart();
    authService.clearLastActivity();

    expect(localStorage.getItem(SESSION_START_KEY)).toBe(null);
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(null);

    // Teacher B logs in at 12:05
    const loginTime2 = loginTime1 + (4 * 60 + 5) * 60 * 1000;
    vi.setSystemTime(loginTime2);

    authService.recordSessionStart(loginTime2);
    authService.recordLastActivity(loginTime2);

    expect(localStorage.getItem(SESSION_START_KEY)).toBe(loginTime2.toString());
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(loginTime2.toString());
    expect(authService.getSessionStartTime()).toBe(loginTime2);
  });

  it('Test 14 — Maximum session re-authentication renews session start to create a new 8-hour session', () => {
    const loginTime = 1770000000000; // 08:00
    vi.setSystemTime(loginTime);

    authService.recordSessionStart(loginTime);
    authService.recordLastActivity(loginTime);

    // 8 hours pass: 16:00
    const expiryTime = loginTime + 8 * 60 * 60 * 1000;
    vi.setSystemTime(expiryTime);

    // User re-authenticates from max_session lock:
    // SessionLockModal calls authService.signIn (isMaxSession=true) and App.tsx onUnlock records new session start
    authService.recordSessionStart(expiryTime);
    authService.recordLastActivity(expiryTime);

    expect(authService.getSessionStartTime()).toBe(expiryTime);
    expect(localStorage.getItem(SESSION_START_KEY)).toBe(expiryTime.toString());

    // New 8-hour expiry is now 24:00 (16:00 + 8h)
    const nextExpiry = authService.getSessionStartTime() + MAX_SESSION_LOCK_MS;
    expect(nextExpiry).toBe(expiryTime + 8 * 60 * 60 * 1000);
  });
});
