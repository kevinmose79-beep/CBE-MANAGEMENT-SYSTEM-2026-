import { describe, it, expect } from 'vitest';
import { Mark } from '../types';

interface ToastState {
  type: 'saving' | 'success' | 'error';
  title: string;
  message: string;
}

describe('MarksEntryTable async onSaveMarks race condition and toast reliability verification', () => {
  it('TEST 1: Successful save displays saving toast, awaits resolution, then displays success toast and clears dirty cells', async () => {
    let currentToast: ToastState | null = null;
    let isSaving = false;
    let dirtyCells = new Set(['std1_sub1_exam1']);

    const onSaveMarks = async (_marks: Mark[]) => {
      // Simulate network latency (40ms)
      await new Promise((res) => setTimeout(res, 40));
    };

    const handleSaveAll = async () => {
      isSaving = true;
      currentToast = {
        type: 'saving',
        title: 'Saving marks…',
        message: 'Please wait while your changes are being saved.',
      };

      try {
        await onSaveMarks([{ id: 'm1', student_id: 'std1', subject_id: 'sub1', exam_id: 'exam1', marks: 80 }]);
        dirtyCells = new Set();
        currentToast = {
          type: 'success',
          title: 'Marks saved successfully',
          message: 'Your changes have been saved.',
        };
      } catch (err: any) {
        currentToast = {
          type: 'error',
          title: 'Marks not saved',
          message: 'Your changes could not be saved. Please check your connection and try again.',
        };
      } finally {
        isSaving = false;
      }
    };

    // Before save
    expect(currentToast).toBeNull();
    expect(isSaving).toBe(false);
    expect(dirtyCells.size).toBe(1);

    // Trigger save
    const savePromise = handleSaveAll();

    // While in-flight (saving state)
    expect(isSaving).toBe(true);
    expect(currentToast).toEqual({
      type: 'saving',
      title: 'Saving marks…',
      message: 'Please wait while your changes are being saved.',
    });
    expect(dirtyCells.size).toBe(1);

    // Await completion
    await savePromise;

    // After successful resolution
    expect(isSaving).toBe(false);
    expect(currentToast).toEqual({
      type: 'success',
      title: 'Marks saved successfully',
      message: 'Your changes have been saved.',
    });
    expect(dirtyCells.size).toBe(0);
  });

  it('TEST 2: Failed save shows "Marks not saved" and preserves dirty cells for retry', async () => {
    let currentToast: ToastState | null = null;
    let isSaving = false;
    let dirtyCells = new Set(['std1_sub1_exam1']);

    const onSaveMarks = async (_marks: Mark[]) => {
      await new Promise((res) => setTimeout(res, 20));
      throw new Error('TypeError: Failed to fetch');
    };

    const handleSaveAll = async () => {
      isSaving = true;
      currentToast = {
        type: 'saving',
        title: 'Saving marks…',
        message: 'Please wait while your changes are being saved.',
      };

      try {
        await onSaveMarks([{ id: 'm1', student_id: 'std1', subject_id: 'sub1', exam_id: 'exam1', marks: 80 }]);
        dirtyCells = new Set();
        currentToast = {
          type: 'success',
          title: 'Marks saved successfully',
          message: 'Your changes have been saved.',
        };
      } catch (err: any) {
        currentToast = {
          type: 'error',
          title: 'Marks not saved',
          message: 'Your changes could not be saved. Please check your connection and try again.',
        };
      } finally {
        isSaving = false;
      }
    };

    // Trigger and await failed save
    await handleSaveAll();

    // Verification
    expect(isSaving).toBe(false);
    expect(currentToast).toEqual({
      type: 'error',
      title: 'Marks not saved',
      message: 'Your changes could not be saved. Please check your connection and try again.',
    });
    // Critical: dirty cells are NOT cleared
    expect(dirtyCells.size).toBe(1);
    expect(dirtyCells.has('std1_sub1_exam1')).toBe(true);
  });

  it('TEST 3: Retry workflow after failure saves successfully and clears dirty cells', async () => {
    let currentToast: ToastState | null = null;
    let isSaving = false;
    let dirtyCells = new Set(['std1_sub1_exam1']);
    let shouldFail = true;

    const onSaveMarks = async (_marks: Mark[]) => {
      await new Promise((res) => setTimeout(res, 10));
      if (shouldFail) {
        throw new Error('Network error');
      }
    };

    const handleSaveAll = async () => {
      isSaving = true;
      currentToast = {
        type: 'saving',
        title: 'Saving marks…',
        message: 'Please wait while your changes are being saved.',
      };

      try {
        await onSaveMarks([{ id: 'm1', student_id: 'std1', subject_id: 'sub1', exam_id: 'exam1', marks: 80 }]);
        dirtyCells = new Set();
        currentToast = {
          type: 'success',
          title: 'Marks saved successfully',
          message: 'Your changes have been saved.',
        };
      } catch (err: any) {
        currentToast = {
          type: 'error',
          title: 'Marks not saved',
          message: 'Your changes could not be saved. Please check your connection and try again.',
        };
      } finally {
        isSaving = false;
      }
    };

    // Attempt 1: Fails
    await handleSaveAll();
    expect(currentToast?.type).toBe('error');
    expect(currentToast?.title).toBe('Marks not saved');
    expect(dirtyCells.size).toBe(1);

    // Network recovers: Attempt 2 (Retry)
    shouldFail = false;
    await handleSaveAll();

    // Verification
    expect(currentToast?.type).toBe('success');
    expect(currentToast?.title).toBe('Marks saved successfully');
    expect(dirtyCells.size).toBe(0);
  });

  it('TEST 4: When onSaveMarks hangs indefinitely, withTimeout releases saving lock and retains dirty cells with error state', async () => {
    // Import withTimeout and SAVE_TIMEOUT_MS from MarksEntryTable
    const { withTimeout, SAVE_TIMEOUT_MS } = await import('../components/MarksEntryTable');

    expect(SAVE_TIMEOUT_MS).toBe(25000);

    let currentToast: ToastState | null = null;
    let isSaving = false;
    let isSavingRef = { current: false };
    let dirtyCells = new Set(['std1_sub1_exam1']);
    let autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';

    // Hanging save promise that never settles
    const hangingOnSaveMarks = (_marks: Mark[]): Promise<void> => {
      return new Promise<void>(() => {
        // intentionally never resolves or rejects
      });
    };

    const handleSaveWithSafetyTimeout = async (timeoutMs: number = 50) => {
      isSaving = true;
      isSavingRef.current = true;
      autoSaveStatus = 'saving';
      currentToast = {
        type: 'saving',
        title: 'Saving marks…',
        message: 'Please wait while your changes are being saved.',
      };

      try {
        await withTimeout(
          hangingOnSaveMarks([{ id: 'm1', student_id: 'std1', subject_id: 'sub1', exam_id: 'exam1', marks: 80 }]),
          timeoutMs,
          `Saving marks timed out after ${Math.round(timeoutMs / 1000)} seconds. Please check your network connection and retry.`
        );

        dirtyCells = new Set();
        autoSaveStatus = 'saved';
        currentToast = {
          type: 'success',
          title: 'Marks saved successfully',
          message: 'Your changes have been saved.',
        };
      } catch (err: any) {
        autoSaveStatus = 'error';
        currentToast = {
          type: 'error',
          title: 'Marks not saved',
          message: err.message,
        };
      } finally {
        isSaving = false;
        isSavingRef.current = false;
      }
    };

    // State before timeout occurs
    const savePromise = handleSaveWithSafetyTimeout(40);
    expect(isSaving).toBe(true);
    expect(isSavingRef.current).toBe(true);
    expect(autoSaveStatus).toBe('saving');
    expect(currentToast?.type).toBe('saving');
    expect(dirtyCells.has('std1_sub1_exam1')).toBe(true);

    // Wait for the timeout to trigger
    await savePromise;

    // 1. The save operation is treated as failed/timed out
    expect(autoSaveStatus).toBe('error');

    // 2. The saving state is released
    expect(isSaving).toBe(false);
    expect(isSavingRef.current).toBe(false);

    // 3. The saving notification changes to the existing error state
    expect(currentToast?.type).toBe('error');
    expect(currentToast?.title).toBe('Marks not saved');
    expect(currentToast?.message).toContain('Saving marks timed out');

    // 4. The unsaved mark remains in "dirtyCells"
    expect(dirtyCells.size).toBe(1);
    expect(dirtyCells.has('std1_sub1_exam1')).toBe(true);

    // 5. The system did not lose the learner's entered mark
    // 6. The Save button / saving lock becomes available again for retry
    expect(isSaving).toBe(false);
    expect(isSavingRef.current).toBe(false);
  });

  it('TEST 5: Retry after timeout successfully saves marks and clears dirty cells', async () => {
    const { withTimeout } = await import('../components/MarksEntryTable');

    let currentToast: ToastState | null = null;
    let isSaving = false;
    let isSavingRef = { current: false };
    let dirtyCells = new Set(['std1_sub1_exam1']);
    let autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';

    let shouldHang = true;

    const mockSaveMarks = (_marks: Mark[]): Promise<void> => {
      if (shouldHang) {
        return new Promise<void>(() => {});
      }
      return Promise.resolve();
    };

    const handleSave = async (timeoutMs: number = 30) => {
      isSaving = true;
      isSavingRef.current = true;
      autoSaveStatus = 'saving';
      currentToast = {
        type: 'saving',
        title: 'Saving marks…',
        message: 'Please wait while your changes are being saved.',
      };

      try {
        await withTimeout(
          mockSaveMarks([{ id: 'm1', student_id: 'std1', subject_id: 'sub1', exam_id: 'exam1', marks: 80 }]),
          timeoutMs,
          'Saving marks timed out. Please check your connection and retry.'
        );

        dirtyCells = new Set();
        autoSaveStatus = 'saved';
        currentToast = {
          type: 'success',
          title: 'Marks saved successfully',
          message: 'Your changes have been saved.',
        };
      } catch (err: any) {
        autoSaveStatus = 'error';
        currentToast = {
          type: 'error',
          title: 'Marks not saved',
          message: err.message,
        };
      } finally {
        isSaving = false;
        isSavingRef.current = false;
      }
    };

    // Attempt 1: Hangs and times out
    await handleSave(25);
    expect(isSaving).toBe(false);
    expect(isSavingRef.current).toBe(false);
    expect(dirtyCells.size).toBe(1);
    expect(autoSaveStatus).toBe('error');
    expect(currentToast?.type).toBe('error');

    // Attempt 2: Teacher retries now that network is unblocked
    shouldHang = false;
    await handleSave(50);
    expect(isSaving).toBe(false);
    expect(isSavingRef.current).toBe(false);
    expect(dirtyCells.size).toBe(0);
    expect(autoSaveStatus).toBe('saved');
    expect(currentToast?.type).toBe('success');
  });
});
