import { describe, it, expect, beforeEach } from 'vitest';
import { sessionUpdateLock, UpdateLockState } from './sessionUpdateLock';

describe('SessionUpdateLock Safety Layer', () => {
  beforeEach(() => {
    sessionUpdateLock.reset();
  });

  describe('SAFE Conditions', () => {
    it('returns IDLE_SAFE and canSafelyReload === true when no registered instances exist', () => {
      expect(sessionUpdateLock.registeredCount).toBe(0);
      expect(sessionUpdateLock.getAggregateState()).toBe('IDLE_SAFE');
      expect(sessionUpdateLock.canSafelyReload()).toBe(true);
    });

    it('returns VIEWING_CLEAN and canSafelyReload === true when registered instance is completely clean', () => {
      const release = sessionUpdateLock.acquire('editor-1', {
        hasDirtyMarks: false,
        isSaving: false,
        isDebouncing: false,
      });

      expect(sessionUpdateLock.registeredCount).toBe(1);
      expect(sessionUpdateLock.getAggregateState()).toBe('VIEWING_CLEAN');
      expect(sessionUpdateLock.canSafelyReload()).toBe(true);

      release();
      expect(sessionUpdateLock.getAggregateState()).toBe('IDLE_SAFE');
      expect(sessionUpdateLock.canSafelyReload()).toBe(true);
    });
  });

  describe('BUSY Conditions', () => {
    it('marks session as BUSY_DIRTY and unsafe when dirty marks exist', () => {
      sessionUpdateLock.acquire('editor-1');
      sessionUpdateLock.setStatus('editor-1', { hasDirtyMarks: true, isSaving: false, isDebouncing: false });

      expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_DIRTY');
      expect(sessionUpdateLock.canSafelyReload()).toBe(false);
    });

    it('marks session as BUSY_DEBOUNCING and unsafe when autosave debounce is pending', () => {
      sessionUpdateLock.acquire('editor-1');
      sessionUpdateLock.setStatus('editor-1', { hasDirtyMarks: false, isSaving: false, isDebouncing: true });

      expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_DEBOUNCING');
      expect(sessionUpdateLock.canSafelyReload()).toBe(false);
    });

    it('marks session as BUSY_SAVING and unsafe when save is in flight', () => {
      sessionUpdateLock.acquire('editor-1');
      sessionUpdateLock.setStatus('editor-1', { hasDirtyMarks: false, isSaving: true, isDebouncing: false });

      expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_SAVING');
      expect(sessionUpdateLock.canSafelyReload()).toBe(false);
    });
  });

  describe('MULTIPLE INSTANCES', () => {
    it('instance A dirty + instance B clean → unsafe', () => {
      sessionUpdateLock.acquire('inst-A', { hasDirtyMarks: true, isSaving: false, isDebouncing: false });
      sessionUpdateLock.acquire('inst-B', { hasDirtyMarks: false, isSaving: false, isDebouncing: false });

      expect(sessionUpdateLock.canSafelyReload()).toBe(false);
      expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_DIRTY');
    });

    it('instance A clean + instance B saving → unsafe', () => {
      sessionUpdateLock.acquire('inst-A', { hasDirtyMarks: false, isSaving: false, isDebouncing: false });
      sessionUpdateLock.acquire('inst-B', { hasDirtyMarks: false, isSaving: true, isDebouncing: false });

      expect(sessionUpdateLock.canSafelyReload()).toBe(false);
      expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_SAVING');
    });

    it('instance A unregisters while instance B is dirty → remains unsafe', () => {
      const releaseA = sessionUpdateLock.acquire('inst-A', { hasDirtyMarks: false, isSaving: false, isDebouncing: false });
      sessionUpdateLock.acquire('inst-B', { hasDirtyMarks: true, isSaving: false, isDebouncing: false });

      expect(sessionUpdateLock.canSafelyReload()).toBe(false);

      // Instance A unmounts
      releaseA();

      // Instance B is still dirty → must remain locked
      expect(sessionUpdateLock.canSafelyReload()).toBe(false);
      expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_DIRTY');
    });

    it('all instances unregister → safe', () => {
      const releaseA = sessionUpdateLock.acquire('inst-A', { hasDirtyMarks: true, isSaving: false, isDebouncing: false });
      const releaseB = sessionUpdateLock.acquire('inst-B', { hasDirtyMarks: false, isSaving: true, isDebouncing: false });

      expect(sessionUpdateLock.canSafelyReload()).toBe(false);

      releaseA();
      expect(sessionUpdateLock.canSafelyReload()).toBe(false);

      releaseB();
      expect(sessionUpdateLock.canSafelyReload()).toBe(true);
      expect(sessionUpdateLock.getAggregateState()).toBe('IDLE_SAFE');
    });
  });

  describe('STATE TRANSITIONS', () => {
    it('executes the full lifecycle: IDLE_SAFE → VIEWING_CLEAN → BUSY_DIRTY → BUSY_DEBOUNCING → BUSY_SAVING → VIEWING_CLEAN → IDLE_SAFE', () => {
      const transitions: UpdateLockState[] = [];
      const unsubscribe = sessionUpdateLock.subscribe((state) => {
        transitions.push(state);
      });

      // 0. Initial state
      expect(sessionUpdateLock.getAggregateState()).toBe('IDLE_SAFE');

      // 1. Mount editor with clean state
      const release = sessionUpdateLock.acquire('marks-entry', {
        hasDirtyMarks: false,
        isSaving: false,
        isDebouncing: false,
      });
      expect(sessionUpdateLock.getAggregateState()).toBe('VIEWING_CLEAN');
      expect(sessionUpdateLock.canSafelyReload()).toBe(true);

      // 2. Mark becomes dirty (user edits cell)
      sessionUpdateLock.setStatus('marks-entry', {
        hasDirtyMarks: true,
        isDebouncing: false,
        isSaving: false,
      });
      expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_DIRTY');
      expect(sessionUpdateLock.canSafelyReload()).toBe(false);

      // 3. Debounce timer starts ticking (1500ms window)
      sessionUpdateLock.setStatus('marks-entry', {
        hasDirtyMarks: true,
        isDebouncing: true,
        isSaving: false,
      });
      expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_DEBOUNCING');
      expect(sessionUpdateLock.canSafelyReload()).toBe(false);

      // 4. Save begins executing against Supabase
      sessionUpdateLock.setStatus('marks-entry', {
        hasDirtyMarks: true,
        isDebouncing: false,
        isSaving: true,
      });
      expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_SAVING');
      expect(sessionUpdateLock.canSafelyReload()).toBe(false);

      // 5. Save completes successfully, dirty cells cleared
      sessionUpdateLock.setStatus('marks-entry', {
        hasDirtyMarks: false,
        isDebouncing: false,
        isSaving: false,
      });
      expect(sessionUpdateLock.getAggregateState()).toBe('VIEWING_CLEAN');
      expect(sessionUpdateLock.canSafelyReload()).toBe(true);

      // 6. User navigates away / component unmounts
      release();
      expect(sessionUpdateLock.getAggregateState()).toBe('IDLE_SAFE');
      expect(sessionUpdateLock.canSafelyReload()).toBe(true);

      unsubscribe();

      expect(transitions).toEqual([
        'VIEWING_CLEAN',
        'BUSY_DIRTY',
        'BUSY_DEBOUNCING',
        'BUSY_SAVING',
        'VIEWING_CLEAN',
        'IDLE_SAFE',
      ]);
    });
  });
});
