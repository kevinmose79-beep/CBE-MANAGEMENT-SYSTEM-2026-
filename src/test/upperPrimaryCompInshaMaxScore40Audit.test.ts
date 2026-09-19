import { describe, it, expect } from 'vitest';
import { evaluateMark, getUpperPrimaryCompositeSubjectMarks } from '../utils/markUtils';
import type { Mark, Subject, ClassStream } from '../types';

describe('Upper Primary English Composition and Kiswahili Insha 40 Marks Forensic Verification', () => {
  const upClass: ClassStream = {
    id: 'cls_g4',
    class_name: 'Grade 4',
    stream: 'Blue',
    education_level: 'Upper Primary',
  };

  const engLangSub: Subject = {
    id: 'sb_up_eng',
    subject_name: 'English',
    subject_code: 'ENG',
    category: 'Core',
    department: 'Languages',
    education_level: 'Upper Primary',
    status: 'Active',
  };

  const engCompSub: Subject = {
    id: 'sb_up_comp',
    subject_name: 'English Composition',
    subject_code: 'COMP',
    category: 'Core',
    department: 'Languages',
    education_level: 'Upper Primary',
    status: 'Active',
  };

  const kiswLughaSub: Subject = {
    id: 'sb_up_kis',
    subject_name: 'Kiswahili',
    subject_code: 'KIS',
    category: 'Core',
    department: 'Languages',
    education_level: 'Upper Primary',
    status: 'Active',
  };

  const kiswInshaSub: Subject = {
    id: 'sb_up_insha',
    subject_name: 'Kiswahili Insha',
    subject_code: 'INSHA',
    category: 'Core',
    department: 'Languages',
    education_level: 'Upper Primary',
    status: 'Active',
  };

  it('1. Verifies evaluateMark evaluates English Composition raw score out of 40', () => {
    const compMark: Mark = {
      id: 'm_comp_1',
      student_id: 'std_1',
      subject_id: engCompSub.id,
      exam_id: 'exam_1',
      marks: 32,
      raw_score: 32,
      out_of: 40,
    };

    const evalResult = evaluateMark(compMark, {
      isUpperPrimaryCompOrInsha: true,
      subject: engCompSub,
      classObj: upClass,
      educationLevel: 'Upper Primary',
    });

    expect(evalResult.rawScore).toBe(32);
    expect(evalResult.outOf).toBe(40);
    expect(evalResult.percentage).toBe(80);
    expect(evalResult.displayScore).toBe('32');
    expect(evalResult.isRawScoreOnly).toBe(true);
  });

  it('2. Verifies evaluateMark evaluates Kiswahili Insha raw score out of 40', () => {
    const inshaMark: Mark = {
      id: 'm_insha_1',
      student_id: 'std_1',
      subject_id: kiswInshaSub.id,
      exam_id: 'exam_1',
      marks: 28,
      raw_score: 28,
      out_of: 40,
    };

    const evalResult = evaluateMark(inshaMark, {
      isUpperPrimaryCompOrInsha: true,
      subject: kiswInshaSub,
      classObj: upClass,
      educationLevel: 'Upper Primary',
    });

    expect(evalResult.rawScore).toBe(28);
    expect(evalResult.outOf).toBe(40);
    expect(evalResult.percentage).toBe(70);
    expect(evalResult.displayScore).toBe('28');
    expect(evalResult.isRawScoreOnly).toBe(true);
  });

  it('3. Verifies default out_of fallback is 40 when not explicitly set on mark', () => {
    const unscaledCompMark: Mark = {
      id: 'm_comp_2',
      student_id: 'std_2',
      subject_id: engCompSub.id,
      exam_id: 'exam_1',
      marks: 24,
      raw_score: 24,
    };

    const evalResult = evaluateMark(unscaledCompMark, {
      isUpperPrimaryCompOrInsha: true,
      subject: engCompSub,
      classObj: upClass,
      educationLevel: 'Upper Primary',
    });

    expect(evalResult.rawScore).toBe(24);
    expect(evalResult.outOf).toBe(40);
    expect(evalResult.percentage).toBe(60);
  });

  it('4. Verifies Upper Primary 60:40 aggregation with 40-mark Composition and Insha', () => {
    const studentMarks: Mark[] = [
      {
        id: 'm_eng',
        student_id: 'std_1',
        subject_id: engLangSub.id,
        exam_id: 'exam_1',
        marks: 48,
        raw_score: 48,
        out_of: 60,
      },
      {
        id: 'm_comp',
        student_id: 'std_1',
        subject_id: engCompSub.id,
        exam_id: 'exam_1',
        marks: 32,
        raw_score: 32,
        out_of: 40,
      },
      {
        id: 'm_kis',
        student_id: 'std_1',
        subject_id: kiswLughaSub.id,
        exam_id: 'exam_1',
        marks: 42,
        raw_score: 42,
        out_of: 60,
      },
      {
        id: 'm_insha',
        student_id: 'std_1',
        subject_id: kiswInshaSub.id,
        exam_id: 'exam_1',
        marks: 28,
        raw_score: 28,
        out_of: 40,
      },
    ];

    const subjects = [engLangSub, engCompSub, kiswLughaSub, kiswInshaSub];

    const { processedMarks, syntheticSubjects } = getUpperPrimaryCompositeSubjectMarks(
      studentMarks,
      subjects,
      'Upper Primary'
    );

    const synthEng = processedMarks.find(m => m.subject_id === 'synth_english_composite');
    const synthKisw = processedMarks.find(m => m.subject_id === 'synth_kiswahili_composite');

    // English: 48 + 32 = 80/100
    expect(synthEng).toBeDefined();
    expect(synthEng?.marks).toBe(80);
    expect(synthEng?.raw_score).toBe(80);
    expect(synthEng?.out_of).toBe(100);

    // Kiswahili: 42 + 28 = 70/100
    expect(synthKisw).toBeDefined();
    expect(synthKisw?.marks).toBe(70);
    expect(synthKisw?.raw_score).toBe(70);
    expect(synthKisw?.out_of).toBe(100);
  });
});
