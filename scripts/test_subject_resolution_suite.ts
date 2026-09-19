import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function isUUID(str: any): boolean {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str.trim());
}

function disambiguateSubjects(
  matchingSubjects: any[],
  levelContext: string | null | undefined,
  subjectCode: string | null | undefined
): { success?: any; error?: string } {
  if (!matchingSubjects || matchingSubjects.length === 0) {
    return { error: 'No matching learning areas found in the database.' };
  }

  if (matchingSubjects.length === 1) {
    return { success: matchingSubjects[0] };
  }

  // 1. If subject code is provided and uniquely matches exactly one candidate
  if (subjectCode && subjectCode.trim()) {
    const trimmedCode = subjectCode.trim().toLowerCase();
    const exactCodeMatches = matchingSubjects.filter(
      (s: any) => s.subject_code && s.subject_code.trim().toLowerCase() === trimmedCode
    );
    if (exactCodeMatches.length === 1) {
      return { success: exactCodeMatches[0] };
    }
  }

  // 2. If no level context provided among multiple candidates, fail explicitly without guessing
  if (!levelContext || !levelContext.trim()) {
    const availableAreas = Array.from(new Set(matchingSubjects.map((s: any) => s.learning_area || s.education_level || 'Unknown'))).join(', ');
    return {
      error: `Ambiguous learning area: multiple records exist with the same name across different levels (${availableAreas}). Please provide the specific education level or subject code.`
    };
  }

  const lv = levelContext.trim().toLowerCase();

  // Tier 1: exact learning_area match or grade tier match
  const exactTierMatches = matchingSubjects.filter((s: any) => {
    const la = (s.learning_area || s.education_level || '').trim().toLowerCase();
    if (la === lv) return true;
    if ((lv.includes('pre-primary') || lv.includes('pp1') || lv.includes('pp2') || lv.includes('playgroup')) && la === 'pre-primary') return true;
    if ((lv.includes('lower primary') || lv.includes('grade 1') || lv.includes('grade 2') || lv.includes('grade 3')) && la === 'lower primary') return true;
    if ((lv.includes('upper primary') || lv.includes('grade 4') || lv.includes('grade 5') || lv.includes('grade 6')) && la === 'upper primary') return true;
    if (
      (lv.includes('junior') || lv.includes('grade 7') || lv.includes('grade 8') || lv.includes('grade 9')) &&
      (la === 'grade 7–9' || la === 'grade 7-9' || la.includes('junior'))
    ) {
      return true;
    }
    return false;
  });

  if (exactTierMatches.length === 1) {
    return { success: exactTierMatches[0] };
  }

  // Tier 2: broader range match (e.g. Grade 4–9 for Junior School or Upper Primary)
  const rangeTierMatches = matchingSubjects.filter((s: any) => {
    const la = (s.learning_area || s.education_level || '').trim().toLowerCase();
    if ((lv.includes('upper primary') || lv.includes('grade 4') || lv.includes('grade 5') || lv.includes('grade 6')) && (la === 'upper primary' || la === 'grade 4–9' || la === 'grade 4-9')) return true;
    if (
      (lv.includes('junior') || lv.includes('grade 7') || lv.includes('grade 8') || lv.includes('grade 9')) &&
      (la === 'grade 7–9' || la === 'grade 7-9' || la === 'grade 4–9' || la === 'grade 4-9' || la.includes('junior'))
    ) {
      return true;
    }
    if (la === 'pp1–grade 9' || la === 'pp1-grade 9' || la === 'all') return true;
    return false;
  });

  if (rangeTierMatches.length === 1) {
    return { success: rangeTierMatches[0] };
  }

  if (rangeTierMatches.length === 0 && exactTierMatches.length === 0) {
    const availableAreas = Array.from(new Set(matchingSubjects.map((s: any) => s.learning_area || s.education_level || 'Unknown'))).join(', ');
    return {
      error: `No subject found matching education level "${levelContext}". Available learning areas for this subject: ${availableAreas}.`
    };
  }

  const matchedAreas = Array.from(new Set(rangeTierMatches.map((s: any) => s.learning_area || s.education_level || 'Unknown'))).join(', ');
  return {
    error: `Ambiguous learning area: multiple records match education level "${levelContext}" (${matchedAreas}). Ambiguity cannot be resolved automatically.`
  };
}

async function testBackendResolver(alloc: any): Promise<string> {
  let resolvedSubjectId: string | null = null;
  const rawSubjectId = alloc.subject_id || alloc.subject_code || alloc.subject_name;

  if (isUUID(rawSubjectId)) {
    const { data: sbData, error: sbErr } = await supabaseAdmin
      .from('subjects')
      .select('id, subject_name, subject_code, learning_area')
      .eq('id', rawSubjectId)
      .maybeSingle();
    if (sbErr) {
      throw new Error(`Database error resolving subject ID: ${sbErr.message}`);
    }
    if (sbData) {
      resolvedSubjectId = sbData.id;
    } else {
      throw new Error(`Subject with ID "${rawSubjectId}" could not be found.`);
    }
  } else if (rawSubjectId) {
    const subjectCode = (alloc.subject_code || '').trim();
    const subjectName = (alloc.subject_name || (typeof rawSubjectId === 'string' && !rawSubjectId.startsWith('sb_') ? rawSubjectId : '')).trim();
    let eduLevel = (alloc.education_level || alloc.class_name || '').trim();

    if (!subjectCode && !subjectName) {
      throw new Error(`Unable to resolve subject code or name for identifier "${rawSubjectId}".`);
    }

    let targetSubject = null;

    // A. If exact subject_code is given, try looking up by unique subject_code
    if (subjectCode && subjectCode !== subjectName) {
      const { data: codeMatches, error: codeErr } = await supabaseAdmin
        .from('subjects')
        .select('id, subject_name, subject_code, learning_area')
        .eq('subject_code', subjectCode);

      if (codeErr) {
        throw new Error(`Database query error while resolving subject code: ${codeErr.message}`);
      }

      if (codeMatches && codeMatches.length === 1) {
        targetSubject = codeMatches[0];
      } else if (codeMatches && codeMatches.length > 1) {
        throw new Error(`Ambiguous subject code "${subjectCode}": multiple records found in database.`);
      }
    }

    // B. If not resolved by code, look up by exact subject_name (case-insensitive)
    if (!targetSubject && subjectName) {
      const { data: nameMatches, error: nameErr } = await supabaseAdmin
        .from('subjects')
        .select('id, subject_name, subject_code, learning_area')
        .ilike('subject_name', subjectName);

      if (nameErr) {
        throw new Error(`Database query error while resolving subject name: ${nameErr.message}`);
      }

      if (nameMatches && nameMatches.length > 0) {
        const res = disambiguateSubjects(nameMatches, eduLevel, subjectCode);
        if (res.success) {
          targetSubject = res.success;
        } else {
          throw new Error(res.error || `Learning area "${subjectName}" could not be uniquely resolved.`);
        }
      }
    }

    // C. If still not resolved and code is available
    if (!targetSubject && subjectCode) {
      const { data: codeMatches, error: codeErr } = await supabaseAdmin
        .from('subjects')
        .select('id, subject_name, subject_code, learning_area')
        .eq('subject_code', subjectCode);

      if (codeErr) {
        throw new Error(`Database query error while resolving subject code: ${codeErr.message}`);
      }

      if (codeMatches && codeMatches.length === 1) {
        targetSubject = codeMatches[0];
      } else if (codeMatches && codeMatches.length > 1) {
        throw new Error(`Ambiguous subject code "${subjectCode}": multiple records found in database.`);
      }
    }

    if (!targetSubject) {
      const subjectDesc = subjectName || subjectCode || rawSubjectId;
      throw new Error(`Learning area "${subjectDesc}" does not exist in the database. Please register the learning area first in Subject Management.`);
    }

    resolvedSubjectId = targetSubject.id;
  }

  if (!resolvedSubjectId) {
    throw new Error(`Teacher allocation could not be created because subject reference is invalid or missing.`);
  }

  return resolvedSubjectId;
}

async function runRegressionSuite() {
  console.log('--- STARTING SUBJECT RESOLUTION REGRESSION TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  async function assertTest(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // Count initial subjects to prove zero modification/leakage
  const { count: initialSubjectCount } = await supabaseAdmin.from('subjects').select('*', { count: 'exact', head: true });

  // Test 1: Valid UUID returns exact canonical UUID
  await assertTest('1. Valid Subject UUID returns canonical UUID', async () => {
    const res = await testBackendResolver({ subject_id: '4441b054-2d20-4d5c-852d-f31d16fbc145' });
    if (res !== '4441b054-2d20-4d5c-852d-f31d16fbc145') throw new Error(`Expected 4441b054... got ${res}`);
  });

  // Test 2: Non-existent UUID throws clear error
  await assertTest('2. Non-existent Subject UUID throws error', async () => {
    try {
      await testBackendResolver({ subject_id: '00000000-0000-0000-0000-000000000000' });
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (!err.message.includes('could not be found')) throw err;
    }
  });

  // Test 3: Exact unique subject code MATH (Junior/Middle) -> 4441b054-2d20-4d5c-852d-f31d16fbc145
  await assertTest('3. Exact code MATH resolves correctly', async () => {
    const res = await testBackendResolver({ subject_code: 'MATH' });
    if (res !== '4441b054-2d20-4d5c-852d-f31d16fbc145') throw new Error(`Expected 4441b054... got ${res}`);
  });

  // Test 4: Exact unique subject code MATHS (Upper Primary) -> 58e9f675-1a4c-41f8-b24a-98acbac0edb1
  await assertTest('4. Exact code MATHS resolves to Upper Primary Math', async () => {
    const res = await testBackendResolver({ subject_code: 'MATHS' });
    if (res !== '58e9f675-1a4c-41f8-b24a-98acbac0edb1') throw new Error(`Expected 58e9f675... got ${res}`);
  });

  // Test 5: "Mathematics" + "Junior School" -> 4441b054-2d20-4d5c-852d-f31d16fbc145
  await assertTest('5. Mathematics + Junior School resolves to MATH', async () => {
    const res = await testBackendResolver({ subject_name: 'Mathematics', education_level: 'Junior School' });
    if (res !== '4441b054-2d20-4d5c-852d-f31d16fbc145') throw new Error(`Expected 4441b054... got ${res}`);
  });

  // Test 6: "Mathematics" + "Grade 8" -> 4441b054-2d20-4d5c-852d-f31d16fbc145
  await assertTest('6. Mathematics + Grade 8 resolves to MATH', async () => {
    const res = await testBackendResolver({ subject_name: 'Mathematics', class_name: 'Grade 8' });
    if (res !== '4441b054-2d20-4d5c-852d-f31d16fbc145') throw new Error(`Expected 4441b054... got ${res}`);
  });

  // Test 7: "Mathematics" + "Upper Primary" -> 58e9f675-1a4c-41f8-b24a-98acbac0edb1
  await assertTest('7. Mathematics + Upper Primary resolves to MATHS', async () => {
    const res = await testBackendResolver({ subject_name: 'Mathematics', education_level: 'Upper Primary' });
    if (res !== '58e9f675-1a4c-41f8-b24a-98acbac0edb1') throw new Error(`Expected 58e9f675... got ${res}`);
  });

  // Test 8: "Mathematics" + "Grade 5" -> 58e9f675-1a4c-41f8-b24a-98acbac0edb1
  await assertTest('8. Mathematics + Grade 5 resolves to MATHS', async () => {
    const res = await testBackendResolver({ subject_name: 'Mathematics', class_name: 'Grade 5' });
    if (res !== '58e9f675-1a4c-41f8-b24a-98acbac0edb1') throw new Error(`Expected 58e9f675... got ${res}`);
  });

  // Test 9: "Social Studies" + "Junior School" -> dff8e7fc-bb0d-41c5-b451-e6b6f3361409 (SST)
  await assertTest('9. Social Studies + Junior School resolves to SST', async () => {
    const res = await testBackendResolver({ subject_name: 'Social Studies', education_level: 'Junior School' });
    if (res !== 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409') throw new Error(`Expected dff8e7fc... got ${res}`);
  });

  // Test 10: "Social Studies" + "Upper Primary" -> f8255683-1d59-46a7-881a-04a25d45d972 (SS)
  await assertTest('10. Social Studies + Upper Primary resolves to SS', async () => {
    const res = await testBackendResolver({ subject_name: 'Social Studies', education_level: 'Upper Primary' });
    if (res !== 'f8255683-1d59-46a7-881a-04a25d45d972') throw new Error(`Expected f8255683... got ${res}`);
  });

  // Test 11: "Creative Arts and Sports" + "Junior School" -> b2ee51ad-3d6e-458c-8a1e-f5b9b79a0d83
  await assertTest('11. Creative Arts and Sports + Junior School resolves to Grade 4–9 CAS', async () => {
    const res = await testBackendResolver({ subject_name: 'Creative Arts and Sports', education_level: 'Junior School' });
    if (res !== 'b2ee51ad-3d6e-458c-8a1e-f5b9b79a0d83') throw new Error(`Expected b2ee51ad... got ${res}`);
  });

  // Test 12: "Creative Arts" + "Upper Primary" -> 494e923e-cc4f-459c-b36d-4b19b7994561 (CA)
  await assertTest('12. Creative Arts + Upper Primary resolves to Upper Primary CA', async () => {
    const res = await testBackendResolver({ subject_name: 'Creative Arts', education_level: 'Upper Primary' });
    if (res !== '494e923e-cc4f-459c-b36d-4b19b7994561') throw new Error(`Expected 494e923e... got ${res}`);
  });

  // Test 13: "Mathematics" with NO level context throws explicit Ambiguity Error
  await assertTest('13. Mathematics with NO level context throws Ambiguity Error', async () => {
    try {
      await testBackendResolver({ subject_name: 'Mathematics' });
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (!err.message.includes('Ambiguous learning area') && !err.message.includes('multiple records exist')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // Test 14: Substring matching rejection - "Science" alone must NOT match "Integrated Science"
  await assertTest('14. Substring matching "Science" throws Not Exist Error', async () => {
    try {
      await testBackendResolver({ subject_name: 'Science', education_level: 'Junior School' });
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (!err.message.includes('does not exist in the database')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // Test 15: Non-existent subject throws clear descriptive error
  await assertTest('15. Non-existent subject throws clear error', async () => {
    try {
      await testBackendResolver({ subject_name: 'Quantum Physics', education_level: 'Junior School' });
      throw new Error('Should have thrown error');
    } catch (err: any) {
      if (!err.message.includes('does not exist in the database')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // Test 16: Check that no subjects were created or deleted
  const { count: finalSubjectCount } = await supabaseAdmin.from('subjects').select('*', { count: 'exact', head: true });
  await assertTest('16. Supabase subjects count is identical (Zero side effects)', async () => {
    if (initialSubjectCount !== finalSubjectCount) {
      throw new Error(`Subject count changed from ${initialSubjectCount} to ${finalSubjectCount}`);
    }
  });

  // Test 17: Unique subject "Integrated Science" (INT-SCI) resolves cleanly
  await assertTest('17. Unique subject Integrated Science resolves cleanly', async () => {
    const res = await testBackendResolver({ subject_name: 'Integrated Science', education_level: 'Junior School' });
    if (res !== 'b65c16d5-a38c-478e-ab46-085170ee31da') throw new Error(`Expected b65c16d5... got ${res}`);
  });

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite();
