/**
 * Unified CBE Grade Color System according to Kenya Competency-Based Education (CBE) Standards.
 * EE (Exceeding Expectations) - Muted Green
 * ME (Meeting Expectations) - Muted Blue
 * AE (Approaching Expectations) - Muted Amber
 * BE (Below Expectations) - Muted Red
 */

export const getCbeGradeBadgeClass = (gradeCodeOrLevel?: string): string => {
  if (!gradeCodeOrLevel) return 'bg-slate-100 text-slate-700 border border-slate-300';

  const code = gradeCodeOrLevel.toUpperCase().trim();

  if (code.startsWith('EE') || code.includes('EXCEEDING')) {
    return 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold';
  }
  if (code.startsWith('ME') || code.includes('MEETING')) {
    return 'bg-sky-100 text-sky-900 border border-sky-300 font-bold';
  }
  if (code.startsWith('AE') || code.includes('APPROACHING')) {
    return 'bg-amber-100 text-amber-900 border border-amber-300 font-bold';
  }
  if (code.startsWith('BE') || code.includes('BELOW')) {
    return 'bg-rose-100 text-rose-900 border border-rose-300 font-bold';
  }
  if (code === 'X') {
    return 'bg-rose-100 text-rose-900 border border-rose-300 font-bold';
  }
  if (code === 'Y') {
    return 'bg-purple-100 text-purple-900 border border-purple-300 font-bold';
  }

  return 'bg-slate-100 text-slate-800 border border-slate-300 font-bold';
};

export const getCbeGradeTextClass = (gradeCodeOrLevel?: string): string => {
  if (!gradeCodeOrLevel) return 'text-slate-700';

  const code = gradeCodeOrLevel.toUpperCase().trim();

  if (code.startsWith('EE') || code.includes('EXCEEDING')) return 'text-emerald-800 font-extrabold';
  if (code.startsWith('ME') || code.includes('MEETING')) return 'text-sky-800 font-extrabold';
  if (code.startsWith('AE') || code.includes('APPROACHING')) return 'text-amber-800 font-extrabold';
  if (code.startsWith('BE') || code.includes('BELOW')) return 'text-rose-800 font-extrabold';
  if (code === 'X') return 'text-rose-800 font-extrabold';
  if (code === 'Y') return 'text-purple-800 font-extrabold';

  return 'text-slate-800 font-bold';
};

export const CBE_GRADE_CHART_COLORS: Record<string, string> = {
  EE1: '#059669', // Muted Emerald Green
  EE2: '#10B981', // Light Emerald
  ME1: '#0284C7', // Muted Sky Blue
  ME2: '#38BDF8', // Light Sky Blue
  AE1: '#D97706', // Muted Amber
  AE2: '#F59E0B', // Light Amber
  BE1: '#DC2626', // Muted Red
  BE2: '#F87171', // Light Red
};

export const getGradeChartColor = (gradeCode?: string, index: number = 0): string => {
  if (gradeCode && CBE_GRADE_CHART_COLORS[gradeCode.toUpperCase()]) {
    return CBE_GRADE_CHART_COLORS[gradeCode.toUpperCase()];
  }
  const fallback = ['#059669', '#10B981', '#0284C7', '#38BDF8', '#D97706', '#F59E0B', '#DC2626', '#F87171'];
  return fallback[index % fallback.length];
};
