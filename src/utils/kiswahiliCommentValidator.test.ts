import {
  isKiswahiliSubject,
  getKiswahiliDefaultComment,
  validateKiswahiliComment,
} from './kiswahiliCommentValidator';

export function runKiswahiliValidatorTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
      console.log(`✓ PASS: ${msg}`);
    } else {
      failed++;
      console.error(`✗ FAIL: ${msg}`);
    }
  }

  console.log('=== RUNNING KISWAHILI COMMENT VALIDATOR TESTS ===');

  // PART 2 — Authoritative Kiswahili Identification
  assert(isKiswahiliSubject({ subject_name: 'Kiswahili' }), 'identifies Kiswahili by name');
  assert(isKiswahiliSubject({ subject_name: 'Kiswahili Language Activities / Kenya Sign Language' }), 'identifies Kiswahili activities by name');
  assert(isKiswahiliSubject({ subject_name: 'Kiswahili Language' }), 'identifies Kiswahili Language by name');
  assert(isKiswahiliSubject({ subject_name: 'KISWAHILI' }), 'identifies KISWAHILI uppercase');
  assert(isKiswahiliSubject({ subject_code: 'KIS' }), 'identifies KIS code');
  assert(isKiswahiliSubject({ subject_code: 'KISW' }), 'identifies KISW code');
  assert(isKiswahiliSubject({ subject_code: 'KIS-07' }), 'identifies KIS-07 code');
  assert(isKiswahiliSubject({ subject_code: 'KIS-JS' }), 'identifies KIS-JS code');
  assert(isKiswahiliSubject({ subject_code: 'LP-KSL' }), 'identifies LP-KSL code');
  assert(isKiswahiliSubject({ id: 'sb_kis' }), 'identifies sb_kis id');
  assert(isKiswahiliSubject({ id: 'sb_up_kis' }), 'identifies sb_up_kis id');
  assert(isKiswahiliSubject({ id: 'sb_lp_kis' }), 'identifies sb_lp_kis id');
  assert(!isKiswahiliSubject({ subject_name: 'English Language', subject_code: 'ENG' }), 'does not identify English as Kiswahili');
  assert(!isKiswahiliSubject({ subject_name: 'Mathematics', subject_code: 'MAT' }), 'does not identify Math as Kiswahili');
  assert(!isKiswahiliSubject({ subject_name: 'Integrated Science', subject_code: 'INT-SCI' }), 'does not identify Science as Kiswahili');
  assert(!isKiswahiliSubject(null), 'handles null subject');
  assert(!isKiswahiliSubject(undefined), 'handles undefined subject');

  // PART 3 & 4 — Compulsory & Language Validation for Kiswahili
  const validComments = [
    'Kazi nzuri sana, amezidi kuimarika katika usomaji.',
    'Amepita matarajio katika kusoma na kuandika.',
    'Anafikia matarajio, aongeze bidii katika insha na sarufi.',
    'Uwezo wa juu zaidi - kazi nzuri.',
    'Kazi bora sana, anajitahidi vyema.',
    'Anahitaji mazoezi zaidi katika uandishi wa sentensi.',
    'Hongera kwa matokeo mazuri muhula huu.',
    'Uwezo wa Juu Zaidi - Kazi Nzuri Sana',
    'Hajafanya Tathmini (X)',
    'Hitilafu ya Mtihani (Y)',
  ];
  for (const comment of validComments) {
    const res = validateKiswahiliComment(comment);
    assert(res.isValid && res.isLanguageValid, `valid Kiswahili comment: "${comment}"`);
  }

  // Empty comment validation (compulsory)
  const emptyRes1 = validateKiswahiliComment('');
  assert(!emptyRes1.isValid && emptyRes1.reason === 'EMPTY_COMMENT', 'empty string fails validation');
  const emptyRes2 = validateKiswahiliComment(null);
  assert(!emptyRes2.isValid && emptyRes2.reason === 'EMPTY_COMMENT', 'null comment fails validation');
  const emptyRes3 = validateKiswahiliComment('     ');
  assert(!emptyRes3.isValid && emptyRes3.reason === 'EMPTY_COMMENT', 'whitespace-only comment fails validation');

  // English comments fail language check
  const englishComments = [
    'Outstanding Performance',
    'Excellent Performance',
    'Good Performance',
    'Satisfactory Performance',
    'Developing Competency',
    'Needs More Practice',
    'Requires Intervention',
    'Immediate Support Required',
    'Exceeding Expectations',
    'Meeting Expectations',
    'Good progress this term',
  ];
  for (const comment of englishComments) {
    const res = validateKiswahiliComment(comment);
    assert(!res.isValid && !res.isLanguageValid && res.reason === 'NOT_IN_KISWAHILI', `English rejected for Kiswahili: "${comment}"`);
  }

  // Default remarks resolution
  assert(getKiswahiliDefaultComment(95) === 'Uwezo wa Juu Zaidi - Kazi Nzuri Sana', 'default comment for 95%');
  assert(getKiswahiliDefaultComment(80) === 'Kazi Bora Sana - Amepita Matarajio', 'default comment for 80%');
  assert(getKiswahiliDefaultComment(65) === 'Kazi Nzuri - Anafikia Matarajio', 'default comment for 65%');
  assert(getKiswahiliDefaultComment(50) === 'Kazi ya Wastani - Anakaribia Matarajio', 'default comment for 50%');
  assert(getKiswahiliDefaultComment(35) === 'Anahitaji Mazoezi Zaidi', 'default comment for 35%');
  assert(getKiswahiliDefaultComment(25) === 'Anahitaji Mazoezi na Mwongozo Zaidi', 'default comment for 25%');
  assert(getKiswahiliDefaultComment(15) === 'Anahitaji Msaada Zaidi', 'default comment for 15%');
  assert(getKiswahiliDefaultComment(5) === 'Usaidizi wa Haraka Unahitajika', 'default comment for 5%');
  assert(getKiswahiliDefaultComment(null, 'X') === 'Hajafanya Tathmini (X)', 'default comment for X mark');
  assert(getKiswahiliDefaultComment(null, 'Y', 'Impersonation') === 'Hitilafu (Impersonation)', 'default comment for Y mark');

  console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runKiswahiliValidatorTests();
