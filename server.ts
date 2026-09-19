import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import 'dotenv/config';
import { calculateExamResults } from "./src/services/analysisEngine";
import { getStreamCohortStudentIds, getGradeCohortStudentIds, getLearnerClassAtExamTime } from "./src/services/historicalContextResolver";
import { checkAndPerformAcademicYearRollover } from "./src/services/academicYearRollover";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str.trim());
}

const CLASS_STREAM_SEED_MAP: Record<string, { class_name: string; stream: string; education_level: string }> = {
  'cls_pp1_b': { class_name: 'PP1', stream: 'Blue', education_level: 'Pre-Primary' },
  'cls_pp2_b': { class_name: 'PP2', stream: 'Blue', education_level: 'Pre-Primary' },
  'cls_g1_b': { class_name: 'Grade 1', stream: 'Blue', education_level: 'Lower Primary' },
  'cls_g2_b': { class_name: 'Grade 2', stream: 'Blue', education_level: 'Lower Primary' },
  'cls_g3_b': { class_name: 'Grade 3', stream: 'Blue', education_level: 'Lower Primary' },
  'cls_g4_b': { class_name: 'Grade 4', stream: 'Blue', education_level: 'Upper Primary' },
  'cls_g5_b': { class_name: 'Grade 5', stream: 'Blue', education_level: 'Upper Primary' },
  'cls_g5_r': { class_name: 'Grade 5', stream: 'Red', education_level: 'Upper Primary' },
  'cls_g6_b': { class_name: 'Grade 6', stream: 'Blue', education_level: 'Upper Primary' },
  'cls_7e': { class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
  'cls_7w': { class_name: 'Grade 7', stream: 'West', education_level: 'Junior School' },
  'cls_8e': { class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
  'cls_8w': { class_name: 'Grade 8', stream: 'West', education_level: 'Junior School' },
  'cls_9a': { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
  'cls_grade9': { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
  'cls_grade9_alpha': { class_name: 'Grade 9', stream: 'Alpha', education_level: 'Junior School' },
};

const SUBJECT_SEED_MAP: Record<string, { subject_name: string; subject_code: string; education_level: string }> = {
  'sb_pp_lang': { subject_name: 'Language Activities', subject_code: 'LANG ACT', education_level: 'Pre-Primary' },
  'sb_pp_math': { subject_name: 'Mathematical Activities', subject_code: 'MATH ACT', education_level: 'Pre-Primary' },
  'sb_pp_env': { subject_name: 'Environmental Activities', subject_code: 'ENV ACT', education_level: 'Pre-Primary' },
  'sb_pp_psy': { subject_name: 'Psychomotor & Creative Activities', subject_code: 'PSYCH ACT', education_level: 'Pre-Primary' },
  'sb_pp_re': { subject_name: 'Christian Religious Education', subject_code: 'CRE', education_level: 'Pre-Primary' },
  'sb_lp_eng': { subject_name: 'English Language Activities', subject_code: 'ENG LP', education_level: 'Lower Primary' },
  'sb_lp_kis': { subject_name: 'Kiswahili Language Activities', subject_code: 'KIS LP', education_level: 'Lower Primary' },
  'sb_lp_mat': { subject_name: 'Mathematical Activities', subject_code: 'MAT LP', education_level: 'Lower Primary' },
  'sb_lp_env': { subject_name: 'Environmental Activities', subject_code: 'ENV LP', education_level: 'Lower Primary' },
  'sb_lp_hng': { subject_name: 'Hygiene and Nutrition', subject_code: 'HNG LP', education_level: 'Lower Primary' },
  'sb_lp_crt': { subject_name: 'Creative Activities', subject_code: 'CREAT LP', education_level: 'Lower Primary' },
  'sb_lp_re': { subject_name: 'Christian Religious Education', subject_code: 'CRE', education_level: 'Lower Primary' },
  'sb_up_eng': { subject_name: 'English Language', subject_code: 'ENG UP', education_level: 'Upper Primary' },
  'sb_up_kis': { subject_name: 'Kiswahili Language', subject_code: 'KIS UP', education_level: 'Upper Primary' },
  'sb_up_mat': { subject_name: 'Mathematics', subject_code: 'MAT UP', education_level: 'Upper Primary' },
  'sb_up_sci': { subject_name: 'Science and Technology', subject_code: 'SCI UP', education_level: 'Upper Primary' },
  'sb_up_agr': { subject_name: 'Agriculture & Nutrition', subject_code: 'AGR UP', education_level: 'Upper Primary' },
  'sb_up_sst': { subject_name: 'Social Studies', subject_code: 'SST UP', education_level: 'Upper Primary' },
  'sb_up_crt': { subject_name: 'Creative Arts', subject_code: 'CREAT UP', education_level: 'Upper Primary' },
  'sb_up_re': { subject_name: 'Christian Religious Education', subject_code: 'CRE', education_level: 'Upper Primary' },
  'sb_eng': { subject_name: 'English', subject_code: 'ENG', education_level: 'Junior School' },
  'sb_kis': { subject_name: 'Kiswahili', subject_code: 'KIS', education_level: 'Junior School' },
  'sb_mat': { subject_name: 'Mathematics', subject_code: 'MAT', education_level: 'Junior School' },
  'sb_sci': { subject_name: 'Integrated Science', subject_code: 'SCI', education_level: 'Junior School' },
  'sb_cas': { subject_name: 'Creative Arts and Sports', subject_code: 'CAS', education_level: 'Junior School' },
  'sb_sst': { subject_name: 'Social Studies', subject_code: 'SST', education_level: 'Junior School' },
  'sb_cre': { subject_name: 'Christian Religious Education', subject_code: 'CRE', education_level: 'Junior School' },
  'sb_agn': { subject_name: 'Agriculture and Nutrition', subject_code: 'AGN', education_level: 'Junior School' },
  'sb_pts': { subject_name: 'Pre-Technical Studies', subject_code: 'PRE TECH', education_level: 'Junior School' },
  'sb_hed': { subject_name: 'Health Education', subject_code: 'HED', education_level: 'Junior School' },
  'sb_bst': { subject_name: 'Business Studies', subject_code: 'BST', education_level: 'Junior School' },
  'sb_cs': { subject_name: 'Computer Science', subject_code: 'CS', education_level: 'Junior School' },
};

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

async function resolveAllocationUUIDs(supabaseAdmin: any, alloc: any) {
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
    const seedMeta = typeof rawClassId === 'string' ? CLASS_STREAM_SEED_MAP[rawClassId] : undefined;
    let className = alloc.class_name || seedMeta?.class_name;
    let streamName = alloc.stream || alloc.stream_name || seedMeta?.stream;

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

  // 2. Resolve Subject
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
    const seedSbMeta = typeof rawSubjectId === 'string' ? SUBJECT_SEED_MAP[rawSubjectId] : undefined;
    const subjectCode = (alloc.subject_code || seedSbMeta?.subject_code || '').trim();
    const subjectName = (alloc.subject_name || seedSbMeta?.subject_name || (typeof rawSubjectId === 'string' && !rawSubjectId.startsWith('sb_') ? rawSubjectId : '')).trim();
    let eduLevel = (alloc.education_level || seedSbMeta?.education_level || alloc.class_name || '').trim();

    if (!eduLevel && resolvedClassId) {
      const { data: clsInfo } = await supabaseAdmin.from('classes').select('class_name').eq('id', resolvedClassId).maybeSingle();
      if (clsInfo?.class_name) {
        eduLevel = clsInfo.class_name;
      }
    }

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

  return {
    class_id: resolvedClassId,
    stream_id: resolvedStreamId,
    subject_id: resolvedSubjectId
  };
}

/**
 * Safely resolves a Supabase Auth user by email or metadata across all paginated pages.
 * Enforces:
 * 1. Complete paginated traversal (never stops at page 1).
 * 2. Exact case-insensitive normalized email comparison.
 * 3. Strict ambiguity detection:
 *    - 0 matches -> { user: null, totalMatches: 0 }
 *    - 1 match -> { user: matchingUser, totalMatches: 1 }
 *    - 2+ matches -> { user: null, totalMatches: N, error: '...' } (never guesses or picks arbitrarily)
 */
async function findAuthUserByEmailAcrossPages(
  supabaseAdminClient: any,
  targetEmail: string,
  extraFilter?: (user: any) => boolean,
  options?: { perPage?: number; maxPages?: number }
): Promise<{ user: any | null; totalMatches: number; error?: string }> {
  if (!targetEmail && !extraFilter) {
    return { user: null, totalMatches: 0 };
  }

  const normalizedEmail = targetEmail ? targetEmail.trim().toLowerCase() : '';
  const matchingUsers: any[] = [];
  let page = 1;
  const perPage = options?.perPage || 1000;
  const MAX_PAGES = options?.maxPages || 50; // Safety safeguard: supports up to 50,000 Auth accounts

  while (page <= MAX_PAGES) {
    const { data, error } = await supabaseAdminClient.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      console.warn(`[findAuthUserByEmailAcrossPages] Error listing Auth users on page ${page}:`, error);
      return { user: null, totalMatches: 0, error: error.message };
    }

    const users = data?.users || [];
    if (!Array.isArray(users) || users.length === 0) {
      break;
    }

    for (const u of users) {
      const emailMatch = normalizedEmail && u.email && u.email.trim().toLowerCase() === normalizedEmail;
      const customMatch = extraFilter ? Boolean(extraFilter(u)) : false;
      if (emailMatch || customMatch) {
        if (!matchingUsers.some(m => m.id === u.id)) {
          matchingUsers.push(u);
        }
      }
    }

    if (users.length < perPage) {
      break;
    }

    page++;
  }

  if (matchingUsers.length === 0) {
    return { user: null, totalMatches: 0 };
  }

  if (matchingUsers.length === 1) {
    return { user: matchingUsers[0], totalMatches: 1 };
  }

  return {
    user: null,
    totalMatches: matchingUsers.length,
    error: `Ambiguous match: Found ${matchingUsers.length} Auth accounts matching "${targetEmail}". Aborting operation to prevent modifying or deleting the wrong account.`
  };
}

export interface AuthenticatedAdminContext {
  authenticatedUserId: string;
  adminUser: { id: string; role: string; email?: string };
  authUserData: NonNullable<Awaited<ReturnType<SupabaseClient['auth']['getUser']>>['data']>;
  token: string;
}

/**
 * Centrally authenticates an administrative caller and validates that their account
 * in public.users has role === 'admin'.
 * 
 * Order of operations:
 * 1. Extract Bearer token from headers (authorization / Authorization), body.token, or query.token.
 * 2. Validate token cryptographically with Supabase Auth (supabaseAdmin.auth.getUser(token)).
 * 3. Retrieve authoritative user record from public.users by authenticated user ID (or email fallback).
 * 4. Verify public.users.role === 'admin'.
 * 
 * Returns AuthenticatedAdminContext on success, or returns null and sends 401/403 HTTP response on failure.
 */
export async function authenticateAdminCaller(
  req: express.Request,
  res: express.Response,
  supabaseAdmin: SupabaseClient,
  forbiddenMessage = "Forbidden: Only administrators can perform this action."
): Promise<AuthenticatedAdminContext | null> {
  // 1. Extract authentication token
  let token: string | null = null;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.body && typeof req.body.token === 'string' && req.body.token.trim()) {
    token = req.body.token.trim();
  } else if (req.query && typeof req.query.token === 'string' && (req.query.token as string).trim()) {
    token = (req.query.token as string).trim();
  }

  if (!token) {
    res.status(401).json({ error: "Unauthorized: Missing authentication token." });
    return null;
  }

  // 2. Verify authentication token via Supabase Auth
  const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
  if (tokenError || !authUserData || !authUserData.user) {
    res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
    return null;
  }

  const authenticatedUserId = authUserData.user.id;

  // 3. Look up authoritative user record in public.users
  let adminUser: { id: string; role: string; email?: string } | null = null;
  const { data: userById } = await supabaseAdmin
    .from('users')
    .select('id, role, email')
    .eq('id', authenticatedUserId)
    .maybeSingle();

  if (userById) {
    adminUser = userById;
  } else if (authUserData.user.email) {
    const { data: userByEmail } = await supabaseAdmin
      .from('users')
      .select('id, role, email')
      .eq('email', authUserData.user.email.toLowerCase())
      .maybeSingle();
    if (userByEmail) adminUser = userByEmail;
  }

  if (!adminUser) {
    res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
    return null;
  }

  if (adminUser.role !== 'admin') {
    res.status(403).json({ error: forbiddenMessage });
    return null;
  }

  return {
    authenticatedUserId,
    adminUser,
    authUserData,
    token
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Helper function to validate permitted origins for CORS requests
  const isOriginAllowed = (origin: string, reqHost?: string): boolean => {
    if (!origin) return false;

    // 1. Static Allowed Origins (Mobile Capacitor & Local Development)
    const staticAllowed = new Set([
      "https://localhost",       // Capacitor Android (androidScheme: 'https')
      "capacitor://localhost",   // Capacitor iOS
      "http://localhost",        // Capacitor / WebView localhost fallback
      "http://localhost:3000",   // Local Web Express server
      "http://127.0.0.1:3000",   // Local loopback Express server
      "http://localhost:5173",   // Local Vite development server
      "http://127.0.0.1:5173",   // Local loopback Vite development server
    ]);

    if (staticAllowed.has(origin)) {
      return true;
    }

    // 2. Exact match against the incoming request Host header (same-origin / direct host request)
    if (reqHost) {
      const cleanHost = reqHost.trim().toLowerCase();
      if (origin.toLowerCase() === `https://${cleanHost}` || origin.toLowerCase() === `http://${cleanHost}`) {
        return true;
      }
    }

    // 3. Configured Application Origins (process.env.APP_URL, process.env.VITE_API_BASE_URL, process.env.ALLOWED_ORIGINS)
    const allowedEnvOrigins = new Set<string>();

    if (process.env.APP_URL) {
      try {
        const appOrigin = new URL(process.env.APP_URL).origin;
        allowedEnvOrigins.add(appOrigin);
        // If APP_URL is an AI Studio dev URL (ais-dev-...), also allow the corresponding shared preview URL (ais-pre-...) and vice-versa
        if (appOrigin.includes('ais-dev-')) {
          allowedEnvOrigins.add(appOrigin.replace('ais-dev-', 'ais-pre-'));
        } else if (appOrigin.includes('ais-pre-')) {
          allowedEnvOrigins.add(appOrigin.replace('ais-pre-', 'ais-dev-'));
        }
      } catch {
        // Ignore invalid URL format
      }
    }

    if (process.env.VITE_API_BASE_URL) {
      try {
        const apiOrigin = new URL(process.env.VITE_API_BASE_URL).origin;
        allowedEnvOrigins.add(apiOrigin);
        if (apiOrigin.includes('ais-dev-')) {
          allowedEnvOrigins.add(apiOrigin.replace('ais-dev-', 'ais-pre-'));
        } else if (apiOrigin.includes('ais-pre-')) {
          allowedEnvOrigins.add(apiOrigin.replace('ais-pre-', 'ais-dev-'));
        }
      } catch {
        // Ignore invalid URL format
      }
    }

    // Support explicit comma-separated allowed origins from environment
    const customAllowedEnv = process.env.ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS;
    if (customAllowedEnv) {
      customAllowedEnv.split(',').forEach((item) => {
        const trimmed = item.trim();
        if (trimmed) {
          try {
            allowedEnvOrigins.add(new URL(trimmed).origin);
          } catch {
            allowedEnvOrigins.add(trimmed);
          }
        }
      });
    }

    if (allowedEnvOrigins.has(origin)) {
      return true;
    }

    return false;
  };

  // Controlled Cross-Origin Resource Sharing (CORS) Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (!origin) {
      // Non-browser / server-to-server / health check requests
      return next();
    }

    const reqHost = req.headers.host;
    if (isOriginAllowed(origin, reqHost)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
      res.setHeader("Vary", "Origin");

      if (req.method === "OPTIONS") {
        return res.sendStatus(204);
      }
      return next();
    }

    // Untrusted Origin: Reject preflight OPTIONS immediately; omit Allow-Origin header for standard requests
    if (req.method === "OPTIONS") {
      return res.status(403).json({ error: "CORS policy: Origin not allowed." });
    }

    next();
  });

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Automatic Academic Year Rollover check on startup / request
  app.use(async (req, res, next) => {
    try {
      // Execute non-blocking rollover check
      checkAndPerformAcademicYearRollover().catch(err => {
        console.error("[Startup Rollover Warning] Failed to run automatic academic year rollover:", err);
      });
    } catch (err) {
      // Never block incoming HTTP requests
    }
    next();
  });

  // Endpoint to manually force/trigger academic year rollover for administrator testing/actions
  app.post("/api/admin/force-rollover", async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const adminAuth = await authenticateAdminCaller(req, res, supabaseAdmin, "Forbidden: Only administrators can trigger academic year rollover.");
    if (!adminAuth) return;

    try {
      const result = await checkAndPerformAcademicYearRollover(true);
      if (result.success) {
        return res.json({ success: true, message: result.message });
      } else {
        return res.status(500).json({ error: result.message });
      }
    } catch (err: any) {
      console.error("[Force Rollover Error] Force rollover endpoint failed:", err);
      return res.status(500).json({ error: `Failed to execute force rollover: ${err.message}` });
    }
  });

  // Public Client Configuration endpoint for mobile/client auth initialization (NEVER exposes service role key)
  app.get("/api/auth/config", (req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    res.json({
      supabaseUrl,
      supabaseAnonKey,
    });
  });

  app.post("/api/admin/create-teacher", async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { 
        adminId, 
        role, 
        name, 
        email, 
        phone, 
        tsc_number, 
        username, 
        status, 
        temporary_password,
        force_password_change,
        is_class_teacher,
        class_teacher_of_id
      } = req.body;

      // Map role to canonical database value ('admin' | 'class_teacher' | 'subject_teacher')
      const canonicalizeRole = (roleInput: string | null | undefined): 'admin' | 'class_teacher' | 'subject_teacher' => {
        if (!roleInput || typeof roleInput !== 'string') return 'class_teacher';
        const cleaned = roleInput.trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (cleaned === 'admin' || cleaned === 'administrator') return 'admin';
        if (cleaned === 'class_teacher' || cleaned === 'classteacher' || cleaned === 'class') return 'class_teacher';
        if (cleaned === 'subject_teacher' || cleaned === 'subjectteacher' || cleaned === 'subject') return 'subject_teacher';
        return 'class_teacher';
      };

      const dbRole = canonicalizeRole(role);
      const computedIsClassTeacher = typeof is_class_teacher === 'boolean' ? is_class_teacher : (dbRole === 'class_teacher');

      // Extract authentication token and verify administrator authority
      const adminAuth = await authenticateAdminCaller(
        req,
        res,
        supabaseAdmin,
        "Forbidden: Only administrators can create accounts."
      );
      if (!adminAuth) return;

      // Validate class teacher intent and target stream BEFORE creating auth user or database records
      let targetStream: { id: string; class_id: string; stream_name: string; class_teacher_id: string | null } | null = null;

      if (computedIsClassTeacher) {
        if (!class_teacher_of_id || typeof class_teacher_of_id !== 'string' || !isUUID(class_teacher_of_id)) {
          return res.status(400).json({
            error: "Invalid class_teacher_of_id: A valid stream UUID is required when creating a class teacher."
          });
        }

        const { data: strmData, error: strmErr } = await supabaseAdmin
          .from('streams')
          .select('id, class_id, stream_name, class_teacher_id')
          .eq('id', class_teacher_of_id)
          .maybeSingle();

        if (strmErr) {
          return res.status(500).json({ error: `Database error verifying stream: ${strmErr.message}` });
        }

        if (!strmData) {
          // Explicitly check if the ID belongs to a parent class
          const { data: classCheck } = await supabaseAdmin
            .from('classes')
            .select('id, class_name')
            .eq('id', class_teacher_of_id)
            .maybeSingle();

          if (classCheck) {
            return res.status(400).json({
              error: `Invalid stream ID: The provided ID belongs to parent class "${classCheck.class_name}", not a stream. Class teachers must be assigned to a specific stream.`
            });
          }

          return res.status(404).json({ error: "Stream not found in database." });
        }

        targetStream = strmData;
      }

      // 1. Create account in Supabase Auth securely
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: temporary_password,
        email_confirm: true,
        user_metadata: {
          role: dbRole,
          name: name,
          phone: phone,
          tsc_number: tsc_number,
          username: username,
          status: status,
          force_password_change: force_password_change,
        }
      });

      if (authError) {
        if (authError.message.includes('User already registered') || authError.message.includes('already exists') || authError.message.includes('already been registered')) {
            return res.status(400).json({ error: 'A user account with this email address has already been registered.' });
        }
        return res.status(400).json({ error: authError.message });
      }

      const authUserId = authData.user.id;

      // 2. Create the users record FIRST (because teachers.user_id references users.id)
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .insert([{
          id: authUserId, // Matches the auth user ID
          name: name,
          email: email,
          role: dbRole,
          teacher_id: null,
          student_id: null
        }])
        .select()
        .single();

      if (userError) {
        console.error('Database user creation error:', userError);
        // Rollback
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        if (userError.message && userError.message.includes('users_role_check')) {
          return res.status(400).json({ error: 'Failed to create user account: Invalid role specified. Please select a valid role (Class Teacher, Subject Teacher, or Administrator).' });
        }
        return res.status(400).json({ error: `Failed to create application user: ${userError.message}` });
      }

      // Restore the frontend role so the UI behaves correctly
      userData.role = dbRole;

      // 3. Create or link the teacher profile
      const { data: existingTeacher } = await supabaseAdmin
        .from('teachers')
        .select('*')
        .ilike('email', email.trim().toLowerCase())
        .maybeSingle();

      let teacherData: any = null;
      let isExistingTeacher = false;

      if (existingTeacher) {
        isExistingTeacher = true;
        // Safe Administrative Repair Path: Link existing teacher profile to the new Supabase Auth user_id
        const { data: updatedTeacher, error: updateTErr } = await supabaseAdmin
          .from('teachers')
          .update({
            user_id: authUserId,
            teacher_name: name || existingTeacher.teacher_name,
            phone: phone || existingTeacher.phone,
            tsc_number: tsc_number || existingTeacher.tsc_number,
            is_class_teacher: computedIsClassTeacher
          })
          .eq('id', existingTeacher.id)
          .select()
          .single();

        if (updateTErr) {
          console.error('Database teacher profile update/link error:', updateTErr);
          // Rollback users and auth
          await supabaseAdmin.from('users').delete().eq('id', authUserId);
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          return res.status(400).json({ error: `Failed to link teacher profile: ${updateTErr.message}` });
        }
        teacherData = updatedTeacher;
      } else {
        // Insert new teacher profile (letting PostgreSQL/Supabase generate the teacher UUID)
        const { data: newTeacher, error: teacherError } = await supabaseAdmin
          .from('teachers')
          .insert([{
            user_id: authUserId,
            teacher_name: name,
            tsc_number: tsc_number || null,
            phone: phone || null,
            email: email,
            is_class_teacher: computedIsClassTeacher
          }])
          .select()
          .single();

        if (teacherError) {
          console.error('Database teacher profile creation error:', teacherError);
          // Rollback users and auth
          await supabaseAdmin.from('users').delete().eq('id', authUserId);
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          return res.status(400).json({ error: `Failed to create teacher profile: ${teacherError.message}` });
        }
        teacherData = newTeacher;
      }

      // 4. Update the users record with teacher_id
      await supabaseAdmin
        .from('users')
        .update({ teacher_id: teacherData.id })
        .eq('id', authUserId);
      
      userData.teacher_id = teacherData.id;

      // 4b. Assign target stream with strict zero-row verification
      if (computedIsClassTeacher && targetStream) {
        const { data: updatedStreamRows, error: streamUpdErr } = await supabaseAdmin
          .from('streams')
          .update({ class_teacher_id: teacherData.id })
          .eq('id', targetStream.id)
          .select('id, class_teacher_id');

        if (streamUpdErr || !updatedStreamRows || updatedStreamRows.length !== 1) {
          console.error('Failed to assign target stream during teacher creation:', streamUpdErr);
          // Rollback created/updated teacher profile, user record, and auth account to prevent orphaned state
          if (isExistingTeacher) {
            await supabaseAdmin.from('teachers').update({ user_id: null, is_class_teacher: false }).eq('id', teacherData.id);
          } else {
            await supabaseAdmin.from('teachers').delete().eq('id', teacherData.id);
          }
          await supabaseAdmin.from('users').delete().eq('id', authUserId);
          await supabaseAdmin.auth.admin.deleteUser(authUserId);

          return res.status(500).json({
            error: `Database update failed: Zero rows affected on target stream (${streamUpdErr?.message || 'Zero rows updated'}).`
          });
        }

        // Reconcile displaced teacher if target stream had a previous class teacher
        const previousTeacherIdOnTargetStream = targetStream.class_teacher_id;
        if (previousTeacherIdOnTargetStream && previousTeacherIdOnTargetStream !== teacherData.id) {
          const { data: remainingAssignedStreams } = await supabaseAdmin
            .from('streams')
            .select('id')
            .eq('class_teacher_id', previousTeacherIdOnTargetStream);

          if (!remainingAssignedStreams || remainingAssignedStreams.length === 0) {
            await supabaseAdmin
              .from('teachers')
              .update({ is_class_teacher: false })
              .eq('id', previousTeacherIdOnTargetStream);

            const { data: displacedTeacher } = await supabaseAdmin
              .from('teachers')
              .select('id, email')
              .eq('id', previousTeacherIdOnTargetStream)
              .maybeSingle();

            const displacedEmail = displacedTeacher?.email ? displacedTeacher.email.trim().toLowerCase() : '';
            if (displacedEmail) {
              await supabaseAdmin
                .from('users')
                .update({ role: 'subject_teacher' })
                .neq('role', 'admin')
                .or(`teacher_id.eq.${previousTeacherIdOnTargetStream},email.eq.${displacedEmail}`);
            } else {
              await supabaseAdmin
                .from('users')
                .update({ role: 'subject_teacher' })
                .neq('role', 'admin')
                .eq('teacher_id', previousTeacherIdOnTargetStream);
            }
          }
        }
      }

      // 5. Create allocations with verified database UUIDs
      const allocations = req.body.allocations || [];
      if (allocations.length > 0) {
        const allocationInserts = [];
        for (const alloc of allocations) {
          try {
            const resolved = await resolveAllocationUUIDs(supabaseAdmin, alloc);
            const item: any = {
              teacher_id: teacherData.id,
              subject_id: resolved.subject_id
            };
            if (resolved.class_id) item.class_id = resolved.class_id;
            if (resolved.stream_id) item.stream_id = resolved.stream_id;
            allocationInserts.push(item);
          } catch (resErr: any) {
            console.error(`Allocation resolution failed for alloc:`, alloc, resErr.message);
            // Roll back created/updated teacher profile, user record, auth account, and stream assignment
            if (computedIsClassTeacher && targetStream) {
              await supabaseAdmin.from('streams').update({ class_teacher_id: targetStream.class_teacher_id || null }).eq('id', targetStream.id);
            }
            if (isExistingTeacher) {
              await supabaseAdmin.from('teachers').update({ user_id: null, is_class_teacher: false }).eq('id', teacherData.id);
            } else {
              await supabaseAdmin.from('teachers').delete().eq('id', teacherData.id);
            }
            await supabaseAdmin.from('users').delete().eq('id', authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            return res.status(400).json({
              error: `Teacher allocation could not be created: ${resErr.message}`
            });
          }
        }

        if (allocationInserts.length > 0) {
          const { error: allocError } = await supabaseAdmin
            .from('teacher_subjects')
            .insert(allocationInserts);

          if (allocError) {
            console.error('Failed to create teacher allocations in teacher_subjects:', allocError);
            // Roll back created/updated teacher profile, user record, auth account, and stream assignment
            if (computedIsClassTeacher && targetStream) {
              await supabaseAdmin.from('streams').update({ class_teacher_id: targetStream.class_teacher_id || null }).eq('id', targetStream.id);
            }
            if (isExistingTeacher) {
              await supabaseAdmin.from('teachers').update({ user_id: null, is_class_teacher: false }).eq('id', teacherData.id);
            } else {
              await supabaseAdmin.from('teachers').delete().eq('id', teacherData.id);
            }
            await supabaseAdmin.from('users').delete().eq('id', authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            return res.status(400).json({
              error: `Failed to save teacher allocations: ${allocError.message}`
            });
          }
        }
      }

      return res.status(200).json({
        user: userData,
        teacher: teacherData
      });

    } catch (err: any) {
      console.error('Error in /api/admin/create-teacher:', err);
      return res.status(500).json({ error: 'Internal server error during account creation.' });
    }
  });

  // Admin Create & Provision Learner Handler
  app.post("/api/admin/create-learner", async (req, res) => {
    let createdStudentId: string | null = null;
    let authUserId: string | null = null;

    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // 1. Authenticate caller (Authorization: Bearer <JWT> or body.token)
      const adminAuth = await authenticateAdminCaller(
        req,
        res,
        supabaseAdmin,
        "Forbidden: Only administrators can provision learner accounts."
      );
      if (!adminAuth) return;
      const { adminUser, authUserData } = adminAuth;

      // 2. Validate student payload
      const studentInput = req.body.student || req.body;
      const customPassword = req.body.password;

      if (!studentInput || typeof studentInput !== 'object') {
        return res.status(400).json({ error: "Invalid request payload: student object is required." });
      }

      const firstName = (studentInput.first_name || '').trim();
      const lastName = (studentInput.last_name || '').trim();
      const secondName = (studentInput.second_name || '').trim();
      const rawAdmissionNumber = (studentInput.admission_number || '').trim();
      const rawGender = (studentInput.gender || 'M').toString().trim();
      const dob = studentInput.dob ? String(studentInput.dob).trim() : null;

      if (!rawAdmissionNumber) {
        return res.status(400).json({ error: "Admission number is required." });
      }

      const normalizedAdm = rawAdmissionNumber.toUpperCase();

      let fullName = studentInput.full_name ? String(studentInput.full_name).trim() : '';
      if (!fullName) {
        if (!firstName && !lastName) {
          return res.status(400).json({ error: "Learner name (first and last name) is required." });
        }
        fullName = `${firstName}${secondName ? ' ' + secondName : ''} ${lastName}`.trim();
      }

      const canonicalGender: 'M' | 'F' = (rawGender === 'M' || rawGender.toLowerCase() === 'boy' || rawGender.toLowerCase() === 'male') ? 'M' : 'F';

      // 3. Pre-check admission number uniqueness (case-insensitive)
      const { data: existingStudent, error: checkError } = await supabaseAdmin
        .from('students')
        .select('id, admission_number')
        .ilike('admission_number', normalizedAdm)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking student admission number uniqueness:', checkError);
        return res.status(500).json({ error: `Database error verifying admission number: ${checkError.message}` });
      }

      if (existingStudent) {
        return res.status(409).json({
          error: `Admission number "${normalizedAdm}" already exists in the student directory.`
        });
      }

      // 4. Resolve class_id and stream_id
      let targetClassId: string | null = null;
      let targetStreamId: string | null = null;

      if (isUUID(studentInput.stream_id)) {
        const { data: strmMatch } = await supabaseAdmin
          .from('streams')
          .select('id, class_id')
          .eq('id', studentInput.stream_id)
          .maybeSingle();
        if (strmMatch) {
          targetStreamId = strmMatch.id;
          targetClassId = strmMatch.class_id;
        }
      }

      if (!targetClassId && isUUID(studentInput.class_id)) {
        const { data: clsMatch } = await supabaseAdmin
          .from('classes')
          .select('id')
          .eq('id', studentInput.class_id)
          .maybeSingle();
        if (clsMatch) {
          targetClassId = clsMatch.id;
          if (!targetStreamId) {
            const { data: defStream } = await supabaseAdmin
              .from('streams')
              .select('id')
              .eq('class_id', clsMatch.id)
              .limit(1);
            if (defStream && defStream.length > 0) {
              targetStreamId = defStream[0].id;
            }
          }
        }
      }

      // If not resolved by direct UUID, fallback to lookup default class/stream
      if (!targetClassId) {
        const { data: defaultClasses } = await supabaseAdmin
          .from('classes')
          .select('id')
          .limit(1);
        if (defaultClasses && defaultClasses.length > 0) {
          targetClassId = defaultClasses[0].id;
          const { data: defStream } = await supabaseAdmin
            .from('streams')
            .select('id')
            .eq('class_id', targetClassId)
            .limit(1);
          if (defStream && defStream.length > 0) {
            targetStreamId = defStream[0].id;
          }
        }
      }

      // 5. Derive canonical email
      const cleanEmailPrefix = normalizedAdm.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const canonicalEmail = `${cleanEmailPrefix}@learner.cbe.ac.ke`;

      // 6. Determine initial password and status
      const initialPassword = (typeof customPassword === 'string' && customPassword.trim().length >= 6)
        ? customPassword.trim()
        : 'Learner@2026';

      const rawEnrolmentStatus = studentInput.enrolment_status;
      const computedEnrolmentStatus: 'future' | 'active' | 'inactive' = 
        (rawEnrolmentStatus === 'future' || rawEnrolmentStatus === 'inactive' || rawEnrolmentStatus === 'active')
          ? rawEnrolmentStatus
          : (studentInput.active === false ? 'inactive' : 'active');
      const computedActive = computedEnrolmentStatus === 'active';

      // 7. Step A: Insert into public.students
      const studentPayload: any = {
        admission_number: normalizedAdm,
        full_name: fullName,
        gender: canonicalGender,
        class_id: targetClassId,
        stream_id: targetStreamId,
        dob: dob || null,
        active: computedActive
      };

      const { data: createdStudent, error: createStudentErr } = await supabaseAdmin
        .from('students')
        .insert([studentPayload])
        .select()
        .single();

      if (createStudentErr || !createdStudent) {
        console.error('Failed to insert student record:', createStudentErr);
        if (createStudentErr?.code === '23505') {
          return res.status(409).json({ error: `Admission number "${normalizedAdm}" already exists.` });
        }
        return res.status(400).json({ error: `Failed to create student record: ${createStudentErr?.message || 'Unknown database error'}` });
      }

      createdStudentId = createdStudent.id;

      // 8. Step B: Create Auth Account in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: canonicalEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          role: 'learner',
          name: fullName,
          student_id: createdStudentId,
          admission_number: normalizedAdm,
          enrolment_status: computedEnrolmentStatus,
          active: computedActive,
          status: computedActive ? 'Active' : 'Disabled'
        }
      });

      if (authError || !authData || !authData.user) {
        console.error('Failed to create Supabase Auth account for learner:', authError);
        // Compensating rollback: delete student record
        await supabaseAdmin.from('students').delete().eq('id', createdStudentId);
        createdStudentId = null;

        if (authError?.message?.includes('User already registered') || authError?.message?.includes('already been registered')) {
          return res.status(409).json({ error: `An authentication account with email "${canonicalEmail}" already exists.` });
        }
        return res.status(400).json({ error: `Failed to provision Auth credentials: ${authError?.message || 'Unknown Auth error'}` });
      }

      authUserId = authData.user.id;

      // 9. Step C: Create public.users profile
      const { data: userProfile, error: userProfileErr } = await supabaseAdmin
        .from('users')
        .insert([{
          id: authUserId,
          name: fullName,
          email: canonicalEmail,
          role: 'learner',
          student_id: createdStudentId,
          teacher_id: null
        }])
        .select()
        .single();

      if (userProfileErr || !userProfile) {
        console.error('Failed to create public.users profile for learner:', userProfileErr);
        // Compensating rollback: delete Auth account and delete student record
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        await supabaseAdmin.from('students').delete().eq('id', createdStudentId);
        authUserId = null;
        createdStudentId = null;

        return res.status(400).json({ error: `Failed to create learner user profile: ${userProfileErr?.message || 'Unknown database error'}` });
      }

      // 10. Audit Logging for Learner Creation
      try {
        const actionType = computedEnrolmentStatus === 'future' ? 'LEARNER_REGISTERED_FUTURE' : 'LEARNER_REGISTERED_ACTIVE';
        const admissionDate = studentInput.admission_date || (computedActive ? new Date().toISOString().split('T')[0] : null);
        await supabaseAdmin.from('audit_logs').insert([{
          user_id: adminUser.id,
          user_email: adminUser.email || authUserData.user.email,
          action_type: actionType,
          entity_table: 'students',
          entity_id: createdStudentId,
          details: {
            admission_number: normalizedAdm,
            full_name: fullName,
            class_id: targetClassId,
            stream_id: targetStreamId,
            enrolment_status: computedEnrolmentStatus,
            active: computedActive,
            admission_date: admissionDate,
            auth_user_id: authUserId,
            email: canonicalEmail,
          },
          ip_address: req.ip || (req.headers['x-forwarded-for'] as string) || null,
          created_at: new Date().toISOString()
        }]);
      } catch (auditErr) {
        console.warn('Could not insert audit log for learner registration:', auditErr);
      }

      // 11. Return 201 Created with student, user profile, and credentials
      return res.status(201).json({
        success: true,
        student: createdStudent,
        user: userProfile,
        credentials: {
          admission_number: normalizedAdm,
          email: canonicalEmail,
          initial_password: initialPassword
        }
      });

    } catch (err: any) {
      console.error('Unhandled exception in /api/admin/create-learner:', err);

      // Rollback any partial state
      if (authUserId) {
        try {
          const supabaseUrl = process.env.VITE_SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (supabaseUrl && supabaseServiceKey) {
            const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
            await supabaseAdmin.from('users').delete().eq('id', authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
          }
        } catch (rbErr) {
          console.warn('Rollback authUser error:', rbErr);
        }
      }

      if (createdStudentId) {
        try {
          const supabaseUrl = process.env.VITE_SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (supabaseUrl && supabaseServiceKey) {
            const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
            await supabaseAdmin.from('students').delete().eq('id', createdStudentId);
          }
        } catch (rbErr) {
          console.warn('Rollback student error:', rbErr);
        }
      }

      return res.status(500).json({ error: `Internal server error during learner provisioning: ${err?.message || 'Unknown error'}` });
    }
  });

  // Admin Delete Learner Handler (Phase 6D.6.1)
  const deleteLearnerHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // 1. Authorization: Verify Bearer JWT
      const adminAuth = await authenticateAdminCaller(
        req,
        res,
        supabaseAdmin,
        "Forbidden: Only administrators can delete learner accounts."
      );
      if (!adminAuth) return;

      const { authenticatedUserId, adminUser } = adminAuth;

      // 2. Validate input student_id
      const studentId = req.body?.student_id || req.body?.id || req.body?.studentId;
      if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
        return res.status(400).json({ error: "Invalid request payload: student_id is required." });
      }

      const cleanStudentId = studentId.trim();
      if (!isUUID(cleanStudentId)) {
        return res.status(400).json({ error: "Invalid student UUID format." });
      }

      // 3. Locate student in public.students
      const { data: targetStudent, error: findError } = await supabaseAdmin
        .from('students')
        .select('id, admission_number, full_name, active')
        .eq('id', cleanStudentId)
        .maybeSingle();

      if (findError) {
        console.error('Error finding student in public.students:', findError);
        return res.status(500).json({ error: `Database error querying learner: ${findError.message}` });
      }

      if (!targetStudent) {
        return res.status(404).json({ error: "Learner not found in the student directory." });
      }

      // 4. Academic Record Safety Gate: Count protected academic/history records
      const marksPromise = supabaseAdmin.from('marks').select('id', { count: 'exact', head: true }).eq('student_id', cleanStudentId);
      const attendancePromise = supabaseAdmin.from('attendance').select('id', { count: 'exact', head: true }).eq('student_id', cleanStudentId);
      const reportCardsPromise = supabaseAdmin.from('report_cards').select('id', { count: 'exact', head: true }).eq('student_id', cleanStudentId);
      const meritListsPromise = supabaseAdmin.from('merit_lists').select('id', { count: 'exact', head: true }).eq('student_id', cleanStudentId);

      const [marksRes, attRes, rcRes, mlRes] = await Promise.all([
        marksPromise,
        attendancePromise,
        reportCardsPromise,
        meritListsPromise
      ]);

      const marksCount = marksRes.count || 0;
      const attCount = attRes.count || 0;
      const rcCount = rcRes.count || 0;
      const mlCount = mlRes.count || 0;
      const totalProtectedRecords = marksCount + attCount + rcCount + mlCount;

      if (totalProtectedRecords > 0) {
        return res.status(409).json({
          error: `Cannot permanently delete learner "${targetStudent.full_name}" (${targetStudent.admission_number}) because ${totalProtectedRecords} protected academic/history record(s) exist (${marksCount} mark(s), ${attCount} attendance, ${rcCount} report card(s), ${mlCount} merit list(s)). To preserve academic history, please Deactivate or Archive the learner instead.`,
          blocked: true,
          academic_records_count: totalProtectedRecords,
          details: {
            marks_count: marksCount,
            attendance_count: attCount,
            report_cards_count: rcCount,
            merit_lists_count: mlCount
          }
        });
      }

      // 5. Identity Discovery: Find associated learner profile in public.users
      let { data: learnerUserProfile, error: userFindErr } = await supabaseAdmin
        .from('users')
        .select('id, email, role, student_id, teacher_id')
        .eq('student_id', cleanStudentId)
        .maybeSingle();

      if (userFindErr) {
        console.error('Error querying learner profile in public.users:', userFindErr);
        return res.status(500).json({ error: `Database error querying learner user profile: ${userFindErr.message}` });
      }

      // Secondary DB Check: Check by canonical email in public.users if not found by student_id
      if (!learnerUserProfile && targetStudent.admission_number) {
        const cleanEmailPrefix = targetStudent.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const canonicalEmail = `${cleanEmailPrefix}@learner.cbe.ac.ke`;
        const { data: uByEmail, error: uByEmailErr } = await supabaseAdmin
          .from('users')
          .select('id, email, role, student_id, teacher_id')
          .ilike('email', canonicalEmail)
          .maybeSingle();
        if (!uByEmailErr && uByEmail) {
          learnerUserProfile = uByEmail;
        }
      }

      let authUserIdToDelete: string | null = null;
      if (learnerUserProfile) {
        // Critical Safety Invariant Checks
        if (learnerUserProfile.role !== 'learner') {
          return res.status(500).json({
            error: `Integrity check failed: Associated user profile ${learnerUserProfile.id} does not have learner role (found role: "${learnerUserProfile.role}"). Deletion aborted for security.`
          });
        }
        if (learnerUserProfile.id === adminUser.id || learnerUserProfile.id === authenticatedUserId) {
          return res.status(500).json({
            error: "Integrity check failed: Attempted to delete the calling administrator account. Deletion aborted."
          });
        }
        if (learnerUserProfile.teacher_id !== null) {
          return res.status(500).json({
            error: "Integrity check failed: User profile is associated with a teacher record. Deletion aborted."
          });
        }
        authUserIdToDelete = learnerUserProfile.id;
      }

      // If no public.users profile found, attempt deterministic orphan recovery across all pages of auth.users
      if (!authUserIdToDelete && targetStudent.admission_number) {
        const cleanEmailPrefix = targetStudent.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const canonicalEmail = `${cleanEmailPrefix}@learner.cbe.ac.ke`;
        try {
          const lookupRes = await findAuthUserByEmailAcrossPages(
            supabaseAdmin,
            canonicalEmail,
            (u: any) =>
              u.user_metadata?.student_id === cleanStudentId ||
              (u.user_metadata?.role === 'learner' && u.user_metadata?.admission_number === targetStudent.admission_number)
          );

          if (lookupRes.error) {
            console.error('[deleteLearnerHandler] Auth lookup ambiguity error:', lookupRes.error);
            return res.status(500).json({ error: `Auth account resolution failed: ${lookupRes.error}` });
          }

          if (lookupRes.user) {
            if (lookupRes.user.id === adminUser.id || lookupRes.user.id === authenticatedUserId) {
              return res.status(500).json({
                error: "Integrity check failed: Resolved Auth account matches calling administrator. Deletion aborted."
              });
            }
            authUserIdToDelete = lookupRes.user.id;
          }
        } catch (e) {
          console.warn('Could not query auth.users by email prefix across pages:', e);
        }
      }

      // 6. Safe Database Cleanup (public.users + public.students)
      if (learnerUserProfile) {
        const { error: delUserErr } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', learnerUserProfile.id)
          .eq('role', 'learner');

        if (delUserErr) {
          console.error('Error deleting learner profile from public.users:', delUserErr);
          return res.status(500).json({ error: `Failed to delete learner user profile from database: ${delUserErr.message}` });
        }
      }

      const { error: delStudentErr } = await supabaseAdmin
        .from('students')
        .delete()
        .eq('id', cleanStudentId);

      if (delStudentErr) {
        console.error('Error deleting student from public.students:', delStudentErr);
        return res.status(500).json({ error: `Failed to delete student record from database: ${delStudentErr.message}` });
      }

      // 7. Supabase Auth User Cleanup
      let authDeleted = false;
      let authDeleteErrorMsg: string | null = null;

      if (authUserIdToDelete && isUUID(authUserIdToDelete)) {
        try {
          const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(authUserIdToDelete);
          if (!authDelErr || authDelErr.message?.toLowerCase().includes('not found') || (authDelErr as any).status === 404) {
            authDeleted = true;
          } else {
            authDeleteErrorMsg = authDelErr.message;
          }
        } catch (authEx: any) {
          authDeleteErrorMsg = authEx?.message || 'Exception during Auth user deletion';
        }
      } else {
        // Historical/unprovisioned learner with no Auth account
        authDeleted = true;
      }

      if (!authDeleted && authDeleteErrorMsg) {
        console.error(`Student DB deletion succeeded, but Supabase Auth account deletion failed for student_id: ${cleanStudentId}, auth_user_id: ${authUserIdToDelete}. Error: ${authDeleteErrorMsg}`);
        return res.status(500).json({
          error: `Database records cleared, but failed to delete Supabase Auth account: ${authDeleteErrorMsg}`,
          database_deleted: true,
          auth_deleted: false,
          cleanup_required: true,
          student_id: cleanStudentId,
          auth_user_id: authUserIdToDelete
        });
      }

      return res.status(200).json({
        success: true,
        database_deleted: true,
        auth_deleted: authDeleted,
        student_id: cleanStudentId,
        admission_number: targetStudent.admission_number,
        message: `Learner "${targetStudent.full_name}" (${targetStudent.admission_number}) deleted successfully.`
      });

    } catch (err: any) {
      console.error('Unhandled exception in /api/admin/delete-learner:', err);
      return res.status(500).json({ error: `Internal server error during learner deletion: ${err?.message || 'Unknown error'}` });
    }
  };

  app.post('/api/admin/delete-learner', deleteLearnerHandler);
  app.delete('/api/admin/delete-learner', deleteLearnerHandler);

  // Admin Set Learner Active/Inactive Status Handler (Phase 6D.7.1)
  const setLearnerStatusHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // 1. Extract Bearer token & verify administrator authority
      const adminAuth = await authenticateAdminCaller(
        req,
        res,
        supabaseAdmin,
        "Forbidden: Only administrators can modify learner active status."
      );
      if (!adminAuth) return;
      const { adminUser, authUserData } = adminAuth;

      // 4. Validate body inputs
      const { student_id, active, enrolment_status, reason } = req.body || {};
      if (!student_id || typeof student_id !== 'string') {
        return res.status(400).json({ error: "Invalid request: student_id is required." });
      }

      let targetEnrolmentStatus: 'future' | 'active' | 'inactive';
      let targetActive: boolean;
      let targetStatus: 'Active' | 'Disabled';

      if (enrolment_status === 'future') {
        targetEnrolmentStatus = 'future';
        targetActive = false;
        targetStatus = 'Disabled';
      } else if (enrolment_status === 'inactive') {
        targetEnrolmentStatus = 'inactive';
        targetActive = false;
        targetStatus = 'Disabled';
      } else if (enrolment_status === 'active') {
        targetEnrolmentStatus = 'active';
        targetActive = true;
        targetStatus = 'Active';
      } else if (typeof active === 'boolean') {
        targetActive = active;
        targetEnrolmentStatus = active ? 'active' : 'inactive';
        targetStatus = active ? 'Active' : 'Disabled';
      } else {
        return res.status(400).json({ error: "Invalid request: active (boolean) or enrolment_status ('future' | 'active' | 'inactive') is required." });
      }

      const cleanStudentId = student_id.trim();

      // 5. Look up target student
      const { data: targetStudent, error: findStudentErr } = await supabaseAdmin
        .from('students')
        .select('*')
        .eq('id', cleanStudentId)
        .maybeSingle();

      if (findStudentErr || !targetStudent) {
        return res.status(404).json({ error: `Student with ID "${cleanStudentId}" was not found.` });
      }

      const previousActive = targetStudent.active ?? true;

      // 6. Update public.students
      const { error: updateStudentErr } = await supabaseAdmin
        .from('students')
        .update({
          active: targetActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', cleanStudentId);

      if (updateStudentErr) {
        console.error('Error updating student active status:', updateStudentErr);
        return res.status(500).json({ error: `Failed to update student active status: ${updateStudentErr.message}` });
      }

      // 7. Update public.users
      let userProfileUpdated = false;
      const { data: matchedUsers } = await supabaseAdmin
        .from('users')
        .select('id, email, status, role')
        .eq('student_id', cleanStudentId)
        .eq('role', 'learner');

      if (matchedUsers && matchedUsers.length > 0) {
        for (const userRecord of matchedUsers) {
          const { error: updateUserErr } = await supabaseAdmin
            .from('users')
            .update({
              status: targetStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', userRecord.id);

          if (!updateUserErr) {
            userProfileUpdated = true;
          }

          // Also update user_metadata in Supabase Auth if applicable
          try {
            await supabaseAdmin.auth.admin.updateUserById(userRecord.id, {
              user_metadata: {
                status: targetStatus,
                active: targetActive,
                enrolment_status: targetEnrolmentStatus
              }
            });
          } catch (authMetaErr) {
            console.warn(`Could not update Auth metadata for user ${userRecord.id}:`, authMetaErr);
          }
        }
      }

      // 8. Insert into public.audit_logs
      let actionType = targetActive ? 'LEARNER_REACTIVATED' : 'LEARNER_DEACTIVATED';
      let outcomeMessage = `Learner "${targetStudent.full_name}" (${targetStudent.admission_number}) successfully ${targetActive ? 'reactivated' : 'deactivated'}.`;

      if (req.body?.action === 'admit') {
        actionType = 'LEARNER_ADMITTED';
        outcomeMessage = `Learner "${targetStudent.full_name}" (${targetStudent.admission_number}) successfully admitted.`;
      } else if (targetEnrolmentStatus === 'future') {
        actionType = 'LEARNER_MARKED_FUTURE';
        outcomeMessage = `Learner "${targetStudent.full_name}" (${targetStudent.admission_number}) registered as future enrolment.`;
      }

      const admissionDate = req.body?.admission_date || (req.body?.action === 'admit' ? new Date().toISOString().split('T')[0] : null);

      try {
        await supabaseAdmin.from('audit_logs').insert([{
          user_id: adminUser.id,
          user_email: adminUser.email || authUserData.user.email,
          action_type: actionType,
          entity_table: 'students',
          entity_id: cleanStudentId,
          details: {
            admission_number: targetStudent.admission_number,
            full_name: targetStudent.full_name,
            class_id: targetStudent.class_id,
            stream_id: targetStudent.stream_id,
            previous_active: previousActive,
            new_active: targetActive,
            enrolment_status: targetEnrolmentStatus,
            user_status: targetStatus,
            user_profile_updated: userProfileUpdated,
            admission_date: admissionDate,
            reason: reason || null
          },
          ip_address: req.ip || (req.headers['x-forwarded-for'] as string) || null,
          created_at: new Date().toISOString()
        }]);
      } catch (auditErr) {
        console.warn('Could not insert audit log for learner status update:', auditErr);
      }

      return res.status(200).json({
        success: true,
        student_id: cleanStudentId,
        admission_number: targetStudent.admission_number,
        full_name: targetStudent.full_name,
        active: targetActive,
        enrolment_status: targetEnrolmentStatus,
        admission_date: admissionDate,
        status: targetStatus,
        action: actionType,
        message: outcomeMessage
      });

    } catch (err: any) {
      console.error('Unhandled exception in /api/admin/set-learner-status:', err);
      return res.status(500).json({ error: `Internal server error during status update: ${err?.message || 'Unknown error'}` });
    }
  };

  app.post('/api/admin/set-learner-status', setLearnerStatusHandler);
  app.put('/api/admin/set-learner-status', setLearnerStatusHandler);

  // Admin Update Teacher Handler
  const updateTeacherHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // Extract authentication token and verify administrator authority
      const adminAuth = await authenticateAdminCaller(
        req,
        res,
        supabaseAdmin,
        "Forbidden: Only administrators can update teacher accounts."
      );
      if (!adminAuth) return;

      const { teacher } = req.body || {};
      if (!teacher) {
        return res.status(400).json({ error: "Teacher object is required." });
      }

      const teacherIdInput = teacher.id;
      const targetEmail = teacher.email ? teacher.email.trim().toLowerCase() : '';

      // Find teacher in public.teachers
      let targetTeacherId = isUUID(teacherIdInput) ? teacherIdInput : null;
      if (!targetTeacherId) {
        if (targetEmail) {
          const { data: tByEmail } = await supabaseAdmin.from('teachers').select('id').eq('email', targetEmail).maybeSingle();
          if (tByEmail) targetTeacherId = tByEmail.id;
        }
        if (!targetTeacherId && teacherIdInput) {
          const { data: tById } = await supabaseAdmin.from('teachers').select('id').eq('id', teacherIdInput).maybeSingle();
          if (tById) targetTeacherId = tById.id;
        }
      }

      if (!targetTeacherId) {
        return res.status(404).json({ error: "Teacher record not found in database." });
      }

      // 1. Validate class teacher intent and target stream BEFORE any database mutation
      const isClassTeacher = Boolean(teacher.is_class_teacher);
      let targetStream: { id: string; class_id: string; stream_name: string; class_teacher_id: string | null } | null = null;

      if (isClassTeacher) {
        const streamIdInput = teacher.class_teacher_of_id;
        if (!streamIdInput || typeof streamIdInput !== 'string' || !isUUID(streamIdInput)) {
          return res.status(400).json({
            error: "Invalid class_teacher_of_id: A valid stream UUID is required when assigning a class teacher."
          });
        }

        const { data: strmData, error: strmErr } = await supabaseAdmin
          .from('streams')
          .select('id, class_id, stream_name, class_teacher_id')
          .eq('id', streamIdInput)
          .maybeSingle();

        if (strmErr) {
          return res.status(500).json({ error: `Database error verifying stream: ${strmErr.message}` });
        }

        if (!strmData) {
          // Explicitly check if the ID belongs to a parent class
          const { data: classCheck } = await supabaseAdmin
            .from('classes')
            .select('id, class_name')
            .eq('id', streamIdInput)
            .maybeSingle();

          if (classCheck) {
            return res.status(400).json({
              error: `Invalid stream ID: The provided ID belongs to parent class "${classCheck.class_name}", not a stream. Class teachers must be assigned to a specific stream.`
            });
          }

          return res.status(404).json({ error: "Stream not found in database." });
        }

        targetStream = strmData;
      }

      // 2. Update primary teacher record
      const { data: updatedTeacher, error: updateTErr } = await supabaseAdmin
        .from('teachers')
        .update({
          teacher_name: teacher.teacher_name,
          email: teacher.email,
          phone: teacher.phone || null,
          tsc_number: teacher.tsc_number || null,
          is_class_teacher: isClassTeacher,
        })
        .eq('id', targetTeacherId)
        .select()
        .maybeSingle();

      if (updateTErr) {
        console.error('Error updating teacher in DB:', updateTErr);
        return res.status(400).json({ error: `Failed to update teacher: ${updateTErr.message}` });
      }

      // 3. Update public.users record
      if (targetEmail) {
        await supabaseAdmin.from('users').update({
          name: teacher.teacher_name,
          email: teacher.email,
          role: isClassTeacher ? 'class_teacher' : 'subject_teacher',
        })
        .neq('role', 'admin')
        .or(`teacher_id.eq.${targetTeacherId},email.eq.${targetEmail}`);
      } else {
        await supabaseAdmin.from('users').update({
          name: teacher.teacher_name,
          role: isClassTeacher ? 'class_teacher' : 'subject_teacher',
        })
        .neq('role', 'admin')
        .eq('teacher_id', targetTeacherId);
      }

      // 4. Handle stream assignment atomically without clear-before-validate
      if (isClassTeacher && targetStream) {
        // Clear any other stream currently assigned to this teacher (excluding targetStream.id)
        const { error: clearPrevErr } = await supabaseAdmin
          .from('streams')
          .update({ class_teacher_id: null })
          .eq('class_teacher_id', targetTeacherId)
          .neq('id', targetStream.id);

        if (clearPrevErr) {
          return res.status(500).json({
            error: `Failed to unassign teacher from previous stream: ${clearPrevErr.message}`
          });
        }

        // Assign target stream with zero-row verification
        const { data: updatedStreamRows, error: streamUpdErr } = await supabaseAdmin
          .from('streams')
          .update({ class_teacher_id: targetTeacherId })
          .eq('id', targetStream.id)
          .select('id, class_teacher_id');

        if (streamUpdErr) {
          return res.status(500).json({
            error: `Failed to update target stream: ${streamUpdErr.message}`
          });
        }

        if (!updatedStreamRows || updatedStreamRows.length !== 1) {
          return res.status(500).json({
            error: "Database update failed: Zero rows affected on target stream."
          });
        }

        // Reconcile displaced teacher if target stream had a different teacher previously
        const previousTeacherIdOnTargetStream = targetStream.class_teacher_id;
        if (previousTeacherIdOnTargetStream && previousTeacherIdOnTargetStream !== targetTeacherId) {
          const { data: remainingAssignedStreams } = await supabaseAdmin
            .from('streams')
            .select('id')
            .eq('class_teacher_id', previousTeacherIdOnTargetStream);

          if (!remainingAssignedStreams || remainingAssignedStreams.length === 0) {
            await supabaseAdmin
              .from('teachers')
              .update({ is_class_teacher: false })
              .eq('id', previousTeacherIdOnTargetStream);

            const { data: displacedTeacher } = await supabaseAdmin
              .from('teachers')
              .select('id, email')
              .eq('id', previousTeacherIdOnTargetStream)
              .maybeSingle();

            const displacedEmail = displacedTeacher?.email ? displacedTeacher.email.trim().toLowerCase() : '';
            if (displacedEmail) {
              await supabaseAdmin
                .from('users')
                .update({ role: 'subject_teacher' })
                .neq('role', 'admin')
                .or(`teacher_id.eq.${previousTeacherIdOnTargetStream},email.eq.${displacedEmail}`);
            } else {
              await supabaseAdmin
                .from('users')
                .update({ role: 'subject_teacher' })
                .neq('role', 'admin')
                .eq('teacher_id', previousTeacherIdOnTargetStream);
            }
          }
        }
      } else {
        // Unassignment flow: clear any stream currently assigned to this teacher
        await supabaseAdmin
          .from('streams')
          .update({ class_teacher_id: null })
          .eq('class_teacher_id', targetTeacherId);
      }

      // Handle teacher_subjects allocations atomically via PostgreSQL RPC if allocations provided
      if (teacher.allocations !== undefined) {
        const allocations = teacher.allocations || [];
        const rawInserts: Array<{ subject_id: string; class_id: string | null; stream_id: string | null }> = [];
        for (const alloc of allocations) {
          try {
            const resolved = await resolveAllocationUUIDs(supabaseAdmin, alloc);
            if (resolved.subject_id) {
              rawInserts.push({
                subject_id: resolved.subject_id,
                class_id: resolved.class_id || null,
                stream_id: resolved.stream_id || null,
              });
            }
          } catch (resErr: any) {
            console.warn(`Allocation resolution warning during update:`, resErr.message);
            return res.status(400).json({ error: `Failed to resolve allocation: ${resErr.message}` });
          }
        }

        const seenKeys = new Set<string>();
        const allocPayload: Array<{ subject_id: string; class_id: string | null; stream_id: string | null }> = [];
        for (const item of rawInserts) {
          const key = `${item.subject_id}_${item.class_id || 'null'}_${item.stream_id || 'null'}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allocPayload.push(item);
          }
        }

        const { data: rpcAllocRes, error: rpcAllocErr } = await supabaseAdmin.rpc('update_teacher_allocations_atomic', {
          p_teacher_id: targetTeacherId,
          p_allocations: allocPayload,
        });

        if (rpcAllocErr) {
          // Fallback for environment where RPC is not registered in schema cache
          if (rpcAllocErr.code === 'PGRST202') {
            const { data: existingAllocs } = await supabaseAdmin
              .from('teacher_subjects')
              .select('subject_id, class_id, stream_id')
              .eq('teacher_id', targetTeacherId);

            const { error: delAllocErr } = await supabaseAdmin.from('teacher_subjects').delete().eq('teacher_id', targetTeacherId);
            if (delAllocErr) {
              console.error('Error clearing old allocations in fallback:', delAllocErr);
              return res.status(400).json({ error: `Failed to update allocations: ${delAllocErr.message}` });
            }

            if (allocPayload.length > 0) {
              const inserts = allocPayload.map((a) => ({ teacher_id: targetTeacherId, ...a }));
              const { error: insAllocErr } = await supabaseAdmin.from('teacher_subjects').insert(inserts);
              if (insAllocErr) {
                console.error('Failed to insert new allocations in fallback, restoring original allocations:', insAllocErr);
                if (existingAllocs && existingAllocs.length > 0) {
                  await supabaseAdmin
                    .from('teacher_subjects')
                    .insert(existingAllocs.map((a: any) => ({ teacher_id: targetTeacherId, ...a })));
                }
                return res.status(400).json({ error: `Failed to save teacher allocations: ${insAllocErr.message}` });
              }
            }
          } else {
            console.error('RPC update_teacher_allocations_atomic failed:', rpcAllocErr);
            return res.status(400).json({ error: `Failed to update teacher allocations: ${rpcAllocErr.message}` });
          }
        }
      }

      return res.status(200).json({
        success: true,
        teacher: updatedTeacher
      });
    } catch (err: any) {
      console.error('Error in /api/admin/update-teacher:', err);
      return res.status(500).json({ error: 'Internal server error during teacher update.' });
    }
  };

  app.post('/api/admin/update-teacher', updateTeacherHandler);
  app.put('/api/admin/update-teacher', updateTeacherHandler);

  // Authoritative Admin Assign/Unassign Class Teacher Handler
  const assignClassTeacherHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // 1. Authenticate caller and verify administrator authority
      const adminAuth = await authenticateAdminCaller(
        req,
        res,
        supabaseAdmin,
        "Forbidden: Only administrators can assign or unassign class teachers."
      );
      if (!adminAuth) return;

      const { stream_id, teacher_id } = req.body || {};

      // 2. Validate stream_id format
      if (!stream_id || typeof stream_id !== 'string' || !isUUID(stream_id)) {
        return res.status(400).json({
          error: "Invalid stream_id: A valid stream UUID is required."
        });
      }

      // 3. Verify stream exists in public.streams
      const { data: targetStream, error: streamFetchErr } = await supabaseAdmin
        .from('streams')
        .select('id, class_id, stream_name, capacity, class_teacher_id')
        .eq('id', stream_id)
        .maybeSingle();

      if (streamFetchErr) {
        return res.status(500).json({ error: `Database error verifying stream: ${streamFetchErr.message}` });
      }

      if (!targetStream) {
        // Explicitly check if caller passed a parent classes.id instead of streams.id
        const { data: classCheck } = await supabaseAdmin
          .from('classes')
          .select('id, class_name')
          .eq('id', stream_id)
          .maybeSingle();

        if (classCheck) {
          return res.status(400).json({
            error: `Invalid stream_id: The provided ID belongs to parent class "${classCheck.class_name}", not a stream. Class teachers must be assigned to a specific stream.`
          });
        }

        return res.status(404).json({ error: "Stream not found in database." });
      }

      const previousTeacherIdOnTargetStream = targetStream.class_teacher_id;
      const isUnassigning = teacher_id === null || teacher_id === undefined || teacher_id === '';

      // 4. If assigning, validate teacher_id and verify existence
      let targetTeacher: { id: string; teacher_name: string; email: string; is_class_teacher: boolean } | null = null;
      let targetTeacherId: string | null = null;

      if (!isUnassigning) {
        if (typeof teacher_id !== 'string' || !isUUID(teacher_id)) {
          return res.status(400).json({
            error: "Invalid teacher_id: Must be a valid UUID or null for unassignment."
          });
        }

        const { data: teacherRow, error: teacherFetchErr } = await supabaseAdmin
          .from('teachers')
          .select('id, teacher_name, email, is_class_teacher')
          .eq('id', teacher_id)
          .maybeSingle();

        if (teacherFetchErr) {
          return res.status(500).json({ error: `Database error verifying teacher: ${teacherFetchErr.message}` });
        }

        if (!teacherRow) {
          return res.status(404).json({ error: "Teacher record not found in database." });
        }

        targetTeacher = teacherRow;
        targetTeacherId = teacherRow.id;
      }

      // 5. Execute guarded mutations
      if (targetTeacherId) {
        // ASSIGNMENT FLOW
        // Step A: One teacher = maximum one stream.
        // If targetTeacher is currently assigned to another stream, clear that stream first.
        const { error: clearPrevStreamErr } = await supabaseAdmin
          .from('streams')
          .update({ class_teacher_id: null })
          .eq('class_teacher_id', targetTeacherId)
          .neq('id', targetStream.id);

        if (clearPrevStreamErr) {
          return res.status(500).json({
            error: `Failed to unassign teacher from previous stream: ${clearPrevStreamErr.message}`
          });
        }

        // Step B: Assign targetTeacherId to targetStream.id with zero-row verification
        const { data: updatedStreamRows, error: streamUpdErr } = await supabaseAdmin
          .from('streams')
          .update({ class_teacher_id: targetTeacherId })
          .eq('id', targetStream.id)
          .select('id, class_id, stream_name, capacity, class_teacher_id');

        if (streamUpdErr) {
          return res.status(500).json({
            error: `Failed to update target stream: ${streamUpdErr.message}`
          });
        }

        // Zero-row protection: Ensure exactly 1 row was updated
        if (!updatedStreamRows || updatedStreamRows.length !== 1) {
          return res.status(500).json({
            error: "Database update failed: Zero rows affected on target stream."
          });
        }

        // Step C: Update newly assigned teacher record to is_class_teacher = true
        await supabaseAdmin
          .from('teachers')
          .update({ is_class_teacher: true })
          .eq('id', targetTeacherId);

        // Step D: Update users.role to 'class_teacher' (safeguard: protect admin role)
        const targetEmail = targetTeacher?.email ? targetTeacher.email.trim().toLowerCase() : '';
        if (targetEmail) {
          await supabaseAdmin
            .from('users')
            .update({ role: 'class_teacher' })
            .neq('role', 'admin')
            .or(`teacher_id.eq.${targetTeacherId},email.eq.${targetEmail}`);
        } else {
          await supabaseAdmin
            .from('users')
            .update({ role: 'class_teacher' })
            .neq('role', 'admin')
            .eq('teacher_id', targetTeacherId);
        }

        // Step E: Reconcile displaced teacher (if stream had another teacher previously)
        if (previousTeacherIdOnTargetStream && previousTeacherIdOnTargetStream !== targetTeacherId) {
          const { data: remainingAssignedStreams } = await supabaseAdmin
            .from('streams')
            .select('id')
            .eq('class_teacher_id', previousTeacherIdOnTargetStream);

          if (!remainingAssignedStreams || remainingAssignedStreams.length === 0) {
            await supabaseAdmin
              .from('teachers')
              .update({ is_class_teacher: false })
              .eq('id', previousTeacherIdOnTargetStream);

            const { data: displacedTeacher } = await supabaseAdmin
              .from('teachers')
              .select('id, email')
              .eq('id', previousTeacherIdOnTargetStream)
              .maybeSingle();

            const displacedEmail = displacedTeacher?.email ? displacedTeacher.email.trim().toLowerCase() : '';
            if (displacedEmail) {
              await supabaseAdmin
                .from('users')
                .update({ role: 'subject_teacher' })
                .neq('role', 'admin')
                .or(`teacher_id.eq.${previousTeacherIdOnTargetStream},email.eq.${displacedEmail}`);
            } else {
              await supabaseAdmin
                .from('users')
                .update({ role: 'subject_teacher' })
                .neq('role', 'admin')
                .eq('teacher_id', previousTeacherIdOnTargetStream);
            }
          }
        }

        return res.status(200).json({
          success: true,
          stream: updatedStreamRows[0],
          teacher_id: targetTeacherId
        });
      } else {
        // UNASSIGNMENT FLOW
        // Step A: Set class_teacher_id to null on targetStream.id with zero-row verification
        const { data: updatedStreamRows, error: streamUpdErr } = await supabaseAdmin
          .from('streams')
          .update({ class_teacher_id: null })
          .eq('id', targetStream.id)
          .select('id, class_id, stream_name, capacity, class_teacher_id');

        if (streamUpdErr) {
          return res.status(500).json({
            error: `Failed to unassign target stream: ${streamUpdErr.message}`
          });
        }

        // Zero-row protection: Ensure exactly 1 row was updated
        if (!updatedStreamRows || updatedStreamRows.length !== 1) {
          return res.status(500).json({
            error: "Database update failed: Zero rows affected on target stream."
          });
        }

        // Step B: Reconcile displaced teacher (if targetStream had an assigned teacher)
        if (previousTeacherIdOnTargetStream) {
          const { data: remainingAssignedStreams } = await supabaseAdmin
            .from('streams')
            .select('id')
            .eq('class_teacher_id', previousTeacherIdOnTargetStream);

          if (!remainingAssignedStreams || remainingAssignedStreams.length === 0) {
            await supabaseAdmin
              .from('teachers')
              .update({ is_class_teacher: false })
              .eq('id', previousTeacherIdOnTargetStream);

            const { data: displacedTeacher } = await supabaseAdmin
              .from('teachers')
              .select('id, email')
              .eq('id', previousTeacherIdOnTargetStream)
              .maybeSingle();

            const displacedEmail = displacedTeacher?.email ? displacedTeacher.email.trim().toLowerCase() : '';
            if (displacedEmail) {
              await supabaseAdmin
                .from('users')
                .update({ role: 'subject_teacher' })
                .neq('role', 'admin')
                .or(`teacher_id.eq.${previousTeacherIdOnTargetStream},email.eq.${displacedEmail}`);
            } else {
              await supabaseAdmin
                .from('users')
                .update({ role: 'subject_teacher' })
                .neq('role', 'admin')
                .eq('teacher_id', previousTeacherIdOnTargetStream);
            }
          }
        }

        return res.status(200).json({
          success: true,
          stream: updatedStreamRows[0],
          teacher_id: null
        });
      }
    } catch (err: any) {
      console.error('Error in /api/admin/assign-class-teacher:', err);
      return res.status(500).json({ error: 'Internal server error during class teacher assignment.' });
    }
  };

  app.post('/api/admin/assign-class-teacher', assignClassTeacherHandler);
  app.put('/api/admin/assign-class-teacher', assignClassTeacherHandler);

  // Admin Delete Teacher Handler
  const deleteTeacherHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { teacherId, email, userId } = req.body || {};

      // Extract authentication token and verify administrator authority
      const adminAuth = await authenticateAdminCaller(
        req,
        res,
        supabaseAdmin,
        "Forbidden: Only administrators can delete teacher accounts."
      );
      if (!adminAuth) return;

      const cleanTeacherId = teacherId ? String(teacherId).trim() : null;
      const cleanUserId = userId ? String(userId).trim() : null;
      const cleanEmail = email ? String(email).trim().toLowerCase() : null;

      if (!cleanTeacherId && !cleanUserId && !cleanEmail) {
        return res.status(400).json({ error: "Missing teacher identifier: teacherId, userId, or email required." });
      }

      let resolvedTeacherId = cleanTeacherId;
      let resolvedUserId = cleanUserId;
      let resolvedEmail = cleanEmail;
      let isAlreadyDeleted = false;

      // 1. Enforce Atomic DB Deletion via PostgreSQL RPC function
      let rpcRes: any = null;
      let rpcErr: any = null;

      const rpcCall = await supabaseAdmin.rpc('delete_teacher_atomic', {
        p_teacher_id: cleanTeacherId,
        p_user_id: cleanUserId,
        p_email: cleanEmail,
      });

      rpcRes = rpcCall.data;
      rpcErr = rpcCall.error;

      if (rpcErr) {
        if (rpcErr.code === 'PGRST202') {
          console.warn('RPC delete_teacher_atomic not found in schema cache (PGRST202). Executing direct database fallback deletion.');

          let foundTeacherId: string | null = cleanTeacherId;
          let foundUserId: string | null = cleanUserId;
          let foundEmail: string | null = cleanEmail;

          // Lookup teacher record
          if (cleanTeacherId) {
            const { data: t } = await supabaseAdmin.from('teachers').select('id, user_id, email').eq('id', cleanTeacherId).maybeSingle();
            if (t) {
              foundTeacherId = t.id;
              if (t.user_id) foundUserId = t.user_id;
              if (t.email) foundEmail = t.email.toLowerCase();
            }
          } else if (cleanEmail) {
            const { data: t } = await supabaseAdmin.from('teachers').select('id, user_id, email').ilike('email', cleanEmail).maybeSingle();
            if (t) {
              foundTeacherId = t.id;
              if (t.user_id) foundUserId = t.user_id;
              if (t.email) foundEmail = t.email.toLowerCase();
            }
          } else if (cleanUserId) {
            const { data: t } = await supabaseAdmin.from('teachers').select('id, user_id, email').eq('user_id', cleanUserId).maybeSingle();
            if (t) {
              foundTeacherId = t.id;
              if (t.user_id) foundUserId = t.user_id;
              if (t.email) foundEmail = t.email.toLowerCase();
            }
          }

          // Lookup user record
          if (!foundUserId && foundTeacherId) {
            const { data: u } = await supabaseAdmin.from('users').select('id, email').eq('teacher_id', foundTeacherId).maybeSingle();
            if (u) {
              foundUserId = u.id;
              if (u.email && !foundEmail) foundEmail = u.email.toLowerCase();
            }
          }
          if (!foundUserId && cleanUserId) {
            const { data: u } = await supabaseAdmin.from('users').select('id, email').eq('id', cleanUserId).maybeSingle();
            if (u) {
              foundUserId = u.id;
              if (u.email && !foundEmail) foundEmail = u.email.toLowerCase();
            }
          }
          if (!foundUserId && foundEmail) {
            const { data: u } = await supabaseAdmin.from('users').select('id, email').ilike('email', foundEmail).maybeSingle();
            if (u) {
              foundUserId = u.id;
            }
          }

          if (!foundTeacherId && !foundUserId) {
            rpcRes = {
              success: true,
              already_deleted: true,
              teacher_id: cleanTeacherId,
              user_id: cleanUserId,
              email: cleanEmail
            };
          } else {
            // Delete allocations & clear class teacher references
            if (foundTeacherId) {
              const { error: tsErr } = await supabaseAdmin.from('teacher_subjects').delete().eq('teacher_id', foundTeacherId);
              if (tsErr) {
                console.error('Server fallback failed to delete teacher_subjects:', tsErr);
                return res.status(500).json({ error: `Failed to delete teacher subjects: ${tsErr.message}` });
              }
              const { error: strErr } = await supabaseAdmin.from('streams').update({ class_teacher_id: null }).eq('class_teacher_id', foundTeacherId);
              if (strErr) {
                console.error('Server fallback failed to unassign stream class_teacher_id:', strErr);
                return res.status(500).json({ error: `Failed to unassign class teacher from streams: ${strErr.message}` });
              }
              const { error: tErr } = await supabaseAdmin.from('teachers').delete().eq('id', foundTeacherId);
              if (tErr) {
                console.error('Server fallback failed to delete teacher:', tErr);
                return res.status(500).json({ error: `Failed to delete teacher: ${tErr.message}` });
              }
            }
            if (foundEmail) {
              const { error: tEmailErr } = await supabaseAdmin.from('teachers').delete().ilike('email', foundEmail);
              if (tEmailErr) {
                console.error('Server fallback failed to delete teacher by email:', tEmailErr);
                return res.status(500).json({ error: `Failed to delete teacher by email: ${tEmailErr.message}` });
              }
            }

            // Delete user records
            if (foundUserId) {
              const { error: uIdErr } = await supabaseAdmin.from('users').delete().eq('id', foundUserId);
              if (uIdErr) {
                console.error('Server fallback failed to delete user by id:', uIdErr);
                return res.status(500).json({ error: `Failed to delete user record: ${uIdErr.message}` });
              }
            }
            if (foundTeacherId) {
              const { error: uTeacherErr } = await supabaseAdmin.from('users').delete().eq('teacher_id', foundTeacherId);
              if (uTeacherErr) {
                console.error('Server fallback failed to delete user by teacher_id:', uTeacherErr);
                return res.status(500).json({ error: `Failed to delete user record: ${uTeacherErr.message}` });
              }
            }
            if (foundEmail) {
              const { error: uEmailErr } = await supabaseAdmin.from('users').delete().ilike('email', foundEmail);
              if (uEmailErr) {
                console.error('Server fallback failed to delete user by email:', uEmailErr);
                return res.status(500).json({ error: `Failed to delete user record by email: ${uEmailErr.message}` });
              }
            }

            rpcRes = {
              success: true,
              already_deleted: false,
              teacher_id: foundTeacherId || cleanTeacherId,
              user_id: foundUserId || cleanUserId,
              email: foundEmail || cleanEmail
            };
          }
        } else {
          console.error('RPC delete_teacher_atomic failed:', rpcErr);
          return res.status(500).json({
            error: `Database atomic teacher deletion failed: ${rpcErr.message || 'RPC execution error'}`
          });
        }
      }

      if (!rpcRes || typeof rpcRes !== 'object') {
        return res.status(500).json({ error: 'Database atomic teacher deletion failed: Invalid response from RPC function.' });
      }

      if (!rpcRes.success) {
        return res.status(500).json({ error: rpcRes.error || 'Database atomic teacher deletion failed.' });
      }

      isAlreadyDeleted = !!rpcRes.already_deleted;
      if (rpcRes.teacher_id) resolvedTeacherId = String(rpcRes.teacher_id);
      if (rpcRes.user_id) resolvedUserId = String(rpcRes.user_id);
      if (rpcRes.email) resolvedEmail = String(rpcRes.email).toLowerCase();

      // 2. Server-side Supabase Auth user deletion
      let authDeleteSuccess = false;
      let authDeleteErrorMsg: string | null = null;

      const candidateAuthUuids = new Set<string>();
      if (resolvedUserId && isUUID(resolvedUserId)) candidateAuthUuids.add(resolvedUserId);
      if (cleanUserId && isUUID(cleanUserId)) candidateAuthUuids.add(cleanUserId);
      if (resolvedTeacherId && isUUID(resolvedTeacherId)) candidateAuthUuids.add(resolvedTeacherId);
      if (cleanTeacherId && isUUID(cleanTeacherId)) candidateAuthUuids.add(cleanTeacherId);

      const targetEmail = (resolvedEmail || cleanEmail || '').toLowerCase().trim();

      if (candidateAuthUuids.size > 0) {
        for (const authUuid of candidateAuthUuids) {
          try {
            const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(authUuid);
            if (!authErr) {
              authDeleteSuccess = true;
            } else if (authErr.message?.toLowerCase().includes('not found') || authErr.status === 404) {
              authDeleteSuccess = true; // Idempotent: User already removed from Auth
            } else {
              authDeleteErrorMsg = authErr.message;
            }
          } catch (err: any) {
            authDeleteErrorMsg = err?.message || 'Auth deletion exception';
          }
        }
      }

      if (!authDeleteSuccess && targetEmail) {
        // Direct DB check in public.users first if not already tried
        const { data: uByEmail } = await supabaseAdmin.from('users').select('id').ilike('email', targetEmail).maybeSingle();
        if (uByEmail?.id && isUUID(uByEmail.id) && !candidateAuthUuids.has(uByEmail.id)) {
          try {
            const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uByEmail.id);
            if (!authErr || authErr.message?.toLowerCase().includes('not found') || (authErr as any).status === 404) {
              authDeleteSuccess = true;
            } else {
              authDeleteErrorMsg = authErr.message;
            }
          } catch (err: any) {
            authDeleteErrorMsg = err?.message || 'Auth deletion exception';
          }
        }

        if (!authDeleteSuccess) {
          try {
            const lookupRes = await findAuthUserByEmailAcrossPages(supabaseAdmin, targetEmail);
            if (lookupRes.error) {
              authDeleteErrorMsg = lookupRes.error;
            } else if (lookupRes.user) {
              const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(lookupRes.user.id);
              if (!authErr || authErr.message?.toLowerCase().includes('not found') || (authErr as any).status === 404) {
                authDeleteSuccess = true;
              } else {
                authDeleteErrorMsg = authErr.message;
              }
            } else {
              authDeleteSuccess = true; // User definitively not found in Auth across all pages (idempotent)
            }
          } catch (err: any) {
            authDeleteErrorMsg = err?.message || 'Auth list/delete exception';
          }
        }
      }

      if (candidateAuthUuids.size === 0 && !targetEmail) {
        authDeleteSuccess = true;
      }

      if (!authDeleteSuccess && authDeleteErrorMsg) {
        console.error(`Teacher DB deletion succeeded, but Supabase Auth account deletion failed for teacher_id: ${resolvedTeacherId || cleanTeacherId}, user_id: ${resolvedUserId || cleanUserId}, email: ${targetEmail || cleanEmail}. Error: ${authDeleteErrorMsg}`);
        return res.status(500).json({
          error: `Database records cleared, but failed to delete Supabase Auth account: ${authDeleteErrorMsg}`,
          database_deleted: true,
          auth_deleted: false,
          cleanup_required: true,
          teacher_id: resolvedTeacherId || cleanTeacherId,
          user_id: resolvedUserId || cleanUserId,
          email: targetEmail || cleanEmail
        });
      }

      return res.status(200).json({
        success: true,
        database_deleted: true,
        auth_deleted: true,
        already_deleted: isAlreadyDeleted,
        message: isAlreadyDeleted
          ? 'Teacher account was already deleted or does not exist.'
          : 'Teacher and associated records deleted successfully.'
      });

    } catch (err: any) {
      console.error('Error in /api/admin/delete-teacher:', err);
      return res.status(500).json({ error: 'Internal server error during teacher deletion.' });
    }
  };

  app.post('/api/admin/delete-teacher', deleteTeacherHandler);
  app.delete('/api/admin/delete-teacher', deleteTeacherHandler);

  // Admin Reset Password Handler
  const resetPasswordHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { emailOrUserId, newPassword, forcePasswordChange = true, email, teacherId, userId } = req.body || {};

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: "Invalid password: Must be at least 6 characters long." });
      }

      // Extract authentication token
      let token: string | null = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === 'string' && req.body.token.trim()) {
        token = req.body.token.trim();
      }

      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }

      // Verify authentication token via Supabase Auth
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }

      const authenticatedUserId = authUserData.user.id;

      // Verify caller is an administrator in public.users or public.teachers
      let isAdmin = false;
      const { data: callerUser } = await supabaseAdmin.from('users').select('role').eq('id', authenticatedUserId).maybeSingle();
      if (callerUser && (callerUser.role === 'admin' || callerUser.role === 'administrator')) {
        isAdmin = true;
      } else {
        const { data: callerTeacher } = await supabaseAdmin.from('teachers').select('role').eq('user_id', authenticatedUserId).maybeSingle();
        if (callerTeacher && (callerTeacher.role === 'admin' || callerTeacher.role === 'administrator')) {
          isAdmin = true;
        }
      }

      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Only administrators can reset user passwords." });
      }

      // Target Auth User Resolution
      let targetAuthUserId: string | null = null;
      const cleanTarget = (emailOrUserId || email || '').trim().toLowerCase();

      if (userId && isUUID(userId)) {
        targetAuthUserId = userId;
      } else if (teacherId) {
        const { data: tRow } = await supabaseAdmin.from('teachers').select('user_id').eq('id', teacherId).maybeSingle();
        if (tRow?.user_id) {
          targetAuthUserId = tRow.user_id;
        }
      }

      if (!targetAuthUserId && cleanTarget) {
        // Try looking up in public.users by email
        const { data: uRow } = await supabaseAdmin.from('users').select('id').eq('email', cleanTarget).maybeSingle();
        if (uRow?.id) {
          targetAuthUserId = uRow.id;
        }
      }

      if (!targetAuthUserId && cleanTarget) {
        // Try looking up in public.teachers by email
        const { data: tRow } = await supabaseAdmin.from('teachers').select('user_id').eq('email', cleanTarget).maybeSingle();
        if (tRow?.user_id) {
          targetAuthUserId = tRow.user_id;
        }
      }

      if (!targetAuthUserId && cleanTarget) {
        // Search directly in Auth users across all pages by email (orphan recovery fallback)
        try {
          const lookupRes = await findAuthUserByEmailAcrossPages(supabaseAdmin, cleanTarget);
          if (lookupRes.error) {
            console.error('[resetPasswordHandler] Auth lookup ambiguity error:', lookupRes.error);
            return res.status(400).json({ error: `Password reset aborted: ${lookupRes.error}` });
          }
          if (lookupRes.user) {
            targetAuthUserId = lookupRes.user.id;
          }
        } catch (lErr: any) {
          console.warn('Error searching Auth users by email across pages:', lErr);
        }
      }

      if (!targetAuthUserId) {
        return res.status(404).json({ error: "Target user account not found in Supabase Auth." });
      }

      // Execute authoritative password reset in Supabase Auth
      const { data: updateRes, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetAuthUserId,
        {
          password: newPassword,
          user_metadata: { force_password_change: !!forcePasswordChange }
        }
      );

      if (updateError) {
        console.error('Supabase Auth updateUserById error:', updateError);
        return res.status(500).json({ error: `Supabase Auth error: ${updateError.message}` });
      }

      // Update force_password_change flag in public.users and public.teachers without storing plain password
      await supabaseAdmin.from('users').update({
        force_password_change: !!forcePasswordChange,
        temporary_password: null
      }).eq('id', targetAuthUserId);

      if (cleanTarget) {
        await supabaseAdmin.from('teachers').update({
          force_password_change: !!forcePasswordChange,
          temporary_password: null
        }).eq('email', cleanTarget);
      }

      return res.status(200).json({
        success: true,
        message: 'Password updated successfully in Supabase Auth.',
        targetAuthUserId
      });

    } catch (err: any) {
      console.error('Error in /api/admin/reset-password:', err);
      return res.status(500).json({ error: 'Internal server error during password reset.' });
    }
  };

  app.post('/api/admin/reset-password', resetPasswordHandler);

  // --- T-11 AUTHORISED Y RESOLUTION HANDLER ---
  const resolveYHandler = async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // 1. Authorisation: Only administrators can resolve Y
      const adminAuth = await authenticateAdminCaller(
        req,
        res,
        supabaseAdmin,
        "Forbidden: Only administrators can formally resolve assessment irregularities (Y)."
      );
      if (!adminAuth) return;

      const {
        mark_id,
        student_id,
        subject_id,
        exam_id,
        replacement_score,
        out_of,
        resolution_reason
      } = req.body || {};

      // 2. Input validation
      if (!resolution_reason || typeof resolution_reason !== 'string' || !resolution_reason.trim()) {
        return res.status(400).json({ error: "Resolution reason is required for formal Y resolution audit compliance." });
      }

      if (replacement_score === undefined || replacement_score === null || typeof replacement_score !== 'number' || !Number.isFinite(replacement_score)) {
        return res.status(400).json({ error: "A valid numerical replacement score is required." });
      }

      if (replacement_score < 0) {
        return res.status(400).json({ error: "Replacement mark cannot be negative." });
      }

      // 3. Query target mark from Supabase
      let markQuery = supabaseAdmin.from('marks').select('*');
      if (mark_id && isUUID(mark_id)) {
        markQuery = markQuery.eq('id', mark_id);
      } else if (student_id && subject_id && exam_id && isUUID(student_id) && isUUID(subject_id) && isUUID(exam_id)) {
        markQuery = markQuery.eq('student_id', student_id).eq('subject_id', subject_id).eq('exam_id', exam_id);
      } else {
        return res.status(400).json({ error: "Valid mark_id or (student_id, subject_id, exam_id) UUIDs are required." });
      }

      const { data: markData, error: markErr } = await markQuery.maybeSingle();
      if (markErr) {
        return res.status(500).json({ error: `Database error querying mark: ${markErr.message}` });
      }
      if (!markData) {
        return res.status(404).json({ error: "Target assessment mark does not exist." });
      }

      // 4. Verify that current mark status is Y
      let currentSpecialStatus = markData.special_status;
      let originalIrregularityReason = markData.irregularity_reason;
      let effectiveOutOf = typeof out_of === 'number' && out_of > 0 ? out_of : (typeof markData.out_of === 'number' && markData.out_of > 0 ? markData.out_of : 100);

      if (markData.remarks && typeof markData.remarks === 'string' && markData.remarks.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(markData.remarks);
          if (currentSpecialStatus === undefined) currentSpecialStatus = parsed.special_status;
          if (!originalIrregularityReason) originalIrregularityReason = parsed.irregularity_reason;
          if (parsed.out_of && typeof parsed.out_of === 'number') effectiveOutOf = parsed.out_of;
        } catch (e) {
          // ignore
        }
      }

      const isY = currentSpecialStatus === 'Y' ||
        (typeof markData.marks === 'string' && (markData.marks as string).trim().toUpperCase() === 'Y') ||
        (typeof markData.raw_score === 'string' && (markData.raw_score as string).trim().toUpperCase() === 'Y');

      if (!isY) {
        return res.status(400).json({
          error: `Cannot resolve mark: Current mark status is not Y (current status: ${currentSpecialStatus || 'Normal'}). Only Y status can be resolved.`
        });
      }

      if (replacement_score > effectiveOutOf) {
        return res.status(400).json({
          error: `Replacement score (${replacement_score}) exceeds assessment maximum (${effectiveOutOf}).`
        });
      }

      const normalizedPercentage = effectiveOutOf > 0 ? (replacement_score / effectiveOutOf) * 100 : 0;
      const clampedPercentage = Math.min(100, Math.max(0, normalizedPercentage));
      const resolvedAt = new Date().toISOString();
      const resolverName = (adminAuth.adminUser as any)?.name || adminAuth.adminUser?.email || 'Administrator';
      const reason = (originalIrregularityReason && originalIrregularityReason.trim()) || 'Absent';

      const provenance = {
        mark_id: markData.id,
        student_id: markData.student_id,
        subject_id: markData.subject_id,
        exam_id: markData.exam_id,
        original_status: 'Y',
        original_irregularity_reason: reason,
        replacement_score: replacement_score,
        replacement_percentage: clampedPercentage,
        resolution_reason: resolution_reason.trim(),
        resolved_by: resolverName,
        resolved_at: resolvedAt,
      };

      const remarksObj = {
        raw_score: replacement_score,
        out_of: effectiveOutOf,
        special_status: 'Normal',
        resolution: provenance,
        entered_by_teacher_id: markData.entered_by_teacher_id || adminAuth.authenticatedUserId,
      };

      // 5. Update public.marks
      const { data: updatedMark, error: updateErr } = await supabaseAdmin
        .from('marks')
        .update({
          marks: clampedPercentage,
          remarks: JSON.stringify(remarksObj),
          updated_at: resolvedAt,
        })
        .eq('id', markData.id)
        .select()
        .single();

      if (updateErr) {
        return res.status(500).json({ error: `Database error updating mark: ${updateErr.message}` });
      }

      // 6. Record in audit_logs
      try {
        await supabaseAdmin.from('audit_logs').insert([{
          user_id: adminAuth.authenticatedUserId,
          user_email: adminAuth.adminUser?.email || 'admin@school.ac.ke',
          action_type: 'Y_RESOLUTION',
          entity_table: 'marks',
          entity_id: markData.id,
          details: JSON.stringify(provenance),
        }]);
      } catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
      }

      // 7. Insert into public.mark_resolutions if table exists
      try {
        await supabaseAdmin.from('mark_resolutions').insert([provenance]);
      } catch (mrErr) {
        // non-fatal if table hasn't been migrated yet
      }

      return res.json({
        success: true,
        mark: updatedMark,
        provenance: provenance,
      });
    } catch (err: any) {
      console.error('Error in /api/admin/resolve-y:', err);
      return res.status(500).json({ error: 'Internal server error during Y resolution.' });
    }
  };

  app.post('/api/admin/resolve-y', resolveYHandler);

  // Authenticated or Pre-auth Identifier Resolution Handler (TSC Number, Username, Student Admission Number)
  app.post('/api/auth/resolve-identifier', async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const { identifier } = req.body || {};
      if (!identifier || typeof identifier !== 'string') {
        return res.status(400).json({ error: "Identifier required" });
      }

      const trimmed = identifier.trim();
      if (trimmed.includes('@')) {
        return res.json({ email: trimmed.toLowerCase() });
      }

      const alphanumeric = trimmed.replace(/[^a-z0-9]/gi, '');

      // 1. Query teachers table in Supabase
      const { data: dbTeachers } = await supabaseAdmin
        .from('teachers')
        .select('*')
        .or(`tsc_number.ilike.%${trimmed}%,tsc_number.ilike.%${alphanumeric}%,username.ilike.${trimmed}`)
        .limit(1);

      if (dbTeachers && dbTeachers.length > 0 && dbTeachers[0].email) {
        return res.json({ email: dbTeachers[0].email.toLowerCase(), teacher: dbTeachers[0] });
      }

      // 2. Query users table in Supabase
      const { data: dbUsers } = await supabaseAdmin
        .from('users')
        .select('*')
        .or(`email.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
        .limit(1);

      if (dbUsers && dbUsers.length > 0 && dbUsers[0].email) {
        return res.json({ email: dbUsers[0].email.toLowerCase(), user: dbUsers[0] });
      }

      // 3. Query students table in Supabase for matching admission number
      const { data: dbStudents } = await supabaseAdmin
        .from('students')
        .select('*')
        .or(`admission_number.ilike.${trimmed},admission_number.ilike.%${alphanumeric}%`)
        .limit(1);

      if (dbStudents && dbStudents.length > 0) {
        const dbStudent = dbStudents[0];

        // Gating Check: Future / Inactive / Transferred Learner
        if (dbStudent.enrolment_status === 'future') {
          return res.status(403).json({
            error: 'This learner account is registered for future intake and has not yet been activated. Please contact school administration.',
            code: 'LEARNER_FUTURE',
            active: false,
            enrolment_status: 'future',
            student_id: dbStudent.id,
            admission_number: dbStudent.admission_number
          });
        }

        if (dbStudent.active === false || dbStudent.enrolment_status === 'inactive') {
          return res.status(403).json({
            error: 'This learner account is inactive or transferred. Please contact school administration.',
            code: 'LEARNER_INACTIVE',
            active: false,
            enrolment_status: 'inactive',
            student_id: dbStudent.id,
            admission_number: dbStudent.admission_number
          });
        }

        const { data: dbLearnerUsers } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('student_id', dbStudent.id)
          .limit(1);

        if (dbLearnerUsers && dbLearnerUsers.length > 0) {
          const dbLearnerUser = dbLearnerUsers[0];
          if (dbLearnerUser.status === 'Disabled') {
            return res.status(403).json({
              error: 'This learner account is inactive or transferred. Please contact school administration.',
              code: 'LEARNER_INACTIVE',
              active: false,
              student_id: dbStudent.id,
              admission_number: dbStudent.admission_number
            });
          }
          if (dbLearnerUser.email) {
            return res.json({
              email: dbLearnerUser.email.toLowerCase(),
              user: dbLearnerUser,
              student: dbStudent,
            });
          }
        }

        const learnerEmail = `${dbStudent.admission_number.toLowerCase().replace(/[^a-z0-9-]/g, '')}@learner.cbe.ac.ke`;
        return res.json({
          email: learnerEmail,
          student: dbStudent,
        });
      }

      return res.json({ email: null });
    } catch (err: any) {
      console.error('Error in /api/auth/resolve-identifier:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Secure Class Teacher Safe Display Endpoint for Learners
  app.get('/api/learner/class-teachers', async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // 1. Fetch assigned streams with class_teacher_id
      const { data: streams, error: streamErr } = await supabaseAdmin
        .from('streams')
        .select('id, class_id, stream_name, class_teacher_id')
        .not('class_teacher_id', 'is', null);

      if (streamErr || !streams || streams.length === 0) {
        return res.json({ teachers: [] });
      }

      const teacherIds = Array.from(
        new Set(streams.map((s) => s.class_teacher_id).filter((id): id is string => Boolean(id) && isUUID(id)))
      );

      if (teacherIds.length === 0) {
        return res.json({ teachers: [] });
      }

      // 2. Fetch ONLY safe display fields (id, teacher_name, email) for assigned class teachers
      const { data: teachers, error: teacherErr } = await supabaseAdmin
        .from('teachers')
        .select('id, teacher_name, email')
        .in('id', teacherIds);

      if (teacherErr) {
        return res.status(400).json({ error: teacherErr.message });
      }

      return res.json({
        teachers: (teachers || []).map((t) => ({
          id: t.id,
          teacher_name: t.teacher_name,
          email: t.email,
        }))
      });
    } catch (err: any) {
      console.error('Error in /api/learner/class-teachers:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Authoritative Learner Cohort Ranking Endpoint (Zero Peer Data Leakage)
  app.get('/api/learner/exam-ranking', async (req: express.Request, res: express.Response) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server missing Supabase credentials.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // 1. Authenticate Request via Bearer Token or Query Token
      const authHeader = req.headers.authorization || req.headers.Authorization;
      let token: string | null = null;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (req.query && typeof req.query.token === 'string') {
        token = req.query.token.trim();
      }

      let authenticatedUserId: string | null = null;
      let authEmail: string | null = null;

      if (token) {
        const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
        if (!tokenError && authUserData?.user) {
          authenticatedUserId = authUserData.user.id;
          authEmail = authUserData.user.email ? authUserData.user.email.toLowerCase().trim() : null;
        }
      }

      // If no valid session token was provided, reject with 401
      if (!authenticatedUserId && !authEmail) {
        return res.status(401).json({ error: 'Unauthorized: Authentication token is required.' });
      }

      // 2. Resolve User & Establish Authorized Student Identity
      let targetStudentId: string | null = null;

      const { data: userById } = authenticatedUserId
        ? await supabaseAdmin.from('users').select('*').eq('id', authenticatedUserId).maybeSingle()
        : { data: null };

      let currentUser = userById;
      if (!currentUser && authEmail) {
        const { data: userByEmail } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', authEmail)
          .maybeSingle();
        if (userByEmail) currentUser = userByEmail;
      }

      if (currentUser?.role === 'learner' || currentUser?.student_id) {
        targetStudentId = currentUser.student_id;
      }

      if (!targetStudentId && authEmail) {
        const admPrefix = authEmail.split('@')[0];
        const { data: stdByAdm } = await supabaseAdmin
          .from('students')
          .select('id')
          .ilike('admission_number', admPrefix)
          .maybeSingle();
        if (stdByAdm) targetStudentId = stdByAdm.id;
      }

      // Allow admin / teacher preview if authorized
      if (
        (!currentUser || currentUser.role === 'admin' || currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') &&
        req.query.student_id
      ) {
        targetStudentId = String(req.query.student_id).trim();
      }

      if (!targetStudentId) {
        return res.status(403).json({ error: 'Forbidden: Learner student identity could not be established.' });
      }

      // 3. Validate Exam ID
      const examId = (req.query.exam_id || req.query.examId || req.query.id || '').toString().trim();
      if (!examId || !isUUID(examId)) {
        return res.status(400).json({ error: 'Valid exam_id is required.' });
      }

      // 4. Fetch Required Database Entities
      const [
        { data: studentRow, error: stdErr },
        { data: examRow, error: examErr },
        { data: dbStudents, error: allStdErr },
        { data: dbClasses, error: classErr },
        { data: dbStreams, error: streamErr },
        { data: dbSubjects, error: subErr },
        { data: dbGrades, error: grErr },
        { data: dbMarks, error: markErr },
      ] = await Promise.all([
        supabaseAdmin.from('students').select('*').eq('id', targetStudentId).maybeSingle(),
        supabaseAdmin.from('examinations').select('*').eq('id', examId).maybeSingle(),
        supabaseAdmin.from('students').select('*').eq('active', true),
        supabaseAdmin.from('classes').select('*'),
        supabaseAdmin.from('streams').select('*'),
        supabaseAdmin.from('subjects').select('*'),
        supabaseAdmin.from('grades').select('*'),
        supabaseAdmin.from('marks').select('*').eq('exam_id', examId),
      ]);

      if (stdErr || !studentRow) {
        return res.status(404).json({ error: 'Learner record not found.' });
      }

      if (examErr || !examRow) {
        return res.status(404).json({ error: 'Examination not found.' });
      }

      // Check student active status
      if (studentRow.active === false || studentRow.enrolment_status === 'inactive' || studentRow.enrolment_status === 'future') {
        return res.status(403).json({ error: 'Learner record is inactive.' });
      }

      // 5. Build authoritative ClassStream[] array
      const mergedClasses: any[] = [];
      (dbClasses || []).forEach((c: any) => {
        const cStreams = (dbStreams || []).filter((s: any) => s.class_id === c.id);
        if (cStreams.length > 0) {
          cStreams.forEach((st: any) => {
            mergedClasses.push({
              id: c.id,
              stream_id: st.id,
              class_name: c.class_name,
              stream: st.stream_name || 'A',
              capacity: st.capacity || c.capacity || 40,
              class_teacher_id: st.class_teacher_id || undefined,
              education_level: c.education_level,
              status: c.status || 'Active',
            });
          });
        } else {
          mergedClasses.push({
            id: c.id,
            stream_id: c.id,
            class_name: c.class_name,
            stream: c.stream || '',
            capacity: c.capacity || 40,
            education_level: c.education_level,
            status: c.status || 'Active',
          });
        }
      });

      // 6. Execute Authoritative Competition Ranking Engine across the Full Cohort
      const allActiveStudents = (dbStudents || []).map((s: any) => {
        const matchedClass =
          (s.stream_id ? mergedClasses.find((c: any) => c.stream_id === s.stream_id || c.id === s.stream_id) : undefined) ||
          (s.class_id ? mergedClasses.find((c: any) => c.id === s.class_id || c.stream_id === s.class_id) : undefined);
        return {
          ...s,
          name: s.name || s.full_name || '',
          grade: s.grade || matchedClass?.class_name || '',
        };
      });

      // Ensure target student is in cohort list with resolved properties
      if (!allActiveStudents.some((s: any) => s.id === studentRow.id)) {
        const matchedTargetClass =
          (studentRow.stream_id ? mergedClasses.find((c: any) => c.stream_id === studentRow.stream_id || c.id === studentRow.stream_id) : undefined) ||
          (studentRow.class_id ? mergedClasses.find((c: any) => c.id === studentRow.class_id || c.stream_id === studentRow.class_id) : undefined);
        allActiveStudents.push({
          ...studentRow,
          name: studentRow.name || studentRow.full_name || '',
          grade: studentRow.grade || matchedTargetClass?.class_name || '',
        });
      }

      const examResults = calculateExamResults(
        examId,
        allActiveStudents,
        dbMarks || [],
        dbGrades || [],
        mergedClasses,
        dbSubjects || []
      );

      const targetResult = examResults.find((r) => r.student_id === studentRow.id);

      // 7. Resolve Denominators using Authoritative Historical Cohort Resolver
      const gradeStudentIds = getGradeCohortStudentIds(studentRow, allActiveStudents, examRow, mergedClasses);
      const gradeResults = examResults.filter((r) => gradeStudentIds.has(r.student_id));
      const totalGradeAssessedStudents =
        gradeResults.filter((r) => r.is_complete !== false).length ||
        gradeResults.length ||
        1;

      const streamStudentIds = getStreamCohortStudentIds(studentRow, allActiveStudents, examRow, mergedClasses);
      const streamResults = examResults.filter((r) => streamStudentIds.has(r.student_id));
      const streamAssessedStudentsCount =
        streamResults.filter((r) => r.is_complete !== false).length ||
        streamResults.length ||
        1;

      const isAssessmentComplete = targetResult ? targetResult.is_complete !== false : false;
      const streamRank = isAssessmentComplete && (targetResult?.class_position || targetResult?.position)
        ? (targetResult.class_position || targetResult.position)
        : null;
      const overallRank = isAssessmentComplete && targetResult?.position
        ? targetResult.position
        : null;

      // 8. Return ONLY Non-Sensitive Scalar Ranking Metadata (Zero Peer Data)
      return res.json({
        stream_rank: streamRank,
        stream_total: streamAssessedStudentsCount,
        overall_rank: overallRank,
        overall_total: totalGradeAssessedStudents,
        is_complete: isAssessmentComplete,
        total_marks: targetResult?.total_marks || 0,
        average: targetResult?.average || 0,
        total_points: targetResult?.total_points || 0,
        performance_level: targetResult?.performance_level || 'Pending',
        grade_code: targetResult?.grade_code || 'Pending',
      });
    } catch (err: any) {
      console.error('Error in /api/learner/exam-ranking:', err);
      return res.status(500).json({ error: 'Internal server error calculating learner cohort ranking.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.get(['/server.cjs', '/server.cjs.map'], (req, res) => res.status(404).end());
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
