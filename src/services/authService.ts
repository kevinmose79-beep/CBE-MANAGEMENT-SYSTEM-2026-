import { User as AppUser, Role, AccountStatus, LoginLog, Teacher, Student, canonicalizeRole } from '../types';
import { createSupabaseClient, ensureSupabaseClient, api, syncRealtimeAuth } from '../lib/storage';
import { getKenyaCalendarToday, getKenyaTime } from '../utils/kenyaDateUtils';
import { buildApiUrl } from '../utils/apiConfig';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str.trim());
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface AuthSession {
  user: AppUser;
  token?: string;
  expiresAt?: number;
}

export interface AccountCreationPayload {
  role: Role;
  name: string;
  email: string;
  phone: string;
  tsc_number?: string;
  username?: string;
  status: AccountStatus;
  temporary_password: string;
  force_password_change: boolean;
  allocations?: any[];
  class_teacher_of_id?: string;
}

// Utility to parse browser & device specs from navigator
export function getBrowserDeviceInfo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Server';
  let browser = 'Chrome/Safari Browser';
  if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Safari')) browser = 'Apple Safari';

  let device = 'Desktop Workstation';
  if (/Android/i.test(ua)) device = 'Android Mobile';
  else if (/iPhone|iPad|iPod/i.test(ua)) device = 'iOS Mobile';
  else if (/Macintosh/i.test(ua)) device = 'macOS Desktop';
  else if (/Windows/i.test(ua)) device = 'Windows PC';
  else if (/Linux/i.test(ua)) device = 'Linux Desktop';

  return {
    ip: '192.168.1.104 (Local LAN Proxy)',
    device,
    browser,
  };
}

// Helper to record login history logs
export function recordLoginLog(
  email: string,
  user_name?: string,
  role?: Role,
  user_id?: string,
  status: 'Success' | 'Failed' = 'Success',
  reason?: string
): LoginLog {
  const now = new Date();
  const dateStr = getKenyaCalendarToday(now);
  const timeStr = getKenyaTime(now);
  const devInfo = getBrowserDeviceInfo();

  const log: LoginLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id,
    email: email.trim().toLowerCase(),
    user_name: user_name || email.split('@')[0],
    role: role || 'admin',
    timestamp: now.toISOString(),
    date: dateStr,
    time: timeStr,
    ip_address: devInfo.ip,
    device: devInfo.device,
    browser: devInfo.browser,
    status,
    reason,
  };

  return api.addLoginLog(log);
}

let isExplicitLoginInProgress = false;

// Map Supabase auth user object to our AppUser
export function mapSupabaseUserToAppUser(sbUser: any): AppUser {
  if (!sbUser) {
    throw new Error('No Supabase user provided');
  }
  
  const meta = sbUser.user_metadata || {};
  const email = (sbUser.email || meta.email || '').trim().toLowerCase();

  // Find matching user from storage (synced from public.users)
  const users = api.getUsers();
  const matchedUser = users.find((u) => u.id === sbUser.id || u.email.toLowerCase() === email);
  
  const teachers = api.getTeachers();
  const matchedTeacher = teachers.find((t) => t.email.toLowerCase() === email || t.id === meta.teacher_id);

  // Authoritative role resolution:
  let role: Role;
  const rawMetaRole = (meta.role as string || '').toLowerCase();
  const isLearnerMeta = rawMetaRole === 'learner' || rawMetaRole === 'student' || Boolean(meta.student_id && !meta.teacher_id) || email.endsWith('@learner.cbe.ac.ke');

  if (isLearnerMeta) {
    role = 'learner';
  } else if (matchedUser && matchedUser.role) {
    const rawRole = (matchedUser.role as string).toLowerCase();
    if (rawRole === 'admin') {
      role = 'admin';
    } else if (rawRole === 'learner' || rawRole === 'student') {
      role = 'learner';
    } else if (rawRole === 'subject_teacher') {
      role = 'subject_teacher';
    } else if (rawRole === 'class_teacher') {
      if (matchedTeacher) {
        const hasClass = Boolean(matchedTeacher.is_class_teacher && matchedTeacher.class_teacher_of_id);
        role = hasClass ? 'class_teacher' : 'subject_teacher';
      } else {
        role = 'class_teacher';
      }
    } else if (rawRole === 'teacher') {
      if (rawMetaRole === 'learner' || rawMetaRole === 'student') {
        role = 'learner';
      } else if (rawMetaRole === 'subject_teacher') {
        role = 'subject_teacher';
      } else if (rawMetaRole === 'class_teacher') {
        if (matchedTeacher) {
          const hasClass = Boolean(matchedTeacher.is_class_teacher && matchedTeacher.class_teacher_of_id);
          role = hasClass ? 'class_teacher' : 'subject_teacher';
        } else {
          role = 'class_teacher';
        }
      } else if (matchedTeacher) {
        role = (matchedTeacher.is_class_teacher && Boolean(matchedTeacher.class_teacher_of_id)) ? 'class_teacher' : 'subject_teacher';
      } else {
        role = 'subject_teacher';
      }
    } else {
      role = matchedUser.role as Role;
    }
  } else if (meta.role) {
    if (rawMetaRole === 'admin') {
      role = 'admin';
    } else if (rawMetaRole === 'learner' || rawMetaRole === 'student') {
      role = 'learner';
    } else if (rawMetaRole === 'subject_teacher') {
      role = 'subject_teacher';
    } else if (rawMetaRole === 'class_teacher') {
      if (matchedTeacher) {
        const hasClass = Boolean(matchedTeacher.is_class_teacher && matchedTeacher.class_teacher_of_id);
        role = hasClass ? 'class_teacher' : 'subject_teacher';
      } else {
        role = 'class_teacher';
      }
    } else {
      role = meta.role as Role;
    }
  } else {
    // Safe default if no public.users or metadata role exists (never default to admin)
    if (matchedTeacher) {
      role = (matchedTeacher.is_class_teacher && Boolean(matchedTeacher.class_teacher_of_id)) ? 'class_teacher' : 'subject_teacher';
    } else {
      role = 'class_teacher';
    }
  }

  let name = matchedUser?.name || meta.name || matchedTeacher?.teacher_name || email.split('@')[0];
  let matchedTeacherId = (role === 'admin' || role === 'learner') ? undefined : (matchedUser?.teacher_id || meta.teacher_id || matchedTeacher?.id);
  let matchedStudentId = matchedUser?.student_id || meta.student_id;

  // If role is learner and matchedStudentId is not yet resolved, attempt to match student by admission number from email or metadata
  if (role === 'learner' && !matchedStudentId) {
    const allStudents = api.getStudents();
    const admCandidate = meta.admission_number || (email.includes('@learner.') ? email.split('@')[0] : null);
    if (admCandidate) {
      const cleanAdm = String(admCandidate).trim().toLowerCase();
      const s = allStudents.find((st) => st.admission_number && st.admission_number.trim().toLowerCase() === cleanAdm);
      if (s) {
        matchedStudentId = s.id;
      }
    }
  }

  let status: AccountStatus = matchedUser?.status || matchedTeacher?.status || meta.status || 'Active';
  let forcePasswordChange = matchedUser?.force_password_change ?? matchedTeacher?.force_password_change ?? meta.force_password_change ?? false;

  return {
    id: sbUser.id || matchedUser?.id || generateUUID(),
    name,
    email,
    role,
    teacher_id: matchedTeacherId,
    student_id: matchedStudentId,
    status,
    force_password_change: forcePasswordChange,
    last_login: new Date().toISOString()
  };
}

const SESSION_START_KEY = 'cbe_session_start_timestamp';
const LAST_ACTIVITY_KEY = 'cbe_last_activity_timestamp';

/**
 * Synchronous resolution of Email / TSC Number / Username / Admission Number from local state cache
 */
export function resolveIdentifierToEmail(identifier: string): { email: string; teacher?: Teacher; user?: AppUser; student?: Student; inactive?: boolean; error?: string } | null {
  if (!identifier) return null;
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const allTeachers = api.getTeachers();
  const allUsers = api.getUsers();

  // If it's already in email format
  if (trimmed.includes('@')) {
    const cleanEmail = trimmed.toLowerCase();
    const matchedTeacher = allTeachers.find((t) => t.email && t.email.toLowerCase() === cleanEmail);
    const matchedUser = allUsers.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    return { email: cleanEmail, teacher: matchedTeacher, user: matchedUser };
  }

  const normalizedInput = trimmed.toLowerCase();
  const alphanumericOnly = normalizedInput.replace(/[^a-z0-9]/g, '');

  // 1. Match by TSC Number (e.g., "TSC-123456", "123456", "TSC123456")
  const teacherByTsc = allTeachers.find((t) => {
    if (!t.tsc_number) return false;
    const cleanTsc = t.tsc_number.trim().toLowerCase();
    const alphanumericTsc = cleanTsc.replace(/[^a-z0-9]/g, '');
    return (
      cleanTsc === normalizedInput ||
      alphanumericTsc === alphanumericOnly ||
      (alphanumericOnly.length >= 4 &&
        (cleanTsc.endsWith(alphanumericOnly) || alphanumericTsc.endsWith(alphanumericOnly)))
    );
  });

  if (teacherByTsc && teacherByTsc.email) {
    const matchedUser = allUsers.find((u) => u.email && u.email.toLowerCase() === teacherByTsc.email.toLowerCase());
    return { email: teacherByTsc.email.toLowerCase(), teacher: teacherByTsc, user: matchedUser };
  }

  // 2. Match by Username (e.g. "gwanjiku", "admin")
  const teacherByUsername = allTeachers.find((t) => t.username && t.username.trim().toLowerCase() === normalizedInput);
  if (teacherByUsername && teacherByUsername.email) {
    const matchedUser = allUsers.find((u) => u.email && u.email.toLowerCase() === teacherByUsername.email.toLowerCase());
    return { email: teacherByUsername.email.toLowerCase(), teacher: teacherByUsername, user: matchedUser };
  }

  const userByUsername = allUsers.find((u) => u.username && u.username.trim().toLowerCase() === normalizedInput);
  if (userByUsername && userByUsername.email) {
    const matchedTeacher = allTeachers.find((t) => t.email && t.email.toLowerCase() === userByUsername.email.toLowerCase());
    return { email: userByUsername.email.toLowerCase(), teacher: matchedTeacher, user: userByUsername };
  }

  // 3. Match by Phone number
  if (alphanumericOnly.length >= 6) {
    const teacherByPhone = allTeachers.find((t) => {
      if (!t.phone) return false;
      const cleanPhone = t.phone.replace(/[^0-9]/g, '');
      return cleanPhone && (cleanPhone === alphanumericOnly || cleanPhone.endsWith(alphanumericOnly));
    });
    if (teacherByPhone && teacherByPhone.email) {
      const matchedUser = allUsers.find((u) => u.email && u.email.toLowerCase() === teacherByPhone.email.toLowerCase());
      return { email: teacherByPhone.email.toLowerCase(), teacher: teacherByPhone, user: matchedUser };
    }
  }

  // 4. Match by Student Admission Number (e.g., "ADM-2024-001", "adm-2024-001")
  const allStudents = api.getStudents();
  const matchedStudent = allStudents.find((s) => {
    if (!s.admission_number) return false;
    const cleanAdm = s.admission_number.trim().toLowerCase();
    const alphanumericAdm = cleanAdm.replace(/[^a-z0-9]/g, '');
    return (
      cleanAdm === normalizedInput ||
      alphanumericAdm === alphanumericOnly
    );
  });

  if (matchedStudent) {
    // Locate the matching learner profile in allUsers
    const matchedUser = allUsers.find((u) => {
      if (!u.student_id) return false;
      const matchesStudentId =
        u.student_id === matchedStudent.id ||
        u.student_id.toLowerCase() === matchedStudent.id.toLowerCase();
      const isLearner = u.role === 'learner';
      return matchesStudentId && isLearner;
    });

    if (matchedStudent.enrolment_status === 'future') {
      return {
        email: matchedUser?.email ? matchedUser.email.toLowerCase() : '',
        user: matchedUser,
        student: matchedStudent,
        inactive: true,
        error: 'This learner account is registered for future intake and has not yet been activated. Please contact school administration.'
      };
    }

    if (matchedStudent.active === false || matchedStudent.enrolment_status === 'inactive' || matchedUser?.status === 'Disabled') {
      return {
        email: matchedUser?.email ? matchedUser.email.toLowerCase() : '',
        user: matchedUser,
        student: matchedStudent,
        inactive: true,
        error: 'This learner account is inactive or transferred. Please contact school administration.'
      };
    }

    if (matchedUser && matchedUser.email) {
      return {
        email: matchedUser.email.toLowerCase(),
        user: matchedUser,
        student: matchedStudent,
      };
    }
  }

  return null;
}

/**
 * Asynchronous resolution of Email / TSC Number / Username / Admission Number, querying API and Supabase if not in cache
 */
export async function resolveIdentifierToEmailAsync(
  identifier: string
): Promise<{ email: string; teacher?: Teacher; user?: AppUser; student?: Student; inactive?: boolean; error?: string } | null> {
  const localMatch = resolveIdentifierToEmail(identifier);
  if (localMatch) return localMatch;

  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return { email: trimmed.toLowerCase() };
  }

  // 1. Try server-side resolver endpoint
  try {
    const resolveEndpoint = typeof window !== 'undefined'
      ? buildApiUrl('/api/auth/resolve-identifier')
      : buildApiUrl('/api/auth/resolve-identifier') || 'http://localhost:3000/api/auth/resolve-identifier';

    const res = await fetch(resolveEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: trimmed })
    });
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      return {
        email: '',
        inactive: true,
        error: data.error || 'This learner account is inactive or transferred. Please contact school administration.'
      };
    }
    if (res.ok) {
      const data = await res.json();
      if (data && data.email) {
        return data;
      }
    }
  } catch (apiErr) {
    // Expected in test environments without running dev server or offline; fallback follows
  }

  let client = createSupabaseClient();
  if (!client) {
    client = await ensureSupabaseClient();
  }
  if (!client) return null;

  try {
    const alphanumeric = trimmed.replace(/[^a-z0-9]/gi, '');

    // 2. Query teachers table in Supabase
    const { data: dbTeachers } = await client
      .from('teachers')
      .select('*')
      .or(`tsc_number.ilike.%${trimmed}%,tsc_number.ilike.%${alphanumeric}%,username.ilike.${trimmed}`)
      .limit(1);

    if (dbTeachers && dbTeachers.length > 0 && dbTeachers[0].email) {
      return { email: dbTeachers[0].email.toLowerCase(), teacher: dbTeachers[0] };
    }

    // 3. Query users table in Supabase
    const { data: dbUsers } = await client
      .from('users')
      .select('*')
      .or(`email.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
      .limit(1);

    if (dbUsers && dbUsers.length > 0 && dbUsers[0].email) {
      return { email: dbUsers[0].email.toLowerCase(), user: dbUsers[0] };
    }

    // 4. Query students table in Supabase for matching admission number
    const { data: dbStudents } = await client
      .from('students')
      .select('*')
      .or(`admission_number.ilike.${trimmed},admission_number.ilike.%${alphanumeric}%`)
      .limit(1);

    if (dbStudents && dbStudents.length > 0) {
      const dbStudent = dbStudents[0];
      if (dbStudent.enrolment_status === 'future') {
        return {
          email: '',
          student: dbStudent,
          inactive: true,
          error: 'This learner account is registered for future intake and has not yet been activated. Please contact school administration.'
        };
      }

      if (dbStudent.active === false || dbStudent.enrolment_status === 'inactive') {
        return {
          email: '',
          student: dbStudent,
          inactive: true,
          error: 'This learner account is inactive or transferred. Please contact school administration.'
        };
      }

      const { data: dbLearnerUsers } = await client
        .from('users')
        .select('*')
        .eq('student_id', dbStudent.id)
        .limit(1);

      if (dbLearnerUsers && dbLearnerUsers.length > 0) {
        const dbLearnerUser = dbLearnerUsers[0];
        if (dbLearnerUser.status === 'Disabled') {
          return {
            email: '',
            user: dbLearnerUser,
            student: dbStudent,
            inactive: true,
            error: 'This learner account is inactive or transferred. Please contact school administration.'
          };
        }
        if (dbLearnerUser.email) {
          return {
            email: dbLearnerUser.email.toLowerCase(),
            user: dbLearnerUser,
            student: dbStudent,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Async identifier lookup fallback error:', err);
  }

  return null;
}

export const authService = {
  /**
   * Record the start timestamp of the current authenticated session (8-hour clock)
   */
  recordSessionStart(timestamp: number = Date.now()): void {
    try {
      localStorage.setItem(SESSION_START_KEY, timestamp.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  },

  /**
   * Get the start timestamp of the current authenticated session (8-hour clock)
   */
  getSessionStartTime(): number {
    try {
      const stored = localStorage.getItem(SESSION_START_KEY);
      if (stored) {
        const val = parseInt(stored, 10);
        const now = Date.now();
        if (!isNaN(val) && val > 0) {
          // Clamp future timestamps to current time
          if (val > now) {
            this.recordSessionStart(now);
            return now;
          }
          return val;
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    const now = Date.now();
    this.recordSessionStart(now);
    return now;
  },

  /**
   * Clear the session start timestamp on logout
   */
  clearSessionStart(): void {
    try {
      localStorage.removeItem(SESSION_START_KEY);
    } catch (e) {
      // Ignore localStorage errors
    }
  },

  /**
   * Record the last user interaction timestamp (30-minute inactivity clock)
   */
  recordLastActivity(timestamp: number = Date.now()): void {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, timestamp.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  },

  /**
   * Get the last user interaction timestamp (30-minute inactivity clock)
   */
  getLastActivityTime(): number {
    try {
      const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (stored) {
        const val = parseInt(stored, 10);
        const now = Date.now();
        if (!isNaN(val) && val > 0) {
          // Clamp future timestamps to current time
          if (val > now) {
            this.recordLastActivity(now);
            return now;
          }
          return val;
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    const now = Date.now();
    this.recordLastActivity(now);
    return now;
  },

  /**
   * Clear the last activity timestamp on logout
   */
  clearLastActivity(): void {
    try {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch (e) {
      // Ignore localStorage errors
    }
  },

  /**
   * Get current Supabase Auth Session
   */
  async getSession(): Promise<AppUser | null> {
    let client = createSupabaseClient();
    if (!client) {
      client = await ensureSupabaseClient();
    }
    if (client) {
      try {
        // 1. Verify Supabase Auth session FIRST before making database queries
        const { data, error } = await client.auth.getSession();
        if (error || !data?.session?.user) {
          return null;
        }

        syncRealtimeAuth(data.session.access_token);

        // 2. Auth session is valid — now fetch users from database with authenticated JWT
        const { data: dbUsers } = await client.from('users').select('*');
        if (dbUsers && dbUsers.length > 0) {
          (api as any).syncUsersFromDatabase(dbUsers);
        }

        return mapSupabaseUserToAppUser(data.session.user);
      } catch (err) {
        console.warn('getSession error', err);
      }
    }
    return null;
  },

  /**
   * Sign In using email or TSC Number/identifier and password
   */
  async signIn(
    identifier: string,
    password: string,
    roleHint?: Role,
    metadataHint?: { name?: string; teacher_id?: string; student_id?: string; isReauthentication?: boolean }
  ): Promise<{ user: AppUser | null; error: string | null }> {
    const rawInput = (identifier || '').trim();
    if (!rawInput) {
      return { user: null, error: 'Please enter your email address, TSC number, or admission number.' };
    }

    // 1. Resolve identifier to registered email and matched teacher/user records
    const resolved = await resolveIdentifierToEmailAsync(rawInput);
    if (resolved && (resolved as any).inactive) {
      const inactiveMsg = (resolved as any).error || 'This learner account is inactive or transferred. Please contact school administration.';
      recordLoginLog(
        resolved.email || rawInput,
        resolved.student?.full_name || resolved.user?.name,
        'learner',
        resolved.user?.id,
        'Failed',
        inactiveMsg
      );
      return {
        user: null,
        error: inactiveMsg,
      };
    }

    if (!resolved || !resolved.email) {
      const isLikelyIdentifier = !rawInput.includes('@');
      const errorMsg = isLikelyIdentifier
        ? `No active account found matching "${rawInput}". Please verify your Email, TSC Number, or Admission Number.`
        : 'Invalid login credentials. Please verify your email and password.';
      return {
        user: null,
        error: errorMsg,
      };
    }

    let client = createSupabaseClient();
    if (!client) {
      client = await ensureSupabaseClient();
    }
    const targetEmail = resolved.email.toLowerCase();

    // 2. Check local Account Status first (Disabled / Locked check)
    const allUsers = api.getUsers();
    const allTeachers = api.getTeachers();
    const allStudents = api.getStudents();
    const existingUser = resolved.user || allUsers.find((u) => u.email.toLowerCase() === targetEmail);
    const existingTeacher = resolved.teacher || allTeachers.find((t) => t.email.toLowerCase() === targetEmail);
    const linkedStudent = resolved.student || (existingUser?.student_id ? allStudents.find((s) => s.id === existingUser.student_id) : undefined);

    // Gating for Inactive / Transferred Learner (by linked student or learner status)
    if (existingUser?.role === 'learner' || linkedStudent) {
      if (linkedStudent?.active === false || existingUser?.status === 'Disabled') {
        const inactiveMsg = 'This learner account is inactive or transferred. Please contact school administration.';
        recordLoginLog(
          targetEmail,
          existingUser?.name || linkedStudent?.full_name,
          'learner',
          existingUser?.id,
          'Failed',
          inactiveMsg
        );
        return {
          user: null,
          error: inactiveMsg,
        };
      }
    }

    const accountStatus: AccountStatus =
      existingUser?.status || existingTeacher?.status || 'Active';

    if (accountStatus === 'Disabled') {
      recordLoginLog(
        targetEmail,
        existingUser?.name || existingTeacher?.teacher_name,
        existingUser?.role || (existingTeacher ? (existingTeacher.is_class_teacher ? 'class_teacher' : 'subject_teacher') : undefined),
        existingUser?.id,
        'Failed',
        'Your account has been disabled. Please contact the administrator.'
      );
      return {
        user: null,
        error: 'Your account has been disabled. Please contact the administrator.',
      };
    }

    if (accountStatus === 'Locked') {
      recordLoginLog(
        targetEmail,
        existingUser?.name || existingTeacher?.teacher_name,
        existingUser?.role || (existingTeacher ? (existingTeacher.is_class_teacher ? 'class_teacher' : 'subject_teacher') : undefined),
        existingUser?.id,
        'Failed',
        'Your account has been locked. Please contact the administrator.'
      );
      return {
        user: null,
        error: 'Your account has been locked. Please contact the administrator.',
      };
    }

    // Determine target role & metadata for logging in case of pre-auth failure (never default unknown to admin)
    let targetRole: Role | undefined = existingUser?.role || (existingTeacher ? (existingTeacher.is_class_teacher ? 'class_teacher' : 'subject_teacher') : undefined);
    let targetName = metadataHint?.name || existingUser?.name || existingTeacher?.teacher_name || 'User';
    let targetTeacherId = metadataHint?.teacher_id || existingUser?.teacher_id || existingTeacher?.id;
    let targetStudentId = metadataHint?.student_id || existingUser?.student_id;

    if (targetEmail.includes('admin') && !existingUser) {
      targetRole = 'admin';
      targetName = 'Administrator';
    } else if (targetEmail.includes('grace') && !existingTeacher) {
      targetRole = 'class_teacher';
      targetName = 'Madam Grace Wanjiku';
      targetTeacherId = existingTeacher?.id;
    } else if (targetEmail.includes('david') && !existingTeacher) {
      targetRole = 'subject_teacher';
      targetName = 'Mr. David Otieno';
      targetTeacherId = existingTeacher?.id;
    }

    const forcePasswordChange =
      existingUser?.force_password_change ?? existingTeacher?.force_password_change ?? false;
      
    const lastLoginIso = new Date().toISOString();

    if (!client) {
      recordLoginLog(
        targetEmail,
        targetName,
        targetRole,
        undefined,
        'Failed',
        'Database authentication service is unavailable.'
      );
      return {
        user: null,
        error: 'Database authentication service is unavailable.',
      };
    }

    isExplicitLoginInProgress = true;
    try {
      // Attempt Supabase Auth Sign In
      const signInRes = await client.auth.signInWithPassword({
        email: targetEmail,
        password: password,
      });

      const data = signInRes.data;
      const error = signInRes.error;

      if (error) {
        recordLoginLog(targetEmail, targetName, targetRole, undefined, 'Failed', error.message);
        return { user: null, error: error.message };
      }

      if (data?.session?.user) {
        syncRealtimeAuth(data.session.access_token);

        // Sync public.users to update local cache with authoritative user records
        const { data: dbUsers } = await client.from('users').select('*');
        if (dbUsers && dbUsers.length > 0) {
          (api as any).syncUsersFromDatabase(dbUsers);
        }

        const appUser = mapSupabaseUserToAppUser(data.session.user);
        appUser.status = accountStatus;
        appUser.last_login = lastLoginIso;

        // Persist last_login directly to public.users in Supabase
        try {
          if (appUser.id) {
            await client.from('users').update({ last_login: lastLoginIso }).eq('id', appUser.id);
          }
          if (appUser.email) {
            await client.from('users').update({ last_login: lastLoginIso }).eq('email', appUser.email.toLowerCase());
          }
        } catch (syncErr) {
          console.warn('Could not persist last_login to Supabase public.users:', syncErr);
        }

        // Sync metadata to user & teacher
        if (existingTeacher) {
          const { allocations: _ignoredAllocations, ...teacherWithoutAllocs } = existingTeacher;
          api.updateTeacher({ ...teacherWithoutAllocs, last_login: lastLoginIso }).catch((err) => {
            console.warn('Background teacher last_login sync failed:', err);
          });
        }
        if (existingUser) {
          api.updateUser({ ...existingUser, last_login: lastLoginIso });
        } else {
          api.updateUser(appUser);
        }
        
        recordLoginLog(appUser.email, appUser.name, appUser.role, appUser.id, 'Success');
        if (!metadataHint?.isReauthentication) {
          this.recordSessionStart(Date.now());
        }
        this.recordLastActivity(Date.now());
        api.setCurrentUser(appUser);

        return { user: appUser, error: null };
      }

      recordLoginLog(targetEmail, targetName, targetRole, undefined, 'Failed', 'Authentication failed.');
      return { user: null, error: 'Authentication failed.' };
    } catch (err: any) {
      console.error('Supabase Auth error:', err);
      const errMsg = err?.message || 'Authentication error occurred.';
      recordLoginLog(targetEmail, targetName, targetRole, undefined, 'Failed', errMsg);
      return { user: null, error: errMsg };
    } finally {
      isExplicitLoginInProgress = false;
    }
  },

  /**
   * Re-authenticate user during an inactivity unlock without restarting the 8-hour session clock
   */
  async reauthenticate(
    email: string,
    password: string,
    roleHint?: Role
  ): Promise<{ user: AppUser | null; error: string | null }> {
    return this.signIn(email, password, roleHint, { isReauthentication: true });
  },

  /**
   * Change User Password via Supabase Auth & clear force_password_change flag
   */
  async changePassword(
    currentPass: string,
    newPass: string,
    currentUser: AppUser
  ): Promise<{ success: boolean; error: string | null }> {
    const client = createSupabaseClient();
    if (client) {
      try {
        const { error } = await client.auth.updateUser({
          password: newPass,
          data: { force_password_change: false },
        });
        if (error) {
          console.warn('Supabase updateUser password error:', error.message);
          return { success: false, error: error.message };
        }

        // Persist force_password_change: false in public.users and public.teachers
        if (currentUser.id) {
          try {
            await client.from('users').update({ force_password_change: false }).eq('id', currentUser.id);
          } catch (e) {
            console.warn('Failed updating users table by id in Supabase:', e);
          }
        }
        if (currentUser.email) {
          try {
            await client.from('users').update({ force_password_change: false }).eq('email', currentUser.email.toLowerCase());
          } catch (e) {
            console.warn('Failed updating users table by email in Supabase:', e);
          }
          try {
            await client.from('teachers').update({ force_password_change: false }).eq('email', currentUser.email.toLowerCase());
          } catch (e) {
            console.warn('Failed updating teachers table by email in Supabase:', e);
          }
        }
      } catch (err: any) {
        console.error('Failed updating password via Supabase Auth:', err);
        return { success: false, error: err?.message || 'An error occurred while updating password.' };
      }
    }

    // Clear force_password_change flag in local store & user session
    const updatedUser: AppUser = {
      ...currentUser,
      force_password_change: false,
    };

    api.updateUser(updatedUser);

    if (currentUser.teacher_id) {
      const teachers = api.getTeachers();
      const tch = teachers.find((t) => t.id === currentUser.teacher_id || t.email.toLowerCase() === currentUser.email.toLowerCase());
      if (tch) {
        const { allocations: _ignoredAllocations, ...teacherWithoutAllocs } = tch;
        api.updateTeacher({ ...teacherWithoutAllocs, force_password_change: false }).catch((err) => {
          console.warn('Background teacher force_password_change sync failed:', err);
        });
      }
    }

    api.setCurrentUser(updatedUser);

    return { success: true, error: null };
  },

  /**
   * Administrator-Created Account (Teacher, Admin, Student)
   */
  async adminCreateAccount(
    payload: AccountCreationPayload
  ): Promise<{ user: AppUser; teacher?: Teacher; error: string | null }> {
    try {
      const currentUser = api.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        return { user: null as any, error: 'Unauthorized: Only administrators can create accounts.' };
      }

      const canonicalRole = canonicalizeRole(payload.role);

      let data: any = null;
      let isJsonResponse = false;
      const client = createSupabaseClient();

      try {
        let accessToken: string | undefined;
        if (client) {
          try {
            const { data: sessionData } = await client.auth.getSession();
            accessToken = sessionData?.session?.access_token;
          } catch (e) {
            console.warn('Could not fetch session token for create-teacher request:', e);
          }
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(buildApiUrl('/api/admin/create-teacher'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...payload,
            role: canonicalRole,
            token: accessToken,
            adminId: currentUser.id,
            is_class_teacher: canonicalRole === 'class_teacher',
            name: payload.name.trim(),
            email: payload.email.trim().toLowerCase(),
            phone: payload.phone.trim(),
            tsc_number: payload.tsc_number?.trim(),
            username: (payload.username || payload.email.split('@')[0]).trim().toLowerCase()
          }),
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
          isJsonResponse = true;
        } else {
          const text = await response.text();
          console.warn('Server create-teacher returned non-JSON response:', response.status, text.slice(0, 150));
        }

        if (response.ok && isJsonResponse && data?.user) {
          const newTeacher: Teacher = {
            ...data.teacher,
            allocations: payload.allocations || []
          };
          api.addTeacher(newTeacher, data.user.id);
          api.addUser(data.user);
          return { user: data.user, teacher: newTeacher, error: null };
        }

        if (isJsonResponse && data?.error) {
          return { user: null as any, error: data.error };
        }

        if (!response.ok) {
          return { user: null as any, error: `Server error (${response.status}): Could not create teacher account in Supabase Auth.` };
        }
      } catch (fetchErr: any) {
        console.error('API call to /api/admin/create-teacher failed:', fetchErr);
        return { user: null as any, error: `Failed to create teacher account in Supabase Auth: ${fetchErr?.message || 'Network or server error.'}` };
      }

      return { user: null as any, error: 'Failed to create teacher account in Supabase Auth.' };
    } catch (err: any) {
      console.error('Exception in adminCreateAccount:', err);
      return { user: null as any, error: 'Internal error creating account.' };
    }
  },

  /**
   * Admin Provision Learner Account in Supabase Auth & Database (Phase 6D)
   */
  async adminCreateLearner(
    studentInput: Partial<Student> & { first_name?: string; last_name?: string; second_name?: string; admission_number: string },
    password?: string
  ): Promise<{ student: Student | null; credentials: { admission_number: string; email: string; initial_password: string } | null; error: string | null }> {
    try {
      const currentUser = api.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        return { student: null, credentials: null, error: 'Unauthorized: Only administrators can provision learner accounts.' };
      }

      const client = createSupabaseClient();
      let accessToken: string | undefined;
      if (client) {
        try {
          const { data: sessionData } = await client.auth.getSession();
          accessToken = sessionData?.session?.access_token;
        } catch (e) {
          console.warn('Could not fetch session token for create-learner request:', e);
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(buildApiUrl('/api/admin/create-learner'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          student: studentInput,
          password: password || undefined,
          token: accessToken,
        }),
      });

      let data: any = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }

      if (response.ok && data?.success && data?.student) {
        // Cache created student locally
        api.addStudent(data.student);
        return {
          student: data.student,
          credentials: data.credentials || null,
          error: null
        };
      }

      if (data?.error) {
        return { student: null, credentials: null, error: data.error };
      }

      return { student: null, credentials: null, error: `Server error (${response.status}): Could not create learner account.` };
    } catch (err: any) {
      console.error('Exception in adminCreateLearner:', err);
      return { student: null, credentials: null, error: `Failed to provision learner account: ${err?.message || 'Network or server error.'}` };
    }
  },

  /**
   * Admin Delete Teacher Account & Associated Data
   */
  async adminDeleteTeacher(teacherId: string, email?: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const currentUser = api.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Unauthorized: Only administrators can delete teacher accounts.' };
      }

      const client = createSupabaseClient();
      let accessToken: string | undefined;
      if (client) {
        try {
          const { data: sessionData } = await client.auth.getSession();
          accessToken = sessionData?.session?.access_token;
        } catch (e) {
          console.warn('Could not fetch session token for delete-teacher request:', e);
        }
      }

      // Server API deletion request (sole authoritative deletion route)
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

        const response = await fetch(buildApiUrl('/api/admin/delete-teacher'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            teacherId,
            email,
            token: accessToken,
            adminId: currentUser.id,
          }),
        });

        const contentType = response.headers.get('content-type') || '';
        let data: any = null;

        if (contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch (jsonErr: any) {
            console.error('Failed to parse response JSON from delete-teacher API:', jsonErr);
            return {
              success: false,
              error: 'Failed to parse server response as JSON from /api/admin/delete-teacher.',
            };
          }
        } else {
          // Response is non-JSON (e.g. HTML from SPA fallback / proxy routing)
          const responseText = await response.text().catch(() => '');
          console.warn('Received non-JSON response from /api/admin/delete-teacher:', {
            status: response.status,
            contentType,
            snippet: responseText.slice(0, 150),
          });
          return {
            success: false,
            error: `Unexpected server response: the teacher deletion API returned a non-JSON response (${contentType || 'unknown format'}).`,
          };
        }

        if (response.ok && data?.success === true) {
          console.info('Server successfully deleted teacher:', teacherId);
          // Only update UI memory state after server deletion confirmed
          await api.deleteTeacher(teacherId, { alreadyDeletedOnServer: true });
          return { success: true, error: null };
        }

        if (response.ok && data?.success !== true) {
          const errMsg = data?.error || 'The teacher deletion API returned an incomplete response (missing success confirmation).';
          return { success: false, error: errMsg };
        }

        const errMsg = data?.error || `Server error (${response.status}): ${response.statusText || 'Could not delete teacher.'}`;
        return { success: false, error: errMsg };
      } catch (fetchErr: any) {
        console.error('API call to /api/admin/delete-teacher failed:', fetchErr);
        
        // Direct Supabase database fallback if server fetch is unreachable (e.g. APK offline or remote server disconnect)
        if (client) {
          try {
            console.warn('Attempting direct Supabase deletion for teacher:', teacherId);
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId);
            
            const { error: strErr } = await client.from('streams').update({ class_teacher_id: null }).eq('class_teacher_id', teacherId);
            const { error: tsErr } = await client.from('teacher_subjects').delete().eq('teacher_id', teacherId);
            
            let deleteErr = strErr || tsErr || null;
            if (isUUID && !deleteErr) {
              const { error } = await client.from('teachers').delete().eq('id', teacherId);
              deleteErr = error;
            }
            if (email && !deleteErr) {
              const { error } = await client.from('teachers').delete().ilike('email', email.trim());
              deleteErr = error;
            }

            if (isUUID && !deleteErr) {
              const { error: uErr } = await client.from('users').delete().eq('teacher_id', teacherId);
              if (uErr) deleteErr = uErr;
            }
            if (email && !deleteErr) {
              const { error: uEmailErr } = await client.from('users').delete().ilike('email', email.trim());
              if (uEmailErr) deleteErr = uEmailErr;
            }

            if (!deleteErr) {
              await api.deleteTeacher(teacherId, { alreadyDeletedOnServer: true });
              return { success: true, error: null };
            } else {
              return { success: false, error: `Direct Supabase deletion failed: ${deleteErr.message}` };
            }
          } catch (dbErr: any) {
            console.error('Direct Supabase deletion fallback error:', dbErr);
          }
        }

        return { success: false, error: `Could not reach server to delete teacher (${fetchErr?.message || 'Failed to fetch'}). Please check network or backend connection.` };
      }
    } catch (err: any) {
      console.error('Exception in adminDeleteTeacher:', err);
      return { success: false, error: err.message || 'Error deleting teacher account.' };
    }
  },

  /**
   * Admin Reset Password for a User/Teacher
   */
  async adminResetPassword(
    emailOrUserId: string,
    newTempPassword: string,
    forcePasswordChange: boolean = true,
    adminUser?: AppUser | null
  ): Promise<{ success: boolean; error: string | null }> {
    const caller = adminUser || api.getCurrentUser();
    if (!caller || caller.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Only administrators can reset user passwords.' };
    }

    const cleanTarget = emailOrUserId.trim().toLowerCase();

    const client = createSupabaseClient();
    let accessToken: string | undefined;
    if (client) {
      try {
        const { data: sessionData } = await client.auth.getSession();
        accessToken = sessionData?.session?.access_token;
      } catch (e) {
        console.warn('Could not fetch session token for reset-password request:', e);
      }
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const response = await fetch(buildApiUrl('/api/admin/reset-password'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          emailOrUserId: cleanTarget,
          email: cleanTarget,
          newPassword: newTempPassword,
          forcePasswordChange,
          token: accessToken,
          adminId: caller.id,
        }),
      });

      const contentType = response.headers.get('content-type');
      let data: any = null;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }

      if (!response.ok || !data?.success) {
        const errMsg = data?.error || `Server error (${response.status}): Could not reset password in Supabase Auth.`;
        return { success: false, error: errMsg };
      }

      // Success confirmed by Supabase Auth! Update local React memory state for force_password_change (no plain text password)
      const users = api.getUsers();
      const user = users.find((u) => u.id === emailOrUserId || u.email.toLowerCase() === cleanTarget);
      if (user) {
        api.updateUser({
          ...user,
          force_password_change: forcePasswordChange,
        });
      }

      const teachers = api.getTeachers();
      const teacher = teachers.find((t) => t.id === emailOrUserId || t.email.toLowerCase() === cleanTarget);
      if (teacher) {
        const { allocations: _ignoredAllocations, ...teacherWithoutAllocs } = teacher;
        api.updateTeacher({
          ...teacherWithoutAllocs,
          force_password_change: forcePasswordChange,
        }).catch((err) => {
          console.warn('Background teacher force_password_change update error:', err);
        });
      }

      // Write Audit Log Record
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8);
      const adminName = caller?.name || 'Administrator';
      const targetName = teacher?.teacher_name || user?.name || cleanTarget;

      const auditLog: LoginLog = {
        id: `log_pwd_reset_${Date.now()}`,
        user_id: caller?.id || 'admin',
        email: caller?.email || 'admin@school.ac.ke',
        user_name: adminName,
        role: caller?.role || 'admin',
        timestamp: now.toISOString(),
        date: dateStr,
        time: timeStr,
        ip_address: '127.0.0.1 (Internal System)',
        device: 'Web Client',
        browser: 'Secure Admin Console',
        status: 'Success',
        reason: `ADMINISTRATOR PASSWORD RESET: Reset password for ${targetName} (${cleanTarget}) | Performed By: ${adminName}`,
      };

      api.addLoginLog(auditLog);

      return { success: true, error: null };
    } catch (fetchErr: any) {
      console.error('API call to /api/admin/reset-password failed:', fetchErr);
      return { success: false, error: `Failed to reset password: ${fetchErr?.message || 'Network error.'}` };
    }
  },

  /**
   * Update Account Status (Active, Disabled, Locked)
   */
  adminUpdateAccountStatus(
    emailOrUserId: string,
    status: AccountStatus
  ): void {
    const caller = api.getCurrentUser();
    if (!caller || caller.role !== 'admin') {
      console.warn('Unauthorized attempt to update account status');
      return;
    }

    const cleanTarget = emailOrUserId.trim().toLowerCase();
    const users = api.getUsers();
    const user = users.find((u) => u.id === emailOrUserId || u.email.toLowerCase() === cleanTarget);
    if (user) {
      api.updateUser({ ...user, status });
    }

    const teachers = api.getTeachers();
    const teacher = teachers.find(
      (t) => t.id === emailOrUserId || t.email.toLowerCase() === cleanTarget
    );
    if (teacher) {
      const { allocations: _ignoredAllocations, ...teacherWithoutAllocs } = teacher;
      api.updateTeacher({ ...teacherWithoutAllocs, status }).catch((err) => {
        console.warn('Background teacher status update error:', err);
      });
    }
  },

  /**
   * Log out user from Supabase Auth and clear local session
   */
  async signOut(): Promise<void> {
    this.clearSessionStart();
    this.clearLastActivity();
    const client = createSupabaseClient();
    if (client) {
      try {
        syncRealtimeAuth('');
        await client.auth.signOut();
      } catch (err) {
        console.warn('Error during Supabase auth signOut:', err);
      }
    }

    api.setCurrentUser(null);
  },

  /**
   * Listen to Supabase Auth state changes
   */
  onAuthStateChange(callback: (user: AppUser | null) => void) {
    const client = createSupabaseClient();
    if (client) {
      const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
          syncRealtimeAuth(session?.access_token);
          // If explicit login is running via authService.signIn, ignore global SIGNED_IN event.
          // authService.signIn will validate roleHint and handle session state explicitly.
          if (isExplicitLoginInProgress) {
            return;
          }
          if (session?.user) {
            const { data: dbUsers } = await client.from('users').select('*');
            if (dbUsers && dbUsers.length > 0) {
              (api as any).syncUsersFromDatabase(dbUsers);
            }
            const appUser = mapSupabaseUserToAppUser(session.user);
            api.setCurrentUser(appUser);
            callback(appUser);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          syncRealtimeAuth(session?.access_token);
          if (session?.user) {
            const { data: dbUsers } = await client.from('users').select('*');
            if (dbUsers && dbUsers.length > 0) {
              (api as any).syncUsersFromDatabase(dbUsers);
            }
            const appUser = mapSupabaseUserToAppUser(session.user);
            api.setCurrentUser(appUser);
            callback(appUser);
          }
        } else if (event === 'SIGNED_OUT') {
          syncRealtimeAuth('');
          api.setCurrentUser(null);
          callback(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
    return () => {};
  },
};
