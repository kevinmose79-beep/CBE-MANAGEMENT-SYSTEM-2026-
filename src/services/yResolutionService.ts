import { Mark, MarkResolution, SubjectStatus, User } from '../types';

export interface ResolveYMarkParams {
  mark: Mark;
  replacementScore: number;
  outOf?: number;
  resolutionReason: string;
  resolvedBy?: string;
  userRole?: string;
  currentUser?: User;
  examStatus?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorMessage?: string;
}

/**
 * Validates whether a mark is eligible for Authorised Y Resolution and whether the replacement input is valid.
 */
export function validateYResolutionInput(params: {
  mark?: Mark | null;
  replacementScore: number | null | undefined;
  outOf?: number | null;
  resolutionReason?: string | null;
  resolvedBy?: string | null;
  userRole?: string | null;
  currentUser?: User | null;
  examStatus?: string | null;
}): ValidationResult {
  const { mark, replacementScore, outOf, resolutionReason } = params;

  const role = params.currentUser?.role ?? params.userRole;
  const resolver = params.currentUser
    ? params.currentUser.name || params.currentUser.email || 'Administrator'
    : params.resolvedBy;

  // 1. Mark presence
  if (!mark) {
    const msg = 'Target assessment mark does not exist.';
    return { isValid: false, error: msg, errorMessage: msg };
  }

  // 2. Role authorisation check: Only administrators can formally resolve Y
  if (role !== undefined && role !== null) {
    const canonicalRole = role.trim().toLowerCase();
    if (canonicalRole !== 'admin' && canonicalRole !== 'administrator') {
      const msg = 'Unauthorised: Only administrators are authorised to formally resolve assessment irregularities (Y).';
      return { isValid: false, error: msg, errorMessage: msg };
    }
  }

  // 3. Mark current status check: Must currently be 'Y'
  const isCurrentlyY =
    mark.special_status === 'Y' ||
    (typeof mark.marks === 'string' && (mark.marks as string).trim().toUpperCase() === 'Y') ||
    (typeof mark.raw_score === 'string' && (mark.raw_score as string).trim().toUpperCase() === 'Y');

  if (!isCurrentlyY) {
    const msg = `Only assessment marks with "Y" status can be resolved (current status: ${mark.special_status || 'Normal'}).`;
    return { isValid: false, error: msg, errorMessage: msg };
  }

  // 4. Replacement score presence & type check (0 is valid, do NOT use falsy check)
  if (replacementScore === null || replacementScore === undefined || !Number.isFinite(replacementScore)) {
    const msg = 'Invalid replacement mark: A valid finite numerical mark is required.';
    return { isValid: false, error: msg, errorMessage: msg };
  }

  // 5. Replacement score boundary checks
  if (replacementScore < 0) {
    const msg = 'Invalid replacement mark: Replacement mark cannot be negative.';
    return { isValid: false, error: msg, errorMessage: msg };
  }

  const effectiveOutOf = typeof outOf === 'number' && outOf > 0
    ? outOf
    : typeof mark.out_of === 'number' && mark.out_of > 0
      ? mark.out_of
      : 100;

  if (replacementScore > effectiveOutOf) {
    const msg = `Invalid replacement mark: Replacement mark (${replacementScore}) cannot exceed the assessment maximum (${effectiveOutOf}).`;
    return { isValid: false, error: msg, errorMessage: msg };
  }

  // 6. Resolution reason check
  if (!resolutionReason || typeof resolutionReason !== 'string' || resolutionReason.trim() === '') {
    const msg = 'Resolution reason is mandatory for formal Y resolution audit compliance.';
    return { isValid: false, error: msg, errorMessage: msg };
  }

  // 7. Authorised resolver identity check
  if (!resolver || typeof resolver !== 'string' || resolver.trim() === '') {
    const msg = 'Authorised resolver identity is mandatory for formal Y resolution audit compliance.';
    return { isValid: false, error: msg, errorMessage: msg };
  }

  return { isValid: true };
}

/**
 * Executes formal Authorised Y Resolution on a Mark entity.
 * Converts Y -> Authorised replacement numerical mark while preserving original Y status,
 * irregularity reason, resolver, timestamp, and resolution reason in provenance.
 */
export function executeYResolution(params: ResolveYMarkParams): {
  success: boolean;
  error?: string;
  errorMessage?: string;
  resolvedMark: Mark;
  updatedMark: Mark;
  provenance: MarkResolution;
} {
  const role = params.currentUser?.role ?? params.userRole;
  const resolver = params.currentUser
    ? params.currentUser.name || params.currentUser.email || 'Administrator'
    : params.resolvedBy;

  const validation = validateYResolutionInput({
    mark: params.mark,
    replacementScore: params.replacementScore,
    outOf: params.outOf,
    resolutionReason: params.resolutionReason,
    resolvedBy: resolver,
    userRole: role,
    examStatus: params.examStatus,
  });

  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
      errorMessage: validation.errorMessage,
      resolvedMark: params.mark,
      updatedMark: params.mark,
      provenance: undefined as any,
    };
  }

  const mark = params.mark;
  const effectiveOutOf = typeof params.outOf === 'number' && params.outOf > 0
    ? params.outOf
    : typeof mark.out_of === 'number' && mark.out_of > 0
      ? mark.out_of
      : 100;

  const originalReason =
    typeof mark.irregularity_reason === 'string' && mark.irregularity_reason.trim() !== ''
      ? mark.irregularity_reason.trim()
      : 'Absent';

  const normalizedPercentage = effectiveOutOf > 0
    ? (params.replacementScore / effectiveOutOf) * 100
    : 0;
  const clampedPercentage = Math.min(100, Math.max(0, normalizedPercentage));

  const resolvedAt = new Date().toISOString();

  const provenance: MarkResolution = {
    mark_id: mark.id,
    student_id: mark.student_id,
    subject_id: mark.subject_id,
    exam_id: mark.exam_id,
    original_status: 'Y',
    original_irregularity_reason: originalReason,
    replacement_score: params.replacementScore,
    replacement_percentage: clampedPercentage,
    resolution_reason: params.resolutionReason.trim(),
    resolved_by: (resolver || 'Administrator').trim(),
    resolved_at: resolvedAt,
  };

  const resolvedMark: Mark = {
    ...mark,
    marks: clampedPercentage,
    raw_score: params.replacementScore,
    out_of: effectiveOutOf,
    special_status: 'Normal', // Current status becomes Normal numerical mark
    resolution: provenance, // Preserved provenance containing original Y
    updated_at: resolvedAt,
  };

  return {
    success: true,
    resolvedMark,
    updatedMark: resolvedMark,
    provenance,
  };
}
