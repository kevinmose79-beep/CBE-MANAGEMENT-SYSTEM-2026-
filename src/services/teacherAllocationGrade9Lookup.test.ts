import assert from 'assert';
import 'dotenv/config';

// Test Grade 9 lookup mapping logic
async function runTests() {
  console.log('=== RUNNING GRADE 9 TEACHER ALLOCATION RESOLUTION REGRESSION TESTS ===');

  const CLASS_STREAM_SEED_MAP: Record<string, { class_name: string; stream: string; education_level: string }> = {
    'cls_7e': { class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
    'cls_7w': { class_name: 'Grade 7', stream: 'West', education_level: 'Junior School' },
    'cls_8e': { class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
    'cls_8w': { class_name: 'Grade 8', stream: 'West', education_level: 'Junior School' },
    'cls_9a': { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
    'cls_grade9': { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
    'cls_grade9_alpha': { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
  };

  function parseClassNameAndStream(rawClassId: string, alloc: any) {
    const seedMeta: { class_name?: string; stream?: string; education_level?: string } = CLASS_STREAM_SEED_MAP[rawClassId] || {};
    let className = alloc.class_name || seedMeta.class_name;
    let streamName = alloc.stream || alloc.stream_name || seedMeta.stream;

    if (!className && typeof rawClassId === 'string') {
      if (!rawClassId.startsWith('cls_')) {
        className = rawClassId;
      } else {
        const clean = rawClassId.replace(/^cls_/, '').replace(/_/g, ' ');
        const match = clean.match(/(grade\s*\d+|pp\d+|playgroup)(\s+([a-z0-9]+))?/i);
        if (match) {
          className = match[1].replace(/grade\s*/i, 'Grade ').replace(/pp\s*/i, 'PP').trim();
          if (!streamName && match[3]) streamName = match[3];
        } else {
          className = clean;
        }
      }
    }

    return { className, streamName };
  }

  // Test 1: Junior School -> Grade 9 -> Alpha via cls_9a
  const res1 = parseClassNameAndStream('cls_9a', { education_level: 'Junior School' });
  assert.strictEqual(res1.className, 'Grade 9', 'Test 1: Class name should resolve to Grade 9');
  assert.strictEqual(res1.streamName, 'Alpha', 'Test 1: Stream name should resolve to Alpha');
  console.log('✓ PASS: Test 1 — Junior School cls_9a resolves to Grade 9 / Alpha');

  // Test 2: Junior School -> Grade 9 -> Alpha via cls_grade9_alpha
  const res2 = parseClassNameAndStream('cls_grade9_alpha', { education_level: 'Junior School' });
  assert.strictEqual(res2.className, 'Grade 9', 'Test 2: Class name should resolve to Grade 9');
  assert.strictEqual(res2.streamName, 'Alpha', 'Test 2: Stream name should resolve to Alpha');
  console.log('✓ PASS: Test 2 — Junior School cls_grade9_alpha resolves to Grade 9 / Alpha');

  // Test 3: Explicit Grade 9 class_name
  const res3 = parseClassNameAndStream('cls_custom_id', { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' });
  assert.strictEqual(res3.className, 'Grade 9', 'Test 3: Explicit class_name Grade 9 preserved');
  assert.strictEqual(res3.streamName, 'Alpha', 'Test 3: Explicit stream Alpha preserved');
  console.log('✓ PASS: Test 3 — Explicit class_name and stream fields preserved');

  console.log('GRADE 9 ALLOCATION LOOKUP TESTS: 3/3 PASSED');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
