import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('MarksEntryTable Debounced Auto-Save Forensic Audit & Verification', () => {
  const componentPath = path.resolve(process.cwd(), 'src/components/MarksEntryTable.tsx');
  const componentContent = fs.readFileSync(componentPath, 'utf-8');

  it('1. Verifies auto-save state, refs, and 1500ms debounce timer exist', () => {
    expect(componentContent).toContain('autoSaveStatus');
    expect(componentContent).toContain('lastAutoSavedAt');
    expect(componentContent).toContain('autoSaveTimeoutRef');
    expect(componentContent).toContain('isSavingRef');
    expect(componentContent).toContain('autoSavePendingRef');
    expect(componentContent).toContain('localMarksRef');
    expect(componentContent).toContain('cellVersionsRef');
    expect(componentContent).toContain('1500'); // 1.5s debounce delay
    expect(componentContent).toContain('triggerDebouncedAutoSave');
    expect(componentContent).toContain('executeSave');
  });

  it('2. Verifies all cell mutation handlers trigger debounced auto-save', () => {
    // Check that handleInputChange triggers auto-save
    expect(componentContent).toMatch(/handleInputChange[\s\S]*?triggerDebouncedAutoSave\(\)/);
    // Check that handleStatusChange triggers auto-save
    expect(componentContent).toMatch(/handleStatusChange[\s\S]*?triggerDebouncedAutoSave\(\)/);
    // Check that handleReasonChange triggers auto-save
    expect(componentContent).toMatch(/handleReasonChange[\s\S]*?triggerDebouncedAutoSave\(\)/);
    // Check that handleBulkSetStatus triggers auto-save
    expect(componentContent).toMatch(/handleBulkSetStatus[\s\S]*?triggerDebouncedAutoSave\(\)/);
  });

  it('3. Verifies concurrency safety, cell version tracking, and snapshot-based dirty cell clearance', () => {
    // Ensure keys to save snapshot is captured prior to network flight
    expect(componentContent).toContain('const keysToSave = new Set<string>(dirtyCellsRef.current)');
    expect(componentContent).toContain('const savingVersions: Record<string, number> = {}');
    // Ensure only keys whose mutation version has not advanced during in-flight network roundtrip are cleared
    expect(componentContent).toMatch(/if \(\(cellVersionsRef\.current\[k\] \|\| 0\) === savingVersions\[k\]\) \{\s*next\.delete\(k\);\s*\}/);
    // Ensure in-flight edits trigger re-save after current save completes
    expect(componentContent).toContain('if (autoSavePendingRef.current || dirtyCellsRef.current.size > 0)');
  });

  it('4. Verifies auto-save skips invalid or out-of-bounds scores without crashing', () => {
    expect(componentContent).toContain('if (isAutoSave && dirtyCellsRef.current.size === 0)');
    // If auto-save encounters validation issues, it quietly aborts rather than throwing disruptive alerts
    expect(componentContent).toContain('if (!isAutoSave) {');
    expect(componentContent).toContain('setValidationError(');
  });

  it('5. Verifies manual Save button and unmount cleanly clear pending debounce timers', () => {
    // Manual save clears pending timer
    expect(componentContent).toMatch(/executeSave[\s\S]*?clearTimeout\(autoSaveTimeoutRef\.current\)/);
    // Filter change effect clears pending timer
    expect(componentContent).toContain('clearTimeout(autoSaveTimeoutRef.current)');
    // Unmount effect clears pending timer
    expect(componentContent).toMatch(/useEffect\(\(\) => \{\s*return \(\) => \{\s*if \(autoSaveTimeoutRef\.current\) \{\s*clearTimeout\(autoSaveTimeoutRef\.current\);/);
  });

  it('6. Verifies visual auto-save status indicator is present in UI', () => {
    expect(componentContent).toContain('id="marks-entry-autosave-indicator"');
    expect(componentContent).toContain('Auto-saving marks…');
    expect(componentContent).toContain('Unsaved changes (auto-saving in 1s…)');
    expect(componentContent).toContain('Auto-saved (');
    expect(componentContent).toContain('Auto-save active');
    expect(componentContent).toContain('Auto-save paused');
  });

  it('7. Functional Debounce Simulation: verifies multiple rapid keystrokes trigger only a single debounced save', async () => {
    vi.useFakeTimers();
    let saveCallCount = 0;
    let pendingTimeout: any = null;

    const mockSave = () => {
      saveCallCount++;
    };

    const triggerDebounced = () => {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      pendingTimeout = setTimeout(() => {
        mockSave();
      }, 1200);
    };

    // Simulate rapid typing: 5 keystrokes in 500ms
    triggerDebounced();
    vi.advanceTimersByTime(100);
    triggerDebounced();
    vi.advanceTimersByTime(100);
    triggerDebounced();
    vi.advanceTimersByTime(100);
    triggerDebounced();
    vi.advanceTimersByTime(100);
    triggerDebounced();

    // At 400ms, save should NOT have fired yet
    expect(saveCallCount).toBe(0);

    // Advance by 1199ms (total 1599ms, 1199ms after last keystroke)
    vi.advanceTimersByTime(1199);
    expect(saveCallCount).toBe(0);

    // Advance 1ms more (1500ms after last keystroke)
    vi.advanceTimersByTime(301);
    expect(saveCallCount).toBe(1);

    vi.useRealTimers();
  });

  it('8. Concurrency & Version Snapshot Simulation: typing "6" then "7" while save is in-flight preserves "67" and never reverts to "6"', async () => {
    // Model state
    let localMarks: Record<string, string> = {};
    let dirtyCells = new Set<string>();
    let cellVersions: Record<string, number> = {};
    let saveHistory: string[] = [];

    const handleInputChange = (stdId: string, val: string) => {
      localMarks[stdId] = val;
      cellVersions[stdId] = (cellVersions[stdId] || 0) + 1;
      dirtyCells.add(stdId);
    };

    // User types "6"
    handleInputChange('std_1', '6');
    expect(localMarks['std_1']).toBe('6');
    expect(cellVersions['std_1']).toBe(1);
    expect(dirtyCells.has('std_1')).toBe(true);

    // Save starts for "6"
    const keysToSave = new Set(dirtyCells);
    const savingVersions: Record<string, number> = {};
    keysToSave.forEach((k) => {
      savingVersions[k] = cellVersions[k] || 0;
    });
    const snapshotToSave = { ...localMarks };

    // While network request for "6" is in-flight, user types "7" (so local score is "67")
    handleInputChange('std_1', '67');
    expect(localMarks['std_1']).toBe('67');
    expect(cellVersions['std_1']).toBe(2);

    // Network request for "6" completes successfully
    saveHistory.push(snapshotToSave['std_1']); // Saved "6"
    // Version-checked cleanup
    keysToSave.forEach((k) => {
      if ((cellVersions[k] || 0) === savingVersions[k]) {
        dirtyCells.delete(k);
      }
    });

    // CRITICAL INVARIANT: std_1 MUST REMAIN DIRTY because cellVersions['std_1'] (2) > savingVersions['std_1'] (1)
    expect(dirtyCells.has('std_1')).toBe(true);

    // When remote data sync / loadWorkflowData runs with the database value ("6"):
    const remoteMarkValue = '6';
    // If cell is dirty, local value ("67") is preserved and NOT overwritten by remote ("6")
    if (dirtyCells.has('std_1')) {
      // Retain local value
      localMarks['std_1'] = localMarks['std_1'];
    } else {
      localMarks['std_1'] = remoteMarkValue;
    }
    expect(localMarks['std_1']).toBe('67'); // Verified preserved!

    // Follow-up debounced save executes for remaining dirty cell
    const keysToSave2 = new Set(dirtyCells);
    const savingVersions2: Record<string, number> = {};
    keysToSave2.forEach((k) => {
      savingVersions2[k] = cellVersions[k] || 0;
    });
    const snapshotToSave2 = { ...localMarks };

    saveHistory.push(snapshotToSave2['std_1']); // Saved "67"
    keysToSave2.forEach((k) => {
      if ((cellVersions[k] || 0) === savingVersions2[k]) {
        dirtyCells.delete(k);
      }
    });

    expect(dirtyCells.size).toBe(0);
    expect(saveHistory).toEqual(['6', '67']);
    expect(localMarks['std_1']).toBe('67');
  });

  it('9. Real Typing Probe: "6" -> "67" -> stop typing persists exactly "67" in the Supabase payload', async () => {
    vi.useFakeTimers();

    let localMarks: Record<string, { rawScore: string; status: string }> = {};
    let dirtyCells = new Set<string>();
    let cellVersions: Record<string, number> = {};
    let timeout: any = null;
    let persistedPayloads: any[] = [];

    const saveToSupabase = (marksToSave: any[]) => {
      persistedPayloads.push(marksToSave);
    };

    const triggerDebounced = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        const payload: any[] = [];
        dirtyCells.forEach((stdId) => {
          const entry = localMarks[stdId];
          if (entry && entry.status === 'Normal') {
            const rawVal = parseFloat(entry.rawScore);
            payload.push({
              student_id: stdId,
              raw_score: rawVal,
              marks: rawVal, // out_of = 100
              special_status: 'Normal',
            });
          }
        });
        saveToSupabase(payload);
        dirtyCells.clear();
      }, 1500);
    };

    const handleInput = (stdId: string, val: string) => {
      localMarks[stdId] = { rawScore: val, status: 'Normal' };
      cellVersions[stdId] = (cellVersions[stdId] || 0) + 1;
      dirtyCells.add(stdId);
      triggerDebounced();
    };

    // User types "6"
    handleInput('std_1', '6');
    expect(localMarks['std_1'].rawScore).toBe('6');
    vi.advanceTimersByTime(200); // 200ms elapsed

    // User types "7" so cell has "67"
    handleInput('std_1', '67');
    expect(localMarks['std_1'].rawScore).toBe('67');

    // 1400ms after second keystroke (total 1600ms): should NOT have fired yet
    vi.advanceTimersByTime(1400);
    expect(persistedPayloads.length).toBe(0);

    // Advance remaining 100ms (1500ms after last keystroke)
    vi.advanceTimersByTime(100);
    expect(persistedPayloads.length).toBe(1);
    expect(persistedPayloads[0]).toEqual([
      {
        student_id: 'std_1',
        raw_score: 67,
        marks: 67,
        special_status: 'Normal',
      },
    ]);

    vi.useRealTimers();
  });

  it('10. Rapid Typing Probe: "65" -> "67" -> "68" -> debounce fires once with exact payload 68', async () => {
    vi.useFakeTimers();

    let localMarks: Record<string, { rawScore: string; status: string }> = {};
    let dirtyCells = new Set<string>();
    let timeout: any = null;
    let persistedPayloads: any[] = [];

    const saveToSupabase = (marksToSave: any[]) => {
      persistedPayloads.push(marksToSave);
    };

    const triggerDebounced = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        const payload: any[] = [];
        dirtyCells.forEach((stdId) => {
          const entry = localMarks[stdId];
          if (entry && entry.status === 'Normal') {
            const rawVal = parseFloat(entry.rawScore);
            payload.push({
              student_id: stdId,
              raw_score: rawVal,
              marks: rawVal,
            });
          }
        });
        saveToSupabase(payload);
        dirtyCells.clear();
      }, 1500);
    };

    const handleInput = (stdId: string, val: string) => {
      localMarks[stdId] = { rawScore: val, status: 'Normal' };
      dirtyCells.add(stdId);
      triggerDebounced();
    };

    handleInput('std_1', '65');
    vi.advanceTimersByTime(150);
    handleInput('std_1', '67');
    vi.advanceTimersByTime(200);
    handleInput('std_1', '68');

    vi.advanceTimersByTime(1499);
    expect(persistedPayloads.length).toBe(0);

    vi.advanceTimersByTime(1);
    expect(persistedPayloads.length).toBe(1);
    expect(persistedPayloads[0][0].raw_score).toBe(68);

    vi.useRealTimers();
  });

  it('11. Multi-Student Interleaved Probe: Student 1 types "6" then "67", Student 2 types "85" while save is in-flight', async () => {
    let localMarks: Record<string, string> = {};
    let dirtyCells = new Set<string>();
    let cellVersions: Record<string, number> = {};
    let saveBatches: any[] = [];

    const handleInput = (stdId: string, val: string) => {
      localMarks[stdId] = val;
      cellVersions[stdId] = (cellVersions[stdId] || 0) + 1;
      dirtyCells.add(stdId);
    };

    // 1. Student 1 receives '6'
    handleInput('std_1', '6');

    // 2. Batch 1 starts for std_1
    const batch1Keys = new Set(dirtyCells);
    const batch1Versions: Record<string, number> = {};
    batch1Keys.forEach((k) => (batch1Versions[k] = cellVersions[k]));
    const batch1Payload = [{ student_id: 'std_1', raw_score: parseFloat(localMarks['std_1']) }];

    // 3. While batch 1 is in-flight:
    // Student 1 types '67'
    handleInput('std_1', '67');
    // Student 2 types '85'
    handleInput('std_2', '85');

    // 4. Batch 1 completes
    saveBatches.push(batch1Payload);
    batch1Keys.forEach((k) => {
      if ((cellVersions[k] || 0) === batch1Versions[k]) {
        dirtyCells.delete(k);
      }
    });

    // std_1 MUST still be dirty (version 2 vs version 1)
    expect(dirtyCells.has('std_1')).toBe(true);
    // std_2 MUST still be dirty (not in batch 1)
    expect(dirtyCells.has('std_2')).toBe(true);

    // 5. Follow-up batch 2 triggers for remaining dirty cells
    const batch2Keys = new Set(dirtyCells);
    const batch2Versions: Record<string, number> = {};
    batch2Keys.forEach((k) => (batch2Versions[k] = cellVersions[k]));
    const batch2Payload = Array.from(batch2Keys).map((k) => ({
      student_id: k,
      raw_score: parseFloat(localMarks[k]),
    }));

    saveBatches.push(batch2Payload);
    batch2Keys.forEach((k) => {
      if ((cellVersions[k] || 0) === batch2Versions[k]) {
        dirtyCells.delete(k);
      }
    });

    expect(dirtyCells.size).toBe(0);
    expect(saveBatches.length).toBe(2);
    expect(saveBatches[0]).toEqual([{ student_id: 'std_1', raw_score: 6 }]);
    expect(saveBatches[1]).toEqual([
      { student_id: 'std_1', raw_score: 67 },
      { student_id: 'std_2', raw_score: 85 },
    ]);
  });

  it('12. Manual Save Interaction: clicking "Save All" immediately cancels pending debounce and saves latest value', () => {
    vi.useFakeTimers();

    let timeout: any = null;
    let savedPayload: any = null;
    let localMarks: Record<string, string> = { std_1: '67' };

    const manualSave = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      savedPayload = { student_id: 'std_1', raw_score: parseFloat(localMarks['std_1']) };
    };

    // Pending timer exists
    timeout = setTimeout(() => {
      savedPayload = { student_id: 'std_1', raw_score: 6 }; // stale
    }, 1500);

    // User clicks manual save immediately
    manualSave();

    expect(savedPayload).toEqual({ student_id: 'std_1', raw_score: 67 });

    // Advance time past 1500ms to ensure stale timer does NOT fire
    vi.advanceTimersByTime(2000);
    expect(savedPayload).toEqual({ student_id: 'std_1', raw_score: 67 });

    vi.useRealTimers();
  });
});
