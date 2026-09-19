import { describe, it, expect } from 'vitest';
import { calculateExamResults } from '../services/analysisEngine';
import { Student, Mark, ClassStream, Subject, Grade } from '../types';

describe('Top Overall Performers - Stream Ranking and Total Marks Truthfulness', () => {
  const mockClasses: ClassStream[] = [
    {
      id: 'cls-g9',
      stream_id: 'str-g9-red',
      class_name: 'Grade 9',
      stream: 'Red',
      capacity: 45,
      education_level: 'Junior School',
    },
    {
      id: 'cls-g9',
      stream_id: 'str-g9-blue',
      class_name: 'Grade 9',
      stream: 'Blue',
      capacity: 45,
      education_level: 'Junior School',
    },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sub-eng', subject_name: 'English', subject_code: 'ENG', category: 'Core' },
    { id: 'sub-math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core' },
    { id: 'sub-sci', subject_name: 'Integrated Science', subject_code: 'SCI', category: 'Core' },
    { id: 'sub-kis', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core' },
  ];

  const mockGrades: Grade[] = [
    { id: 'g1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Exceptional', descriptor: 'Exceeding Expectations' },
    { id: 'g2', grade_code: 'EE2', performance_level: 'EE', minimum_score: 75, maximum_score: 89, points: 7, remarks: 'Very Good', descriptor: 'Exceeding Expectations' },
    { id: 'g3', grade_code: 'ME1', performance_level: 'ME', minimum_score: 58, maximum_score: 74, points: 6, remarks: 'Good', descriptor: 'Meeting Expectations' },
    { id: 'g4', grade_code: 'ME2', performance_level: 'ME', minimum_score: 41, maximum_score: 57, points: 5, remarks: 'Fair', descriptor: 'Meeting Expectations' },
    { id: 'g5', grade_code: 'AE1', performance_level: 'AE', minimum_score: 31, maximum_score: 40, points: 4, remarks: 'Needs Support', descriptor: 'Approaching Expectations' },
    { id: 'g6', grade_code: 'BE1', performance_level: 'BE', minimum_score: 0, maximum_score: 30, points: 1, remarks: 'Below', descriptor: 'Below Expectations' },
  ];

  const mockStudents: Student[] = [
    // Red Stream Learners
    { id: 's-red-1', admission_number: 'R01', full_name: 'Red Student One', gender: 'M', stream_id: 'str-g9-red', class_id: 'cls-g9', active: true },
    { id: 's-red-2', admission_number: 'R02', full_name: 'Red Student Two', gender: 'F', stream_id: 'str-g9-red', class_id: 'cls-g9', active: true },
    { id: 's-red-3', admission_number: 'R03', full_name: 'Red Student Three', gender: 'M', stream_id: 'str-g9-red', class_id: 'cls-g9', active: true },
    // Blue Stream Learners
    { id: 's-blue-1', admission_number: 'B01', full_name: 'Blue Student One', gender: 'F', stream_id: 'str-g9-blue', class_id: 'cls-g9', active: true },
    { id: 's-blue-2', admission_number: 'B02', full_name: 'Blue Student Two', gender: 'M', stream_id: 'str-g9-blue', class_id: 'cls-g9', active: true },
    { id: 's-blue-3', admission_number: 'B03', full_name: 'Blue Student Three', gender: 'F', stream_id: 'str-g9-blue', class_id: 'cls-g9', active: true },
  ];

  const examId = 'exam-term3-opener';

  // Red sat 4 subjects; Blue sat 3 subjects
  const mockMarks: Mark[] = [
    // Red 1: 80 + 75 + 70 + 75 = 300
    { id: 'm1', student_id: 's-red-1', subject_id: 'sub-eng', exam_id: examId, score: 80 },
    { id: 'm2', student_id: 's-red-1', subject_id: 'sub-math', exam_id: examId, score: 75 },
    { id: 'm3', student_id: 's-red-1', subject_id: 'sub-sci', exam_id: examId, score: 70 },
    { id: 'm4', student_id: 's-red-1', subject_id: 'sub-kis', exam_id: examId, score: 75 },

    // Red 2: 70 + 70 + 70 + 70 = 280
    { id: 'm5', student_id: 's-red-2', subject_id: 'sub-eng', exam_id: examId, score: 70 },
    { id: 'm6', student_id: 's-red-2', subject_id: 'sub-math', exam_id: examId, score: 70 },
    { id: 'm7', student_id: 's-red-2', subject_id: 'sub-sci', exam_id: examId, score: 70 },
    { id: 'm8', student_id: 's-red-2', subject_id: 'sub-kis', exam_id: examId, score: 70 },

    // Red 3: 65 + 65 + 65 + 65 = 260
    { id: 'm9', student_id: 's-red-3', subject_id: 'sub-eng', exam_id: examId, score: 65 },
    { id: 'm10', student_id: 's-red-3', subject_id: 'sub-math', exam_id: examId, score: 65 },
    { id: 'm11', student_id: 's-red-3', subject_id: 'sub-sci', exam_id: examId, score: 65 },
    { id: 'm12', student_id: 's-red-3', subject_id: 'sub-kis', exam_id: examId, score: 65 },

    // Blue 1: 85 + 85 + 80 = 250 (In general rank, would be behind all Red learners because Red did 4 subjects)
    { id: 'm13', student_id: 's-blue-1', subject_id: 'sub-eng', exam_id: examId, score: 85 },
    { id: 'm14', student_id: 's-blue-1', subject_id: 'sub-math', exam_id: examId, score: 85 },
    { id: 'm15', student_id: 's-blue-1', subject_id: 'sub-sci', exam_id: examId, score: 80 },

    // Blue 2: 70 + 70 + 70 = 210 (Tied with Blue 3)
    { id: 'm16', student_id: 's-blue-2', subject_id: 'sub-eng', exam_id: examId, score: 70 },
    { id: 'm17', student_id: 's-blue-2', subject_id: 'sub-math', exam_id: examId, score: 70 },
    { id: 'm18', student_id: 's-blue-2', subject_id: 'sub-sci', exam_id: examId, score: 70 },

    // Blue 3: 70 + 70 + 70 = 210 (Tied with Blue 2)
    { id: 'm19', student_id: 's-blue-3', subject_id: 'sub-eng', exam_id: examId, score: 70 },
    { id: 'm20', student_id: 's-blue-3', subject_id: 'sub-math', exam_id: examId, score: 70 },
    { id: 'm21', student_id: 's-blue-3', subject_id: 'sub-sci', exam_id: examId, score: 70 },
  ];

  it('calculates truthful stream positions and isolates stream cohorts', () => {
    const results = calculateExamResults(
      examId,
      mockStudents,
      mockMarks,
      mockGrades,
      mockClasses,
      mockSubjects
    );

    expect(results).toHaveLength(6);

    // Filter Blue stream results
    const blueResults = results.filter((r) => {
      const student = mockStudents.find((s) => s.id === r.student_id);
      return student?.stream_id === 'str-g9-blue';
    });

    // Sort by total marks
    blueResults.sort((a, b) => b.total_marks - a.total_marks);

    // Blue Student One must be #1 in Blue stream
    const blue1 = blueResults.find((r) => r.student_id === 's-blue-1');
    expect(blue1).toBeDefined();
    expect(blue1?.total_marks).toBe(250);
    expect(blue1?.stream_position).toBe(1);

    // Blue Student Two & Three have identical marks (210) -> both tied at #2
    const blue2 = blueResults.find((r) => r.student_id === 's-blue-2');
    const blue3 = blueResults.find((r) => r.student_id === 's-blue-3');
    expect(blue2?.total_marks).toBe(210);
    expect(blue3?.total_marks).toBe(210);
    expect(blue2?.stream_position).toBe(2);
    expect(blue3?.stream_position).toBe(2);
  });

  it('verifies competition ranking based strictly on Total Marks for stream top performers', () => {
    const items = [
      { student_id: 's1', total_marks: 311 },
      { student_id: 's2', total_marks: 282 },
      { student_id: 's3', total_marks: 259 },
      { student_id: 's4', total_marks: 215 },
      { student_id: 's5', total_marks: 215 },
      { student_id: 's6', total_marks: 190 },
    ];

    let currentRank = 1;
    const ranked = items.map((item, idx) => {
      if (idx > 0 && item.total_marks < items[idx - 1].total_marks) {
        currentRank = idx + 1;
      }
      return { ...item, rank: currentRank };
    });

    expect(ranked[0].rank).toBe(1); // 311 -> #1
    expect(ranked[1].rank).toBe(2); // 282 -> #2
    expect(ranked[2].rank).toBe(3); // 259 -> #3
    expect(ranked[3].rank).toBe(4); // 215 -> #4
    expect(ranked[4].rank).toBe(4); // 215 -> #4 (tied)
    expect(ranked[5].rank).toBe(6); // 190 -> #6 (skips #5 due to competition ranking)
  });

  it('verifies All Streams ranking using Total Marks and competition ranking', () => {
    const results = calculateExamResults(
      examId,
      mockStudents,
      mockMarks,
      mockGrades,
      mockClasses,
      mockSubjects
    );

    // All 6 learners assessed
    const assessed = results.filter((r) => r.subject_count > 0);
    expect(assessed).toHaveLength(6);

    // Sort strictly by Total Marks descending
    assessed.sort((a, b) => b.total_marks - a.total_marks);

    let currentRank = 1;
    const ranked = assessed.map((item, idx) => {
      if (idx > 0 && item.total_marks < assessed[idx - 1].total_marks) {
        currentRank = idx + 1;
      }
      return {
        ...item,
        rank: currentRank,
      };
    });

    // Top learner across All Streams is Red 1 (300 marks) -> Rank 1
    expect(ranked[0].student_id).toBe('s-red-1');
    expect(ranked[0].total_marks).toBe(300);
    expect(ranked[0].rank).toBe(1);

    // Second is Red 2 (280 marks) -> Rank 2
    expect(ranked[1].student_id).toBe('s-red-2');
    expect(ranked[1].total_marks).toBe(280);
    expect(ranked[1].rank).toBe(2);

    // Third is Red 3 (260 marks) -> Rank 3
    expect(ranked[2].student_id).toBe('s-red-3');
    expect(ranked[2].total_marks).toBe(260);
    expect(ranked[2].rank).toBe(3);

    // Fourth is Blue 1 (250 marks) -> Rank 4
    expect(ranked[3].student_id).toBe('s-blue-1');
    expect(ranked[3].total_marks).toBe(250);
    expect(ranked[3].rank).toBe(4);

    // Fifth and Sixth are Blue 2 & Blue 3 (210 marks tied) -> Rank 5
    expect(ranked[4].total_marks).toBe(210);
    expect(ranked[5].total_marks).toBe(210);
    expect(ranked[4].rank).toBe(5);
    expect(ranked[5].rank).toBe(5);
  });

  it('calculates Grade Distribution Analysis breakdown per stream and for All Streams accurately', () => {
    const results = calculateExamResults(
      examId,
      mockStudents,
      mockMarks,
      mockGrades,
      mockClasses,
      mockSubjects
    );

    // Red stream students
    const redStudentIds = new Set(mockStudents.filter((s) => s.stream_id === 'str-g9-red').map((s) => s.id));
    const redResults = results.filter((r) => r.subject_count > 0 && redStudentIds.has(r.student_id));
    expect(redResults).toHaveLength(3);

    // Blue stream students
    const blueStudentIds = new Set(mockStudents.filter((s) => s.stream_id === 'str-g9-blue').map((s) => s.id));
    const blueResults = results.filter((r) => r.subject_count > 0 && blueStudentIds.has(r.student_id));
    expect(blueResults).toHaveLength(3);

    // All streams results
    const allResults = results.filter((r) => r.subject_count > 0);
    expect(allResults).toHaveLength(6);

    // Function to compute grade distribution counts
    const computeGradeCounts = (examResults: typeof results) => {
      const counts: Record<string, number> = {};
      mockGrades.forEach((g) => {
        counts[g.grade_code] = 0;
      });
      examResults.forEach((r) => {
        const code = r.grade_code || '';
        if (code && counts[code] !== undefined) {
          counts[code] = (counts[code] || 0) + 1;
        }
      });
      return counts;
    };

    const redGradeCounts = computeGradeCounts(redResults);
    const blueGradeCounts = computeGradeCounts(blueResults);
    const allGradeCounts = computeGradeCounts(allResults);

    // Sum of red + blue counts must match all streams counts
    mockGrades.forEach((g) => {
      const code = g.grade_code;
      expect(allGradeCounts[code]).toBe(redGradeCounts[code] + blueGradeCounts[code]);
    });

    // Total counts in all streams must equal total assessed learners (6)
    const totalAllCount = Object.values(allGradeCounts).reduce((a, b) => a + b, 0);
    expect(totalAllCount).toBe(6);

    const totalRedCount = Object.values(redGradeCounts).reduce((a, b) => a + b, 0);
    expect(totalRedCount).toBe(3);

    const totalBlueCount = Object.values(blueGradeCounts).reduce((a, b) => a + b, 0);
    expect(totalBlueCount).toBe(3);
  });
});
