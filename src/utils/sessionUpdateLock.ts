/**
 * SessionUpdateLock - Safety layer protecting in-memory Marks Entry state
 * from unexpected reloads or OTA updates.
 *
 * Module-level zero-dependency singleton.
 * Tracks active editor instances and evaluates aggregate reload safety.
 */

export type UpdateLockState =
  | 'IDLE_SAFE'
  | 'VIEWING_CLEAN'
  | 'BUSY_DIRTY'
  | 'BUSY_DEBOUNCING'
  | 'BUSY_SAVING';

export interface InstanceLockStatus {
  hasDirtyMarks: boolean;
  isSaving: boolean;
  isDebouncing: boolean;
}

export type LockListener = (state: UpdateLockState) => void;

export class SessionUpdateLock {
  private instances = new Map<string, InstanceLockStatus>();
  private listeners = new Set<LockListener>();
  private currentState: UpdateLockState = 'IDLE_SAFE';
  private currentNavigationTab: string = 'dashboard';

  /**
   * Sets the current active application navigation context (e.g., active tab).
   * Ensures the system is aware if the user is on sensitive views like 'marks-entry'.
   */
  setNavigationTab(tab: string): void {
    this.currentNavigationTab = tab;
  }

  /**
   * Returns current active application navigation tab.
   */
  getNavigationTab(): string {
    return this.currentNavigationTab;
  }

  /**
   * Returns true if the user is currently navigating inside the Marks Entry view.
   */
  isMarksEntryActive(): boolean {
    return this.currentNavigationTab === 'marks-entry';
  }

  /**
   * Registers an editor instance with an instance-specific identifier.
   * Returns an unregister function for automatic cleanup on unmount.
   */
  acquire(instanceId: string, initialStatus?: Partial<InstanceLockStatus>): () => void {
    const status: InstanceLockStatus = {
      hasDirtyMarks: initialStatus?.hasDirtyMarks ?? false,
      isSaving: initialStatus?.isSaving ?? false,
      isDebouncing: initialStatus?.isDebouncing ?? false,
    };
    this.instances.set(instanceId, status);
    this.recalculateAndNotify();
    return () => this.release(instanceId);
  }

  /**
   * Unregisters a specific editor instance.
   */
  release(instanceId: string): void {
    if (this.instances.delete(instanceId)) {
      this.recalculateAndNotify();
    }
  }

  /**
   * Updates safety status for a specific registered instance.
   */
  setStatus(instanceId: string, status: Partial<InstanceLockStatus>): void {
    const current = this.instances.get(instanceId) || {
      hasDirtyMarks: false,
      isSaving: false,
      isDebouncing: false,
    };

    const updated: InstanceLockStatus = {
      hasDirtyMarks: status.hasDirtyMarks ?? current.hasDirtyMarks,
      isSaving: status.isSaving ?? current.isSaving,
      isDebouncing: status.isDebouncing ?? current.isDebouncing,
    };

    this.instances.set(instanceId, updated);
    this.recalculateAndNotify();
  }

  /**
   * Synchronous check: returns true ONLY when no registered instance has:
   * - dirty marks (hasDirtyMarks === true)
   * - a save in progress (isSaving === true)
   * - autosave debounce pending (isDebouncing === true)
   */
  canSafelyReload(): boolean {
    for (const status of this.instances.values()) {
      if (status.hasDirtyMarks || status.isSaving || status.isDebouncing) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns current aggregate lock state.
   */
  getAggregateState(): UpdateLockState {
    return this.currentState;
  }

  /**
   * Subscribes to aggregate lock state transitions.
   */
  subscribe(listener: LockListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Helper to reset internal state for unit tests.
   */
  reset(): void {
    this.instances.clear();
    this.listeners.clear();
    this.currentState = 'IDLE_SAFE';
  }

  /**
   * Count of currently registered editor instances.
   */
  get registeredCount(): number {
    return this.instances.size;
  }

  private recalculateAndNotify(): void {
    const newState = this.computeAggregateState();
    if (newState !== this.currentState) {
      this.currentState = newState;
      for (const listener of this.listeners) {
        try {
          listener(this.currentState);
        } catch (err) {
          console.error('[SessionUpdateLock] Listener error:', err);
        }
      }
    }
  }

  /**
   * The most restrictive active instance determines the aggregate state.
   * Ranking: BUSY_SAVING > BUSY_DEBOUNCING > BUSY_DIRTY > VIEWING_CLEAN > IDLE_SAFE
   */
  private computeAggregateState(): UpdateLockState {
    if (this.instances.size === 0) {
      return 'IDLE_SAFE';
    }

    let hasSaving = false;
    let hasDebouncing = false;
    let hasDirty = false;

    for (const status of this.instances.values()) {
      if (status.isSaving) hasSaving = true;
      if (status.isDebouncing) hasDebouncing = true;
      if (status.hasDirtyMarks) hasDirty = true;
    }

    if (hasSaving) return 'BUSY_SAVING';
    if (hasDebouncing) return 'BUSY_DEBOUNCING';
    if (hasDirty) return 'BUSY_DIRTY';

    return 'VIEWING_CLEAN';
  }
}

export const sessionUpdateLock = new SessionUpdateLock();
