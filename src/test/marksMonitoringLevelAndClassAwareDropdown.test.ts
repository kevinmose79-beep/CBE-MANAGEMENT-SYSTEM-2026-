import { describe, it, expect } from 'vitest';
import {
  Subject,
  ClassStream,
  EducationLevel,
  getApplicableSubjectsForGrade,
  getAllocatedSubjectsForClass,
  LEVEL_TO_GRADES,
  sortSubjectsByStandardOrder,
} from '../types';

describe('Marks Monitoring Level and Class Aware Learning Area Dropdown', () => {
  const sampleSubjects: Subject[] = [
    { id: 'sub_pp_lang', subject_code: 'PP-LANG', subject_name: 'Language Activities', category: 'Core', status: 'Active', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'] },
    { id: 'sub_lp_ila', subject_code: 'ILA', subject_name: 'Integrated Learning Area', category: 'Core', status: 'Active', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'] },
    { id: 'sub_up_eng', subject_code: 'UP-ENG', subject_name: 'English', category: 'Core', status: 'Active', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
    { id: 'sub_up_agr', subject_code: 'UP-AGR', subject_name: 'Agriculture & Nutrition', category: 'Core', status: 'Active', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
    { id: 'sub_js_eng', subject_code: 'ENG', subject_name: 'English', category: 'Core', status: 'Active', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sub_js_math', subject_code: 'MATH', subject_name: 'Mathematics', category: 'Core', status: 'Active', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
    { id: 'sub_js_pretech', subject_code: 'PRE-TECH', subject_name: 'Pre-Technical Studies', category: 'Core', status: 'Active', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
  ];

  const sampleClasses: ClassStream[] = [
    { id: 'cls_pp1', class_name: 'PP1', stream: 'East', education_level: 'Pre-Primary' },
    { id: 'cls_g4', class_name: 'Grade 4', stream: 'East', education_level: 'Upper Primary' },
    { id: 'cls_g7', class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
    { id: 'cls_g8', class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
  ];

  it('restricts applicable subjects to Junior School when active section is Junior School and "All Classes" is selected', () => {
    const activeLevel: EducationLevel = 'Junior School';
    const relevantInScopeClasses = sampleClasses.filter(c => c.education_level === activeLevel);

    const subjectMap = new Map<string, Subject>();
    relevantInScopeClasses.forEach((clsObj) => {
      const subs = getAllocatedSubjectsForClass(clsObj, sampleSubjects);
      subs.forEach((s) => subjectMap.set(s.id, s));
    });

    const result = sortSubjectsByStandardOrder(Array.from(subjectMap.values()));
    const codes = result.map(s => s.subject_code);

    expect(codes).toContain('ENG');
    expect(codes).toContain('MATH');
    expect(codes).toContain('PRE-TECH');
    expect(codes).not.toContain('PP-LANG');
    expect(codes).not.toContain('ILA');
    expect(codes).not.toContain('UP-AGR');
  });

  it('restricts applicable subjects to Upper Primary when active section is Upper Primary', () => {
    const activeLevel: EducationLevel = 'Upper Primary';
    const relevantInScopeClasses = sampleClasses.filter(c => c.education_level === activeLevel);

    const subjectMap = new Map<string, Subject>();
    relevantInScopeClasses.forEach((clsObj) => {
      const subs = getAllocatedSubjectsForClass(clsObj, sampleSubjects);
      subs.forEach((s) => subjectMap.set(s.id, s));
    });

    const result = sortSubjectsByStandardOrder(Array.from(subjectMap.values()));
    const codes = result.map(s => s.subject_code);

    expect(codes).toContain('UP-ENG');
    expect(codes).toContain('UP-AGR');
    expect(codes).not.toContain('ENG');
    expect(codes).not.toContain('PRE-TECH');
    expect(codes).not.toContain('PP-LANG');
  });

  it('filters subjects specifically for a selected Grade 4 class', () => {
    const cls = sampleClasses.find(c => c.class_name === 'Grade 4')!;
    const subs = getAllocatedSubjectsForClass(cls, sampleSubjects);

    const codes = subs.map(s => s.subject_code);
    expect(codes).toContain('UP-ENG');
    expect(codes).toContain('UP-AGR');
    expect(codes).not.toContain('PRE-TECH');
  });
});
