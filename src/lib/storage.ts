import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getActiveTeacher, getAccessibleStudents, getAccessibleSubjects, isClassTeacherFor } from '../utils/rbacUtils';
import { getFilteredStudents, isClassInExamScope } from '../utils/filterUtils';
import { buildApiUrl } from '../utils/apiConfig';
import {
  School,
  User,
  Teacher,
  ClassStream,
  Student,
  EnrolmentStatus,
  Subject,
  Examination,
  Mark,
  MarkResolution,
  Grade,
  VerificationLog,
  Role,
  AcademicYear,
  SchoolTerm,
  GradeName,
  EducationLevel,
  TermName,
  LearnerPromotionRecord,
  LoginLog,
  LearnerReportComment,
  LearnerRankingMetadata,
  LEVEL_TO_GRADES,
  getEducationLevelForGrade,
  getGradeOrderIndex,
  normalizeGradeName,
  getStudentFullName,
  formatLearnerName,
  getApplicableSubjectsForGrade,
  getAllocatedSubjectsForClass,
  sortClasses,
  isIntakePeriodFuture,
} from '../types';
import {
  initialSchool,
  initialGrades,
  initialSubjects,
  isStandardSubject,
  initialClasses,
  initialUsers,
  initialStudents,
  initialExaminations,
  initialMarks,
  initialAcademicYears,
  initialTerms,
} from '../data/seedData';

const adminUsersOnly = initialUsers.filter((u) => u.role === 'admin');

// Singleton instance variables
export let supabase: SupabaseClient | null = null;
let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

// Supabase credentials resolution (checks process/import.meta env or localStorage)
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const env = (import.meta as any).env || {};
  const procEnv = typeof process !== 'undefined' ? process.env : {};
  let url = (env.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || procEnv.SUPABASE_URL || (typeof localStorage !== 'undefined' ? localStorage.getItem('cbe_supabase_url') : '') || '').trim();
  let anonKey = (env.VITE_SUPABASE_ANON_KEY || procEnv.VITE_SUPABASE_ANON_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('cbe_supabase_anon_key') : '') || '').trim();

  // Strip accidental variable name prefixes if pasted with 'NAME='
  if (url.startsWith('VITE_SUPABASE_URL=')) url = url.substring('VITE_SUPABASE_URL='.length).trim();
  else if (url.startsWith('SUPABASE_URL=')) url = url.substring('SUPABASE_URL='.length).trim();

  if (anonKey.startsWith('VITE_SUPABASE_ANON_KEY=')) anonKey = anonKey.substring('VITE_SUPABASE_ANON_KEY='.length).trim();
  else if (anonKey.startsWith('SUPABASE_ANON_KEY=')) anonKey = anonKey.substring('SUPABASE_ANON_KEY='.length).trim();

  return { url, anonKey };
}

/**
 * Returns the global single Supabase client instance (Singleton).
 * Reuses the existing GoTrueClient and Supabase instance unless credentials change.
 */
export function getSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__TEST_SUPABASE_CLIENT__) {
    return (globalThis as any).__TEST_SUPABASE_CLIENT__;
  }
  const creds = getSupabaseCredentials();
  const finalUrl = (url !== undefined ? url : creds.url).trim();
  const finalKey = (anonKey !== undefined ? anonKey : creds.anonKey).trim();

  if (!finalUrl || !finalKey) {
    return null;
  }

  // If a singleton client already exists and credentials haven't changed, return the singleton instance
  if (supabaseInstance && currentUrl === finalUrl && currentKey === finalKey) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(finalUrl, finalKey);
    currentUrl = finalUrl;
    currentKey = finalKey;
    supabase = supabaseInstance;
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to create Supabase client', err);
    return null;
  }
}

/**
 * Alias for getSupabaseClient to preserve backward compatibility while ensuring a single GoTrueClient instance.
 */
export function createSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  return getSupabaseClient(url, anonKey);
}

/**
 * Asynchronously ensures Supabase client is initialized.
 * If credentials are not in local storage/env, attempts to fetch public config from backend /api/auth/config.
 */
export async function ensureSupabaseClient(): Promise<SupabaseClient | null> {
  let client = getSupabaseClient();
  if (client) return client;

  try {
    const configEndpoint = buildApiUrl('/api/auth/config');
    const res = await fetch(configEndpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.supabaseUrl && data?.supabaseAnonKey) {
        saveSupabaseCredentials(data.supabaseUrl, data.supabaseAnonKey);
        client = getSupabaseClient(data.supabaseUrl, data.supabaseAnonKey);
        return client;
      }
    }
  } catch (err) {
    // Expected when offline or backend unreachable
  }

  return getSupabaseClient();
}

// Initial singleton lookup on module load
getSupabaseClient();

export function saveSupabaseCredentials(url: string, anonKey: string) {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (cleanUrl) localStorage.setItem('cbe_supabase_url', cleanUrl);
  else localStorage.removeItem('cbe_supabase_url');

  if (cleanKey) localStorage.setItem('cbe_supabase_anon_key', cleanKey);
  else localStorage.removeItem('cbe_supabase_anon_key');

  supabase = getSupabaseClient(cleanUrl, cleanKey);
}

// --- REALTIME SUBSCRIPTION TYPES & SINGLETON MANAGER (Stage 8A & 8B) ---
export type RealtimeMarkEvent = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRecord: Partial<Mark> | Record<string, any> | null;
  oldRecord: Partial<Mark> | Record<string, any> | null;
  rawPayload: any;
};

export type RealtimeMarkCallback = (event: RealtimeMarkEvent) => void;

let marksRealtimeChannel: ReturnType<SupabaseClient['channel']> | null = null;
let isInitializingMarksRealtimeChannel = false;
const marksRealtimeCallbacks: Set<RealtimeMarkCallback> = new Set();

let lastAppliedRealtimeToken: string | null = null;

/**
 * Centrally manages Realtime JWT synchronization.
 * In Supabase Client v2.111.0+, auth token changes are automatically synced
 * from supabase.auth -> supabase.realtime via internal onAuthStateChange listener.
 * Manual setAuth() calls are delegated to the native Supabase client listener to avoid socket reset races.
 */
export function syncRealtimeAuth(token: string | null | undefined): void {
  lastAppliedRealtimeToken = token || '';
}

// Stage 8B: 150ms Realtime Event Batch Queue
let pendingRealtimeMarkEvents: RealtimeMarkEvent[] = [];
let realtimeBatchTimeout: any = null;

// Stage 8D: Realtime Connection State Tracking & Recovery Flags
let hasBeenDisconnected = false;
let isInitialSubscription = true;
let isRecoveryInProgress = false;

// Unified Connection State Tracking (Priority 2)
export type ConnectionStatus =
  | 'online'
  | 'offline'
  | 'reconnecting'
  | 'syncing'
  | 'realtime_unavailable';

export type ConnectionStatusListener = (status: ConnectionStatus) => void;

let currentConnectionStatus: ConnectionStatus =
  typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine ? 'offline' : 'online';
const connectionStatusListeners: Set<ConnectionStatusListener> = new Set();

export function getConnectionStatus(): ConnectionStatus {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
    return 'offline';
  }
  return currentConnectionStatus;
}

export function setConnectionStatus(status: ConnectionStatus): void {
  if (currentConnectionStatus === status) return;
  currentConnectionStatus = status;
  connectionStatusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (err) {
      console.error('[ConnectionStatus] Listener error:', err);
    }
  });
}

export function subscribeToConnectionStatus(listener: ConnectionStatusListener): () => void {
  connectionStatusListeners.add(listener);
  try {
    listener(getConnectionStatus());
  } catch (err) {
    console.error('[ConnectionStatus] Initial listener error:', err);
  }
  return () => {
    connectionStatusListeners.delete(listener);
  };
}

// Global browser-level online/offline event listeners (unconditionally initialized once on window)
if (typeof window !== 'undefined' && !(window as any).__cbe_global_network_listeners_set) {
  (window as any).__cbe_global_network_listeners_set = true;
  window.addEventListener('offline', () => {
    console.warn('[Network] Browser offline detected');
    hasBeenDisconnected = true;
    setConnectionStatus('offline');
  });
  window.addEventListener('online', async () => {
    console.log('[Network] Browser online restored. Initiating reconnection...');
    if (hasBeenDisconnected && !isInitialSubscription) {
      setConnectionStatus('reconnecting');
      try {
        setConnectionStatus('syncing');
        await reconcileMarksOnReconnect();
      } catch (err) {
        console.error('[Network] Reconnection sync error:', err);
      }
      hasBeenDisconnected = false;
    }
    setConnectionStatus('online');
  });
}

/**
 * Stage 8D: Scoped Authoritative Marks Recovery Fetch & Reconciliation on Reconnection
 */
export async function reconcileMarksOnReconnect(): Promise<void> {
  if (isRecoveryInProgress) {
    console.log('[Realtime] Reconnection recovery already in progress. Skipping duplicate attempt.');
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Realtime] Supabase client unavailable for reconnection recovery');
    hasBeenDisconnected = true;
    return;
  }

  isRecoveryInProgress = true;

  try {
    const currentMarks = getStorage<Mark[]>(KEYS.MARKS, []);
    const exams = getStorage<Examination[]>(KEYS.EXAMS, []);

    // Distinct exam IDs in local cache + active examinations
    const cachedExamIds = Array.from(
      new Set(
        currentMarks
          .map((m) => m.exam_id)
          .filter((id): id is string => Boolean(id && isUUID(id)))
      )
    );
    const activeExamIds = exams
      .filter((e) => e.status !== 'Approved' && isUUID(e.id))
      .map((e) => e.id);
    const targetExamIds = Array.from(new Set([...cachedExamIds, ...activeExamIds]));

    if (targetExamIds.length === 0) {
      console.log('[Realtime] No active or cached exam scope for reconnection recovery.');
      return;
    }

    const { data: dbMarks, error } = await client
      .from('marks')
      .select('*')
      .in('exam_id', targetExamIds);

    if (error) {
      console.warn('[Realtime] Reconnection recovery marks query error:', error);
      hasBeenDisconnected = true;
      return;
    }

    if (!dbMarks) return;

    const fetchedMarks = api.mapDatabaseMarks(dbMarks);
    const fetchedMap = new Map<string, Mark>();
    fetchedMarks.forEach((m) => {
      if (m.student_id && m.subject_id && m.exam_id) {
        fetchedMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m);
      }
    });

    let updatedMarks = [...currentMarks];
    let cacheChanged = false;
    const syntheticEvents: RealtimeMarkEvent[] = [];

    // 1. Reconcile in-scope local marks against DB result
    for (let i = 0; i < updatedMarks.length; i++) {
      const existing = updatedMarks[i];
      if (!targetExamIds.includes(existing.exam_id)) {
        continue;
      }

      const key = `${existing.student_id}_${existing.subject_id}_${existing.exam_id}`;
      const incoming = fetchedMap.get(key);

      if (incoming) {
        // Timestamp Guard: Compare incoming vs existing updated_at (Rule 6)
        if (incoming.updated_at && existing.updated_at) {
          const incomingTime = new Date(incoming.updated_at).getTime();
          const existingTime = new Date(existing.updated_at).getTime();

          if (!isNaN(incomingTime) && !isNaN(existingTime) && incomingTime <= existingTime) {
            fetchedMap.delete(key);
            continue;
          }
        }

        const markChanged =
          incoming.marks !== existing.marks ||
          incoming.raw_score !== existing.raw_score ||
          incoming.special_status !== existing.special_status ||
          incoming.irregularity_reason !== existing.irregularity_reason;

        if (markChanged) {
          updatedMarks[i] = { ...existing, ...incoming };
          cacheChanged = true;
          syntheticEvents.push({
            eventType: 'UPDATE',
            newRecord: incoming,
            oldRecord: existing,
            rawPayload: null,
          });
        }

        fetchedMap.delete(key);
      } else {
        // Record deleted from Supabase while disconnected (Rule 15 & Rule 16)
        updatedMarks.splice(i, 1);
        i--;
        cacheChanged = true;
        syntheticEvents.push({
          eventType: 'DELETE',
          newRecord: null,
          oldRecord: existing,
          rawPayload: null,
        });
      }
    }

    // 2. Add new records from Supabase
    for (const [_, incoming] of fetchedMap) {
      updatedMarks.push(incoming);
      cacheChanged = true;
      syntheticEvents.push({
        eventType: 'INSERT',
        newRecord: incoming,
        oldRecord: null,
        rawPayload: null,
      });
    }

    if (cacheChanged) {
      setStorage(KEYS.MARKS, updatedMarks);
    }

    // Dispatch synthetic events to registered callbacks (Stage 8B & 8C integration)
    if (syntheticEvents.length > 0) {
      syntheticEvents.forEach((evt) => {
        marksRealtimeCallbacks.forEach((cb) => {
          try {
            cb(evt);
          } catch (err) {
            console.error('[Realtime] Error in callback during recovery sync:', err);
          }
        });
      });
    }

    console.log(`[Realtime] Reconnection recovery completed. Synced ${syntheticEvents.length} changes.`);
  } catch (err) {
    console.error('[Realtime] Exception during reconnection recovery:', err);
    hasBeenDisconnected = true;
  } finally {
    isRecoveryInProgress = false;
  }
}

function processRealtimeMarkBatch(): void {
  if (pendingRealtimeMarkEvents.length === 0) return;

  const eventsToProcess = [...pendingRealtimeMarkEvents];
  pendingRealtimeMarkEvents = [];
  realtimeBatchTimeout = null;

  const currentMarks = getStorage<Mark[]>(KEYS.MARKS, []);
  let updatedMarks = [...currentMarks];
  let cacheChanged = false;

  for (const event of eventsToProcess) {
    const { eventType, newRecord, oldRecord } = event;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const rawData = newRecord;
      if (!rawData) continue;

      const mappedList = api.mapDatabaseMarks([rawData]);
      if (!mappedList || mappedList.length === 0) continue;
      const incomingMark = mappedList[0];

      if (!incomingMark.student_id || !incomingMark.subject_id || !incomingMark.exam_id) {
        continue;
      }

      // Find existing mark by primary ID or composite key (student_id, subject_id, exam_id)
      const existingIndex = updatedMarks.findIndex(
        (m) =>
          (incomingMark.id && m.id === incomingMark.id) ||
          (m.student_id === incomingMark.student_id &&
            m.subject_id === incomingMark.subject_id &&
            m.exam_id === incomingMark.exam_id)
      );

      if (existingIndex >= 0) {
        const existingMark = updatedMarks[existingIndex];

        // Timestamp Guard: Compare incoming vs existing updated_at
        if (incomingMark.updated_at && existingMark.updated_at) {
          const incomingTime = new Date(incomingMark.updated_at).getTime();
          const existingTime = new Date(existingMark.updated_at).getTime();

          // Reject equal or older updates (race-condition protection)
          if (!isNaN(incomingTime) && !isNaN(existingTime) && incomingTime <= existingTime) {
            continue;
          }
        }

        // Replace with newer mark record
        updatedMarks[existingIndex] = {
          ...existingMark,
          ...incomingMark,
          id: incomingMark.id || existingMark.id,
          student_id: incomingMark.student_id || existingMark.student_id,
          subject_id: incomingMark.subject_id || existingMark.subject_id,
          exam_id: incomingMark.exam_id || existingMark.exam_id,
        };
        cacheChanged = true;
      } else {
        // New record insert
        updatedMarks.push(incomingMark);
        cacheChanged = true;
      }
    } else if (eventType === 'DELETE') {
      const rawData = oldRecord || newRecord;
      if (!rawData) continue;

      const targetId = rawData.id;
      const targetStudentId = rawData.student_id;
      const targetSubjectId = rawData.subject_id;
      const targetExamId = rawData.exam_id;

      const prevLength = updatedMarks.length;
      updatedMarks = updatedMarks.filter((m) => {
        if (targetId && m.id === targetId) return false;
        if (
          targetStudentId &&
          targetSubjectId &&
          targetExamId &&
          m.student_id === targetStudentId &&
          m.subject_id === targetSubjectId &&
          m.exam_id === targetExamId
        ) {
          return false;
        }
        return true;
      });

      if (updatedMarks.length !== prevLength) {
        cacheChanged = true;
      }
    }
  }

  if (cacheChanged) {
    setStorage(KEYS.MARKS, updatedMarks);
  }

  // Notify registered callbacks for each processed event in the batch
  eventsToProcess.forEach((evt) => {
    marksRealtimeCallbacks.forEach((cb) => {
      try {
        cb(evt);
      } catch (err) {
        console.error('[Realtime] Error in marks realtime callback handler:', err);
      }
    });
  });
}

/**
 * Stage 8A/8B: Singleton Realtime Subscription Manager for public.marks
 */
export function subscribeToMarksRealtime(callback?: RealtimeMarkCallback): RealtimeMarkCallback | null {
  if (callback) {
    marksRealtimeCallbacks.add(callback);
  }

  // Reuse existing channel if already active
  if (marksRealtimeChannel) {
    return callback || null;
  }

  // Prevent duplicate concurrent channel initialization
  if (isInitializingMarksRealtimeChannel) {
    return callback || null;
  }

  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Realtime] Supabase client unavailable for marks subscription');
    return null;
  }

  isInitializingMarksRealtimeChannel = true;

  const initChannelWithAuth = async () => {
    try {
      // 1. Retrieve current authenticated session BEFORE creating channel
      const { data, error } = await client.auth.getSession();
      if (error) {
        console.warn('[Realtime] Error retrieving session for marks subscription:', error);
      }

      const token = data?.session?.access_token;
      if (!token) {
        console.warn('[Realtime] No active authenticated session found. Skipping Realtime channel creation.');
        return;
      }

      // 2. Supply authenticated JWT to Realtime socket manager (deduplicated)
      syncRealtimeAuth(token);

      // 3. Confirm callbacks are still registered and channel wasn't created concurrently
      if (marksRealtimeCallbacks.size === 0 || marksRealtimeChannel) {
        return;
      }

      // 4. Create channel and subscribe ONLY AFTER access_token has been supplied to client.realtime
      marksRealtimeChannel = client
        .channel('realtime-cbe-marks')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'marks',
          },
          (payload: any) => {
            const eventType = (payload.eventType || payload.type || 'UPDATE') as 'INSERT' | 'UPDATE' | 'DELETE';
            const newRecord = payload.new && Object.keys(payload.new).length > 0 ? payload.new : null;
            const oldRecord = payload.old && Object.keys(payload.old).length > 0 ? payload.old : null;

            const event: RealtimeMarkEvent = {
              eventType,
              newRecord,
              oldRecord,
              rawPayload: payload,
            };

            // Queue event for 150ms batch processing
            pendingRealtimeMarkEvents.push(event);

            if (!realtimeBatchTimeout) {
              realtimeBatchTimeout = setTimeout(processRealtimeMarkBatch, 150);
            }
          }
        )
        .subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Successfully subscribed to public.marks change stream');
            if (hasBeenDisconnected && !isInitialSubscription) {
              console.log('[Realtime] Reconnection detected. Triggering scoped marks reconciliation...');
              setConnectionStatus('syncing');
              await reconcileMarksOnReconnect();
            }
            hasBeenDisconnected = false;
            isInitialSubscription = false;
            setConnectionStatus('online');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn(`[Realtime] Marks subscription status changed: ${status}`, err || '');
            hasBeenDisconnected = true;
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              setConnectionStatus('offline');
            } else {
              setConnectionStatus('realtime_unavailable');
            }
          }
        });

      // Attach global online/offline listeners to catch browser-level disconnects/reconnects
      if (typeof window !== 'undefined' && !(window as any).__cbe_realtime_network_listeners_set) {
        (window as any).__cbe_realtime_network_listeners_set = true;
        window.addEventListener('offline', () => {
          console.warn('[Realtime] Network offline detected');
          hasBeenDisconnected = true;
        });
        window.addEventListener('online', () => {
          console.log('[Realtime] Network online restored. Checking for missed events...');
          if (hasBeenDisconnected && !isInitialSubscription) {
            reconcileMarksOnReconnect();
            hasBeenDisconnected = false;
          }
        });
      }
    } catch (err) {
      console.error('[Realtime] Failed to initialize marks realtime channel:', err);
      marksRealtimeChannel = null;
    } finally {
      isInitializingMarksRealtimeChannel = false;
    }
  };

  initChannelWithAuth();

  return callback || null;
}

/**
 * Stage 8A/8B: Unsubscribe a callback, or clean up the realtime channel if no callbacks remain
 */
export function unsubscribeFromMarksRealtime(callback?: RealtimeMarkCallback): void {
  if (callback) {
    marksRealtimeCallbacks.delete(callback);
  } else {
    marksRealtimeCallbacks.clear();
  }

  if (marksRealtimeCallbacks.size === 0 && marksRealtimeChannel) {
    if (realtimeBatchTimeout) {
      clearTimeout(realtimeBatchTimeout);
      realtimeBatchTimeout = null;
    }
    pendingRealtimeMarkEvents = [];

    const client = getSupabaseClient();
    if (client) {
      try {
        client.removeChannel(marksRealtimeChannel);
      } catch (err) {
        console.warn('[Realtime] Error removing marks channel:', err);
      }
    }
    marksRealtimeChannel = null;
    console.log('[Realtime] Unsubscribed from public.marks realtime channel');
  }
}

export async function testSupabaseConnection(customUrl?: string, customKey?: string) {
  const client = createSupabaseClient(customUrl, customKey);
  const creds = getSupabaseCredentials();
  const activeUrl = customUrl || creds.url;
  const activeKey = customKey || creds.anonKey;

  if (!client || !activeUrl || !activeKey) {
    return {
      success: false,
      url: activeUrl,
      hasKey: !!activeKey,
      tableReadSuccess: false,
      recordCount: 0,
      message: 'Supabase URL or Anon Key is missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      error: 'Credentials missing',
      fixInstructions: 'Provide your Supabase URL (e.g. https://xyz.supabase.co) and Anon API Key in environment variables or connection modal.'
    };
  }

  try {
    // 1. Read 'school_profile' table
    let { data, error } = await client.from('school_profile').select('*').limit(10);

    // If error because table does not exist
    if (error && (error.code === '42P01' || error.message.includes('does not exist') || error.message.includes('not found'))) {
      // Also check fallback 'schools' table
      const fallback = await client.from('schools').select('*').limit(10);
      if (!fallback.error) {
        data = fallback.data;
        error = null;
      } else {
        return {
          success: false,
          url: activeUrl,
          hasKey: true,
          tableReadSuccess: false,
          recordCount: 0,
          message: `Connected to Supabase client, but table 'school_profile' does not exist in your database. Exact error: ${error.message}`,
          error: error.message,
          fixInstructions: `To create the database schema:\n1. Copy the PostgreSQL DDL schema provided in the Supabase Modal.\n2. Open your Supabase Dashboard at ${activeUrl}\n3. Go to SQL Editor -> New Query, paste the schema, and click 'Run'.`
        };
      }
    }

    if (error) {
      const isPermissionDenied =
        error.code === '42501' ||
        error.message.toLowerCase().includes('permission denied') ||
        error.message.toLowerCase().includes('rls') ||
        error.message.toLowerCase().includes('row-level security');

      const fixInstructions = isPermissionDenied
        ? `Permission Denied Error (Code 42501):\nTo allow access to the school_profile table, run this SQL in your Supabase SQL Editor:\n\nGRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;\nGRANT SELECT ON public.school_profile TO anon;\nGRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;\nGRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;\n\nDROP POLICY IF EXISTS "Public read school_profile" ON public.school_profile;\nCREATE POLICY "Public read school_profile" ON public.school_profile FOR SELECT TO public, anon, authenticated USING (true);`
        : `Check table permissions or Row Level Security (RLS) policies in your Supabase Dashboard for table 'school_profile'.`;

      return {
        success: false,
        url: activeUrl,
        hasKey: true,
        tableReadSuccess: false,
        recordCount: 0,
        message: `Connected to Supabase client, but reading table 'school_profile' failed. Exact error: ${error.message}`,
        error: error.message,
        fixInstructions,
      };
    }

    // If table exists but is empty, seed initial school profile into Supabase
    if (data && data.length === 0) {
      const seedInsert = await client.from('school_profile').insert([{
        school_name: initialSchool.school_name || '',
        motto: initialSchool.motto || '',
        county: initialSchool.county || '',
        address: initialSchool.address || initialSchool.postal_code || '',
        email: initialSchool.email || '',
      }]).select('*');

      if (!seedInsert.error && seedInsert.data) {
        data = seedInsert.data;
      }
    }

    return {
      success: true,
      url: activeUrl,
      hasKey: true,
      tableReadSuccess: true,
      recordCount: data ? data.length : 0,
      records: data,
      message: `Supabase connection successful! Table 'school_profile' read successfully (${data ? data.length : 0} records).`,
    };
  } catch (err: any) {
    return {
      success: false,
      url: activeUrl,
      hasKey: true,
      tableReadSuccess: false,
      recordCount: 0,
      message: `Network or unexpected error while connecting to Supabase: ${err.message || err}`,
      error: err.message || String(err),
      fixInstructions: `Verify your network connection and confirm that the Supabase project URL is accessible.`
    };
  }
}

/**
 * Utility to standardize subject codes and subject names to the simplified CBE format.
 */
export function sanitizeSubject(sb: Subject): Subject {
  if (!sb) return sb;
  const code = (sb.subject_code || '').trim().toUpperCase();
  const name = (sb.subject_name || '').trim();
  const id = sb.id || '';

  let rawArea = sb.education_level || (sb as any).learning_area || '';
  let eduLevel = sb.education_level;
  if (!eduLevel) {
    if (rawArea === 'Upper Primary' || rawArea === 'Grade 4–6' || rawArea === 'Grade 4-6') {
      eduLevel = 'Upper Primary';
    } else if (rawArea === 'Junior School' || rawArea === 'Grade 7–9' || rawArea === 'Grade 7-9') {
      eduLevel = 'Junior School';
    } else if (rawArea === 'Lower Primary' || rawArea === 'Grade 1–3' || rawArea === 'Grade 1-3') {
      eduLevel = 'Lower Primary';
    } else if (rawArea === 'Pre-Primary' || rawArea === 'PP1–PP2') {
      eduLevel = 'Pre-Primary';
    } else if (rawArea === 'Grade 4–9') {
      if (code === 'AGR') eduLevel = 'Upper Primary';
      else eduLevel = 'Junior School';
    }
  }
  sb = { ...sb, education_level: eduLevel };

  let applicableGrades = sb.applicable_grades ? [...sb.applicable_grades] : [];

  // --- REPAIR KNOWN CURRICULUM MAPPINGS ---
  // --- PRE-PRIMARY (PP1 & PP2) ---
  // 1. Language Activities / LANG (Pre-Primary only)
  if (code === 'PP-LANG' || code === 'LANG' || code === 'LANG ACT' || name === 'Language' || name === 'Language Activities' || id === 'sb_pp_lang') {
    eduLevel = 'Pre-Primary';
    applicableGrades = ['PP1', 'PP2'];
    return {
      ...sb,
      subject_name: 'Language Activities',
      subject_code: 'PP-LANG',
      category: 'Activity',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 2. Psychomotor & Creative Activities / PSY-CRE (Pre-Primary only)
  else if (code === 'PP-PCA' || code === 'PSY-CRE' || code === 'PSYCH ACT' || name.includes('Psychomotor') || id === 'sb_pp_psy' || id === 'c38b548b-270c-4bc1-a5db-946801a1c8ae') {
    eduLevel = 'Pre-Primary';
    applicableGrades = ['PP1', 'PP2'];
    return {
      ...sb,
      subject_name: 'Psychomotor & Creative Activities',
      subject_code: 'PP-PCA',
      category: 'Activity',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 3. Environmental Activities (Pre-Primary)
  else if (code === 'PP-ENV' || code === 'ENV ACT' || id === 'sb_pp_env') {
    eduLevel = 'Pre-Primary';
    applicableGrades = ['PP1', 'PP2'];
    return {
      ...sb,
      subject_name: 'Environmental Activities',
      subject_code: 'PP-ENV',
      category: 'Activity',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }

  // --- LOWER PRIMARY (Grade 1 - 3) ---
  // 1. Integrated Learning Area (ILA)
  else if (code === 'ILA' || code === 'LP-ILA' || name === 'Integrated Learning Area' || id === 'sb_lp_ila') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
    return {
      ...sb,
      subject_name: 'Integrated Learning Area',
      subject_code: 'ILA',
      category: 'Core',
      department: 'Core',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 2. English (ENG)
  else if (id === 'sb_lp_eng' || code === 'LP-ENG' || code === 'ENG LP' || (sb.education_level === 'Lower Primary' && (code === 'ENG' || name.includes('English')))) {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
    return {
      ...sb,
      subject_name: 'English',
      subject_code: 'ENG',
      category: 'Core',
      department: 'Languages',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 3. Kiswahili (KIS)
  else if (id === 'sb_lp_kis' || code === 'LP-KSL' || code === 'KIS LP' || (sb.education_level === 'Lower Primary' && (code === 'KIS' || name.includes('Kiswahili')))) {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
    return {
      ...sb,
      subject_name: 'Kiswahili',
      subject_code: 'KIS',
      category: 'Core',
      department: 'Languages',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 4. Legacy Lower Primary activity mappings
  else if (
    code === 'LP-LIT' || code === 'LIT LP' || name === 'Literacy Activities' || id === 'sb_lp_lit'
  ) {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
    return {
      ...sb,
      subject_name: 'English',
      subject_code: 'ENG',
      category: 'Core',
      department: 'Languages',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  else if (
    code === 'LP-MATH' || code === 'MAT LP' || id === 'sb_lp_mat' ||
    code === 'LP-ENV' || code === 'ENV LP' || id === 'sb_lp_env' ||
    code === 'LP-HN' || code === 'HNG LP' || id === 'sb_lp_hng' ||
    code === 'LP-MCA' || code === 'CREAT LP' || id === 'sb_lp_crt' ||
    code === 'LP-CRE' || code === 'RE LP' || id === 'sb_lp_re'
  ) {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
    return {
      ...sb,
      subject_name: 'Integrated Learning Area',
      subject_code: 'ILA',
      category: 'Core',
      department: 'Core',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // --- UPPER PRIMARY (Grade 4 - 6) & JUNIOR SCHOOL (Grade 7 - 9) CANONICAL LEARNING AREAS ---
  // 1. English (ENG)
  else if (id === '823eba35-ac51-4ac8-be57-fcbeee88151c' || code === 'ENG' || id === 'sb_eng' || id === 'sb_up_eng' || code === 'ENG UP') {
    return {
      ...sb,
      subject_name: 'English',
      subject_code: 'ENG',
      education_level: sb.education_level || (sb as any).learning_area || 'Junior School',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
    };
  }
  // 2. Kiswahili (KIS) (KISW kept separate)
  else if (id === 'f00b5334-fa16-4640-b19c-733ec4530318' || code === 'KIS' || id === 'sb_kis') {
    return {
      ...sb,
      subject_name: 'Kiswahili',
      subject_code: 'KIS',
      education_level: sb.education_level || (sb as any).learning_area || 'Junior School',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
    };
  }
  else if (code === 'KISW' || id === 'sb_up_kis' || code === 'KIS UP') {
    return {
      ...sb,
      subject_name: sb.subject_name || 'Kiswahili',
      subject_code: 'KISW',
      education_level: sb.education_level || 'Upper Primary',
      applicable_grades: sb.applicable_grades || ['Grade 4', 'Grade 5', 'Grade 6'],
    };
  }

  // 3. Mathematics (MATH) (MATHS kept separate)
  else if (id === '4441b054-2d20-4d5c-852d-f31d16fbc145' || code === 'MATH' || code === 'MAT' || id === 'sb_mat') {
    return {
      ...sb,
      subject_name: 'Mathematics',
      subject_code: 'MATH',
      education_level: sb.education_level || (sb as any).learning_area || 'Junior School',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
    };
  }
  else if (code === 'MATHS' || id === 'sb_up_mat' || code === 'MAT UP') {
    return {
      ...sb,
      subject_name: sb.subject_name || 'Mathematics',
      subject_code: 'MATHS',
      education_level: sb.education_level || 'Upper Primary',
      applicable_grades: sb.applicable_grades || ['Grade 4', 'Grade 5', 'Grade 6'],
    };
  }
  // 4. Integrated Science (INT-SCI) - Applicable to BOTH Upper Primary (Grade 4-6) & Junior School (Grade 7-9)
  else if (
    id === 'b65c16d5-a38c-478e-ab46-085170ee31da' ||
    code === 'INT-SCI' ||
    code === 'INT SCI' ||
    code === 'INT/SCI' ||
    name === 'Integrated Science' ||
    (code === 'SCI' && name.includes('Integrated')) ||
    id === 'sb_sci'
  ) {
    return {
      ...sb,
      subject_name: 'Integrated Science',
      subject_code: 'INT-SCI',
      education_level: sb.education_level || (sb as any).learning_area || 'Grade 4–9',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
    };
  }
  // Science & Technology (SCT - legacy Upper Primary)
  else if (id === 'sb_up_sci' || code === 'SCI UP' || code === 'SCT' || code === 'SCI-TECH' || (name.includes('Science & Technology') || name.includes('Science and Technology'))) {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
    return {
      ...sb,
      subject_name: 'Science & Technology',
      subject_code: 'SCT',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 5. Upper Primary Social Studies & CRE (SS&CRE) - Grade 4-6
  else if (
    id === 'f8255683-1d59-46a7-881a-04a25d45d972' ||
    code === 'SS&CRE' ||
    code === 'SS & CRE' ||
    code === 'SS/CRE' ||
    code === 'SST&CRE' ||
    code === 'SST/CRE' ||
    name.includes('Social Studies&CRE') ||
    name.includes('Social Studies & CRE') ||
    name.includes('Social Studies and CRE') ||
    id === 'sb_up_ss_cre'
  ) {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
    return {
      ...sb,
      subject_name: 'Social Studies&CRE',
      subject_code: 'SS&CRE',
      category: 'Core',
      department: 'Humanities',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 6. Social Studies (SST) - Cross-Phase (Grade 4–9)
  else if (
    id === 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409' ||
    id === 'sb_sst' ||
    id === 'sb_up_sst' ||
    (code === 'SST' && id !== 'sb_up_ss_cre') ||
    (name === 'Social Studies' && id !== 'sb_up_ss_cre' && !name.includes('CRE'))
  ) {
    return {
      ...sb,
      subject_name: 'Social Studies',
      subject_code: 'SST',
      category: 'Core',
      department: 'Humanities',
      education_level: 'Grade 4–9',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'],
    };
  }
  // 7. Agriculture (AGN) - Junior School (Grade 7-9) only
  else if (code === 'AGR UP' || id === 'sb_up_agr') {
    return {
      ...sb,
      subject_name: 'Agriculture',
      subject_code: 'AGR',
      education_level: 'Upper Primary',
      applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'],
    };
  } else if (
    id === 'a9bf02ee-5e4e-46fa-b7d5-39f77657821f' ||
    id === 'fe17661a-9c3b-439e-9cb9-fd2f88279f56' ||
    code === 'AGN' ||
    code === 'AGR' ||
    id === 'sb_agn' ||
    name === 'Agriculture' ||
    name.includes('Agriculture') ||
    name.includes('Nutrition')
  ) {
    return {
      ...sb,
      subject_name: 'Agriculture',
      subject_code: 'AGN',
      category: sb.category || 'Core',
      education_level: 'Junior School',
      applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'],
    };
  }
  // 8. Creative Arts (CA)
  else if (id === 'sb_up_crt' || code === 'CREAT UP' || code === 'CA') {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
    return {
      ...sb,
      subject_name: 'Creative Arts',
      subject_code: 'CA',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 9. Creative Activities (Lower Primary only: Grade 1-3)
  else if (code === 'CREAT' || code === 'CREAT LP' || name === 'Creative' || name === 'Creative Activities' || id === 'sb_lp_crt') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
  }
  // 10. Pre-Technical Studies (Junior School only: Grade 7-9)
  else if (code === 'PRE TECH' || code === 'PRE-TECH' || code === 'PTS' || name.includes('Pre-Technical') || id === 'sb_pts') {
    eduLevel = 'Junior School';
    applicableGrades = ['Grade 7', 'Grade 8', 'Grade 9'];
    return {
      ...sb,
      subject_name: 'Pre-Technical Studies',
      subject_code: 'PRE-TECH',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 11. Creative Arts and Sports (CAS)
  else if (code === 'CAS' || name.includes('Creative Arts & Sports') || name.includes('Creative Arts and Sports') || id === 'sb_cas') {
    eduLevel = sb.education_level || 'Junior School';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
    return {
      ...sb,
      subject_name: 'Creative Arts and Sports',
      subject_code: 'CAS',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 12. Social Studies fallbacks (Cross-Phase Grade 4-9)
  else if (code === 'SST UP' || code === 'SST' || name === 'Social Studies' || id === 'sb_sst' || id === 'sb_up_sst') {
    eduLevel = 'Grade 4–9';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
    return {
      ...sb,
      subject_name: 'Social Studies',
      subject_code: 'SST',
      category: 'Core',
      department: 'Humanities',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 10. Mathematics
  else if (code === 'PP-MATH' || code === 'MATH ACT' || id === 'sb_pp_math') {
    eduLevel = 'Pre-Primary';
    applicableGrades = ['PP1', 'PP2'];
    return {
      ...sb,
      subject_name: 'Mathematical Activities',
      subject_code: 'PP-MATH',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  } else if (code === 'MAT LP' || id === 'sb_lp_mat') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
    return {
      ...sb,
      subject_name: 'Integrated Learning Area',
      subject_code: 'ILA',
      category: 'Core',
      department: 'Core',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 11. English
  else if (code === 'ENG LP' || id === 'sb_lp_eng') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
    return {
      ...sb,
      subject_name: 'English',
      subject_code: 'ENG',
      category: 'Core',
      department: 'Languages',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 12. Kiswahili
  else if (code === 'KIS LP' || id === 'sb_lp_kis') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
    return {
      ...sb,
      subject_name: 'Kiswahili',
      subject_code: 'KIS',
      category: 'Core',
      department: 'Languages',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 13. Agriculture
  else if (code === 'AGR UP' || id === 'sb_up_agr') {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
  } else if (code === 'AGR' || code === 'AGN' || name.includes('Agriculture') || name.includes('Nutrition') || id === 'sb_agn') {
    eduLevel = 'Junior School';
    applicableGrades = ['Grade 7', 'Grade 8', 'Grade 9'];
    return {
      ...sb,
      subject_name: 'Agriculture',
      subject_code: 'AGN',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 14. CRE / Religious Education
  else if (
    code === 'PP-CRE' ||
    code === 'PP-RE' ||
    code === 'CRE' ||
    code === 'RE' ||
    code === 'RE ACT' ||
    code === 'RE LP' ||
    code === 'RE UP' ||
    code === 'C.R.E' ||
    name.includes('Religious') ||
    name.toUpperCase() === 'CRE' ||
    id === 'sb_cre' ||
    id === 'sb_pp_re' ||
    id === 'sb_lp_re' ||
    id === 'sb_up_re'
  ) {
    if (id === 'sb_lp_re' || code === 'LP-CRE' || code === 'RE LP' || (sb.education_level === 'Lower Primary' && (code === 'CRE' || name.includes('Religious')))) {
      eduLevel = 'Lower Primary';
      applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
      return {
        ...sb,
        subject_name: 'Integrated Learning Area',
        subject_code: 'ILA',
        category: 'Core',
        department: 'Core',
        education_level: eduLevel,
        applicable_grades: applicableGrades,
      };
    } else if (id === 'sb_pp_re' || code === 'PP-CRE' || code === 'PP-RE' || code === 'RE ACT' || (sb.education_level === 'Pre-Primary' && (code === 'CRE' || name.includes('Religious')))) {
      eduLevel = 'Pre-Primary';
      applicableGrades = ['PP1', 'PP2'];
      return {
        ...sb,
        subject_name: 'Christian Religious Education Activities',
        subject_code: 'PP-CRE',
        category: 'Activity',
        education_level: eduLevel,
        applicable_grades: applicableGrades,
      };
    } else if (
      id === 'e784b5fc-dab9-4105-bb49-fce1d1a84cf7' ||
      id === 'sb_cre' ||
      id === 'sb_up_cre' ||
      code === 'CRE' ||
      name === 'Christian Religious Education'
    ) {
      eduLevel = 'Grade 4–9';
      applicableGrades = [
        'Grade 4', 'Grade 5', 'Grade 6',
        'Grade 7', 'Grade 8', 'Grade 9',
      ];
      return {
        ...sb,
        subject_name: 'Christian Religious Education',
        subject_code: 'CRE',
        category: 'Core',
        department: 'Humanities',
        education_level: eduLevel,
        applicable_grades: applicableGrades,
      };
    } else if (id === 'sb_up_re' || code === 'RE UP' || (sb.education_level === 'Upper Primary' && name.includes('Religious') && !name.includes('Christian Religious Education'))) {
      eduLevel = 'Upper Primary';
      applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
      return {
        ...sb,
        subject_name: 'Social Studies&CRE',
        subject_code: 'SS&CRE',
        category: 'Core',
        department: 'Humanities',
        education_level: eduLevel,
        applicable_grades: applicableGrades,
      };
    } else {
      eduLevel = sb.education_level || 'Grade 4–9';
      applicableGrades = sb.applicable_grades && sb.applicable_grades.length > 0
        ? sb.applicable_grades
        : LEVEL_TO_GRADES[eduLevel] || ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
    }
    return {
      ...sb,
      subject_name: 'Christian Religious Education',
      subject_code: 'CRE',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }

  if (!eduLevel) {
    if (applicableGrades.length > 0) {
      eduLevel = getEducationLevelForGrade(applicableGrades[0]);
    } else {
      eduLevel = 'Junior School';
    }
  }

  if (!applicableGrades || applicableGrades.length === 0) {
    applicableGrades = LEVEL_TO_GRADES[eduLevel] || [];
  }

  return {
    ...sb,
    subject_code: code,
    subject_name: name,
    education_level: eduLevel,
    applicable_grades: applicableGrades,
  };
}

/**
 * Utility to standardize and sanitize ClassStream objects, ensuring stream name and properties are never lost.
 */
export function sanitizeClass(c: any): ClassStream {
  if (!c) {
    return {
      id: `cls_${Date.now()}`,
      class_name: 'Grade 7',
      stream: 'Blue',
      capacity: 40,
      education_level: 'Junior School',
      status: 'Active',
      allocated_subject_ids: [],
    };
  }

  let classNameStr = (c.class_name || c.grade || 'Grade 7').trim();
  let rawStream = (c.stream !== undefined && c.stream !== null ? String(c.stream) : (c.stream_name || c.name || '')).trim();

  // If rawStream is empty or matches ID format like cls_8a, extract stream if possible
  if ((!rawStream || rawStream.toLowerCase() === classNameStr.toLowerCase() || /^cls_/i.test(rawStream)) && classNameStr) {
    const match = classNameStr.match(/cls_\d+([a-zA-Z]+)|^(PP1|PP2|Grade\s*\d+)\s*[\-\|•\(\s]\s*([A-Za-z0-9\s]+)\)?$/i);
    if (match) {
      if (match[1]) {
        const s = match[1].toUpperCase();
        rawStream = s === 'E' ? 'East' : s === 'W' ? 'West' : s === 'A' ? 'A' : s === 'B' ? 'Blue' : s;
      } else if (match[2]) {
        classNameStr = match[2] ? classNameStr : match[1].replace(/\s+/g, ' ').trim();
        rawStream = match[2].trim();
      }
    }
  }

  const className = normalizeGradeName(classNameStr);
  const eduLevel = c.education_level || getEducationLevelForGrade(className);

  return {
    id: String(c.id || `cls_${Date.now()}`),
    stream_id: c.stream_id ? String(c.stream_id) : undefined,
    class_name: className,
    stream: rawStream,
    capacity: typeof c.capacity === 'number' && c.capacity > 0 ? c.capacity : (c.capacity ? Number(c.capacity) : 40),
    class_teacher_id: c.class_teacher_id || undefined,
    education_level: eduLevel,
    status: c.status === 'Inactive' ? 'Inactive' : 'Active',
    allocated_subject_ids: Array.isArray(c.allocated_subject_ids) ? c.allocated_subject_ids : [],
  };
}

/**
 * Asynchronously sync class changes to Supabase authoritatively
 */
async function syncClassToSupabase(cls: ClassStream): Promise<void> {
  const client = createSupabaseClient();
  if (!client) return;

  // 1. Check if class exists in Supabase by UUID or class_name
  let classObj: any = null;
  let createdNewClassId: string | null = null;

  if (cls.id && isUUID(cls.id)) {
    const { data: classById, error: classByIdErr } = await client.from('classes').select('*').eq('id', cls.id).maybeSingle();
    if (classByIdErr) {
      console.error('Supabase query class by ID error:', classByIdErr);
      throw classByIdErr;
    }
    if (classById) {
      classObj = classById;
    }
  }

  if (!classObj && cls.class_name) {
    const { data: existingClasses, error: cSelErr } = await client.from('classes').select('*').ilike('class_name', cls.class_name);
    if (cSelErr) {
      console.error('Supabase query class by name error:', cSelErr);
      throw cSelErr;
    }
    classObj = existingClasses?.[0];
  }

  if (!classObj) {
    const gradeLevelNum = getGradeOrderIndex(cls.class_name);
    const classPayload: any = {
      class_name: cls.class_name,
      grade_level: gradeLevelNum >= 0 && gradeLevelNum <= 12 ? gradeLevelNum : 0,
      capacity: cls.capacity || 40,
    };
    if (cls.id && isUUID(cls.id)) {
      classPayload.id = cls.id;
    }
    const { data: createdClass, error: cInsErr } = await client.from('classes').insert([classPayload]).select('*');
    if (cInsErr) {
      console.error('Supabase insert class error:', cInsErr);
      throw cInsErr;
    }
    if (!createdClass || createdClass.length === 0) {
      throw new Error(`Failed to create class "${cls.class_name}" in database.`);
    }
    classObj = createdClass[0];
    createdNewClassId = classObj.id;
  } else if (cls.capacity && classObj.capacity !== cls.capacity) {
    const { error: cUpdErr } = await client.from('classes').update({ capacity: cls.capacity }).eq('id', classObj.id);
    if (cUpdErr) {
      console.warn('Supabase update class capacity warning:', cUpdErr);
    }
  }

  if (classObj) {
    cls.id = classObj.id;
    const streamName = cls.stream || 'A';

    let existingStreams: any[] | null = null;
    if (cls.stream_id && isUUID(cls.stream_id)) {
      const { data: strmById, error: sIdErr } = await client.from('streams').select('*').eq('id', cls.stream_id);
      if (sIdErr) {
        if (createdNewClassId) {
          try {
            await client.from('classes').delete().eq('id', createdNewClassId);
          } catch (rbErr) {
            console.error('Failed to rollback orphan class after stream lookup failure:', rbErr);
          }
        }
        console.error('Supabase query stream by ID error:', sIdErr);
        throw sIdErr;
      }
      if (strmById && strmById.length > 0) {
        existingStreams = strmById;
      }
    }

    if (!existingStreams || existingStreams.length === 0) {
      const { data: strmByName, error: sNameErr } = await client.from('streams').select('*').eq('class_id', classObj.id).ilike('stream_name', streamName);
      if (sNameErr) {
        if (createdNewClassId) {
          try {
            await client.from('classes').delete().eq('id', createdNewClassId);
          } catch (rbErr) {
            console.error('Failed to rollback orphan class after stream lookup failure:', rbErr);
          }
        }
        console.error('Supabase query stream by name error:', sNameErr);
        throw sNameErr;
      }
      existingStreams = strmByName;
    }

    if (!existingStreams || existingStreams.length === 0) {
      const streamPayload: any = {
        class_id: classObj.id,
        stream_name: streamName,
        capacity: cls.capacity || 40,
        class_teacher_id: (cls.class_teacher_id && isUUID(cls.class_teacher_id)) ? cls.class_teacher_id : null,
      };
      if (cls.stream_id && isUUID(cls.stream_id)) {
        streamPayload.id = cls.stream_id;
      }
      const { data: createdStream, error: sInsErr } = await client.from('streams').insert([streamPayload]).select('*');
      if (sInsErr) {
        if (createdNewClassId) {
          try {
            await client.from('classes').delete().eq('id', createdNewClassId);
          } catch (rbErr) {
            console.error('Failed to rollback orphan class after stream insert failure:', rbErr);
          }
        }
        console.error('Supabase insert stream error:', sInsErr);
        throw sInsErr;
      }
      if (createdStream && createdStream[0]) {
        cls.stream_id = createdStream[0].id;
      }
    } else {
      const targetStreamId = existingStreams[0].id;
      const streamUpdatePayload: any = {
        stream_name: streamName,
        capacity: cls.capacity || 40,
      };
      const { error: sUpdErr } = await client.from('streams').update(streamUpdatePayload).eq('id', targetStreamId);
      if (sUpdErr) {
        if (createdNewClassId) {
          try {
            await client.from('classes').delete().eq('id', createdNewClassId);
          } catch (rbErr) {
            console.error('Failed to rollback orphan class after stream update failure:', rbErr);
          }
        }
        console.error('Supabase update stream error:', sUpdErr);
        throw sUpdErr;
      }
      cls.stream_id = targetStreamId;
    }
  }
}

export async function resolveStudentClassAndStreamUuids(
  classOrStreamId: string,
  client: any,
  streamHint?: string | null
): Promise<{ class_id: string | null; stream_id: string | null }> {
  if (!client) {
    return { class_id: null, stream_id: null };
  }

  const rawId = (classOrStreamId || '').trim();
  const rawStreamHint = (streamHint || '').trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // 1. If rawStreamHint itself is a valid Stream UUID in streams table
  if (rawStreamHint && uuidRegex.test(rawStreamHint)) {
    const { data: streamMatch } = await client.from('streams').select('id, class_id').eq('id', rawStreamHint).maybeSingle();
    if (streamMatch) {
      return { class_id: streamMatch.class_id, stream_id: streamMatch.id };
    }
  }

  // 2. If rawId is a valid UUID
  if (rawId && uuidRegex.test(rawId)) {
    // Check if rawId is in streams table
    const { data: streamMatch } = await client.from('streams').select('id, class_id').eq('id', rawId).maybeSingle();
    if (streamMatch) {
      return { class_id: streamMatch.class_id, stream_id: streamMatch.id };
    }

    // Check if rawId is in classes table
    const { data: classMatch } = await client.from('classes').select('id').eq('id', rawId).maybeSingle();
    if (classMatch) {
      // If streamHint is provided as a stream name (e.g. "Blue", "Red", "East")
      if (rawStreamHint && !uuidRegex.test(rawStreamHint)) {
        const { data: namedStream } = await client
          .from('streams')
          .select('id')
          .eq('class_id', classMatch.id)
          .ilike('stream_name', rawStreamHint)
          .maybeSingle();
        if (namedStream) {
          return { class_id: classMatch.id, stream_id: namedStream.id };
        }
      }
      const { data: defaultStream } = await client.from('streams').select('id').eq('class_id', classMatch.id).limit(1);
      return { class_id: classMatch.id, stream_id: defaultStream?.[0]?.id || null };
    }
  }

  // 3. If not a UUID or not found in DB by UUID, resolve via local cache or name matching
  const localClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
  const matchedLocalClass = localClasses.find(
    (c) => (rawStreamHint && c.stream_id === rawStreamHint) ||
           (rawId && c.stream_id === rawId) ||
           (rawId && c.id === rawId && (!rawStreamHint || (c.stream || '').toLowerCase() === rawStreamHint.toLowerCase())) ||
           `${c.class_name} ${c.stream}`.trim().toLowerCase() === rawId.toLowerCase() ||
           c.class_name.toLowerCase() === rawId.toLowerCase()
  );

  let className = matchedLocalClass ? matchedLocalClass.class_name : normalizeGradeName(rawId);
  let streamName = matchedLocalClass ? (matchedLocalClass.stream || 'A') : (rawStreamHint || 'A');

  if (!matchedLocalClass && rawId) {
    const match = rawId.match(/cls_\d+([a-zA-Z]+)|^(PP1|PP2|Grade\s*\d+)\s*[\-\|•\(\s]\s*([A-Za-z0-9\s]+)\)?$/i);
    if (match) {
      if (match[1]) {
        const s = match[1].toUpperCase();
        streamName = s === 'E' ? 'East' : s === 'W' ? 'West' : s === 'A' ? 'A' : s === 'B' ? 'Blue' : s;
      } else if (match[2]) {
        className = match[2] ? className : match[1].replace(/\s+/g, ' ').trim();
        streamName = rawStreamHint || match[2].trim();
      }
    }
  }

  if (rawStreamHint && !uuidRegex.test(rawStreamHint)) {
    streamName = rawStreamHint;
  }

  className = normalizeGradeName(className);

  // Query or create class in Supabase
  let { data: dbClasses } = await client.from('classes').select('id').ilike('class_name', className);
  let classId = dbClasses?.[0]?.id;

  if (!classId) {
    const gradeLevelNum = getGradeOrderIndex(className as GradeName);
    const { data: newClass } = await client.from('classes').insert([{
      class_name: className,
      grade_level: gradeLevelNum >= 0 && gradeLevelNum <= 12 ? gradeLevelNum : 7,
      capacity: matchedLocalClass?.capacity || 40,
    }]).select('id');
    classId = newClass?.[0]?.id;
  }

  if (classId) {
    let { data: dbStreams } = await client.from('streams').select('id, class_id').eq('class_id', classId).ilike('stream_name', streamName);
    let streamId = dbStreams?.[0]?.id;

    if (!streamId) {
      let { data: anyStreams } = await client.from('streams').select('id, class_id').eq('class_id', classId).limit(1);
      if (anyStreams && anyStreams[0] && !rawStreamHint) {
        streamId = anyStreams[0].id;
      } else {
        const { data: newStream } = await client.from('streams').insert([{
          class_id: classId,
          stream_name: streamName,
          capacity: matchedLocalClass?.capacity || 40,
        }]).select('id');
        streamId = newStream?.[0]?.id;
      }
    }

    return { class_id: classId, stream_id: streamId || null };
  }

  // Fallback: query any class from Supabase
  const { data: anyClass } = await client.from('classes').select('id').limit(1);
  if (anyClass && anyClass[0]) {
    const { data: anyStream } = await client.from('streams').select('id').eq('class_id', anyClass[0].id).limit(1);
    return { class_id: anyClass[0].id, stream_id: anyStream?.[0]?.id || null };
  }

  return { class_id: null, stream_id: null };
}

// Startup sync deduplication state
let syncInProgressPromise: Promise<boolean> | null = null;
let hasCompletedSync = false;
let currentSyncGeneration = 0;

export function resetSyncState(): void {
  hasCompletedSync = false;
  syncInProgressPromise = null;
  currentSyncGeneration++;
}

export function hasCompletedStartupSync(): boolean {
  return hasCompletedSync;
}

/**
 * Fetch and load real data from Supabase tables into local cache
 */
export function syncFromSupabase(options?: { force?: boolean }): Promise<boolean> {
  // If sync is already running, return the in-flight promise to deduplicate concurrent calls
  if (syncInProgressPromise) {
    return syncInProgressPromise;
  }

  // If startup sync already completed for this session and force is not requested, skip duplicate sync
  if (hasCompletedSync && !options?.force) {
    return Promise.resolve(true);
  }

  const syncGen = ++currentSyncGeneration;

  syncInProgressPromise = (async () => {
    const client = createSupabaseClient();
    if (!client) return false;

    // Safety boundary: verify active authenticated session BEFORE dispatching protected queries
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if ((sessionError || !sessionData?.session?.user) && process.env.NODE_ENV !== 'test') {
      return false;
    }

    try {
      // 1. Fetch School Profile
      const { data: schoolData } = await client.from('school_profile').select('*').limit(1);
      if (schoolData && schoolData.length > 0) {
        const sp = schoolData[0];
        const postalVal = sp.postal_code || sp.address || initialSchool.postal_code || initialSchool.address || '';
        const schoolObj: School = {
          id: sp.id || initialSchool.id,
          school_name: sp.school_name || sp.name || initialSchool.school_name || '',
          motto: sp.motto || sp.school_motto || initialSchool.motto || '',
          county: sp.county || initialSchool.county || '',
          postal_code: postalVal,
          address: postalVal,
          email: sp.email || sp.email_address || initialSchool.email || '',
        };
        setStorage(KEYS.SCHOOL, schoolObj);
      }

    // 1b. Fetch Users from public.users
    const { data: userData } = await client.from('users').select('*');
    if (userData && userData.length > 0) {
      api.syncUsersFromDatabase(userData);
    }

    const currentUser = api.getCurrentUser();
    const isSubjectTeacher = currentUser?.role === 'subject_teacher';
    const isClassTeacher = currentUser?.role === 'class_teacher';
    const isLearner = currentUser?.role === 'learner';
    const isAdmin = !currentUser || currentUser?.role === 'admin';

    // 2. Fetch Teachers & Teacher Allocations first to resolve role-based server-side scopes
    const { data: teacherData, error: teacherError } = await client.from('teachers').select('*');
    const { data: teacherSubjectsData, error: teacherSubjectsError } = await client.from('teacher_subjects').select('*');

    // For learners: fetch safe display identity (name & email) of assigned stream class teachers
    if (isLearner) {
      try {
        const ctRes = await fetch(buildApiUrl('/api/learner/class-teachers'));
        if (ctRes.ok) {
          const ctJson = await ctRes.json();
          if (ctJson && Array.isArray(ctJson.teachers) && ctJson.teachers.length > 0) {
            const safeClassTeachers = ctJson.teachers.map((t: any) => ({
              id: t.id,
              teacher_name: t.teacher_name,
              email: t.email,
              is_class_teacher: true,
              status: 'Active',
            }));
            setStorage(KEYS.TEACHERS, safeClassTeachers);
          }
        }
      } catch (e) {
        console.warn('Could not fetch assigned class teachers for learner:', e);
      }
    }

    let scopedClassIds: string[] | null = null;
    let scopedStreamIds: string[] | null = null;
    let scopedSubjectIds: string[] | null = null;

    if (isSubjectTeacher || isClassTeacher) {
      const activeTeacher = getActiveTeacher(currentUser, teacherData || getStorage<Teacher[]>(KEYS.TEACHERS, []));

      const assignedClassIdSet = new Set<string>();
      const assignedStreamIdSet = new Set<string>();
      const assignedSubjectIdSet = new Set<string>();

      // A. Allocations from teacher_subjects
      const myTS = (teacherSubjectsData || []).filter((ts: any) => activeTeacher && ts.teacher_id === activeTeacher.id);
      myTS.forEach((ts: any) => {
        if (ts.class_id) assignedClassIdSet.add(ts.class_id);
        if (ts.stream_id) assignedStreamIdSet.add(ts.stream_id);
        if (ts.subject_id) assignedSubjectIdSet.add(ts.subject_id);
      });

      // B. Allocations from activeTeacher object
      if (activeTeacher?.allocations && Array.isArray(activeTeacher.allocations)) {
        activeTeacher.allocations.forEach((alloc: any) => {
          if (alloc.class_id) assignedClassIdSet.add(alloc.class_id);
          if (alloc.stream_id) assignedStreamIdSet.add(alloc.stream_id);
          if (alloc.subject_id) assignedSubjectIdSet.add(alloc.subject_id);
        });
      }

      // C. Class teacher designation from Supabase authoritative relationship: streams.class_teacher_id === teacher.id
      if (activeTeacher?.id) {
        const { data: ctStreams } = await client.from('streams').select('id, class_id').eq('class_teacher_id', activeTeacher.id);
        if (ctStreams && ctStreams.length > 0) {
          ctStreams.forEach((st: any) => {
            if (st.id) assignedStreamIdSet.add(st.id);
            if (st.class_id) assignedClassIdSet.add(st.class_id);
          });
        }
      } else if (activeTeacher?.class_teacher_of_id) {
        assignedStreamIdSet.add(activeTeacher.class_teacher_of_id);
        assignedClassIdSet.add(activeTeacher.class_teacher_of_id);
      }

      // D. Resolve stream -> class mapping
      if (assignedStreamIdSet.size > 0) {
        const { data: stMap } = await client.from('streams').select('id, class_id').in('id', Array.from(assignedStreamIdSet));
        if (stMap && stMap.length > 0) {
          stMap.forEach((st: any) => {
            if (st.class_id) assignedClassIdSet.add(st.class_id);
          });
        }
      }

      // E. Resolve class -> stream mapping
      if (assignedClassIdSet.size > 0) {
        const { data: clMap } = await client.from('streams').select('id, class_id').in('class_id', Array.from(assignedClassIdSet));
        if (clMap && clMap.length > 0) {
          clMap.forEach((st: any) => {
            if (st.id) assignedStreamIdSet.add(st.id);
          });
        }
      }

      // F. For Class Teachers: include subjects belonging to their class education level / grades (Lower Primary special rule)
      if (isClassTeacher && assignedClassIdSet.size > 0) {
        const { data: ctClasses } = await client.from('classes').select('id, class_name, education_level').in('id', Array.from(assignedClassIdSet));
        if (ctClasses && ctClasses.length > 0) {
          const eduLevels = new Set<string>();
          ctClasses.forEach((c: any) => {
            const lvl = c.education_level || getEducationLevelForGrade(c.class_name);
            if (lvl) eduLevels.add(lvl);
          });

          if (eduLevels.size > 0) {
            const { data: lvlSubjects } = await client.from('subjects').select('id, education_level').in('education_level', Array.from(eduLevels));
            if (lvlSubjects && lvlSubjects.length > 0) {
              lvlSubjects.forEach((s: any) => {
                if (s.id) assignedSubjectIdSet.add(s.id);
              });
            }
          }
        }
      }

      scopedClassIds = Array.from(assignedClassIdSet);
      scopedStreamIds = Array.from(assignedStreamIdSet);
      if (isSubjectTeacher) {
        scopedSubjectIds = Array.from(assignedSubjectIdSet);
      } else {
        scopedSubjectIds = null;
      }
    }

    // 3. Fetch Classes & Streams
    const { data: classData, error: classError } = await client.from('classes').select('*');
    const { data: streamData, error: streamError } = await client.from('streams').select('*');

    let currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    if (!classError && classData) {
      const existing = getStorage<ClassStream[]>(KEYS.CLASSES, []);
      const merged: ClassStream[] = [];

      classData.forEach((c: any) => {
        const cStreams = (streamData || []).filter((s: any) => s.class_id === c.id);
        if (cStreams.length > 0) {
          cStreams.forEach((st: any) => {
            const cleanName = c.class_name;
            const eduLevel = c.education_level || getEducationLevelForGrade(cleanName);
            const match = existing.find((e) =>
              (e.stream_id && e.stream_id === st.id) ||
              (e.id === c.id && (e.stream || '').toLowerCase() === (st.stream_name || '').toLowerCase()) ||
              (e.class_name.toLowerCase() === cleanName.toLowerCase() && (e.stream || '').toLowerCase() === (st.stream_name || '').toLowerCase())
            );

            merged.push(sanitizeClass({
              id: c.id,
              stream_id: st.id,
              class_name: cleanName,
              stream: st.stream_name || 'A',
              capacity: st.capacity || c.capacity || 40,
              class_teacher_id: st.class_teacher_id || undefined,
              education_level: eduLevel,
              status: c.status || 'Active',
              allocated_subject_ids: match?.allocated_subject_ids || [],
            }));
          });
        } else {
          const clean = sanitizeClass(c);
          const match = existing.find((e) => e.id === clean.id) ||
                        existing.find((e) => e.class_name.toLowerCase() === clean.class_name.toLowerCase());
          if (match) {
            if (!clean.stream && match.stream) clean.stream = match.stream;
            if ((!clean.allocated_subject_ids || clean.allocated_subject_ids.length === 0) && match.allocated_subject_ids) {
              clean.allocated_subject_ids = match.allocated_subject_ids;
            }
          }
          merged.push(clean);
        }
      });

      setStorage(KEYS.CLASSES, merged);
      currentClasses = merged;
    } else if (classError) {
      console.warn('Error fetching classes from Supabase:', classError);
    }

    // 4. Fetch Students from public.students or allocated_students (for Subject Teachers)
    let studentData: any[] | null = null;
    let studentError: any = null;

    if (isSubjectTeacher) {
      // For Subject Teachers, fetch authorised students using the allocated_students view
      const res = await client.from('allocated_students').select('*');
      if (!res.error && res.data && res.data.length > 0) {
        studentData = res.data;
        studentError = null;
      } else {
        // Fallback: Query public.students directly (authorized by Teacher select assigned students policy)
        const directRes = await client.from('students').select('*');
        if (!directRes.error && directRes.data) {
          studentData = directRes.data;
          studentError = null;
        } else {
          studentData = res.data || directRes.data || null;
          studentError = res.error || directRes.error || null;
        }
      }
    } else if (isLearner) {
      // For Learners: fetch ONLY their own student record bound by currentUser.student_id or user mapping
      let resolvedStudentId = currentUser?.student_id;
      if (!resolvedStudentId && currentUser?.id && userData) {
        const matchingDbUser = userData.find((u: any) => u.id === currentUser.id);
        if (matchingDbUser?.student_id) {
          resolvedStudentId = matchingDbUser.student_id;
        }
      }

      if (resolvedStudentId) {
        let res;
        if (isUUID(resolvedStudentId)) {
          res = await client.from('students').select('*').eq('id', resolvedStudentId);
        } else {
          res = await client.from('students').select('*').eq('admission_number', resolvedStudentId);
        }
        studentData = res.data;
        studentError = res.error;
      }

      // Fallback: Check by email prefix or direct select under RLS
      if (!studentData || studentData.length === 0) {
        if (currentUser?.email) {
          const emailAdm = currentUser.email.split('@')[0];
          const admRes = await client.from('students').select('*').eq('admission_number', emailAdm).limit(1);
          if (admRes.data && admRes.data.length > 0) {
            studentData = admRes.data;
            studentError = null;
          }
        }
        if (!studentData || studentData.length === 0) {
          const directRes = await client.from('students').select('*');
          if (!directRes.error && directRes.data && directRes.data.length > 0) {
            studentData = directRes.data;
            studentError = null;
          }
        }
      }
    } else {
      // For Administrators and Class Teachers, query public.students directly
      const res = await client.from('students').select('*');
      studentData = res.data;
      studentError = res.error;

      // Fallback: If querying public.students fails with RLS permission error (code 42501), check allocated_students
      if (studentError && (studentError.code === '42501' || studentError.message?.toLowerCase().includes('permission denied'))) {
        const fallbackRes = await client.from('allocated_students').select('*');
        if (!fallbackRes.error && fallbackRes.data) {
          studentData = fallbackRes.data;
          studentError = null;
        }
      }
    }

    if (!studentError && studentData) {
      const isDemoOrTestStudent = (s: any) => {
        const id = String(s.id || '');
        const adm = String(s.admission_number || '');
        const name = String(s.full_name || '');
        return (
          id.startsWith('std_test_') ||
          id.startsWith('test_') ||
          id.startsWith('student-midterm-') ||
          id.startsWith('student-future-') ||
          adm === 'ADM-9001' ||
          adm === 'ADM-9002' ||
          adm.startsWith('TEST_') ||
          adm.startsWith('ADM-900') ||
          adm === 'ADM-2026-050' ||
          adm === 'ADM-2026-055' ||
          adm === 'ADM-2026-077' ||
          adm === 'ADM-2026-081' ||
          adm === 'ADM-2026-082' ||
          adm === 'ADM-2026-090' ||
          adm === 'ADM-2026-100' ||
          name === 'Alice Wambui' ||
          name === 'Brian Kipchoge' ||
          name === 'David Kiprono' ||
          name === 'Kevin Omondi' ||
          name === 'Zahra Hassan' ||
          name === 'Cynthia Atieno' ||
          name === 'Grace Muthoni'
        );
      };

      const demoOrTestStudents = studentData.filter(isDemoOrTestStudent);
      if (demoOrTestStudents.length > 0 && client) {
        const idsToDelete = demoOrTestStudents.map((s: any) => s.id).filter(Boolean);
        const admsToDelete = demoOrTestStudents.map((s: any) => s.admission_number).filter(Boolean);
        (async () => {
          try {
            if (idsToDelete.length > 0) {
              await client.from('marks').delete().in('student_id', idsToDelete);
              await client.from('students').delete().in('id', idsToDelete);
            }
            if (admsToDelete.length > 0) {
              await client.from('students').delete().in('admission_number', admsToDelete);
            }
          } catch {
            // Ignore async cleanup errors
          }
        })();
      }

      // Fetch authoritative student promotion history from Supabase
      const promotionsByStudentId = new Map<string, LearnerPromotionRecord[]>();
      if (client) {
        try {
          const { data: promoRows, error: promoErr } = await client
            .from('student_promotions')
            .select('*')
            .order('date_promoted', { ascending: true });

          if (!promoErr && promoRows && Array.isArray(promoRows)) {
            for (const p of promoRows) {
              const sId = p.student_id;
              if (!sId) continue;
              const rec: LearnerPromotionRecord = {
                id: p.id,
                student_id: sId,
                from_grade: p.from_grade,
                to_grade: p.to_grade,
                from_class_id: p.from_class_id || undefined,
                to_class_id: p.to_class_id || undefined,
                from_stream_id: p.from_stream_id || undefined,
                to_stream_id: p.to_stream_id || undefined,
                academic_year_id: p.academic_year_id || undefined,
                from_year: p.from_year ? Number(p.from_year) : undefined,
                from_term: p.from_term || undefined,
                to_year: p.to_year ? Number(p.to_year) : undefined,
                to_term: p.to_term || undefined,
                date_promoted: p.date_promoted || p.created_at || new Date().toISOString(),
                promoted_by: p.promoted_by || undefined,
              };
              const list = promotionsByStudentId.get(sId) || [];
              list.push(rec);
              promotionsByStudentId.set(sId, list);
              if (typeof sId === 'string') {
                promotionsByStudentId.set(sId.toLowerCase(), list);
              }
            }
          } else if (promoErr && promoErr.code !== '42P01' && promoErr.code !== 'PGRST205') {
            console.warn('Supabase student_promotions fetch error:', promoErr);
          }
        } catch (promoFetchErr) {
          console.warn('Could not fetch student_promotions from database:', promoFetchErr);
        }
      }

      const existingStudents = getStorage<Student[]>(KEYS.STUDENTS, []);
      const mappedStudents: Student[] = studentData
        .filter((s: any) => !isDemoOrTestStudent(s))
        .map((s: any) => {
          const matchedClass =
            (s.stream_id ? currentClasses.find((c) => c.stream_id === s.stream_id || c.id === s.stream_id) : undefined) ||
            (s.class_id ? currentClasses.find((c) => c.id === s.class_id || c.stream_id === s.class_id) : undefined);
          const grade = s.grade || (matchedClass ? (matchedClass.class_name as GradeName) : undefined);
          const level = s.education_level || (matchedClass ? matchedClass.education_level : (grade ? getEducationLevelForGrade(grade) : undefined));

          const rawFullName = formatLearnerName(s.full_name);
          const nameParts = rawFullName.split(/\s+/).filter(Boolean);
          const firstName = (nameParts[0] || '').toUpperCase();
          const lastName = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toUpperCase();
          const secondName = (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : undefined)?.toUpperCase();

          const rawEnrolmentStatus = s.enrolment_status;
          const enrolmentStatus: EnrolmentStatus = 
            (rawEnrolmentStatus === 'future' || rawEnrolmentStatus === 'inactive' || rawEnrolmentStatus === 'active')
              ? rawEnrolmentStatus
              : (s.active === false ? 'inactive' : 'active');
          const computedActive = (s.active !== false && enrolmentStatus !== 'future' && enrolmentStatus !== 'inactive');

          // Supabase is the single source of truth for promotion history
          const studentPromos = promotionsByStudentId.get(s.id) || (s.id ? promotionsByStudentId.get(s.id.toLowerCase()) : undefined);

          return {
            id: s.id,
            admission_number: s.admission_number || '',
            full_name: rawFullName,
            first_name: firstName,
            second_name: secondName,
            last_name: lastName,
            gender: (s.gender === 'M' || s.gender === 'Boy' || s.gender === 'Male') ? 'M' : 'F',
            class_id: s.class_id || s.stream_id || matchedClass?.id || '',
            stream_id: s.stream_id || matchedClass?.stream_id || s.class_id || '',
            dob: s.dob || undefined,
            active: computedActive,
            enrolment_status: enrolmentStatus,
            intake_year: s.intake_year ? Number(s.intake_year) : undefined,
            intake_term: s.intake_term || undefined,
            admission_date: s.admission_date || undefined,
            grade: grade,
            education_level: level,
            promotion_history: studentPromos && studentPromos.length > 0 ? studentPromos : undefined,
          };
        });
      setStorage(KEYS.STUDENTS, mappedStudents);
      if (isSubjectTeacher) {
        setStorage(KEYS.ALLOCATED_STUDENTS, mappedStudents);
      }
    } else if (studentError) {
      console.warn('Error fetching students from Supabase:', studentError);
    }

    // 5. Fetch Subjects scoped by role
    let subjectQuery = client.from('subjects').select('*');
    if (scopedSubjectIds !== null) {
      if (scopedSubjectIds.length > 0) {
        subjectQuery = subjectQuery.in('id', scopedSubjectIds);
      } else {
        subjectQuery = subjectQuery.in('id', ['00000000-0000-0000-0000-000000000000']);
      }
    }
    const { data: subjectData, error: subjectError } = await subjectQuery;

    if (!teacherError && teacherData && (!isLearner || teacherData.length > 0)) {
      const currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
      const existingTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
      const currentUsers = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
      const { ids: delIds, emails: delEmails } = getDeletedTeacherIdentifiers();

      const cleanTeachers = teacherData
        .filter((t: any) => {
          if (!t) return false;
          if (isBlacklistedTestEmail(t?.email)) return false;
          if (delIds.has(t.id) || (t.id && delIds.has(t.id.toLowerCase()))) return false;
          if (t.email && delEmails.has(t.email.trim().toLowerCase())) return false;
          return true;
        })
        .map((t: any) => {
          const exT = existingTeachers.find((et) => et.id === t.id || et.email.toLowerCase() === t.email.toLowerCase());

          // Match corresponding user using existing UUID relationships
          const matchedUser = currentUsers.find(
            (u) => (u.teacher_id && u.teacher_id === t.id) || (t.user_id && u.id === t.user_id) || (t.email && u.email && u.email.toLowerCase() === t.email.toLowerCase())
          );

          // Canonical source of truth: streams.class_teacher_id === teacher.id
          // Authoritative derivation from Supabase streams table
          const matchingStream = streamData
            ? streamData.find((s: any) => s.class_teacher_id && s.class_teacher_id === t.id)
            : null;

          const matchingStreamId: string | undefined = matchingStream?.id || undefined;
          const isClassTeacherAssigned: boolean = Boolean(matchingStreamId);

          // Find teacher subject allocations from teacher_subjects table
          const dbAllocations = (teacherSubjectsData || [])
            .filter((ts: any) => ts.teacher_id === t.id)
            .map((ts: any) => {
              const matchedClass = (ts.stream_id ? currentClasses.find((c) => c.stream_id === ts.stream_id || c.id === ts.stream_id) : undefined) ||
                                   currentClasses.find((c) => c.id === ts.class_id);
              const matchedSubject = (subjectData || []).find((s: any) => s.id === ts.subject_id);
              return {
                id: ts.id,
                class_id: ts.class_id || (matchedClass ? matchedClass.id : ts.stream_id),
                stream_id: ts.stream_id || (matchedClass ? matchedClass.stream_id : undefined),
                subject_id: ts.subject_id,
                subject_name: matchedSubject?.subject_name,
                subject_code: matchedSubject?.subject_code,
                class_name: matchedClass?.class_name,
                stream: matchedClass?.stream,
                education_level: matchedClass?.education_level || (matchedClass ? getEducationLevelForGrade(matchedClass.class_name) : 'Upper Primary')
              };
            });

          const combinedAllocations = dbAllocations.length > 0 ? dbAllocations : (t.allocations || exT?.allocations || []);

          return {
            ...t,
            is_class_teacher: isClassTeacherAssigned,
            class_teacher_of_id: matchingStreamId,
            allocations: combinedAllocations,
            last_login: matchedUser?.last_login || t.last_login || exT?.last_login || null,
          };
        });

      // Deduplicate loaded teachers by email / username / identity
      const uniqueCleanTeachers: Teacher[] = [];
      for (const tch of cleanTeachers) {
        const existingIdx = uniqueCleanTeachers.findIndex((ex) => areTeachersSamePerson(ex, tch));
        if (existingIdx >= 0) {
          uniqueCleanTeachers[existingIdx] = mergeTeacherObjects(uniqueCleanTeachers[existingIdx], tch);
        } else {
          uniqueCleanTeachers.push(tch);
        }
      }

      setStorage(KEYS.TEACHERS, uniqueCleanTeachers);

      // Verify consistency: streams.class_teacher_id -> teachers.is_class_teacher -> users.role
      const classTeacherIds = new Set<string>();
      const classTeacherEmails = new Set<string>();
      uniqueCleanTeachers.forEach((t) => {
        if (t.is_class_teacher && t.class_teacher_of_id) {
          if (t.id) classTeacherIds.add(t.id);
          if (t.email) classTeacherEmails.add(t.email.trim().toLowerCase());
        }
      });

      let usersModified = false;
      const updatedUsers = currentUsers.map((u) => {
        if (u.role === 'admin' || u.role === 'learner') {
          return u;
        }
        const isCT = (u.teacher_id && classTeacherIds.has(u.teacher_id)) ||
                     (u.email && classTeacherEmails.has(u.email.trim().toLowerCase()));
        const expectedRole: Role = isCT ? 'class_teacher' : 'subject_teacher';
        if (u.role !== expectedRole) {
          usersModified = true;
          return { ...u, role: expectedRole };
        }
        return u;
      });

      if (usersModified) {
        setStorage(KEYS.USERS, updatedUsers);
      }

      // Ensure active session user role is also kept consistent
      const activeUser = api.getCurrentUser();
      if (activeUser && activeUser.role !== 'admin' && activeUser.role !== 'learner') {
        const isCT = (activeUser.teacher_id && classTeacherIds.has(activeUser.teacher_id)) ||
                     (activeUser.email && classTeacherEmails.has(activeUser.email.trim().toLowerCase()));
        const expectedRole: Role = isCT ? 'class_teacher' : 'subject_teacher';
        if (activeUser.role !== expectedRole) {
          api.setCurrentUser({ ...activeUser, role: expectedRole });
        }
      }

      api.deduplicateTeachersAndUsers();
    } else if (teacherError) {
      console.warn('Error fetching teachers from Supabase:', teacherError);
    }

    // 6. Process Subjects & Auto-Migrate Old Codes
    if (!subjectError && subjectData) {
      const sanitized = subjectData.map((s: any) => {
        const clean = sanitizeSubject(s);
        const initSb = initialSubjects.find(isb => isb.subject_code === clean.subject_code || isb.subject_name === clean.subject_name || isb.id === clean.id);
        if (initSb) {
          if (!clean.education_level) clean.education_level = initSb.education_level;
          if (!clean.applicable_grades || clean.applicable_grades.length === 0) clean.applicable_grades = initSb.applicable_grades;
          if (!clean.status) clean.status = initSb.status || 'Active';
        }
        return clean;
      });

      // Hard invariant: Ensure strictly unique canonical subject IDs and codes in sanitized
      const deduplicatedSubjects = deduplicateSubjectList(sanitized);

      setStorage(KEYS.SUBJECTS, deduplicatedSubjects);

      // Auto update any subject in Supabase if code/name was old format
      subjectData.forEach(async (oldSb: any) => {
        const clean = sanitizeSubject(oldSb);
        if (clean.subject_code !== oldSb.subject_code || clean.subject_name !== oldSb.subject_name) {
          try {
            await client.from('subjects').update({
              subject_code: clean.subject_code,
              subject_name: clean.subject_name,
            }).eq('id', oldSb.id);
          } catch (err) {
            console.warn('Could not update subject code in Supabase:', err);
          }
        }
      });
    } else if (subjectError) {
      console.warn('Error fetching subjects from Supabase:', subjectError);
    }

    // 6. Fetch Examinations
    const { data: examData, error: examError } = await client.from('examinations').select('*');
    if (!examError && examData) {
      const mappedExams: Examination[] = examData.map((e: any) => {
        const isOpener = (e.exam_type === 'Custom' && e.exam_name && /\bopen/i.test(e.exam_name)) || e.exam_type === 'Opener';
        return {
          ...e,
          exam_type: isOpener ? 'Opener' : e.exam_type,
          year: Number(e.year || new Date().getFullYear()),
          max_marks: Number(e.max_marks || 100),
          created_at: e.created_at || e.date_created,
          updated_at: e.updated_at,
          approved_levels: Array.isArray(e.approved_levels)
            ? e.approved_levels
            : (typeof e.approved_levels === 'string' && e.approved_levels.startsWith('[')
                ? JSON.parse(e.approved_levels)
                : (e.approved_levels ? [e.approved_levels] : [])),
          approved_classes: Array.isArray(e.approved_classes)
            ? e.approved_classes
            : [],
        };
      });
      setStorage(KEYS.EXAMS, mappedExams);
    } else if (examError) {
      console.warn('Error fetching examinations from Supabase:', examError);
    }

    // 7. Marks are lazy-loaded on-demand by workflows (Marks Entry, Reports, Analytics, Merit Lists)
    // Global download of the entire public.marks table on startup is removed for performance optimization.

    // 8. Fetch CBE Grades Configuration from Supabase
    try {
      const { data: gradesData, error: gradesError } = await client
        .from('cbe_grades')
        .select('*')
        .order('points', { ascending: false });

      if (!gradesError && gradesData && gradesData.length > 0) {
        const mappedGrades: Grade[] = gradesData.map((g: any) => ({
          id: g.id,
          grade_code: g.grade_code || g.grade || '',
          performance_level: g.performance_level || 'ME',
          minimum_score: Number(g.minimum_score ?? g.minimum_marks ?? 0),
          maximum_score: Number(g.maximum_score ?? g.maximum_marks ?? 100),
          minimum_marks: Number(g.minimum_score ?? g.minimum_marks ?? 0),
          maximum_marks: Number(g.maximum_score ?? g.maximum_marks ?? 100),
          points: Number(g.points ?? 0),
          descriptor: g.descriptor || '',
          remarks: g.remarks || '',
          grade: g.grade || g.grade_code || '',
        }));
        setStorage(KEYS.GRADES, mappedGrades);
      } else if (!gradesError && (!gradesData || gradesData.length === 0)) {
        // cbe_grades table exists but is empty -> Seed initialGrades into Supabase cbe_grades!
        try {
          const payloads = initialGrades.map((g) => ({
            id: g.id,
            grade_code: g.grade_code,
            performance_level: g.performance_level,
            minimum_score: g.minimum_score,
            maximum_score: g.maximum_score,
            minimum_marks: g.minimum_marks,
            maximum_marks: g.maximum_marks,
            points: g.points,
            descriptor: g.descriptor,
            remarks: g.remarks,
            grade: g.grade,
          }));
          await client.from('cbe_grades').upsert(payloads, { onConflict: 'id' });
          setStorage(KEYS.GRADES, initialGrades);
        } catch (seedErr) {
          console.warn('Error seeding cbe_grades into Supabase:', seedErr);
          setStorage(KEYS.GRADES, initialGrades);
        }
      } else if (gradesError) {
        if (gradesError.code === '42P01' || gradesError.code === 'PGRST205') {
          console.warn('cbe_grades table does not exist in Supabase yet. Using default CBE 8-Point scale.');
        } else {
          console.warn('Error fetching cbe_grades from Supabase:', gradesError);
        }
      }
    } catch (gErr) {
      console.warn('CBE grades sync caught error:', gErr);
    }

    // 9. Optional hydration for academic_years and school_terms if provisioned in Supabase
    try {
      const { data: yearsData, error: yearsError } = await client
        .from('academic_years')
        .select('*')
        .order('year', { ascending: true });

      if (!yearsError && yearsData && yearsData.length > 0) {
        const mappedYears: AcademicYear[] = yearsData.map((y: any) => ({
          id: y.id,
          year: Number(y.year),
          status: y.status || (y.is_active ? 'Active' : 'Closed'),
          start_date: y.start_date || undefined,
          end_date: y.end_date || undefined,
          created_at: y.created_at || undefined,
          updated_at: y.updated_at || undefined,
        }));
        setStorage(KEYS.ACADEMIC_YEARS, mappedYears);
      } else if (yearsError && yearsError.code !== '42P01' && yearsError.code !== 'PGRST205') {
        console.warn('Error fetching academic_years from Supabase:', yearsError);
      }
    } catch (yErr) {
      // Graceful fallback for unprovisioned table
    }

    try {
      const { data: termsData, error: termsError } = await client
        .from('school_terms')
        .select('*')
        .order('opening_date', { ascending: true });

      if (!termsError && termsData && termsData.length > 0) {
        const mappedTerms: SchoolTerm[] = termsData.map((t: any) => ({
          id: t.id,
          academic_year_id: t.academic_year_id || t.year_id || '',
          year: Number(t.year),
          term_name: t.term_name || t.name || 'Term 1',
          opening_date: t.opening_date || t.start_date || '',
          closing_date: t.closing_date || t.end_date || '',
          mid_term_opening_date: t.mid_term_opening_date || undefined,
          mid_term_closing_date: t.mid_term_closing_date || undefined,
          status: t.status || (t.is_active ? 'Active' : 'Closed'),
          created_at: t.created_at || undefined,
          updated_at: t.updated_at || undefined,
        }));
        setStorage(KEYS.SCHOOL_TERMS, mappedTerms);
      } else if (termsError && termsError.code !== '42P01' && termsError.code !== 'PGRST205') {
        console.warn('Error fetching school_terms from Supabase:', termsError);
      }
    } catch (tErr) {
      // Graceful fallback for unprovisioned table
    }

      if (syncGen === currentSyncGeneration) {
        hasCompletedSync = true;
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('session-changed'));
          } catch (e) {
            // Safe fallback
          }
        }
      }
      return true;
    } catch (err) {
      console.error('Error syncing from Supabase:', err);
      return false;
    } finally {
      syncInProgressPromise = null;
    }
  })();

  return syncInProgressPromise;
}


// Storage keys for local persistence
export const KEYS = {
  SCHOOL: 'cbe_school',
  GRADES: 'cbe_grades',
  SUBJECTS: 'cbe_subjects',
  CLASSES: 'cbe_classes',
  TEACHERS: 'cbe_teachers',
  USERS: 'cbe_users',
  STUDENTS: 'cbe_students',
  ALLOCATED_STUDENTS: 'cbe_allocated_students',
  EXAMS: 'cbe_exams',
  MARKS: 'cbe_marks',
  VERIFICATIONS: 'cbe_verifications',
  CURRENT_USER: 'cbe_current_user',
  ACADEMIC_YEARS: 'cbe_academic_years',
  SCHOOL_TERMS: 'cbe_school_terms',
  LOGIN_LOGS: 'cbe_login_logs',
  DELETED_TEACHERS: 'cbe_deleted_teachers',
};

const memoryStorage: Record<string, string> = {};

// Helper for in-memory storage (Supabase is single source of truth for persistent data)
export function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = memoryStorage[key];
    return item !== undefined && item !== null ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from memory storage`, err);
    return defaultValue;
  }
}

export function setStorage<T>(key: string, value: T): void {
  try {
    if (value === null || value === undefined) {
      delete memoryStorage[key];
      return;
    }
    memoryStorage[key] = JSON.stringify(value);
  } catch (err) {
    console.error(`Error writing ${key} to memory storage`, err);
  }
}

export function getDeletedTeacherIdentifiers(): { ids: Set<string>; emails: Set<string> } {
  const list = getStorage<string[]>(KEYS.DELETED_TEACHERS, []);
  const ids = new Set<string>();
  const emails = new Set<string>();
  for (const item of list) {
    if (item && typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (trimmed.includes('@')) {
        emails.add(trimmed.toLowerCase());
      } else {
        ids.add(trimmed);
        ids.add(trimmed.toLowerCase());
      }
    }
  }
  return { ids, emails };
}

export function recordDeletedTeacherIdentifier(...identifiers: (string | undefined | null)[]): void {
  const current = getStorage<string[]>(KEYS.DELETED_TEACHERS, []);
  const set = new Set(current);
  for (const id of identifiers) {
    if (id && typeof id === 'string' && id.trim()) {
      const trimmed = id.trim();
      set.add(trimmed);
      if (trimmed.includes('@')) {
        set.add(trimmed.toLowerCase());
      }
    }
  }
  setStorage(KEYS.DELETED_TEACHERS, Array.from(set));
}

export function removeDeletedTeacherIdentifier(...identifiers: (string | undefined | null)[]): void {
  const current = getStorage<string[]>(KEYS.DELETED_TEACHERS, []);
  const toRemove = new Set(
    identifiers.filter((i): i is string => Boolean(i && typeof i === 'string')).map((i) => i.trim().toLowerCase())
  );
  if (toRemove.size === 0) return;
  const updated = current.filter((item) => !toRemove.has(item.trim().toLowerCase()));
  setStorage(KEYS.DELETED_TEACHERS, updated);
}

export function sanitizeUser(u: User): User {
  if (!u) return u;
  if (u.name && (u.name.toLowerCase().includes('omwenga') || u.name.includes('Dr. Joseph'))) {
    return {
      ...u,
      name: u.role === 'admin' ? 'Administrator' : u.name.replace(/Dr\.\s*Joseph\s*Omwenga/gi, 'Administrator'),
    };
  }
  return u;
}

const TARGET_TEST_TEACHER_EMAILS = [
  'test_teacher_1785574605292@example.com',
  'test_teacher_e2e_1785574890386@example.com',
];

export function isBlacklistedTestEmail(email?: string): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return (
    TARGET_TEST_TEACHER_EMAILS.includes(lower) ||
    lower.includes('test_teacher_1785574605292') ||
    lower.includes('test_teacher_e2e_1785574890386')
  );
}

export function getCleanUsername(username?: string): string {
  if (!username) return '';
  return username.replace(/^@+/, '').trim().toLowerCase();
}

export function areTeachersSamePerson(t1?: Partial<Teacher> | null, t2?: Partial<Teacher> | null): boolean {
  if (!t1 || !t2) return false;
  if (t1.id && t2.id && t1.id === t2.id) return true;

  const email1 = t1.email ? t1.email.trim().toLowerCase() : '';
  const email2 = t2.email ? t2.email.trim().toLowerCase() : '';
  if (email1 && email2 && email1 === email2) return true;

  const uname1 = getCleanUsername(t1.username);
  const uname2 = getCleanUsername(t2.username);
  if (uname1 && uname2 && uname1 === uname2) return true;

  const tsc1 = (t1.tsc_number && t1.tsc_number !== 'TSC-PENDING') ? t1.tsc_number.trim().toLowerCase() : '';
  const tsc2 = (t2.tsc_number && t2.tsc_number !== 'TSC-PENDING') ? t2.tsc_number.trim().toLowerCase() : '';
  if (tsc1 && tsc2 && tsc1 === tsc2) return true;

  const name1 = t1.teacher_name ? t1.teacher_name.trim().toLowerCase() : '';
  const name2 = t2.teacher_name ? t2.teacher_name.trim().toLowerCase() : '';
  if (name1 && name2 && name1 === name2) {
    const phone1 = t1.phone ? t1.phone.trim() : '';
    const phone2 = t2.phone ? t2.phone.trim() : '';
    if (phone1 && phone2 && phone1 === phone2) return true;
    if (!email1 || !email2) return true;
  }

  return false;
}

export function mergeTeacherObjects(t1: Teacher, t2: Teacher): Teacher {
  const keptId = isUUID(t1.id) ? t1.id : (isUUID(t2.id) ? t2.id : t1.id);
  
  // Merge allocations
  const mergedAllocations = [...(t1.allocations || [])];
  if (t2.allocations) {
    for (const alloc of t2.allocations) {
      if (!mergedAllocations.some((a) => a.class_id === alloc.class_id && a.subject_id === alloc.subject_id && (a.stream || '') === (alloc.stream || ''))) {
        mergedAllocations.push(alloc);
      }
    }
  }

  return {
    ...t2,
    ...t1,
    id: keptId,
    teacher_name: t1.teacher_name || t2.teacher_name,
    email: t1.email ? t1.email.trim().toLowerCase() : (t2.email ? t2.email.trim().toLowerCase() : ''),
    phone: t1.phone || t2.phone || '',
    username: t1.username || t2.username || '',
    tsc_number: (t1.tsc_number && t1.tsc_number !== 'TSC-PENDING') ? t1.tsc_number : (t2.tsc_number || 'TSC-PENDING'),
    user_id: isUUID(t1.user_id) ? t1.user_id : (isUUID(t2.user_id) ? t2.user_id : (t1.user_id || t2.user_id)),
    is_class_teacher: t1.is_class_teacher || t2.is_class_teacher,
    class_teacher_of_id: t1.class_teacher_of_id || t2.class_teacher_of_id,
    status: (t1.status === 'Active' || t2.status === 'Active') ? 'Active' : (t1.status || t2.status || 'Active'),
    last_login: t1.last_login || t2.last_login || null,
    allocations: mergedAllocations,
  };
}

export function isUUID(str: any): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const CANONICAL_SUBJECT_UUIDS: Record<string, string> = {
  ENG: '823eba35-ac51-4ac8-be57-fcbeee88151c',
  KIS: 'f00b5334-fa16-4640-b19c-733ec4530318',
  MATH: '4441b054-2d20-4d5c-852d-f31d16fbc145',
  SST: 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409',
  AGN: 'fe17661a-9c3b-439e-9cb9-fd2f88279f56',
  CRE: 'e784b5fc-dab9-4105-bb49-fce1d1a84cf7',
  'INT-SCI': 'b65c16d5-a38c-478e-ab46-085170ee31da',
  'SS&CRE': 'f8255683-1d59-46a7-881a-04a25d45d972',
  ILA: '3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d',
};

export function deduplicateSubjectList(subjects: Subject[]): Subject[] {
  const result: Subject[] = [];
  
  for (const rawSb of subjects) {
    const sb = sanitizeSubject(rawSb);
    if (!sb) continue;

    const existingIndex = result.findIndex(existing => {
      if (existing.id === sb.id) return true;
      if (existing.subject_code && sb.subject_code && existing.subject_code === sb.subject_code) {
        if (existing.education_level === sb.education_level) return true;
        const existingGrades = existing.applicable_grades || [];
        const sbGrades = sb.applicable_grades || [];
        if (existingGrades.some((g) => sbGrades.includes(g))) return true;
        if (['Grade 4–9', 'PP1–Grade 9', 'Junior School', 'Upper Primary'].includes(existing.education_level || '') &&
            ['Grade 4–9', 'PP1–Grade 9', 'Junior School', 'Upper Primary'].includes(sb.education_level || '')) {
          return true;
        }
      }
      return false;
    });

    if (existingIndex === -1) {
      result.push({ ...sb });
    } else {
      const existing = result[existingIndex];
      const mergedGrades = Array.from(new Set([...(existing.applicable_grades || []), ...(sb.applicable_grades || [])]));

      const canonicalUuid = CANONICAL_SUBJECT_UUIDS[sb.subject_code];
      let keepNew = false;
      if (canonicalUuid) {
        if (sb.id === canonicalUuid && existing.id !== canonicalUuid) {
          keepNew = true;
        }
      } else {
        const existingIsUuid = isUUID(existing.id);
        const sbIsUuid = isUUID(sb.id);
        if (!existingIsUuid && sbIsUuid) {
          keepNew = true;
        }
      }

      if (keepNew) {
        result[existingIndex] = {
          ...sb,
          applicable_grades: mergedGrades,
        };
      } else {
        result[existingIndex] = {
          ...existing,
          applicable_grades: mergedGrades,
        };
      }
    }
  }

  return result;
}

/**
 * Initialize storage with default seed data if empty
 */
export function initDatabase() {
  if (getStorage<School | null>(KEYS.SCHOOL, null) === null) setStorage(KEYS.SCHOOL, initialSchool);
  if (getStorage<string[] | null>(KEYS.GRADES, null) === null) setStorage(KEYS.GRADES, initialGrades);
  if (getStorage<Subject[] | null>(KEYS.SUBJECTS, null) === null) {
    setStorage(KEYS.SUBJECTS, deduplicateSubjectList(initialSubjects.map(sanitizeSubject)));
  } else {
    const storedSubjects = getStorage<Subject[]>(KEYS.SUBJECTS, []);
    setStorage(KEYS.SUBJECTS, deduplicateSubjectList(storedSubjects.map(sanitizeSubject)));
  }
  if (getStorage<ClassStream[] | null>(KEYS.CLASSES, null) === null) setStorage(KEYS.CLASSES, []);
  if (getStorage<Teacher[] | null>(KEYS.TEACHERS, null) === null) setStorage(KEYS.TEACHERS, []);
  if (getStorage<User[] | null>(KEYS.USERS, null) === null) setStorage(KEYS.USERS, adminUsersOnly);
  if (getStorage<Student[] | null>(KEYS.STUDENTS, null) === null) setStorage(KEYS.STUDENTS, []);
  if (getStorage<Examination[] | null>(KEYS.EXAMS, null) === null) setStorage(KEYS.EXAMS, []);
  if (getStorage<Mark[] | null>(KEYS.MARKS, null) === null) setStorage(KEYS.MARKS, []);
  if (getStorage<any[] | null>(KEYS.VERIFICATIONS, null) === null) setStorage(KEYS.VERIFICATIONS, []);
  if (getStorage<AcademicYear[] | null>(KEYS.ACADEMIC_YEARS, null) === null) setStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
  if (getStorage<SchoolTerm[] | null>(KEYS.SCHOOL_TERMS, null) === null) setStorage(KEYS.SCHOOL_TERMS, initialTerms);
  if (getStorage<LoginLog[] | null>(KEYS.LOGIN_LOGS, null) === null) setStorage(KEYS.LOGIN_LOGS, []);
}

// Ensure database is initialized
initDatabase();

export function disambiguateSubjectCandidates(
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

async function resolveSubjectUUID(client: SupabaseClient, alloc: any): Promise<string> {
  // 1. If subject_id is already a valid UUID, verify it exists in public.subjects
  if (isUUID(alloc.subject_id)) {
    const { data: sb, error: sbErr } = await client.from('subjects').select('id, subject_name, subject_code, learning_area').eq('id', alloc.subject_id).maybeSingle();
    if (sbErr) {
      throw new Error(`Database error verifying subject UUID: ${sbErr.message}`);
    }
    if (sb) return sb.id;
    throw new Error(`Subject with ID "${alloc.subject_id}" could not be found in the database.`);
  }

  let code = (alloc.subject_code || '').trim();
  let name = (alloc.subject_name || '').trim();
  const levelContext = (alloc.education_level || alloc.class_name || alloc.learning_area || '').trim();

  // Fallback if alloc.subject_id is string like sb_mat or code
  if (alloc.subject_id && typeof alloc.subject_id === 'string' && !code && !name) {
    const raw = alloc.subject_id.trim();
    if (raw.startsWith('sb_')) {
      name = raw.replace(/^sb_/, '').replace(/_/g, ' ');
    } else {
      code = raw;
      name = raw;
    }
  }

  // 2. If code is available and distinct, lookup by exact unique subject_code
  if (code && code !== name) {
    const { data: codeMatches, error: codeErr } = await client
      .from('subjects')
      .select('id, subject_code, subject_name, learning_area')
      .eq('subject_code', code);
    if (codeErr) {
      throw new Error(`Database query error while resolving subject code "${code}": ${codeErr.message}`);
    }
    if (codeMatches && codeMatches.length === 1) {
      return codeMatches[0].id;
    }
    if (codeMatches && codeMatches.length > 1) {
      throw new Error(`Ambiguous subject code "${code}": multiple records found in database.`);
    }
  }

  // 3. Exact case-insensitive name lookup
  if (name) {
    const { data: nameMatches, error: nameErr } = await client
      .from('subjects')
      .select('id, subject_code, subject_name, learning_area')
      .ilike('subject_name', name);
    if (nameErr) {
      throw new Error(`Database query error while resolving subject name "${name}": ${nameErr.message}`);
    }

    if (nameMatches && nameMatches.length > 0) {
      if (nameMatches.length === 1) {
        return nameMatches[0].id;
      }
      const res = disambiguateSubjectCandidates(nameMatches, levelContext, code);
      if (res.success) {
        return res.success.id;
      }
      throw new Error(res.error || `Ambiguous learning area "${name}": multiple matching records found across education levels.`);
    }
  }

  // 4. If code matches after all
  if (code) {
    const { data: codeMatches, error: codeErr } = await client
      .from('subjects')
      .select('id, subject_code, subject_name, learning_area')
      .eq('subject_code', code);
    if (codeErr) {
      throw new Error(`Database query error while resolving subject code "${code}": ${codeErr.message}`);
    }
    if (codeMatches && codeMatches.length === 1) {
      return codeMatches[0].id;
    }
    if (codeMatches && codeMatches.length > 1) {
      throw new Error(`Ambiguous subject code "${code}": multiple records found in database.`);
    }
  }

  const desc = name || code || alloc.subject_id || 'unspecified';
  throw new Error(`Learning area "${desc}" does not exist in the database. Please register the learning area first in Subject Management.`);
}

function formatTeacherSaveError(err: any, fallbackMessage: string = 'Teacher details could not be saved. Please try again.'): string {
  if (!err) return fallbackMessage;
  const rawMsg = typeof err === 'string' ? err : (err.message || String(err));
  const code = err.code || '';

  if (
    code === '42501' ||
    rawMsg.includes('violates row-level security policy') ||
    rawMsg.includes('Access denied') ||
    rawMsg.includes('Only administrators') ||
    rawMsg.includes('permission denied')
  ) {
    return 'Learning area allocations could not be saved. Please ensure you are signed in as an administrator and try again.';
  }

  if (code === '23505' || rawMsg.includes('duplicate key') || rawMsg.includes('unique constraint')) {
    if (rawMsg.includes('email')) return 'A teacher or user with this email address already exists.';
    if (rawMsg.includes('tsc_number')) return 'A teacher with this TSC Number already exists.';
    if (rawMsg.includes('subject_code')) return 'A learning area with this code already exists.';
    return 'A record with these unique details already exists.';
  }

  if (code === '23503' || rawMsg.includes('foreign key constraint')) {
    return 'The specified learning area, class, or stream could not be found.';
  }

  if (code === 'PGRST116') {
    return 'The requested record was not found.';
  }

  if (rawMsg.includes('Unable to resolve database subject UUID')) {
    return rawMsg;
  }

  if (rawMsg.length > 0 && !rawMsg.includes('violates') && !rawMsg.includes('relation "') && !rawMsg.includes('syntax error') && !rawMsg.includes('column "')) {
    return rawMsg;
  }

  return fallbackMessage;
}

async function resolveClassAndStreamUUIDs(client: SupabaseClient, alloc: any): Promise<{ class_id: string | null; stream_id: string | null }> {
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

function isDuplicateSubjectCodeError(error: any): boolean {
  if (!error) return false;
  const codeStr = String(error.code || '');
  const msgStr = String(error.message || error.msg || '');
  const detailsStr = String(error.details || '');
  const hintStr = String(error.hint || '');
  const fullText = `${codeStr} ${msgStr} ${detailsStr} ${hintStr} ${String(error)}`.toLowerCase();

  const matchesCodeOrDuplicate =
    codeStr === '23505' ||
    fullText.includes('23505') ||
    fullText.includes('duplicate key') ||
    fullText.includes('unique constraint');

  const matchesSubjectCodeKey =
    fullText.includes('subjects_subject_code_key') ||
    fullText.includes('subject_code');

  return matchesCodeOrDuplicate && matchesSubjectCodeKey;
}

/**
 * Authoritatively assign or unassign a class teacher to a stream via the backend API.
 * Strict authority: POST /api/admin/assign-class-teacher.
 * CLASS/STREAM RULE: The request MUST use: stream_id = c.stream_id. Never: c.id.
 * LOCALSTORAGE RULE: LocalStorage cache is ONLY updated upon confirmed server database success.
 */
export async function assignClassTeacher(
  streamId: string,
  teacherId: string | null
): Promise<{ success: boolean; stream: any; teacher_id: string | null }> {
  // 1. Strict stream validation: Never accept class id or invalid UUID
  if (!streamId || typeof streamId !== 'string' || !isUUID(streamId)) {
    throw new Error('Invalid stream ID: stream_id must be a valid stream UUID.');
  }

  // 2. Fetch active session token for authentication
  const client = createSupabaseClient();
  let token: string | undefined;
  if (client) {
    try {
      const { data: sessionData } = await client.auth.getSession();
      token = sessionData?.session?.access_token;
    } catch (e) {
      console.warn('Could not retrieve session token for class teacher assignment:', e);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 3. Make POST request to authoritative backend endpoint
  const targetTeacherId = teacherId && isUUID(teacherId) ? teacherId : null;
  const response = await fetch(buildApiUrl('/api/admin/assign-class-teacher'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      stream_id: streamId,
      teacher_id: targetTeacherId,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    const errMsg = errData?.error || `Failed to assign class teacher (HTTP ${response.status})`;
    throw new Error(errMsg);
  }

  const respData = await response.json();
  if (!respData || !respData.success) {
    throw new Error(respData?.error || 'Class teacher assignment could not be confirmed by the server.');
  }

  // 4. LOCALSTORAGE RULE: Update LocalStorage ONLY after confirmed server database success
  // A. Update classes cache in LocalStorage
  const list = getStorage<ClassStream[]>(KEYS.CLASSES, []).map(sanitizeClass);
  const updatedClasses = list.map((c) => {
    if (c.stream_id === streamId) {
      return {
        ...c,
        class_teacher_id: targetTeacherId || undefined,
      };
    }
    return c;
  });
  setStorage(KEYS.CLASSES, updatedClasses);

  // B. Update teachers cache in LocalStorage
  const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
  let teachersChanged = false;
  const updatedTeachers = teachers.map((t) => {
    // If this teacher is the newly assigned teacher
    if (targetTeacherId && t.id === targetTeacherId) {
      teachersChanged = true;
      return {
        ...t,
        is_class_teacher: true,
        class_teacher_of_id: streamId, // STRICT: always stream_id, never c.id
      };
    }
    // If this teacher was previously assigned to this stream and is now replaced or unassigned
    if (t.class_teacher_of_id === streamId && t.id !== targetTeacherId) {
      teachersChanged = true;
      return {
        ...t,
        is_class_teacher: false,
        class_teacher_of_id: undefined,
      };
    }
    return t;
  });

  if (teachersChanged) {
    setStorage(KEYS.TEACHERS, updatedTeachers);
  }

  return respData;
}

/**
 * In-flight token refresh promise to prevent concurrent duplicate refresh requests.
 */
let inFlightTokenRefreshPromise: Promise<string | null> | null = null;

/**
 * Centrally retrieves a fresh Supabase auth session access token for protected API calls.
 * - Inspects session.expires_at using a 60-second safety window.
 * - Triggers client.auth.refreshSession() if the token is missing, expired, near expiry (<= 60s),
 *   or if forceRefresh is true (e.g. on 401 recovery).
 * - Deduplicates concurrent refresh requests using inFlightTokenRefreshPromise.
 * - Returns the fresh access_token string, or null if no valid session exists/refresh failed.
 */
export async function getFreshSessionToken(client: SupabaseClient, forceRefresh = false): Promise<string | null> {
  try {
    if (!forceRefresh) {
      const { data: sessionData, error: sessionErr } = await client.auth.getSession();
      if (sessionErr || !sessionData?.session) {
        return null;
      }
      const session = sessionData.session;
      const currentEpochSec = Math.floor(Date.now() / 1000);
      const isNearExpiry = session.expires_at ? (session.expires_at <= currentEpochSec + 60) : false;
      if (session.access_token && !isNearExpiry) {
        return session.access_token;
      }
    }

    // Token is expired, within 60s of expiry, or forceRefresh is requested
    if (inFlightTokenRefreshPromise) {
      return await inFlightTokenRefreshPromise;
    }

    inFlightTokenRefreshPromise = (async () => {
      try {
        const { data: refreshData, error: refreshErr } = await client.auth.refreshSession();
        if (refreshErr || !refreshData?.session?.access_token) {
          return null;
        }
        return refreshData.session.access_token;
      } catch {
        return null;
      } finally {
        inFlightTokenRefreshPromise = null;
      }
    })();

    return await inFlightTokenRefreshPromise;
  } catch {
    return null;
  }
}

export const api = {
  // --- SCHOOL ---
  getSchool: (): School => getStorage(KEYS.SCHOOL, initialSchool),
  updateSchool: async (school: School): Promise<School> => {
    setStorage(KEYS.SCHOOL, school);
    const client = createSupabaseClient();
    if (client) {
      try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(school.id);

        const postalVal = school.postal_code || school.address || '';
        const payload: any = {
          school_name: school.school_name || '',
          motto: school.motto || '',
          county: school.county || '',
          address: postalVal,
          email: school.email || '',
          updated_at: new Date().toISOString(),
        };

        // Check if a row already exists in school_profile table
        const { data: existing } = await client.from('school_profile').select('id').limit(1);

        if (existing && existing.length > 0) {
          const targetId = existing[0].id;
          const { data, error } = await client
            .from('school_profile')
            .update(payload)
            .eq('id', targetId)
            .select('*');

          if (error) {
            console.warn('Could not update school profile in Supabase:', error.message);
          } else if (data && data.length > 0) {
            const updatedSchool: School = { ...school, id: data[0].id };
            setStorage(KEYS.SCHOOL, updatedSchool);
            return updatedSchool;
          }
        } else {
          if (isValidUUID) {
            payload.id = school.id;
          }
          const { data, error } = await client
            .from('school_profile')
            .insert([payload])
            .select('*');

          if (error) {
            console.warn('Could not insert school profile into Supabase:', error.message);
          } else if (data && data.length > 0) {
            const insertedSchool: School = { ...school, id: data[0].id };
            setStorage(KEYS.SCHOOL, insertedSchool);
            return insertedSchool;
          }
        }
      } catch (err: any) {
        console.warn('Unexpected error updating school profile in Supabase:', err?.message || err);
      }
    }
    return school;
  },

  // --- USERS & AUTH ---
  getCurrentUser: (): User | null => {
    const raw = getStorage<User | null>(KEYS.CURRENT_USER, null);
    if (!raw) return null;
    const clean = sanitizeUser(raw);
    if (clean.name !== raw.name) {
      setStorage(KEYS.CURRENT_USER, clean);
    }
    return clean;
  },
  setCurrentUser: (user: User | null): User | null => {
    const clean = user ? sanitizeUser(user) : null;
    if (clean) {
      setStorage(KEYS.CURRENT_USER, clean);
    } else {
      setStorage(KEYS.CURRENT_USER, null);
    }
    return clean;
  },
  getUsers: (): User[] => {
    const users = getStorage(KEYS.USERS, adminUsersOnly);
    let changed = false;
    const filtered = users.filter((u) => u && !isBlacklistedTestEmail(u.email));
    if (filtered.length !== users.length) changed = true;
    const cleanUsers = filtered.map((u) => {
      const clean = sanitizeUser(u);
      if (clean.name !== u.name) changed = true;
      return clean;
    });
    if (changed) {
      setStorage(KEYS.USERS, cleanUsers);
    }
    return cleanUsers;
  },
  syncUsersFromDatabase: (userData: any[]): void => {
    if (!userData || !Array.isArray(userData) || userData.length === 0) return;
    const existing = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
    const { ids: delIds, emails: delEmails } = getDeletedTeacherIdentifiers();

    const mappedDBUsers: User[] = userData
      .filter((u: any) => {
        if (!u) return false;
        if (isBlacklistedTestEmail(u?.email)) return false;
        if (u.teacher_id && (delIds.has(u.teacher_id) || delIds.has(u.teacher_id.toLowerCase()))) return false;
        if (u.id && (delIds.has(u.id) || delIds.has(u.id.toLowerCase()))) return false;
        if (u.email && delEmails.has(u.email.trim().toLowerCase())) return false;
        return true;
      })
      .map((u: any) => {
        const rawRole = (u.role || '').toLowerCase();
        let normalizedRole: Role = 'class_teacher';
        if (rawRole === 'admin') {
          normalizedRole = 'admin';
        } else if (rawRole === 'learner' || rawRole === 'student') {
          normalizedRole = 'learner';
        } else if (rawRole === 'subject_teacher') {
          normalizedRole = 'subject_teacher';
        } else if (rawRole === 'class_teacher') {
          normalizedRole = 'class_teacher';
        } else if (rawRole === 'teacher') {
          const teachersList = getStorage<Teacher[]>(KEYS.TEACHERS, []);
          const email = (u.email || '').toLowerCase();
          const matchedT = teachersList.find((t) => t.email.toLowerCase() === email || t.id === u.teacher_id);
          normalizedRole = (matchedT?.is_class_teacher || Boolean(matchedT?.class_teacher_of_id)) ? 'class_teacher' : 'subject_teacher';
        } else {
          normalizedRole = u.role as Role;
        }

        const existingUser = existing.find((ex) => ex.id === u.id || (u.email && ex.email.toLowerCase() === (u.email || '').toLowerCase()));

        return {
          id: u.id,
          name: u.name || u.email?.split('@')[0] || 'User',
          email: (u.email || '').toLowerCase(),
          role: normalizedRole,
          teacher_id: (normalizedRole === 'admin' || normalizedRole === 'learner') ? undefined : (u.teacher_id || undefined),
          student_id: u.student_id || undefined,
          status: u.status || 'Active',
          force_password_change: u.force_password_change ?? false,
          last_login: u.last_login || existingUser?.last_login || null,
        };
      });

    setStorage(KEYS.USERS, mappedDBUsers);
  },
  addUser: (user: User): User => {
    const users = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
    const updated = [...users, user];
    setStorage(KEYS.USERS, updated);
    return user;
  },
  updateUser: (user: User): User => {
    const users = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
    const exists = users.some((u) => u.id === user.id || (user.email && u.email.toLowerCase() === user.email.toLowerCase()));
    const updated = exists
      ? users.map((u) =>
          u.id === user.id || (user.email && u.email.toLowerCase() === user.email.toLowerCase())
            ? { ...u, ...user }
            : u
        )
      : [...users, user];
    setStorage(KEYS.USERS, updated);
    return user;
  },
  deleteUser: (idOrEmail: string): void => {
    const users = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
    const updated = users.filter(
      (u) =>
        u.id !== idOrEmail &&
        u.email.toLowerCase() !== idOrEmail.toLowerCase() &&
        u.teacher_id !== idOrEmail &&
        u.student_id !== idOrEmail
    );
    setStorage(KEYS.USERS, updated);
  },

  // --- LOGIN LOGS ---
  getLoginLogs: (filterQuery?: string): LoginLog[] => {
    const logs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
    if (!filterQuery) return logs;
    const q = filterQuery.toLowerCase();
    return logs.filter(
      (l) =>
        (l.user_id && l.user_id.toLowerCase() === q) ||
        (l.email && l.email.toLowerCase() === q) ||
        (l.user_name && l.user_name.toLowerCase().includes(q))
    );
  },
  addLoginLog: (log: LoginLog): LoginLog => {
    const logs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
    const updated = [log, ...logs];
    setStorage(KEYS.LOGIN_LOGS, updated);
    return log;
  },

  // --- CLASSES ---
  getClasses: (): ClassStream[] => {
    const raw = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    return sortClasses(raw.map(sanitizeClass));
  },
  addClass: async (cls: ClassStream): Promise<ClassStream> => {
    const clean = sanitizeClass(cls);

    // 1. Authoritative Supabase mutation FIRST
    await syncClassToSupabase(clean);

    // 2. Only after Supabase operation succeeds, update local cache
    const list = getStorage<ClassStream[]>(KEYS.CLASSES, []).map(sanitizeClass);
    const existingIndex = list.findIndex(
      (c) => (clean.stream_id && c.stream_id === clean.stream_id) ||
             (c.id === clean.id && (c.stream || '').toLowerCase() === (clean.stream || '').toLowerCase()) ||
             (c.class_name.toLowerCase() === clean.class_name.toLowerCase() && (c.stream || '').toLowerCase() === (clean.stream || '').toLowerCase())
    );
    let updated: ClassStream[];
    if (existingIndex >= 0) {
      updated = list.map((c, idx) => (idx === existingIndex ? clean : c));
    } else {
      updated = [...list, clean];
    }
    setStorage(KEYS.CLASSES, updated);

    // 3. Synchronize Teachers list only after confirmed database success
    if (clean.class_teacher_id) {
      const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
      let teachersChanged = false;
      const targetStreamId = clean.stream_id;
      if (targetStreamId && isUUID(targetStreamId)) {
        const updatedTeachers = teachers.map((t) => {
          if (t.id === clean.class_teacher_id) {
            teachersChanged = true;
            return {
              ...t,
              is_class_teacher: true,
              class_teacher_of_id: targetStreamId,
            };
          }
          return t;
        });
        if (teachersChanged) {
          setStorage(KEYS.TEACHERS, updatedTeachers);
        }
      }
    }

    return clean;
  },
  updateClass: async (cls: ClassStream): Promise<ClassStream> => {
    const clean = sanitizeClass(cls);

    // Find existing class/stream in local cache to inspect changes
    const list = getStorage<ClassStream[]>(KEYS.CLASSES, []).map(sanitizeClass);
    const existing = list.find((c) => {
      if (clean.stream_id && c.stream_id) return c.stream_id === clean.stream_id;
      if (c.id === clean.id && (c.stream || '').toLowerCase() === (clean.stream || '').toLowerCase()) return true;
      if (c.class_name.toLowerCase() === clean.class_name.toLowerCase() && (c.stream || '').toLowerCase() === (clean.stream || '').toLowerCase()) return true;
      return false;
    });

    const existingTeacherId = existing?.class_teacher_id || null;
    const requestedTeacherId = clean.class_teacher_id || null;
    const teacherAssignmentChanged = existing
      ? existingTeacherId !== requestedTeacherId
      : requestedTeacherId !== null;

    // 1. CLASS/STREAM RULE: The request MUST use: stream_id = c.stream_id. Never: c.id. Do not add fallback logic.
    if (teacherAssignmentChanged) {
      if (!clean.stream_id || !isUUID(clean.stream_id)) {
        throw new Error('Class teacher assignment requires a valid stream_id. Parent class ID cannot be used.');
      }
    }

    // 2. Authoritative Supabase mutation for stream/class metadata
    // Note: direct browser mutation of class_teacher_id has been removed from syncClassToSupabase
    await syncClassToSupabase(clean);

    // 3. Authoritative backend bridge via POST /api/admin/assign-class-teacher
    if (teacherAssignmentChanged) {
      // Authoritative server assignment. Throws on failure, preventing LocalStorage update.
      await assignClassTeacher(clean.stream_id, requestedTeacherId);
    }

    // 3. Only after operations succeed, update local classes cache
    const currentList = getStorage<ClassStream[]>(KEYS.CLASSES, []).map(sanitizeClass);
    const updated = currentList.map((c) => {
      if (clean.stream_id && c.stream_id) {
        return c.stream_id === clean.stream_id ? clean : c;
      }
      if (c.id === clean.id && (c.stream || '').toLowerCase() === (clean.stream || '').toLowerCase()) {
        return clean;
      }
      if (c.class_name.toLowerCase() === clean.class_name.toLowerCase() && (c.stream || '').toLowerCase() === (clean.stream || '').toLowerCase()) {
        return clean;
      }
      return c;
    });
    setStorage(KEYS.CLASSES, updated);

    // 4. Synchronize Teachers list if teacherAssignmentChanged was false (e.g. metadata-only update)
    if (!teacherAssignmentChanged && clean.stream_id && isUUID(clean.stream_id)) {
      const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
      let teachersChanged = false;
      const targetStreamId = clean.stream_id; // STRICT: stream_id only, NEVER clean.id
      const updatedTeachers = teachers.map((t) => {
        if (clean.class_teacher_id && t.id === clean.class_teacher_id) {
          teachersChanged = true;
          return {
            ...t,
            is_class_teacher: true,
            class_teacher_of_id: targetStreamId,
          };
        } else if (t.class_teacher_of_id === targetStreamId && t.id !== clean.class_teacher_id) {
          teachersChanged = true;
          return {
            ...t,
            is_class_teacher: false,
            class_teacher_of_id: undefined,
          };
        }
        return t;
      });

      if (teachersChanged) {
        setStorage(KEYS.TEACHERS, updatedTeachers);
      }
    }

    return clean;
  },
  assignClassTeacher: assignClassTeacher,
  deleteStream: async (streamId: string): Promise<void> => {
    if (!streamId || typeof streamId !== 'string' || !streamId.trim()) {
      throw new Error('deleteStream requires a valid, non-empty streamId.');
    }

    const list = getStorage<ClassStream[]>(KEYS.CLASSES, []);

    // 1. Delete stream from Supabase (only from public.streams, never public.classes)
    const client = createSupabaseClient();
    if (client) {
      const { error: sErr } = await client.from('streams').delete().eq('id', streamId);
      if (sErr) {
        console.error('Failed to delete stream from Supabase:', sErr);
        throw new Error(`Failed to delete stream: ${sErr.message}`);
      }
    }

    // 2. Remove ONLY this stream from local storage
    const updated = list.filter((c) => c.stream_id !== streamId);
    setStorage(KEYS.CLASSES, updated);

    // 3. Unassign class teacher and remove allocations for this specific stream
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    let teachersChanged = false;
    const updatedTeachers = teachers.map((t) => {
      let changed = false;
      const newAllocations = (t.allocations || []).filter((a) => (a as any).stream_id !== streamId);
      if (newAllocations.length !== (t.allocations || []).length) {
        changed = true;
      }
      if (t.class_teacher_of_id === streamId) {
        changed = true;
        teachersChanged = true;
        return {
          ...t,
          is_class_teacher: false,
          class_teacher_of_id: undefined,
          allocations: newAllocations,
        };
      }
      if (changed) {
        teachersChanged = true;
        return { ...t, allocations: newAllocations };
      }
      return t;
    });

    if (teachersChanged) {
      setStorage(KEYS.TEACHERS, updatedTeachers);
    }
  },

  deleteClass: async (classId: string): Promise<void> => {
    if (!classId || typeof classId !== 'string' || !classId.trim()) {
      throw new Error('deleteClass requires a valid, non-empty classId.');
    }

    const list = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    const targetClasses = list.filter((c) => c.id === classId);
    const streamIds = targetClasses.map((c) => c.stream_id).filter(Boolean) as string[];

    // 1. Delete parent class and its streams from Supabase
    const client = createSupabaseClient();
    if (client) {
      // Delete streams under this class first
      const { error: sErr } = await client.from('streams').delete().eq('class_id', classId);
      if (sErr) {
        console.error('Failed to delete class streams from Supabase:', sErr);
        throw new Error(`Failed to delete class streams: ${sErr.message}`);
      }

      // Delete parent class row from public.classes
      const { error: cErr } = await client.from('classes').delete().eq('id', classId);
      if (cErr) {
        console.error('Failed to delete parent class from Supabase:', cErr);
        throw new Error(`Failed to delete parent class: ${cErr.message}`);
      }
    }

    // 2. Remove all streams of this parent class from local storage
    const updated = list.filter((c) => c.id !== classId);
    setStorage(KEYS.CLASSES, updated);

    // 3. Unassign class teachers and allocations for this class and its streams
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    let teachersChanged = false;
    const updatedTeachers = teachers.map((t) => {
      let changed = false;
      const newAllocations = (t.allocations || []).filter(
        (a) => a.class_id !== classId && !streamIds.includes((a as any).stream_id || '')
      );
      if (newAllocations.length !== (t.allocations || []).length) {
        changed = true;
      }
      if (t.class_teacher_of_id === classId || streamIds.includes(t.class_teacher_of_id || '')) {
        changed = true;
        teachersChanged = true;
        return {
          ...t,
          is_class_teacher: false,
          class_teacher_of_id: undefined,
          allocations: newAllocations,
        };
      }
      if (changed) {
        teachersChanged = true;
        return { ...t, allocations: newAllocations };
      }
      return t;
    });

    if (teachersChanged) {
      setStorage(KEYS.TEACHERS, updatedTeachers);
    }
  },

  // --- SUBJECTS ---
  getSubjects: (): Subject[] => {
    const raw = getStorage<Subject[]>(KEYS.SUBJECTS, []);
    let hasChanges = false;
    const sanitized = raw.map((s) => {
      const clean = sanitizeSubject(s);
      if (clean.subject_code !== s.subject_code || clean.subject_name !== s.subject_name) {
        hasChanges = true;
      }
      return clean;
    });

    const uniqueSubjects = deduplicateSubjectList(sanitized);

    if (uniqueSubjects.length !== raw.length || hasChanges) {
      setStorage(KEYS.SUBJECTS, uniqueSubjects);
    }
    return uniqueSubjects;
  },
  getSubjectsForGrade: (grade: string): Subject[] => {
    const all = api.getSubjects();
    return getApplicableSubjectsForGrade(grade, all);
  },
  getSubjectsForClass: (classStream: ClassStream | undefined): Subject[] => {
    const all = api.getSubjects();
    return getAllocatedSubjectsForClass(classStream, all);
  },
  getSubjectsForLevel: (level: EducationLevel): Subject[] => {
    const all = api.getSubjects();
    const levelGrades = LEVEL_TO_GRADES[level] || [];
    return all.filter((s) => {
      if (s.status === 'Archived') return false;
      if (s.applicable_grades && s.applicable_grades.length > 0) {
        return s.applicable_grades.some((g) => levelGrades.includes(g) || getEducationLevelForGrade(g) === level);
      }
      return s.education_level === level;
    });
  },
  addSubject: async (sb: Subject): Promise<Subject> => {
    const cleanSb = sanitizeSubject(sb);
    const targetId = isUUID(cleanSb.id) ? cleanSb.id : generateUUID();
    const finalSubject: Subject = { ...cleanSb, id: targetId };

    const client = createSupabaseClient();
    if (client) {
      const payload: any = {
        id: targetId,
        subject_name: finalSubject.subject_name,
        subject_code: finalSubject.subject_code,
        category: finalSubject.category || 'Core',
        department: finalSubject.department || null,
        learning_area: finalSubject.education_level || null,
        updated_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await client
          .from('subjects')
          .insert([payload])
          .select('*');

        if (error) {
          console.error('Failed to insert subject into Supabase:', error);
          if (isDuplicateSubjectCodeError(error)) {
            throw new Error(
              `Learning Area Code Already Exists\n\nThe code "${finalSubject.subject_code}" is already assigned to another Learning Area. Please use a different code.`
            );
          }
          throw new Error(`Failed to save Learning Area: ${error.message || String(error)}`);
        }

        if (data && data.length > 0) {
          const row = data[0];
          const insertedSubject: Subject = {
            ...finalSubject,
            id: row.id || targetId,
            subject_name: row.subject_name || finalSubject.subject_name,
            subject_code: row.subject_code || finalSubject.subject_code,
          };
          const list = getStorage<Subject[]>(KEYS.SUBJECTS, []);
          const updated = [...list, insertedSubject];
          setStorage(KEYS.SUBJECTS, updated);
          return insertedSubject;
        }
      } catch (err: any) {
        if (isDuplicateSubjectCodeError(err)) {
          throw new Error(
            `Learning Area Code Already Exists\n\nThe code "${finalSubject.subject_code}" is already assigned to another Learning Area. Please use a different code.`
          );
        }
        if (err?.message?.includes('Learning Area Code Already Exists')) {
          throw err;
        }
        console.error('Failed to insert subject into Supabase:', err);
        throw new Error(
          err?.message?.includes('Failed to fetch')
            ? `Network Error: Unable to connect to database. Please check your internet connection.`
            : `Failed to save Learning Area: ${err?.message || String(err)}`
        );
      }
    }

    const list = getStorage<Subject[]>(KEYS.SUBJECTS, []);
    const updated = [...list, finalSubject];
    setStorage(KEYS.SUBJECTS, updated);
    return finalSubject;
  },
  updateSubject: async (sb: Subject): Promise<Subject> => {
    const cleanSb = sanitizeSubject(sb);
    if (!cleanSb.id || !isUUID(cleanSb.id)) {
      throw new Error(`Cannot update Learning Area: Invalid UUID '${cleanSb?.id}'`);
    }

    const client = createSupabaseClient();
    if (client) {
      const payload: any = {
        subject_name: cleanSb.subject_name,
        subject_code: cleanSb.subject_code,
        category: cleanSb.category || 'Core',
        department: cleanSb.department || null,
        learning_area: cleanSb.education_level || null,
        updated_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await client
          .from('subjects')
          .update(payload)
          .eq('id', cleanSb.id)
          .select('*');

        if (error) {
          console.error('Failed to update subject in Supabase:', error);
          if (isDuplicateSubjectCodeError(error)) {
            throw new Error(
              `Learning Area Code Already Exists\n\nThe code "${cleanSb.subject_code}" is already assigned to another Learning Area. Please use a different code.`
            );
          }
          throw new Error(`Failed to update Learning Area: ${error.message || String(error)}`);
        }

        if (data && data.length > 0) {
          const row = data[0];
          const updatedSubject: Subject = {
            ...cleanSb,
            id: row.id || cleanSb.id,
            subject_name: row.subject_name || cleanSb.subject_name,
            subject_code: row.subject_code || cleanSb.subject_code,
          };
          const list = getStorage<Subject[]>(KEYS.SUBJECTS, []);
          const updated = list.map((s) => (s.id === updatedSubject.id ? updatedSubject : s));
          setStorage(KEYS.SUBJECTS, updated);
          return updatedSubject;
        }
      } catch (err: any) {
        if (isDuplicateSubjectCodeError(err)) {
          throw new Error(
            `Learning Area Code Already Exists\n\nThe code "${cleanSb.subject_code}" is already assigned to another Learning Area. Please use a different code.`
          );
        }
        if (err?.message?.includes('Learning Area Code Already Exists')) {
          throw err;
        }
        console.error('Failed to update subject in Supabase:', err);
        throw new Error(
          err?.message?.includes('Failed to fetch')
            ? `Network Error: Unable to connect to database. Please check your internet connection.`
            : `Failed to update Learning Area: ${err?.message || String(err)}`
        );
      }
    }

    const list = getStorage<Subject[]>(KEYS.SUBJECTS, []);
    const updated = list.map((s) => (s.id === cleanSb.id ? cleanSb : s));
    setStorage(KEYS.SUBJECTS, updated);
    return cleanSb;
  },
  isSubjectInUse: (id: string): boolean => {
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, []);
    const target = list.find((s) => s.id === id);
    if (target && isStandardSubject(target)) return true;

    // 1. Check marks
    const marks = getStorage<Mark[]>(KEYS.MARKS, []);
    if (marks.some((m) => m && (m.subject_id === id || (target && (m.subject_id === target.subject_code || m.subject_id === target.subject_name))))) return true;

    // 2. Check classes (allocated_subject_ids)
    const classes = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    if (
      classes.some((c) => {
        if (!c) return false;
        if (c.allocated_subject_ids && (c.allocated_subject_ids.includes(id) || (target && (c.allocated_subject_ids.includes(target.subject_code) || c.allocated_subject_ids.includes(target.subject_name))))) return true;
        return false;
      })
    ) {
      return true;
    }

    // 3. Check teachers allocations
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    if (
      teachers.some(
        (t) => t && t.allocations && t.allocations.some((a) => a && (a.subject_id === id || (target && (a.subject_id === target.subject_code || a.subject_id === target.subject_name))))
      )
    ) {
      return true;
    }

    return false;
  },
  deactivateSubject: async (id: string): Promise<void> => {
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, []);
    const target = list.find((s) => s.id === id);
    if (!target) {
      throw new Error(`Subject with ID '${id}' not found.`);
    }
    const client = createSupabaseClient();
    if (client) {
      const { error } = await client.from('subjects').delete().eq('id', id);
      if (error) {
        console.error('Failed to deactivate subject in Supabase:', error);
        throw new Error(`Failed to deactivate subject: ${error.message}`);
      }
    }
    const updated = list.map((s) => (s.id === id ? { ...s, status: 'Archived' as const } : s));
    setStorage(KEYS.SUBJECTS, updated);
  },
  restoreSubject: async (id: string): Promise<void> => {
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, []);
    const target = list.find((s) => s.id === id);
    if (!target) {
      throw new Error(`Subject with ID '${id}' not found.`);
    }
    const activeSubject = { ...target, status: 'Active' as const };
    const client = createSupabaseClient();
    if (client) {
      const payload = {
        id: activeSubject.id,
        subject_name: activeSubject.subject_name,
        subject_code: activeSubject.subject_code,
        category: activeSubject.category || 'Core',
        learning_area: activeSubject.education_level || 'Grade 1–9',
        updated_at: new Date().toISOString(),
      };
      const { error } = await client.from('subjects').upsert([payload]);
      if (error) {
        console.error('Failed to restore subject in Supabase:', error);
        throw new Error(`Failed to restore subject: ${error.message}`);
      }
    }
    const updated = list.map((s) => (s.id === id ? activeSubject : s));
    setStorage(KEYS.SUBJECTS, updated);
  },
  deleteSubject: async (id: string): Promise<{ success: boolean; deactivated: boolean }> => {
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, []);
    const target = list.find((s) => s.id === id);
    if (!target) {
      throw new Error(`Subject with ID '${id}' not found.`);
    }
    if (isStandardSubject(target) || api.isSubjectInUse(id)) {
      await api.deactivateSubject(id);
      return { success: true, deactivated: true };
    }
    const client = createSupabaseClient();
    if (client) {
      const { error } = await client.from('subjects').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete subject from Supabase:', error);
        throw new Error(`Failed to delete subject: ${error.message}`);
      }
    }
    const updated = list.filter((s) => s.id !== id);
    setStorage(KEYS.SUBJECTS, updated);
    return { success: true, deactivated: false };
  },

  // --- TEACHERS ---
  getTeachers: (): Teacher[] => {
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    const users = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
    const { ids: delIds, emails: delEmails } = getDeletedTeacherIdentifiers();
    const clean = teachers.filter(
      (t) =>
        t &&
        !isBlacklistedTestEmail(t.email) &&
        !delIds.has(t.id) &&
        (!t.id || !delIds.has(t.id.toLowerCase())) &&
        (!t.email || !delEmails.has(t.email.trim().toLowerCase()))
    );

    const uniqueTeachers: Teacher[] = [];
    for (const t of clean) {
      const existingIdx = uniqueTeachers.findIndex((ex) => areTeachersSamePerson(ex, t));
      const matchedUser = users.find(
        (u) => (u.teacher_id && u.teacher_id === t.id) || (t.user_id && u.id === t.user_id) || (t.email && u.email && u.email.toLowerCase() === t.email.toLowerCase())
      );
      const tchWithLogin: Teacher = {
        ...t,
        last_login: t.last_login || matchedUser?.last_login || null,
      };

      if (existingIdx >= 0) {
        uniqueTeachers[existingIdx] = mergeTeacherObjects(uniqueTeachers[existingIdx], tchWithLogin);
      } else {
        uniqueTeachers.push(tchWithLogin);
      }
    }

    if (uniqueTeachers.length !== teachers.length) {
      setStorage(KEYS.TEACHERS, uniqueTeachers);
    }
    return uniqueTeachers;
  },
  
  deduplicateTeachersAndUsers: (): void => {
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []).filter((t) => t && !isBlacklistedTestEmail(t.email));
    const users = getStorage<User[]>(KEYS.USERS, adminUsersOnly).filter((u) => u && !isBlacklistedTestEmail(u.email));
    
    // Deduplicate teachers
    const uniqueTeachers: Teacher[] = [];
    let teachersChanged = false;
    
    for (const tch of teachers) {
      const existingIdx = uniqueTeachers.findIndex((ex) => areTeachersSamePerson(ex, tch));
      if (existingIdx >= 0) {
        teachersChanged = true;
        const existing = uniqueTeachers[existingIdx];
        const merged = mergeTeacherObjects(existing, tch);
        const redundantId = tch.id === merged.id ? existing.id : tch.id;
        uniqueTeachers[existingIdx] = merged;

        // Update any users pointing to redundant teacher ID
        if (redundantId && redundantId !== merged.id) {
          const currentUsersList = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
          let usersChangedForTeacher = false;
          const updatedUsers = currentUsersList.map((u) => {
            if (u.teacher_id === redundantId) {
              usersChangedForTeacher = true;
              return { ...u, teacher_id: merged.id };
            }
            return u;
          });
          if (usersChangedForTeacher) {
            setStorage(KEYS.USERS, updatedUsers);
          }
        }
      } else {
        uniqueTeachers.push(tch);
      }
    }
    
    if (teachersChanged || teachers.length !== uniqueTeachers.length) {
      setStorage(KEYS.TEACHERS, uniqueTeachers);
    }
    
    // Deduplicate users (teachers)
    const uniqueUsersMap = new Map<string, User>();
    let usersChanged = false;
    const currentUsers = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
    
    for (const u of currentUsers) {
      const key = (u.email || '').trim().toLowerCase();
      if (uniqueUsersMap.has(key)) {
        usersChanged = true;
        const existing = uniqueUsersMap.get(key)!;
        uniqueUsersMap.set(key, existing);
      } else {
        uniqueUsersMap.set(key, u);
      }
    }
    
    if (usersChanged || currentUsers.length !== uniqueUsersMap.size) {
      setStorage(KEYS.USERS, Array.from(uniqueUsersMap.values()));
    }
  },

  addTeacher: (tch: Teacher, authUserId?: string): Teacher => {
    removeDeletedTeacherIdentifier(tch.id, tch.email, tch.user_id, authUserId);
    const list = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    const emailLower = tch.email ? tch.email.trim().toLowerCase() : '';

    const existingIndex = list.findIndex((t) => areTeachersSamePerson(t, tch));

    let updated: Teacher[];
    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      list[existingIndex] = mergeTeacherObjects(existing, tch);
      updated = list;
    } else {
      updated = [...list, tch];
    }
    setStorage(KEYS.TEACHERS, updated);

    // Create or sync corresponding user account for teacher
    const users = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
    const existingUserIndex = users.findIndex((u) => u.teacher_id === tch.id || (emailLower && u.email.toLowerCase() === emailLower));
    const userPayload: User = {
      id: authUserId || (existingUserIndex >= 0 ? users[existingUserIndex].id : (isUUID(tch.id) ? tch.id : generateUUID())),
      name: tch.teacher_name,
      email: tch.email,
      role: tch.is_class_teacher ? 'class_teacher' : 'subject_teacher',
      teacher_id: tch.id,
      phone: tch.phone,
      username: tch.username,
      tsc_number: tch.tsc_number,
      status: tch.status || 'Active',
      force_password_change: tch.force_password_change ?? true,
      last_login: tch.last_login,
    };

    if (existingUserIndex >= 0) {
      users[existingUserIndex] = { ...users[existingUserIndex], ...userPayload };
      setStorage(KEYS.USERS, users);
    } else {
      setStorage(KEYS.USERS, [...users, userPayload]);
    }

    api.deduplicateTeachersAndUsers();
    return tch;
  },
  updateTeacher: async (tch: Teacher): Promise<Teacher> => {
    const targetEmailLower = tch.email ? tch.email.trim().toLowerCase() : '';

    // Synchronous, awaited Supabase database update FIRST if connected
    const client = getSupabaseClient();
    if (client) {
      let serverUpdated = false;

      const currentUser = api.getCurrentUser();
      const isCallerAdmin = !currentUser || currentUser.role === 'admin';

      // Attempt server-side administrative update endpoint FIRST for administrators
      if (isCallerAdmin) {
        try {
          // 1. Obtain active session token, checking freshness with 60-second safety window
          let token = await getFreshSessionToken(client, false);

          // 2. If no active authenticated session exists, fail with clear authentication error
          if (!token) {
            throw new Error('Teacher details could not be saved: Unauthorized: Missing authentication token.');
          }

          const sendUpdateRequest = async (authToken: string) => {
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            };
            return await fetch(buildApiUrl('/api/admin/update-teacher'), {
              method: 'POST',
              headers,
              body: JSON.stringify({
                teacher: tch,
                token: authToken,
              }),
            });
          };

          let response = await sendUpdateRequest(token);

          // 3. 401 Recovery: If the endpoint returns 401 Unauthorized, perform ONE refresh and ONE retry
          if (response.status === 401) {
            const refreshedToken = await getFreshSessionToken(client, true);
            if (refreshedToken) {
              token = refreshedToken;
              response = await sendUpdateRequest(token);
            }
          }

          if (response.ok) {
            const respData = await response.json().catch(() => null);
            if (respData && respData.success) {
              if (respData.teacher && respData.teacher.id && isUUID(respData.teacher.id)) {
                tch.id = respData.teacher.id;
              }
              serverUpdated = true;
            }
          } else {
            const errData = await response.json().catch(() => null);
            if (errData && errData.error && response.status !== 404 && response.status !== 502 && response.status !== 503) {
              throw new Error(`Teacher details could not be saved: ${errData.error}`);
            }
          }
        } catch (srvErr: any) {
          if (srvErr.message && srvErr.message.includes('Teacher details could not be saved')) {
            throw srvErr;
          }
          console.warn('Backend endpoint /api/admin/update-teacher call failed or unavailable, falling back to client SDK:', srvErr);
        }
      }

      if (!serverUpdated) {
        let teacherUuid: string | null = isUUID(tch.id) ? tch.id : null;

      // 1. Resolve teacher's genuine UUID from Supabase if tch.id is non-UUID
      if (!teacherUuid && targetEmailLower) {
        try {
          const { data: dbMatch } = await client.from('teachers').select('id').eq('email', targetEmailLower).maybeSingle();
          if (dbMatch && isUUID(dbMatch.id)) {
            teacherUuid = dbMatch.id;
            tch.id = teacherUuid;
          }
        } catch (err) {
          console.warn('Could not lookup teacher UUID by email:', err);
        }
      }

      // If still not found in Supabase, insert teacher into Supabase to acquire UUID
      if (!teacherUuid && targetEmailLower) {
        try {
          const { data: insertedDb, error: insErr } = await client.from('teachers').insert([{
            teacher_name: tch.teacher_name,
            email: tch.email,
            phone: tch.phone,
            tsc_number: tch.tsc_number || null,
            is_class_teacher: tch.is_class_teacher || false,
          }]).select().single();

          if (insertedDb && isUUID(insertedDb.id)) {
            teacherUuid = insertedDb.id;
            tch.id = teacherUuid;
          } else if (insErr) {
            console.warn('Could not insert teacher into Supabase to acquire UUID:', insErr);
          }
        } catch (err) {
          console.warn('Error inserting teacher into Supabase:', err);
        }
      }

      if (teacherUuid && isUUID(teacherUuid)) {
        // Resolve allocation database UUIDs FIRST before updating records
        const rawInserts: Array<{ subject_id: string; class_id: string | null; stream_id: string | null }> = [];
        if (tch.allocations && tch.allocations.length > 0) {
          for (const alloc of tch.allocations) {
            const subjectUuid = await resolveSubjectUUID(client, alloc);
            const { class_id: classUuid, stream_id: streamUuid } = await resolveClassAndStreamUUIDs(client, alloc);

            if (subjectUuid) {
              rawInserts.push({
                subject_id: subjectUuid,
                class_id: classUuid,
                stream_id: streamUuid,
              });
            }
          }
        }

        // Deduplicate inserts
        const seenAllocationKeys = new Set<string>();
        const inserts: Array<{ subject_id: string; class_id: string | null; stream_id: string | null }> = [];
        for (const item of rawInserts) {
          const key = `${item.subject_id}_${item.class_id || 'null'}_${item.stream_id || 'null'}`;
          if (!seenAllocationKeys.has(key)) {
            seenAllocationKeys.add(key);
            inserts.push(item);
          }
        }

        // Update primary teacher record
        const { error: teacherErr } = await client.from('teachers').update({
          teacher_name: tch.teacher_name,
          email: tch.email,
          phone: tch.phone,
          tsc_number: tch.tsc_number || null,
          is_class_teacher: tch.is_class_teacher || false,
        }).eq('id', teacherUuid);

        if (teacherErr) {
          console.error('Supabase update teacher record error:', teacherErr);
          throw new Error(formatTeacherSaveError(teacherErr, 'Teacher details could not be saved.'));
        }

        if (targetEmailLower) {
          await client.from('users').update({
            name: tch.teacher_name,
            email: tch.email,
            role: tch.is_class_teacher ? 'class_teacher' : 'subject_teacher',
          }).or(`teacher_id.eq.${teacherUuid},email.eq.${targetEmailLower}`);
        }

        if (isCallerAdmin) {
          // Unassign previous stream class_teacher_id in DB
          await client.from('streams').update({ class_teacher_id: null }).eq('class_teacher_id', teacherUuid);

          if (tch.is_class_teacher && tch.class_teacher_of_id) {
            if (isUUID(tch.class_teacher_of_id)) {
              await client.from('streams').update({ class_teacher_id: teacherUuid }).eq('id', tch.class_teacher_of_id);
            }
          }

          // Only update allocations if allocations were explicitly provided
          if (tch.allocations !== undefined) {
            // Atomic allocation update via RPC or fail-safe restoration
            const { error: rpcAllocErr } = await client.rpc('update_teacher_allocations_atomic', {
              p_teacher_id: teacherUuid,
              p_allocations: inserts,
            });

            if (rpcAllocErr) {
              if (rpcAllocErr.code === 'PGRST202') {
                const { data: existingAllocs } = await client
                  .from('teacher_subjects')
                  .select('subject_id, class_id, stream_id')
                  .eq('teacher_id', teacherUuid);

                const { error: delAllocErr } = await client.from('teacher_subjects').delete().eq('teacher_id', teacherUuid);
                if (delAllocErr) {
                  console.error('Supabase delete allocations error:', delAllocErr);
                  throw new Error(formatTeacherSaveError(delAllocErr, 'Learning area allocations could not be saved.'));
                }

                if (inserts.length > 0) {
                  const fullInserts = inserts.map((i) => ({ teacher_id: teacherUuid, ...i }));
                  const { error: insAllocErr } = await client.from('teacher_subjects').insert(fullInserts);
                  if (insAllocErr) {
                    console.error('Supabase insert allocations error, restoring original allocations:', insAllocErr);
                    if (existingAllocs && existingAllocs.length > 0) {
                      try {
                        await client.from('teacher_subjects').insert(existingAllocs.map((a: any) => ({ teacher_id: teacherUuid, ...a })));
                      } catch (restoreErr) {
                        console.warn('Could not restore original allocations after insert failure:', restoreErr);
                      }
                    }
                    throw new Error(formatTeacherSaveError(insAllocErr, 'Learning area allocations could not be saved.'));
                  }
                }
              } else {
                console.error('Supabase RPC update_teacher_allocations_atomic error:', rpcAllocErr);
                throw new Error(formatTeacherSaveError(rpcAllocErr, 'Learning area allocations could not be saved.'));
              }
            }
          }
        }
      }
    }
  }

    // ONLY AFTER SUCCESSFUL DB UPDATE, commit to local state
    const list = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    const updated = list.map((t) =>
      t.id === tch.id || (targetEmailLower && t.email && t.email.trim().toLowerCase() === targetEmailLower) ? { ...t, ...tch } : t
    );
    setStorage(KEYS.TEACHERS, updated);

    // Sync corresponding User object
    const users = getStorage<User[]>(KEYS.USERS, adminUsersOnly);
    const userIndex = users.findIndex((u) => u.teacher_id === tch.id || (targetEmailLower && u.email.toLowerCase() === targetEmailLower));
    if (userIndex >= 0) {
      users[userIndex] = {
        ...users[userIndex],
        name: tch.teacher_name,
        email: tch.email,
        phone: tch.phone,
        username: tch.username,
        tsc_number: tch.tsc_number,
        status: tch.status,
        role: (tch.is_class_teacher && Boolean(tch.class_teacher_of_id)) ? 'class_teacher' : 'subject_teacher',
        force_password_change: tch.force_password_change,
        last_login: tch.last_login || users[userIndex].last_login,
      };
      setStorage(KEYS.USERS, users);
    } else {
      const newUser: User = {
        id: isUUID(tch.id) ? tch.id : generateUUID(),
        name: tch.teacher_name,
        email: tch.email,
        role: (tch.is_class_teacher && Boolean(tch.class_teacher_of_id)) ? 'class_teacher' : 'subject_teacher',
        teacher_id: tch.id,
        phone: tch.phone,
        username: tch.username,
        tsc_number: tch.tsc_number,
        status: tch.status || 'Active',
        force_password_change: tch.force_password_change ?? true,
        last_login: tch.last_login,
      };
      setStorage(KEYS.USERS, [...users, newUser]);
    }

    // Sync classes list if teacher is assigned or removed as class teacher
    const classesList = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    let classesChanged = false;

    const updatedClasses = classesList.map((c) => {
      const isTargetStream = Boolean(
        (c.stream_id && tch.class_teacher_of_id && c.stream_id === tch.class_teacher_of_id) ||
        (tch.class_teacher_of_id && c.id === tch.class_teacher_of_id)
      );
      if (tch.is_class_teacher && isTargetStream) {
        if (c.class_teacher_id !== tch.id) {
          classesChanged = true;
          return { ...c, class_teacher_id: tch.id };
        }
      } else if (c.class_teacher_id === tch.id && (!tch.is_class_teacher || !isTargetStream)) {
        classesChanged = true;
        return { ...c, class_teacher_id: undefined };
      }
      return c;
    });

    if (classesChanged) {
      setStorage(KEYS.CLASSES, updatedClasses);
    }

    api.deduplicateTeachersAndUsers();
    return tch;
  },
  deleteTeacher: async (id: string, options?: { alreadyDeletedOnServer?: boolean }): Promise<void> => {
    const list = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    const target = list.find((t) => t.id === id || (t.email && t.email.toLowerCase() === id.toLowerCase()));
    const targetEmailLower = target?.email ? target.email.trim().toLowerCase() : '';
    const deleteId = target?.id || id;

    const client = getSupabaseClient();
    if (client && !options?.alreadyDeletedOnServer) {
      let accessToken: string | undefined;
      try {
        const { data: sessionData } = await client.auth.getSession();
        accessToken = sessionData?.session?.access_token;
      } catch {
        // ignore
      }

      let serverDeleted = false;
      let serverError: string | null = null;
      if (typeof fetch === 'function' && typeof window !== 'undefined') {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

          const response = await fetch(buildApiUrl('/api/admin/delete-teacher'), {
            method: 'POST',
            headers,
            body: JSON.stringify({
              teacherId: deleteId,
              email: targetEmailLower || undefined,
              token: accessToken,
            }),
          });

          let resData: any = null;
          try {
            resData = await response.json();
          } catch {
            // ignore
          }

          if (response.ok && resData?.success) {
            serverDeleted = true;
          } else if (resData?.error) {
            serverError = resData.error;
          } else if (!response.ok) {
            serverError = `Server returned status ${response.status}: ${response.statusText || 'Teacher deletion rejected'}`;
          }
        } catch (fetchErr) {
          console.warn('Server fetch for delete-teacher failed, falling back to direct Supabase client deletion:', fetchErr);
        }
      }

      if (serverError) {
        throw new Error(serverError);
      }

      if (!serverDeleted) {
        // In direct Node/testing context or when server endpoint fetch is unreachable
        let deleteUuid: string | null = isUUID(deleteId) ? deleteId : null;
        if (!deleteUuid && targetEmailLower) {
          const { data: dbMatch } = await client.from('teachers').select('id').eq('email', targetEmailLower).maybeSingle();
          if (dbMatch && isUUID(dbMatch.id)) {
            deleteUuid = dbMatch.id;
          }
        }

        if (deleteUuid && isUUID(deleteUuid)) {
          const { error: tsErr } = await client.from('teacher_subjects').delete().eq('teacher_id', deleteUuid);
          if (tsErr) {
            console.error('Supabase delete teacher_subjects error:', tsErr);
            throw new Error(`Failed to delete teacher subject allocations from database: ${tsErr.message}`);
          }
          const { error: strErr } = await client.from('streams').update({ class_teacher_id: null }).eq('class_teacher_id', deleteUuid);
          if (strErr) {
            console.error('Supabase update stream class_teacher_id error:', strErr);
            throw new Error(`Failed to clear class teacher allocation from streams in database: ${strErr.message}`);
          }
          const { error: tErr } = await client.from('teachers').delete().eq('id', deleteUuid);
          if (tErr) {
            console.error('Supabase deleteTeacher error:', tErr);
            throw new Error(`Failed to delete teacher from database: ${tErr.message}`);
          }
          const { error: uErr } = await client.from('users').delete().eq('teacher_id', deleteUuid);
          if (uErr) {
            console.error('Supabase delete user error:', uErr);
            throw new Error(`Failed to delete user record from database: ${uErr.message}`);
          }
        } else if (targetEmailLower) {
          const { error: tErr } = await client.from('teachers').delete().eq('email', targetEmailLower);
          if (tErr) {
            console.error('Supabase deleteTeacher error:', tErr);
            throw new Error(`Failed to delete teacher from database: ${tErr.message}`);
          }
          const { error: uErr } = await client.from('users').delete().eq('email', targetEmailLower);
          if (uErr) {
            console.error('Supabase delete user error:', uErr);
            throw new Error(`Failed to delete user record from database: ${uErr.message}`);
          }
        }
        if (target?.user_id && isUUID(target.user_id)) {
          const { error: uIdErr } = await client.from('users').delete().eq('id', target.user_id);
          if (uIdErr) {
            console.error('Supabase delete user by user_id error:', uIdErr);
            throw new Error(`Failed to delete user record from database: ${uIdErr.message}`);
          }
        }
      }
    }

    recordDeletedTeacherIdentifier(id, target?.id, target?.email, target?.user_id);

    const updated = list.filter(
      (t) => t.id !== id && t.id !== target?.id && (!targetEmailLower || t.email.trim().toLowerCase() !== targetEmailLower)
    );
    setStorage(KEYS.TEACHERS, updated);

    // Remove corresponding user account(s)
    if (target) {
      if (target.email) api.deleteUser(target.email);
      if (target.user_id) api.deleteUser(target.user_id);
    }
    api.deleteUser(id);

    // Remove class teacher assignment from classes
    const classesList = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    let classesChanged = false;
    const updatedClasses = classesList.map((c) => {
      if (c.class_teacher_id === id || (target && c.class_teacher_id === target.id)) {
        classesChanged = true;
        return { ...c, class_teacher_id: undefined };
      }
      return c;
    });
    if (classesChanged) {
      setStorage(KEYS.CLASSES, updatedClasses);
    }

    api.deduplicateTeachersAndUsers();
  },

  // --- STUDENTS ---
  getStudents: (): Student[] => {
    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    return list.filter((s) => {
      const id = String(s.id || '');
      const adm = String(s.admission_number || '');
      const name = String(s.full_name || '');
      return (
        !id.startsWith('std_test_') &&
        !id.startsWith('test_') &&
        adm !== 'ADM-9001' &&
        adm !== 'ADM-9002' &&
        !adm.startsWith('TEST_') &&
        !adm.startsWith('ADM-900') &&
        name !== 'Alice Wambui' &&
        name !== 'Brian Kipchoge'
      );
    }).map((s) => ({
      ...s,
      full_name: formatLearnerName(s.full_name || getStudentFullName(s)),
      first_name: s.first_name ? formatLearnerName(s.first_name) : undefined,
      second_name: s.second_name ? formatLearnerName(s.second_name) : undefined,
      last_name: s.last_name ? formatLearnerName(s.last_name) : undefined,
    }));
  },

  getAllStudentsForMarks: (): Student[] => {
    const isDemoOrTest = (s: Student) => {
      const id = String(s.id || '');
      const adm = String(s.admission_number || '');
      const name = String(s.full_name || '');
      return (
        id.startsWith('std_test_') ||
        id.startsWith('test_') ||
        adm === 'ADM-9001' ||
        adm === 'ADM-9002' ||
        adm.startsWith('TEST_') ||
        adm.startsWith('ADM-900') ||
        name === 'Alice Wambui' ||
        name === 'Brian Kipchoge'
      );
    };

    const primaryList = api.getStudents();
    const allocatedList = getStorage<Student[]>(KEYS.ALLOCATED_STUDENTS, [])
      .filter((s) => !isDemoOrTest(s))
      .map((s) => ({
        ...s,
        full_name: formatLearnerName(s.full_name || getStudentFullName(s)),
        first_name: s.first_name ? formatLearnerName(s.first_name) : undefined,
        second_name: s.second_name ? formatLearnerName(s.second_name) : undefined,
        last_name: s.last_name ? formatLearnerName(s.last_name) : undefined,
      }));
    
    // Merge primary and allocated lists, avoiding duplicates
    const allStudentsMap = new Map<string, Student>();
    primaryList.forEach(s => allStudentsMap.set(s.id, s));
    allocatedList.forEach(s => allStudentsMap.set(s.id, s));
    
    return Array.from(allStudentsMap.values());
  },
  addStudent: async (std: Student): Promise<Student> => {
    const client = getSupabaseClient();
    const activeAY = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();
    const isFutureIntake = isIntakePeriodFuture(
      std.intake_year,
      std.intake_term,
      activeAY?.year,
      activeTerm?.term_name
    );

    const rawEnrolmentStatus = std.enrolment_status;
    let enrolmentStatus: EnrolmentStatus;
    if (rawEnrolmentStatus === 'future' || rawEnrolmentStatus === 'inactive' || rawEnrolmentStatus === 'active') {
      enrolmentStatus = rawEnrolmentStatus;
    } else if (isFutureIntake) {
      enrolmentStatus = 'future';
    } else {
      enrolmentStatus = std.active === false ? 'inactive' : 'active';
    }
    const computedActive = enrolmentStatus === 'active';
    const admissionDate = std.admission_date || (computedActive ? new Date().toISOString().split('T')[0] : undefined);

    if (client) {
      const { class_id: targetClassUuid, stream_id: targetStreamUuid } = await resolveStudentClassAndStreamUuids(
        std.stream_id || std.class_id || '',
        client,
        std.stream_id || (std as any).stream || std.grade
      );
      const fullName = getStudentFullName(std) || std.full_name || `${std.first_name || ''} ${std.last_name || ''}`.trim();
      const payload: any = {
        admission_number: std.admission_number,
        full_name: fullName,
        gender: (std.gender === 'M' || (std.gender as string) === 'Boy' || (std.gender as string) === 'Male') ? 'M' : 'F',
        class_id: targetClassUuid,
        stream_id: targetStreamUuid,
        dob: std.dob || null,
        active: computedActive,
      };

      if (std.id && isUUID(std.id)) {
        payload.id = std.id;
      }

      let { data, error } = await client.from('students').insert([payload]).select('*');

      // If duplicate admission number (error code 23505), update existing student record instead
      if (error && error.code === '23505') {
        const { data: updateData, error: updateErr } = await client
          .from('students')
          .update({
            full_name: payload.full_name,
            gender: payload.gender,
            class_id: payload.class_id,
            stream_id: payload.stream_id,
            dob: payload.dob,
            active: payload.active,
            updated_at: new Date().toISOString(),
          })
          .eq('admission_number', std.admission_number)
          .select('*');

        if (!updateErr && updateData && updateData[0]) {
          data = updateData;
          error = null;
        }
      }

      if (error) {
        console.error('Supabase addStudent error:', error);
        throw new Error(`Failed to register learner in database: ${error.message}`);
      }

      if (data && data[0]) {
        const created = data[0];
        const currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
        const matchedClass = currentClasses.find((c) => c.id === created.stream_id || c.id === created.class_id);
        const grade = matchedClass ? (matchedClass.class_name as GradeName) : std.grade;
        const level = matchedClass ? matchedClass.education_level : std.education_level;

        const nameParts = (created.full_name || '').trim().split(/\s+/);
        const firstName = std.first_name || nameParts[0] || '';
        const lastName = std.last_name || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
        const secondName = std.second_name || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : undefined);

        const newStudentObj: Student = {
          ...std,
          id: created.id,
          admission_number: created.admission_number,
          full_name: created.full_name,
          first_name: firstName,
          second_name: secondName,
          last_name: lastName,
          gender: (created.gender === 'M' || created.gender === 'Boy' || created.gender === 'Male') ? 'M' : 'F',
          class_id: created.class_id || std.class_id || created.stream_id || '',
          stream_id: created.stream_id || std.stream_id || created.class_id || '',
          active: computedActive,
          enrolment_status: enrolmentStatus,
          intake_year: std.intake_year,
          intake_term: std.intake_term,
          admission_date: admissionDate,
          grade: grade,
          education_level: level,
        };

        const list = getStorage<Student[]>(KEYS.STUDENTS, []);
        const updated = [...list.filter((s) => s.id !== newStudentObj.id), newStudentObj];
        setStorage(KEYS.STUDENTS, updated);
        return newStudentObj;
      }
    }

    const normalizedStd: Student = {
      ...std,
      active: computedActive,
      enrolment_status: enrolmentStatus,
      admission_date: admissionDate,
    };
    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    const updated = [...list, normalizedStd];
    setStorage(KEYS.STUDENTS, updated);
    return normalizedStd;
  },
  batchAddStudents: async (newStudents: Student[]): Promise<Student[]> => {
    const client = getSupabaseClient();
    const activeAY = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();

    if (client && newStudents.length > 0) {
      const classUuidCache = new Map<string, { class_id: string | null; stream_id: string | null }>();
      const getResolvedClassAndStream = async (classId?: string, streamId?: string, gradeHint?: string) => {
        const key = `${classId || ''}__${streamId || ''}__${gradeHint || ''}`.trim();
        if (!classUuidCache.has(key)) {
          const resolved = await resolveStudentClassAndStreamUuids(
            streamId || classId || '',
            client,
            streamId || gradeHint
          );
          classUuidCache.set(key, resolved);
        }
        return classUuidCache.get(key)!;
      };

      const payloads = [];
      for (const std of newStudents) {
        const { class_id: targetClassUuid, stream_id: targetStreamUuid } = await getResolvedClassAndStream(
          std.class_id,
          std.stream_id,
          std.grade || (std as any).stream
        );
        const fullName = getStudentFullName(std) || std.full_name || `${std.first_name || ''} ${std.last_name || ''}`.trim();
        const isFutureIntake = isIntakePeriodFuture(
          std.intake_year,
          std.intake_term,
          activeAY?.year,
          activeTerm?.term_name
        );

        const rawEnrolmentStatus = std.enrolment_status;
        let enrolmentStatus: EnrolmentStatus;
        if (rawEnrolmentStatus === 'future' || rawEnrolmentStatus === 'inactive' || rawEnrolmentStatus === 'active') {
          enrolmentStatus = rawEnrolmentStatus;
        } else if (isFutureIntake) {
          enrolmentStatus = 'future';
        } else {
          enrolmentStatus = std.active === false ? 'inactive' : 'active';
        }
        const computedActive = enrolmentStatus === 'active';

        const p: any = {
          admission_number: std.admission_number,
          full_name: fullName,
          gender: (std.gender === 'M' || (std.gender as string) === 'Boy' || (std.gender as string) === 'Male') ? 'M' : 'F',
          class_id: targetClassUuid,
          stream_id: targetStreamUuid,
          dob: std.dob || null,
          active: computedActive,
        };
        if (std.id && isUUID(std.id)) {
          p.id = std.id;
        }
        payloads.push(p);
      }

      const { data, error } = await client.from('students').insert(payloads).select('*');
      if (error) {
        console.error('Supabase batchAddStudents error:', error);
        let errorMsg = error.message || (error as any).details || 'Database error while batch registering learners';
        if (error.code === '23505') {
          errorMsg = `Duplicate admission number constraint violation (${error.details || error.message})`;
        } else if (error.code === '23503') {
          errorMsg = `Foreign key reference error for class or stream (${error.details || error.message})`;
        } else if (error.code === '23502') {
          errorMsg = `Required learner field is missing (${error.details || error.message})`;
        }
        const errorObj = new Error(`Failed to batch register learners in database: ${errorMsg}`);
        (errorObj as any).code = error.code;
        (errorObj as any).details = error.details;
        (errorObj as any).hint = error.hint;
        throw errorObj;
      }

      if (data && data.length > 0) {
        const currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
        const createdStudents: Student[] = data.map((created: any) => {
          const matchedInput = newStudents.find((s) => s.admission_number === created.admission_number);
          const isFutureIntake = isIntakePeriodFuture(
            matchedInput?.intake_year,
            matchedInput?.intake_term,
            activeAY?.year,
            activeTerm?.term_name
          );

          const rawEnrolmentStatus = matchedInput?.enrolment_status;
          let enrolmentStatus: EnrolmentStatus;
          if (rawEnrolmentStatus === 'future' || rawEnrolmentStatus === 'inactive' || rawEnrolmentStatus === 'active') {
            enrolmentStatus = rawEnrolmentStatus;
          } else if (isFutureIntake) {
            enrolmentStatus = 'future';
          } else {
            enrolmentStatus = (created.active === false ? 'inactive' : 'active');
          }
          const computedActive = (created.active !== false && enrolmentStatus === 'active');

          const matchedClass = currentClasses.find((c) => c.id === created.stream_id || c.id === created.class_id);
          const grade = matchedClass ? (matchedClass.class_name as GradeName) : undefined;
          const level = matchedClass ? matchedClass.education_level : (grade ? getEducationLevelForGrade(grade) : undefined);

          const nameParts = (created.full_name || '').trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          const secondName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : undefined;
          const admissionDate = matchedInput?.admission_date || (computedActive ? new Date().toISOString().split('T')[0] : undefined);

          return {
            id: created.id,
            admission_number: created.admission_number,
            full_name: created.full_name,
            first_name: firstName,
            second_name: secondName,
            last_name: lastName,
            gender: (created.gender === 'M' || created.gender === 'Boy' || created.gender === 'Male') ? 'M' : 'F',
            class_id: created.class_id || created.stream_id || '',
            stream_id: created.stream_id || created.class_id || '',
            dob: created.dob || undefined,
            active: computedActive,
            enrolment_status: enrolmentStatus,
            intake_year: matchedInput?.intake_year,
            intake_term: matchedInput?.intake_term,
            admission_date: admissionDate,
            grade: grade || matchedInput?.grade,
            education_level: level || matchedInput?.education_level || (grade ? getEducationLevelForGrade(grade) : undefined),
          };
        });

        const list = getStorage<Student[]>(KEYS.STUDENTS, []);
        const createdIds = new Set(createdStudents.map((s) => s.id));
        const updated = [...list.filter((s) => !createdIds.has(s.id)), ...createdStudents];
        setStorage(KEYS.STUDENTS, updated);
        return createdStudents;
      }

      return [];
    }

    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    const normalizedNew = newStudents.map((std) => ({
      ...std,
      admission_date: std.admission_date || (std.active !== false ? new Date().toISOString().split('T')[0] : undefined),
    }));
    const updated = [...list, ...normalizedNew];
    setStorage(KEYS.STUDENTS, updated);
    return normalizedNew;
  },
  updateStudent: async (std: Student): Promise<Student> => {
    const rawEnrolmentStatus = std.enrolment_status;
    const enrolmentStatus: EnrolmentStatus = 
      (rawEnrolmentStatus === 'future' || rawEnrolmentStatus === 'inactive' || rawEnrolmentStatus === 'active')
        ? rawEnrolmentStatus
        : (std.active === false ? 'inactive' : 'active');
    const targetActive = enrolmentStatus === 'active';
    const targetStatus = targetActive ? 'Active' : 'Disabled';

    const normalizedStd: Student = {
      ...std,
      active: targetActive,
      enrolment_status: enrolmentStatus,
      admission_date: std.admission_date || (targetActive ? new Date().toISOString().split('T')[0] : undefined),
      intake_year: std.intake_year,
      intake_term: std.intake_term,
    };

    const client = getSupabaseClient();
    if (client && isUUID(std.id)) {
      const { class_id: targetClassUuid, stream_id: targetStreamUuid } = await resolveStudentClassAndStreamUuids(
        std.stream_id || std.class_id || '',
        client,
        std.stream_id || (std as any).stream || std.grade
      );

      const payload = {
        admission_number: std.admission_number,
        full_name: getStudentFullName(std) || std.full_name,
        gender: (std.gender === 'M' || (std.gender as string) === 'Boy' || (std.gender as string) === 'Male') ? 'M' : 'F',
        class_id: targetClassUuid,
        stream_id: targetStreamUuid,
        dob: std.dob || null,
        active: targetActive,
        updated_at: new Date().toISOString(),
      };

      const { error } = await client.from('students').update(payload).eq('id', std.id);
      if (error) {
        console.error('Supabase updateStudent error:', error);
        throw new Error(`Failed to update learner in database: ${error.message}`);
      }

      // Synchronize status in public.users
      try {
        await client.from('users').update({
          status: targetStatus,
          updated_at: new Date().toISOString()
        }).eq('student_id', std.id);
      } catch (userSyncErr) {
        console.warn('Could not synchronize public.users status in updateStudent:', userSyncErr);
      }

      // If auth session exists, attempt admin API call for audit log and auth metadata sync
      try {
        const { data: sessionData } = await client.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (accessToken && typeof fetch === 'function' && typeof window !== 'undefined') {
          await fetch(buildApiUrl('/api/admin/set-learner-status'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              student_id: std.id,
              active: targetActive,
              enrolment_status: enrolmentStatus,
              token: accessToken
            })
          });
        }
      } catch {
        // Non-blocking fallback
      }
    }

    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    const updated = list.map((s) => (s.id === std.id ? normalizedStd : s));
    setStorage(KEYS.STUDENTS, updated);

    // Synchronize local cache for users
    const userList = getStorage<User[]>(KEYS.USERS, []);
    const updatedUsers = userList.map((u) => {
      if (u.student_id === std.id && u.role === 'learner') {
        return { ...u, status: targetStatus };
      }
      return u;
    });
    setStorage(KEYS.USERS, updatedUsers);

    return normalizedStd;
  },
  deleteStudent: async (id: string): Promise<void> => {
    const client = getSupabaseClient();
    if (client && isUUID(id)) {
      let accessToken: string | undefined;
      try {
        const { data: sessionData } = await client.auth.getSession();
        accessToken = sessionData?.session?.access_token;
      } catch {
        // ignore
      }

      if (typeof fetch === 'function' && typeof window !== 'undefined') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

        const response = await fetch(buildApiUrl('/api/admin/delete-learner'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ student_id: id, token: accessToken }),
        });

        let resData: any = null;
        try {
          resData = await response.json();
        } catch {
          // ignore
        }

        if (!response.ok || !resData?.success) {
          throw new Error(resData?.error || `Failed to delete learner (${response.status})`);
        }
      } else {
        // In direct Node/testing context, verify academic record safety gate before deleting
        const { count: marksCount } = await client.from('marks').select('id', { count: 'exact', head: true }).eq('student_id', id);
        if ((marksCount || 0) > 0) {
          throw new Error(`Permanent Deletion Blocked: Learner has ${marksCount} assessment mark(s).`);
        }
        const { error } = await client.from('students').delete().eq('id', id);
        if (error) {
          console.error('Supabase deleteStudent error:', error);
          throw new Error(`Failed to delete learner from database: ${error.message}`);
        }
      }
    } else if (client && !isUUID(id)) {
      // Non-UUID ID (e.g. test student std_test_promo_01)
      const { error } = await client.from('students').delete().or(`id.eq.${id},admission_number.eq.${id}`);
      if (error) {
        console.error('Supabase deleteStudent error:', error);
        throw new Error(`Failed to delete learner from database: ${error.message}`);
      }
    }

    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    const updated = list.filter((s) => s.id !== id && s.admission_number !== id);
    setStorage(KEYS.STUDENTS, updated);
  },
  setLearnerStatus: async (
    studentId: string,
    action: 'admit' | 'deactivate' | 'reactivate',
    reason?: string
  ): Promise<Student> => {
    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    const student = list.find((s) => s.id === studentId);
    if (!student) {
      throw new Error(`Learner with ID '${studentId}' not found.`);
    }

    const isAdmit = action === 'admit';
    const isReactivate = action === 'reactivate';
    const newActive = isAdmit || isReactivate;
    const newEnrolmentStatus: EnrolmentStatus = newActive ? 'active' : 'inactive';
    const newAccountStatus = newActive ? 'Active' : 'Disabled';
    const activeAY = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();
    const admissionDate = isAdmit ? (student.admission_date || new Date().toISOString().split('T')[0]) : student.admission_date;

    const client = getSupabaseClient();
    if (client && isUUID(studentId)) {
      let accessToken: string | undefined;
      try {
        const { data: sessionData } = await client.auth.getSession();
        accessToken = sessionData?.session?.access_token;
      } catch {
        // ignore
      }

      if (typeof fetch === 'function' && typeof window !== 'undefined') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

        const response = await fetch(buildApiUrl('/api/admin/set-learner-status'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            student_id: studentId,
            action,
            active: newActive,
            enrolment_status: newEnrolmentStatus,
            admission_date: admissionDate,
            reason,
            token: accessToken,
          }),
        });

        let resData: any = null;
        try {
          resData = await response.json();
        } catch {
          // ignore
        }

        if (!response.ok || !resData?.success) {
          throw new Error(resData?.error || `Failed to update learner status (${response.status})`);
        }
      } else {
        // Fallback for direct node/backend execution
        await client.from('students').update({
          active: newActive,
          updated_at: new Date().toISOString(),
        }).eq('id', studentId);

        await client.from('users').update({
          status: newAccountStatus,
          updated_at: new Date().toISOString(),
        }).eq('student_id', studentId);

        try {
          const actionLogName = isAdmit ? 'LEARNER_ADMITTED' : (isReactivate ? 'LEARNER_REACTIVATED' : 'LEARNER_DEACTIVATED');
          await client.from('audit_logs').insert([{
            action: actionLogName,
            details: {
              student_id: studentId,
              admission_number: student.admission_number,
              full_name: student.full_name,
              admission_date: admissionDate,
              reason: reason || (isAdmit ? 'Manual admission by administrator' : (isReactivate ? 'Reactivation by administrator' : 'Deactivation by administrator')),
              timestamp: new Date().toISOString(),
            },
          }]);
        } catch {
          // Non-blocking audit log
        }
      }
    }

    const updatedStudent: Student = {
      ...student,
      active: newActive,
      enrolment_status: newEnrolmentStatus,
      admission_date: admissionDate,
      intake_year: isAdmit && isIntakePeriodFuture(student.intake_year, student.intake_term, activeAY?.year, activeTerm?.term_name)
        ? (activeAY?.year || student.intake_year)
        : student.intake_year,
      intake_term: isAdmit && isIntakePeriodFuture(student.intake_year, student.intake_term, activeAY?.year, activeTerm?.term_name)
        ? (activeTerm?.term_name || student.intake_term)
        : student.intake_term,
    };

    const updatedList = list.map((s) => (s.id === studentId ? updatedStudent : s));
    setStorage(KEYS.STUDENTS, updatedList);

    const userList = getStorage<User[]>(KEYS.USERS, []);
    const updatedUsers = userList.map((u) => {
      if (u.student_id === studentId && u.role === 'learner') {
        return { ...u, status: newAccountStatus };
      }
      return u;
    });
    setStorage(KEYS.USERS, updatedUsers);

    return updatedStudent;
  },
  admitLearner: async (studentId: string, reason?: string): Promise<Student> => {
    return api.setLearnerStatus(studentId, 'admit', reason || 'Learner admitted from Future Intake');
  },
  promoteStudents: async (
    studentIds: string[],
    targetGrade: GradeName,
    targetClassId?: string,
    promotedBy?: string,
    fromYear?: number,
    fromTerm?: TermName,
    toYear?: number,
    toTerm?: TermName
  ): Promise<Student[]> => {
    if (!studentIds || studentIds.length === 0) {
      return [];
    }

    const client = getSupabaseClient();
    const students = getStorage<Student[]>(KEYS.STUDENTS, []);
    const classes = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    const activeAY = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();
    const dateStr = new Date().toISOString().slice(0, 10);
    const targetLevel = getEducationLevelForGrade(targetGrade);

    const fYear = fromYear ?? (activeAY ? activeAY.year : 2026);
    const fTerm = fromTerm ?? (activeTerm ? activeTerm.term_name : 'Term 3');
    const tYear = toYear ?? (fYear + 1);
    const tTerm = toTerm ?? 'Term 1';

    // 1. Resolve target class and stream UUIDs
    let targetClassUuid: string | null = null;
    let targetStreamUuid: string | null = null;

    if (client) {
      if (targetClassId) {
        const resolved = await resolveStudentClassAndStreamUuids(targetClassId, client);
        targetClassUuid = resolved.class_id;
        targetStreamUuid = resolved.stream_id;
      } else {
        // Resolve for targetGrade generally
        const resolved = await resolveStudentClassAndStreamUuids(targetGrade, client);
        targetClassUuid = resolved.class_id;
        targetStreamUuid = resolved.stream_id;
      }
    }

    // 2. Prepare learner updates and perform authoritative Supabase persistence
    const targetStudents = students.filter((s) => studentIds.includes(s.id) || studentIds.includes(s.admission_number));
    if (targetStudents.length === 0) {
      return [];
    }

    // Compensation tracking in case of partial batch failure
    const updatedDbLearners: { id: string; admission_number?: string; prevClassId: string | null; prevStreamId: string | null }[] = [];
    const insertedPromotionIds: string[] = [];
    const generatedPromoRecords = new Map<string, LearnerPromotionRecord>();

    if (client) {
      for (const std of targetStudents) {
        // Resolve student-specific stream if keeping current stream
        let resolvedStudentClassUuid = targetClassUuid;
        let resolvedStudentStreamUuid = targetStreamUuid;

        const currentClass = classes.find((c) => c.stream_id === std.stream_id || c.id === std.class_id || c.id === std.stream_id);
        const fromGrade = (std.grade || currentClass?.class_name || 'Grade 7') as GradeName;

        let assignedClassId = targetClassId || targetClassUuid || std.class_id;
        let assignedStreamId = targetClassId || targetStreamUuid || std.stream_id;

        if (!targetClassId && std.stream_id) {
          const streamName = currentClass?.stream || 'A';
          const matchedTargetClass = classes.find(
            (c) => c.class_name === targetGrade && (c.stream || 'A').toLowerCase() === streamName.toLowerCase()
          );
          if (matchedTargetClass) {
            const res = await resolveStudentClassAndStreamUuids(matchedTargetClass.stream_id || matchedTargetClass.id || targetGrade, client);
            resolvedStudentClassUuid = res.class_id || targetClassUuid;
            resolvedStudentStreamUuid = res.stream_id || targetStreamUuid;
            assignedClassId = matchedTargetClass.id;
            assignedStreamId = matchedTargetClass.stream_id || matchedTargetClass.id;
          }
        } else if (targetClassId) {
          const matchedTarget = classes.find((c) => c.id === targetClassId || c.stream_id === targetClassId);
          if (matchedTarget) {
            assignedClassId = matchedTarget.id;
            assignedStreamId = matchedTarget.stream_id || matchedTarget.id;
          }
        }

        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (resolvedStudentClassUuid) updatePayload.class_id = resolvedStudentClassUuid;
        if (resolvedStudentStreamUuid) updatePayload.stream_id = resolvedStudentStreamUuid;

        let error: any = null;
        if (isUUID(std.id)) {
          const res = await client.from('students').update(updatePayload).eq('id', std.id);
          error = res.error;
        } else if (std.admission_number) {
          const res = await client.from('students').update(updatePayload).eq('admission_number', std.admission_number);
          error = res.error;
        } else {
          const res = await client.from('students').update(updatePayload).eq('id', std.id);
          error = res.error;
        }

        if (error) {
          console.error(`Supabase promoteStudents error for learner ${std.admission_number} (${std.id}):`, error);

          // Rollback previously modified learners in this batch to prevent partial state
          for (const rolledBack of updatedDbLearners) {
            try {
              const rbPayload: Record<string, any> = {
                class_id: rolledBack.prevClassId,
                stream_id: rolledBack.prevStreamId,
                updated_at: new Date().toISOString(),
              };
              if (isUUID(rolledBack.id)) {
                await client.from('students').update(rbPayload).eq('id', rolledBack.id);
              } else if (rolledBack.admission_number) {
                await client.from('students').update(rbPayload).eq('admission_number', rolledBack.admission_number);
              }
            } catch (rbErr) {
              console.warn('Compensation rollback error for students:', rbErr);
            }
          }

          if (insertedPromotionIds.length > 0) {
            try {
              await client.from('student_promotions').delete().in('id', insertedPromotionIds);
            } catch (promoRbErr) {
              console.warn('Compensation rollback error for student_promotions:', promoRbErr);
            }
          }

          let errorMsg = error.message || 'Database error occurred';
          if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied')) {
            errorMsg = 'Permission denied by database security policy. Please ensure you are logged in as an authorized administrator.';
          } else if (error.code === '23503') {
            errorMsg = 'Foreign key constraint violation: The target class or stream does not exist in the database.';
          } else if (error.code === '23502') {
            errorMsg = 'Required learner column missing in database update.';
          }

          const promoError = new Error(`Failed to persist learner promotion in database: ${errorMsg}`);
          (promoError as any).code = error.code;
          throw promoError;
        }

        updatedDbLearners.push({
          id: std.id,
          admission_number: std.admission_number,
          prevClassId: std.class_id || null,
          prevStreamId: std.stream_id || null,
        });

        // Insert structured promotion history record into public.student_promotions
        const promoRecordUuid = isUUID(std.id) ? generateUUID() : `prm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const promoDbPayload: Record<string, any> = {
          id: isUUID(promoRecordUuid) ? promoRecordUuid : generateUUID(),
          student_id: std.id,
          from_grade: fromGrade,
          to_grade: targetGrade,
          from_class_id: isUUID(std.class_id) ? std.class_id : null,
          to_class_id: isUUID(resolvedStudentClassUuid) ? resolvedStudentClassUuid : (isUUID(assignedClassId) ? assignedClassId : null),
          from_stream_id: isUUID(std.stream_id) ? std.stream_id : null,
          to_stream_id: isUUID(resolvedStudentStreamUuid) ? resolvedStudentStreamUuid : (isUUID(assignedStreamId) ? assignedStreamId : null),
          academic_year_id: activeAY && isUUID(activeAY.id) ? activeAY.id : null,
          from_year: fYear,
          from_term: fTerm,
          to_year: tYear,
          to_term: tTerm,
          date_promoted: new Date().toISOString(),
          promoted_by: promotedBy || 'Admin',
        };

        const promoInsertRes = await client.from('student_promotions').insert([promoDbPayload]);
        if (promoInsertRes.error && promoInsertRes.error.code !== '42P01' && promoInsertRes.error.code !== 'PGRST205') {
          console.error(`Supabase student_promotions insert error for learner ${std.admission_number}:`, promoInsertRes.error);

          // Rollback student update for this student and previous students
          for (const rolledBack of updatedDbLearners) {
            try {
              const rbPayload: Record<string, any> = {
                class_id: rolledBack.prevClassId,
                stream_id: rolledBack.prevStreamId,
                updated_at: new Date().toISOString(),
              };
              if (isUUID(rolledBack.id)) {
                await client.from('students').update(rbPayload).eq('id', rolledBack.id);
              } else if (rolledBack.admission_number) {
                await client.from('students').update(rbPayload).eq('admission_number', rolledBack.admission_number);
              }
            } catch (rbErr) {
              console.warn('Compensation rollback error for students:', rbErr);
            }
          }

          if (insertedPromotionIds.length > 0) {
            try {
              await client.from('student_promotions').delete().in('id', insertedPromotionIds);
            } catch (promoRbErr) {
              console.warn('Compensation rollback error for student_promotions:', promoRbErr);
            }
          }

          let errorMsg = promoInsertRes.error.message || 'Database error occurred inserting promotion history';
          if (promoInsertRes.error.code === '42501' || promoInsertRes.error.message?.toLowerCase().includes('permission denied')) {
            errorMsg = 'Permission denied by database security policy when recording promotion history.';
          }

          const promoError = new Error(`Failed to persist learner promotion history in database: ${errorMsg}`);
          (promoError as any).code = promoInsertRes.error.code;
          throw promoError;
        }

        insertedPromotionIds.push(promoDbPayload.id);

        const promoRecord: LearnerPromotionRecord = {
          id: promoDbPayload.id,
          student_id: std.id,
          from_grade: fromGrade,
          to_grade: targetGrade,
          from_class_id: std.class_id,
          to_class_id: assignedClassId,
          from_stream_id: std.stream_id,
          to_stream_id: assignedStreamId,
          academic_year_id: activeAY ? activeAY.id : undefined,
          date_promoted: promoDbPayload.date_promoted,
          promoted_by: promotedBy || 'Admin',
          from_year: fYear,
          from_term: fTerm,
          to_year: tYear,
          to_term: tTerm,
        };
        generatedPromoRecords.set(std.id, promoRecord);

        // Insert audit log
        try {
          await client.from('audit_logs').insert([{
            action: 'STUDENT_PROMOTED',
            details: `Promoted learner ${std.full_name} (${std.admission_number}) from ${fromGrade} (${fYear} ${fTerm}) to ${targetGrade} (${tYear} ${tTerm})`,
            user_id: promotedBy || 'Admin',
            created_at: new Date().toISOString(),
          }]);
        } catch (auditErr) {
          console.warn('Could not insert promotion audit log:', auditErr);
        }
      }
    }

    // 3. Update local storage cache only AFTER successful database persistence
    const targetStudentIdsSet = new Set(targetStudents.map((s) => s.id));
    const targetStudentAdmSet = new Set(targetStudents.map((s) => s.admission_number).filter(Boolean));

    const updatedStudents = students.map((std) => {
      if (!targetStudentIdsSet.has(std.id) && !targetStudentAdmSet.has(std.admission_number)) {
        return std;
      }

      const currentClass = classes.find((c) => c.stream_id === std.stream_id || c.id === std.class_id || c.id === std.stream_id);
      const fromGrade = (std.grade || currentClass?.class_name || 'Grade 7') as GradeName;

      let assignedClassId = targetClassId || targetClassUuid || std.class_id;
      let assignedStreamId = targetClassId || targetStreamUuid || std.stream_id;

      if (!targetClassId && std.stream_id) {
        const streamName = currentClass?.stream || 'A';
        const matchedTarget = classes.find(
          (c) => c.class_name === targetGrade && (c.stream || 'A').toLowerCase() === streamName.toLowerCase()
        );
        if (matchedTarget) {
          assignedClassId = matchedTarget.id;
          assignedStreamId = matchedTarget.stream_id || matchedTarget.id;
        }
      } else if (targetClassId) {
        const matchedTarget = classes.find((c) => c.id === targetClassId || c.stream_id === targetClassId);
        if (matchedTarget) {
          assignedClassId = matchedTarget.id;
          assignedStreamId = matchedTarget.stream_id || matchedTarget.id;
        }
      }

      const promoRecord: LearnerPromotionRecord = generatedPromoRecords.get(std.id) || {
        id: isUUID(std.id) ? generateUUID() : `prm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        student_id: std.id,
        from_grade: fromGrade,
        to_grade: targetGrade,
        from_class_id: std.class_id,
        to_class_id: assignedClassId,
        from_stream_id: std.stream_id,
        to_stream_id: assignedStreamId,
        academic_year_id: activeAY ? activeAY.id : undefined,
        date_promoted: dateStr,
        promoted_by: promotedBy || 'Admin',
        from_year: fYear,
        from_term: fTerm,
        to_year: tYear,
        to_term: tTerm,
      };

      const history = std.promotion_history || [];
      return {
        ...std,
        grade: targetGrade,
        education_level: targetLevel,
        class_id: assignedClassId,
        stream_id: assignedStreamId,
        promotion_history: [...history, promoRecord],
      };
    });

    setStorage(KEYS.STUDENTS, updatedStudents);
    return updatedStudents.filter((s) => targetStudentIdsSet.has(s.id) || targetStudentAdmSet.has(s.admission_number));
  },

  // --- EXAMINATIONS ---
  getExaminations: (): Examination[] => getStorage(KEYS.EXAMS, []),
  addExamination: async (ex: Examination): Promise<Examination> => {
    const client = createSupabaseClient();
    const examUuid = ex.id && (isUUID(ex.id) || !client) ? ex.id : generateUUID();

    // 1. Resolve academic_year_id to a valid UUID
    let ayId: string | null = isUUID(ex.academic_year_id) ? (ex.academic_year_id as string) : null;

    if (!ayId) {
      const years = api.getAcademicYears();
      const matchedYear = years.find((y) => y.year === ex.year || y.id === ex.academic_year_id);
      if (matchedYear && isUUID(matchedYear.id)) {
        ayId = matchedYear.id;
      }
    }

    if (!ayId && client) {
      try {
        const { data: dbYear } = await client
          .from('academic_years')
          .select('id')
          .eq('year', ex.year)
          .maybeSingle();
        if (dbYear && isUUID(dbYear.id)) {
          ayId = dbYear.id;
        }
      } catch (e) {
        // Fallback
      }
    }

    // 2. Resolve term_id to a valid UUID
    let termId: string | null = isUUID(ex.term_id) ? (ex.term_id as string) : null;

    if (!termId) {
      const terms = api.getSchoolTerms();
      const matchedTerm = terms.find((t) =>
        ((ayId && t.academic_year_id === ayId) || t.academic_year_id === ex.academic_year_id || t.year === ex.year) &&
        (t.term_name === ex.term || t.id === ex.term_id)
      );
      if (matchedTerm && isUUID(matchedTerm.id)) {
        termId = matchedTerm.id;
      }
    }

    if (!termId && client) {
      try {
        let query = client.from('school_terms').select('id');
        if (ayId) {
          query = query.eq('academic_year_id', ayId);
        } else {
          query = query.eq('year', ex.year);
        }
        query = query.eq('term_name', ex.term);
        const { data: dbTerm } = await query.maybeSingle();
        if (dbTerm && isUUID(dbTerm.id)) {
          termId = dbTerm.id;
        }
      } catch (e) {
        // Fallback
      }
    }

    // 3. Strict foreign-key validation: Never send non-UUID string or silent null when client is active
    if (client) {
      if (!ayId || !isUUID(ayId)) {
        throw new Error(`Failed to create examination in database: Unable to resolve authoritative relational UUID for Academic Year ${ex.year}`);
      }
      if (!termId || !isUUID(termId)) {
        throw new Error(`Failed to create examination in database: Unable to resolve authoritative relational UUID for School Term "${ex.term}" in Academic Year ${ex.year}`);
      }
    }

    const resolvedClassId = ex.class_id && ex.class_id !== 'all' ? ex.class_id : undefined;
    const resolvedEducationLevel: EducationLevel | undefined =
      ex.education_level && (ex.education_level as any) !== 'All Levels'
        ? (ex.education_level as EducationLevel)
        : undefined;

    const finalExam: Examination = {
      ...ex,
      id: examUuid,
      academic_year_id: ayId || ex.academic_year_id,
      term_id: termId || ex.term_id,
      education_level: resolvedEducationLevel,
      class_id: resolvedClassId,
      created_at: ex.created_at || new Date().toISOString(),
    };
    // Only update local storage AFTER Supabase insert succeeds (or if running in offline mode without client)
    if (client) {
      const payload: any = {
        id: finalExam.id,
        exam_name: finalExam.exam_name,
        term: finalExam.term,
        year: finalExam.year,
        academic_year_id: ayId,
        term_id: termId,
        class_id: resolvedClassId || null,
        ss_cre_structure: finalExam.ss_cre_structure || null,
        status: finalExam.status,
        exam_type: finalExam.exam_type === 'Opener' ? 'Custom' : finalExam.exam_type,
        max_marks: finalExam.max_marks,
        weightage: (finalExam as any).weightage || 100,
        approved_levels: finalExam.approved_levels || [],
        approved_classes: finalExam.approved_classes || [],
        education_level: resolvedEducationLevel || null,
        start_date: finalExam.start_date || null,
        end_date: finalExam.end_date || null,
      };

      let { data: insertedData, error } = await client.from('examinations').insert([payload]).select().maybeSingle();
      // Retry ONLY if columns do not exist in schema (PGRST204 / 42703 / "column ... does not exist").
      // NEVER catch foreign-key violations (e.g. 23503 / "foreign key constraint" / "examinations_class_id_fkey")
      const isMissingColumnError = (err: any) => {
        if (!err) return false;
        if (err.code === '42703' || err.code === 'PGRST204') return true;
        const msg = (err.message || '').toLowerCase();
        return (msg.includes('column') && msg.includes('does not exist')) || msg.includes('could not find the');
      };

      if (error && isMissingColumnError(error)) {
        delete payload.approved_levels;
        delete payload.approved_classes;
        delete payload.education_level;
        delete payload.class_id;
        const retryResult = await client.from('examinations').insert([payload]).select().maybeSingle();
        error = retryResult.error;
        insertedData = retryResult.data;
      }

      if (error) {
        console.error('Supabase error creating examination:', error);
        throw new Error(`Failed to create examination in database: ${error.message}`);
      }

      if (insertedData?.created_at) {
        finalExam.created_at = insertedData.created_at;
        finalExam.updated_at = insertedData.updated_at;
      }
    }

    const currentList = getStorage<Examination[]>(KEYS.EXAMS, []);
    const updated = [finalExam, ...currentList.filter((e) => e.id !== finalExam.id)];
    setStorage(KEYS.EXAMS, updated);

    return finalExam;
  },

  updateExamination: async (
    updatedExam: Examination,
    currentUser?: User | null
  ): Promise<Examination> => {
    if (!updatedExam || !updatedExam.id) {
      throw new Error('Invalid examination data: Missing examination ID.');
    }

    const list = getStorage<Examination[]>(KEYS.EXAMS, []);
    const targetExam = list.find((e) => e.id === updatedExam.id);

    if (!targetExam) {
      throw new Error('Examination record not found.');
    }

    // Role check: Only administrator can edit assessment setup
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can modify assessment setup.');
    }

    // Lock check: Approved assessments cannot be edited directly (must be reverted to Draft)
    if (targetExam.status === 'Approved') {
      throw new Error('Approved examinations are locked and cannot be edited. Re-open the examination to Draft if corrections are required.');
    }

    // Lock check: Archived assessments are historical
    if (targetExam.status === ('Archived' as any)) {
      throw new Error('Archived examinations cannot be modified because they are historical records.');
    }

    // Validate inputs
    const trimmedName = (updatedExam.exam_name || '').trim();
    if (!trimmedName) {
      throw new Error('Assessment title cannot be empty.');
    }

    const parsedMaxMarks = Number(updatedExam.max_marks);
    if (!Number.isFinite(parsedMaxMarks) || parsedMaxMarks <= 0) {
      throw new Error('Maximum score must be a positive number greater than zero.');
    }

    // Academic Term status verification
    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, []);
    const currentTerm = terms.find((t) => t.id === targetExam.term_id || (t.term_name === targetExam.term && t.year === targetExam.year));
    if (currentTerm && (currentTerm.status === 'Closed' || currentTerm.status === 'Archived')) {
      throw new Error(`Cannot modify assessment: The academic term "${currentTerm.term_name} ${currentTerm.year}" is ${currentTerm.status}.`);
    }

    const client = createSupabaseClient();

    // Canonical resolution of education_level:
    // "All Levels", null, empty string, or undefined (when explicitly provided) maps to undefined in Examination model and NULL in Supabase payload.
    // Specific EducationLevel is preserved.
    let resolvedEducationLevel: EducationLevel | undefined = targetExam.education_level;
    if ('education_level' in updatedExam) {
      if (!updatedExam.education_level || (updatedExam.education_level as any) === 'All Levels') {
        resolvedEducationLevel = undefined;
      } else {
        resolvedEducationLevel = updatedExam.education_level as EducationLevel;
      }
    }

    // Canonical resolution of class_id:
    // 'all', null, empty string, or undefined (when explicitly provided) maps to undefined in Examination model and NULL in Supabase payload.
    // Specific class_id UUID is preserved.
    let resolvedClassId: string | undefined = targetExam.class_id;
    if ('class_id' in updatedExam) {
      if (!updatedExam.class_id || updatedExam.class_id === 'all') {
        resolvedClassId = undefined;
      } else {
        resolvedClassId = updatedExam.class_id;
      }
    }

    const updatedExamRecord: Examination = {
      ...targetExam,
      exam_name: trimmedName,
      exam_type: updatedExam.exam_type || targetExam.exam_type,
      max_marks: parsedMaxMarks,
      start_date: updatedExam.start_date !== undefined ? updatedExam.start_date : targetExam.start_date,
      end_date: updatedExam.end_date !== undefined ? updatedExam.end_date : targetExam.end_date,
      education_level: resolvedEducationLevel,
      class_id: resolvedClassId,
      ss_cre_structure: updatedExam.ss_cre_structure,
      updated_at: new Date().toISOString(),
    };

    if (client && isUUID(updatedExam.id)) {
      const payload: any = {
        exam_name: updatedExamRecord.exam_name,
        exam_type: updatedExamRecord.exam_type === 'Opener' ? 'Custom' : updatedExamRecord.exam_type,
        max_marks: updatedExamRecord.max_marks,
        start_date: updatedExamRecord.start_date || null,
        end_date: updatedExamRecord.end_date || null,
        education_level: resolvedEducationLevel || null,
        class_id: resolvedClassId || null,
        ss_cre_structure: updatedExamRecord.ss_cre_structure || null,
        updated_at: updatedExamRecord.updated_at,
      };

      let { data: returnedData, error } = await client
        .from('examinations')
        .update(payload)
        .eq('id', updatedExam.id)
        .select()
        .maybeSingle();

      // Retry ONLY if columns do not exist in schema (PGRST204 / 42703 / "column ... does not exist").
      // NEVER catch foreign-key violations (e.g. 23503 / "foreign key constraint" / "examinations_class_id_fkey")
      const isMissingColumnError = (err: any) => {
        if (!err) return false;
        if (err.code === '42703' || err.code === 'PGRST204') return true;
        const msg = (err.message || '').toLowerCase();
        return (msg.includes('column') && msg.includes('does not exist')) || msg.includes('could not find the');
      };

      if (error && isMissingColumnError(error)) {
        delete payload.education_level;
        delete payload.class_id;
        const retry = await client
          .from('examinations')
          .update(payload)
          .eq('id', updatedExam.id)
          .select()
          .maybeSingle();
        error = retry.error;
        returnedData = retry.data;
      }

      if (error) {
        console.error('Supabase error updating examination:', error);
        throw new Error(`Database error updating examination: ${error.message}`);
      }

      if (returnedData?.updated_at) {
        updatedExamRecord.updated_at = returnedData.updated_at;
      }
    }

    // Authoritative update of local cache upon Supabase success
    const currentList = getStorage<Examination[]>(KEYS.EXAMS, []);
    const syncedList = currentList.map((e) =>
      e.id === updatedExamRecord.id ? updatedExamRecord : e
    );
    setStorage(KEYS.EXAMS, syncedList);

    return updatedExamRecord;
  },

  updateExaminationLevelApproval: async (
    examId: string,
    level: EducationLevel,
    approved: boolean,
    currentUser?: User | null
  ): Promise<Examination> => {
    const list = getStorage<Examination[]>(KEYS.EXAMS, []);
    const targetExam = list.find((ex) => ex.id === examId);

    if (!targetExam) {
      throw new Error('Examination record not found.');
    }

    if (currentUser?.role !== 'admin') {
      throw new Error('UNAUTHORIZED: Only an Administrator can approve or reopen an assessment level.');
    }

    const currentApprovedLevels: EducationLevel[] = [...(targetExam.approved_levels || [])];
    let newApprovedLevels: EducationLevel[];

    if (approved) {
      if (!currentApprovedLevels.includes(level)) {
        newApprovedLevels = [...currentApprovedLevels, level];
      } else {
        newApprovedLevels = currentApprovedLevels;
      }
    } else {
      newApprovedLevels = currentApprovedLevels.filter((l) => l !== level);
    }

    // Dynamic resolution of all streams belonging to this education level
    const allClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []).filter(
      (c) => c && c.status !== 'Inactive' && !String(c.id).startsWith('cls_test_') && !String(c.stream_id).startsWith('st_test_')
    );

    const levelStreams = allClasses.filter((c) => {
      const cLevel = c.education_level || (c.class_name ? getEducationLevelForGrade(c.class_name) : undefined);
      return cLevel === level;
    });

    const levelStreamIds = levelStreams
      .map((st) => st.stream_id || st.id)
      .filter(Boolean) as string[];

    const currentApprovedClasses = targetExam.approved_classes || [];
    let newApprovedClasses: string[] = [];

    if (approved) {
      // Add all constituent stream IDs of this level into approved_classes
      const set = new Set([...currentApprovedClasses, ...levelStreamIds]);
      newApprovedClasses = Array.from(set);
    } else {
      // Remove only constituent stream IDs of this level from approved_classes
      const removeSet = new Set(levelStreamIds);
      newApprovedClasses = currentApprovedClasses.filter((id) => !removeSet.has(id));
    }

    // Determine aggregate exam status: check if all in-scope streams for targetExam are approved
    const inScopeStreams = allClasses.filter((st) => isClassInExamScope(st, targetExam));
    const isAllScopeStreamsApproved =
      inScopeStreams.length > 0 &&
      inScopeStreams.every((st) => {
        const sId = st.stream_id || st.id;
        return newApprovedClasses.includes(sId);
      });

    let newStatus = targetExam.status;
    if (isAllScopeStreamsApproved) {
      newStatus = 'Approved';
    } else if (!approved && targetExam.status === 'Approved') {
      newStatus = newApprovedClasses.length > 0 ? 'Provisional' : 'Draft';
    } else if (newApprovedLevels.length > 0 && targetExam.status === 'Draft') {
      newStatus = 'Provisional';
    } else if (newApprovedLevels.length === 0 && newApprovedClasses.length === 0 && targetExam.status === 'Provisional') {
      newStatus = 'Draft';
    }

    const client = createSupabaseClient();
    if (client && isUUID(examId)) {
      const { error } = await client
        .from('examinations')
        .update({
          status: newStatus,
          approved_levels: newApprovedLevels,
          approved_classes: newApprovedClasses,
          updated_at: new Date().toISOString(),
        })
        .eq('id', examId);

      if (error) {
        if (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('approved_levels') || error.message?.includes('approved_classes') || error.message?.includes('does not exist')) {
          console.info('Info: Column "approved_levels" or "approved_classes" updating via fallback.');
          const { error: fallbackError } = await client
            .from('examinations')
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', examId);

          if (fallbackError) {
            console.error('Supabase fallback update level approval error:', fallbackError);
            throw new Error(`Failed to update examination level approval in database: ${fallbackError.message}`);
          }
        } else {
          console.error('Supabase update level approval error:', error);
          throw new Error(`Failed to update examination level approval in database: ${error.message}`);
        }
      }
    }

    let updatedExam: Examination | null = null;
    const updated = list.map((ex) => {
      if (ex.id === examId) {
        updatedExam = {
          ...ex,
          status: newStatus,
          approved_levels: newApprovedLevels,
          approved_classes: newApprovedClasses,
        };
        return updatedExam;
      }
      return ex;
    });
    setStorage(KEYS.EXAMS, updated);

    // Write Audit Log Record
    try {
      const now = new Date();
      const adminName = currentUser?.name || (currentUser as any)?.full_name || currentUser?.username || 'Administrator';
      const actionType = approved
        ? `APPROVED & LOCKED LEVEL [${level}]`
        : `REOPENED LEVEL [${level}] FOR MARKS ENTRY`;

      const auditLog: LoginLog = {
        id: `log_exam_level_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: currentUser?.id || 'admin',
        email: currentUser?.email || 'admin@school.ac.ke',
        user_name: adminName,
        role: currentUser?.role || 'admin',
        timestamp: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 8),
        ip_address: '127.0.0.1 (Internal System)',
        device: 'Web Client',
        browser: 'Secure Management Console',
        status: 'Success',
        reason: `${actionType}: "${targetExam.exam_name}" | Approved Levels: ${newApprovedLevels.join(', ') || 'None'} | Performed By: ${adminName}`,
      };

      const currentLogs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
      setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);
    } catch (e) {
      // ignore
    }

    return updatedExam || targetExam;
  },

  updateExaminationClassApproval: async (
    examId: string,
    classStreamId: string,
    approved: boolean,
    currentUser?: User | null
  ): Promise<Examination> => {
    const list = getStorage<Examination[]>(KEYS.EXAMS, []);
    const targetExam = list.find((ex) => ex.id === examId);

    if (!targetExam) {
      throw new Error('Examination record not found.');
    }

    const allClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []).filter(
      (c) => c && c.status !== 'Inactive' && !String(c.id).startsWith('cls_test_') && !String(c.stream_id).startsWith('st_test_')
    );
    const targetClass = allClasses.find(
      (c) => c.stream_id === classStreamId || c.id === classStreamId || c.class_name === classStreamId
    );

    // Authority rule: stream_id (from public.streams) is the authoritative stream UUID.
    // Use targetClass.stream_id if present, otherwise fallback to classStreamId / targetClass.id.
    const streamIdentifier = targetClass?.stream_id || targetClass?.id || classStreamId;
    const streamName = targetClass ? `${targetClass.class_name} ${targetClass.stream}` : streamIdentifier;

    // RBAC & Permission Enforcement
    if (currentUser) {
      const isUserAdmin = currentUser.role === 'admin';

      if (!isUserAdmin) {
        // Verify Class Teacher assignment
        const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
        const activeTeacher = teachers.find(
          (t) =>
            (currentUser.teacher_id && t.id === currentUser.teacher_id) ||
            (currentUser.email && t.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (t.user_id && t.user_id === currentUser.id)
        );

        if (!activeTeacher) {
          throw new Error('UNAUTHORIZED: Only Administrators and designated Class Teachers can approve examination results.');
        }

        const ownsStream = Boolean(
          targetClass && (
            targetClass.class_teacher_id === activeTeacher.id ||
            (activeTeacher.user_id && targetClass.class_teacher_id === activeTeacher.user_id) ||
            (activeTeacher.tsc_number && targetClass.class_teacher_id === activeTeacher.tsc_number) ||
            activeTeacher.class_teacher_of_id === targetClass.stream_id ||
            activeTeacher.class_teacher_of_id === targetClass.id ||
            isClassTeacherFor(activeTeacher, streamIdentifier, allClasses)
          )
        );

        if (!ownsStream) {
          throw new Error(`UNAUTHORIZED: You are only permitted to approve results for your assigned class stream (${streamName}).`);
        }

        // Only Admin can reopen if exam is already globally locked
        if (!approved) {
          if (targetExam.status === 'Approved') {
            throw new Error('UNAUTHORIZED: Reopening a globally locked examination requires Administrator authorization.');
          }
        }
      }
    }

    // Calculate updated approved_classes array containing ONLY authoritative stream UUIDs
    const currentApprovedClasses = targetExam.approved_classes || [];
    let newApprovedClasses: string[] = [];

    if (approved) {
      // Add ONLY the single authoritative stream UUID
      const set = new Set([...currentApprovedClasses, streamIdentifier]);
      newApprovedClasses = Array.from(set);
    } else {
      // Remove the stream UUID
      newApprovedClasses = currentApprovedClasses.filter(
        (id) => id !== streamIdentifier && id !== targetClass?.stream_id && id !== targetClass?.id
      );
    }

    // Hierarchical Roll-Up Calculation:
    // 1. Grade Roll-Up & 2. Education Level Roll-Up
    const currentApprovedLevels = targetExam.approved_levels || [];
    let newApprovedLevels = [...currentApprovedLevels];

    const allCbeLevels: EducationLevel[] = ['Pre-Primary', 'Lower Primary', 'Upper Primary', 'Junior School'];

    // For each education level, check if all active streams in that level are approved in newApprovedClasses
    allCbeLevels.forEach((lvl) => {
      const levelStreams = allClasses.filter((c) => {
        const cLevel = c.education_level || (c.class_name ? getEducationLevelForGrade(c.class_name) : undefined);
        return cLevel === lvl;
      });

      if (levelStreams.length > 0) {
        const allLevelStreamsApproved = levelStreams.every((st) => {
          const sId = st.stream_id || st.id;
          return newApprovedClasses.includes(sId);
        });

        if (allLevelStreamsApproved) {
          if (!newApprovedLevels.includes(lvl)) {
            newApprovedLevels.push(lvl);
          }
        } else {
          // If constituent stream was reopened, roll-up level approval drops
          newApprovedLevels = newApprovedLevels.filter((l) => l !== lvl);
        }
      }
    });

    // 3. Examination Status Roll-Up
    const inScopeStreams = allClasses.filter((st) => isClassInExamScope(st, targetExam));
    const isAllScopeStreamsApproved =
      inScopeStreams.length > 0 &&
      inScopeStreams.every((st) => {
        const sId = st.stream_id || st.id;
        return newApprovedClasses.includes(sId);
      });

    let newStatus = targetExam.status;
    if (isAllScopeStreamsApproved) {
      newStatus = 'Approved';
    } else if (!approved && targetExam.status === 'Approved') {
      newStatus = 'Provisional';
    } else if (newApprovedClasses.length > 0 && targetExam.status === 'Draft') {
      newStatus = 'Provisional';
    } else if (newApprovedClasses.length === 0 && newApprovedLevels.length === 0 && targetExam.status === 'Provisional') {
      newStatus = 'Draft';
    }

    const client = createSupabaseClient();
    if (client && isUUID(examId)) {
      const { error } = await client
        .from('examinations')
        .update({
          status: newStatus,
          approved_levels: newApprovedLevels,
          approved_classes: newApprovedClasses,
          updated_at: new Date().toISOString(),
        })
        .eq('id', examId);

      if (error) {
        if (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('approved_classes') || error.message?.includes('approved_levels') || error.message?.includes('does not exist')) {
          console.info('Info: Column "approved_classes" or "approved_levels" updating via fallback.');
          const { error: fallbackError } = await client
            .from('examinations')
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', examId);

          if (fallbackError) {
            console.error('Supabase fallback update class approval error:', fallbackError);
            throw new Error(`Failed to update examination class approval in database: ${fallbackError.message}`);
          }
        } else {
          console.error('Supabase update class approval error:', error);
          throw new Error(`Failed to update examination class approval in database: ${error.message}`);
        }
      }
    }

    let updatedExam: Examination | null = null;
    const updated = list.map((ex) => {
      if (ex.id === examId) {
        updatedExam = {
          ...ex,
          status: newStatus,
          approved_levels: newApprovedLevels,
          approved_classes: newApprovedClasses,
        };
        return updatedExam;
      }
      return ex;
    });
    setStorage(KEYS.EXAMS, updated);

    // Audit Log Record
    try {
      const now = new Date();
      const userName = currentUser?.name || (currentUser as any)?.full_name || currentUser?.username || 'Class Teacher';
      const roleLabel = currentUser?.role === 'admin' ? 'Administrator' : 'Class Teacher';
      const actionType = approved
        ? `APPROVED & LOCKED CLASS STREAM [${streamName}]`
        : `REOPENED CLASS STREAM [${streamName}] FOR MARKS ENTRY`;

      const auditLog: LoginLog = {
        id: `log_exam_class_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: currentUser?.id || 'teacher',
        email: currentUser?.email || 'teacher@school.ac.ke',
        user_name: userName,
        role: currentUser?.role || 'class_teacher',
        timestamp: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 8),
        ip_address: '127.0.0.1 (Internal System)',
        device: 'Web Client',
        browser: 'Secure Management Console',
        status: 'Success',
        reason: `${actionType}: "${targetExam.exam_name}" | Approved Streams: ${newApprovedClasses.length} | Performed By: ${userName} (${roleLabel})`,
      };

      const currentLogs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
      setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);
    } catch (e) {
      // ignore
    }

    return updatedExam || targetExam;
  },

  updateExaminationStatus: async (
    examId: string,
    status: Examination['status'],
    currentUser?: User | null
  ): Promise<Examination> => {
    const list = getStorage<Examination[]>(KEYS.EXAMS, []);
    let targetExam = list.find((ex) => ex.id === examId);

    const client = createSupabaseClient();
    if (!targetExam && client && isUUID(examId)) {
      const { data } = await client.from('examinations').select('*').eq('id', examId).maybeSingle();
      if (data) {
        targetExam = {
          id: data.id,
          exam_name: data.exam_name,
          term: data.term,
          year: data.year,
          status: data.status,
          exam_type: data.exam_type,
          max_marks: data.max_marks,
          start_date: data.start_date,
          end_date: data.end_date,
          approved_levels: data.approved_levels || [],
          approved_classes: data.approved_classes || [],
          ss_cre_structure: data.ss_cre_structure || undefined,
        };
      }
    }

    if (!targetExam) {
      throw new Error('Examination record not found.');
    }

    // SECURITY ENFORCEMENT: Reopening an approved examination requires Administrator role
    if (targetExam.status === 'Approved' && status !== 'Approved') {
      const actualRole = currentUser?.role;
      if (actualRole !== 'admin') {
        throw new Error('UNAUTHORIZED: Only an Administrator can reopen an approved examination.');
      }
    }

    if (client && isUUID(examId)) {
      const updatePayload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'Draft') {
        updatePayload.approved_classes = [];
        updatePayload.approved_levels = [];
      }
      const { error } = await client
        .from('examinations')
        .update(updatePayload)
        .eq('id', examId);

      if (error) {
        console.error('Supabase updateExaminationStatus error:', error);
        throw new Error(`Failed to update examination status in database: ${error.message}`);
      }
    }

    let updatedExam: Examination | null = null;
    const updated = list.map((ex) => {
      if (ex.id === examId) {
        updatedExam = {
          ...ex,
          status,
          ...(status === 'Draft' ? { approved_classes: [], approved_levels: [] } : {}),
        };
        return updatedExam;
      }
      return ex;
    });

    if (!updatedExam) {
      updatedExam = {
        ...targetExam,
        status,
        ...(status === 'Draft' ? { approved_classes: [], approved_levels: [] } : {}),
      };
      setStorage(KEYS.EXAMS, [...list, updatedExam]);
    } else {
      setStorage(KEYS.EXAMS, updated);
    }

    // Write Audit Log Record for Approval / Reopening
    try {
      if (targetExam.status !== status && (status === 'Approved' || targetExam.status === 'Approved')) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 8);
        const adminName = currentUser?.name || (currentUser as any)?.full_name || currentUser?.username || 'Administrator';
        const actionType = status === 'Approved' ? 'APPROVED & LOCKED EXAMINATION' : 'REOPENED EXAMINATION FOR MARKS ENTRY';

        const auditLog: LoginLog = {
          id: `log_exam_${status.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: currentUser?.id || 'admin',
          email: currentUser?.email || 'admin@school.ac.ke',
          user_name: adminName,
          role: currentUser?.role || 'admin',
          timestamp: now.toISOString(),
          date: dateStr,
          time: timeStr,
          ip_address: '127.0.0.1 (Internal System)',
          device: 'Web Client',
          browser: 'Secure Management Console',
          status: 'Success',
          reason: `${actionType}: "${targetExam.exam_name}" (ID: ${examId}) | Status transitioned from ${targetExam.status} to ${status} | Performed By: ${adminName} (${currentUser?.role || 'admin'})`,
        };

        const currentLogs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
        setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);
      }
    } catch (e) {
      // ignore
    }

    return updatedExam || targetExam;
  },

  deleteExamination: async (
    examId: string,
    currentUser?: User | null
  ): Promise<{
    success: boolean;
    examName: string;
    deletedMarksCount: number;
    affectedStudentsCount: number;
    message: string;
  }> => {
    const exams = getStorage<Examination[]>(KEYS.EXAMS, []);
    const targetExam = exams.find((e) => e.id === examId);

    if (!targetExam) {
      throw new Error('Examination record not found.');
    }

    if (targetExam.status === 'Approved') {
      throw new Error(
        'Approved examinations are locked and cannot be deleted. Re-open the examination to Draft if corrections are required.'
      );
    }

    if (targetExam.status === ('Archived' as any)) {
      throw new Error(
        'Archived examinations cannot be deleted because they are historical records.'
      );
    }

    const client = createSupabaseClient();

    // Check for dependent marks/results records (Rules 3, 4, 5)
    const localMarks = getStorage<Mark[]>(KEYS.MARKS, []);
    const dependentLocalMarks = localMarks.filter((m) => m.exam_id === examId);

    let dbMarksCount = 0;
    if (client && isUUID(examId)) {
      const { count, error: mCountErr } = await client
        .from('marks')
        .select('id', { count: 'exact', head: true })
        .eq('exam_id', examId);

      if (!mCountErr && typeof count === 'number') {
        dbMarksCount = count;
      }
    }

    if (dependentLocalMarks.length > 0 || dbMarksCount > 0) {
      const markCount = Math.max(dependentLocalMarks.length, dbMarksCount);
      throw new Error(
        `Cannot delete examination "${targetExam.exam_name}": This assessment has ${markCount} associated mark record(s). Deletion blocked to preserve student marks and results.`
      );
    }

    // Perform database level deletion targeting exact UUID
    if (client && isUUID(examId)) {
      const { error: eErr } = await client.from('examinations').delete().eq('id', examId);
      if (eErr && eErr.code !== '42P01') {
        console.error('Database error deleting examination:', eErr);
        throw new Error(`Database error deleting examination: ${eErr.message}`);
      }
    }

    // After successful deletion from Supabase, remove the examination from application state
    const remainingExams = exams.filter((e) => e.id !== examId);
    setStorage(KEYS.EXAMS, remainingExams);

    const verifications = getStorage<VerificationLog[]>(KEYS.VERIFICATIONS, []);
    const remainingVerifications = verifications.filter((v) => v.exam_id !== examId);
    setStorage(KEYS.VERIFICATIONS, remainingVerifications);

    // Clean report comments if present
    try {
      const commentsKey = 'cbe_report_comments';
      const comments = getStorage<LearnerReportComment[]>(commentsKey, []);
      if (comments && comments.length > 0) {
        const remainingComments = comments.filter((c) => c.exam_id !== examId);
        setStorage(commentsKey, remainingComments);
      }
    } catch (e) {
      // ignore
    }

    // Write Audit Log Record
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8);
      const adminName = currentUser?.name || (currentUser as any)?.full_name || currentUser?.username || 'Administrator';

      const auditLog: LoginLog = {
        id: `log_exam_del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: currentUser?.id || 'admin',
        email: currentUser?.email || 'admin@school.ac.ke',
        user_name: adminName,
        role: currentUser?.role || 'admin',
        timestamp: now.toISOString(),
        date: dateStr,
        time: timeStr,
        ip_address: '127.0.0.1 (Internal System)',
        device: 'Web Client',
        browser: 'Secure Management Console',
        status: 'Success',
        reason: `DELETED ASSESSMENT: "${targetExam.exam_name}" (ID: ${examId}) | Performed By: ${adminName}`,
      };

      const currentLogs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
      setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      examName: targetExam.exam_name,
      deletedMarksCount: 0,
      affectedStudentsCount: 0,
      message: `Examination "${targetExam.exam_name}" was successfully deleted.`,
    };
  },

  // --- MARKS ---
  mapDatabaseMarks: (markData: any[]): Mark[] => {
    if (!Array.isArray(markData)) return [];
    return markData.map((m: any) => {
      let rawScore = m.raw_score;
      let outOf = m.out_of;
      let specialStatus = m.special_status;
      let irregularityReason = m.irregularity_reason;
      let resolution = m.resolution;

      if (m.remarks && typeof m.remarks === 'string' && m.remarks.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(m.remarks);
          if (rawScore === undefined) rawScore = parsed.raw_score;
          if (outOf === undefined) outOf = parsed.out_of;
          if (specialStatus === undefined) specialStatus = parsed.special_status;
          if (irregularityReason === undefined) irregularityReason = parsed.irregularity_reason;
          if (resolution === undefined) resolution = parsed.resolution;
        } catch (e) {
          // ignore
        }
      }

      return {
        id: m.id,
        student_id: m.student_id,
        subject_id: m.subject_id,
        exam_id: m.exam_id,
        marks: typeof m.marks === 'number' ? m.marks : (typeof rawScore === 'number' ? rawScore : 0),
        raw_score: rawScore !== undefined ? rawScore : (typeof m.marks === 'number' ? m.marks : null),
        out_of: typeof outOf === 'number' ? outOf : 100,
        special_status: specialStatus || 'Normal',
        irregularity_reason: irregularityReason || undefined,
        resolution: resolution || undefined,
        entered_by_teacher_id: m.entered_by_teacher_id || undefined,
        updated_at: m.updated_at || undefined,
      };
    });
  },

  fetchMarksForExam: async (
    examId: string,
    options?: {
      classId?: string;
      streamId?: string;
      subjectId?: string;
      studentId?: string;
      studentIds?: string[];
    }
  ): Promise<Mark[]> => {
    if (!examId) return getStorage<Mark[]>(KEYS.MARKS, []);
    const client = createSupabaseClient();
    if (!client) return getStorage<Mark[]>(KEYS.MARKS, []);

    const exams = getStorage<Examination[]>(KEYS.EXAMS, []);
    const targetExam = exams.find((e) => e.id === examId || (e as any).exam_code === examId || (e as any).exam_name === examId);
    const examUuid = targetExam && isUUID(targetExam.id) ? targetExam.id : (isUUID(examId) ? examId : null);

    const validExamUuids = examUuid
      ? [examUuid]
      : (Array.from(new Set([examId, targetExam?.id].filter(Boolean))) as string[]).filter(isUUID);

    if (validExamUuids.length === 0) {
      console.warn('fetchMarksForExam: No valid exam UUID found for:', examId);
      return getStorage<Mark[]>(KEYS.MARKS, []);
    }

    let query = client.from('marks').select('*');
    if (validExamUuids.length === 1) {
      query = query.eq('exam_id', validExamUuids[0]);
    } else {
      query = query.in('exam_id', validExamUuids);
    }

    const currentUser = api.getCurrentUser();
    const students = getStorage<Student[]>(KEYS.STUDENTS, []);
    const classes = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    const activeTeacher = getActiveTeacher(currentUser, teachers);

    // Filter by student(s) / class / stream
    let targetStudentIds: string[] | null = null;

    if (options?.studentIds && options.studentIds.length > 0) {
      targetStudentIds = options.studentIds.filter(isUUID);
    } else if (options?.studentId) {
      const match = students.find((s) => (isUUID(options.studentId) ? s.id === options.studentId : (s.id === options.studentId || s.admission_number === options.studentId)));
      const sUuid = match && isUUID(match.id) ? match.id : (isUUID(options.studentId) ? options.studentId : null);
      targetStudentIds = sUuid ? [sUuid] : (isUUID(options.studentId) ? [options.studentId] : null);
    } else if (currentUser && currentUser.role === 'learner') {
      const stdId = currentUser.student_id;
      const match = students.find((s) => (isUUID(stdId) ? s.id === stdId : (s.id === stdId || s.admission_number === stdId)));
      const sUuid = match && isUUID(match.id) ? match.id : (isUUID(stdId) ? stdId : null);
      targetStudentIds = sUuid ? [sUuid] : (isUUID(stdId) ? [stdId] : null);
    } else if (options?.classId || options?.streamId) {
      const clsId = options.classId || 'all';
      const strmId = options.streamId || 'all';
      const filtered = getFilteredStudents(students, classes, clsId, strmId, targetExam);
      targetStudentIds = filtered.map((s) => s.id).filter(isUUID);
    } else if (currentUser && (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher' || (currentUser.role as string) === 'teacher')) {
      const accStudents = getAccessibleStudents(currentUser, activeTeacher, students, classes);
      targetStudentIds = accStudents.map((s) => s.id).filter(isUUID);
    }

    if (targetStudentIds !== null) {
      if (targetStudentIds.length === 1) {
        query = query.eq('student_id', targetStudentIds[0]);
      } else if (targetStudentIds.length > 1) {
        query = query.in('student_id', targetStudentIds);
      } else {
        query = query.in('student_id', ['00000000-0000-0000-0000-000000000000']);
      }
    }

    // Filter by subject
    let targetSubjectIds: string[] | null = null;

    if (options?.subjectId) {
      const subjects = getStorage<Subject[]>(KEYS.SUBJECTS, []);
      const matchSub = subjects.find((s) => s.id === options.subjectId || s.subject_code === options.subjectId);
      const subUuid = matchSub && isUUID(matchSub.id) ? matchSub.id : (isUUID(options.subjectId) ? options.subjectId : null);
      if (subUuid) {
        targetSubjectIds = [subUuid];
        query = query.eq('subject_id', subUuid);
      } else {
        console.warn('fetchMarksForExam: Subject identifier is not a valid UUID:', options.subjectId);
      }
    } else if (currentUser && currentUser.role === 'subject_teacher') {
      const subjects = getStorage<Subject[]>(KEYS.SUBJECTS, []);
      const accSubjects = getAccessibleSubjects(currentUser, activeTeacher, subjects, options?.classId, classes);
      const accSubjIds = accSubjects.map((s) => s.id).filter(isUUID);
      if (accSubjIds.length > 0) {
        targetSubjectIds = accSubjIds;
        if (accSubjIds.length === 1) {
          query = query.eq('subject_id', accSubjIds[0]);
        } else {
          query = query.in('subject_id', accSubjIds);
        }
      } else {
        targetSubjectIds = ['00000000-0000-0000-0000-000000000000'];
        query = query.eq('subject_id', '00000000-0000-0000-0000-000000000000');
      }
    }

    try {
      const { data: markData, error: markError } = await query;

      if (markError) {
        console.error('Supabase query error in fetchMarksForExam:', markError);
        throw markError;
      }

      if (markData) {
        const mappedMarks = api.mapDatabaseMarks(markData);
        const currentMarks = getStorage<Mark[]>(KEYS.MARKS, []);

        // Filter out cached marks belonging to the exact scope queried
        const preservedMarks = currentMarks.filter((m) => {
          const matchExam = validExamUuids.includes(m.exam_id);
          if (!matchExam) return true;

          if (targetStudentIds !== null) {
            const matchStudent = targetStudentIds.includes(m.student_id);
            if (!matchStudent) return true;
          }

          if (targetSubjectIds !== null) {
            const matchSubject = targetSubjectIds.includes(m.subject_id);
            if (!matchSubject) return true;
          }

          return false;
        });

        const markMap = new Map<string, Mark>();
        preservedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        mappedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));

        const combinedMarks = Array.from(markMap.values());
        setStorage(KEYS.MARKS, combinedMarks);
        return combinedMarks;
      }
    } catch (err) {
      console.error('Error fetching marks for exam from Supabase:', err);
    }

    return getStorage<Mark[]>(KEYS.MARKS, []);
  },

  fetchMarksForLearner: async (
    studentId: string,
    options?: {
      examId?: string;
      subjectId?: string;
    }
  ): Promise<Mark[]> => {
    if (!studentId) return getStorage<Mark[]>(KEYS.MARKS, []);
    const client = createSupabaseClient();
    if (!client) return getStorage<Mark[]>(KEYS.MARKS, []);

    const students = getStorage<Student[]>(KEYS.STUDENTS, []);
    const matchStd = students.find((s) => (isUUID(studentId) ? s.id === studentId : (s.id === studentId || s.admission_number === studentId)));
    const studentUuid = matchStd && isUUID(matchStd.id) ? matchStd.id : (isUUID(studentId) ? studentId : null);

    // Collect all valid aliases (UUID and admission number) to ensure complete query coverage
    const validStudentUuids = Array.from(
      new Set(
        [
          studentUuid,
          matchStd?.id,
          matchStd?.admission_number,
          studentId
        ].filter(Boolean) as string[]
      )
    );

    const matchesLearner = (mStdId: string | undefined | null) => {
      if (!mStdId) return false;
      const str = String(mStdId).trim().toLowerCase();
      return validStudentUuids.some((vid) => String(vid).trim().toLowerCase() === str);
    };

    if (validStudentUuids.length === 0) {
      console.warn('fetchMarksForLearner: No valid student identifier found for:', studentId);
      return getStorage<Mark[]>(KEYS.MARKS, []).filter((m) => m.student_id === studentId);
    }

    const queryStudentUuids = validStudentUuids.filter(isUUID);

    let query = client.from('marks').select('*');
    if (queryStudentUuids.length === 1) {
      query = query.eq('student_id', queryStudentUuids[0]);
    } else if (queryStudentUuids.length > 1) {
      query = query.in('student_id', queryStudentUuids);
    } else {
      query = query.in('student_id', ['00000000-0000-0000-0000-000000000000']);
    }

    let targetExamUuid: string | null = null;
    let validExamUuids: string[] | null = null;
    if (options?.examId) {
      const exams = getStorage<Examination[]>(KEYS.EXAMS, []);
      const matchEx = exams.find((e) => e.id === options.examId || (e as any).exam_code === options.examId || (e as any).exam_name === options.examId);
      const exUuid = matchEx && isUUID(matchEx.id) ? matchEx.id : (isUUID(options.examId) ? options.examId : null);

      if (exUuid) {
        targetExamUuid = exUuid;
        validExamUuids = [exUuid];
        query = query.eq('exam_id', exUuid);
      } else {
        console.warn('fetchMarksForLearner: Exam identifier is not a valid UUID:', options.examId);
      }
    }

    let targetSubjectUuid: string | null = null;
    let validSubjectUuids: string[] | null = null;
    if (options?.subjectId) {
      const subjects = getStorage<Subject[]>(KEYS.SUBJECTS, []);
      const matchSub = subjects.find((s) => s.id === options.subjectId || s.subject_code === options.subjectId);
      const subUuid = matchSub && isUUID(matchSub.id) ? matchSub.id : (isUUID(options.subjectId) ? options.subjectId : null);

      if (subUuid) {
        targetSubjectUuid = subUuid;
        validSubjectUuids = [subUuid];
        query = query.eq('subject_id', subUuid);
      } else {
        console.warn('fetchMarksForLearner: Subject identifier is not a valid UUID:', options.subjectId);
      }
    } else {
      const currentUser = api.getCurrentUser();
      if (currentUser && currentUser.role === 'subject_teacher') {
        const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
        const activeTeacher = getActiveTeacher(currentUser, teachers);
        const subjects = getStorage<Subject[]>(KEYS.SUBJECTS, []);
        const accSubjects = getAccessibleSubjects(currentUser, activeTeacher, subjects);
        const accSubjUuids = accSubjects.map((s) => s.id).filter((id): id is string => Boolean(id && isUUID(id)));
        if (accSubjUuids.length > 0) {
          validSubjectUuids = accSubjUuids;
          if (accSubjUuids.length === 1) {
            query = query.eq('subject_id', accSubjUuids[0]);
          } else {
            query = query.in('subject_id', accSubjUuids);
          }
        } else {
          validSubjectUuids = ['00000000-0000-0000-0000-000000000000'];
          query = query.eq('subject_id', '00000000-0000-0000-0000-000000000000');
        }
      }
    }

    try {
      const { data: markData, error: markError } = await query;

      if (markError) {
        console.error('Supabase query error in fetchMarksForLearner:', markError);
        throw markError;
      }

      if (markData) {
        const mappedMarks = api.mapDatabaseMarks(markData);
        const currentMarks = getStorage<Mark[]>(KEYS.MARKS, []);

        const preservedMarks = currentMarks.filter((m) => {
          const matchStudent = matchesLearner(m.student_id);
          if (!matchStudent) return true;

          if (validExamUuids !== null) {
            const matchExam = validExamUuids.includes(m.exam_id);
            if (!matchExam) return true;
          }

          if (validSubjectUuids !== null) {
            const matchSubject = validSubjectUuids.includes(m.subject_id);
            if (!matchSubject) return true;
          }

          return false;
        });

        const markMap = new Map<string, Mark>();
        preservedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        mappedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));

        const combinedMarks = Array.from(markMap.values());
        setStorage(KEYS.MARKS, combinedMarks);
        return mappedMarks;
      }
    } catch (err) {
      console.error('Error fetching marks for learner from Supabase:', err);
    }

    const currentCached = getStorage<Mark[]>(KEYS.MARKS, []);
    return currentCached.filter((m) => {
      const isMatchLearner = matchesLearner(m.student_id);
      const isMatchExam = validExamUuids ? validExamUuids.includes(m.exam_id) : true;
      const isMatchSubject = validSubjectUuids ? validSubjectUuids.includes(m.subject_id) : true;
      return isMatchLearner && isMatchExam && isMatchSubject;
    });
  },

  fetchMarksForWorkflow: async (options: {
    examId?: string;
    studentId?: string;
    studentIds?: string[];
    subjectId?: string;
    classId?: string;
    streamId?: string;
  }): Promise<Mark[]> => {
    const client = createSupabaseClient();
    if (!client) return getStorage<Mark[]>(KEYS.MARKS, []);

    let query = client.from('marks').select('*');
    let hasFilter = false;

    const currentUser = api.getCurrentUser();
    const students = getStorage<Student[]>(KEYS.STUDENTS, []);
    const classes = getStorage<ClassStream[]>(KEYS.CLASSES, []);
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
    const activeTeacher = getActiveTeacher(currentUser, teachers);

    let targetExamUuid: string | null = null;
    if (options.examId) {
      const exams = getStorage<Examination[]>(KEYS.EXAMS, []);
      const match = exams.find((e) => e.id === options.examId);
      const examUuid = match && isUUID(match.id) ? match.id : (isUUID(options.examId) ? options.examId : null);
      if (examUuid) {
        targetExamUuid = examUuid;
        query = query.eq('exam_id', examUuid);
        hasFilter = true;
      } else {
        targetExamUuid = options.examId;
        query = query.eq('exam_id', options.examId);
        hasFilter = true;
      }
    }

    let targetStudentUuids: string[] | null = null;
    if (options.studentId) {
      const match = students.find((s) => s.id === options.studentId);
      const sUuid = match && isUUID(match.id) ? match.id : (isUUID(options.studentId) ? options.studentId : null);
      if (sUuid) targetStudentUuids = [sUuid];
    } else if (options.studentIds && options.studentIds.length > 0) {
      targetStudentUuids = options.studentIds.filter((id) => isUUID(id));
    } else if (options.classId || options.streamId) {
      const clsId = options.classId;
      const strmId = options.streamId;
      const clsObj = classes.find((c) => c.id === clsId || c.stream_id === clsId || c.id === strmId || c.stream_id === strmId);

      const filtered = students.filter((s) => {
        if (strmId) return s.stream_id === strmId || s.id === strmId;
        if (clsObj && clsObj.stream_id) return s.stream_id === clsObj.stream_id || s.stream_id === clsObj.id;
        if (clsId) return s.class_id === clsId || s.stream_id === clsId;
        if (clsObj) return s.class_id === clsObj.id;
        return false;
      });
      targetStudentUuids = filtered.map((s) => s.id).filter((id) => isUUID(id));
    } else if (currentUser && currentUser.role !== 'admin') {
      const accStudents = getAccessibleStudents(currentUser, activeTeacher, students, classes);
      targetStudentUuids = accStudents.map((s) => s.id).filter((id) => isUUID(id));
    }

    if (targetStudentUuids !== null) {
      if (targetStudentUuids.length > 0) {
        query = query.in('student_id', targetStudentUuids);
        hasFilter = true;
      } else {
        query = query.in('student_id', ['00000000-0000-0000-0000-000000000000']);
        hasFilter = true;
      }
    }

    let targetSubjectUuid: string | null = null;
    let targetSubjectUuids: string[] | null = null;
    if (options.subjectId) {
      const subjects = getStorage<Subject[]>(KEYS.SUBJECTS, []);
      const match = subjects.find((s) => s.id === options.subjectId);
      const subjectUuid = match && isUUID(match.id) ? match.id : (isUUID(options.subjectId) ? options.subjectId : null);
      if (subjectUuid) {
        targetSubjectUuid = subjectUuid;
        query = query.eq('subject_id', subjectUuid);
        hasFilter = true;
      } else {
        targetSubjectUuid = options.subjectId;
        query = query.eq('subject_id', options.subjectId);
        hasFilter = true;
      }
    } else if (currentUser && currentUser.role === 'subject_teacher') {
      const subjects = getStorage<Subject[]>(KEYS.SUBJECTS, []);
      const accSubjects = getAccessibleSubjects(currentUser, activeTeacher, subjects, options.classId, classes);
      const accSubjUuids = accSubjects.map((s) => s.id).filter((id) => isUUID(id));
      if (accSubjUuids.length > 0) {
        targetSubjectUuids = accSubjUuids;
        query = query.in('subject_id', accSubjUuids);
        hasFilter = true;
      } else {
        targetSubjectUuids = ['00000000-0000-0000-0000-000000000000'];
        query = query.in('subject_id', ['00000000-0000-0000-0000-000000000000']);
        hasFilter = true;
      }
    }

    if (!hasFilter) {
      return getStorage<Mark[]>(KEYS.MARKS, []);
    }

    try {
      const { data: markData, error: markError } = await query;
      if (!markError && markData) {
        const mappedMarks = api.mapDatabaseMarks(markData);
        const currentMarks = getStorage<Mark[]>(KEYS.MARKS, []);

        const preservedMarks = currentMarks.filter((m) => {
          if (targetExamUuid !== null) {
            const matchExam = m.exam_id === targetExamUuid || (options.examId && m.exam_id === options.examId);
            if (!matchExam) return true;
          }

          if (targetStudentUuids !== null) {
            const matchStudent = targetStudentUuids.includes(m.student_id) || (options.studentId && m.student_id === options.studentId);
            if (!matchStudent) return true;
          }

          if (targetSubjectUuid !== null) {
            const matchSubject = m.subject_id === targetSubjectUuid || (options.subjectId && m.subject_id === options.subjectId);
            if (!matchSubject) return true;
          } else if (targetSubjectUuids !== null) {
            const matchSubject = targetSubjectUuids.includes(m.subject_id);
            if (!matchSubject) return true;
          }

          return false;
        });

        const markMap = new Map<string, Mark>();
        preservedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        mappedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));

        const combinedMarks = Array.from(markMap.values());
        setStorage(KEYS.MARKS, combinedMarks);
        return combinedMarks;
      }
    } catch (err) {
      console.warn('Error fetching workflow marks:', err);
    }

    return getStorage<Mark[]>(KEYS.MARKS, []);
  },

  getMarks: (): Mark[] => getStorage(KEYS.MARKS, []),
  saveBulkMarks: async (newMarks: Mark[], currentUser?: User | null): Promise<void> => {
    const list = getStorage<Mark[]>(KEYS.MARKS, []);
    const exams = getStorage<Examination[]>(KEYS.EXAMS, []);

    // Check lock status for every mark being saved
    const dbStudentsForLock = getStorage<Student[]>(KEYS.STUDENTS, []);
    const dbClassesForLock = getStorage<ClassStream[]>(KEYS.CLASSES, []);

    for (const m of newMarks) {
      const targetExam = exams.find((e) => e.id === m.exam_id);
      if (targetExam) {
        // 1. Global Exam Approval Check
        if (targetExam.status === 'Approved') {
          throw new Error(
            `Cannot modify marks for approved examination "${targetExam.exam_name}". Examination is locked.`
          );
        }
        // 2. Granular Education Level / Class Approval Check
        if (targetExam.approved_levels && targetExam.approved_levels.length > 0) {
          const studentObj = dbStudentsForLock.find((s) => s.id === m.student_id);
          const studentClassObj = studentObj
            ? dbClassesForLock.find((c) => c.id === studentObj.class_id || c.stream_id === studentObj.class_id || c.class_name === studentObj.class_id)
            : null;

          const eduLevel = studentClassObj?.education_level;
          if (eduLevel && targetExam.approved_levels.includes(eduLevel)) {
            throw new Error(
              `Cannot modify marks for education level "${eduLevel}". This level is officially approved and locked for "${targetExam.exam_name}".`
            );
          }
        }
      }
    }

    // Persist to Supabase database
    const client = getSupabaseClient();
    if (client && newMarks.length > 0) {
      const dbStudents = getStorage<Student[]>(KEYS.STUDENTS, []);
      const dbSubjects = getStorage<Subject[]>(KEYS.SUBJECTS, []);
      const dbExams = getStorage<Examination[]>(KEYS.EXAMS, []);
      const dbTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);

      const payloads = [];
      for (const m of newMarks) {
        // Resolve student UUID
        let studentUuid = m.student_id;
        if (!isUUID(studentUuid)) {
          const matchStd = dbStudents.find((s) => s.id === m.student_id || s.admission_number === m.student_id);
          if (matchStd && isUUID(matchStd.id)) {
            studentUuid = matchStd.id;
          }
        }

        // Resolve subject UUID
        let subjectUuid = m.subject_id;
        if (!isUUID(subjectUuid)) {
          subjectUuid = await resolveSubjectUUID(client, { subject_id: m.subject_id });
        }
        if (isUUID(subjectUuid)) {
          m.subject_id = subjectUuid;
        } else {
          throw new Error(`Unable to resolve authoritative subject ID for identifier "${m.subject_id}".`);
        }

        // Resolve exam UUID
        let examUuid = m.exam_id;
        if (!isUUID(examUuid)) {
          const matchExam = dbExams.find((e) => e.id === m.exam_id || e.exam_name === m.exam_id);
          if (matchExam && isUUID(matchExam.id)) {
            examUuid = matchExam.id;
          }
        }

        // Resolve teacher UUID (must be a valid primary key in the teachers table)
        let teacherUuid: string | null = null;
        const candidateTeacherId = m.entered_by_teacher_id || currentUser?.teacher_id || currentUser?.id;
        if (candidateTeacherId) {
          const matchTch = dbTeachers.find((t) =>
            t.id === candidateTeacherId ||
            t.user_id === candidateTeacherId ||
            t.tsc_number === candidateTeacherId ||
            (t.email && currentUser?.email && t.email.toLowerCase() === currentUser.email.toLowerCase())
          );

          if (matchTch && isUUID(matchTch.id)) {
            teacherUuid = matchTch.id;
          } else if (isUUID(candidateTeacherId) && dbTeachers.some((t) => t.id === candidateTeacherId)) {
            teacherUuid = candidateTeacherId;
          }

          if (!teacherUuid && client) {
            try {
              let query = client.from('teachers').select('id');
              if (isUUID(candidateTeacherId)) {
                query = query.or(`id.eq.${candidateTeacherId},user_id.eq.${candidateTeacherId}`);
              } else {
                query = query.or(`tsc_number.eq.${candidateTeacherId},id.eq.${candidateTeacherId}`);
              }
              const { data: dbTchData } = await query.limit(1);
              if (dbTchData && dbTchData.length > 0 && isUUID(dbTchData[0].id)) {
                teacherUuid = dbTchData[0].id;
              }
            } catch (err) {
              // ignore query error
            }
          }
        }

        if (isUUID(studentUuid) && isUUID(subjectUuid) && isUUID(examUuid)) {
          const remarksObj: any = {
            raw_score: typeof m.raw_score === 'number' && !isNaN(m.raw_score) ? m.raw_score : (typeof m.marks === 'number' ? m.marks : null),
            out_of: typeof m.out_of === 'number' ? m.out_of : 100,
            special_status: m.special_status || 'Normal',
            irregularity_reason: m.irregularity_reason || null,
            entered_by_teacher_id: candidateTeacherId || null,
          };
          if (m.resolution) {
            remarksObj.resolution = m.resolution;
          }

          const payload: any = {
            student_id: studentUuid,
            subject_id: subjectUuid,
            exam_id: examUuid,
            marks: typeof m.marks === 'number' && !isNaN(m.marks) ? m.marks : 0,
            entered_by_teacher_id: teacherUuid,
            remarks: JSON.stringify(remarksObj),
            updated_at: m.updated_at || new Date().toISOString(),
          };

          if (isUUID(m.id)) {
            payload.id = m.id;
          }

          payloads.push(payload);
        } else {
          const unresolvable = !isUUID(studentUuid) ? `student "${m.student_id}"` : !isUUID(subjectUuid) ? `learning area "${m.subject_id}"` : `examination "${m.exam_id}"`;
          throw new Error(`Failed to save mark: Unresolvable database UUID for ${unresolvable}. Database write aborted.`);
        }
      }

      if (payloads.length > 0) {
        const { error } = await client
          .from('marks')
          .upsert(payloads, { onConflict: 'student_id,subject_id,exam_id' });

        if (error) {
          console.error('Supabase saveBulkMarks error:', error);
          const errorMsg = error.message || (error as any).details || 'Database error while saving marks';
          const errorObj = new Error(`Failed to save marks in database: ${errorMsg}`);
          (errorObj as any).code = error.code;
          (errorObj as any).details = error.details;
          (errorObj as any).hint = error.hint;
          throw errorObj;
        }
      }
    }

    // Map existing marks and replace matching (student_id, subject_id, exam_id) ONLY AFTER SUCCESSFUL PERSISTENCE
    const map = new Map<string, Mark>();
    list.forEach((m) => {
      const key = `${m.student_id}_${m.subject_id}_${m.exam_id}`;
      map.set(key, m);
    });

    newMarks.forEach((m) => {
      const key = `${m.student_id}_${m.subject_id}_${m.exam_id}`;
      map.set(key, m);
    });

    setStorage(KEYS.MARKS, Array.from(map.values()));
  },

  // --- T-11 AUTHORISED Y RESOLUTION ---
  resolveYMark: async (params: {
    markId?: string;
    studentId: string;
    subjectId: string;
    examId: string;
    replacementScore: number;
    outOf?: number;
    resolutionReason: string;
    currentUser: User;
  }): Promise<{ success: boolean; mark: Mark; provenance: MarkResolution }> => {
    // 1. Authorisation check: Only administrators can formally resolve assessment irregularities
    // Database RPC authoritatively enforces public.is_admin() and auth.uid()
    if (!params.currentUser || params.currentUser.role !== 'admin') {
      throw new Error('Unauthorised: Only administrators have authority to formally resolve assessment irregularities (Y).');
    }

    if (params.replacementScore === undefined || params.replacementScore === null || isNaN(params.replacementScore) || params.replacementScore < 0) {
      throw new Error('Invalid replacement mark: must be a non-negative numerical score.');
    }

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Database client unavailable. Y Resolution requires an active database connection.');
    }

    // 2. Identify authoritative primary key (mark_id) in Supabase
    let targetMarkId = params.markId;
    if (!targetMarkId || !isUUID(targetMarkId)) {
      const { data: dbMark } = await client
        .from('marks')
        .select('id')
        .eq('student_id', params.studentId)
        .eq('subject_id', params.subjectId)
        .eq('exam_id', params.examId)
        .maybeSingle();

      if (dbMark && isUUID(dbMark.id)) {
        targetMarkId = dbMark.id;
      }
    }

    if (!targetMarkId || !isUUID(targetMarkId)) {
      throw new Error('Target assessment mark does not exist in the database. Y resolution requires an existing persistent mark.');
    }

    // 3. Call authoritative Supabase atomic RPC: public.resolve_y_mark_atomic
    // Pass ONLY p_mark_id, p_replacement_score, p_resolution_reason.
    // Scale (examinations.max_marks), replacement percentage, provenance, and audit logs are authoritative database responsibilities.
    const { data: rpcResult, error: rpcError } = await client.rpc('resolve_y_mark_atomic', {
      p_mark_id: targetMarkId,
      p_replacement_score: params.replacementScore,
      p_resolution_reason: params.resolutionReason.trim(),
    });

    if (rpcError) {
      console.error('RPC resolve_y_mark_atomic error:', rpcError);
      throw new Error(rpcError.message || (rpcError as any).details || 'Database error occurred during atomic Y resolution.');
    }

    // 4. Rehydrate authoritative updated mark record directly from Supabase
    const { data: updatedMarkRow } = await client
      .from('marks')
      .select('*')
      .eq('id', targetMarkId)
      .single();

    let resolvedMark: Mark;
    let provenance: MarkResolution;

    if (updatedMarkRow) {
      const mapped = api.mapDatabaseMarks([updatedMarkRow]);
      resolvedMark = mapped[0];
      provenance = resolvedMark.resolution || (rpcResult as any)?.provenance;
    } else {
      const prov = (rpcResult as any)?.provenance;
      provenance = prov;
      resolvedMark = {
        id: targetMarkId,
        student_id: params.studentId,
        subject_id: params.subjectId,
        exam_id: params.examId,
        marks: (rpcResult as any)?.replacement_percentage,
        raw_score: (rpcResult as any)?.replacement_score,
        out_of: (rpcResult as any)?.out_of,
        special_status: 'Normal',
        resolution: prov,
        updated_at: new Date().toISOString(),
      };
    }

    // 5. Update local cache with authoritative result from Supabase
    const marksList = getStorage<Mark[]>(KEYS.MARKS, []);
    const updatedList = marksList.filter(
      (m) =>
        m.id !== resolvedMark.id &&
        !(m.student_id === resolvedMark.student_id && m.subject_id === resolvedMark.subject_id && m.exam_id === resolvedMark.exam_id)
    );
    updatedList.push(resolvedMark);
    setStorage(KEYS.MARKS, updatedList);

    return {
      success: true,
      mark: resolvedMark,
      provenance,
    };
  },

  // --- GRADES ---
  getGrades: (): Grade[] => getStorage(KEYS.GRADES, initialGrades),
  updateGrades: async (grades: Grade[]): Promise<Grade[]> => {
    // 1. Update runtime memory cache
    setStorage(KEYS.GRADES, grades);

    // 2. Persist to Supabase database (source of truth)
    const client = getSupabaseClient();
    if (client) {
      try {
        const payloads = grades.map((g) => ({
          id: g.id || `gr_${(g.grade_code || g.grade || 'x').toLowerCase()}`,
          grade_code: g.grade_code || g.grade || '',
          performance_level: g.performance_level || 'ME',
          minimum_score: typeof g.minimum_score === 'number' ? g.minimum_score : (g.minimum_marks ?? 0),
          maximum_score: typeof g.maximum_score === 'number' ? g.maximum_score : (g.maximum_marks ?? 100),
          minimum_marks: typeof g.minimum_marks === 'number' ? g.minimum_marks : (g.minimum_score ?? 0),
          maximum_marks: typeof g.maximum_marks === 'number' ? g.maximum_marks : (g.maximum_score ?? 100),
          points: typeof g.points === 'number' ? g.points : 0,
          descriptor: g.descriptor || '',
          remarks: g.remarks || '',
          grade: g.grade || g.grade_code || '',
          updated_at: new Date().toISOString(),
        }));

        const { error } = await client.from('cbe_grades').upsert(payloads, { onConflict: 'id' });
        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205') {
            console.warn('cbe_grades table missing in database. Local memory updated.');
          } else if (error.message?.includes('updated_at') || error.code === 'PGRST204' || error.code === '42703') {
            const payloadsNoTime = payloads.map(({ updated_at, ...rest }) => rest);
            const { error: err2 } = await client.from('cbe_grades').upsert(payloadsNoTime, { onConflict: 'id' });
            if (err2 && err2.code !== '42P01' && err2.code !== 'PGRST205') {
              console.warn('cbe_grades table upsert retry warning:', err2);
            }
          } else {
            console.error('Supabase error updating cbe_grades:', error);
            throw new Error(`Failed to update grading boundaries in database: ${error.message}`);
          }
        }
      } catch (err: any) {
        console.error('Error updating grades in Supabase:', err);
        throw err;
      }
    }

    return grades;
  },

  // --- VERIFICATION LOGS ---
  getVerificationLogs: (examId?: string): VerificationLog[] => {
    const logs = getStorage<VerificationLog[]>(KEYS.VERIFICATIONS, []);
    if (examId) {
      return logs.filter((l) => l.exam_id === examId);
    }
    return logs;
  },
  addVerificationLog: (log: VerificationLog): VerificationLog => {
    const logs = getStorage<VerificationLog[]>(KEYS.VERIFICATIONS, []);
    const updated = [log, ...logs];
    setStorage(KEYS.VERIFICATIONS, updated);
    return log;
  },

  // --- ACADEMIC YEARS & TERMS ---
  getAcademicYears: (): AcademicYear[] => getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears),
  addAcademicYear: async (ay: AcademicYear): Promise<AcademicYear> => {
    const client = createSupabaseClient();
    const ayUuid = isUUID(ay.id) ? ay.id : generateUUID();
    const startDate = ay.start_date || `${ay.year}-01-01`;
    const endDate = ay.end_date || `${ay.year}-12-31`;
    const nowIso = new Date().toISOString();

    const finalAy: AcademicYear = {
      ...ay,
      id: ayUuid,
      year: Number(ay.year),
      status: ay.status || 'Upcoming',
      start_date: startDate,
      end_date: endDate,
      created_at: ay.created_at || nowIso,
      updated_at: ay.updated_at || nowIso,
    };

    if (client) {
      // If adding as Active, update any existing Active year to Closed first (respecting idx_academic_years_single_active)
      if (finalAy.status === 'Active') {
        const { error: deactErr } = await client
          .from('academic_years')
          .update({ status: 'Closed', updated_at: nowIso })
          .eq('status', 'Active');
        if (deactErr && deactErr.code !== '42P01' && deactErr.code !== 'PGRST205') {
          console.error('Supabase error deactivating current active year:', deactErr);
          throw new Error(`Failed to update active academic year: ${deactErr.message}`);
        }
      }

      const payload: any = {
        id: finalAy.id,
        year: finalAy.year,
        status: finalAy.status,
        start_date: finalAy.start_date,
        end_date: finalAy.end_date,
      };

      const { data, error } = await client
        .from('academic_years')
        .insert([payload])
        .select()
        .maybeSingle();

      if (error) {
        console.error('Supabase error inserting academic year:', error);
        if (error.code === '23505') {
          throw new Error(`Academic Year ${finalAy.year} already exists in database.`);
        }
        if (error.code !== '42P01' && error.code !== 'PGRST205') {
          throw new Error(`Failed to save Academic Year in database: ${error.message}`);
        }
      } else if (data && isUUID(data.id)) {
        finalAy.id = data.id;
        finalAy.created_at = data.created_at || finalAy.created_at;
        finalAy.updated_at = data.updated_at || finalAy.updated_at;
      }
    }

    // Update local cache ONLY AFTER confirmed Supabase operation
    const list = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    let updatedList = list.filter((y) => y.id !== finalAy.id && y.year !== finalAy.year);
    if (finalAy.status === 'Active') {
      updatedList = updatedList.map((y) => ({
        ...y,
        status: y.status === 'Active' ? ('Closed' as const) : y.status,
      }));
    }
    const updated = [...updatedList, finalAy];
    setStorage(KEYS.ACADEMIC_YEARS, updated);
    return finalAy;
  },
  updateAcademicYear: async (ay: AcademicYear): Promise<AcademicYear> => {
    const client = createSupabaseClient();
    const nowIso = new Date().toISOString();

    let targetId = ay.id;
    if (!isUUID(targetId)) {
      const list = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
      const matched = list.find((y) => y.id === ay.id || y.year === ay.year);
      if (matched && isUUID(matched.id)) {
        targetId = matched.id;
      }
    }

    if (client) {
      if (!isUUID(targetId)) {
        throw new Error(`Cannot update academic year: Invalid database ID for year ${ay.year}`);
      }

      // If updating to Active, close other active years first
      if (ay.status === 'Active') {
        const { error: deactErr } = await client
          .from('academic_years')
          .update({ status: 'Closed', updated_at: nowIso })
          .eq('status', 'Active')
          .neq('id', targetId);
        if (deactErr && deactErr.code !== '42P01' && deactErr.code !== 'PGRST205') {
          console.error('Supabase error updating active years:', deactErr);
          throw new Error(`Failed to update active academic year: ${deactErr.message}`);
        }
      }

      const payload: any = {
        year: ay.year,
        status: ay.status,
        start_date: ay.start_date || `${ay.year}-01-01`,
        end_date: ay.end_date || `${ay.year}-12-31`,
        updated_at: nowIso,
      };

      const { data, error } = await client
        .from('academic_years')
        .update(payload)
        .eq('id', targetId)
        .select()
        .maybeSingle();

      if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
        console.error('Supabase error updating academic year:', error);
        throw new Error(`Failed to update Academic Year in database: ${error.message}`);
      }
    }

    const finalAy: AcademicYear = {
      ...ay,
      id: targetId,
      updated_at: nowIso,
    };

    const list = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const updated = list.map((y) => {
      if (y.id === targetId || y.id === ay.id || y.year === ay.year) {
        return finalAy;
      }
      if (finalAy.status === 'Active' && y.status === 'Active') {
        return { ...y, status: 'Closed' as const };
      }
      return y;
    });
    setStorage(KEYS.ACADEMIC_YEARS, updated);
    return finalAy;
  },
  setActiveAcademicYear: async (id: string): Promise<AcademicYear> => {
    const list = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    let target = list.find((y) => y.id === id || y.year.toString() === id);

    const client = createSupabaseClient();
    const nowIso = new Date().toISOString();

    let targetUuid = target && isUUID(target.id) ? target.id : (isUUID(id) ? id : null);

    if (!targetUuid && client && target) {
      const { data: dbY } = await client.from('academic_years').select('id').eq('year', target.year).maybeSingle();
      if (dbY && isUUID(dbY.id)) {
        targetUuid = dbY.id;
      }
    }

    if (client) {
      if (!targetUuid || !isUUID(targetUuid)) {
        throw new Error(`Cannot activate academic year: Unresolvable database UUID for "${id}"`);
      }

      // 1. Close current Active academic year in Supabase
      const { error: closeErr } = await client
        .from('academic_years')
        .update({ status: 'Closed', updated_at: nowIso })
        .eq('status', 'Active')
        .neq('id', targetUuid);

      if (closeErr && closeErr.code !== '42P01' && closeErr.code !== 'PGRST205') {
        console.error('Supabase error closing active academic years:', closeErr);
        throw new Error(`Failed to deactivate current academic year: ${closeErr.message}`);
      }

      // 2. Set target year to Active
      const { error: actErr } = await client
        .from('academic_years')
        .update({ status: 'Active', updated_at: nowIso })
        .eq('id', targetUuid);

      if (actErr && actErr.code !== '42P01' && actErr.code !== 'PGRST205') {
        console.error('Supabase error activating academic year:', actErr);
        throw new Error(`Failed to set Active Academic Year in database: ${actErr.message}`);
      }
    }

    let targetYear: AcademicYear = target ? { ...target, id: targetUuid || target.id, status: 'Active', updated_at: nowIso } : list[0];
    const updated = list.map((y) => {
      if (y.id === id || y.id === targetUuid || (target && y.year === target.year)) {
        targetYear = { ...y, id: targetUuid || y.id, status: 'Active' as const, updated_at: nowIso };
        return targetYear;
      }
      return { ...y, status: y.status === 'Active' ? ('Closed' as const) : y.status };
    });
    setStorage(KEYS.ACADEMIC_YEARS, updated);

    // Fire session-changed event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('session-changed', { detail: { yearId: targetYear.id, year: targetYear.year } }));
    }

    return targetYear;
  },
  getActiveAcademicYear: (): AcademicYear => {
    const years = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const active = years.find((y) => y.status === 'Active');
    return active || years.find((y) => y.year === 2026) || years[0] || initialAcademicYears[1];
  },

  // --- SCHOOL TERMS ---
  getSchoolTerms: (academicYearId?: string): SchoolTerm[] => {
    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    if (academicYearId) {
      return terms.filter((t) => t.academic_year_id === academicYearId || t.year.toString() === academicYearId);
    }
    return terms;
  },
  addSchoolTerm: async (term: SchoolTerm): Promise<SchoolTerm> => {
    const client = createSupabaseClient();
    const termUuid = isUUID(term.id) ? term.id : generateUUID();
    const nowIso = new Date().toISOString();

    // Resolve academic_year_id to valid UUID
    let ayId: string | null = isUUID(term.academic_year_id) ? term.academic_year_id : null;
    if (!ayId) {
      const years = api.getAcademicYears();
      const matchedYear = years.find((y) => y.id === term.academic_year_id || y.year === term.year);
      if (matchedYear && isUUID(matchedYear.id)) {
        ayId = matchedYear.id;
      }
    }

    if (!ayId && client) {
      const { data: dbYear } = await client
        .from('academic_years')
        .select('id')
        .eq('year', term.year)
        .maybeSingle();
      if (dbYear && isUUID(dbYear.id)) {
        ayId = dbYear.id;
      }
    }

    if (client) {
      if (!ayId || !isUUID(ayId)) {
        throw new Error(`Failed to create school term in database: Unresolvable Academic Year UUID for Year ${term.year}`);
      }

      // If new term is Active, close existing Active term in this academic year
      if (term.status === 'Active') {
        const { error: closeErr } = await client
          .from('school_terms')
          .update({ status: 'Closed', updated_at: nowIso })
          .eq('academic_year_id', ayId)
          .eq('status', 'Active');
        if (closeErr && closeErr.code !== '42P01' && closeErr.code !== 'PGRST205') {
          console.error('Supabase error deactivating active term in year:', closeErr);
          throw new Error(`Failed to update active term in database: ${closeErr.message}`);
        }
      }

      const termNumber = term.term_number || (term.term_name === 'Term 1' ? 1 : term.term_name === 'Term 2' ? 2 : 3);

      const payload: any = {
        id: termUuid,
        academic_year_id: ayId,
        year: term.year,
        term_name: term.term_name,
        term_number: termNumber,
        status: term.status || 'Upcoming',
        opening_date: term.opening_date,
        closing_date: term.closing_date,
        mid_term_opening_date: term.mid_term_opening_date || null,
        mid_term_closing_date: term.mid_term_closing_date || null,
      };

      const { data, error } = await client
        .from('school_terms')
        .insert([payload])
        .select()
        .maybeSingle();

      if (error) {
        console.error('Supabase error inserting school term:', error);
        if (error.code === '23505') {
          throw new Error(`${term.term_name} already exists for academic year ${term.year}.`);
        }
        if (error.code !== '42P01' && error.code !== 'PGRST205') {
          throw new Error(`Failed to save School Term in database: ${error.message}`);
        }
      } else if (data && isUUID(data.id)) {
        payload.id = data.id;
      }
    }

    const finalTerm: SchoolTerm = {
      ...term,
      id: termUuid,
      academic_year_id: ayId || term.academic_year_id,
      created_at: term.created_at || nowIso,
      updated_at: term.updated_at || nowIso,
    };

    const list = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    let updatedList = list.filter((t) => t.id !== finalTerm.id);
    if (finalTerm.status === 'Active') {
      updatedList = updatedList.map((t) =>
        t.academic_year_id === finalTerm.academic_year_id && t.status === 'Active'
          ? { ...t, status: 'Closed' as const }
          : t
      );
    }
    const updated = [...updatedList, finalTerm];
    setStorage(KEYS.SCHOOL_TERMS, updated);
    return finalTerm;
  },
  updateSchoolTerm: async (term: SchoolTerm): Promise<SchoolTerm> => {
    const client = createSupabaseClient();
    const nowIso = new Date().toISOString();

    let targetTermId = term.id;
    let ayId: string | null = isUUID(term.academic_year_id) ? term.academic_year_id : null;

    if (!ayId) {
      const years = api.getAcademicYears();
      const matchedYear = years.find((y) => y.id === term.academic_year_id || y.year === term.year);
      if (matchedYear && isUUID(matchedYear.id)) {
        ayId = matchedYear.id;
      }
    }

    if (client) {
      if (!isUUID(targetTermId)) {
        let query = client.from('school_terms').select('id, academic_year_id');
        if (ayId) query = query.eq('academic_year_id', ayId);
        else query = query.eq('year', term.year);
        query = query.eq('term_name', term.term_name);
        const { data: dbTerm } = await query.maybeSingle();
        if (dbTerm && isUUID(dbTerm.id)) {
          targetTermId = dbTerm.id;
          if (!ayId && isUUID(dbTerm.academic_year_id)) {
            ayId = dbTerm.academic_year_id;
          }
        }
      }

      if (!isUUID(targetTermId)) {
        throw new Error(`Cannot update school term: Unresolvable database ID for ${term.term_name} (${term.year})`);
      }

      // If updating to Active, close other active terms in this academic year
      if (term.status === 'Active' && ayId) {
        const { error: closeErr } = await client
          .from('school_terms')
          .update({ status: 'Closed', updated_at: nowIso })
          .eq('academic_year_id', ayId)
          .eq('status', 'Active')
          .neq('id', targetTermId);
        if (closeErr && closeErr.code !== '42P01' && closeErr.code !== 'PGRST205') {
          console.error('Supabase error closing active terms in year:', closeErr);
          throw new Error(`Failed to update active term in database: ${closeErr.message}`);
        }
      }

      const termNumber = term.term_number || (term.term_name === 'Term 1' ? 1 : term.term_name === 'Term 2' ? 2 : 3);

      const payload: any = {
        term_name: term.term_name,
        term_number: termNumber,
        status: term.status,
        opening_date: term.opening_date,
        closing_date: term.closing_date,
        mid_term_opening_date: term.mid_term_opening_date || null,
        mid_term_closing_date: term.mid_term_closing_date || null,
        updated_at: nowIso,
      };
      if (ayId) {
        payload.academic_year_id = ayId;
        payload.year = term.year;
      }

      const { error } = await client
        .from('school_terms')
        .update(payload)
        .eq('id', targetTermId);

      if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
        console.error('Supabase error updating school term:', error);
        throw new Error(`Failed to update School Term in database: ${error.message}`);
      }
    }

    const finalTerm: SchoolTerm = {
      ...term,
      id: targetTermId,
      academic_year_id: ayId || term.academic_year_id,
      updated_at: nowIso,
    };

    const list = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const updated = list.map((t) => {
      if (t.id === targetTermId || t.id === term.id || (t.academic_year_id === finalTerm.academic_year_id && t.term_name === finalTerm.term_name)) {
        return finalTerm;
      }
      if (finalTerm.status === 'Active' && t.academic_year_id === finalTerm.academic_year_id && t.status === 'Active') {
        return { ...t, status: 'Closed' as const };
      }
      return t;
    });
    setStorage(KEYS.SCHOOL_TERMS, updated);
    return finalTerm;
  },
  setActiveTerm: async (termId: string): Promise<SchoolTerm> => {
    const list = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    let target = list.find((t) => t.id === termId);

    const client = createSupabaseClient();
    const nowIso = new Date().toISOString();

    let targetUuid = target && isUUID(target.id) ? target.id : (isUUID(termId) ? termId : null);
    let ayId = target?.academic_year_id;

    if (client) {
      if (!targetUuid && target) {
        const { data: dbTerm } = await client
          .from('school_terms')
          .select('id, academic_year_id')
          .eq('year', target.year)
          .eq('term_name', target.term_name)
          .maybeSingle();
        if (dbTerm && isUUID(dbTerm.id)) {
          targetUuid = dbTerm.id;
          ayId = dbTerm.academic_year_id;
        }
      }

      if (!targetUuid || !isUUID(targetUuid)) {
        throw new Error(`Cannot activate school term: Unresolvable database UUID for "${termId}"`);
      }

      if (!ayId) {
        const { data: dbTerm } = await client
          .from('school_terms')
          .select('academic_year_id')
          .eq('id', targetUuid)
          .maybeSingle();
        if (dbTerm && isUUID(dbTerm.academic_year_id)) {
          ayId = dbTerm.academic_year_id;
        }
      }

      // 1. Close current Active term in this academic year
      if (ayId) {
        const { error: closeErr } = await client
          .from('school_terms')
          .update({ status: 'Closed', updated_at: nowIso })
          .eq('academic_year_id', ayId)
          .eq('status', 'Active')
          .neq('id', targetUuid);

        if (closeErr && closeErr.code !== '42P01' && closeErr.code !== 'PGRST205') {
          console.error('Supabase error closing active terms in year:', closeErr);
          throw new Error(`Failed to deactivate active terms: ${closeErr.message}`);
        }
      }

      // 2. Set target term to Active
      const { error: actErr } = await client
        .from('school_terms')
        .update({ status: 'Active', updated_at: nowIso })
        .eq('id', targetUuid);

      if (actErr && actErr.code !== '42P01' && actErr.code !== 'PGRST205') {
        console.error('Supabase error activating school term:', actErr);
        throw new Error(`Failed to set Active Term in database: ${actErr.message}`);
      }
    }

    let activeTerm: SchoolTerm = target ? { ...target, id: targetUuid || target.id, status: 'Active', updated_at: nowIso } : list[0];
    const updated = list.map((t) => {
      if (t.id === termId || t.id === targetUuid) {
        activeTerm = { ...t, id: targetUuid || t.id, status: 'Active' as const, updated_at: nowIso };
        return activeTerm;
      }
      if (ayId && (t.academic_year_id === ayId || (target && t.academic_year_id === target.academic_year_id)) && t.status === 'Active') {
        return { ...t, status: 'Closed' as const };
      }
      return t;
    });
    setStorage(KEYS.SCHOOL_TERMS, updated);

    // Fire session-changed event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('session-changed', { detail: { termId: activeTerm.id, termName: activeTerm.term_name } }));
    }

    return activeTerm;
  },
  getActiveTerm: (): SchoolTerm => {
    const activeYear = api.getActiveAcademicYear();
    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const activeTerm =
      terms.find((t) => t.academic_year_id === activeYear.id && t.status === 'Active') ||
      terms.find((t) => t.year === activeYear.year && t.status === 'Active') ||
      terms.find((t) => t.status === 'Active') ||
      terms.find((t) => t.term_name === 'Term 2') ||
      terms[0];
    return activeTerm;
  },

  checkAcademicYearCanBeDeletedSync: (id: string): boolean => {
    const years = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const targetYear = years.find((y) => y.id === id);
    if (!targetYear || targetYear.status === 'Active') return false;

    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const linkedTerms = terms.filter((t) => t.academic_year_id === id || t.year === targetYear.year);
    if (linkedTerms.length > 0) return false;

    const exams = getStorage<Examination[]>(KEYS.EXAMS, []);
    const linkedExams = exams.filter((e) => e.academic_year_id === id || e.year === targetYear.year);
    if (linkedExams.length > 0) return false;

    const students = getStorage<Student[]>(KEYS.STUDENTS, []);
    const hasStudentPromo = students.some((s) =>
      s.promotion_history?.some(
        (p) => p.academic_year_id === id || p.from_year === targetYear.year || p.to_year === targetYear.year
      )
    );
    if (hasStudentPromo) return false;

    return true;
  },

  checkAcademicYearCanBeDeleted: async (id: string): Promise<{ canDelete: boolean; reason?: string }> => {
    const years = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const targetYear = years.find((y) => y.id === id);
    if (!targetYear) {
      return { canDelete: false, reason: 'Academic year record not found.' };
    }
    if (targetYear.status === 'Active') {
      return { canDelete: false, reason: 'This academic year is currently ACTIVE and cannot be deleted.' };
    }

    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const linkedTerms = terms.filter((t) => t.academic_year_id === id || t.year === targetYear.year);
    if (linkedTerms.length > 0) {
      return { canDelete: false, reason: 'This academic year contains school terms and cannot be deleted.' };
    }

    const exams = getStorage<Examination[]>(KEYS.EXAMS, []);
    const linkedExams = exams.filter((e) => e.academic_year_id === id || e.year === targetYear.year);
    if (linkedExams.length > 0) {
      return { canDelete: false, reason: 'This academic year contains academic records and cannot be deleted.' };
    }

    const students = getStorage<Student[]>(KEYS.STUDENTS, []);
    const hasStudentPromo = students.some((s) =>
      s.promotion_history?.some(
        (p) => p.academic_year_id === id || p.from_year === targetYear.year || p.to_year === targetYear.year
      )
    );
    if (hasStudentPromo) {
      return { canDelete: false, reason: 'This academic year contains academic records and cannot be deleted.' };
    }

    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { data: dbExams, error: exErr } = await client
            .from('examinations')
            .select('id')
            .or(`academic_year_id.eq.${id},year.eq.${targetYear.year}`)
            .limit(1);
          if (!exErr && dbExams && dbExams.length > 0) {
            return { canDelete: false, reason: 'This academic year contains academic records and cannot be deleted.' };
          }
        } catch (err) {
          console.warn('Supabase check error for academic year:', err);
        }
      }
    }

    return { canDelete: true };
  },

  deleteAcademicYear: async (id: string): Promise<{ success: boolean; message: string }> => {
    const check = await api.checkAcademicYearCanBeDeleted(id);
    if (!check.canDelete) {
      return { success: false, message: check.reason || 'This academic year contains academic records and cannot be deleted.' };
    }

    const years = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const targetYear = years.find((y) => y.id === id);
    if (!targetYear) {
      return { success: false, message: 'Academic year record not found.' };
    }

    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { error } = await client.from('academic_years').delete().eq('id', id);
          if (error && error.code !== '42P01' && error.code !== '22P02' && error.code !== 'PGRST205') {
            console.error('Database error deleting academic year:', error);
            return { success: false, message: `Database error deleting academic year: ${error.message}` };
          }
        } catch (err: any) {
          console.warn('Supabase delete academic year error:', err);
        }
      }
    }

    const updated = years.filter((y) => y.id !== id);
    setStorage(KEYS.ACADEMIC_YEARS, updated);

    return { success: true, message: `Academic Year ${targetYear.year} deleted successfully.` };
  },

  checkSchoolTermCanBeDeletedSync: (id: string): boolean => {
    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const targetTerm = terms.find((t) => t.id === id);
    if (!targetTerm || targetTerm.status === 'Active' || targetTerm.status === 'Archived') return false;

    const exams = getStorage<Examination[]>(KEYS.EXAMS, []);
    const linkedExams = exams.filter(
      (e) =>
        e.term_id === id ||
        (e.term === targetTerm.term_name && (e.academic_year_id === targetTerm.academic_year_id || e.year === targetTerm.year))
    );
    if (linkedExams.length > 0) return false;

    const students = getStorage<Student[]>(KEYS.STUDENTS, []);
    const hasStudentPromo = students.some((s) =>
      s.promotion_history?.some(
        (p) =>
          (p.from_term === targetTerm.term_name && p.from_year === targetTerm.year) ||
          (p.to_term === targetTerm.term_name && p.to_year === targetTerm.year)
      )
    );
    if (hasStudentPromo) return false;

    return true;
  },

  checkSchoolTermCanBeDeleted: async (id: string): Promise<{ canDelete: boolean; reason?: string }> => {
    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const targetTerm = terms.find((t) => t.id === id);
    if (!targetTerm) {
      return { canDelete: false, reason: 'Term record not found.' };
    }
    if (targetTerm.status === 'Active') {
      return { canDelete: false, reason: 'This term is currently ACTIVE and cannot be deleted.' };
    }
    if (targetTerm.status === 'Archived') {
      return { canDelete: false, reason: 'Archived terms cannot be directly deleted.' };
    }

    const exams = getStorage<Examination[]>(KEYS.EXAMS, []);
    const linkedExams = exams.filter(
      (e) =>
        e.term_id === id ||
        (e.term === targetTerm.term_name && (e.academic_year_id === targetTerm.academic_year_id || e.year === targetTerm.year))
    );
    if (linkedExams.length > 0) {
      return { canDelete: false, reason: 'This term contains academic records and cannot be deleted.' };
    }

    const students = getStorage<Student[]>(KEYS.STUDENTS, []);
    const hasStudentPromo = students.some((s) =>
      s.promotion_history?.some(
        (p) =>
          (p.from_term === targetTerm.term_name && p.from_year === targetTerm.year) ||
          (p.to_term === targetTerm.term_name && p.to_year === targetTerm.year)
      )
    );
    if (hasStudentPromo) {
      return { canDelete: false, reason: 'This term contains academic records and cannot be deleted.' };
    }

    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { data: dbExams, error: exErr } = await client
            .from('examinations')
            .select('id')
            .eq('term_id', id)
            .limit(1);
          if (!exErr && dbExams && dbExams.length > 0) {
            return { canDelete: false, reason: 'This term contains academic records and cannot be deleted.' };
          }
        } catch (err) {
          console.warn('Supabase check error for term:', err);
        }
      }
    }

    return { canDelete: true };
  },

  deleteSchoolTerm: async (id: string): Promise<{ success: boolean; message: string }> => {
    const check = await api.checkSchoolTermCanBeDeleted(id);
    if (!check.canDelete) {
      return { success: false, message: check.reason || 'This term contains academic records and cannot be deleted.' };
    }

    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const targetTerm = terms.find((t) => t.id === id);
    if (!targetTerm) {
      return { success: false, message: 'Term record not found.' };
    }

    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { error } = await client.from('school_terms').delete().eq('id', id);
          if (error && error.code !== '42P01' && error.code !== '22P02' && error.code !== 'PGRST205') {
            console.error('Database error deleting school term:', error);
            return { success: false, message: `Database error deleting school term: ${error.message}` };
          }
        } catch (err: any) {
          console.warn('Supabase delete school term error:', err);
        }
      }
    }

    const updated = terms.filter((t) => t.id !== id);
    setStorage(KEYS.SCHOOL_TERMS, updated);

    return { success: true, message: `${targetTerm.term_name} (${targetTerm.year}) deleted successfully.` };
  },

  // --- AUTHORITATIVE COHORT RANKING FOR LEARNER PORTAL ---
  fetchLearnerExamRanking: async (examId: string): Promise<LearnerRankingMetadata | null> => {
    if (!examId) return null;
    try {
      const client = createSupabaseClient();
      let token: string | undefined = undefined;
      if (client) {
        const { data: sessionData } = await client.auth.getSession();
        token = sessionData?.session?.access_token;
      }
      if (!token) {
        const authUser = getStorage<any>(KEYS.CURRENT_USER, null);
        token = authUser?.token;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = buildApiUrl(`/api/learner/exam-ranking?exam_id=${encodeURIComponent(examId)}${token ? `&token=${encodeURIComponent(token)}` : ''}`);
      const res = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        return null;
      }

      const json = await res.json();
      if (json && typeof json === 'object' && !json.error) {
        return json as LearnerRankingMetadata;
      }
      return null;
    } catch (e) {
      console.warn('Could not fetch learner exam ranking:', e);
      return null;
    }
  },

  // --- REALTIME & CONNECTIVITY API (Stage 8A, 8D & Priority 2) ---
  subscribeToMarksRealtime: (callback?: RealtimeMarkCallback) => subscribeToMarksRealtime(callback),
  unsubscribeFromMarksRealtime: (callback?: RealtimeMarkCallback) => unsubscribeFromMarksRealtime(callback),
  reconcileMarksOnReconnect: () => reconcileMarksOnReconnect(),
  getConnectionStatus: () => getConnectionStatus(),
  setConnectionStatus: (status: ConnectionStatus) => setConnectionStatus(status),
  subscribeToConnectionStatus: (listener: ConnectionStatusListener) => subscribeToConnectionStatus(listener),

  // --- RESET ALL DATA ---
  resetToDefaultSeed: (): void => {
    Object.keys(memoryStorage).forEach((key) => delete memoryStorage[key]);
    initDatabase();
  },
};

export const db = api;
export const mapDatabaseMarks = api.mapDatabaseMarks;
