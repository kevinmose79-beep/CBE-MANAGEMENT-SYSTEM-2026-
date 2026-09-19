import { describe, it, expect } from 'vitest';

// Simulating database storage for resolveAllocationUUIDs and resolveClassAndStreamUUIDs tests
interface MockClass {
  id: string;
  class_name: string;
  grade_level?: number;
  capacity?: number;
}

interface MockStream {
  id: string;
  class_id: string;
  stream_name: string;
  capacity?: number;
}

interface MockSubject {
  id: string;
  subject_code: string;
  subject_name: string;
  category?: string;
  learning_area?: string;
}

function createMockSupabase(initialState: {
  classes: MockClass[];
  streams: MockStream[];
  subjects: MockSubject[];
}) {
  const state = {
    classes: [...initialState.classes],
    streams: [...initialState.streams],
    subjects: [...initialState.subjects],
  };

  const client = {
    _state: state,
    from: (table: string) => {
      let currentTable = table;
      let filterEq: Record<string, any> = {};
      let filterIlike: Record<string, string> = {};
      let filterOr: string[] = [];
      let isMaybeSingle = false;

      const builder: any = {
        select: (_cols?: string) => builder,
        eq: (col: string, val: any) => {
          filterEq[col] = val;
          return builder;
        },
        ilike: (col: string, pattern: string) => {
          filterIlike[col] = pattern;
          return builder;
        },
        or: (condition: string) => {
          filterOr.push(condition);
          return builder;
        },
        maybeSingle: async () => {
          isMaybeSingle = true;
          const rows = getFilteredRows();
          if (rows.length === 0) return { data: null, error: null };
          if (rows.length === 1) return { data: rows[0], error: null };
          return { data: null, error: { code: 'PGRST116', message: 'Multiple rows found when 1 expected' } };
        },
        then: (resolve: any) => {
          const rows = getFilteredRows();
          resolve({ data: rows, error: null });
        },
      };

      function getFilteredRows() {
        let rows = (state as any)[currentTable] || [];
        for (const [col, val] of Object.entries(filterEq)) {
          rows = rows.filter((r: any) => r[col] === val);
        }
        for (const [col, pattern] of Object.entries(filterIlike)) {
          const lowerPattern = String(pattern).toLowerCase();
          rows = rows.filter((r: any) => String(r[col] || '').toLowerCase() === lowerPattern);
        }
        return rows;
      }

      return builder;
    },
  };

  return client;
}

// Standalone implementation matching server.ts resolveAllocationUUIDs
async function serverResolveAllocationUUIDs(supabaseAdmin: any, alloc: any) {
  const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  let resolvedClassId: string | null = null;
  let resolvedStreamId: string | null = null;
  let resolvedSubjectId: string | null = null;

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
        const { data: matchingStreams, error: strmErr } = await supabaseAdmin
          .from('streams')
          .select('id, stream_name')
          .eq('class_id', resolvedClassId)
          .ilike('stream_name', alloc.stream);

        if (strmErr) {
          throw new Error(`Database query error while resolving stream "${alloc.stream}": ${strmErr.message}`);
        }

        if (!matchingStreams || matchingStreams.length === 0) {
          throw new Error(`Stream "${alloc.stream}" does not exist under the specified class. Please create the stream first in Class Management.`);
        } else if (matchingStreams.length === 1) {
          resolvedStreamId = matchingStreams[0].id;
        } else {
          throw new Error(`Ambiguous stream match: Multiple streams with name "${alloc.stream}" exist under this class. Please select the specific stream or disambiguate in Class Management.`);
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
    let className = alloc.class_name || (typeof rawClassId === 'string' && !isUUID(rawClassId) ? rawClassId : null);
    let streamName = alloc.stream || alloc.stream_name;

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

    if (!matchingClasses || matchingClasses.length === 0) {
      throw new Error(`Class "${className}" does not exist in the database. Please create the class first in Class Management.`);
    } else if (matchingClasses.length === 1) {
      resolvedClassId = matchingClasses[0].id;
    } else {
      throw new Error(`Ambiguous class match: Multiple classes with name "${className}" exist in the database. Please select the specific class or disambiguate in Class Management.`);
    }

    if (streamName) {
      const { data: matchingStreams, error: strmErr } = await supabaseAdmin
        .from('streams')
        .select('id, stream_name')
        .eq('class_id', resolvedClassId)
        .ilike('stream_name', streamName);

      if (strmErr) {
        throw new Error(`Database query error while resolving stream "${streamName}": ${strmErr.message}`);
      }

      if (!matchingStreams || matchingStreams.length === 0) {
        throw new Error(`Stream "${streamName}" does not exist under class "${className}". Please create the stream first in Class Management.`);
      } else if (matchingStreams.length === 1) {
        resolvedStreamId = matchingStreams[0].id;
      } else {
        throw new Error(`Ambiguous stream match: Multiple streams with name "${streamName}" exist under class "${className}". Please select the specific stream or disambiguate in Class Management.`);
      }
    }
  }

  // Resolve Subject
  const rawSubjectId = alloc.subject_id || alloc.subject_code || alloc.subject_name;
  if (isUUID(rawSubjectId)) {
    const { data: sbData } = await supabaseAdmin.from('subjects').select('id').eq('id', rawSubjectId).maybeSingle();
    if (sbData) {
      resolvedSubjectId = sbData.id;
    } else {
      throw new Error(`Subject with ID "${rawSubjectId}" could not be found.`);
    }
  } else if (rawSubjectId) {
    const subjectName = alloc.subject_name || rawSubjectId;
    const { data: matchingSubjects } = await supabaseAdmin
      .from('subjects')
      .select('*')
      .ilike('subject_name', subjectName);

    if (!matchingSubjects || matchingSubjects.length === 0) {
      throw new Error(`Learning area "${subjectName}" does not exist in the database.`);
    }
    resolvedSubjectId = matchingSubjects[0].id;
  }

  return {
    class_id: resolvedClassId,
    stream_id: resolvedStreamId,
    subject_id: resolvedSubjectId,
  };
}

// Standalone implementation matching storage.ts resolveClassAndStreamUUIDs
async function clientResolveClassAndStreamUUIDs(client: any, alloc: any) {
  const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  let resolvedClassId: string | null = null;
  let resolvedStreamId: string | null = null;

  const rawClassId = alloc.class_id || alloc.stream_id;
  const rawStreamId = alloc.stream_id;

  // 1. Direct UUID resolution for stream_id
  if (isUUID(rawStreamId)) {
    const { data: strmData } = await client.from('streams').select('id, class_id').eq('id', rawStreamId).maybeSingle();
    if (strmData) {
      resolvedStreamId = strmData.id;
      resolvedClassId = strmData.class_id;
    }
  }

  // 2. Direct UUID resolution for class_id
  if (!resolvedClassId && isUUID(rawClassId)) {
    const { data: clsData } = await client.from('classes').select('id').eq('id', rawClassId).maybeSingle();
    if (clsData) {
      resolvedClassId = clsData.id;
      const streamName = alloc.stream || alloc.stream_name;
      if (!resolvedStreamId && streamName) {
        const { data: matchingStreams, error: sErr } = await client
          .from('streams')
          .select('id, stream_name')
          .eq('class_id', resolvedClassId)
          .ilike('stream_name', streamName);

        if (sErr) throw new Error(`Database error resolving stream "${streamName}": ${sErr.message}`);

        if (matchingStreams && matchingStreams.length === 1) {
          resolvedStreamId = matchingStreams[0].id;
        } else if (matchingStreams && matchingStreams.length > 1) {
          throw new Error(`Ambiguous stream match: Multiple streams with name "${streamName}" exist under this class. Please select the specific stream.`);
        } else {
          throw new Error(`Stream "${streamName}" does not exist under the specified class. Please create the stream first in Class Management.`);
        }
      }
    } else {
      const { data: strmData } = await client.from('streams').select('id, class_id').eq('id', rawClassId).maybeSingle();
      if (strmData) {
        resolvedStreamId = strmData.id;
        resolvedClassId = strmData.class_id;
      }
    }
  }

  // 3. Name-based resolution with strict ambiguity detection
  const targetClassName = alloc.class_name || (rawClassId && typeof rawClassId === 'string' && !isUUID(rawClassId) && !rawClassId.startsWith('cls_') ? rawClassId : null);
  const targetStreamName = alloc.stream || alloc.stream_name;

  if (!resolvedClassId && targetClassName) {
    const { data: matchingClasses, error: cErr } = await client
      .from('classes')
      .select('id, class_name')
      .ilike('class_name', targetClassName);

    if (cErr) {
      throw new Error(`Database error resolving class "${targetClassName}": ${cErr.message}`);
    }

    if (matchingClasses && matchingClasses.length === 1) {
      resolvedClassId = matchingClasses[0].id;
      if (targetStreamName) {
        const { data: matchingStreams, error: sErr } = await client
          .from('streams')
          .select('id, stream_name')
          .eq('class_id', resolvedClassId)
          .ilike('stream_name', targetStreamName);

        if (sErr) {
          throw new Error(`Database error resolving stream "${targetStreamName}": ${sErr.message}`);
        }

        if (matchingStreams && matchingStreams.length === 1) {
          resolvedStreamId = matchingStreams[0].id;
        } else if (matchingStreams && matchingStreams.length > 1) {
          throw new Error(`Ambiguous stream match: Multiple streams with name "${targetStreamName}" exist under class "${targetClassName}". Please select the specific stream.`);
        } else {
          throw new Error(`Stream "${targetStreamName}" does not exist under class "${targetClassName}". Please create the stream first in Class Management.`);
        }
      }
    } else if (matchingClasses && matchingClasses.length > 1) {
      throw new Error(`Ambiguous class match: Multiple classes with name "${targetClassName}" exist in the database. Please select the specific class.`);
    } else {
      throw new Error(`Class "${targetClassName}" does not exist in the database. Please create the class first in Class Management.`);
    }
  }

  if (!resolvedClassId && (alloc.class_name || rawClassId)) {
    const desc = alloc.class_name || rawClassId;
    throw new Error(`Class "${desc}" does not exist in the database. Please create the class first in Class Management.`);
  }

  return { class_id: resolvedClassId, stream_id: resolvedStreamId };
}

describe('Issue 3H: Ambiguous Class & Stream Match Resolution Safety', () => {
  const initialClasses: MockClass[] = [
    { id: '11111111-1111-4111-8111-111111111111', class_name: 'Grade 7' },
    { id: '22222222-2222-4222-8222-222222222222', class_name: 'Grade 8' },
  ];

  const initialStreams: MockStream[] = [
    { id: '33333333-3333-4333-8333-333333333333', class_id: '11111111-1111-4111-8111-111111111111', stream_name: 'East' },
    { id: '44444444-4444-4444-8444-444444444444', class_id: '11111111-1111-4111-8111-111111111111', stream_name: 'West' },
    { id: '55555555-5555-4555-8555-555555555555', class_id: '22222222-2222-4222-8222-222222222222', stream_name: 'East' }, // Legitimate duplicate name across different classes
  ];

  const initialSubjects: MockSubject[] = [
    { id: '66666666-6666-4666-8666-666666666666', subject_code: 'ENG', subject_name: 'English' },
    { id: '77777777-7777-4777-8777-777777777777', subject_code: 'MAT', subject_name: 'Mathematics' },
  ];

  it('1. Existing unique class resolves successfully to canonical UUID', async () => {
    const mockDb = createMockSupabase({ classes: initialClasses, streams: initialStreams, subjects: initialSubjects });
    const result = await serverResolveAllocationUUIDs(mockDb, {
      class_name: 'Grade 7',
      stream: 'East',
      subject_id: '66666666-6666-4666-8666-666666666666',
    });

    expect(result.class_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.stream_id).toBe('33333333-3333-4333-8333-333333333333');
    expect(result.subject_id).toBe('66666666-6666-4666-8666-666666666666');
  });

  it('2. Existing stream under different parent class resolves correctly without conflict', async () => {
    const mockDb = createMockSupabase({ classes: initialClasses, streams: initialStreams, subjects: initialSubjects });
    const result = await serverResolveAllocationUUIDs(mockDb, {
      class_name: 'Grade 8',
      stream: 'East',
      subject_id: '66666666-6666-4666-8666-666666666666',
    });

    expect(result.class_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(result.stream_id).toBe('55555555-5555-4555-8555-555555555555');
  });

  it('3. Missing class throws a clear not-found error', async () => {
    const mockDb = createMockSupabase({ classes: initialClasses, streams: initialStreams, subjects: initialSubjects });
    await expect(
      serverResolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 10',
        stream: 'East',
        subject_id: '66666666-6666-4666-8666-666666666666',
      })
    ).rejects.toThrow(/Class "Grade 10" does not exist/);
  });

  it('4. Missing stream under existing class throws a clear not-found error', async () => {
    const mockDb = createMockSupabase({ classes: initialClasses, streams: initialStreams, subjects: initialSubjects });
    await expect(
      serverResolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'North',
        subject_id: '66666666-6666-4666-8666-666666666666',
      })
    ).rejects.toThrow(/Stream "North" does not exist under class "Grade 7"/);
  });

  it('5. Two matching classes throw an explicit ambiguity error (NO arbitrary selection)', async () => {
    const duplicateClasses: MockClass[] = [
      ...initialClasses,
      { id: '88888888-8888-4888-8888-888888888888', class_name: 'Grade 7' }, // Duplicate!
    ];
    const mockDb = createMockSupabase({ classes: duplicateClasses, streams: initialStreams, subjects: initialSubjects });

    await expect(
      serverResolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'East',
        subject_id: '66666666-6666-4666-8666-666666666666',
      })
    ).rejects.toThrow(/Ambiguous class match: Multiple classes with name "Grade 7" exist/);
  });

  it('6. Case-insensitive duplicate class names throw ambiguity error rather than guessing', async () => {
    const caseDuplicateClasses: MockClass[] = [
      ...initialClasses,
      { id: '88888888-8888-4888-8888-888888888888', class_name: 'GRADE 7' }, // Case duplicate!
    ];
    const mockDb = createMockSupabase({ classes: caseDuplicateClasses, streams: initialStreams, subjects: initialSubjects });

    await expect(
      serverResolveAllocationUUIDs(mockDb, {
        class_name: 'grade 7',
        stream: 'East',
        subject_id: '66666666-6666-4666-8666-666666666666',
      })
    ).rejects.toThrow(/Ambiguous class match/);
  });

  it('7. Two matching streams under the same class throw an explicit ambiguity error', async () => {
    const duplicateStreams: MockStream[] = [
      ...initialStreams,
      { id: '99999999-9999-4999-8999-999999999999', class_id: '11111111-1111-4111-8111-111111111111', stream_name: 'East' }, // Duplicate East in Grade 7!
    ];
    const mockDb = createMockSupabase({ classes: initialClasses, streams: duplicateStreams, subjects: initialSubjects });

    await expect(
      serverResolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'East',
        subject_id: '66666666-6666-4666-8666-666666666666',
      })
    ).rejects.toThrow(/Ambiguous stream match: Multiple streams with name "East" exist/);
  });

  it('8. Case-insensitive duplicate stream names throw ambiguity error rather than guessing', async () => {
    const duplicateStreams: MockStream[] = [
      ...initialStreams,
      { id: '99999999-9999-4999-8999-999999999999', class_id: '11111111-1111-4111-8111-111111111111', stream_name: 'EAST' }, // Case duplicate!
    ];
    const mockDb = createMockSupabase({ classes: initialClasses, streams: duplicateStreams, subjects: initialSubjects });

    await expect(
      serverResolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'east',
        subject_id: '66666666-6666-4666-8666-666666666666',
      })
    ).rejects.toThrow(/Ambiguous stream match/);
  });

  it('9. Client resolver throws on multiple class matches (prevents silent NULL allocations)', async () => {
    const duplicateClasses: MockClass[] = [
      ...initialClasses,
      { id: '88888888-8888-4888-8888-888888888888', class_name: 'Grade 7' },
    ];
    const mockDb = createMockSupabase({ classes: duplicateClasses, streams: initialStreams, subjects: initialSubjects });

    await expect(
      clientResolveClassAndStreamUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'East',
      })
    ).rejects.toThrow(/Ambiguous class match/);
  });

  it('10. Client resolver throws on multiple stream matches under the same class', async () => {
    const duplicateStreams: MockStream[] = [
      ...initialStreams,
      { id: '99999999-9999-4999-8999-999999999999', class_id: '11111111-1111-4111-8111-111111111111', stream_name: 'East' },
    ];
    const mockDb = createMockSupabase({ classes: initialClasses, streams: duplicateStreams, subjects: initialSubjects });

    await expect(
      clientResolveClassAndStreamUUIDs(mockDb, {
        class_name: 'Grade 7',
        stream: 'East',
      })
    ).rejects.toThrow(/Ambiguous stream match/);
  });

  it('11. Direct UUID resolution remains completely safe and bypasses name-search ambiguity', async () => {
    const duplicateClasses: MockClass[] = [
      ...initialClasses,
      { id: '88888888-8888-4888-8888-888888888888', class_name: 'Grade 7' },
    ];
    const mockDb = createMockSupabase({ classes: duplicateClasses, streams: initialStreams, subjects: initialSubjects });

    // Explicit stream_id UUID supplied directly
    const result = await serverResolveAllocationUUIDs(mockDb, {
      stream_id: '33333333-3333-4333-8333-333333333333',
      subject_id: '66666666-6666-4666-8666-666666666666',
    });

    expect(result.class_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.stream_id).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('12. No records are created during resolution (read-only guarantee)', async () => {
    const mockDb = createMockSupabase({ classes: initialClasses, streams: initialStreams, subjects: initialSubjects });
    
    try {
      await serverResolveAllocationUUIDs(mockDb, {
        class_name: 'Grade 99',
        stream: 'Unknown',
        subject_id: '66666666-6666-4666-8666-666666666666',
      });
    } catch {
      // Expected failure
    }

    expect(mockDb._state.classes.length).toBe(2);
    expect(mockDb._state.streams.length).toBe(3);
    expect(mockDb._state.subjects.length).toBe(2);
  });
});
