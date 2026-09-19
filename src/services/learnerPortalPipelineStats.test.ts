import { describe, it, expect } from 'vitest';
import { evaluateMark } from '../utils/markUtils';
import { getGradeForMark } from './analysisEngine';

describe('Learner Portal Pipeline Stats Normalised Total Score', () => {
  it('Case 1 — All subjects out of 100', () => {
    const rawScores = [80, 90, 75, 88, 92, 70, 85, 78, 95];
    const evaluatedResults = rawScores.map((score) => {
      const evaluated = evaluateMark({ marks: score, out_of: 100 } as any);
      const grade = getGradeForMark(evaluated.percentage || 0);
      return {
        evaluated,
        rawScore: evaluated.rawScore,
        outOf: evaluated.outOf,
        percentage: evaluated.percentage,
        points: grade?.points ?? 0,
      };
    });

    const normalResults = evaluatedResults.filter(
      (r) => r.evaluated.status === 'Normal' && r.evaluated.percentage !== null
    );
    const recordedCount = normalResults.length;
    const totalAllocated = 9;
    const totalScore = normalResults.reduce(
      (sum, r) => sum + Math.round(r.evaluated.percentage || 0),
      0
    );
    const totalMaxScore = recordedCount * 100;
    const averagePercentage = recordedCount > 0 ? Math.round(totalScore / recordedCount) : 0;
    const totalPoints = evaluatedResults.reduce((sum, r) => sum + (r.points || 0), 0);
    const maxPoints = totalAllocated * 8;

    expect(recordedCount).toBe(9);
    expect(totalScore).toBe(753); // 80+90+75+88+92+70+85+78+95 = 753
    expect(totalMaxScore).toBe(900);
    expect(averagePercentage).toBe(Math.round(753 / 9)); // 84%
    expect(maxPoints).toBe(72);
  });

  it('Case 2 — Mixed paper maximums should produce normalised percentage total, not raw sum 548 / 706', () => {
    const mixedPapers = [
      { score: 67, outOf: 90 }, // 74.44% -> 74
      { score: 55, outOf: 70 }, // 78.57% -> 79
      { score: 72, outOf: 80 }, // 90.00% -> 90
      { score: 45, outOf: 60 }, // 75.00% -> 75
      { score: 62, outOf: 80 }, // 77.50% -> 78
      { score: 42, outOf: 50 }, // 84.00% -> 84
      { score: 68, outOf: 86 }, // 79.07% -> 79
      { score: 70, outOf: 90 }, // 77.78% -> 78
      { score: 67, outOf: 100 }, // 67.00% -> 67
    ];

    // Raw sum would be: 67+55+72+45+62+42+68+70+67 = 548
    // Raw max sum would be: 90+70+80+60+80+50+86+90+100 = 706
    const rawSum = mixedPapers.reduce((acc, p) => acc + p.score, 0);
    const rawMaxSum = mixedPapers.reduce((acc, p) => acc + p.outOf, 0);
    expect(rawSum).toBe(548);
    expect(rawMaxSum).toBe(706);

    const evaluatedResults = mixedPapers.map((p) => {
      const evaluated = evaluateMark({ marks: p.score, out_of: p.outOf } as any);
      const grade = getGradeForMark(evaluated.percentage || 0);
      return {
        evaluated,
        rawScore: evaluated.rawScore,
        outOf: evaluated.outOf,
        percentage: evaluated.percentage,
        points: grade?.points ?? 0,
      };
    });

    const normalResults = evaluatedResults.filter(
      (r) => r.evaluated.status === 'Normal' && r.evaluated.percentage !== null
    );
    const recordedCount = normalResults.length;
    const totalAllocated = 9;
    const totalScore = normalResults.reduce(
      (sum, r) => sum + Math.round(r.evaluated.percentage || 0),
      0
    );
    const totalMaxScore = recordedCount * 100;
    const averagePercentage = recordedCount > 0 ? Math.round(totalScore / recordedCount) : 0;

    // Normalised percentages rounded: 74 + 79 + 90 + 75 + 78 + 84 + 79 + 78 + 67 = 704
    expect(totalScore).toBe(704);
    expect(totalMaxScore).toBe(900);
    expect(totalScore).not.toBe(548);
    expect(totalMaxScore).not.toBe(706);
    expect(averagePercentage).toBe(78);
  });

  it('Case 3 — Marcus Jordan Opener 1 Term 2 2026 Authoritative Results', () => {
    // Marcus Jordan's 9 subjects in Grade 9 Opener 1 Term 2
    // Subject marks percentages summing to 783 with EE2 and 65 points
    const marcusSubjectPercentages = [92, 88, 85, 90, 84, 87, 86, 83, 88]; // sum = 783
    const evaluatedResults = marcusSubjectPercentages.map((pct) => {
      const evaluated = evaluateMark({ marks: pct, out_of: 100 } as any);
      const grade = getGradeForMark(evaluated.percentage || 0);
      return {
        evaluated,
        rawScore: evaluated.rawScore,
        outOf: evaluated.outOf,
        percentage: evaluated.percentage,
        points: grade?.points ?? 0,
      };
    });

    const normalResults = evaluatedResults.filter(
      (r) => r.evaluated.status === 'Normal' && r.evaluated.percentage !== null
    );
    const recordedCount = normalResults.length;
    const totalAllocated = 9;
    const totalScore = normalResults.reduce(
      (sum, r) => sum + Math.round(r.evaluated.percentage || 0),
      0
    );
    const totalMaxScore = recordedCount * 100;
    const averagePercentage = recordedCount > 0 ? Math.round(totalScore / recordedCount) : 0;
    const totalPoints = evaluatedResults.reduce((sum, r) => sum + (r.points || 0), 0);
    const maxPoints = totalAllocated * 8;
    const meanGrade = recordedCount > 0 ? getGradeForMark(averagePercentage) : null;
    const isComplete = totalAllocated > 0 && recordedCount === totalAllocated;

    expect(totalScore).toBe(783);
    expect(totalMaxScore).toBe(900);
    expect(averagePercentage).toBe(87);
    expect(meanGrade?.grade_code).toBe('EE2');
    expect(meanGrade?.performance_level).toBe('EE');
    expect(meanGrade?.descriptor).toBe('Exceeding Expectations');
    expect(totalPoints).toBe(65);
    expect(maxPoints).toBe(72);
    expect(isComplete).toBe(true);
  });

  it('Case 4 — Subject-Level Display preserves raw assessment', () => {
    const rawPaper = { score: 67, outOf: 90 };
    const evaluated = evaluateMark({ marks: rawPaper.score, out_of: rawPaper.outOf } as any);
    const grade = getGradeForMark(evaluated.percentage || 0);

    expect(evaluated.rawScore).toBe(67);
    expect(evaluated.outOf).toBe(90);
    expect(Math.round(evaluated.percentage || 0)).toBe(74);
    expect(grade?.grade_code).toBe('ME1');
  });

  it('Case 5 — Missing mark (X) is handled correctly and marks as provisional/incomplete', () => {
    const subjects = [
      { score: 80, outOf: 100, special_status: 'Normal' },
      { score: 'X', outOf: 100, special_status: 'X' },
      { score: 75, outOf: 100, special_status: 'Normal' },
    ];

    const evaluatedResults = subjects.map((s) => {
      const evaluated = evaluateMark({ marks: s.score, out_of: s.outOf, special_status: s.special_status } as any);
      const grade = evaluated.percentage !== null ? getGradeForMark(evaluated.percentage) : null;
      return {
        evaluated,
        rawScore: evaluated.rawScore,
        outOf: evaluated.outOf,
        percentage: evaluated.percentage,
        points: grade?.points ?? 0,
      };
    });

    const normalResults = evaluatedResults.filter(
      (r) => r.evaluated.status === 'Normal' && r.evaluated.percentage !== null
    );
    const recordedCount = normalResults.length;
    const totalAllocated = 3;
    const totalScore = normalResults.reduce(
      (sum, r) => sum + Math.round(r.evaluated.percentage || 0),
      0
    );
    const totalMaxScore = recordedCount * 100;
    const specialStatusCount = evaluatedResults.filter(
      (r) => r.evaluated.status === 'X' || r.evaluated.status === 'Y'
    ).length;
    const isComplete = totalAllocated > 0 && recordedCount === totalAllocated && specialStatusCount === 0;

    expect(recordedCount).toBe(2);
    expect(totalScore).toBe(155);
    expect(totalMaxScore).toBe(200);
    expect(specialStatusCount).toBe(1);
    expect(isComplete).toBe(false);
  });
});
