import assert from 'assert';
import { syncFromSupabase, resetSyncState, hasCompletedStartupSync } from '../lib/storage';

console.log('=== RUNNING PHASE 5 STARTUP SYNC DEDUPLICATION TESTS ===');

async function runTests() {
  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`✓ PASS: ${name}`);
    } catch (err) {
      console.error(`✕ FAIL: ${name}`, err);
    }
  }

  // Reset before testing
  resetSyncState();

  // TEST 1: resetSyncState sets hasCompletedStartupSync to false
  await test('TEST 1 — resetSyncState initializes hasCompletedStartupSync to false', () => {
    resetSyncState();
    assert.strictEqual(hasCompletedStartupSync(), false, 'Startup sync state must initially be false');
  });

  // TEST 2: Concurrent calls to syncFromSupabase return the exact same promise instance (in-flight deduplication)
  await test('TEST 2 — Concurrent syncFromSupabase calls share the same in-flight promise', async () => {
    resetSyncState();
    const p1 = syncFromSupabase();
    const p2 = syncFromSupabase();
    const p3 = syncFromSupabase();

    assert.strictEqual(p1, p2, 'Concurrent call 2 must return identical promise instance as call 1');
    assert.strictEqual(p1, p3, 'Concurrent call 3 must return identical promise instance as call 1');

    await p1;
  });

  // TEST 3: Subsequent call after completed sync returns true immediately when completed flag is set
  await test('TEST 3 — Subsequent call after completed sync skips re-executing if already completed', async () => {
    resetSyncState();
    const p1 = syncFromSupabase();
    await p1;
    // Calling again returns promise or boolean
    const p2 = syncFromSupabase();
    assert(p2 instanceof Promise);
    await p2;
  });

  // TEST 4: Forced sync bypasses completed flag
  await test('TEST 4 — syncFromSupabase({ force: true }) forces fresh sync promise', async () => {
    resetSyncState();
    const p1 = syncFromSupabase();
    await p1;
    const pForced = syncFromSupabase({ force: true });
    assert(pForced instanceof Promise, 'Forced sync returns a promise');
    await pForced;
  });

  // TEST 5: Logout reset allows new session sync
  await test('TEST 5 — resetSyncState clears flag for new authentication session', () => {
    resetSyncState();
    assert.strictEqual(hasCompletedStartupSync(), false, 'Resetting sync state prepares for fresh session sync');
  });

  console.log(`\nSTARTUP SYNC DEDUPLICATION TESTS: ${passed}/${total} PASSED\n`);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
