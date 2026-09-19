import { describe, it, expect } from 'vitest';
import {
  calculateLearningAreaTerminalResult,
  calculateLearnerTerminalResults,
  ContributingAssessmentRef,
} from '../services/terminalResultsEngine';
import { CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { validateYResolutionInput, executeYResolution } from '../services/yResolutionService';
import { Mark, User, MarkResolution } from '../types';
import { mapDatabaseMarks } from '../lib/storage';

describe('T-11 Authorised Y Resolution Mandatory Test Matrix (19 Cases)', () => {
  const adminUser: User = {
    id: 'admin_123',
    name: 'Administrator Alice',
    email: 'admin@school.ac.ke',
    role: 'admin',
  };

  const teacherUser: User = {
    id: 'teacher_456',
    name: 'Teacher Bob',
    email: 'teacher@school.ac.ke',
    role: 'subject_teacher',
  };

  // 1. Y → resolved to numerical mark
  it('Case 1: Y -> resolved to numerical mark produces valid resolution provenance', () => {
    const originalMark: Mark = {
      id: 'mark_001',
      student_id: 'std_01',
      subject_id: 'math',
      exam_id: 'cat2',
      marks: 0,
      raw_score: null,
      out_of: 100,
      special_status: 'Y',
      irregularity_reason: 'Medical Absence',
    };

    const validation = validateYResolutionInput({
      mark: originalMark,
      replacementScore: 70,
      outOf: 100,
      resolutionReason: 'Approved medical makeup exam completed with doctor note verification.',
      currentUser: adminUser,
    });

    expect(validation.isValid).toBe(true);

    const executed = executeYResolution({
      mark: originalMark,
      replacementScore: 70,
      outOf: 100,
      resolutionReason: 'Approved medical makeup exam completed with doctor note verification.',
      currentUser: adminUser,
    });

    expect(executed.updatedMark.special_status).toBe('Normal');
    expect(executed.updatedMark.marks).toBe(70);
    expect(executed.updatedMark.raw_score).toBe(70);
    expect(executed.provenance.original_status).toBe('Y');
    expect(executed.provenance.original_irregularity_reason).toBe('Medical Absence');
    expect(executed.provenance.replacement_score).toBe(70);
    expect(executed.provenance.resolved_by).toBe('Administrator Alice');
  });

  // 2. Resolved assessment contributes to Terminal Result
  it('Case 2: Resolved assessment contributes to Terminal Result calculation', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1', out_of: 100 },
      { id: 'cat2', exam_name: 'CAT 2', out_of: 100 },
      { id: 'endterm', exam_name: 'End Term', out_of: 100 },
    ];

    const resolution: MarkResolution = {
      id: 'res_001',
      mark_id: 'mark_cat2',
      student_id: 'std_01',
      subject_id: 'math',
      exam_id: 'cat2',
      original_status: 'Y',
      original_irregularity_reason: 'Absent',
      replacement_score: 80,
      replacement_percentage: 80,
      resolution_reason: 'Makeup test sat',
      resolved_by: 'Administrator Alice',
      resolved_at: new Date().toISOString(),
    };

    const marks: Partial<Mark>[] = [
      { exam_id: 'cat1', marks: 70 },
      { exam_id: 'cat2', marks: 80, special_status: 'Normal', resolution },
      { exam_id: 'endterm', marks: 90 },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks,
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(true);
    expect(result.status).toBe('Complete');
    expect(result.terminalPercentage).toBe(80); // (70 + 80 + 90) / 3 = 80
    expect(result.assessmentTrail[1].status).toBe('Normal');
    expect(result.assessmentTrail[1].resolvedFromY).toBe(true);
    expect(result.assessmentTrail[1].resolutionReason).toBe('Makeup test sat');
  });

  // 3. INCOMPLETE (Y) disappears after resolution
  it('Case 3: INCOMPLETE (Y) disappears after resolution and becomes COMPLETE', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1', out_of: 100 },
      { id: 'cat2', exam_name: 'CAT 2', out_of: 100 },
    ];

    // Before resolution
    const beforeResult = calculateLearningAreaTerminalResult({
      subjectId: 'science',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'cat1', marks: 85 },
        { exam_id: 'cat2', special_status: 'Y', irregularity_reason: 'Withheld' },
      ],
      grades: CBE_8_POINT_GRADES,
    });
    expect(beforeResult.status).toBe('INCOMPLETE (Y)');
    expect(beforeResult.isComplete).toBe(false);

    // After resolution
    const afterResult = calculateLearningAreaTerminalResult({
      subjectId: 'science',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'cat1', marks: 85 },
        {
          exam_id: 'cat2',
          marks: 75,
          special_status: 'Normal',
          resolution: {
            original_status: 'Y',
            original_irregularity_reason: 'Withheld',
            replacement_score: 75,
            replacement_percentage: 75,
            resolution_reason: 'Investigation cleared irregularity',
            resolved_by: 'Admin',
            resolved_at: new Date().toISOString(),
          },
        },
      ],
      grades: CBE_8_POINT_GRADES,
    });
    expect(afterResult.status).toBe('Complete');
    expect(afterResult.isComplete).toBe(true);
    expect(afterResult.terminalPercentage).toBe(80); // (85 + 75) / 2
  });

  // 4. Terminal percentage calculates correctly
  it('Case 4: Terminal percentage calculates correctly with weighted or varying assessment maximums', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1', out_of: 50 },
      { id: 'endterm', exam_name: 'End Term', out_of: 100 },
    ];

    // CAT 1: 40/50 = 80%. End Term: Y resolved to 65/100 = 65%
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'eng',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'cat1', marks: 80, raw_score: 40, out_of: 50 },
        {
          exam_id: 'endterm',
          marks: 65,
          raw_score: 65,
          out_of: 100,
          resolution: {
            original_status: 'Y',
            original_irregularity_reason: 'Absent',
            replacement_score: 65,
            replacement_percentage: 65,
            resolution_reason: 'Special makeup session',
            resolved_by: 'Principal',
            resolved_at: new Date().toISOString(),
          },
        },
      ],
      grades: CBE_8_POINT_GRADES,
    });

    // Average of 80% and 65% = 72.5% -> rounded to 73%
    expect(result.unroundedTerminalPercentage).toBe(72.5);
    expect(result.terminalPercentage).toBe(73);
  });

  // 5. CBE level assigns correctly
  it('Case 5: CBE level assigns correctly according to official grade bands after resolution', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1' },
      { id: 'cat2', exam_name: 'CAT 2' },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'kisw',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'cat1', marks: 82 },
        {
          exam_id: 'cat2',
          marks: 86,
          resolution: {
            original_status: 'Y',
            original_irregularity_reason: 'Absent',
            replacement_score: 86,
            replacement_percentage: 86,
            resolution_reason: 'Makeup exam',
            resolved_by: 'Admin',
            resolved_at: new Date().toISOString(),
          },
        },
      ],
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.terminalPercentage).toBe(84);
    expect(result.cbePerformanceLevel).toBe('EE2'); // 80-89% is EE2
  });

  // 6. Points calculate correctly
  it('Case 6: Points calculate correctly according to official CBE 8-point scale', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1' },
      { id: 'cat2', exam_name: 'CAT 2' },
    ];

    // 84% -> EE2 -> 7 points in CBE_8_POINT_GRADES
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'kisw',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'cat1', marks: 82 },
        {
          exam_id: 'cat2',
          marks: 86,
          resolution: {
            original_status: 'Y',
            original_irregularity_reason: 'Absent',
            replacement_score: 86,
            replacement_percentage: 86,
            resolution_reason: 'Makeup exam',
            resolved_by: 'Admin',
            resolved_at: new Date().toISOString(),
          },
        },
      ],
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.points).toBe(7);
  });

  // 7. Unresolved Y continues to block
  it('Case 7: Unresolved Y continues to block terminal result even if another assessment is normal', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1' },
      { id: 'cat2', exam_name: 'CAT 2' },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'cat1', marks: 95 },
        { exam_id: 'cat2', special_status: 'Y', irregularity_reason: 'Absence' },
      ],
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (Y)');
    expect(result.terminalPercentage).toBeNull();
  });

  // 8. Learning Area with mixed assessments (resolved Y + Normal + X)
  it('Case 8: Mixed assessments with resolved Y, Normal, and X produces INCOMPLETE (X)', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1' },
      { id: 'cat2', exam_name: 'CAT 2' },
      { id: 'endterm', exam_name: 'End Term' },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'sst',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'cat1', marks: 80 },
        {
          exam_id: 'cat2',
          marks: 70,
          resolution: {
            original_status: 'Y',
            original_irregularity_reason: 'Medical Absence',
            replacement_score: 70,
            replacement_percentage: 70,
            resolution_reason: 'Makeup completed',
            resolved_by: 'Admin',
            resolved_at: new Date().toISOString(),
          },
        },
        { exam_id: 'endterm', special_status: 'X' },
      ],
      grades: CBE_8_POINT_GRADES,
    });

    // Since CAT 2's Y was resolved, only X remains unresolved. Status must be INCOMPLETE (X), not INCOMPLETE (X/Y)
    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (X)');
    expect(result.terminalPercentage).toBeNull();
  });

  // 9. Learning Area with multiple Y (one resolved, one unresolved)
  it('Case 9: Multiple Y with one resolved and one unresolved still produces INCOMPLETE (Y)', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1' },
      { id: 'cat2', exam_name: 'CAT 2' },
      { id: 'endterm', exam_name: 'End Term' },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'cre',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'cat1', marks: 75 },
        {
          exam_id: 'cat2',
          marks: 85,
          resolution: {
            original_status: 'Y',
            original_irregularity_reason: 'Absent',
            replacement_score: 85,
            replacement_percentage: 85,
            resolution_reason: 'Makeup sat',
            resolved_by: 'Admin',
            resolved_at: new Date().toISOString(),
          },
        },
        { exam_id: 'endterm', special_status: 'Y', irregularity_reason: 'Withheld' },
      ],
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(false);
    expect(result.status).toBe('INCOMPLETE (Y)');
    expect(result.terminalPercentage).toBeNull();
  });

  // 10. All Y resolved produces Complete result
  it('Case 10: All Y resolved produces a COMPLETE result with all marks contributing', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1' },
      { id: 'cat2', exam_name: 'CAT 2' },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'agri',
      contributingAssessments: assessments,
      marks: [
        {
          exam_id: 'cat1',
          marks: 60,
          resolution: {
            original_status: 'Y',
            original_irregularity_reason: 'Medical',
            replacement_score: 60,
            replacement_percentage: 60,
            resolution_reason: 'Makeup 1',
            resolved_by: 'Admin',
            resolved_at: new Date().toISOString(),
          },
        },
        {
          exam_id: 'cat2',
          marks: 80,
          resolution: {
            original_status: 'Y',
            original_irregularity_reason: 'Absent',
            replacement_score: 80,
            replacement_percentage: 80,
            resolution_reason: 'Makeup 2',
            resolved_by: 'Admin',
            resolved_at: new Date().toISOString(),
          },
        },
      ],
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(true);
    expect(result.status).toBe('Complete');
    expect(result.terminalPercentage).toBe(70);
  });

  // 11. Zero replacement mark preserves legitimate 0%
  it('Case 11: Zero replacement mark preserves legitimate numerical 0% and does not block', () => {
    const assessments: ContributingAssessmentRef[] = [
      { id: 'cat1', exam_name: 'CAT 1' },
      { id: 'cat2', exam_name: 'CAT 2' },
    ];

    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: assessments,
      marks: [
        { exam_id: 'cat1', marks: 80 },
        {
          exam_id: 'cat2',
          marks: 0,
          raw_score: 0,
          out_of: 100,
          resolution: {
            original_status: 'Y',
            original_irregularity_reason: 'Examination Irregularity',
            replacement_score: 0,
            replacement_percentage: 0,
            resolution_reason: 'Disciplinary hearing awarded 0 marks',
            resolved_by: 'Disciplinary Committee & Admin',
            resolved_at: new Date().toISOString(),
          },
        },
      ],
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(true);
    expect(result.status).toBe('Complete');
    expect(result.terminalPercentage).toBe(40); // (80 + 0) / 2 = 40%
    expect(result.cbePerformanceLevel).not.toBeNull();
    expect(result.points).not.toBeNull();
  });

  // 12. Attempt to resolve X is rejected
  it('Case 12: Attempt to resolve X status via Y resolution is rejected', () => {
    const xMark: Mark = {
      id: 'mark_x',
      student_id: 'std_01',
      subject_id: 'math',
      exam_id: 'cat1',
      marks: 0,
      special_status: 'X',
    };

    const validation = validateYResolutionInput({
      mark: xMark,
      replacementScore: 75,
      outOf: 100,
      resolutionReason: 'Trying to resolve X',
      currentUser: adminUser,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errorMessage).toContain('Only assessment marks with "Y" status can be resolved');
  });

  // 13. Attempt to resolve Normal is rejected
  it('Case 13: Attempt to resolve Normal status mark via Y resolution is rejected', () => {
    const normalMark: Mark = {
      id: 'mark_normal',
      student_id: 'std_01',
      subject_id: 'math',
      exam_id: 'cat1',
      marks: 65,
      special_status: 'Normal',
    };

    const validation = validateYResolutionInput({
      mark: normalMark,
      replacementScore: 85,
      outOf: 100,
      resolutionReason: 'Changing normal mark',
      currentUser: adminUser,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errorMessage).toContain('Only assessment marks with "Y" status can be resolved');
  });

  // 14. Non-administrator resolution attempt is rejected
  it('Case 14: Non-administrator resolution attempt is strictly rejected by RBAC', () => {
    const yMark: Mark = {
      id: 'mark_y',
      student_id: 'std_01',
      subject_id: 'math',
      exam_id: 'cat1',
      marks: 0,
      special_status: 'Y',
      irregularity_reason: 'Absent',
    };

    const validation = validateYResolutionInput({
      mark: yMark,
      replacementScore: 80,
      outOf: 100,
      resolutionReason: 'Teacher trying to resolve Y',
      currentUser: teacherUser,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errorMessage).toContain('Only administrators are authorised');
  });

  // 15. Negative replacement mark rejected
  it('Case 15: Negative replacement mark is rejected', () => {
    const yMark: Mark = {
      id: 'mark_y',
      student_id: 'std_01',
      subject_id: 'math',
      exam_id: 'cat1',
      marks: 0,
      special_status: 'Y',
      irregularity_reason: 'Absent',
    };

    const validation = validateYResolutionInput({
      mark: yMark,
      replacementScore: -10,
      outOf: 100,
      resolutionReason: 'Penalty score',
      currentUser: adminUser,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errorMessage).toContain('cannot be negative');
  });

  // 16. Replacement mark exceeding maximum rejected
  it('Case 16: Replacement mark exceeding assessment maximum is rejected', () => {
    const yMark: Mark = {
      id: 'mark_y',
      student_id: 'std_01',
      subject_id: 'math',
      exam_id: 'cat1',
      marks: 0,
      out_of: 50,
      special_status: 'Y',
      irregularity_reason: 'Absent',
    };

    const validation = validateYResolutionInput({
      mark: yMark,
      replacementScore: 55,
      outOf: 50,
      resolutionReason: 'Extra credit',
      currentUser: adminUser,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errorMessage).toContain('cannot exceed the assessment maximum');
  });

  // 17. Missing resolution reason rejected
  it('Case 17: Missing resolution reason is rejected for audit non-compliance', () => {
    const yMark: Mark = {
      id: 'mark_y',
      student_id: 'std_01',
      subject_id: 'math',
      exam_id: 'cat1',
      marks: 0,
      special_status: 'Y',
      irregularity_reason: 'Absent',
    };

    const validation = validateYResolutionInput({
      mark: yMark,
      replacementScore: 80,
      outOf: 100,
      resolutionReason: '   ',
      currentUser: adminUser,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errorMessage).toContain('Resolution reason is mandatory');
  });

  // 18. Resolution audit log created
  it('Case 18: Resolution audit provenance is created with complete timestamp, resolver and original status', () => {
    const yMark: Mark = {
      id: 'mark_y_audit',
      student_id: 'std_99',
      subject_id: 'science',
      exam_id: 'exam_term',
      marks: 0,
      special_status: 'Y',
      irregularity_reason: 'Medical Absence',
      out_of: 100,
    };

    const execution = executeYResolution({
      mark: yMark,
      replacementScore: 78,
      outOf: 100,
      resolutionReason: 'Medical report verified and makeup administered',
      currentUser: adminUser,
    });

    expect(execution.provenance).toBeDefined();
    expect(execution.provenance.mark_id).toBe('mark_y_audit');
    expect(execution.provenance.student_id).toBe('std_99');
    expect(execution.provenance.subject_id).toBe('science');
    expect(execution.provenance.exam_id).toBe('exam_term');
    expect(execution.provenance.original_status).toBe('Y');
    expect(execution.provenance.original_irregularity_reason).toBe('Medical Absence');
    expect(execution.provenance.replacement_score).toBe(78);
    expect(execution.provenance.replacement_percentage).toBe(78);
    expect(execution.provenance.resolution_reason).toBe('Medical report verified and makeup administered');
    expect(execution.provenance.resolved_by).toBe('Administrator Alice');
    expect(new Date(execution.provenance.resolved_at).getTime()).toBeGreaterThan(0);
  });

  // 19. Refresh preserves resolution
  it('Case 19: Deserialization from Supabase remarks JSON preserves resolution provenance across refresh', () => {
    const rawDbRow = {
      id: 'mark_db_1',
      student_id: 'std_01',
      subject_id: 'math',
      exam_id: 'cat1',
      marks: 85,
      out_of: 100,
      special_status: 'Normal',
      remarks: JSON.stringify({
        raw_score: 85,
        out_of: 100,
        special_status: 'Normal',
        resolution: {
          id: 'res_001',
          mark_id: 'mark_db_1',
          student_id: 'std_01',
          subject_id: 'math',
          exam_id: 'cat1',
          original_status: 'Y',
          original_irregularity_reason: 'Absent',
          replacement_score: 85,
          replacement_percentage: 85,
          resolution_reason: 'Makeup examination',
          resolved_by: 'Administrator Alice',
          resolved_at: '2026-09-05T08:00:00.000Z',
        },
      }),
    };

    const [mappedMark] = mapDatabaseMarks([rawDbRow]);

    expect(mappedMark.resolution).toBeDefined();
    expect(mappedMark.resolution?.original_status).toBe('Y');
    expect(mappedMark.resolution?.replacement_score).toBe(85);
    expect(mappedMark.resolution?.resolved_by).toBe('Administrator Alice');

    // Verify recalculation using the deserialized mark
    const result = calculateLearningAreaTerminalResult({
      subjectId: 'math',
      contributingAssessments: [{ id: 'cat1', exam_name: 'CAT 1' }],
      marks: [mappedMark],
      grades: CBE_8_POINT_GRADES,
    });

    expect(result.isComplete).toBe(true);
    expect(result.status).toBe('Complete');
    expect(result.terminalPercentage).toBe(85);
  });
});
