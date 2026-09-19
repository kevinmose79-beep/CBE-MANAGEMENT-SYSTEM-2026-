import { describe, it, expect } from 'vitest';
import { calculateSchoolAnalytics } from '../services/schoolAnalyticsEngine';
import { CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Examination, Student, ClassStream, Subject, Mark } from '../types';

describe('School Performance Analytics — Top 3 Stream & Class Ranking Forensics', () => {
  const sampleExam: Examination = {
    id: 'exam-1',
    exam_name: 'Term 1 Opener Exam',
    term: 'Term 1',
    year: 2026,
    academic_year_id: 'ay-2026',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
    created_at: '2026-01-10T00:00:00Z',
  };

  const sampleClasses: ClassStream[] = [
    {
      id: 'class-g8',
      stream_id: 'stream-g8-blue',
      class_name: 'Grade 8',
      stream: 'Blue',
      capacity: 45,
    },
    {
      id: 'class-g8',
      stream_id: 'stream-g8-red',
      class_name: 'Grade 8',
      stream: 'Red',
      capacity: 45,
    },
    {
      id: 'class-g7',
      stream_id: 'stream-g7-east',
      class_name: 'Grade 7',
      stream: 'East',
      capacity: 45,
    },
  ];

  const sampleSubjects: Subject[] = [
    { id: 'subj-math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', education_level: 'Junior School' },
    { id: 'subj-eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', education_level: 'Junior School' },
    { id: 'subj-kisw', subject_name: 'Kiswahili', subject_code: 'KISW', category: 'Core', education_level: 'Junior School' },
  ];

  const students: Student[] = [
    // Grade 8 Blue
    {
      id: 'std-brian',
      admission_number: '240',
      full_name: 'Brian Njehia',
      gender: 'M',
      class_id: 'class-g8',
      stream_id: 'stream-g8-blue',
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-amos',
      admission_number: '241',
      full_name: 'Amos Kipkoech',
      gender: 'M',
      class_id: 'class-g8',
      stream_id: 'stream-g8-blue',
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-abigael',
      admission_number: '242',
      full_name: 'Abigael Chelengat',
      gender: 'F',
      class_id: 'class-g8',
      stream_id: 'stream-g8-blue',
      grade: 'Grade 8',
      active: true,
    },
    {
      id: 'std-samwel',
      admission_number: '243',
      full_name: 'Samwel Macharia',
      gender: 'M',
      class_id: 'class-g8',
      stream_id: 'stream-g8-blue',
      grade: 'Grade 8',
      active: true,
    },
    // Grade 8 Red
    {
      id: 'std-faith',
      admission_number: '250',
      full_name: 'Faith Cherono',
      gender: 'F',
      class_id: 'class-g8',
      stream_id: 'stream-g8-red',
      grade: 'Grade 8',
      active: true,
    },
  ];

  // Brian: Math 95 (EE1, 8pts), Eng 85 (EE2, 7pts), Kisw 85 (EE2, 7pts) => Total: 265, Pts: 22, Avg: 88.33
  // Amos: Math 90 (EE1, 8pts), Eng 90 (EE1, 8pts), Kisw 75 (ME1, 6pts) => Total: 255, Pts: 22, Avg: 85.00
  // Abigael: Math 80 (EE2, 7pts), Eng 80 (EE2, 7pts), Kisw 80 (EE2, 7pts) => Total: 240, Pts: 21, Avg: 80.00
  // Samwel: Math 50 (AE, 4pts), Eng 50 (AE, 4pts), Kisw 50 (AE, 4pts) => Total: 150, Pts: 12, Avg: 50.00
  // Faith (Red): Math 99 (EE1, 8pts), Eng 99 (EE1, 8pts), Kisw 99 (EE1, 8pts) => Total: 297, Pts: 24, Avg: 99.00
  const marks: Mark[] = [
    // Brian
    { id: 'm1', exam_id: 'exam-1', student_id: 'std-brian', subject_id: 'subj-math', marks: 95 },
    { id: 'm2', exam_id: 'exam-1', student_id: 'std-brian', subject_id: 'subj-eng', marks: 85 },
    { id: 'm3', exam_id: 'exam-1', student_id: 'std-brian', subject_id: 'subj-kisw', marks: 85 },
    // Amos
    { id: 'm4', exam_id: 'exam-1', student_id: 'std-amos', subject_id: 'subj-math', marks: 90 },
    { id: 'm5', exam_id: 'exam-1', student_id: 'std-amos', subject_id: 'subj-eng', marks: 90 },
    { id: 'm6', exam_id: 'exam-1', student_id: 'std-amos', subject_id: 'subj-kisw', marks: 75 },
    // Abigael
    { id: 'm7', exam_id: 'exam-1', student_id: 'std-abigael', subject_id: 'subj-math', marks: 80 },
    { id: 'm8', exam_id: 'exam-1', student_id: 'std-abigael', subject_id: 'subj-eng', marks: 80 },
    { id: 'm9', exam_id: 'exam-1', student_id: 'std-abigael', subject_id: 'subj-kisw', marks: 80 },
    // Samwel
    { id: 'm10', exam_id: 'exam-1', student_id: 'std-samwel', subject_id: 'subj-math', marks: 50 },
    { id: 'm11', exam_id: 'exam-1', student_id: 'std-samwel', subject_id: 'subj-eng', marks: 50 },
    { id: 'm12', exam_id: 'exam-1', student_id: 'std-samwel', subject_id: 'subj-kisw', marks: 50 },
    // Faith (Red)
    { id: 'm13', exam_id: 'exam-1', student_id: 'std-faith', subject_id: 'subj-math', marks: 99 },
    { id: 'm14', exam_id: 'exam-1', student_id: 'std-faith', subject_id: 'subj-eng', marks: 99 },
    { id: 'm15', exam_id: 'exam-1', student_id: 'std-faith', subject_id: 'subj-kisw', marks: 99 },
  ];

  it('ranks Best 3 Learners Per Stream strictly by Total Marks descending', () => {
    const analytics = calculateSchoolAnalytics(
      'exam-1',
      [sampleExam],
      students,
      sampleClasses,
      sampleSubjects,
      marks,
      CBE_8_POINT_GRADES,
      'Junior School'
    );

    expect(analytics).not.toBeNull();
    const g8BlueTop3 = analytics!.best_three_per_stream['Grade 8 Blue'];
    expect(g8BlueTop3).toBeDefined();
    expect(g8BlueTop3.length).toBe(3);

    // Rank 1 must be Brian with 265 marks
    expect(g8BlueTop3[0].name).toBe('Brian Njehia');
    expect(g8BlueTop3[0].total_marks).toBe(265);
    expect(g8BlueTop3[0].rank).toBe(1);

    // Rank 2 must be Amos with 255 marks
    expect(g8BlueTop3[1].name).toBe('Amos Kipkoech');
    expect(g8BlueTop3[1].total_marks).toBe(255);
    expect(g8BlueTop3[1].rank).toBe(2);

    // Rank 3 must be Abigael with 240 marks
    expect(g8BlueTop3[2].name).toBe('Abigael Chelengat');
    expect(g8BlueTop3[2].total_marks).toBe(240);
    expect(g8BlueTop3[2].rank).toBe(3);
  });

  it('ranks Best 3 Learners Per Class across ALL streams in the grade', () => {
    const analytics = calculateSchoolAnalytics(
      'exam-1',
      [sampleExam],
      students,
      sampleClasses,
      sampleSubjects,
      marks,
      CBE_8_POINT_GRADES,
      'Junior School'
    );

    expect(analytics).not.toBeNull();
    const g8Top3 = analytics!.best_three_per_class['Grade 8'];
    expect(g8Top3).toBeDefined();
    expect(g8Top3.length).toBe(3);

    // Rank 1 must be Faith from Red stream with 297 marks
    expect(g8Top3[0].name).toBe('Faith Cherono');
    expect(g8Top3[0].stream).toBe('Red');
    expect(g8Top3[0].total_marks).toBe(297);
    expect(g8Top3[0].rank).toBe(1);

    // Rank 2 must be Brian from Blue stream with 265 marks
    expect(g8Top3[1].name).toBe('Brian Njehia');
    expect(g8Top3[1].stream).toBe('Blue');
    expect(g8Top3[1].total_marks).toBe(265);
    expect(g8Top3[1].rank).toBe(2);

    // Rank 3 must be Amos from Blue stream with 255 marks
    expect(g8Top3[2].name).toBe('Amos Kipkoech');
    expect(g8Top3[2].stream).toBe('Blue');
    expect(g8Top3[2].total_marks).toBe(255);
    expect(g8Top3[2].rank).toBe(3);
  });

  it('preserves independence between stream ranking, class ranking, and overall level ranking without mutation', () => {
    const analytics = calculateSchoolAnalytics(
      'exam-1',
      [sampleExam],
      students,
      sampleClasses,
      sampleSubjects,
      marks,
      CBE_8_POINT_GRADES,
      'Junior School'
    );

    // Brian is #1 in Stream Blue, #2 in Class Grade 8 (since Faith is #1), and #2 overall in Junior School
    const streamTop1 = analytics!.best_three_per_stream['Grade 8 Blue'][0];
    const classTop2 = analytics!.best_three_per_class['Grade 8'][1];
    const schoolRankings = analytics!.best_learners_school.find((s) => s.student_id === 'std-brian');

    expect(streamTop1.name).toBe('Brian Njehia');
    expect(streamTop1.rank).toBe(1);

    expect(classTop2.name).toBe('Brian Njehia');
    expect(classTop2.rank).toBe(2);

    expect(schoolRankings?.name).toBe('Brian Njehia');
    expect(schoolRankings?.rank).toBe(2);
  });

  it('correctly handles competition ties (1, 1, 3) in stream and class rankings', () => {
    // Modify Amos marks to match Brian exactly (265 marks, 22 pts, 88 avg)
    const tiedMarks: Mark[] = [
      { id: 'm1', exam_id: 'exam-1', student_id: 'std-brian', subject_id: 'subj-math', marks: 95 },
      { id: 'm2', exam_id: 'exam-1', student_id: 'std-brian', subject_id: 'subj-eng', marks: 85 },
      { id: 'm3', exam_id: 'exam-1', student_id: 'std-brian', subject_id: 'subj-kisw', marks: 85 },
      // Amos tied with Brian
      { id: 'm4', exam_id: 'exam-1', student_id: 'std-amos', subject_id: 'subj-math', marks: 95 },
      { id: 'm5', exam_id: 'exam-1', student_id: 'std-amos', subject_id: 'subj-eng', marks: 85 },
      { id: 'm6', exam_id: 'exam-1', student_id: 'std-amos', subject_id: 'subj-kisw', marks: 85 },
      // Abigael next
      { id: 'm7', exam_id: 'exam-1', student_id: 'std-abigael', subject_id: 'subj-math', marks: 80 },
      { id: 'm8', exam_id: 'exam-1', student_id: 'std-abigael', subject_id: 'subj-eng', marks: 80 },
      { id: 'm9', exam_id: 'exam-1', student_id: 'std-abigael', subject_id: 'subj-kisw', marks: 80 },
    ];

    const analytics = calculateSchoolAnalytics(
      'exam-1',
      [sampleExam],
      students,
      sampleClasses,
      sampleSubjects,
      tiedMarks,
      CBE_8_POINT_GRADES,
      'Junior School'
    );

    const g8BlueTop3 = analytics!.best_three_per_stream['Grade 8 Blue'];
    expect(g8BlueTop3[0].rank).toBe(1);
    expect(g8BlueTop3[1].rank).toBe(1);
    expect(g8BlueTop3[2].rank).toBe(3); // Competition rank skips to 3
  });
});
