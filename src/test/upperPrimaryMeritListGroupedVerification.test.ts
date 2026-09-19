import { describe, it, expect } from 'vitest';
import { Subject, ClassStream, Mark, Student, Examination, School } from '../types';
import { isUpperPrimaryCompOrInsha, isEnglishLanguage, isKiswahiliLugha, evaluateMark } from '../utils/markUtils';

describe('Upper Primary Merit List Grouped Columns & Summary Verification', () => {
  const mockClass: ClassStream = {
    id: 'cls-4',
    class_name: 'Grade 4',
    stream: 'East',
    education_level: 'Upper Primary',
  };

  const engLangSubj: Subject = {
    id: 'subj-eng',
    subject_name: 'English Language',
    subject_code: 'ENG',
    category: 'Core',
  };

  const engCompSubj: Subject = {
    id: 'subj-comp',
    subject_name: 'English Composition',
    subject_code: 'COMP',
    category: 'Core',
  };

  const kiswLughaSubj: Subject = {
    id: 'subj-kisw',
    subject_name: 'Kiswahili Lugha',
    subject_code: 'KISW',
    category: 'Core',
  };

  const kiswInshaSubj: Subject = {
    id: 'subj-insha',
    subject_name: 'Kiswahili Insha',
    subject_code: 'INSHA',
    category: 'Core',
  };

  it('correctly identifies Upper Primary language and composition subjects', () => {
    expect(isEnglishLanguage(engLangSubj)).toBe(true);
    expect(isUpperPrimaryCompOrInsha(engCompSubj, mockClass, 'Upper Primary')).toBe(true);
    expect(isKiswahiliLugha(kiswLughaSubj)).toBe(true);
    expect(isUpperPrimaryCompOrInsha(kiswInshaSubj, mockClass, 'Upper Primary')).toBe(true);
  });

  it('correctly calculates raw and composite scores for English and Kiswahili', () => {
    const markEng: Mark = {
      id: 'm-1',
      student_id: 'std-1',
      subject_id: engLangSubj.id,
      exam_id: 'ex-1',
      score: 48, // 48 / 60
    };

    const markComp: Mark = {
      id: 'm-2',
      student_id: 'std-1',
      subject_id: engCompSubj.id,
      exam_id: 'ex-1',
      score: 32, // 32 / 40
    };

    const evalEng = evaluateMark(markEng, { isUpperPrimaryCompOrInsha: true, subject: engLangSubj, educationLevel: 'Upper Primary' });
    const evalComp = evaluateMark(markComp, { isUpperPrimaryCompOrInsha: true, subject: engCompSubj, educationLevel: 'Upper Primary' });

    expect(Number(evalEng.displayScore)).toBe(48);
    expect(Number(evalComp.displayScore)).toBe(32);

    const compositeScore = Number(evalEng.displayScore) + Number(evalComp.displayScore);
    expect(compositeScore).toBe(80); // 80 / 100 -> 80% (EE)
  });
});
