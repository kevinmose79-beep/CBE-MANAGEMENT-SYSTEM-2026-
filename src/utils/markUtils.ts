import { Mark, SubjectStatus, normalizeGradeName, Subject, UpperPrimarySSCREStructure, Examination } from '../types';

export interface EvaluatedMark {
  status: SubjectStatus;
  percentage: number | null;
  rawScore: number | null;
  outOf: number;
  irregularityReason?: string;
  displayScore: string;
  displayPercentage: string;
  displayStatus: string;
  isRawScoreOnly?: boolean;
}

/**
 * Verifies whether an assessment, subject, and class context represent Upper Primary English Composition (COMP) or Kiswahili Insha (INSHA).
 * Strict boundaries:
 * - Upper Primary Grades 4, 5 and 6 ONLY
 * - Subject code "COMP" or "INSHA" ONLY
 * Does NOT apply to Junior School, English generally (ENG), Kiswahili generally (KIS/KISW), or other Upper Primary subjects.
 */
export function isUpperPrimaryCompOrInsha(
  subject?: { subject_code?: string; code?: string; id?: string; name?: string; subject_name?: string; learning_area?: string; education_level?: string } | null,
  classObj?: { class_name?: string; education_level?: string } | null,
  educationLevel?: string | null
): boolean {
  if (!subject) return false;

  const code = (subject.subject_code || subject.code || '').trim().toUpperCase();
  const name = (subject.subject_name || subject.name || subject.learning_area || '').trim().toUpperCase();
  const id = (subject.id || '').trim().toLowerCase();

  const isSyntheticComposite = id.startsWith('synth_') || id.includes('composite');
  if (isSyntheticComposite) return false;

  const isCompOrInshaCode = code === 'COMP' || code === 'INSHA' || name.includes('COMPOSITION') || name.includes('INSHA') || id.includes('_comp') || id.includes('_insha');
  if (!isCompOrInshaCode) return false;

  // If class is provided, verify it does NOT belong to Junior School
  if (classObj) {
    if (classObj.class_name) {
      const norm = normalizeGradeName(classObj.class_name);
      if (['Grade 7', 'Grade 8', 'Grade 9'].includes(norm)) {
        return false;
      }
    } else if (classObj.education_level && classObj.education_level === 'Junior School') {
      return false;
    }
  }

  // If explicit educationLevel is provided, verify it is not Junior School
  if (educationLevel && educationLevel === 'Junior School') {
    return false;
  }

  const subLevel = subject.education_level;
  if (subLevel) {
    const isJunior = subLevel === 'Junior School' || subLevel.toLowerCase().includes('junior');
    const isPrimary = subLevel === 'Upper Primary' || subLevel.toLowerCase().includes('primary');
    if (isJunior && !isPrimary) {
      return false;
    }
  }

  return true;
}

/**
 * Verifies whether an assessment, subject, and class context represent Upper Primary English Language (ENG) or Kiswahili Lugha (KIS/KISW) - marked out of 60.
 * Does NOT apply to Junior School or Composition/Insha (COMP/INSHA).
 */
export function isUpperPrimaryLanguage(
  subject?: { subject_code?: string; code?: string; id?: string; name?: string; subject_name?: string; learning_area?: string; education_level?: string } | null,
  classObj?: { class_name?: string; education_level?: string } | null,
  educationLevel?: string | null
): boolean {
  if (!subject) return false;

  const code = (subject.subject_code || subject.code || '').trim().toUpperCase();
  const name = (subject.subject_name || subject.name || subject.learning_area || '').trim().toUpperCase();
  const id = (subject.id || '').trim().toLowerCase();

  const isCompOrInshaCode = code === 'COMP' || code === 'INSHA' || name.includes('COMPOSITION') || name.includes('INSHA') || id.includes('_comp') || id.includes('_insha');
  if (isCompOrInshaCode) return false;

  const isSyntheticComposite = id.startsWith('synth_') || id.includes('composite');
  if (isSyntheticComposite) return false;

  const isLangCode = isEnglishLanguage(subject) || isKiswahiliLugha(subject);
  if (!isLangCode) return false;

  if (classObj) {
    if (classObj.class_name) {
      const norm = normalizeGradeName(classObj.class_name);
      if (['Grade 7', 'Grade 8', 'Grade 9'].includes(norm)) {
        return false;
      }
    } else if (classObj.education_level && (classObj.education_level === 'Junior School' || classObj.education_level.toLowerCase().includes('junior'))) {
      return false;
    }
  }

  if (educationLevel && (educationLevel === 'Junior School' || educationLevel.toLowerCase().includes('junior'))) {
    return false;
  }

  const isClassUpperPrimary = classObj && classObj.class_name && ['Grade 4', 'Grade 5', 'Grade 6'].includes(normalizeGradeName(classObj.class_name));

  if (!isClassUpperPrimary) {
    const subLevel = subject.education_level;
    if (subLevel) {
      const isJunior = subLevel === 'Junior School' || subLevel.toLowerCase().includes('junior');
      const isPrimary = subLevel === 'Upper Primary' || subLevel.toLowerCase().includes('primary');
      if (isJunior && !isPrimary) {
        return false;
      }
    }
  }

  return true;
}

export function evaluateMark(
  mark?: Mark | null,
  options?: {
    isUpperPrimaryCompOrInsha?: boolean;
    isUpperPrimaryLanguage?: boolean;
    subject?: { subject_code?: string; code?: string; id?: string; name?: string; subject_name?: string; learning_area?: string; education_level?: string } | null;
    classObj?: { class_name?: string; education_level?: string } | null;
    educationLevel?: string | null;
  }
): EvaluatedMark {
  if (!mark) {
    return {
      status: 'Blank',
      percentage: null,
      rawScore: null,
      outOf: 100,
      displayScore: '',
      displayPercentage: '',
      displayStatus: 'Blank',
    };
  }

  const rawMarkStr = typeof mark.marks === 'string' ? (mark.marks as string).trim().toUpperCase() : '';

  // Explicit status check
  if (mark.special_status === 'X' || rawMarkStr === 'X') {
    return {
      status: 'X',
      percentage: null,
      rawScore: null,
      outOf: mark.out_of && mark.out_of <= 50 ? mark.out_of : 100,
      displayScore: 'X',
      displayPercentage: 'X',
      displayStatus: 'X (Missing Mark)',
    };
  }

  if (mark.special_status === 'Y' || rawMarkStr === 'Y') {
    const reason = mark.irregularity_reason || 'Absent';
    return {
      status: 'Y',
      percentage: null,
      rawScore: null,
      outOf: mark.out_of && mark.out_of <= 50 ? mark.out_of : 100,
      irregularityReason: reason,
      displayScore: 'Y',
      displayPercentage: 'Y',
      displayStatus: `Y (${reason})`,
    };
  }

  if (mark.special_status === 'Blank' || rawMarkStr === 'BLANK' || rawMarkStr === '-') {
    return {
      status: 'Blank',
      percentage: null,
      rawScore: null,
      outOf: mark.out_of && mark.out_of <= 50 ? mark.out_of : 100,
      displayScore: '',
      displayPercentage: '',
      displayStatus: 'Blank',
    };
  }

  // Normal numerical score
  const numRaw = typeof mark.raw_score === 'number' && !isNaN(mark.raw_score)
    ? mark.raw_score
    : (typeof (mark as any).score === 'number' && !isNaN((mark as any).score))
      ? (mark as any).score
      : (typeof mark.raw_score === 'string' && (mark.raw_score as string).trim() !== '' && !isNaN(Number(mark.raw_score)))
        ? Number(mark.raw_score)
        : (typeof (mark as any).score === 'string' && ((mark as any).score as string).trim() !== '' && !isNaN(Number((mark as any).score)))
          ? Number((mark as any).score)
          : NaN;

  const numMarks = typeof mark.marks === 'number' && !isNaN(mark.marks)
    ? mark.marks
    : (typeof mark.marks === 'string' && (mark.marks as string).trim() !== '' && !isNaN(Number(mark.marks)))
      ? Number(mark.marks)
      : (typeof (mark as any).percentage === 'number' && !isNaN((mark as any).percentage))
        ? (mark as any).percentage
        : NaN;

  const hasRawScore = !isNaN(numRaw);
  const hasMarks = !isNaN(numMarks);

  if (hasRawScore || hasMarks) {
    const rawScore = hasRawScore ? numRaw : numMarks;
    const isCompInsha = options?.isUpperPrimaryCompOrInsha ?? (
      options?.subject ? isUpperPrimaryCompOrInsha(options.subject, options.classObj, options.educationLevel) : false
    );
    const isLang60 = options?.isUpperPrimaryLanguage ?? (
      options?.subject ? isUpperPrimaryLanguage(options.subject, options.classObj, options.educationLevel) : false
    );

    if (isCompInsha) {
      let outOf = 40;
      if (mark.out_of && mark.out_of > 0 && mark.out_of <= 50) {
        outOf = mark.out_of;
      } else {
        outOf = 40;
      }
      const percentage = outOf > 0 ? (rawScore / outOf) * 100 : rawScore;
      const clampedPct = Math.min(100, Math.max(0, percentage));
      return {
        status: 'Normal',
        percentage: clampedPct,
        rawScore,
        outOf,
        displayScore: `${rawScore}`,
        displayPercentage: `${rawScore}`,
        displayStatus: 'Normal',
        isRawScoreOnly: true,
      };
    }

    let outOf = 100;
    if (isLang60) {
      if (mark.out_of && mark.out_of > 60) {
        outOf = mark.out_of;
      } else {
        outOf = mark.out_of && mark.out_of > 0 && mark.out_of <= 60 ? mark.out_of : 60;
      }
    } else {
      outOf = mark.out_of && mark.out_of > 0 ? mark.out_of : 100;
    }
    const percentage = outOf > 0 ? (rawScore / outOf) * 100 : rawScore;
    const clampedPct = Math.min(100, Math.max(0, percentage));

    return {
      status: 'Normal',
      percentage: clampedPct,
      rawScore,
      outOf,
      displayScore: outOf !== 100 ? `${rawScore}/${outOf}` : formatPercentage(clampedPct),
      displayPercentage: formatPercentage(clampedPct, true),
      displayStatus: 'Normal',
    };
  }

  return {
    status: 'Blank',
    percentage: null,
    rawScore: null,
    outOf: 100,
    displayScore: '',
    displayPercentage: '',
    displayStatus: 'Blank',
  };
}

export const IRREGULARITY_REASONS = [
  'Absent',
  'Examination Malpractice',
  'Withheld Result',
  'Medical Absence',
  'Exempted',
];

/**
 * Consistently rounds a percentage value to the nearest whole number integer, returning a number.
 * E.g., 74.2 -> 74, 74.5 -> 75, 74.8 -> 75
 */
export function roundPercentage(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return null;
  return Math.round(num);
}

/**
 * Formats a percentage or average mark for user display.
 * Displays whole numbers where appropriate (e.g. 56%), or max 1 decimal place without trailing zeros (e.g. 56.3%).
 */
export function formatPercentage(
  val: number | string | null | undefined,
  includeSymbol: boolean = false,
  fallback: string = '-'
): string {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return String(val);

  const rounded = roundPercentage(num);
  if (rounded === null) return fallback;

  const str = String(rounded);
  return includeSymbol ? `${str}%` : str;
}

/**
 * Formats an Average Mark for Merit List display to exactly one decimal place.
 * E.g., 78 -> "78.0", 78.456 -> "78.5", 91.24 -> "91.2", 100 -> "100.0", null -> "-"
 */
export function formatAverageMark(
  val: number | string | null | undefined,
  fallback: string = '-'
): string {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return fallback;
  return (Math.round(num * 10) / 10).toFixed(1);
}

/**
 * Formats a Learning Area / Subject Average Mark for Merit List summary display to exactly two decimal places.
 * E.g., 85.666... -> "85.67", 75 -> "75.00", 59.4 -> "59.40", 68.125 -> "68.13", 80 -> "80.00", null -> "-"
 */
export function formatTwoDecimalAverage(
  val: number | string | null | undefined,
  fallback: string = '-'
): string {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return fallback;
  return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
}

/**
 * Utility to consistently round a numerical mark or percentage to the nearest integer.
 * Handles numbers, numeric strings, and null/undefined values gracefully.
 */
export function roundMark(mark: number | string | null | undefined): number | null {
  if (mark === null || mark === undefined || mark === '') return null;
  const num = typeof mark === 'number' ? mark : parseFloat(String(mark));
  if (isNaN(num)) return null;
  return Math.round(num);
}

/**
 * Abbreviates CBE performance levels to short form (EE, ME, AE, BE).
 */
export function getAbbreviatedLevel(levelStr?: string | null, gradeCode?: string | null): string {
  if (gradeCode) {
    const gc = gradeCode.toUpperCase();
    if (gc.startsWith('EE')) return 'EE';
    if (gc.startsWith('ME')) return 'ME';
    if (gc.startsWith('AE')) return 'AE';
    if (gc.startsWith('BE')) return 'BE';
  }
  if (!levelStr) return '-';
  const str = levelStr.trim().toUpperCase();
  if (str.includes('EXCEEDING') || str === 'EE') return 'EE';
  if (str.includes('MEETING') || str === 'ME') return 'ME';
  if (str.includes('APPROACHING') || str === 'AE') return 'AE';
  if (str.includes('BELOW') || str === 'BE') return 'BE';
  if (str === 'ABSENT' || str === 'X') return 'Absent';
  if (str === 'IRREGULARITY' || str === 'Y') return 'Irregularity';
  if (str === 'PENDING' || str === 'PROVISIONAL') return 'Pending';
  return levelStr;
}

/**
 * Returns concise 1-2 word remarks for tables (e.g., Outstanding, Excellent, Good, Satisfactory, Developing, Needs Support, Intervention Required).
 */
export function getShortRemark(remarkStr?: string | null, gradeCode?: string | null): string {
  if (gradeCode) {
    const gc = gradeCode.toUpperCase();
    if (gc === 'EE1') return 'Outstanding';
    if (gc === 'EE2') return 'Excellent';
    if (gc === 'ME1') return 'Good';
    if (gc === 'ME2') return 'Satisfactory';
    if (gc === 'AE1') return 'Developing';
    if (gc === 'AE2') return 'Needs Support';
    if (gc === 'BE1') return 'Needs Support';
    if (gc === 'BE2') return 'Intervention Required';
  }

  if (!remarkStr) return '-';
  const upper = remarkStr.toUpperCase();
  if (upper.includes('OUTSTANDING')) return 'Outstanding';
  if (upper.includes('EXCELLENT')) return 'Excellent';
  if (upper.includes('GOOD')) return 'Good';
  if (upper.includes('SATISFACTORY')) return 'Satisfactory';
  if (upper.includes('DEVELOPING')) return 'Developing';
  if (upper.includes('NEEDS MORE PRACTICE') || upper.includes('NEEDS PRACTICE')) return 'Needs Support';
  if (upper.includes('NEEDS SUPPORT')) return 'Needs Support';
  if (upper.includes('INTERVENTION') || upper.includes('IMMEDIATE SUPPORT')) return 'Intervention Required';
  if (upper.includes('ABSENT')) return 'Absent';
  if (upper.includes('IRREGULARITY')) return 'Irregularity';
  if (upper.includes('PENDING') || upper.includes('PROVISIONAL')) return 'Pending';

  return remarkStr.length > 20 ? `${remarkStr.substring(0, 18)}..` : remarkStr;
}

export interface CompositeLanguageResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  rawScore: number;
  outOf: number;
  percentage: number;
  componentMarks: {
    language?: { rawScore: number; outOf: number; markRecord?: Mark };
    compositionOrInsha?: { rawScore: number; outOf: number; markRecord?: Mark };
  };
}

/**
 * Checks if a subject is English Language (non-composition)
 */
export function isEnglishLanguage(subject?: { subject_code?: string; code?: string; subject_name?: string; name?: string } | null): boolean {
  if (!subject) return false;
  const code = (subject.subject_code || subject.code || '').trim().toUpperCase();
  const name = (subject.subject_name || subject.name || '').trim().toUpperCase();
  if (code === 'COMP' || name.includes('COMPOSITION')) return false;
  return code === 'ENG' || code === 'ENGLISH' || name.includes('ENGLISH');
}

/**
 * Checks if a subject is Kiswahili Lugha (non-insha)
 */
export function isKiswahiliLugha(subject?: { subject_code?: string; code?: string; subject_name?: string; name?: string } | null): boolean {
  if (!subject) return false;
  const code = (subject.subject_code || subject.code || '').trim().toUpperCase();
  const name = (subject.subject_name || subject.name || '').trim().toUpperCase();
  if (code === 'INSHA' || name.includes('INSHA')) return false;
  return code === 'KIS' || code === 'KISW' || code === 'KISWAHILI' || name.includes('KISWAHILI') || name.includes('LUGHA');
}
/**
 * Checks if a subject represents Social Studies (standalone component, non-composite).
 */
export function isSocialStudies(subject?: { subject_code?: string; code?: string; id?: string; subject_name?: string; name?: string; learning_area?: string } | null): boolean {
  if (!subject) return false;
  const code = (subject.subject_code || subject.code || '').trim().toUpperCase();
  const name = (subject.subject_name || subject.name || subject.learning_area || '').trim().toUpperCase();
  const id = (subject.id || '').trim().toLowerCase();
  if (
    code === 'SS&CRE' ||
    code === 'SS & CRE' ||
    code === 'SS/CRE' ||
    code === 'SST&CRE' ||
    code === 'SST/CRE' ||
    name.includes('SS&CRE') ||
    name.includes('SOCIAL STUDIES&CRE') ||
    name.includes('SOCIAL STUDIES & CRE') ||
    id === 'sb_up_ss_cre' ||
    id === 'f8255683-1d59-46a7-881a-04a25d45d972'
  ) {
    return false;
  }
  return (
    code === 'SST' ||
    code === 'SST UP' ||
    name === 'SOCIAL STUDIES' ||
    id === 'sb_sst' ||
    id === 'sb_up_sst' ||
    id === 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409'
  );
}

/**
 * Checks if a subject represents Christian Religious Education (standalone component, non-composite).
 */
export function isChristianReligiousEducation(subject?: { subject_code?: string; code?: string; id?: string; subject_name?: string; name?: string; learning_area?: string } | null): boolean {
  if (!subject) return false;
  const code = (subject.subject_code || subject.code || '').trim().toUpperCase();
  const name = (subject.subject_name || subject.name || subject.learning_area || '').trim().toUpperCase();
  const id = (subject.id || '').trim().toLowerCase();
  if (
    code === 'SS&CRE' ||
    code === 'SS & CRE' ||
    code === 'SS/CRE' ||
    code === 'SST&CRE' ||
    code === 'SST/CRE' ||
    name.includes('SS&CRE') ||
    name.includes('SOCIAL STUDIES&CRE') ||
    name.includes('SOCIAL STUDIES & CRE') ||
    id === 'sb_up_ss_cre' ||
    id === 'f8255683-1d59-46a7-881a-04a25d45d972'
  ) {
    return false;
  }
  return (
    code === 'CRE' ||
    code === 'C.R.E' ||
    code === 'C.R.E.' ||
    name === 'CHRISTIAN RELIGIOUS EDUCATION' ||
    id === 'sb_cre' ||
    id === 'sb_up_cre' ||
    id === 'e784b5fc-dab9-4105-bb49-fce1d1a84cf7'
  );
}

/**
 * Checks if a subject is historical direct Social Studies & CRE.
 */
export function isDirectSSCRE(subject?: { subject_code?: string; code?: string; id?: string; subject_name?: string; name?: string; learning_area?: string } | null): boolean {
  if (!subject) return false;
  const code = (subject.subject_code || subject.code || '').trim().toUpperCase();
  const name = (subject.subject_name || subject.name || subject.learning_area || '').trim().toUpperCase();
  const id = (subject.id || '').trim().toLowerCase();
  return (
    id === 'f8255683-1d59-46a7-881a-04a25d45d972' ||
    id === 'sb_up_ss_cre' ||
    code === 'SS&CRE' ||
    code === 'SS & CRE' ||
    code === 'SS/CRE' ||
    code === 'SST&CRE' ||
    name.includes('SOCIAL STUDIES&CRE') ||
    name.includes('SOCIAL STUDIES & CRE')
  );
}

/**
 * Given an ss_cre_structure ('A' | 'B' | 'C'), returns the configured maximum scores for SST and CRE.
 */
export function getSSCREComponentMaxMarks(structure?: UpperPrimarySSCREStructure | string | null): { sstMax: number; creMax: number; ssCreMax: number } | null {
  if (!structure) return null;
  const s = String(structure).trim().toUpperCase();
  if (s === 'A') {
    return { sstMax: 30, creMax: 20, ssCreMax: 50 };
  }
  if (s === 'B') {
    return { sstMax: 10, creMax: 10, ssCreMax: 20 };
  }
  if (s === 'C') {
    return { sstMax: 20, creMax: 30, ssCreMax: 50 };
  }
  return null;
}

/**
 * For Upper Primary students, merges ENG (/60) + COMP (/40) into English (/100),
 * KISW (/60) + INSHA (/40) into Kiswahili (/100),
 * and SST + CRE into SS&CRE based on the authoritative examination ss_cre_structure ('A', 'B', or 'C').
 *
 * Preserves historical direct SS&CRE marks (sb_up_ss_cre) and enforces explicit conflict surfacing
 * if both direct and component marks exist for the same learner in the same assessment.
 */
export function getUpperPrimaryCompositeSubjectMarks(
  studentMarks: Mark[],
  subjects: { id: string; subject_code?: string; code?: string; subject_name?: string; name?: string; education_level?: string }[],
  educationLevel?: string | null,
  examOrStructure?: Examination | UpperPrimarySSCREStructure | string | null
): {
  processedMarks: Mark[];
  syntheticSubjects: Subject[];
} {
  if (educationLevel !== 'Upper Primary') {
    return { processedMarks: studentMarks, syntheticSubjects: [] };
  }

  let engLangSub: any = null;
  let engCompSub: any = null;
  let kiswLangSub: any = null;
  let kiswInshaSub: any = null;
  let sstSub: any = null;
  let creSub: any = null;
  let directSsCreSub: any = null;

  subjects.forEach(s => {
    if (isEnglishLanguage(s)) engLangSub = s;
    if (isUpperPrimaryCompOrInsha(s, null, 'Upper Primary') && ((s.subject_code || '').toUpperCase() === 'COMP' || (s.subject_name || '').toUpperCase().includes('COMPOSITION'))) engCompSub = s;
    if (isKiswahiliLugha(s)) kiswLangSub = s;
    if (isUpperPrimaryCompOrInsha(s, null, 'Upper Primary') && ((s.subject_code || '').toUpperCase() === 'INSHA' || (s.subject_name || '').toUpperCase().includes('INSHA'))) kiswInshaSub = s;
    if (isSocialStudies(s)) sstSub = s;
    if (isChristianReligiousEducation(s)) creSub = s;
    if (isDirectSSCRE(s)) directSsCreSub = s;
  });

  const processed: Mark[] = [];
  const syntheticSubs: any[] = [];
  const handledSubjectIds = new Set<string>();

  // 1. English Composite: ENG (60) + COMP (40) -> English (100)
  if (engLangSub && engCompSub) {
    handledSubjectIds.add(engLangSub.id);
    handledSubjectIds.add(engCompSub.id);

    const engMark = studentMarks.find(m => m.subject_id === engLangSub.id);
    const compMark = studentMarks.find(m => m.subject_id === engCompSub.id);

    const evalEng = evaluateMark(engMark);
    const evalComp = evaluateMark(compMark, { isUpperPrimaryCompOrInsha: true, subject: engCompSub, educationLevel: 'Upper Primary' });

    if (evalEng.status === 'Normal' || evalComp.status === 'Normal') {
      const engRaw = evalEng.rawScore ?? 0;
      const compRaw = evalComp.rawScore ?? 0;
      const totalRaw = engRaw + compRaw;

      const synthId = 'synth_english_composite';
      syntheticSubs.push({
        id: synthId,
        subject_name: 'English',
        subject_code: 'ENG',
        category: 'Core' as const,
        education_level: 'Upper Primary',
      });

      processed.push({
        id: 'synth_mark_english',
        exam_id: engMark?.exam_id || compMark?.exam_id || '',
        student_id: engMark?.student_id || compMark?.student_id || '',
        subject_id: synthId,
        score: totalRaw,
        marks: totalRaw,
        raw_score: totalRaw,
        out_of: 100,
        percentage: totalRaw,
        special_status: 'Normal',
        is_synthetic: true,
      });
    }
  }

  // 2. Kiswahili Composite: KIS (60) + INSHA (40) -> Kiswahili (100)
  if (kiswLangSub && kiswInshaSub) {
    handledSubjectIds.add(kiswLangSub.id);
    handledSubjectIds.add(kiswInshaSub.id);

    const kiswMark = studentMarks.find(m => m.subject_id === kiswLangSub.id);
    const inshaMark = studentMarks.find(m => m.subject_id === kiswInshaSub.id);

    const evalKisw = evaluateMark(kiswMark);
    const evalInsha = evaluateMark(inshaMark, { isUpperPrimaryCompOrInsha: true, subject: kiswInshaSub, educationLevel: 'Upper Primary' });

    if (evalKisw.status === 'Normal' || evalInsha.status === 'Normal') {
      const kiswRaw = evalKisw.rawScore ?? 0;
      const inshaRaw = evalInsha.rawScore ?? 0;
      const totalRaw = kiswRaw + inshaRaw;

      const synthId = 'synth_kiswahili_composite';
      syntheticSubs.push({
        id: synthId,
        subject_name: 'Kiswahili',
        subject_code: 'KIS',
        category: 'Core' as const,
        education_level: 'Upper Primary',
      });

      processed.push({
        id: 'synth_mark_kiswahili',
        exam_id: kiswMark?.exam_id || inshaMark?.exam_id || '',
        student_id: kiswMark?.student_id || inshaMark?.student_id || '',
        subject_id: synthId,
        score: totalRaw,
        marks: totalRaw,
        raw_score: totalRaw,
        out_of: 100,
        percentage: totalRaw,
        special_status: 'Normal',
        is_synthetic: true,
      });
    }
  }

  // 3. Social Studies & CRE Composite (SST + CRE -> SS&CRE)
  const structureCode: UpperPrimarySSCREStructure | null =
    typeof examOrStructure === 'string'
      ? (examOrStructure as UpperPrimarySSCREStructure)
      : (examOrStructure?.ss_cre_structure || null);
  const sstCreMaxes = getSSCREComponentMaxMarks(structureCode);

  const sstMark = sstSub
    ? studentMarks.find(m => m.subject_id === sstSub.id)
    : studentMarks.find(m => isSocialStudies({ id: m.subject_id }));
  const creMark = creSub
    ? studentMarks.find(m => m.subject_id === creSub.id)
    : studentMarks.find(m => isChristianReligiousEducation({ id: m.subject_id }));
  const directSsCreMark = directSsCreSub
    ? studentMarks.find(m => m.subject_id === directSsCreSub.id)
    : studentMarks.find(m => isDirectSSCRE({ id: m.subject_id }));

  const evalDirect = evaluateMark(directSsCreMark);
  const evalSst = evaluateMark(sstMark);
  const evalCre = evaluateMark(creMark);

  const hasDirectMark = evalDirect.status === 'Normal' || evalDirect.status === 'X' || evalDirect.status === 'Y';
  const hasComponentMarks = evalSst.status === 'Normal' || evalSst.status === 'X' || evalSst.status === 'Y' ||
                            evalCre.status === 'Normal' || evalCre.status === 'X' || evalCre.status === 'Y';

  // CRITICAL CONFLICT RULE:
  // If a learner has BOTH SST component, CRE component, and an existing direct SS&CRE mark for the SAME assessment:
  // DO NOT silently choose one. DO NOT overwrite one with the other. DO NOT invent precedence. DO NOT delete either record.
  // Surface the conflict through the existing error/diagnostic mechanism.
  if (hasDirectMark && hasComponentMarks) {
    console.error(
      `[SS&CRE CONFLICT] Learner ${directSsCreMark?.student_id || sstMark?.student_id} has both direct SS&CRE mark and component SST/CRE marks for exam ${directSsCreMark?.exam_id || sstMark?.exam_id}. Unresolved implementation conflict: neither record was chosen or overwritten.`
    );
    const conflictedMark: Mark = {
      ...directSsCreMark!,
      special_status: 'Y',
      irregularity_reason: 'Conflict: Both direct SS&CRE mark and SST/CRE component marks exist',
      is_synthetic: true,
    };
    processed.push(conflictedMark);
    if (directSsCreMark) handledSubjectIds.add(directSsCreMark.subject_id);
    if (sstMark) handledSubjectIds.add(sstMark.subject_id);
    if (creMark) handledSubjectIds.add(creMark.subject_id);
  } else if (sstCreMaxes && (sstSub || creSub || sstMark || creMark) && !hasDirectMark) {
    if (sstSub) handledSubjectIds.add(sstSub.id);
    if (creSub) handledSubjectIds.add(creSub.id);
    if (sstMark) handledSubjectIds.add(sstMark.subject_id);
    if (creMark) handledSubjectIds.add(creMark.subject_id);

    const synthId = directSsCreSub?.id || 'sb_up_ss_cre';
    syntheticSubs.push({
      id: synthId,
      subject_name: directSsCreSub?.subject_name || 'Social Studies&CRE',
      subject_code: directSsCreSub?.subject_code || 'SS&CRE',
      category: 'Core' as const,
      education_level: 'Upper Primary',
    });

    const isSstSubmitted = evalSst.status === 'Normal' || evalSst.status === 'X' || evalSst.status === 'Y';
    const isCreSubmitted = evalCre.status === 'Normal' || evalCre.status === 'X' || evalCre.status === 'Y';

    if (evalSst.status === 'Y' || evalCre.status === 'Y') {
      processed.push({
        id: 'synth_mark_ss_cre',
        exam_id: sstMark?.exam_id || creMark?.exam_id || '',
        student_id: sstMark?.student_id || creMark?.student_id || '',
        subject_id: synthId,
        marks: 0,
        score: null,
        raw_score: null,
        out_of: sstCreMaxes.ssCreMax,
        percentage: 0,
        special_status: 'Y',
        irregularity_reason: evalSst.irregularityReason || evalCre.irregularityReason || 'Irregularity',
        is_synthetic: true,
      });
    } else if (evalSst.status === 'X' && evalCre.status === 'X') {
      processed.push({
        id: 'synth_mark_ss_cre',
        exam_id: sstMark?.exam_id || creMark?.exam_id || '',
        student_id: sstMark?.student_id || creMark?.student_id || '',
        subject_id: synthId,
        marks: 0,
        score: null,
        raw_score: null,
        out_of: sstCreMaxes.ssCreMax,
        percentage: 0,
        special_status: 'X',
        irregularity_reason: 'Absent',
        is_synthetic: true,
      });
    } else if (isSstSubmitted && isCreSubmitted && (evalSst.status === 'Normal' || evalCre.status === 'Normal')) {
      const sstRaw = evalSst.status === 'Normal' ? (evalSst.rawScore ?? 0) : 0;
      const creRaw = evalCre.status === 'Normal' ? (evalCre.rawScore ?? 0) : 0;
      const totalRaw = sstRaw + creRaw;
      const pct = sstCreMaxes.ssCreMax > 0 ? (totalRaw / sstCreMaxes.ssCreMax) * 100 : totalRaw;

      processed.push({
        id: 'synth_mark_ss_cre',
        exam_id: sstMark?.exam_id || creMark?.exam_id || '',
        student_id: sstMark?.student_id || creMark?.student_id || '',
        subject_id: synthId,
        score: totalRaw,
        marks: totalRaw,
        raw_score: totalRaw,
        out_of: sstCreMaxes.ssCreMax,
        percentage: pct,
        is_synthetic: true,
      });
    }
  }

  // 4. Pass through all other unhandled marks (including direct historical SS&CRE marks)
  studentMarks.forEach(m => {
    if (!handledSubjectIds.has(m.subject_id)) {
      processed.push(m);
    }
  });

  return { processedMarks: processed, syntheticSubjects: syntheticSubs };
}



