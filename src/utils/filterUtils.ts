import { Student, ClassStream, Examination, getEducationLevelForGrade } from '../types';
import { getLearnerClassAtExamTime, LearnerExamContext } from '../services/historicalContextResolver';

function extractGradeName(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\b(Grade\s+\d+|PP\d+|Grade\s+10|Playgroup)\b/i);
  return match ? match[1] : null;
}

/**
 * Filter students by selected Class and Stream according to CBE requirements:
 * - If stream filter = 'all' or 'All Streams': filter by class level / class_id only (includes all streams of that class, e.g., Grade 8 RED, Grade 8 BLUE, Grade 8 East, Grade 8 West).
 * - Else: filter by class_id AND stream_id.
 * - If class filter = 'all': returns all students or filters by specific stream if selected.
 * 
 * If an examination is provided, historical context (getLearnerClassAtExamTime) is used to resolve each learner's
 * class_id, stream_id, class_name, and stream_name at the time of that examination.
 */
export function getFilteredStudents(
  students: Student[] = [],
  classes: ClassStream[] = [],
  selectedClassIdOrName: string = 'all',
  selectedStreamIdOrName: string = 'all',
  examination?: Examination | null
): Student[] {
  if (!students || students.length === 0) return [];
  
  const isClassAll = !selectedClassIdOrName || selectedClassIdOrName === 'all';
  const isStreamAll =
    !selectedStreamIdOrName ||
    selectedStreamIdOrName === 'all' ||
    selectedStreamIdOrName === 'All Streams';

  if (isClassAll && isStreamAll) {
    return students;
  }

  // 1. Determine target class name (e.g., "Grade 8") and matching class IDs
  let targetClassName: string | null = null;
  let matchingClassIds: string[] = [];

  if (!isClassAll) {
    // Check if selectedClassIdOrName is a specific ClassStream ID or Stream ID (e.g. "cls_8e")
    const foundById = classes.find((c) => c.id === selectedClassIdOrName || c.stream_id === selectedClassIdOrName);
    if (foundById) {
      targetClassName = foundById.class_name;
      // All ClassStream IDs belonging to this class level (e.g. Grade 8 East + Grade 8 West)
      matchingClassIds = classes
        .filter((c) => (c.class_name || '').toLowerCase() === (targetClassName || '').toLowerCase())
        .map((c) => c.id);
    } else {
      // Check if selectedClassIdOrName is a class level name directly (e.g. "Grade 8")
      const matchingByName = classes.filter(
        (c) => (c.class_name || '').toLowerCase() === (selectedClassIdOrName || '').toLowerCase()
      );
      if (matchingByName.length > 0) {
        targetClassName = matchingByName[0].class_name;
        matchingClassIds = matchingByName.map((c) => c.id);
      } else {
        // Fallback: exact match on class_id string
        matchingClassIds = [selectedClassIdOrName];
      }
    }
  }

  // 2. Filter students
  return students.filter((s) => {
    if (!s) return false;

    let studentClassId: string;
    let studentStreamId: string;
    let studentClassName: string;
    let studentStreamName: string;
    let studentClassObj: ClassStream | undefined;

    if (examination) {
      const historicalContext = getLearnerClassAtExamTime(s, examination, classes);
      studentClassId = historicalContext.class_id;
      studentStreamId = historicalContext.stream_id;
      studentClassName = historicalContext.class_name || historicalContext.grade || '';
      studentStreamName = historicalContext.stream_name || '';
      studentClassObj =
        (s.stream_id ? classes.find((c) => c.stream_id === s.stream_id) : undefined) ||
        (studentStreamId ? classes.find((c) => c.stream_id === studentStreamId) : undefined) ||
        classes.find((c) => c.id === studentClassId);
    } else {
      studentClassId = s.class_id;
      studentStreamId = s.stream_id || '';
      studentClassObj =
        (s.stream_id ? classes.find((c) => c.stream_id === s.stream_id) : undefined) ||
        classes.find((c) => c.id === s.class_id);
      studentClassName = studentClassObj ? studentClassObj.class_name : '';
      studentStreamName = studentClassObj ? studentClassObj.stream : '';
    }

    // Class Match Check
    let matchesClass = false;
    if (isClassAll) {
      matchesClass = true;
    } else if (targetClassName) {
      matchesClass =
        (!!studentClassId && matchingClassIds.includes(studentClassId)) ||
        (!!studentClassName &&
          studentClassName.toLowerCase() === targetClassName.toLowerCase());
    } else {
      matchesClass = studentClassId === selectedClassIdOrName || (studentClassObj && (studentClassObj.id === selectedClassIdOrName || studentClassObj.stream_id === selectedClassIdOrName));
    }

    if (!matchesClass) return false;

    // Stream Match Check
    if (isStreamAll) {
      // IF stream filter = All Streams: filter by class_id / class level only
      return true;
    }

    // Find matching stream objects from classes list
    const matchingStreamObjs = classes.filter((c) => {
      const matchesStreamId = Boolean(c.stream_id && c.stream_id === selectedStreamIdOrName);
      const matchesName = Boolean(c.stream && c.stream.trim().toLowerCase() === (selectedStreamIdOrName || '').trim().toLowerCase());
      const matchesIdOnly = !c.stream_id && c.id === selectedStreamIdOrName;
      const isMatch = matchesStreamId || matchesName || matchesIdOnly;
      if (!isClassAll && targetClassName) {
        return isMatch && (c.class_name || '').toLowerCase() === targetClassName.toLowerCase();
      }
      return isMatch;
    });

    let matchesStream = false;

    if (matchingStreamObjs.length > 0) {
      matchesStream = matchingStreamObjs.some((targetStreamObj) => {
        // 1. Student's stream_id equals target's stream_id
        if (studentStreamId) {
          if (targetStreamObj.stream_id && studentStreamId === targetStreamObj.stream_id) {
            return true;
          }
          if (!targetStreamObj.stream_id && studentStreamId === targetStreamObj.id) {
            return true;
          }
        }
        // 2. Student's classObj stream_id equals target's stream_id
        if (studentClassObj) {
          if (studentClassObj.stream_id && targetStreamObj.stream_id && studentClassObj.stream_id === targetStreamObj.stream_id) {
            return true;
          }
        }
        // 3. Student's stream name matches target's stream name AND class names match
        if (studentStreamName && targetStreamObj.stream && studentStreamName.trim().toLowerCase() === targetStreamObj.stream.trim().toLowerCase()) {
          if (isClassAll || (studentClassName && targetStreamObj.class_name && studentClassName.trim().toLowerCase() === targetStreamObj.class_name.trim().toLowerCase())) {
            return true;
          }
        }
        return false;
      });
    } else {
      // Fallback if selectedStreamIdOrName was not found as a known ClassStream object
      matchesStream =
        (!!studentStreamId && studentStreamId === selectedStreamIdOrName) ||
        (!!studentStreamName && studentStreamName.trim().toLowerCase() === (selectedStreamIdOrName || '').trim().toLowerCase());
    }

    return !!matchesStream;
  });
}

/**
 * Get display label for selected class and stream
 */
export function getClassStreamLabel(
  classes: ClassStream[],
  selectedClassIdOrName: string = 'all',
  selectedStreamIdOrName: string = 'all',
  examination?: Examination | null
): string {
  const isClassAll = !selectedClassIdOrName || selectedClassIdOrName === 'all';
  const isStreamAll =
    !selectedStreamIdOrName ||
    selectedStreamIdOrName === 'all' ||
    selectedStreamIdOrName === 'All Streams';

  if (isClassAll && isStreamAll) {
    const uniqueNames = Array.from(new Set((classes || []).map((c) => c.class_name))).filter(Boolean);
    if (uniqueNames.length === 1) {
      return `${uniqueNames[0]} (All Streams)`;
    }
    if (examination?.education_level && (examination.education_level as any) !== 'all' && (examination.education_level as any) !== 'All Levels') {
      return `All ${examination.education_level} Classes (All Streams)`;
    }
    return 'All Classes (All Streams)';
  }

  const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  let className = selectedClassIdOrName;
  if (!isClassAll) {
    const clsById = classes.find((c) => c.id === selectedClassIdOrName);
    if (clsById) {
      className = clsById.class_name;
    } else {
      const clsByName = classes.find(
        (c) => (c.class_name || '').toLowerCase() === (selectedClassIdOrName || '').toLowerCase()
      );
      if (clsByName) {
        className = clsByName.class_name;
      } else if (isUUID(selectedClassIdOrName)) {
        className = 'All Classes';
      }
    }
  } else if (classes && classes.length > 0) {
    const uniqueNames = Array.from(new Set(classes.map((c) => c.class_name))).filter(Boolean);
    if (uniqueNames.length === 1) {
      className = uniqueNames[0];
    }
  }

  if (isStreamAll || isUUID(selectedStreamIdOrName)) {
    const streamObj = classes.find((c) => c.stream_id === selectedStreamIdOrName || c.id === selectedStreamIdOrName);
    if (streamObj && streamObj.stream && !isUUID(streamObj.stream)) {
      return `${streamObj.class_name} ${streamObj.stream}`;
    }
    return `${className} (All Streams)`;
  }

  const streamObj = classes.find((c) => c.stream_id === selectedStreamIdOrName || c.id === selectedStreamIdOrName);
  if (streamObj && streamObj.stream && !isUUID(streamObj.stream)) {
    return `${streamObj.class_name} ${streamObj.stream}`;
  }

  const streamByStream = classes.find(
    (c) => (c.stream || '').toLowerCase() === (selectedStreamIdOrName || '').toLowerCase()
  );
  if (streamByStream && streamByStream.stream && !isUUID(streamByStream.stream)) {
    return `${streamByStream.class_name} ${streamByStream.stream}`;
  }

  if (selectedStreamIdOrName && !isUUID(selectedStreamIdOrName) && !(className || '').toLowerCase().includes((selectedStreamIdOrName || '').toLowerCase())) {
    return `${className} ${selectedStreamIdOrName}`;
  }

  return `${className} (All Streams)`;
}

/**
 * Formats standard CBE Examination Code in the administrative format:
 * [CLASS]-[TERM]-[YEAR]-[EXAM SHORT CODE]
 * Examples: "PP1-T2-2026-MT2", "PP2-T2-2026-MT2", "G1-T2-2026-MT2", "G7-T2-2026-ET2"
 */
export function formatStandardExamCode(
  gradeOrClass: string,
  exam?: Partial<Examination> | null
): string {
  // 1. Authoritative check: if exam has an explicit pre-configured exam_code
  // that follows the clean hyphenated format and has no legacy concatenation defects (e.g. ALLSTREAMS, TTERM)
  const rawCode = ((exam as any)?.exam_code || (exam as any)?.code || '').trim();
  if (
    rawCode &&
    !rawCode.toUpperCase().includes('ALLSTREAMS') &&
    !rawCode.toUpperCase().includes('TTERM') &&
    !rawCode.includes(' ') &&
    rawCode.includes('-') &&
    /^[A-Z0-9]+-[A-Z0-9]+-[0-9]{4}-[A-Z0-9]+$/i.test(rawCode)
  ) {
    return rawCode.toUpperCase();
  }

  // 2. Class Part: PP1, PP2, G1, G2, ..., G9
  let classPart = 'G1';
  const cleanGrade = (gradeOrClass || '').trim();
  if (/^pp\s*1/i.test(cleanGrade) || /pre.*primary.*1/i.test(cleanGrade)) {
    classPart = 'PP1';
  } else if (/^pp\s*2/i.test(cleanGrade) || /pre.*primary.*2/i.test(cleanGrade)) {
    classPart = 'PP2';
  } else {
    const numMatch = cleanGrade.match(/\d+/);
    if (numMatch) {
      classPart = `G${numMatch[0]}`;
    } else if (cleanGrade) {
      classPart = cleanGrade.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'G1';
    }
  }

  // 3. Term Part: T1, T2, T3
  let termNum = '2';
  const termStr = String(exam?.term || '2').trim();
  const termNumMatch = termStr.match(/\d+/);
  if (termNumMatch) {
    termNum = termNumMatch[0];
  }
  const termPart = `T${termNum}`;

  // 4. Year Part: 2026
  const yearStr = String(exam?.year || new Date().getFullYear()).trim();
  const yearMatch = yearStr.match(/\d{4}/);
  const yearPart = yearMatch ? yearMatch[0] : (yearStr || '2026');

  // 5. Exam Short Code Part: MT2, ET2, CAT1, OPN, etc.
  let examShortCode = '';
  if (rawCode && /^[A-Z0-9]{2,6}$/i.test(rawCode) && !rawCode.toUpperCase().includes('TTERM')) {
    examShortCode = rawCode.toUpperCase();
  } else {
    const examName = (exam?.exam_name || '').trim().toUpperCase();
    const examType = (exam?.exam_type || '').trim().toUpperCase();
    const combined = `${examName} ${examType}`;

    if (combined.includes('OPEN')) {
      examShortCode = 'OPN';
    } else if (combined.includes('MID')) {
      const numMatch = examName.match(/(\d+)/);
      const num = numMatch ? numMatch[1] : termNum;
      examShortCode = `MT${num}`;
    } else if (combined.includes('END') || combined.includes('FINAL')) {
      const numMatch = examName.match(/(\d+)/);
      const num = numMatch ? numMatch[1] : termNum;
      examShortCode = `ET${num}`;
    } else if (combined.includes('MOCK')) {
      examShortCode = 'MCK';
    } else if (combined.includes('CAT') || combined.includes('CONTINUOUS')) {
      const numMatch = examName.match(/(\d+)/);
      const num = numMatch ? numMatch[1] : '1';
      examShortCode = `CAT${num}`;
    } else {
      const words = examName.split(/[\s-_]+/).filter(Boolean);
      if (words.length > 1) {
        const acronym = words.map((w) => w[0]).join('').slice(0, 4);
        examShortCode = acronym || `ASM${termNum}`;
      } else if (examName) {
        examShortCode = examName.slice(0, 4);
      } else {
        examShortCode = `ASM${termNum}`;
      }
    }
  }

  return `${classPart}-${termPart}-${yearPart}-${examShortCode}`;
}

/**
 * Removes unnecessary surrounding quotation marks from generated or entered remarks/comments.
 * Preserves inner punctuation, capitalization, and formatting.
 */
export function stripSurroundingQuotes(str?: string | null): string {
  if (!str) return '';
  return str.trim().replace(/^["'“‘]+|["'”’]+$/g, '').trim();
}

/**
 * PHASE 3A AUTHORITATIVE ASSESSMENT SCOPE RULES
 * 
  * Determines whether a ClassStream record belongs to an examination's target scope:
 * 1. Grade/Class-Wide: Target class specified (exam.class_id). Match strictly by Class UUID (cls.id === exam.class_id) or Grade Name.
 * 2. Exam Name Grade Specificity: If exam name specifies an explicit Grade (e.g. "Grade 9 Opener Assessment", "Grade 6 Mid-Term"), matches that specific grade only.
 * 3. Level-Wide: Education level specified (exam.education_level). Match strictly by education_level.
 * 4. School-Wide: All active classes/streams are eligible.
 */
export function isClassInExamScope(cls: ClassStream, exam?: Examination | null): boolean {
  if (!exam) return true;

  // 1. Grade/Class-Wide: matches authoritative parent Class UUID or Class Name
  if (exam.class_id && exam.class_id !== 'all') {
    if (cls.id === exam.class_id) return true;
    if (
      (exam.class_id.toLowerCase().startsWith('grade') || exam.class_id.toLowerCase().startsWith('pp')) &&
      cls.class_name &&
      cls.class_name.toLowerCase() === exam.class_id.toLowerCase()
    ) {
      return true;
    }
    return false;
  }

  // 2. Exam Name Specificity: If exam name contains explicit Grade (e.g. "Grade 9 ...", "Grade 6 ...")
  if (exam.exam_name) {
    const inferredGrade = extractGradeName(exam.exam_name);
    if (inferredGrade && (inferredGrade.toLowerCase().startsWith('grade') || inferredGrade.toLowerCase().startsWith('pp'))) {
      if (
        cls.class_name &&
        (cls.class_name.toLowerCase() === inferredGrade.toLowerCase() ||
         cls.class_name.toLowerCase().startsWith(inferredGrade.toLowerCase()))
      ) {
        return true;
      }
      return false;
    }
  }

  // 3. Level-Wide: matches authoritative education level
  if (exam.education_level && (exam.education_level as string) !== 'all' && (exam.education_level as string) !== 'All Levels') {
    const clsEduLevel =
      cls.education_level || (cls.class_name ? getEducationLevelForGrade(cls.class_name) : null);
    if (clsEduLevel !== exam.education_level) {
      return false;
    }
  }

  // 4. School-Wide: all active classes in scope
  return true;
}

/**
 * Filters examinations to ensure class-level and education-level awareness:
 * - If a specific class/grade is selected (e.g., "Grade 6"), only exams in scope for that class/level are returned.
 * - If user is a class teacher, exams are scoped to their assigned primary class level.
 * - If user is restricted to specific accessible classes, exams are scoped to those classes.
 */
export function filterExamsForClassScope(
  exams: Examination[] = [],
  selectedClassIdOrName?: string | null,
  accessibleClasses: ClassStream[] = [],
  primaryClass?: ClassStream | null,
  currentUserRole?: string
): Examination[] {
  if (!exams || exams.length === 0) return [];

  let scopeClasses: ClassStream[] = [];

  if (selectedClassIdOrName && selectedClassIdOrName !== 'all' && selectedClassIdOrName !== 'All Classes') {
    scopeClasses = (accessibleClasses || []).filter(
      (c) =>
        c.id === selectedClassIdOrName ||
        c.stream_id === selectedClassIdOrName ||
        (c.class_name || '').toLowerCase() === selectedClassIdOrName.toLowerCase() ||
        (c.class_name || '').toLowerCase().startsWith(selectedClassIdOrName.toLowerCase())
    );
    if (scopeClasses.length === 0) {
      const dummyLevel = getEducationLevelForGrade(selectedClassIdOrName);
      scopeClasses = [
        {
          id: selectedClassIdOrName,
          class_name: selectedClassIdOrName,
          education_level: dummyLevel || undefined,
        } as ClassStream,
      ];
    }
  } else if (primaryClass) {
    scopeClasses = [primaryClass];
  } else if (currentUserRole !== 'admin' && accessibleClasses && accessibleClasses.length > 0) {
    scopeClasses = accessibleClasses;
  }

  if (scopeClasses.length === 0) {
    return exams;
  }

  return exams.filter((exam) => scopeClasses.some((c) => isClassInExamScope(c, exam)));
}

/**
 * PHASE 3A AUTHORITATIVE ASSESSMENT SCOPE RULES (LEARNER CONTEXT)
 * 
 * Determines whether a learner's resolved LearnerExamContext belongs to an examination's target scope:
 * 1. Grade/Class-Wide: Learner's historical class UUID must equal exam.class_id.
 * 2. Level-Wide: Learner's resolved class's education level must equal exam.education_level.
 * 3. School-Wide: All active learners with valid context are eligible.
 */
export function isLearnerInExamScope(
  context: LearnerExamContext,
  exam?: Examination | null,
  classes: ClassStream[] = []
): boolean {
  if (!exam) return true;

  // 1. Grade/Class-Wide: must match authoritative parent Class UUID or Grade Name
  if (exam.class_id && exam.class_id !== 'all') {
    if (!context.class_id && !context.class_name) return false;
    if (context.class_id === exam.class_id) return true;
    const matchedClass = context.class_id ? classes.find((c) => c.id === context.class_id) : undefined;
    if (matchedClass && matchedClass.id === exam.class_id) {
      return true;
    }
    if (
      (exam.class_id.toLowerCase().startsWith('grade') || exam.class_id.toLowerCase().startsWith('pp')) &&
      context.class_name &&
      context.class_name.toLowerCase() === exam.class_id.toLowerCase()
    ) {
      return true;
    }
    return false;
  }

  // 2. Level-Wide: must match authoritative education level
  if (exam.education_level && (exam.education_level as string) !== 'all' && (exam.education_level as string) !== 'All Levels') {
    if (!context.class_id && !context.class_name) return false;

    // Look up authoritative class record by context.class_id
    const matchedClass = context.class_id ? classes.find((c) => c.id === context.class_id) : undefined;
    const learnerEduLevel =
      matchedClass?.education_level ||
      (matchedClass?.class_name
        ? getEducationLevelForGrade(matchedClass.class_name)
        : context.class_name
        ? getEducationLevelForGrade(context.class_name)
        : null);

    return learnerEduLevel === exam.education_level;
  }

  // 3. Exam Name Fallback: If exam name contains explicit Grade (e.g. "Grade 6 ...")
  if (exam.exam_name) {
    const inferredGrade = extractGradeName(exam.exam_name);
    if (inferredGrade && inferredGrade.toLowerCase().startsWith('grade')) {
      const matchedClass = context.class_id ? classes.find((c) => c.id === context.class_id) : undefined;
      const learnerGrade = matchedClass?.class_name || context.class_name || context.grade;
      if (learnerGrade && learnerGrade.toLowerCase() === inferredGrade.toLowerCase()) {
        return true;
      }
      return false;
    }
  }

  // 4. School-Wide: all active learners in scope
  return true;
}

/**
 * PHASE 3B AUTHORITATIVE CLASS RESOLUTION RESULT
 */
export interface AuthoritativeClassResolution {
  status: 'empty' | 'all' | 'resolved' | 'ambiguous' | 'not_found';
  classId: string | null;      // Authoritative Class UUID (public.classes.id)
  className: string | null;    // Display/Grade Name
  error?: string;
}

/**
 * PHASE 3B AUTHORITATIVE CLASS SELECTION RESOLUTION
 * 
 * Strict identity resolution for class selections:
 * 1. An empty or null selection resolves to 'empty'.
 * 2. 'all' resolves to 'all'.
 * 3. If selection is already an authoritative Class UUID (c.id), it resolves directly.
 * 4. If selection is a display name (c.class_name):
 *    - Resolves against the authoritative in-scope class collection.
 *    - Determines whether exactly one parent class UUID matches.
 *    - If exactly one match exists, returns that class's authoritative UUID.
 *    - If multiple distinct parent classes have the same label, FAILS CLOSED (status: 'ambiguous').
 *      Does NOT use '[0]', does NOT pick first match, does NOT guess.
 *    - If no match exists, returns status: 'not_found'.
 */
export function resolveAuthoritativeClass(
  selection: string | null | undefined,
  inScopeClasses: ClassStream[] = []
): AuthoritativeClassResolution {
  if (!selection || selection.trim() === '') {
    return { status: 'empty', classId: null, className: null };
  }

  const trimmed = selection.trim();

  if (trimmed.toLowerCase() === 'all') {
    return { status: 'all', classId: null, className: null };
  }

  // 1. Check if selection is already an authoritative Class UUID (c.id)
  const matchesByClassId = inScopeClasses.filter((c) => c.id === trimmed);
  if (matchesByClassId.length > 0) {
    return {
      status: 'resolved',
      classId: trimmed,
      className: matchesByClassId[0].class_name,
    };
  }

  // 2. Resolve display name against authoritative classes
  const matchingClasses = inScopeClasses.filter(
    (c) => (c.class_name || '').trim().toLowerCase() === trimmed.toLowerCase()
  );

  // Collect distinct parent class UUIDs
  const distinctParentClassIds = Array.from(
    new Set(matchingClasses.map((c) => c.id).filter(Boolean))
  );

  if (distinctParentClassIds.length === 1) {
    // Exactly one authoritative parent class UUID matches!
    const matchedClassId = distinctParentClassIds[0];
    const canonicalName = matchingClasses[0].class_name;
    return {
      status: 'resolved',
      classId: matchedClassId,
      className: canonicalName,
    };
  }

  if (distinctParentClassIds.length === 0) {
    return {
      status: 'not_found',
      classId: null,
      className: null,
      error: `Class "${selection}" not found in assessment scope.`,
    };
  }

  // Multiple distinct parent class UUIDs share the same display name -> Ambiguity! Fail closed!
  return {
    status: 'ambiguous',
    classId: null,
    className: null,
    error: `Ambiguous class name: "${selection}" matches multiple distinct class records (${distinctParentClassIds.join(', ')}). Fail closed.`,
  };
}


