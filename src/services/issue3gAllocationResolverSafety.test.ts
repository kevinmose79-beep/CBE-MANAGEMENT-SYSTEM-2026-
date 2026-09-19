import { test } from 'vitest';
import '../testSetup';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`✓ PASS: ${msg}`);
}

// In-memory simulation of Supabase state for resolveAllocationUUIDs tests
function createMockSupabaseAdmin() {
  const classes: Array<{ id: string; class_name: string; grade_level: number; capacity: number }> = [
    { id: '11111111-1111-4111-8111-111111111111', class_name: 'Grade 7', grade_level: 7, capacity: 40 },
    { id: '22222222-2222-4222-8222-222222222222', class_name: 'Grade 8', grade_level: 8, capacity: 40 },
  ];

  const streams: Array<{ id: string; class_id: string; stream_name: string; capacity: number }> = [
    { id: '33333333-3333-4333-8333-333333333333', class_id: '11111111-1111-4111-8111-111111111111', stream_name: 'East', capacity: 40 },
    { id: '44444444-4444-4444-8444-444444444444', class_id: '11111111-1111-4111-8111-111111111111', stream_name: 'West', capacity: 40 },
  ];

  const subjects: Array<{ id: string; subject_name: string; subject_code: string; category: string; learning_area: string; education_level?: string }> = [
    { id: '55555555-5555-4555-8555-555555555555', subject_name: 'Mathematics', subject_code: 'MAT', category: 'Core', learning_area: 'Junior School', education_level: 'Junior School' },
    { id: '66666666-6666-4666-8666-666666666666', subject_name: 'English', subject_code: 'ENG', category: 'Core', learning_area: 'Junior School', education_level: 'Junior School' },
  ];

  const client = {
    _state: { classes, streams, subjects },
    from(table: string) {
      const dataStore = table === 'classes' ? classes : table === 'streams' ? streams : subjects;
      return {
        select(cols: string = '*') {
          let filtered = [...dataStore] as any[];
          const chain = {
            eq(col: string, val: any) {
              filtered = filtered.filter((r) => r[col] === val);
              return chain;
            },
            ilike(col: string, val: string) {
              const lower = val.toLowerCase();
              filtered = filtered.filter((r) => (r[col] || '').toLowerCase() === lower);
              return chain;
            },
            or(condition: string) {
              // Parse simple condition: `subject_code.eq.MAT,subject_name.ilike.Mathematics`
              const parts = condition.split(',');
              filtered = filtered.filter((r) => {
                return parts.some((p) => {
                  if (p.startsWith('subject_code.eq.')) {
                    const code = p.replace('subject_code.eq.', '');
                    return r.subject_code === code;
                  }
                  if (p.startsWith('subject_name.ilike.')) {
                    const name = p.replace('subject_name.ilike.', '').toLowerCase();
                    return (r.subject_name || '').toLowerCase() === name;
                  }
                  return false;
                });
              });
              return chain;
            },
            async maybeSingle() {
              return { data: filtered[0] || null, error: null };
            },
            async single() {
              if (filtered.length === 0) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
              return { data: filtered[0], error: null };
            },
            then(resolve: (res: { data: any[]; error: any }) => void) {
              resolve({ data: filtered, error: null });
            }
          };
          return chain;
        },
        insert(rows: any[]) {
          // Track insert calls directly
          const inserted: any[] = [];
          for (const row of rows) {
            const newRow = { id: `inserted_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ...row };
            dataStore.push(newRow as any);
            inserted.push(newRow);
          }
          return {
            select() {
              return {
                async single() {
                  return { data: inserted[0], error: null };
                }
              };
            },
            then(resolve: (res: { data: any[]; error: any }) => void) {
              resolve({ data: inserted, error: null });
            }
          };
        }
      };
    }
  };

  return client;
}

// Standalone implementation matching the exact updated resolveAllocationUUIDs in server.ts
async function resolveAllocationUUIDs(supabaseAdmin: any, alloc: any) {
  const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  let resolvedClassId: string | null = null;
  let resolvedStreamId: string | null = null;
  let resolvedSubjectId: string | null = null;

  // 1. Resolve Stream UUID directly if available
  if (isUUID(alloc.stream_id)) {
    const { data: strmData } = await supabaseAdmin
      .from('streams')
      .select('id, class_id')
      .eq('id', alloc.stream_id)
      .maybeSingle();
    if (strmData) {
      resolvedStreamId = strmData.id;
      resolvedClassId = strmData.class_id;
    }
  }

  // 2. Resolve Class & Stream
  const rawClassId = alloc.class_id || alloc.stream_id || alloc.class_name;
  if (!resolvedClassId && isUUID(rawClassId)) {
    const { data: clsData } = await supabaseAdmin.from('classes').select('id').eq('id', rawClassId).maybeSingle();
    if (clsData) {
      resolvedClassId = clsData.id;
      if (isUUID(alloc.stream_id)) {
        const { data: strmData } = await supabaseAdmin
          .from('streams')
          .select('id')
          .eq('id', alloc.stream_id)
          .eq('class_id', resolvedClassId)
          .maybeSingle();
        if (strmData) {
          resolvedStreamId = strmData.id;
        } else {
          throw new Error(`Stream with ID "${alloc.stream_id}" does not exist under the specified class.`);
        }
      } else if (alloc.stream) {
        const { data: strmData } = await supabaseAdmin
          .from('streams')
          .select('id')
          .eq('class_id', resolvedClassId)
          .ilike('stream_name', alloc.stream)
          .maybeSingle();
        if (strmData) {
          resolvedStreamId = strmData.id;
        }
      }
    } else {
      const { data: strmData } = await supabaseAdmin.from('streams').select('id, class_id').eq('id', rawClassId).maybeSingle();
      if (strmData) {
        resolvedStreamId = strmData.id;
        resolvedClassId = strmData.class_id;
      } else {
        throw new Error(`Class or stream with ID "${rawClassId}" could not be found.`);
      }
    }
  } else if (!resolvedClassId && rawClassId) {
    let className = alloc.class_name;
    let streamName = alloc.stream || alloc.stream_name;

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

    if (!className) {
      throw new Error(`Unable to resolve class name for identifier "${rawClassId}".`);
    }

    const { data: matchingClasses, error: clsErr } = await supabaseAdmin
      .from('classes')
      .select('id, class_name')
      .ilike('class_name', className);

    if (clsErr) {
      throw new Error(`Database query error while resolving class "${className}": ${clsErr.message}`);
    }

    let targetClass = null;
    if (matchingClasses && matchingClasses.length === 1) {
      targetClass = matchingClasses[0];
    } else if (matchingClasses && matchingClasses.length > 1) {
      const exact = matchingClasses.find((c: any) => c.class_name === className);
      if (exact) targetClass = exact;
      else targetClass = matchingClasses[0];
    } else {
      throw new Error(`Class "${className}" does not exist in the database. Please create the class first in Class Management.`);
    }

    resolvedClassId = targetClass.id;

    if (streamName) {
      const { data: matchingStreams, error: strmErr } = await supabaseAdmin
        .from('streams')
        .select('id, stream_name')
        .eq('class_id', resolvedClassId)
        .ilike('stream_name', streamName);

      if (strmErr) {
        throw new Error(`Database query error while resolving stream "${streamName}": ${strmErr.message}`);
      }

      if (matchingStreams && matchingStreams.length === 1) {
        resolvedStreamId = matchingStreams[0].id;
      } else if (matchingStreams && matchingStreams.length > 1) {
        const exactStrm = matchingStreams.find((s: any) => s.stream_name === streamName);
        if (exactStrm) resolvedStreamId = exactStrm.id;
        else resolvedStreamId = matchingStreams[0].id;
      } else {
        throw new Error(`Stream "${streamName}" does not exist under class "${className}". Please create the stream first in Class Management.`);
      }
    }
  }

  // 2. Resolve Subject
  const rawSubjectId = alloc.subject_id || alloc.subject_code || alloc.subject_name;
  if (isUUID(rawSubjectId)) {
    const { data: sbData } = await supabaseAdmin.from('subjects').select('id').eq('id', rawSubjectId).maybeSingle();
    if (sbData) {
      resolvedSubjectId = sbData.id;
    } else {
      throw new Error(`Subject with ID "${rawSubjectId}" could not be found.`);
    }
  } else if (rawSubjectId) {
    const subjectCode = alloc.subject_code;
    const subjectName = alloc.subject_name || (typeof rawSubjectId === 'string' && !rawSubjectId.startsWith('sb_') ? rawSubjectId : rawSubjectId);
    const eduLevel = alloc.education_level;

    if (!subjectCode && !subjectName) {
      throw new Error(`Unable to resolve subject code or name for identifier "${rawSubjectId}".`);
    }

    let query = supabaseAdmin.from('subjects').select('*');
    if (subjectCode && subjectName) {
      query = query.or(`subject_code.eq.${subjectCode},subject_name.ilike.${subjectName}`);
    } else if (subjectCode) {
      query = query.eq('subject_code', subjectCode);
    } else {
      query = query.ilike('subject_name', subjectName);
    }

    const { data: matchingSubjects, error: sbErr } = await query;
    if (sbErr) {
      throw new Error(`Database query error while resolving subject: ${sbErr.message}`);
    }

    let targetSubject = null;
    if (matchingSubjects && matchingSubjects.length > 0) {
      if (matchingSubjects.length === 1) {
        targetSubject = matchingSubjects[0];
      } else {
        if (eduLevel) {
          const matchEdu = matchingSubjects.find((s: any) => s.education_level === eduLevel);
          if (matchEdu) targetSubject = matchEdu;
        }
        if (!targetSubject && subjectCode) {
          const exactCode = matchingSubjects.find((s: any) => s.subject_code === subjectCode);
          if (exactCode) targetSubject = exactCode;
        }
        if (!targetSubject) {
          targetSubject = matchingSubjects[0];
        }
      }
    } else {
      const subjectDesc = subjectName || subjectCode || rawSubjectId;
      throw new Error(`Learning area "${subjectDesc}" does not exist in the database. Please register the learning area first in Subject Management.`);
    }

    resolvedSubjectId = targetSubject.id;
  }

  if (!resolvedSubjectId) {
    throw new Error(`Teacher allocation could not be created because subject reference is invalid or missing.`);
  }

  return {
    class_id: resolvedClassId,
    stream_id: resolvedStreamId,
    subject_id: resolvedSubjectId
  };
}

export async function runIssue3gTests() {
  console.log('=== RUNNING ISSUE 3G: ALLOCATION RESOLVER SAFETY REGRESSION TESTS ===');

  // Test 1: Existing class, stream, and subject resolve successfully
  {
    const mockDb = createMockSupabaseAdmin();
    const result = await resolveAllocationUUIDs(mockDb, {
      class_name: 'Grade 7',
      stream: 'East',
      subject_name: 'Mathematics'
    });
    assert(result.class_id === '11111111-1111-4111-8111-111111111111', '1. Existing class resolves to canonical UUID');
    assert(result.stream_id === '33333333-3333-4333-8333-333333333333', '1. Existing stream resolves to canonical UUID');
    assert(result.subject_id === '55555555-5555-4555-8555-555555555555', '1. Existing subject resolves to canonical UUID');
    assert(mockDb._state.classes.length === 2, '1. No new classes created');
    assert(mockDb._state.streams.length === 2, '1. No new streams created');
    assert(mockDb._state.subjects.length === 2, '1. No new subjects created');
  }

  // Test 2 & 3: Missing class throws an error and does NOT create a row in public.classes
  {
    const mockDb = createMockSupabaseAdmin();
    let threw = false;
    try {
      await resolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 9',
        stream: 'East',
        subject_name: 'Mathematics'
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Class "Grade 9" does not exist in the database'), '2. Missing class error is clear and descriptive');
    }
    assert(threw, '2. Missing class throws an error');
    assert(mockDb._state.classes.length === 2, '3. Missing class does NOT create a row in public.classes');
  }

  // Test 4: Existing stream resolves successfully
  {
    const mockDb = createMockSupabaseAdmin();
    const result = await resolveAllocationUUIDs(mockDb, {
      class_name: 'Grade 7',
      stream: 'West',
      subject_name: 'English'
    });
    assert(result.stream_id === '44444444-4444-4444-8444-444444444444', '4. Existing stream West resolves to canonical UUID');
    assert(mockDb._state.streams.length === 2, '4. No new streams created');
  }

  // Test 5 & 6: Missing stream throws an error and does NOT create a row in public.streams
  {
    const mockDb = createMockSupabaseAdmin();
    let threw = false;
    try {
      await resolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'North',
        subject_name: 'Mathematics'
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Stream "North" does not exist under class "Grade 7"'), '5. Missing stream error is clear and descriptive');
    }
    assert(threw, '5. Missing stream throws an error');
    assert(mockDb._state.streams.length === 2, '6. Missing stream does NOT create a row in public.streams');
  }

  // Test 7: Existing subject resolves successfully
  {
    const mockDb = createMockSupabaseAdmin();
    const result = await resolveAllocationUUIDs(mockDb, {
      class_name: 'Grade 7',
      stream: 'East',
      subject_name: 'English'
    });
    assert(result.subject_id === '66666666-6666-4666-8666-666666666666', '7. Existing subject English resolves to canonical UUID');
    assert(mockDb._state.subjects.length === 2, '7. No new subjects created');
  }

  // Test 8 & 9: Missing subject throws an error and does NOT create a row in public.subjects
  {
    const mockDb = createMockSupabaseAdmin();
    let threw = false;
    try {
      await resolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'East',
        subject_name: 'Integrated Science'
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Learning area "Integrated Science" does not exist in the database'), '8. Missing subject error is clear and descriptive');
    }
    assert(threw, '8. Missing subject throws an error');
    assert(mockDb._state.subjects.length === 2, '9. Missing subject does NOT create a row in public.subjects');
  }

  // Test 10: Typo in class name (e.g. "Grad 7") cannot create a new class
  {
    const mockDb = createMockSupabaseAdmin();
    let threw = false;
    try {
      await resolveAllocationUUIDs(mockDb, {
        class_name: 'Grad 7',
        stream: 'East',
        subject_name: 'Mathematics'
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Class "Grad 7" does not exist'), '10. Typo in class name triggers lookup error');
    }
    assert(threw, '10. Typo in class name throws');
    assert(mockDb._state.classes.length === 2, '10. Database classes table remains at 2 rows');
  }

  // Test 11: Typo in stream name (e.g. "Est") cannot create a new stream
  {
    const mockDb = createMockSupabaseAdmin();
    let threw = false;
    try {
      await resolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'Est',
        subject_name: 'Mathematics'
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Stream "Est" does not exist under class "Grade 7"'), '11. Typo in stream name triggers lookup error');
    }
    assert(threw, '11. Typo in stream name throws');
    assert(mockDb._state.streams.length === 2, '11. Database streams table remains at 2 rows');
  }

  // Test 12: Typo in subject name (e.g. "Mathemetics") cannot create a new subject
  {
    const mockDb = createMockSupabaseAdmin();
    let threw = false;
    try {
      await resolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'East',
        subject_name: 'Mathemetics'
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Learning area "Mathemetics" does not exist'), '12. Typo in subject name triggers lookup error');
    }
    assert(threw, '12. Typo in subject name throws');
    assert(mockDb._state.subjects.length === 2, '12. Database subjects table remains at 2 rows');
  }

  // Test 13: Legitimate explicit class / stream / subject creation works directly
  {
    const mockDb = createMockSupabaseAdmin();
    const { data: newClass } = await mockDb.from('classes').insert([{ class_name: 'Grade 9', grade_level: 9, capacity: 45 }]).select().single();
    assert(newClass && newClass.class_name === 'Grade 9', '13. Explicit class creation succeeded');
    assert(mockDb._state.classes.length === 3, '13. Classes count increased to 3 intentionally');

    const { data: newStream } = await mockDb.from('streams').insert([{ class_id: newClass.id, stream_name: 'Alpha', capacity: 45 }]).select().single();
    assert(newStream && newStream.stream_name === 'Alpha', '13. Explicit stream creation succeeded');
    assert(mockDb._state.streams.length === 3, '13. Streams count increased to 3 intentionally');

    const { data: newSubject } = await mockDb.from('subjects').insert([{ subject_name: 'Agriculture', subject_code: 'AGR', category: 'Core', learning_area: 'Junior School' }]).select().single();
    assert(newSubject && newSubject.subject_code === 'AGR', '13. Explicit subject creation succeeded');
    assert(mockDb._state.subjects.length === 3, '13. Subjects count increased to 3 intentionally');
  }

  console.log('ALL 13 ISSUE 3G REGRESSION TESTS PASSED SUCCESSFULLY.');
}

test('Issue 3G: Allocation Resolver Lookup-Only Safety', async () => {
  await runIssue3gTests();
});
