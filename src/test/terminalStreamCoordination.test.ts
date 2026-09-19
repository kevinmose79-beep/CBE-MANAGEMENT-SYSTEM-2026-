import { describe, it, expect } from 'vitest';
import { Student, ClassStream, School, Subject } from '../types';
import { getStreamNameForLearner, generateTerminalMeritDataset } from '../services/terminalMeritListExporter';
import { LearningAreaTerminalResult } from '../services/terminalResultsEngine';
import { calculateCohortTerminalRankings, LearnerCohortEntry } from '../services/terminalRankingEngine';

describe('Terminal Stream Coordination & Supabase Data Models', () => {
  const mockSchool: School = {
    id: 'school-1',
    school_name: 'Test Academy',
    principal_name: 'Dr. Jane Doe',
    county: 'Nairobi',
    email: 'info@test.com',
    phone: '0700000000',
    address: '123 Test St',
    motto: 'Testing',
  };

  const mockClasses: ClassStream[] = [
    {
      id: 'class-g1',
      class_name: 'Grade 1',
      stream_id: 'stream-east-123',
      stream: 'East',
      education_level: 'Lower Primary',
    },
    {
      id: 'class-g1',
      class_name: 'Grade 1',
      stream_id: 'stream-west-456',
      stream: 'West',
      education_level: 'Lower Primary',
    },
  ];

  const mockStudents: Student[] = [
    {
      id: 's-1',
      full_name: 'Alice Wanjiku',
      admission_number: 'ADM001',
      grade: 'Grade 1',
      class_id: 'class-g1',
      stream_id: 'stream-east-123',
      gender: 'F',
      active: true,
    },
    {
      id: 's-2',
      full_name: 'Bob Kiprop',
      admission_number: 'ADM002',
      grade: 'Grade 1',
      class_id: 'class-g1',
      stream_id: 'stream-west-456',
      gender: 'M',
      active: true,
    },
    {
      id: 's-3',
      full_name: 'Charlie Omondi',
      admission_number: 'ADM003',
      grade: 'Grade 1',
      class_id: 'class-g1',
      gender: 'M',
      active: true,
    },
  ];

  const mockSubjects: Subject[] = [
    { id: 'subj-math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core' },
    { id: 'subj-eng', subject_name: 'English', subject_code: 'ENG', category: 'Core' },
  ];

  it('1. Correctly resolves stream name for learner with stream_id', () => {
    const streamName1 = getStreamNameForLearner(mockStudents[0], mockClasses);
    expect(streamName1).toBe('East');

    const streamName2 = getStreamNameForLearner(mockStudents[1], mockClasses);
    expect(streamName2).toBe('West');
  });

  it('2. Correctly resolves stream name for learner with direct stream property fallback', () => {
    Object.assign(mockStudents[2], { stream: 'East' });
    const streamName3 = getStreamNameForLearner(mockStudents[2], mockClasses);
    expect(streamName3).toBe('East');
  });

  it('3. Filters cohort students strictly by selected stream in generateTerminalMeritDataset', () => {
    const dummyResultsMap = new Map<string, Map<string, LearningAreaTerminalResult>>();

    // Filter for East stream
    const datasetEast = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 1',
      selectedStreamId: 'stream-east-123',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      learnerResultsMap: dummyResultsMap,
    });

    // Learners in East stream should be Alice (stream_id) and Charlie (stream='East')
    const eastStudentIds = datasetEast.learners.map((l) => l.student.id);
    expect(eastStudentIds).toContain('s-1');
    expect(eastStudentIds).toContain('s-3');
    expect(eastStudentIds).not.toContain('s-2');

    // Filter for West stream
    const datasetWest = generateTerminalMeritDataset({
      school: mockSchool,
      academicYear: 2026,
      term: 'Term 1',
      grade: 'Grade 1',
      selectedStreamId: 'stream-west-456',
      classes: mockClasses,
      students: mockStudents,
      subjects: mockSubjects,
      learnerResultsMap: dummyResultsMap,
    });

    const westStudentIds = datasetWest.learners.map((l) => l.student.id);
    expect(westStudentIds).toContain('s-2');
    expect(westStudentIds).not.toContain('s-1');
    expect(westStudentIds).not.toContain('s-3');
  });

  it('4. Differentiates stream position and overall grade position in Junior School cohorts', () => {
    const jsClasses: ClassStream[] = [
      { id: 'c-g7a', class_name: 'Grade 7', stream_id: 'str-east', stream: 'East', education_level: 'Junior School' },
      { id: 'c-g7b', class_name: 'Grade 7', stream_id: 'str-west', stream: 'West', education_level: 'Junior School' },
    ];

    const jsStudents: Student[] = [
      { id: 'js-1', full_name: 'Alice (East 1st, Grade 2nd)', admission_number: 'J01', grade: 'Grade 7', class_id: 'c-g7a', stream_id: 'str-east', active: true, gender: 'F' },
      { id: 'js-2', full_name: 'Bob (East 2nd, Grade 3rd)', admission_number: 'J02', grade: 'Grade 7', class_id: 'c-g7a', stream_id: 'str-east', active: true, gender: 'M' },
      { id: 'js-3', full_name: 'Charlie (West 1st, Grade 1st)', admission_number: 'J03', grade: 'Grade 7', class_id: 'c-g7b', stream_id: 'str-west', active: true, gender: 'M' },
    ];

    const jsSubjects: Subject[] = [
      { id: 's-math', subject_name: 'Mathematics', subject_code: 'MATH', education_level: 'Junior School', category: 'Core' },
    ];

    const buildResult = (pct: number): Map<string, LearningAreaTerminalResult> => {
      const map = new Map<string, LearningAreaTerminalResult>();
      map.set('s-math', {
        subjectId: 's-math',
        
        
        terminalPercentage: pct,
        cbePerformanceLevel: pct >= 80 ? 'EE' : 'ME',
        isComplete: true,
        
        
        status: 'Complete', unroundedTerminalPercentage: pct, points: 3, assessmentTrail: [],
      });
      return map;
    };

    const cohortEntries: LearnerCohortEntry[] = [
      { student: jsStudents[0], classStream: jsClasses[0], applicableSubjects: jsSubjects, resultsBySubject: buildResult(85) }, // Alice: 85 (East)
      { student: jsStudents[1], classStream: jsClasses[0], applicableSubjects: jsSubjects, resultsBySubject: buildResult(70) }, // Bob: 70 (East)
      { student: jsStudents[2], classStream: jsClasses[1], applicableSubjects: jsSubjects, resultsBySubject: buildResult(95) }, // Charlie: 95 (West)
    ];

    const rankings = calculateCohortTerminalRankings({ learners: cohortEntries });

    const aliceRank = rankings.get('js-1');
    const bobRank = rankings.get('js-2');
    const charlieRank = rankings.get('js-3');

    // Alice: In East (2 learners), score 85 -> 1st in East (1/2), 2nd in Grade (2/3)
    expect(aliceRank?.streamPosition).toBe(1);
    expect(aliceRank?.streamPositionDenominator).toBe(2);
    expect(aliceRank?.overallPosition).toBe(2);
    expect(aliceRank?.overallPositionDenominator).toBe(3);

    // Charlie: In West (1 learner), score 95 -> 1st in West (1/1), 1st in Grade (1/3)
    expect(charlieRank?.streamPosition).toBe(1);
    expect(charlieRank?.streamPositionDenominator).toBe(1);
    expect(charlieRank?.overallPosition).toBe(1);
    expect(charlieRank?.overallPositionDenominator).toBe(3);

    // Bob: In East (2 learners), score 70 -> 2nd in East (2/2), 3rd in Grade (3/3)
    expect(bobRank?.streamPosition).toBe(2);
    expect(bobRank?.streamPositionDenominator).toBe(2);
    expect(bobRank?.overallPosition).toBe(3);
    expect(bobRank?.overallPositionDenominator).toBe(3);
  });
});
