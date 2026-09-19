export type Role = 'admin' | 'class_teacher' | 'subject_teacher' | 'learner';

export function canonicalizeRole(roleInput: string | null | undefined): Role {
  if (!roleInput || typeof roleInput !== 'string') return 'class_teacher';
  const cleaned = roleInput.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (cleaned === 'admin' || cleaned === 'administrator') return 'admin';
  if (cleaned === 'class_teacher' || cleaned === 'classteacher' || cleaned === 'class') return 'class_teacher';
  if (cleaned === 'subject_teacher' || cleaned === 'subjectteacher' || cleaned === 'subject') return 'subject_teacher';
  if (cleaned === 'learner' || cleaned === 'student') return 'learner';
  return 'class_teacher';
}

export type EducationLevel = 'Pre-Primary' | 'Lower Primary' | 'Upper Primary' | 'Junior School';

export type GradeName =
  | 'PP1'
  | 'PP2'
  | 'Grade 1'
  | 'Grade 2'
  | 'Grade 3'
  | 'Grade 4'
  | 'Grade 5'
  | 'Grade 6'
  | 'Grade 7'
  | 'Grade 8'
  | 'Grade 9';

export const ALL_EDUCATION_LEVELS: EducationLevel[] = [
  'Pre-Primary',
  'Lower Primary',
  'Upper Primary',
  'Junior School',
];

export const ALL_GRADES: GradeName[] = [
  'PP1',
  'PP2',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
];

export const LEVEL_TO_GRADES: Record<EducationLevel, GradeName[]> = {
  'Pre-Primary': ['PP1', 'PP2'],
  'Lower Primary': ['Grade 1', 'Grade 2', 'Grade 3'],
  'Upper Primary': ['Grade 4', 'Grade 5', 'Grade 6'],
  'Junior School': ['Grade 7', 'Grade 8', 'Grade 9'],
};

export function normalizeGradeName(input: string | undefined | null): GradeName {
  if (!input) return 'Grade 7';
  const str = String(input).trim();

  if (ALL_GRADES.includes(str as GradeName)) {
    return str as GradeName;
  }

  if (/^pp\s*1|^pre-?primary\s*1/i.test(str)) return 'PP1';
  if (/^pp\s*2|^pre-?primary\s*2/i.test(str)) return 'PP2';

  const match = str.match(/(?:cls_|grade\s*|g\s*)?([1-9])/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 9) {
      return `Grade ${num}` as GradeName;
    }
  }

  return 'Grade 7';
}

export function getEducationLevelForGrade(grade: string): EducationLevel {
  const norm = normalizeGradeName(grade);
  if (norm === 'PP1' || norm === 'PP2') return 'Pre-Primary';
  if (norm === 'Grade 1' || norm === 'Grade 2' || norm === 'Grade 3') return 'Lower Primary';
  if (norm === 'Grade 4' || norm === 'Grade 5' || norm === 'Grade 6') return 'Upper Primary';
  return 'Junior School';
}

export const GRADE_ORDER_MAP: Record<string, number> = {
  'PP1': 0,
  'Pre-Primary 1': 0,
  'PP 1': 0,
  'PP2': 1,
  'Pre-Primary 2': 1,
  'PP 2': 1,
  'Grade 1': 2,
  'G1': 2,
  'Grade 2': 3,
  'G2': 3,
  'Grade 3': 4,
  'G3': 4,
  'Grade 4': 5,
  'G4': 5,
  'Grade 5': 6,
  'G5': 6,
  'Grade 6': 7,
  'G6': 7,
  'Grade 7': 8,
  'G7': 8,
  'Grade 8': 9,
  'G8': 9,
  'Grade 9': 10,
  'G9': 10,
  'Grade 10': 11,
  'G10': 11,
};

export function getGradeOrderIndex(gradeName: string | undefined | null): number {
  if (!gradeName) return 999;
  const trimmed = String(gradeName).trim();
  if (GRADE_ORDER_MAP[trimmed] !== undefined) {
    return GRADE_ORDER_MAP[trimmed];
  }
  const lower = trimmed.toLowerCase();
  for (const key in GRADE_ORDER_MAP) {
    if (key.toLowerCase() === lower) {
      return GRADE_ORDER_MAP[key];
    }
  }
  const numMatch = trimmed.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    if (lower.includes('pp') || lower.includes('pre')) {
      return num - 1;
    }
    return num + 1;
  }
  return 999;
}

export const PREFERRED_STREAMS: string[] = [
  'Blue', 'Green', 'Red', 'Yellow', 'White', 'Gold', 'Silver',
  'East', 'West', 'North', 'South',
  'Alpha', 'Beta', 'Gamma', 'Delta',
  'A', 'B', 'C', 'D', 'E', 'F'
];

export function getStreamOrderIndex(streamName: string | undefined | null): number {
  if (!streamName) return 0;
  const trimmed = String(streamName).trim();
  const idx = PREFERRED_STREAMS.findIndex(s => s.toLowerCase() === trimmed.toLowerCase());
  return idx !== -1 ? idx : 500;
}

export function compareGradeAndStream(
  aGrade: string = '',
  aStream: string = '',
  bGrade: string = '',
  bStream: string = ''
): number {
  const gradeDiff = getGradeOrderIndex(aGrade) - getGradeOrderIndex(bGrade);
  if (gradeDiff !== 0) return gradeDiff;
  const streamDiff = getStreamOrderIndex(aStream) - getStreamOrderIndex(bStream);
  if (streamDiff !== 0) return streamDiff;
  return aStream.localeCompare(bStream);
}

export function isDemoOrTestClass(c: any): boolean {
  if (!c) return false;
  const name = String(c.class_name || c.name || '').toLowerCase().trim();
  const stream = String(c.stream || c.stream_name || '').toLowerCase().trim();
  const id = String(c.id || '').toLowerCase().trim();
  return (
    name === 'demo' ||
    name === 'demo class' ||
    name === 'sample class' ||
    name.startsWith('demo ') ||
    stream === 'demo' ||
    stream === 'demo stream' ||
    stream === 'sample' ||
    id === 'cls_demo' ||
    id.startsWith('cls_demo_')
  );
}

export function sortClasses<T extends ClassStream>(classList: T[]): T[] {
  if (!classList || classList.length === 0) return [];
  const filtered = classList.filter((c) => !isDemoOrTestClass(c));
  if (filtered.length <= 1) return filtered;
  return [...filtered].sort((a, b) =>
    compareGradeAndStream(a.class_name, a.stream, b.class_name, b.stream)
  );
}

export function sortGrades<T extends string>(grades: T[]): T[] {
  if (!grades || grades.length === 0) return [];
  const normalized = grades
    .map((g) => (g ? normalizeGradeName(g) : g) as T)
    .filter((g) => ALL_GRADES.includes(g as GradeName));
  const unique = Array.from(new Set(normalized));
  return unique.sort((a, b) => getGradeOrderIndex(a) - getGradeOrderIndex(b));
}

export interface School {
  id: string;
  school_name: string;
  county: string;
  address?: string;
  postal_code?: string;
  email: string;
  motto?: string;
  // Optional backward compatibility properties
  school_code?: string;
  sub_county?: string;
  physical_address?: string;
  phone?: string;
  website?: string;
  logo_url?: string;
  stamp_url?: string;
  principal_name?: string;
  registration_number?: string;
}

export type AccountStatus = 'Active' | 'Disabled' | 'Locked';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  teacher_id?: string;
  student_id?: string;
  tsc_number?: string;
  phone?: string;
  username?: string;
  status?: AccountStatus;
  force_password_change?: boolean;
  temporary_password?: string;
  last_login?: string;
}

export interface TeacherAllocation {
  id: string;
  education_level: EducationLevel;
  class_id: string;
  stream_id?: string;
  subject_id: string;
  class_name?: string;
  stream?: string;
  subject_name?: string;
  subject_code?: string;
}

export interface Teacher {
  id: string;
  user_id?: string;
  teacher_name: string;
  phone: string;
  email: string;
  username?: string;
  tsc_number?: string;
  status?: AccountStatus;
  force_password_change?: boolean;
  temporary_password?: string;
  last_login?: string;
  is_class_teacher?: boolean;
  class_teacher_of_id?: string;
  allocations?: TeacherAllocation[];
}

export interface LoginLog {
  id: string;
  user_id?: string;
  email: string;
  user_name?: string;
  role?: Role;
  timestamp: string;
  date: string;
  time: string;
  ip_address: string;
  device: string;
  browser: string;
  status: 'Success' | 'Failed';
  reason?: string;
}


export interface ClassStream {
  id: string;         // CLASS UUID (public.classes.id)
  stream_id?: string;  // STREAM UUID (public.streams.id)
  class_name: string; // e.g., "PP1", "Grade 1", "Grade 7"
  stream: string;     // e.g., "Blue", "Gold", "East", "A"
  capacity?: number;
  class_teacher_id?: string;
  education_level?: EducationLevel;
  status?: 'Active' | 'Inactive';
  allocated_subject_ids?: string[];
}

export interface LearnerPromotionRecord {
  id: string;
  student_id: string;
  from_grade: GradeName;
  to_grade: GradeName;
  from_class_id?: string;
  to_class_id?: string;
  from_stream_id?: string;
  to_stream_id?: string;
  academic_year_id?: string;
  date_promoted: string;
  promoted_by?: string;
  from_year?: number;
  from_term?: TermName;
  to_year?: number;
  to_term?: TermName;
}

export type EnrolmentStatus = 'future' | 'active' | 'inactive';

export interface Student {
  id: string;
  admission_number: string;
  full_name: string;
  first_name?: string;
  second_name?: string;
  last_name?: string;
  gender: 'M' | 'F';
  class_id: string;
  stream_id?: string;
  dob?: string;
  active: boolean;
  enrolment_status?: EnrolmentStatus;
  intake_year?: number;
  intake_term?: TermName;
  admission_date?: string;
  education_level?: EducationLevel;
  grade?: GradeName;
  promotion_history?: LearnerPromotionRecord[];
}

export function getLearnerEnrolmentStatus(student?: Partial<Student> | null): EnrolmentStatus {
  if (!student) return 'active';
  if (student.enrolment_status === 'future' || student.enrolment_status === 'active' || student.enrolment_status === 'inactive') {
    return student.enrolment_status;
  }
  return student.active === false ? 'inactive' : 'active';
}

export function isIntakePeriodFuture(
  intakeYear?: number | null,
  intakeTerm?: TermName | null,
  activeYear?: number | null,
  activeTerm?: TermName | null
): boolean {
  if (!intakeYear) return false;
  const currentYear = activeYear || 2026;
  if (intakeYear > currentYear) return true;
  if (intakeYear < currentYear) return false;

  // Same year, compare terms
  if (!intakeTerm || !activeTerm) return false;
  const termOrder: Record<string, number> = {
    'Term 1': 1,
    'Term 2': 2,
    'Term 3': 3,
  };
  const intakeVal = termOrder[intakeTerm] || 0;
  const activeVal = termOrder[activeTerm] || 0;
  return intakeVal > activeVal;
}

export function isIntakePeriodCurrent(
  intakeYear?: number | null,
  intakeTerm?: TermName | null,
  activeYear?: number | null,
  activeTerm?: TermName | null
): boolean {
  if (!intakeYear || !intakeTerm) return true;
  const currentYear = activeYear || 2026;
  const currentTerm = activeTerm || 'Term 1';
  return intakeYear === currentYear && intakeTerm === currentTerm;
}

export function isMidTermAdmission(
  intakeYear?: number | null,
  intakeTerm?: TermName | null,
  admissionDate?: string | null,
  activeYear?: number | null,
  activeTerm?: TermName | null,
  termStartDate?: string | null
): boolean {
  if (isIntakePeriodFuture(intakeYear, intakeTerm, activeYear, activeTerm)) {
    return false;
  }
  const isCurrent = isIntakePeriodCurrent(intakeYear, intakeTerm, activeYear, activeTerm);
  if (!isCurrent) return false;
  if (admissionDate && termStartDate) {
    return admissionDate > termStartDate;
  }
  return false;
}

export function formatLearnerName(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toUpperCase();
}

export function getStudentFullName(student?: Partial<Student> | null): string {
  if (!student) return '';
  let name = '';
  if (student.first_name || student.last_name) {
    const parts = [student.first_name, student.second_name, student.last_name]
      .filter((n): n is string => Boolean(n && n.trim()))
      .map((n) => n.trim());
    if (parts.length > 0) {
      name = parts.join(' ');
    }
  }
  if (!name) {
    name = student.full_name || '';
  }
  return formatLearnerName(name);
}

export interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
  category: 'Core' | 'Elective' | 'Optional' | 'Activity';
  department?: string;
  education_level?: EducationLevel | 'Grade 4–9' | 'PP1–Grade 9';
  applicable_grades?: GradeName[];
  status?: 'Active' | 'Archived';
}

export function extractGradeName(gradeStr: string): string {
  if (!gradeStr) return '';
  const s = gradeStr.trim();
  const match = s.match(/(PP1|PP2|Grade\s*\d+)/i);
  if (match) {
    const raw = match[0];
    if (raw.toLowerCase().startsWith('grade')) {
      const num = raw.replace(/\D/g, '');
      return `Grade ${num}`;
    }
    return raw.toUpperCase();
  }
  return s;
}

export function getContextualSubjectIdentity(sb: Subject, gradeOrLevel?: string): { subject_name: string; subject_code: string; education_level: string } {
  if (!sb) return { subject_name: '', subject_code: '', education_level: '' };
  const code = (sb.subject_code || '').trim().toUpperCase();
  const name = (sb.subject_name || '').trim();

  let resolvedLevel = '';
  if (gradeOrLevel) {
    const norm = gradeOrLevel.trim();
    if (
      norm === 'Pre-Primary' ||
      norm === 'Lower Primary' ||
      norm === 'Upper Primary' ||
      norm === 'Junior School'
    ) {
      resolvedLevel = norm;
    } else {
      try {
        resolvedLevel = getEducationLevelForGrade(norm);
      } catch {
        // Fallback
      }
    }
  }

  // Fallback to sb.education_level if no gradeOrLevel is provided
  if (!resolvedLevel && sb.education_level) {
    resolvedLevel = sb.education_level;
  }

  if (resolvedLevel === 'Lower Primary') {
    // 1. English (ENG consistent Grade 1-9)
    if (
      code === 'ENG' ||
      code === 'LP-ENG' ||
      code === 'LP-LIT' ||
      code === 'LIT LP' ||
      code === 'ENG LP' ||
      name.toUpperCase().includes('ENGLISH') ||
      name.toUpperCase().includes('LITERACY') ||
      sb.id === 'sb_lp_eng' ||
      sb.id === 'sb_lp_lit'
    ) {
      return {
        subject_name: 'English',
        subject_code: 'ENG',
        education_level: 'Lower Primary',
      };
    }

    // 2. Kiswahili (KIS consistent Grade 1-9)
    if (
      code === 'KIS' ||
      code === 'LP-KSL' ||
      code === 'KIS LP' ||
      code === 'KISW' ||
      name.toUpperCase().includes('KISWAHILI') ||
      sb.id === 'sb_lp_kis'
    ) {
      return {
        subject_name: 'Kiswahili',
        subject_code: 'KIS',
        education_level: 'Lower Primary',
      };
    }

    // 3. Integrated Learning Area (ILA only in Lower Primary)
    if (
      code === 'ILA' ||
      code === 'LP-ILA' ||
      code === 'LP-MATH' ||
      code === 'LP-ENV' ||
      code === 'LP-HN' ||
      code === 'LP-MCA' ||
      code === 'LP-CRE' ||
      code === 'MAT LP' ||
      code === 'ENV LP' ||
      code === 'HNG LP' ||
      code === 'CREAT LP' ||
      code === 'RE LP' ||
      name.toUpperCase().includes('INTEGRATED LEARNING') ||
      sb.id === 'sb_lp_ila' ||
      sb.id === 'sb_lp_mat' ||
      sb.id === 'sb_lp_env' ||
      sb.id === 'sb_lp_hng' ||
      sb.id === 'sb_lp_crt' ||
      sb.id === 'sb_lp_re'
    ) {
      return {
        subject_name: 'Integrated Learning Area',
        subject_code: 'ILA',
        education_level: 'Lower Primary',
      };
    }
  }

  if (resolvedLevel !== 'Junior School') {
    return {
      subject_name: sb.subject_name || '',
      subject_code: sb.subject_code || '',
      education_level: resolvedLevel || sb.education_level || '',
    };
  }

  // 1. Kiswahili
  if (code === 'KIS' || code === 'KISW' || name.toUpperCase().includes('KISWAHILI')) {
    return {
      subject_name: 'Kiswahili',
      subject_code: 'KIS',
      education_level: resolvedLevel || sb.education_level || 'Junior School',
    };
  }

  // 2. Mathematics
  if (code === 'MATH' || code === 'MATHS' || code === 'MAT' || name.toUpperCase().includes('MATH')) {
    return {
      subject_name: 'Mathematics',
      subject_code: 'MATH',
      education_level: resolvedLevel || sb.education_level || 'Junior School',
    };
  }

  // 3. Integrated Learning Area (Lower Primary only)
  if (code === 'ILA' || code === 'LP-ILA' || name.toUpperCase().includes('INTEGRATED LEARNING AREA')) {
    return {
      subject_name: 'Integrated Learning Area',
      subject_code: 'ILA',
      education_level: resolvedLevel || sb.education_level || 'Lower Primary',
    };
  }

  // 4. Creative Arts and Sports
  if (code === 'CAS' || code === 'CA' || name.toUpperCase().includes('CREATIVE') || name.toUpperCase().includes('SPORTS')) {
    return {
      subject_name: 'Creative Arts and Sports',
      subject_code: 'CAS',
      education_level: resolvedLevel || sb.education_level || 'Junior School',
    };
  }

  return {
    subject_name: sb.subject_name || '',
    subject_code: sb.subject_code || '',
    education_level: resolvedLevel || sb.education_level || '',
  };
}

export function getShortCbeCode(code: string, name?: string, eduLevel?: string): string {
  const upperCode = (code || '').toUpperCase().trim();
  const upperName = (name || '').toUpperCase().trim();

  let resolvedLevel = eduLevel || '';
  if (resolvedLevel) {
    const norm = resolvedLevel.trim();
    if (
      norm === 'Pre-Primary' ||
      norm === 'Lower Primary' ||
      norm === 'Upper Primary' ||
      norm === 'Junior School'
    ) {
      resolvedLevel = norm;
    } else {
      try {
        const testLevel = getEducationLevelForGrade(norm);
        if (testLevel) {
          resolvedLevel = testLevel;
        }
      } catch {
        // Safe fallback
      }
    }
  }

  if (
    upperCode === 'PRE TECH' ||
    upperCode === 'PRE-TECH' ||
    upperCode === 'PTS' ||
    upperCode.includes('PRE TECH') ||
    upperCode.includes('PRE-TECH') ||
    upperName.includes('PRE-TECH') ||
    upperName.includes('PRE TECH') ||
    upperName.includes('PRE TECHNICAL')
  ) {
    return 'PRE TECH';
  }

  // Upper Primary specific subjects (COMP & INSHA)
  if (upperCode === 'COMP' || upperName.includes('COMPOSITION')) {
    return 'COMP';
  }
  if (upperCode === 'INSHA' || upperName.includes('INSHA')) {
    return 'INSHA';
  }

  if (upperCode === 'ENG' || upperCode === 'LP-ENG' || upperCode === 'LP-LIT' || upperName.includes('ENGLISH') || upperName.includes('LITERACY')) return 'ENG';

  // Kiswahili & Mathematics
  if (upperCode === 'KIS' || upperCode === 'KISW' || upperCode === 'LP-KSL' || upperName.includes('KISWAHILI')) {
    return 'KIS';
  }

  if (
    upperCode === 'ILA' ||
    upperCode === 'LP-ILA' ||
    upperName.includes('INTEGRATED LEARNING AREA') ||
    (resolvedLevel === 'Lower Primary' && (
      upperCode === 'LP-MATH' ||
      upperCode === 'LP-ENV' ||
      upperCode === 'LP-HN' ||
      upperCode === 'LP-MCA' ||
      upperCode === 'LP-CRE' ||
      upperCode === 'MAT LP' ||
      upperCode === 'ENV LP' ||
      upperCode === 'HNG LP' ||
      upperCode === 'CREAT LP' ||
      upperCode === 'RE LP' ||
      upperName.includes('INTEGRATED')
    ))
  ) {
    return 'ILA';
  }

  if (upperCode === 'MATH' || upperCode === 'MATHS' || upperCode === 'MAT' || upperName.includes('MATH')) {
    return 'MATH';
  }

  // Creative Arts and Sports
  if (upperCode === 'CAS' || upperCode === 'CA' || upperName.includes('CREATIVE') || upperName.includes('SPORTS')) {
    return 'CAS';
  }

  // Integrated Science (applicable to both Upper Primary and Junior School: INT-SCI)
  if (
    upperCode === 'INT-SCI' ||
    upperCode === 'INT SCI' ||
    upperCode === 'INT/SC' ||
    upperCode === 'INT/SCI' ||
    upperCode.includes('INT-SCI') ||
    upperName.includes('INTEGRATED SCIENCE') ||
    upperName === 'INTEGRATED'
  ) {
    return 'INT-SCI';
  }

  // Upper Primary vs Junior School Science
  if (
    upperCode === 'SCT' ||
    upperCode === 'SCI UP' ||
    upperCode === 'SCI-TECH' ||
    (resolvedLevel === 'Upper Primary' && (upperName.includes('SCIENCE') || upperCode === 'SCI') && !upperName.includes('INTEGRATED'))
  ) {
    return 'SCT';
  }
  if (
    upperCode === 'SCI' ||
    (upperName.includes('SCIENCE') && !upperName.includes('TECH') && resolvedLevel !== 'Upper Primary') ||
    (upperCode === 'SCI' && resolvedLevel !== 'Upper Primary')
  ) {
    return 'INT-SCI';
  }

  // Upper Primary vs Junior School Creative Arts (CA / CAS)
  if (
    upperCode === 'CAS' ||
    upperCode === 'CA' ||
    upperCode === 'CREAT UP' ||
    upperName.includes('CREATIVE') ||
    upperName.includes('SPORTS')
  ) {
    if (resolvedLevel === 'Upper Primary') {
      return 'CA';
    } else if (resolvedLevel === 'Junior School') {
      return 'CAS';
    }
    return upperCode === 'CAS' ? 'CAS' : 'CA';
  }

  // Upper Primary Social Studies & CRE (SS&CRE)
  if (
    upperCode === 'SS&CRE' ||
    upperCode === 'SS & CRE' ||
    upperCode === 'SS/CRE' ||
    upperCode === 'SST&CRE' ||
    upperCode === 'SST/CRE' ||
    upperCode.includes('SS&CRE') ||
    upperName.includes('SOCIAL STUDIES & CRE') ||
    upperName.includes('SOCIAL STUDIES&CRE') ||
    upperName.includes('SOCIAL STUDIES AND CRE')
  ) {
    return 'SS&CRE';
  }

  if (upperCode === 'SST' || upperCode === 'SS' || upperName.includes('SOCIAL')) return upperCode === 'SS' ? 'SS' : 'SST';
  if (
    upperCode === 'CRE' ||
    upperCode === 'C.R.E' ||
    upperCode === 'RE' ||
    upperCode === 'RE ACT' ||
    upperCode === 'RE LP' ||
    upperCode === 'RE UP' ||
    upperName.includes('CHRISTIAN') ||
    upperName.includes('RELIGIOUS')
  ) {
    return 'CRE';
  }
  if (
    upperCode === 'AGN' ||
    upperCode === 'AGR' ||
    upperCode === 'AGRIC' ||
    upperCode === 'AGRI' ||
    upperName.includes('AGRICULT') ||
    upperName.includes('NUTRITION')
  ) {
    return upperCode === 'AGR' ? 'AGR' : 'AGN';
  }
  if (upperCode === 'IRE' || upperCode === 'I.R.E' || upperName.includes('ISLAMIC')) return 'IRE';
  if (upperCode === 'HRE' || upperCode === 'H.R.E' || upperName.includes('HINDU')) return 'HRE';

  return upperCode || 'SUBJ';
}

export function getMeritListDisplayCode(code: string, name?: string, eduLevel?: string): string {
  if (!code) return 'SUBJ';
  if (code.startsWith('PP-')) return code;
  if (code === 'LP-ENG' || code === 'LP-LIT' || (eduLevel === 'Lower Primary' && (code === 'ENG' || code.includes('ENG') || code.includes('LIT')))) return 'ENG';
  if (code === 'LP-KSL' || (eduLevel === 'Lower Primary' && (code === 'KIS' || code.includes('KIS')))) return 'KIS';
  if (code === 'LP-ILA' || code === 'ILA' || (eduLevel === 'Lower Primary' && ['LP-MATH', 'LP-ENV', 'LP-HN', 'LP-CRE', 'LP-MCA', 'MAT LP', 'ENV LP', 'HNG LP', 'CREAT LP', 'RE LP'].includes(code))) return 'ILA';
  if (code.startsWith('LP-')) return getShortCbeCode(code, name, eduLevel);
  const shortCode = getShortCbeCode(code, name, eduLevel);
  if (shortCode === 'COMP') return 'COMP';
  if (shortCode === 'INSHA') return 'INSHA';
  if (shortCode === 'ILA') return 'ILA';
  if (shortCode === 'SS&CRE') return 'SS&CRE';
  if (shortCode === 'SCT') return 'SCT';
  if (shortCode === 'CA') return 'CA';
  if (shortCode === 'INT-SCI' || shortCode === 'SCI' || shortCode === 'INT/SC' || shortCode === 'INT SCI') {
    return eduLevel === 'Upper Primary' ? 'INT SCI' : 'INT-SCI';
  }
  if (shortCode === 'PRE TECH' || shortCode === 'PTS' || shortCode === 'PRE-TECH') return 'PRE-TECH';
  if (shortCode === 'MATH' || shortCode === 'MAT') return 'MATH';
  if (shortCode === 'MATHS') return 'MATHS';
  if (shortCode === 'AGR' || shortCode === 'AGRI' || shortCode === 'AGN') return 'AGN';
  if (shortCode === 'CAS') return 'CAS';
  if (shortCode === 'CRE' || shortCode === 'C.R.E') return 'C.R.E';
  return shortCode;
}

export function sortSubjectsByStandardOrder<T extends Record<string, any>>(subjects: T[]): T[] {
  if (!subjects || subjects.length <= 1) return subjects || [];

  const orderMap: Record<string, number> = {
    // Official Standard Order:
    'ENG': 1,
    'ENGLISH': 1,

    'COMP': 2,
    'ENGLISH COMPOSITION': 2,
    'COMPOSITION': 2,

    'KIS': 3,
    'KISW': 3,
    'KISWAHILI': 3,

    'INSHA': 4,
    'KISWAHILI INSHA': 4,

    'ILA': 4.5,
    'INTEGRATED LEARNING AREA': 4.5,

    'MATH': 5,
    'MAT': 5,
    'MATHEMATICS': 5,
    'MATHS': 5,

    'SCT': 6,
    'INT-SCI': 6,
    'INT SCI': 6,
    'SCI': 6,
    'INT/SC': 6,
    'INTEGRATED SCIENCE': 6,

    'CAS': 7,
    'CA': 7,
    'CREATIVE ARTS AND SPORTS': 7,
    'CREATIVE ARTS & SPORTS': 7,
    'CREATIVE ARTS': 7,
    'CREAT UP': 7,

    'SS&CRE': 8,
    'SS & CRE': 8,
    'SOCIAL STUDIES&CRE': 8,
    'SOCIAL STUDIES & CRE': 8,
    'SS': 8,
    'SST': 8,
    'SOCIAL STUDIES': 8,

    'CRE': 9,
    'C.R.E': 9,
    'CHRISTIAN RELIGIOUS EDUCATION': 9,

    'AGN': 10,
    'AGR': 10,
    'AGRI': 10,
    'AGRIC': 10,
    'AGRICULTURE AND NUTRITION': 10,
    'AGRICULTURE & NUTRITION': 10,
    'AGRICULTURE': 10,

    'PRE TECH': 11,
    'PRE-TECH': 11,
    'PTS': 11,
    'PRE-TECHNICAL STUDIES': 11,
  };

  return [...subjects].sort((a, b) => {
    const codeA = getShortCbeCode(a.subject_code || '', a.subject_name || '');
    const codeB = getShortCbeCode(b.subject_code || '', b.subject_name || '');

    const posA = orderMap[codeA] ?? (orderMap[(a.subject_code || '').toUpperCase()] ?? 99);
    const posB = orderMap[codeB] ?? (orderMap[(b.subject_code || '').toUpperCase()] ?? 99);

    if (posA !== posB) return posA - posB;
    return (a.subject_code || a.subject_name || '').localeCompare(b.subject_code || b.subject_name || '');
  });
}

export function deduplicateSubjectsForGradeLevel(subjectsInput: Subject[], targetGradeOrLevel: string): Subject[] {
  if (!subjectsInput || subjectsInput.length === 0) return [];
  const normalizedGrade = extractGradeName(targetGradeOrLevel) || targetGradeOrLevel;
  const eduLevel = getEducationLevelForGrade(normalizedGrade || targetGradeOrLevel);

  const seenDisplayCodes = new Map<string, Subject>();

  for (const s of subjectsInput) {
    if (!s || !s.id || s.status === 'Archived') continue;

    const displayCode = getMeritListDisplayCode(s.subject_code || '', s.subject_name || '', eduLevel || (s.education_level as string));
    if (!seenDisplayCodes.has(displayCode)) {
      seenDisplayCodes.set(displayCode, s);
    } else {
      const existing = seenDisplayCodes.get(displayCode)!;
      
      // Preferred IDs for Lower Primary and Upper Primary contexts to preserve marks lookups
      const isPreferredId = (id: string) => {
        if (eduLevel === 'Lower Primary') {
          return ['sb_lp_eng', 'sb_lp_kis', 'sb_lp_ila'].includes(id);
        }
        return eduLevel === 'Upper Primary' && [
          'sb_cas',
          'sb_kis',
          'f00b5334-fa16-4640-b19c-733ec4530318',
          'sb_mat',
          '4441b054-2d20-4d5c-852d-f31d16fbc145',
          'dff8e7fc-bb0d-41c5-b451-e6b6f3361409', // SST Upper Primary
          'e784b5fc-dab9-4105-bb49-fce1d1a84cf7', // CRE Upper Primary
          'f8255683-1d59-46a7-881a-04a25d45d972', // SS&CRE Upper Primary
        ].includes(id);
      };

      if (isPreferredId(s.id) && !isPreferredId(existing.id)) {
        seenDisplayCodes.set(displayCode, s);
      } else if (!isPreferredId(s.id) && isPreferredId(existing.id)) {
        // Keep existing
      } else {
        const currentExact = s.education_level === eduLevel;
        const existingExact = existing.education_level === eduLevel;
        if (currentExact && !existingExact) {
          seenDisplayCodes.set(displayCode, s);
        }
      }
    }
  }

  return Array.from(seenDisplayCodes.values());
}

export function getApplicableSubjectsForGrade(
  gradeInput: string,
  subjects: Subject[] = []
): Subject[] {
  if (!subjects || subjects.length === 0) return [];
  const normalizedGrade = extractGradeName(gradeInput) || gradeInput;
  const eduLevel = getEducationLevelForGrade(normalizedGrade || gradeInput);

  const candidateSubjects: Subject[] = [];

  for (const s of subjects) {
    if (!s || !s.id || s.status === 'Archived') continue;

    let match = false;
    if (s.applicable_grades && s.applicable_grades.length > 0) {
      match = s.applicable_grades.includes(normalizedGrade as GradeName);
    } else if (s.education_level) {
      match =
        s.education_level === eduLevel ||
        (s.education_level === 'Grade 4–9' && (eduLevel === 'Upper Primary' || eduLevel === 'Junior School'));
    }

    if (match) {
      const contextIdentity = getContextualSubjectIdentity(s, normalizedGrade);
      candidateSubjects.push({
        ...s,
        subject_name: contextIdentity.subject_name,
        subject_code: contextIdentity.subject_code,
        education_level: (contextIdentity.education_level || s.education_level) as any,
      });
    }
  }

  if (eduLevel === 'Lower Primary') {
    const lpAllowedCodes = new Set(['ENG', 'KIS', 'ILA']);
    const lpCandidates = candidateSubjects.filter((s) => {
      const shortCode = getShortCbeCode(s.subject_code || '', s.subject_name || '', 'Lower Primary');
      return lpAllowedCodes.has(shortCode);
    });
    const deduplicated = deduplicateSubjectsForGradeLevel(lpCandidates, normalizedGrade || gradeInput);
    return sortSubjectsByStandardOrder(deduplicated);
  }

  const deduplicated = deduplicateSubjectsForGradeLevel(candidateSubjects, normalizedGrade || gradeInput);
  return sortSubjectsByStandardOrder(deduplicated);
}

export function getAllocatedSubjectsForClass(
  classStream: ClassStream | undefined,
  subjects: Subject[] = []
): Subject[] {
  if (!classStream || !subjects || subjects.length === 0) return [];
  
  const classGrade = classStream.class_name;
  const eduLevel = classStream.education_level || getEducationLevelForGrade(classGrade);

  // If the class has explicit allocations, return those allocated subjects directly (preserving archived historical subjects)
  if (classStream.allocated_subject_ids && classStream.allocated_subject_ids.length > 0) {
    const allocated: Subject[] = [];
    for (const s of subjects) {
      if (!s || !s.id) continue;
      if (
        classStream.allocated_subject_ids.includes(s.id) ||
        (s.subject_code && classStream.allocated_subject_ids.includes(s.subject_code))
      ) {
        const contextIdentity = getContextualSubjectIdentity(s, classGrade || eduLevel);
        allocated.push({
          ...s,
          subject_name: contextIdentity.subject_name,
          subject_code: contextIdentity.subject_code,
          education_level: (contextIdentity.education_level || s.education_level) as any,
        });
      }
    }
    if (allocated.length > 0) {
      if (eduLevel === 'Lower Primary') {
        const lpAllowedCodes = new Set(['ENG', 'KIS', 'ILA']);
        const lpAllocated = allocated.filter((s) => {
          const shortCode = getShortCbeCode(s.subject_code || '', s.subject_name || '', 'Lower Primary');
          return lpAllowedCodes.has(shortCode);
        });
        const deduplicated = deduplicateSubjectsForGradeLevel(lpAllocated, classGrade || eduLevel);
        return sortSubjectsByStandardOrder(deduplicated);
      }
      const deduplicated = deduplicateSubjectsForGradeLevel(allocated, classGrade || eduLevel);
      return sortSubjectsByStandardOrder(deduplicated);
    }
  }
  
  // Fall back to returning active applicable subjects for this class's grade level
  return getApplicableSubjectsForGrade(classStream.class_name, subjects);
}

export type AcademicYearStatus = 'Upcoming' | 'Active' | 'Closed' | 'Archived' | 'Locked';
export type TermStatus = 'Upcoming' | 'Active' | 'Closed' | 'Archived' | 'Locked';
export type TermName = 'Term 1' | 'Term 2' | 'Term 3';

export interface AcademicYear {
  id: string;
  year: number;
  status: AcademicYearStatus;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SchoolTerm {
  id: string;
  academic_year_id: string;
  year: number;
  term_name: TermName;
  term_number?: number;
  opening_date: string;
  closing_date: string;
  mid_term_opening_date?: string;
  mid_term_closing_date?: string;
  status: TermStatus;
  created_at?: string;
  updated_at?: string;
}

export type ExamType = 'Opener' | 'CAT' | 'Mid-Term' | 'End-Term' | 'Custom';
export type ExamStatus = 'Draft' | 'Open' | 'Verification' | 'Published' | 'Approved' | 'Provisional';

export type UpperPrimarySSCREStructure = 'A' | 'B' | 'C';

export interface Examination {
  id: string;
  exam_name: string;
  term: TermName;
  year: number;
  academic_year_id?: string;
  term_id?: string;
  class_id?: string; // Target class ID or 'all'
  education_level?: EducationLevel;
  date_created?: string;
  created_at?: string;
  updated_at?: string;
  status: ExamStatus;
  exam_type: ExamType;
  max_marks: number; // default 100
  ss_cre_structure?: UpperPrimarySSCREStructure;
  start_date?: string;
  end_date?: string;
  approved_levels?: EducationLevel[];
  approved_classes?: string[];
}

export type SubjectStatus = 'Normal' | 'X' | 'Y' | 'Blank';

export interface MarkResolution {
  id?: string;
  mark_id: string;
  student_id?: string;
  subject_id?: string;
  exam_id?: string;
  original_status?: 'Y';
  previous_status?: string; // Alias for original_status
  original_irregularity_reason?: string;
  replacement_score?: number;
  resolved_score?: number; // Alias for replacement_score
  replacement_percentage?: number;
  resolution_reason: string;
  resolved_by: string;
  resolved_at: string;
  created_at?: string;
}

export interface Mark {
  id: string;
  student_id: string;
  subject_id: string;
  exam_id: string;
  marks?: number; // 0 to 100 percentage score or raw mark
  raw_score?: number | null;
  score?: number | null; // Database column name in Supabase
  percentage?: number | null;
  out_of?: number; // Maximum score for this subject assessment, default 100
  special_status?: SubjectStatus; // 'Normal' | 'X' | 'Y' | 'Blank'
  status?: SubjectStatus; // Alias for special_status matching database column
  irregularity_reason?: string; // Reason for Y status (e.g. Absent, Malpractice, Withheld, Medical Absence, Exempted)
  resolution?: MarkResolution; // T-11 Authorised Y Resolution Provenance
  entered_by_teacher_id?: string;
  updated_at?: string;
  is_synthetic?: boolean;
}

export interface Grade {
  id: string;
  grade_code: string;        // e.g. "EE1", "EE2", "ME1", "ME2", "AE1", "AE2", "BE1", "BE2"
  performance_level: 'EE' | 'ME' | 'AE' | 'BE';
  minimum_score: number;     // 90, 75, 58, 41, 31, 21, 11, 1
  maximum_score: number;     // 100, 89, 74, 57, 40, 30, 20, 10
  points: number;            // 8, 7, 6, 5, 4, 3, 2, 1
  remarks: string;           // e.g. "Exceptional", "Good", "Needs Support", "Intervention Required"
  descriptor: string;        // e.g. "Exceeding Expectations"
  
  // Backward compatibility fields
  grade?: string;
  minimum_marks?: number;
  maximum_marks?: number;
}

export interface Result {
  id: string;
  student_id: string;
  exam_id: string;
  total_marks: number;
  total_max_marks?: number;
  subject_count: number;
  average: number;
  total_points: number;
  average_points: number;
  grade_code: string;
  performance_level: string;
  grade: string;
  points: number;
  position: number;           // Overall rank (0 if incomplete)
  class_position?: number;    // Stream/class rank (0 if incomplete)
  stream_position?: number;
  remarks?: string;
  is_complete?: boolean;
  status?: 'Complete' | 'Incomplete Assessment' | 'Provisional';
  missing_subjects_count?: number;
}

export interface VerificationLog {
  id: string;
  exam_id: string;
  action: 'Submitted' | 'Verified' | 'Approved' | 'Unlocked' | 'Rejected';
  performed_by_name: string;
  timestamp: string;
  notes?: string;
}

export interface ExamAnalysisSummary {
  exam_id: string;
  exam_name: string;
  total_students: number;
  mean_score: number;
  mean_points: number;
  mean_grade_code: string;
  mean_performance_level: string;
  highest_score: number;
  lowest_score: number;
  subject_summaries: {
    subject_id: string;
    subject_name: string;
    subject_code: string;
    mean_score: number;
    mean_points: number;
    highest: number;
    lowest: number;
    pass_rate: number; // % meeting expectations (ME/EE)
  }[];
  grade_counts: Record<string, number>;
  level_counts: Record<string, number>;
  top_performers: {
    student_id: string;
    student_name: string;
    admission_number: string;
    class_name: string;
    total_marks: number;
    average: number;
    total_points: number;
    average_points: number;
    grade_code: string;
    performance_level: string;
    position: number;
  }[];
  weak_subjects: string[];
  strong_subjects: string[];
  not_administered?: boolean;
}

export interface LearnerReportComment {
  id?: string;
  student_id: string;
  exam_id: string;
  class_teacher_comment?: string;
  class_teacher_name?: string;
  class_teacher_signature_date?: string;
  hoi_comment?: string;
  hoi_name?: string;
  hoi_signature_date?: string;
  next_term_opening_date?: string;
  is_approved?: boolean;
  subject_comments?: Record<string, string>;
}

export interface LearnerRankingMetadata {
  stream_rank: number | null;
  stream_total: number;
  overall_rank: number | null;
  overall_total: number;
  is_complete: boolean;
  total_marks?: number;
  average?: number;
  total_points?: number;
  performance_level?: string;
  grade_code?: string;
}

// ============================================================================
// OTA RELEASE METADATA TYPES (Phase 3 - Supabase Authority)
// ============================================================================

export type ReleaseChannel = 'production' | 'staging';

export type ReleaseStatus = 'DRAFT' | 'TESTING' | 'PUBLISHED' | 'DISABLED';

export interface AppRelease {
  id: string;
  bundle_version: string;
  channel: ReleaseChannel;
  status: ReleaseStatus;
  storage_bucket: string;
  storage_path: string;
  checksum_sha256: string;
  bundle_size_bytes: number;
  min_native_version_code: number;
  max_native_version_code: number | null;
  is_mandatory: boolean;
  release_notes: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReleaseInput {
  bundle_version: string;
  channel?: ReleaseChannel;
  status?: ReleaseStatus;
  storage_bucket?: string;
  storage_path: string;
  checksum_sha256: string;
  bundle_size_bytes: number;
  min_native_version_code?: number;
  max_native_version_code?: number | null;
  is_mandatory?: boolean;
  release_notes?: string | null;
  published_at?: string | null;
  created_by?: string | null;
}

export interface UpdateReleaseInput {
  status?: ReleaseStatus;
  storage_bucket?: string;
  storage_path?: string;
  checksum_sha256?: string;
  bundle_size_bytes?: number;
  min_native_version_code?: number;
  max_native_version_code?: number | null;
  is_mandatory?: boolean;
  release_notes?: string | null;
  published_at?: string | null;
}

export interface ReleaseValidationResult {
  isValid: boolean;
  errors: string[];
}

// ============================================================================
// OTA DISCOVERY & ACTIVATION TYPES (Phase 4 & Phase 5)
// ============================================================================

export type OtaDiscoveryStatus =
  | 'NO_UPDATE'
  | 'UPDATE_AVAILABLE'
  | 'INCOMPATIBLE'
  | 'INVALID_RELEASE'
  | 'DOWNLOADED_VERIFIED'
  | 'DOWNLOAD_FAILED'
  | 'CHECKSUM_FAILED';

export interface OtaDiscoveryResult {
  status: OtaDiscoveryStatus;
  releaseId?: string;
  bundleVersion?: string;
  currentBundleVersion: string;
  channel: ReleaseChannel;
  nativeVersionCode: number;
  nativeVersionCompatible: boolean;
  isMandatory?: boolean;
  releaseNotes?: string | null;
  bundleSizeBytes?: number;
  expectedChecksum?: string;
  downloaded?: boolean;
  verified?: boolean;
  bundleId?: string;
  error?: string | null;
}

export interface StagedBundleRecord {
  bundleId: string;
  bundleVersion: string;
  releaseId: string;
  channel: ReleaseChannel;
  checksumSha256: string;
  minNativeVersionCode: number;
  maxNativeVersionCode: number | null;
  stagedAt: string;
}

export type OtaActivationStatus =
  | 'ACTIVATED'
  | 'NO_STAGED_UPDATE'
  | 'INCOMPATIBLE'
  | 'NOT_NEWER'
  | 'BUNDLE_NOT_FOUND'
  | 'BLOCKED_BY_LOCK'
  | 'BLOCKED_BY_NAVIGATION'
  | 'ACTIVATION_IN_PROGRESS'
  | 'ACTIVATION_FAILED';

export interface OtaActivationResult {
  status: OtaActivationStatus;
  activated: boolean;
  bundleId?: string;
  bundleVersion?: string;
  currentVersion: string;
  error?: string | null;
}


