import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sessionUpdateLock } from '../utils/sessionUpdateLock';

describe('MarksEntryTable SessionUpdateLock Integration Audit', () => {
  const componentPath = path.resolve(process.cwd(), 'src/components/MarksEntryTable.tsx');
  const componentContent = fs.readFileSync(componentPath, 'utf-8');

  it('1. Verifies sessionUpdateLock import in MarksEntryTable', () => {
    expect(componentContent).toContain("import { sessionUpdateLock } from '../utils/sessionUpdateLock';");
  });

  it('2. Verifies instance-specific identifier generation', () => {
    expect(componentContent).toMatch(/const instanceIdRef = React\.useRef<string>\(['"]marks_entry_['"]/);
  });

  it('3. Verifies component acquires lock on mount and releases on unmount', () => {
    expect(componentContent).toContain('sessionUpdateLock.acquire(instanceId');
    expect(componentContent).toContain('sessionUpdateLock.release(instanceId);');
  });

  it('4. Verifies continuous reporting of dirty, saving, and debouncing states', () => {
    expect(componentContent).toContain('sessionUpdateLock.setStatus(instanceId, {');
    expect(componentContent).toContain('hasDirtyMarks: dirtyCells.size > 0');
    expect(componentContent).toContain('isSaving: isCurrentlySaving');
    expect(componentContent).toContain('isDebouncing');
  });

  it('5. Verifies synchronous canSafelyReload contract with simulated component states', () => {
    sessionUpdateLock.reset();
    const instId = 'mock_marks_entry_instance';

    // Simulated mount
    sessionUpdateLock.acquire(instId, {
      hasDirtyMarks: false,
      isSaving: false,
      isDebouncing: false,
    });
    expect(sessionUpdateLock.canSafelyReload()).toBe(true);
    expect(sessionUpdateLock.getAggregateState()).toBe('VIEWING_CLEAN');

    // Simulated mark change (dirty + debounce)
    sessionUpdateLock.setStatus(instId, {
      hasDirtyMarks: true,
      isDebouncing: true,
      isSaving: false,
    });
    expect(sessionUpdateLock.canSafelyReload()).toBe(false);

    // Simulated save start
    sessionUpdateLock.setStatus(instId, {
      hasDirtyMarks: true,
      isDebouncing: false,
      isSaving: true,
    });
    expect(sessionUpdateLock.canSafelyReload()).toBe(false);
    expect(sessionUpdateLock.getAggregateState()).toBe('BUSY_SAVING');

    // Simulated save complete
    sessionUpdateLock.setStatus(instId, {
      hasDirtyMarks: false,
      isDebouncing: false,
      isSaving: false,
    });
    expect(sessionUpdateLock.canSafelyReload()).toBe(true);
    expect(sessionUpdateLock.getAggregateState()).toBe('VIEWING_CLEAN');

    // Simulated unmount
    sessionUpdateLock.release(instId);
    expect(sessionUpdateLock.canSafelyReload()).toBe(true);
    expect(sessionUpdateLock.getAggregateState()).toBe('IDLE_SAFE');
  });
});
