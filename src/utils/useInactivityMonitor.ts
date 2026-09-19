import { useState, useEffect, useRef, useCallback } from 'react';

// Inactivity limits
export const INACTIVITY_WARNING_MS = 25 * 60 * 1000; // 25 minutes
export const INACTIVITY_LOCK_MS = 30 * 60 * 1000; // 30 minutes

// 8-Hour Maximum Session limits
export const MAX_SESSION_WARNING_MS = (7 * 60 + 45) * 60 * 1000; // 7 hours 45 minutes
export const MAX_SESSION_LOCK_MS = 8 * 60 * 60 * 1000; // 8 hours

const CHECK_INTERVAL_MS = 5 * 1000; // Check elapsed every 5 seconds
const THROTTLE_ACTIVITY_MS = 2000; // Debounce recording interaction events

export type LockReason = 'inactivity' | 'max_session';
export type WarningType = 'inactivity' | 'max_session';

interface UseInactivityMonitorOptions {
  enabled: boolean;
  onLock?: (reason: LockReason) => void;
  onWarning?: (type: WarningType) => void;
  onActive?: () => void;
  getLastActivityTime?: () => number;
  onActivityRecord?: (timestamp: number) => void;
  getSessionStartTime?: () => number;
  onSessionRenew?: () => void;
  inactivityWarningMs?: number;
  inactivityLockMs?: number;
  maxSessionWarningMs?: number;
  maxSessionLockMs?: number;
}

export function useInactivityMonitor({
  enabled,
  onLock,
  onWarning,
  onActive,
  getLastActivityTime,
  onActivityRecord,
  getSessionStartTime,
  onSessionRenew,
  inactivityWarningMs = INACTIVITY_WARNING_MS,
  inactivityLockMs = INACTIVITY_LOCK_MS,
  maxSessionWarningMs = MAX_SESSION_WARNING_MS,
  maxSessionLockMs = MAX_SESSION_LOCK_MS,
}: UseInactivityMonitorOptions) {
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [warningType, setWarningType] = useState<WarningType | null>(null);
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const [lockReason, setLockReason] = useState<LockReason | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const lastEventThrottleRef = useRef<number>(0);
  const isLockedRef = useRef<boolean>(false);

  // Sync ref with state
  isLockedRef.current = isSessionLocked;

  const resetActivity = useCallback(() => {
    if (isLockedRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    onActivityRecord?.(now);
    // Only dismiss warning if it was an inactivity warning (not 8-hour max session warning)
    if (warningType === 'inactivity') {
      setIsWarningVisible(false);
      setWarningType(null);
    }
    onActive?.();
  }, [warningType, onActive, onActivityRecord]);

  const dismissWarning = useCallback(() => {
    setIsWarningVisible(false);
  }, []);

  const unlockSession = useCallback((renewSessionStart: boolean = false) => {
    const now = Date.now();
    lastActivityRef.current = now;
    onActivityRecord?.(now);
    if (renewSessionStart) {
      sessionStartRef.current = now;
      onSessionRenew?.();
    }
    setIsSessionLocked(false);
    setLockReason(null);
    setIsWarningVisible(false);
    setWarningType(null);
    onActive?.();
  }, [onSessionRenew, onActive, onActivityRecord]);

  const lockSession = useCallback((reason: LockReason = 'inactivity') => {
    setIsSessionLocked(true);
    setLockReason(reason);
    setIsWarningVisible(false);
    setWarningType(null);
    onLock?.(reason);
  }, [onLock]);

  useEffect(() => {
    if (!enabled) {
      setIsWarningVisible(false);
      setWarningType(null);
      setIsSessionLocked(false);
      setLockReason(null);
      return;
    }

    // Initialize session and activity timestamps (reads persistent activity if available)
    const now = Date.now();
    const initialActivity = getLastActivityTime ? getLastActivityTime() : now;
    lastActivityRef.current = initialActivity;
    sessionStartRef.current = getSessionStartTime ? getSessionStartTime() : now;

    // Event listener for user interactions (resets inactivity timer ONLY, not 8-hour clock)
    const handleUserActivity = () => {
      if (isLockedRef.current) return;
      const currentNow = Date.now();
      if (currentNow - lastEventThrottleRef.current > THROTTLE_ACTIVITY_MS) {
        lastEventThrottleRef.current = currentNow;
        lastActivityRef.current = currentNow;
        onActivityRecord?.(currentNow);
        
        // If an inactivity warning was showing, dismiss it upon user activity
        setIsWarningVisible((prev) => {
          if (prev && warningType === 'inactivity') {
            setWarningType(null);
            onActive?.();
            return false;
          }
          return prev;
        });
      }
    };

    // User interaction events to track
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    // Check elapsed time based on timestamps (resilient against background tab throttling)
    const evaluateSessionState = () => {
      if (isLockedRef.current) return;
      const checkNow = Date.now();
      const sessionStart = getSessionStartTime ? getSessionStartTime() : sessionStartRef.current;
      const elapsedSession = checkNow - sessionStart;
      const elapsedInactivity = checkNow - lastActivityRef.current;

      // 1. 8-Hour Maximum Session Lock takes absolute precedence
      if (elapsedSession >= maxSessionLockMs) {
        setIsSessionLocked(true);
        setLockReason('max_session');
        setIsWarningVisible(false);
        setWarningType(null);
        onLock?.('max_session');
        return;
      }

      // 2. 30-Minute Inactivity Lock
      if (elapsedInactivity >= inactivityLockMs) {
        setIsSessionLocked(true);
        setLockReason('inactivity');
        setIsWarningVisible(false);
        setWarningType(null);
        onLock?.('inactivity');
        return;
      }

      // 3. 7-Hour 45-Minute Maximum Session Warning (15m remaining)
      if (elapsedSession >= maxSessionWarningMs) {
        setIsWarningVisible(true);
        setWarningType('max_session');
        onWarning?.('max_session');
        return;
      }

      // 4. 25-Minute Inactivity Warning (5m remaining)
      if (elapsedInactivity >= inactivityWarningMs) {
        setIsWarningVisible(true);
        setWarningType('inactivity');
        onWarning?.('inactivity');
        return;
      }

      // Neither threshold reached
      setIsWarningVisible(false);
      setWarningType(null);
    };

    // Tab visibility and window focus handlers (calculates actual elapsed time on resume)
    const handleVisibilityOrFocus = () => {
      evaluateSessionState();
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Periodic check interval
    const intervalId = setInterval(evaluateSessionState, CHECK_INTERVAL_MS);

    // Evaluate session state immediately upon mount/startup
    evaluateSessionState();

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(intervalId);
    };
  }, [
    enabled,
    getLastActivityTime,
    onActivityRecord,
    getSessionStartTime,
    inactivityWarningMs,
    inactivityLockMs,
    maxSessionWarningMs,
    maxSessionLockMs,
    onLock,
    onWarning,
    onActive,
    warningType,
  ]);

  return {
    isWarningVisible,
    warningType,
    isSessionLocked,
    lockReason,
    resetActivity,
    dismissWarning,
    unlockSession,
    lockSession,
  };
}
