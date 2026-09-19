/**
 * Kiswahili Learning Area Comment Validator & Utility
 * 
 * Enforces:
 * 1. Authoritative identification of the Kiswahili learning area across all education tiers.
 * 2. Compulsory non-empty comment enforcement for Kiswahili.
 * 3. Linguistic validation ensuring Kiswahili learning-area remarks are written in Kiswahili.
 * 4. Authentic CBE Kiswahili default assessment remarks.
 */

export interface SubjectIdentifier {
  id?: string;
  subject_code?: string;
  subject_name?: string;
}

/**
 * Reliably identifies whether a learning area / subject is Kiswahili.
 * Checks authoritative attributes:
 * - subject_name: contains "kiswahili" (case-insensitive)
 * - subject_code: starts with "KIS" (e.g. KIS, KISW, KIS-07, KIS-JS, KIS UP) or is "LP-KSL"
 * - id: matches standard seeded Kiswahili identifiers (e.g. sb_kis, sb_up_kis, sb_lp_kis)
 */
export function isKiswahiliSubject(subject: SubjectIdentifier | null | undefined): boolean {
  if (!subject) return false;
  
  const name = (subject.subject_name || '').trim().toLowerCase();
  if (name.includes('kiswahili')) return true;

  const code = (subject.subject_code || '').trim().toUpperCase();
  if (code.startsWith('KIS') || code === 'LP-KSL' || code === 'KISW' || code === 'KIS-JS' || code === 'KIS UP') {
    return true;
  }

  const id = (subject.id || '').trim().toLowerCase();
  if (id === 'sb_kis' || id === 'sb_up_kis' || id === 'sb_lp_kis' || id.startsWith('sub-kisw') || id.startsWith('sub_kis')) {
    return true;
  }

  return false;
}

/**
 * Returns authentic Kenya CBE Kiswahili assessment performance remarks.
 */
export function getKiswahiliDefaultComment(
  scoreOrPercentage: number | null | undefined,
  status?: string,
  irregularityReason?: string
): string {
  if (status === 'X') {
    return 'Hajafanya Tathmini (X)';
  }
  if (status === 'Y') {
    return irregularityReason ? `Hitilafu (${irregularityReason})` : 'Hitilafu ya Mtihani (Y)';
  }
  if (scoreOrPercentage === null || scoreOrPercentage === undefined || isNaN(scoreOrPercentage)) {
    return 'Hajathibitishwa';
  }

  const score = Math.round(scoreOrPercentage);
  if (score >= 90) return 'Uwezo wa Juu Zaidi - Kazi Nzuri Sana';
  if (score >= 75) return 'Kazi Bora Sana - Amepita Matarajio';
  if (score >= 58) return 'Kazi Nzuri - Anafikia Matarajio';
  if (score >= 41) return 'Kazi ya Wastani - Anakaribia Matarajio';
  if (score >= 31) return 'Anahitaji Mazoezi Zaidi';
  if (score >= 21) return 'Anahitaji Mazoezi na Mwongozo Zaidi';
  if (score >= 11) return 'Anahitaji Msaada Zaidi';
  return 'Usaidizi wa Haraka Unahitajika';
}

// Common English educational remarks & stop words that must be rejected for Kiswahili
const ENGLISH_COMMENT_PATTERNS = [
  /\b(outstanding|excellent|good|satisfactory|developing|competency)\b/i,
  /\b(needs|requires|intervention|immediate|support|practice)\b/i,
  /\b(exceeding|meeting|approaching|below)\s+expectations\b/i,
  /\b(keep\s+it\s+up|well\s+done|good\s+work|good\s+job|work\s+hard)\b/i,
  /\b(improvement|progress|effort|performance|learner|student|pupil)\b/i,
  /\b(missing\s+assessment|irregularity|not\s+assessed)\b/i,
];

const ENGLISH_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'and', 'in', 'on', 'at', 'to', 'for', 'with',
  'a', 'an', 'of', 'by', 'from', 'has', 'have', 'had', 'do', 'does', 'did',
  'good', 'very', 'well', 'done', 'great', 'excellent', 'outstanding', 'satisfactory',
  'performance', 'progress', 'improvement', 'needs', 'practice', 'more', 'work', 'hard',
  'keep', 'it', 'up', 'student', 'learner', 'pupil', 'teacher', 'class', 'subject',
  'score', 'grade', 'marks', 'exceeding', 'meeting', 'approaching', 'below', 'expectations',
  'requires', 'intervention', 'support', 'effort', 'fair', 'poor', 'weak', 'better', 'best'
]);

// Kiswahili pedagogical keywords, descriptors, and vocabulary
const KISWAHILI_WORDS = new Set([
  'kazi', 'nzuri', 'bora', 'sana', 'amepita', 'anapita', 'matarajio', 'anafikia', 'anakaribia',
  'chini', 'ya', 'uwezo', 'juu', 'zaidi', 'wastani', 'bidii', 'ongeza', 'aongeze', 'kuelewa',
  'kusoma', 'kuandika', 'stadi', 'msaada', 'mazoezi', 'shughuli', 'mwanafunzi', 'maendeleo',
  'vizuri', 'inahitajika', 'inastahili', 'lugha', 'kusikiliza', 'kuzungumza', 'ufahamu', 'insha',
  'sarufi', 'kusifu', 'pongezi', 'jitihada', 'kuimarisha', 'mashairi', 'fasihi', 'msamiati',
  'kuthamini', 'nidhamu', 'ushirikiano', 'hajafanya', 'hitilafu', 'tathmini', 'matokeo', 'alama',
  'daraja', 'kufanya', 'kushiriki', 'akifanya', 'akijitahidi', 'mwongozo', 'usaidizi', 'haraka',
  'anahitaji', 'anajua', 'anaweza', 'amejitahidi', 'ameimarika', 'ameweka', 'kufikia', 'kuzidi',
  'kupita', 'hodari', 'mwenendo', 'tabia', 'aendelee', 'kuendelea', 'kujitahidi', 'vyema',
  'kamili', 'jumla', 'tuzo', 'mwalimu', 'somo', 'masomo', 'mwanzo', 'mwisho', 'muhula', 'shule',
  'darasa', 'mtihani', 'mjarabu', 'hongera', 'vizuri', 'heshima', 'ustadi', 'kamilifu', 'makini',
  'taratibu', 'kielelezo', 'mifano', 'marudio', 'kuhesabu', 'kutunga', 'hadithi', 'methali',
  'nahau', 'vitendawili', 'fumbo', 'msingi', 'uhodari', 'kujiamini', 'kushirikiana', 'kupendeza'
]);

export interface ValidationResult {
  isValid: boolean;
  isLanguageValid: boolean;
  error?: string;
  reason?: 'EMPTY_COMMENT' | 'NOT_IN_KISWAHILI';
}

/**
 * Validates that a Kiswahili comment is:
 * 1. Present and non-empty (compulsory).
 * 2. Written in Kiswahili (rejects English commentary, auto-generated English phrases, and non-Kiswahili text).
 */
export function validateKiswahiliComment(comment: string | null | undefined): ValidationResult {
  if (!comment || typeof comment !== 'string' || !comment.trim()) {
    return {
      isValid: false,
      isLanguageValid: false,
      error: 'Maoni ya somo la Kiswahili yanahitajika. Tafadhali andika maoni kwa lugha ya Kiswahili. (Kiswahili comment is required. Please enter the learner\'s comment in Kiswahili.)',
      reason: 'EMPTY_COMMENT',
    };
  }

  const trimmed = comment.trim();

  // Explicitly check for known English template phrases
  for (const pattern of ENGLISH_COMMENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        isLanguageValid: false,
        error: 'Maoni ya somo la Kiswahili lazima yaandikwe kwa lugha ya Kiswahili. (Kiswahili comment must be written in Kiswahili language.)',
        reason: 'NOT_IN_KISWAHILI',
      };
    }
  }

  // Tokenize words
  const words = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return {
      isValid: false,
      isLanguageValid: false,
      error: 'Maoni ya somo la Kiswahili yanahitajika. Tafadhali andika maoni kwa lugha ya Kiswahili.',
      reason: 'EMPTY_COMMENT',
    };
  }

  let englishCount = 0;
  let kiswahiliCount = 0;

  for (const word of words) {
    if (ENGLISH_WORDS.has(word)) {
      englishCount++;
    }
    if (KISWAHILI_WORDS.has(word)) {
      kiswahiliCount++;
    } else {
      // Check typical Kiswahili agglutinative verbal prefix/morpheme patterns
      // (e.g. a-na-..., a-me-..., wa-na-..., ki-na-..., a-li-..., ku-..., u-...)
      if (/^(a|wa|ki|vi|m|mi|ji|ma|u|ku|i|zi|ya)(na|li|me|ta|ki|ka|ja|ji)[a-z]{2,}/.test(word)) {
        kiswahiliCount++;
      } else if (/^[a-z]{2,}(ishia|shika|ana|ika|eka|isha|esha|ana|eni|wa)$/.test(word)) {
        kiswahiliCount++;
      }
    }
  }

  // If English words dominate, reject as non-Kiswahili
  if (englishCount > 0 && englishCount >= kiswahiliCount) {
    return {
      isValid: false,
      isLanguageValid: false,
      error: 'Maoni ya somo la Kiswahili lazima yaandikwe kwa lugha ya Kiswahili. (Kiswahili comment must be written in Kiswahili language.)',
      reason: 'NOT_IN_KISWAHILI',
    };
  }

  return {
    isValid: true,
    isLanguageValid: true,
  };
}
