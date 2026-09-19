import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  BookOpen,
  Users,
  Building2,
  Layers,
  FileDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  ChevronRight,
  Search,
  SlidersHorizontal,
  BarChart3,
  PieChart as PieIcon,
  Sparkles,
  Trophy,
  Activity,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { api } from "../lib/storage";
import { ChartWrapper } from './ChartWrapper';
import { canGenerateReports, getTermStatusMessage } from "../utils/termStatusUtils";
import { useAcademicSession } from "../contexts/AcademicSessionContext";

import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Mark,
  Grade,
  User,
  Teacher,
  EducationLevel,
  ALL_EDUCATION_LEVELS,
  getEducationLevelForGrade,
} from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { getActiveTeacher, getAccessibleClasses, getAccessibleSubjects, getAccessibleStudents } from '../utils/rbacUtils';
import {
  calculateSchoolAnalytics,
  compareExaminations,
  LearnerPerformerItem,
} from '../services/schoolAnalyticsEngine';
import { SubjectPerformanceTrendsGraph } from './SubjectPerformanceTrendsGraph';
import { isClassInExamScope } from '../utils/filterUtils';
import { groupExamsForDropdown } from '../utils/examDisplayUtils';
import {
  exportClassRankingPDF,
  exportStreamRankingPDF,
  exportSubjectAnalysisPDF,
  exportSchoolPerformancePDF,
  exportComprehensiveAnalyticsPDF,
  exportBestLearnersPDF,
  exportExamComparisonPDF,
  exportPerformanceDeviationPDF,
} from '../services/schoolAnalyticsPdfExporter';

interface Props {
  school: School;
  exams: Examination[];
  students: Student[];
  classes: ClassStream[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  currentUser?: User;
  onNavigateToTab?: (tab: any) => void;
  onMarksUpdated?: () => void;
}

type SubTab = 'overview' | 'rankings' | 'subjects' | 'top-performers' | 'comparison';

const CustomAnalyticsChartTooltip = ({ active, payload, label, type }: any) => {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0];
  const data = item.payload || {};

  if (type === 'class') {
    const className = data.name || label;
    const meanScore = data['Mean Score (%)'];
    const meanPoints = data['Mean Points'];

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[160px] z-50 pointer-events-none">
        <div className="font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/80 pb-1">
          {className}
        </div>
        <div className="flex items-center justify-between gap-4 pt-0.5">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Mean Score:</span>
          <span className="font-extrabold text-[#176B45] dark:text-emerald-400">
            {meanScore !== undefined ? `${meanScore}%` : 'N/A'}
          </span>
        </div>
        {meanPoints !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Mean Points:</span>
            <span className="font-extrabold text-slate-700 dark:text-slate-300">
              {Number(meanPoints).toFixed(2)} pts
            </span>
          </div>
        )}
      </div>
    );
  }

  if (type === 'competency') {
    const levelName = data.name || label;
    const value = item.value;

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[150px] z-50 pointer-events-none">
        <div className="font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/80 pb-1">
          {levelName}
        </div>
        <div className="flex items-center justify-between gap-4 pt-0.5">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Learners:</span>
          <span className="font-extrabold text-[#176B45] dark:text-emerald-400">
            {value} {value === 1 ? 'Learner' : 'Learners'}
          </span>
        </div>
      </div>
    );
  }

  if (type === 'subject') {
    const fullName = data.fullName || label;
    const shortName = data.name;
    const meanScore = data['Mean Score (%)'];
    const meanPoints = data['Mean Points'];
    const candidates = data.total_candidates;

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[170px] z-50 pointer-events-none">
        <div className="font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/80 pb-1">
          {fullName} {shortName ? `(${shortName})` : ''}
        </div>
        <div className="flex items-center justify-between gap-4 pt-0.5">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Mean Score:</span>
          <span className="font-extrabold text-[#176B45] dark:text-emerald-400 text-sm">
            {meanScore !== undefined ? `${meanScore}%` : 'N/A'}
          </span>
        </div>
        {meanPoints !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Mean Points:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {Number(meanPoints).toFixed(2)} pts
            </span>
          </div>
        )}
        {candidates !== undefined && (
          <div className="flex items-center justify-between gap-4 pt-0.5 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-slate-400 text-[10px]">Candidates:</span>
            <span className="font-semibold text-slate-600 dark:text-slate-300 text-[10px]">
              {candidates}
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export const SchoolPerformanceAnalytics: React.FC<Props> = ({
  school,
  exams = [],
  students = [],
  classes = [],
  subjects = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser,
  onNavigateToTab,
  onMarksUpdated,
}) => {
  const { viewingTerm: activeTermObj, viewingYear: activeYearObj } = useAcademicSession();
  const activeTeacher = getActiveTeacher(currentUser || null, teachers);
  const accessibleClasses = React.useMemo(() => getAccessibleClasses(currentUser || null, activeTeacher, classes), [currentUser, activeTeacher, classes]);
  const accessibleSubjects = React.useMemo(() => getAccessibleSubjects(currentUser || null, activeTeacher, subjects), [currentUser, activeTeacher, subjects]);
  const accessibleStudents = React.useMemo(() => getAccessibleStudents(currentUser || null, activeTeacher, students, classes), [currentUser, activeTeacher, students, classes]);

  // Educational Level state
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel>('Junior School');

  // Primary exam selection
  const [selectedExamId, setSelectedExamId] = useState<string>(
    exams.length > 0 ? exams[0].id : ''
  );

  // Secondary comparison exam selection
  const [compareExamId, setCompareExamId] = useState<string>(
    exams.length > 1 ? exams[1].id : ''
  );

  // Auto-detect and select exam matching active/viewing term session
  useEffect(() => {
    if (!exams || exams.length === 0) return;
    if (!selectedExamId || !exams.some((e) => e.id === selectedExamId)) {
      const match =
        exams.find(
          (ex) =>
            ex.year === activeYearObj?.year &&
            ex.term === activeTermObj?.term_name &&
            ex.status !== 'Archived'
        ) ||
        exams.find((ex) => ex.year === activeYearObj?.year && ex.term === activeTermObj?.term_name) ||
        exams[0];
      if (match) {
        setSelectedExamId(match.id);
      }
    }
  }, [exams, activeYearObj?.year, activeTermObj?.term_name]);

  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');

  // Fetch targeted marks for selected exams from Supabase
  useEffect(() => {
    let isMounted = true;
    if (!selectedExamId && !compareExamId) {
      setIsLoadingMarks(false);
      return;
    }

    setIsLoadingMarks(true);
    const options = {
      classId: selectedClassFilter !== 'all' ? selectedClassFilter : undefined,
      subjectId: selectedSubjectFilter !== 'all' ? selectedSubjectFilter : undefined,
    };
    const promises: Promise<any>[] = [];
    if (selectedExamId) promises.push(api.fetchMarksForExam(selectedExamId, options));
    if (compareExamId) promises.push(api.fetchMarksForExam(compareExamId, options));

    Promise.all(promises)
      .then(() => {
        if (isMounted) {
          setIsLoadingMarks(false);
          onMarksUpdated?.();
        }
      })
      .catch((err) => {
        console.error('Error fetching analytics marks:', err);
        if (isMounted) setIsLoadingMarks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedExamId, compareExamId, selectedClassFilter, selectedSubjectFilter]);

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  const [learnerSearchQuery, setLearnerSearchQuery] = useState('');
  const [subjectEduLevelFilter, setSubjectEduLevelFilter] = useState<EducationLevel>('Junior School');
  const [standingsEduLevelFilter, setStandingsEduLevelFilter] = useState<EducationLevel>('Junior School');
  const [classBreakdownEduLevelFilter, setClassBreakdownEduLevelFilter] = useState<EducationLevel>('Junior School');
  const [classBreakdownClassFilter, setClassBreakdownClassFilter] = useState<string>('all');
  const [topPerformersEduLevelFilter, setTopPerformersEduLevelFilter] = useState<EducationLevel>('Junior School');
  const [topPerformersClassFilter, setTopPerformersClassFilter] = useState<string>('all');
  const [topPerformersSubjectFilter, setTopPerformersSubjectFilter] = useState<string>('all');
  const [overviewSubjectClassFilter, setOverviewSubjectClassFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');
  const [exportErrorMsg, setExportErrorMsg] = useState('');

  // Handler for Class Subject Breakdown Education Level filter
  const handleClassBreakdownEduLevelChange = (newLevel: EducationLevel) => {
    setClassBreakdownEduLevelFilter(newLevel);
    setClassBreakdownClassFilter('all');
  };

  // Handlers for Best Subject Performers filters
  const handleTopPerformersEduLevelChange = (newLevel: EducationLevel) => {
    setTopPerformersEduLevelFilter(newLevel);
    setTopPerformersClassFilter('all');
    setTopPerformersSubjectFilter('all');
  };

  const handleTopPerformersClassChange = (newClass: string) => {
    setTopPerformersClassFilter(newClass);
    setTopPerformersSubjectFilter('all');
  };

  // Synchronized Education Level change handler
  const handleEducationLevelChange = (newLevel: EducationLevel) => {
    setSelectedLevel(newLevel);
    setStandingsEduLevelFilter(newLevel);
    setSubjectEduLevelFilter(newLevel);
    setClassBreakdownEduLevelFilter(newLevel);
    setClassBreakdownClassFilter('all');
    setTopPerformersEduLevelFilter(newLevel);
    setTopPerformersClassFilter('all');
    setTopPerformersSubjectFilter('all');
    setSelectedClassFilter('all');
    setOverviewSubjectClassFilter('all');
  };

  // Auto-reset class filter when main education level changes
  useEffect(() => {
    setSelectedClassFilter('all');
    setOverviewSubjectClassFilter('all');
  }, [selectedLevel]);

  // Filter exams based on selectedLevel and selectedClassFilter to be fully level and exam-aware
  const filteredExams = useMemo(() => {
    if (!exams || exams.length === 0) return [];
    return exams.filter((ex) => {
      // 1. Check if the exam matches the selectedLevel
      let isMatchingLevel = false;
      if (ex.education_level && ex.education_level !== 'all' && (ex.education_level as string) !== 'All Levels') {
        isMatchingLevel = ex.education_level === selectedLevel;
      } else if (ex.class_id && ex.class_id !== 'all') {
        const matchedClass = classes.find((c) => c.id === ex.class_id || c.class_name === ex.class_id);
        if (matchedClass) {
          const classLevel = matchedClass.education_level || getEducationLevelForGrade(matchedClass.class_name);
          isMatchingLevel = classLevel === selectedLevel;
        } else {
          try {
            const level = getEducationLevelForGrade(ex.class_id);
            isMatchingLevel = level === selectedLevel;
          } catch (e) {}
        }
      } else if (ex.exam_name) {
        const match = ex.exam_name.match(/\b(Grade\s+\d+|PP\d+|PP\s*\d+)\b/i);
        if (match) {
          const gradeName = match[1];
          try {
            const level = getEducationLevelForGrade(gradeName);
            isMatchingLevel = level === selectedLevel;
          } catch (e) {}
        } else {
          // School-wide exam (or doesn't indicate a grade). Check if any class in this level is in scope
          isMatchingLevel = classes.some((cls) => {
            const clsLevel = cls.education_level || getEducationLevelForGrade(cls.class_name);
            return clsLevel === selectedLevel && isClassInExamScope(cls, ex);
          });
        }
      } else {
        isMatchingLevel = classes.some((cls) => {
          const clsLevel = cls.education_level || getEducationLevelForGrade(cls.class_name);
          return clsLevel === selectedLevel && isClassInExamScope(cls, ex);
        });
      }

      if (!isMatchingLevel) return false;

      // 2. If a specific class filter is selected, check if the exam matches the selectedClassFilter
      if (selectedClassFilter && selectedClassFilter !== 'all') {
        // If the exam is class-specific (has class_id)
        if (ex.class_id && ex.class_id !== 'all') {
          const matchedClass = classes.find((c) => c.id === ex.class_id || c.class_name === ex.class_id);
          if (matchedClass) {
            return matchedClass.class_name === selectedClassFilter;
          }
          return ex.class_id === selectedClassFilter;
        }
        
        // If the exam name contains a grade name, it should match the selected class filter
        if (ex.exam_name) {
          const match = ex.exam_name.match(/\b(Grade\s+\d+|PP\d+|PP\s*\d+)\b/i);
          if (match) {
            const gradeName = match[1];
            try {
              const cleanGradeName = gradeName.replace(/\s+/g, '').toLowerCase();
              const cleanClassFilter = selectedClassFilter.replace(/\s+/g, '').toLowerCase();
              if (cleanGradeName !== cleanClassFilter) {
                return false;
              }
            } catch (e) {}
          }
        }

        // If the exam is level-wide, ensure the selectedClassFilter class is in scope
        const hasClassInScope = classes.some((cls) => {
          return cls.class_name === selectedClassFilter && isClassInExamScope(cls, ex);
        });
        if (!hasClassInScope) return false;
      }

      return true;
    });
  }, [exams, selectedLevel, selectedClassFilter, classes]);

  // Auto-reset/update selectedExamId when filteredExams change to ensure the selected exam is always valid
  useEffect(() => {
    if (filteredExams.length === 0) {
      setSelectedExamId('');
      return;
    }
    // If the currently selected exam is not in the filtered list, reset it to the first available filtered exam
    if (!selectedExamId || !filteredExams.some((ex) => ex.id === selectedExamId)) {
      const match =
        filteredExams.find(
          (ex) =>
            ex.year === activeYearObj?.year &&
            ex.term === activeTermObj?.term_name &&
            ex.status !== 'Archived'
        ) ||
        filteredExams.find((ex) => ex.year === activeYearObj?.year && ex.term === activeTermObj?.term_name) ||
        filteredExams[0];
      if (match) {
        setSelectedExamId(match.id);
      }
    }
  }, [filteredExams, selectedExamId, activeYearObj?.year, activeTermObj?.term_name]);

  // Auto-reset/update compareExamId when filteredExams change to ensure it remains a valid comparison exam
  useEffect(() => {
    if (compareExamId) {
      const isValid = filteredExams.some((ex) => ex.id === compareExamId) && compareExamId !== selectedExamId;
      if (!isValid) {
        setCompareExamId('');
      }
    }
  }, [filteredExams, selectedExamId, compareExamId]);

  // Calculate Primary Analytics for the selected Educational Level
  const analytics = useMemo(() => {
    if (!selectedExamId) return null;
    return calculateSchoolAnalytics(
      selectedExamId,
      exams,
      accessibleStudents,
      accessibleClasses,
      accessibleSubjects,
      marks,
      grades,
      selectedLevel,
      selectedClassFilter
    );
  }, [selectedExamId, exams, accessibleStudents, accessibleClasses, accessibleSubjects, marks, grades, selectedLevel, selectedClassFilter]);

  // Calculate Comparison Analytics if 2 exams are selected
  const comparison = useMemo(() => {
    if (!selectedExamId || !compareExamId || selectedExamId === compareExamId) {
      return null;
    }
    return compareExaminations(
      selectedExamId,
      compareExamId,
      exams,
      students,
      classes,
      subjects,
      marks,
      grades,
      selectedLevel,
      selectedClassFilter
    );
  }, [selectedExamId, compareExamId, exams, students, classes, subjects, marks, grades, selectedLevel, selectedClassFilter]);

  // Helper for level badges
  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'EE':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-semibold';
      case 'ME':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 font-semibold';
      case 'AE':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-semibold';
      case 'BE':
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  const triggerPDFExport = async (exporter: () => Promise<void>, reportName: string) => {
    try {
      setIsExporting(true);
      setExportSuccessMsg('');
      setExportErrorMsg('');
      await exporter();
      setExportSuccessMsg(`✓ PDF generated successfully.`);
      setTimeout(() => setExportSuccessMsg(''), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      setExportErrorMsg('Unable to generate the PDF report. Please try again or contact the system administrator.');
      setTimeout(() => setExportErrorMsg(''), 6000);
    } finally {
      setIsExporting(false);
    }
  };

  // Charts Data Prep
  const classChartData = (analytics?.class_rankings || []).map((c) => ({
    name: c.class_name,
    'Mean Score (%)': c.mean_percentage,
    'Mean Points': c.mean_points,
  }));

  const streamChartData = (analytics?.stream_rankings || []).map((s) => ({
    name: s.full_name,
    'Mean Score (%)': s.mean_percentage,
  }));

  const subjectChartData = useMemo(() => {
    if (!analytics) return [];

    if (overviewSubjectClassFilter !== 'all') {
      const classAnal = analytics.class_subject_analysis.find(
        (c) => c.class_name === overviewSubjectClassFilter
      );
      if (classAnal && classAnal.subjects.length > 0) {
        return classAnal.subjects.map((sb) => ({
          name: sb.subject_code || sb.subject_name.slice(0, 8),
          fullName: sb.subject_name,
          'Mean Score (%)': Math.round(sb.mean_marks),
          'Mean Points': sb.mean_points,
          total_candidates: sb.candidates_count,
        }));
      }
    }

    return analytics.subject_rankings.map((sb) => ({
      name: sb.subject_code || sb.subject_name.slice(0, 8),
      fullName: sb.subject_name,
      'Mean Score (%)': Math.round(sb.mean_percentage),
      'Mean Points': sb.mean_points,
      total_candidates: sb.total_candidates,
    }));
  }, [analytics, overviewSubjectClassFilter]);

  // Competency distribution data for Pie Chart
  const isJuniorSchool = selectedLevel === 'Junior School';
  const levelCountsMap = isJuniorSchool
    ? { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 }
    : { EE: 0, ME: 0, AE: 0, BE: 0 };

  (analytics?.best_learners_school || []).forEach((l) => {
    if (l) {
      const levelKey = isJuniorSchool ? l.grade_code : l.overall_level;
      if (levelKey && levelKey in levelCountsMap) {
        levelCountsMap[levelKey as keyof typeof levelCountsMap]++;
      }
    }
  });

  const pieChartData = isJuniorSchool
    ? [
        { name: 'Exceeding 1 (EE1)', value: (levelCountsMap as any).EE1 || 0, color: '#14532D' },
        { name: 'Exceeding 2 (EE2)', value: (levelCountsMap as any).EE2 || 0, color: '#166534' },
        { name: 'Meeting 1 (ME1)', value: (levelCountsMap as any).ME1 || 0, color: '#15803D' },
        { name: 'Meeting 2 (ME2)', value: (levelCountsMap as any).ME2 || 0, color: '#22C55E' },
        { name: 'Approaching 1 (AE1)', value: (levelCountsMap as any).AE1 || 0, color: '#B45309' },
        { name: 'Approaching 2 (AE2)', value: (levelCountsMap as any).AE2 || 0, color: '#F59E0B' },
        { name: 'Below 1 (BE1)', value: (levelCountsMap as any).BE1 || 0, color: '#BE123C' },
        { name: 'Below 2 (BE2)', value: (levelCountsMap as any).BE2 || 0, color: '#EF4444' },
      ].filter((item) => item.value > 0)
    : [
        { name: 'Exceeding (EE)', value: (levelCountsMap as any).EE || 0, color: '#176B45' },
        { name: 'Meeting (ME)', value: (levelCountsMap as any).ME || 0, color: '#10B981' },
        { name: 'Approaching (AE)', value: (levelCountsMap as any).AE || 0, color: '#F59E0B' },
        { name: 'Below (BE)', value: (levelCountsMap as any).BE || 0, color: '#EF4444' },
      ].filter((item) => item.value > 0);

  // Filtered best learners list
  const filteredBestLearners = (analytics?.best_learners_school || []).filter((l) => {
    if (!l) return false;
    const q = (learnerSearchQuery || '').toLowerCase();
    const name = (l.name || '').toLowerCase();
    const adm = (l.admission_number || '').toLowerCase();
    const matchesQuery = !q || name.includes(q) || adm.includes(q);
    const matchesClass =
      selectedClassFilter === 'all' || l.class_name === selectedClassFilter;
    return matchesQuery && matchesClass;
  });

  if (!canGenerateReports(activeTermObj.status)) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 p-6 rounded-2xl max-w-md mx-auto border border-amber-200 dark:border-amber-800">
          <h2 className="text-lg font-bold mb-2 text-amber-900 dark:text-amber-100">Term {activeTermObj.status}</h2>
          <p className="text-sm text-amber-800 dark:text-amber-300">{getTermStatusMessage(activeTermObj.status)}</p>
          <button onClick={() => window.history.back()} className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white font-bold rounded-lg">
            Return
          </button>
        </div>
      </div>
    );
  }

  if (!analytics || exams.length === 0) {
    return (
      <div className="space-y-6 pb-12">
        {/* Educational Level Section Selector (Ranks educational levels separately) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Educational Level Section Filter
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Select curriculum level to evaluate isolated performance and rankings
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
            <button
              onClick={() => handleEducationLevelChange('Junior School')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 border ${
                selectedLevel === 'Junior School'
                  ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Junior School (7–9)</span>
            </button>

            <button
              onClick={() => handleEducationLevelChange('Upper Primary')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 border ${
                selectedLevel === 'Upper Primary'
                  ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Upper Primary (4–6)</span>
            </button>

            <button
              onClick={() => handleEducationLevelChange('Lower Primary')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 border ${
                selectedLevel === 'Lower Primary'
                  ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Lower Primary (1–3)</span>
            </button>

            <button
              onClick={() => handleEducationLevelChange('Pre-Primary')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 border ${
                selectedLevel === 'Pre-Primary'
                  ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Pre-Primary (PP1–2)</span>
            </button>
          </div>
        </div>

        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <Activity className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Assessment Data Available</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            There are no active assessments recorded for <strong>{selectedLevel}</strong> {selectedClassFilter !== 'all' ? `(${selectedClassFilter})` : ''}. Please select another level or create assessments to evaluate performance rankings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Educational Level Section Selector (Ranks educational levels separately) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Educational Level Section Filter
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Select curriculum level to evaluate isolated performance and rankings
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
          <button
            onClick={() => handleEducationLevelChange('Junior School')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 border ${
              selectedLevel === 'Junior School'
                ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Junior School (7–9)</span>
          </button>

          <button
            onClick={() => handleEducationLevelChange('Upper Primary')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 border ${
              selectedLevel === 'Upper Primary'
                ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Upper Primary (4–6)</span>
          </button>

          <button
            onClick={() => handleEducationLevelChange('Lower Primary')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 border ${
              selectedLevel === 'Lower Primary'
                ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Lower Primary (1–3)</span>
          </button>

          <button
            onClick={() => handleEducationLevelChange('Pre-Primary')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 border ${
              selectedLevel === 'Pre-Primary'
                ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Pre-Primary (PP1–2)</span>
          </button>
        </div>
      </div>

      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[#176B45] dark:text-emerald-400 font-bold text-xs tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
              <span>{analytics.education_level_title} Analytics & Merit Standings</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {analytics.education_level_title} Performance Rankings
            </h1>
          </div>

          {/* Exam & Class Selector Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between min-w-[200px]">
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                Target Assessment
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-lg px-3 py-2 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500 focus:border-[#176B45] w-full cursor-pointer"
              >
                {groupExamsForDropdown(filteredExams, activeYearObj?.year, activeTermObj?.term_name).map((grp, gIdx) => (
                  <optgroup key={`spa_sel_grp_${gIdx}`} label={grp.label} className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    {grp.exams.map(({ exam, label }) => (
                      <option key={exam.id} value={exam.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium">
                        {label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between min-w-[200px]">
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                Compare With (Optional)
              </label>
              <select
                value={compareExamId}
                onChange={(e) => setCompareExamId(e.target.value)}
                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-lg px-3 py-2 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500 focus:border-[#176B45] w-full cursor-pointer"
              >
                <option value="" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium">-- No Comparison --</option>
                {groupExamsForDropdown(
                  filteredExams.filter((ex) => ex.id !== selectedExamId),
                  activeYearObj?.year,
                  activeTermObj?.term_name
                ).map((grp, gIdx) => (
                  <optgroup key={`spa_comp_grp_${gIdx}`} label={grp.label} className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    {grp.exams.map(({ exam, label }) => (
                      <option key={exam.id} value={exam.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium">
                        {label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between min-w-[200px]">
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">
                Filter by Class
              </label>
              <select
                value={selectedClassFilter}
                onChange={(e) => {
                  setSelectedClassFilter(e.target.value);
                  setOverviewSubjectClassFilter('all');
                  setClassBreakdownClassFilter(e.target.value);
                  setTopPerformersClassFilter(e.target.value);
                }}
                className="bg-white dark:bg-slate-800 text-[#176B45] dark:text-emerald-400 text-xs font-bold rounded-lg px-3 py-2 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500 focus:border-[#176B45] w-full cursor-pointer font-black"
              >
                <option value="all">All Classes</option>
                {Array.from(
                  new Set(
                    classes
                      .filter((c) => getEducationLevelForGrade(c.class_name) === selectedLevel)
                      .map((c) => c.class_name)
                  )
                ).map((cName) => (
                  <option key={cName} value={cName}>
                    {cName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs & Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                activeSubTab === 'overview'
                  ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Executive Dashboard</span>
            </button>

            <button
              onClick={() => setActiveSubTab('rankings')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                activeSubTab === 'rankings'
                  ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Class & Stream Rankings</span>
            </button>

            <button
              onClick={() => setActiveSubTab('subjects')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                activeSubTab === 'subjects'
                  ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Learning Areas Analysis</span>
            </button>

            <button
              onClick={() => setActiveSubTab('top-performers')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                activeSubTab === 'top-performers'
                  ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Top Performers & Best Learners</span>
            </button>

            <button
              onClick={() => setActiveSubTab('comparison')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                activeSubTab === 'comparison'
                  ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Assessment Comparisons & Trends</span>
            </button>
          </div>

          {/* Action Button: Comprehensive PDF Download */}
          <div className="shrink-0 flex items-center pt-2 lg:pt-0">
            <button
              disabled={isExporting}
              onClick={() => triggerPDFExport(() => exportComprehensiveAnalyticsPDF(analytics, comparison, school), 'Comprehensive Analytics Report')}
              className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 ${
                isExporting 
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                  : 'bg-[#176B45] hover:bg-[#0F5132] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white'
              }`}
            >
              {isExporting ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Generating {analytics.education_level_title} Analytics Report...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Download PDF Reports</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {exportSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{exportSuccessMsg}</span>
        </div>
      )}
      
      {exportErrorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-800 dark:text-red-200 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in mb-4">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <span>{exportErrorMsg}</span>
        </div>
      )}

      {isLoadingMarks ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xs my-4">
          <LoadingIndicator minHeight="min-h-[300px]" />
        </div>
      ) : (
        <>
          {/* ==================== SUB-TAB 1: EXECUTIVE DASHBOARD ==================== */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Metric Cards (Item 11 in Prompt) */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Level Mean Marks</span>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {Math.round(analytics.overall_school_mean)} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">/ {analytics.max_obtainable_marks}</span>
              </div>
              <div className="text-xs font-semibold text-[#176B45] dark:text-emerald-400 mt-0.5">
                {Math.round(analytics.overall_school_mean_percentage ?? 0)}% • {analytics.overall_school_level}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Mean Points</span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {analytics.overall_school_mean_points.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Out of {isJuniorSchool ? '8.0' : '4.0'} Points</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Assessed Learners</span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {analytics.total_students_assessed}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sat Assessment</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Classes / Streams</span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {analytics.total_classes_count} / {analytics.total_streams_count}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Active Cohorts</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Top Class</span>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                {analytics.highest_performing_class}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Rank 1</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Top Stream</span>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                {analytics.highest_performing_stream}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Rank 1</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Highest Subject</span>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                {analytics.highest_performing_subject}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Top School Learning Area</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Lowest Subject</span>
              <div className="text-base font-bold text-rose-700 dark:text-rose-400 mt-1">
                {analytics.lowest_performing_subject}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Needs Intervention</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Overall Best Learner</span>
              <div className="text-base font-bold text-[#176B45] dark:text-emerald-400 mt-1 truncate">
                {analytics.best_learner ? `${analytics.best_learner.name} (${Math.round(analytics.best_learner.average_marks)}%)` : '-'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {analytics.best_learner ? `${analytics.best_learner.class_name} ${analytics.best_learner.stream}` : '-'}
              </div>
            </div>
          </div>

          {/* Visual Analytics Charts (Item 12 in Prompt) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Class Mean Bar Chart */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                <span>Class Mean Performance Comparison (%)</span>
              </h3>
              <ChartWrapper className="h-64 w-full" hasData={classChartData.some(d => d['Mean Score (%)'] > 0)}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-800" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                    <YAxis domain={[0, 100]} stroke="#64748B" fontSize={12} />
                    <Tooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                      content={<CustomAnalyticsChartTooltip type="class" />}
                    />
                    <Bar dataKey="Mean Score (%)" fill="#176B45" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>

            {/* Competency Distribution Pie Chart */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
                <PieIcon className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                <span>Competency Level Distribution</span>
              </h3>
              <ChartWrapper className="h-64 w-full" hasData={pieChartData.some(d => d.value > 0)}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomAnalyticsChartTooltip type="competency" />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>
          </div>

          {/* Subject Performance Bar Chart */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                <span>
                  {overviewSubjectClassFilter !== 'all'
                    ? `Subject Performance Standings — ${overviewSubjectClassFilter} (%)`
                    : `Subject Performance Standings — ${selectedLevel} (%)`}
                </span>
              </h3>

              {/* Scope / Class Filter for Subject Chart */}
              <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">View Scope:</span>
                <select
                  value={overviewSubjectClassFilter}
                  onChange={(e) => setOverviewSubjectClassFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#176B45] dark:text-emerald-400 focus:outline-none cursor-pointer"
                >
                  <option value="all">
                    All {selectedLevel} Classes
                  </option>
                  {analytics.class_subject_analysis.map((cAnal) => (
                    <option key={cAnal.class_name} value={cAnal.class_name}>
                      {cAnal.class_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ChartWrapper className="h-72 w-full" hasData={subjectChartData.some(d => d['Mean Score (%)'] > 0)}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-800" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#64748B" fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    content={<CustomAnalyticsChartTooltip type="subject" />}
                  />
                  <Bar dataKey="Mean Score (%)" fill="#176B45" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 2: CLASS & STREAM RANKINGS ==================== */}
      {activeSubTab === 'rankings' && (
        <div className="space-y-8">
          {/* Section 1: Class Ranking Table (Item 1 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">1. Overall Class Ranking</h2>
              </div>
              <button
                onClick={() => triggerPDFExport(() => exportClassRankingPDF(analytics, school), 'Class Ranking Report')}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-emerald-200 dark:border-emerald-800/80"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export Class PDF</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 text-center w-12">Rank</th>
                    <th className="p-3">Class Name</th>
                    <th className="p-3 text-center">Learners</th>
                    <th className="p-3 text-right">Class Average Marks</th>
                    <th className="p-3 text-right">Mean %</th>
                    <th className="p-3 text-right">Mean Points</th>
                    <th className="p-3 text-center">Overall Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {analytics.class_rankings.map((c) => (
                    <tr key={c.class_name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                        {c.rank}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{c.class_name}</td>
                      <td className="p-3 text-center">{c.learners_count}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{Math.round(c.mean_marks)}</td>
                      <td className="p-3 text-right font-bold text-[#176B45] dark:text-emerald-400">{Math.round(c.mean_percentage)}%</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{c.mean_points.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getLevelBadge(c.overall_level)}`}>
                          {c.overall_level} ({c.grade_code})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Stream Ranking Table (Item 2 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">2. Stream Performance Ranking</h2>
              </div>
              <button
                onClick={() => triggerPDFExport(() => exportStreamRankingPDF(analytics, school), 'Stream Ranking Report')}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-emerald-200 dark:border-emerald-800/80"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export Stream PDF</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 text-center w-12">Rank</th>
                    <th className="p-3">Stream Name</th>
                    <th className="p-3">Grade Class</th>
                    <th className="p-3 text-center">Learners</th>
                    <th className="p-3 text-right">Class Average Marks</th>
                    <th className="p-3 text-right">Mean %</th>
                    <th className="p-3 text-right">Mean Points</th>
                    <th className="p-3 text-center">Overall Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {analytics.stream_rankings.map((st) => (
                    <tr key={st.full_name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                        {st.rank}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{st.full_name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{st.class_name}</td>
                      <td className="p-3 text-center">{st.learners_count}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{Math.round(st.mean_marks)}</td>
                      <td className="p-3 text-right font-bold text-[#176B45] dark:text-emerald-400">{Math.round(st.mean_percentage)}%</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{st.mean_points.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getLevelBadge(st.overall_level)}`}>
                          {st.overall_level} ({st.grade_code})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: SUBJECT ANALYSIS ==================== */}
      {activeSubTab === 'subjects' && (
        <div className="space-y-8">
          {/* Subject Performance Trends Graph */}
          <SubjectPerformanceTrendsGraph
            comparison={comparison}
            allExams={exams}
            students={students}
            classes={classes}
            subjects={subjects}
            marks={marks}
            grades={grades}
            selectedLevel={subjectEduLevelFilter}
            selectedClass={selectedClassFilter}
          />

          {/* Section 3: Subject Performance Ranking (Item 3 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">3. Learning Areas Performance Ranking — {selectedLevel}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Education Level:</span>
                  <select
                    value={subjectEduLevelFilter}
                    onChange={(e) => handleEducationLevelChange(e.target.value as EducationLevel)}
                    className="bg-transparent text-xs font-bold text-[#176B45] dark:text-emerald-400 focus:outline-none cursor-pointer"
                  >
                    {ALL_EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => triggerPDFExport(() => exportSubjectAnalysisPDF(analytics, school), 'Subject Analysis Report')}
                  className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-emerald-200 dark:border-emerald-800/80"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export Subject PDF</span>
                </button>
              </div>
            </div>

            {/* Display grouped rankings per level or single filtered level */}
            {(() => {
              const availableLevels = Array.from(
                new Set(analytics.subject_rankings.map((sb) => sb.education_level).filter((l): l is string => Boolean(l)))
              );

              if (availableLevels.length === 0) {
                return (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3 text-center w-12">Rank</th>
                          <th className="p-3">Subject Name</th>
                          <th className="p-3 text-center">Code</th>
                          <th className="p-3 text-center">Category</th>
                          <th className="p-3 text-center">Total Candidates</th>
                          <th className="p-3 text-right">Mean Marks</th>
                          <th className="p-3 text-right">Mean %</th>
                          <th className="p-3 text-right">Mean Points</th>
                          <th className="p-3 text-center">Overall Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                        {analytics.subject_rankings.map((sb) => (
                          <tr key={sb.subject_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                              {sb.rank}
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{sb.subject_name}</td>
                            <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400">{sb.subject_code}</td>
                            <td className="p-3 text-center">{sb.category}</td>
                            <td className="p-3 text-center">{sb.total_candidates}</td>
                            <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                              {(sb as any).is_raw ? `${(sb as any).mean_marks.toFixed(1)}/${(sb as any).out_of}` : Math.round(sb.mean_marks)}
                            </td>
                            <td className="p-3 text-right font-bold text-[#176B45] dark:text-emerald-400">{Math.round(sb.mean_percentage)}%</td>
                            <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{sb.mean_points.toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getLevelBadge(sb.overall_level)}`}>
                                {sb.overall_level} ({sb.grade_code})
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              const displayLevels = subjectEduLevelFilter === 'all'
                ? availableLevels
                : availableLevels.filter((l) => l === subjectEduLevelFilter);

              if (displayLevels.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
                    No subject rankings available for the selected education level.
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {displayLevels.map((lvl) => {
                    const lvlRankings = analytics.subject_rankings.filter((sb) => sb.education_level === lvl);
                    if (lvlRankings.length === 0) return null;

                    return (
                      <div key={lvl} className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden space-y-0">
                        <div className="p-3.5 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full bg-[#176B45] dark:bg-emerald-400"></span>
                              <span>{lvl}</span>
                            </h3>
                          </div>
                          <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold">
                            {lvlRankings.length} {lvlRankings.length === 1 ? 'Learning Area' : 'Learning Areas'}
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                            <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                              <tr>
                                <th className="p-3 text-center w-12">Rank</th>
                                <th className="p-3">Subject / Learning Area</th>
                                <th className="p-3 text-center">Code</th>
                                <th className="p-3 text-center">Category</th>
                                <th className="p-3 text-center">Total Candidates</th>
                                <th className="p-3 text-right">Mean Marks</th>
                                <th className="p-3 text-right">Average %</th>
                                <th className="p-3 text-right">Mean Points</th>
                                <th className="p-3 text-center">Overall Level</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium bg-white dark:bg-slate-900">
                              {lvlRankings.map((sb) => (
                                <tr key={`${lvl}-${sb.subject_id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                                    {sb.rank}
                                  </td>
                                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{sb.subject_name}</td>
                                  <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400">{sb.subject_code}</td>
                                  <td className="p-3 text-center">{sb.category}</td>
                                  <td className="p-3 text-center">{sb.total_candidates}</td>
                                  <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                               {(sb as any).is_raw ? `${(sb as any).mean_marks.toFixed(1)}/${(sb as any).out_of}` : Math.round(sb.mean_marks)}
                             </td>
                                  <td className="p-3 text-right font-bold text-[#176B45] dark:text-emerald-400">{Math.round(sb.mean_percentage)}%</td>
                                  <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{sb.mean_points.toFixed(2)}</td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getLevelBadge(sb.overall_level)}`}>
                                      {sb.overall_level} ({sb.grade_code})
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Section 4: Class Subject Breakdown Analysis */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">4. Class Subject Breakdown Analysis</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Subject/learning-area performance means, points, and levels categorized strictly by class cohort and education level.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Education Level Selector */}
                <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Education Level:</span>
                  <select
                    value={classBreakdownEduLevelFilter}
                    onChange={(e) => handleClassBreakdownEduLevelChange(e.target.value as EducationLevel)}
                    className="bg-transparent text-xs font-bold text-[#176B45] dark:text-emerald-400 focus:outline-none cursor-pointer"
                  >
                    {ALL_EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class Cohort Selector */}
                <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Class:</span>
                  <select
                    value={classBreakdownClassFilter}
                    onChange={(e) => setClassBreakdownClassFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#176B45] dark:text-emerald-400 focus:outline-none cursor-pointer"
                  >
                    <option value="all">
                      All Classes
                    </option>
                    {analytics.class_subject_analysis
                      .filter((cAnal) => {
                        if (classBreakdownEduLevelFilter === 'all') return true;
                        return getEducationLevelForGrade(cAnal.class_name) === classBreakdownEduLevelFilter;
                      })
                      .map((cAnal) => (
                        <option key={cAnal.class_name} value={cAnal.class_name}>
                          {cAnal.class_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Class Subject Breakdown Grid */}
            {(() => {
              const displayClasses = analytics.class_subject_analysis.filter((cAnal) => {
                const eduLvl = getEducationLevelForGrade(cAnal.class_name);
                const matchesLvl = classBreakdownEduLevelFilter === 'all' || eduLvl === classBreakdownEduLevelFilter;
                const matchesClass = classBreakdownClassFilter === 'all' || cAnal.class_name === classBreakdownClassFilter;
                return matchesLvl && matchesClass;
              });

              if (displayClasses.length === 0) {
                return (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    No class subject breakdowns available for the selected filters.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayClasses.map((cAnal) => {
                    const cLevel = getEducationLevelForGrade(cAnal.class_name);
                    return (
                      <div key={cAnal.class_name} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/80">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{cAnal.class_name}</h3>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100/70 dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                {cLevel}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{cAnal.subjects.length} Learning Areas</span>
                        </div>

                        <div className="space-y-2">
                          {cAnal.subjects.map((sb) => (
                            <div key={sb.subject_id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-200">{sb.subject_name}</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{sb.subject_code} • {sb.candidates_count} candidates</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-slate-900 dark:text-slate-100">{Math.round(sb.mean_marks)}%</div>
                                <div className="text-[10px] font-semibold text-[#176B45] dark:text-emerald-400">
                                  {sb.overall_level} ({sb.mean_points.toFixed(2)} pts)
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 4: TOP PERFORMERS & BEST LEARNERS ==================== */}
      {activeSubTab === 'top-performers' && (
        <div className="space-y-8">
          {/* Section 5 & 6: Best 3 Learners per Stream & Class (Items 5 & 6 in Prompt) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Best 3 Per Stream */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>5. Best 3 Learners Per Stream</span>
              </h3>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {Object.entries(analytics.best_three_per_stream).map(([stName, learners]) => (
                  <div key={stName} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-2 border-b border-slate-200 dark:border-slate-700/80 pb-1 flex justify-between">
                      <span>{stName}</span>
                      <span className="text-slate-400 dark:text-slate-500 font-normal">Top 3 Standings</span>
                    </div>

                    <div className="space-y-1.5">
                      {(learners as LearnerPerformerItem[]).map((l) => (
                        <div key={l.student_id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center border border-amber-200 dark:border-amber-800">
                              {l.rank}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">{l.name}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">Adm: {l.admission_number}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{l.total_marks} marks</div>
                            <div className="text-[10px] font-semibold text-[#176B45] dark:text-emerald-400">
                              {Math.round(l.average_marks)}% • {l.overall_level}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Best 3 Per Class */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Award className="w-5 h-5 text-[#176B45] dark:text-emerald-400" />
                <span>6. Best 3 Learners Per Class</span>
              </h3>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {Object.entries(analytics.best_three_per_class).map(([cName, learners]) => (
                  <div key={cName} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-2 border-b border-slate-200 dark:border-slate-700/80 pb-1 flex justify-between">
                      <span>{cName} (All Streams)</span>
                      <span className="text-slate-400 dark:text-slate-500 font-normal">Top 3 Standings</span>
                    </div>

                    <div className="space-y-1.5">
                      {(learners as LearnerPerformerItem[]).map((l) => (
                        <div key={l.student_id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                              {l.rank}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">{l.name}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">Stream: {l.stream} • Adm: {l.admission_number}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{l.total_marks} marks</div>
                            <div className="text-[10px] font-semibold text-[#176B45] dark:text-emerald-400">
                              {Math.round(l.average_marks)}% • {l.overall_level}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 7: Best Learners in Entire School Table (Item 7 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4">
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">7. Learner Standings — {selectedLevel}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Learners ranked within {selectedLevel} for {analytics.exam.exam_name}.
                </p>
              </div>

              {/* Filters & Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search name or adm..."
                    value={learnerSearchQuery}
                    onChange={(e) => setLearnerSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500 w-48"
                  />
                </div>

                <select
                  value={standingsEduLevelFilter}
                  onChange={(e) => handleEducationLevelChange(e.target.value as EducationLevel)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500"
                >
                  {ALL_EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                      {lvl}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500"
                >
                  <option value="all" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">All Classes</option>
                  {analytics.class_rankings
                    .filter((c) => (c.education_level || getEducationLevelForGrade(c.class_name)) === standingsEduLevelFilter)
                    .map((c) => (
                      <option key={c.class_name} value={c.class_name} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                        {c.class_name}
                      </option>
                    ))}
                </select>

                <button
                  onClick={() => triggerPDFExport(() => exportBestLearnersPDF(analytics, school), 'Best Learners Report')}
                  className="px-3 py-1.5 bg-[#176B45] hover:bg-[#0F5132] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            {/* Separate Education Level Standings Cards */}
            {(() => {
              const allLevelsOrder = ALL_EDUCATION_LEVELS;
              const presentLevelsInSchool = Array.from(
                new Set(
                  (analytics?.best_learners_school || [])
                    .filter((l) => l && (l.education_level || l.class_name))
                    .map((l) => l.education_level || getEducationLevelForGrade(l.class_name))
                )
              );
              
              const targetLevels = standingsEduLevelFilter !== 'all' 
                ? [standingsEduLevelFilter] 
                : allLevelsOrder.filter((lvl) => presentLevelsInSchool.includes(lvl as any)).length > 0
                  ? allLevelsOrder.filter((lvl) => presentLevelsInSchool.includes(lvl as any))
                  : presentLevelsInSchool;

              if (targetLevels.length === 0) {
                return (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No learner standings available.
                  </div>
                );
              }

              return (
                <div className="p-5 space-y-6">
                  {targetLevels.map((lvl) => {
                    const lvlLearners = (analytics?.best_learners_school || []).filter((l) => {
                      if (!l) return false;
                      const lLevel = l.education_level || getEducationLevelForGrade(l.class_name || 'Grade 7');
                      if (lLevel !== lvl) return false;
                      const q = (learnerSearchQuery || '').toLowerCase();
                      const name = (l.name || '').toLowerCase();
                      const adm = (l.admission_number || '').toLowerCase();
                      const matchesQuery = !q || name.includes(q) || adm.includes(q);
                      const matchesClass = selectedClassFilter === 'all' || l.class_name === selectedClassFilter;
                      return matchesQuery && matchesClass;
                    });

                    if (lvlLearners.length === 0 && standingsEduLevelFilter === 'all' && (learnerSearchQuery || selectedClassFilter !== 'all')) {
                      return null;
                    }

                    return (
                      <div key={lvl} className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                        <div className="px-4 py-3 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-[#176B45] dark:bg-emerald-400 inline-block"></span>
                            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                              Overall Learner Standings — {lvl}
                            </h3>
                          </div>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                            Learners ranked by overall performance within {lvl}
                          </span>
                        </div>

                        {lvlLearners.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                            No assessed learners found for {lvl}.
                          </div>
                        ) : (
                          <div className="overflow-x-auto max-h-[400px]">
                            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                              <thead className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                  <th className="p-3 text-center w-12">Rank</th>
                                  <th className="p-3">Learner Name</th>
                                  <th className="p-3 text-center">Adm No</th>
                                  <th className="p-3">Class</th>
                                  <th className="p-3">Stream</th>
                                  <th className="p-3 text-right">Total Marks</th>
                                  <th className="p-3 text-right">Mean %</th>
                                  <th className="p-3 text-right">Mean Points</th>
                                  <th className="p-3 text-center">Overall Level</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                                {lvlLearners.map((l) => (
                                  <tr key={l.student_id} className="hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors">
                                    <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-100/50 dark:bg-slate-800/30">
                                      {l.rank}
                                    </td>
                                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{l.name}</td>
                                    <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400">{l.admission_number}</td>
                                    <td className="p-3">{l.class_name}</td>
                                    <td className="p-3 text-slate-600 dark:text-slate-400">{l.stream || '-'}</td>
                                    <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{l.total_marks}</td>
                                    <td className="p-3 text-right font-bold text-[#176B45] dark:text-emerald-400">{Math.round(l.average_marks)}%</td>
                                    <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{l.average_points.toFixed(2)}</td>
                                    <td className="p-3 text-center">
                                      <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getLevelBadge(l.overall_level)}`}>
                                        {l.overall_level} ({l.grade_code})
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Section 8: Best Subject Performers (Top 10 per Learning Area) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">8. Best Subject Performers (Top 10 per Learning Area)</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Top 10 highest-scoring learners in each learning area determined strictly within each class and education level.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Education Level Selector */}
                <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Education Level:</span>
                  <select
                    value={topPerformersEduLevelFilter}
                    onChange={(e) => handleTopPerformersEduLevelChange(e.target.value as EducationLevel)}
                    className="bg-transparent text-xs font-bold text-[#176B45] dark:text-emerald-400 focus:outline-none cursor-pointer"
                  >
                    {ALL_EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class Selector */}
                <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Class:</span>
                  <select
                    value={topPerformersClassFilter}
                    onChange={(e) => handleTopPerformersClassChange(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#176B45] dark:text-emerald-400 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Classes</option>
                    {Array.from(
                      new Set(
                        analytics.best_subject_performers
                          .filter((item) => topPerformersEduLevelFilter === 'all' || item.education_level === topPerformersEduLevelFilter)
                          .map((item) => item.class_name)
                          .filter((c): c is string => Boolean(c))
                      )
                    ).map((cName) => (
                      <option key={cName} value={cName}>
                        {cName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Learning Area Selector */}
                <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Learning Area:</span>
                  <select
                    value={topPerformersSubjectFilter}
                    onChange={(e) => setTopPerformersSubjectFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#176B45] dark:text-emerald-400 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Learning Areas</option>
                    {Array.from(
                      new Map<string, { id: string; name: string; code: string }>(
                        analytics.best_subject_performers
                          .filter((item) => {
                            const matchesLvl = topPerformersEduLevelFilter === 'all' || item.education_level === topPerformersEduLevelFilter;
                            const matchesClass = topPerformersClassFilter === 'all' || item.class_name === topPerformersClassFilter;
                            return matchesLvl && matchesClass;
                          })
                          .map((item) => [item.subject_id, { id: item.subject_id, name: item.subject_name, code: item.subject_code }])
                      ).values()
                    ).map((sb) => (
                      <option key={sb.id} value={sb.id}>
                        {sb.name} ({sb.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Performers Cards Grid */}
            {(() => {
              const displayPerformers = analytics.best_subject_performers.filter((item) => {
                const matchesLvl = topPerformersEduLevelFilter === 'all' || item.education_level === topPerformersEduLevelFilter;
                const matchesClass = topPerformersClassFilter === 'all' || item.class_name === topPerformersClassFilter;
                const matchesSubj = topPerformersSubjectFilter === 'all' || item.subject_id === topPerformersSubjectFilter;
                return matchesLvl && matchesClass && matchesSubj;
              });

              if (displayPerformers.length === 0) {
                return (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    No top subject performers available for the selected filters.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayPerformers.map((sbTop) => {
                    const levelName = sbTop.education_level || getEducationLevelForGrade(sbTop.class_name || '');
                    return (
                      <div key={`${sbTop.class_name}-${sbTop.subject_id}`} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="border-b border-slate-200 dark:border-slate-700/80 pb-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100/70 dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              {levelName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Class: {sbTop.class_name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{sbTop.subject_name}</h3>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{sbTop.subject_code}</span>
                          </div>
                          <div className="text-[10px] font-semibold text-[#176B45] dark:text-emerald-400">
                            Top 10 — {sbTop.class_name} — {sbTop.subject_name}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {sbTop.top_learners.map((l) => (
                            <div key={l.student_id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              <div className="flex items-center space-x-2 truncate">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shrink-0">
                                  {l.rank}
                                </span>
                                <div className="truncate">
                                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{l.name}</div>
                                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">Adm: {l.admission_number} {l.stream ? `• ${l.stream}` : ''}</div>
                                </div>
                              </div>
                              <div className="text-right font-bold text-slate-900 dark:text-slate-100 shrink-0 ml-2">
                                {(l as any).is_raw ? `${(l as any).raw_score}/${(l as any).out_of}` : `${l.marks}%`} <span className="text-[10px] text-[#176B45] dark:text-emerald-400 font-semibold">({l.grade_code})</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 5: EXAM COMPARISONS & DEVIATIONS ==================== */}
      {activeSubTab === 'comparison' && (
        <div className="space-y-8">
          {!comparison ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <SlidersHorizontal className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Select Two Examinations To Compare</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Please pick a primary examination and a secondary comparison examination in the top banner header above to calculate mean differences, % changes, and performance trend deviations.
              </p>
            </div>
          ) : (
            <>
              {/* Section 9 & 10: Comparison Summary Cards & Deviations (Items 9 & 10 in Prompt) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Level Mean Difference</span>
                  <div className={`text-2xl font-black mt-1 ${comparison.school_deviation.diff_mean >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {comparison.school_deviation.diff_mean > 0 ? '+' : ''}{Math.round(comparison.school_deviation.diff_mean)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {Math.round(comparison.school_deviation.percentage_change)}% change
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Most Improved Class</span>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {comparison.most_improved_class}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Highest Positive Gain</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Most Improved Stream</span>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {comparison.most_improved_stream}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Highest Positive Gain</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Most Improved Learner</span>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {comparison.most_improved_learner}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Highest Mark Gain</div>
                </div>
              </div>

              {/* Subject Performance Trends Graph */}
              <SubjectPerformanceTrendsGraph
                comparison={comparison}
                allExams={exams}
                students={students}
                classes={classes}
                subjects={subjects}
                marks={marks}
                grades={grades}
                selectedLevel={selectedLevel}
              />

              {/* Class Deviations Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Class Performance Comparison & Deviations</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Comparing {comparison.examA.exam_name} (Current) vs {comparison.examB.exam_name} (Previous).
                    </p>
                  </div>
                  <button
                    onClick={() => triggerPDFExport(() => exportExamComparisonPDF(comparison, school), 'Exam Comparison Report')}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-blue-200 dark:border-blue-800/80"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Class Name</th>
                        <th className="p-3 text-right">Current Mean</th>
                        <th className="p-3 text-right">Previous Mean</th>
                        <th className="p-3 text-right">Mean Difference</th>
                        <th className="p-3 text-right">% Change</th>
                        <th className="p-3 text-right">Points Diff</th>
                        <th className="p-3 text-center">Level Change</th>
                        <th className="p-3 text-center">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                      {comparison.class_deviations.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{d.name}</td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{Math.round(d.current_mean)}</td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">{Math.round(d.previous_mean)}</td>
                          <td className={`p-3 text-right font-bold ${d.diff_mean > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.diff_mean < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {d.diff_mean > 0 ? '+' : ''}{Math.round(d.diff_mean)}
                          </td>
                          <td className={`p-3 text-right font-bold ${d.percentage_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.percentage_change < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {d.percentage_change > 0 ? '+' : ''}{Math.round(d.percentage_change)}%
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                            {d.diff_points > 0 ? '+' : ''}{d.diff_points.toFixed(2)}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {d.previous_level} → {d.current_level}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] ${d.trend.includes('Improved') ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : d.trend.includes('Declined') ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                              {d.trend}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Subject Deviations Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Subject Performance Deviations & Trends</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tracking gains and declines across learning areas.</p>
                  </div>
                  <button
                    onClick={() => triggerPDFExport(() => exportPerformanceDeviationPDF(comparison, school), 'Performance Deviation Report')}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-blue-200 dark:border-blue-800/80"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Subject</th>
                        <th className="p-3 text-right">Current Mean %</th>
                        <th className="p-3 text-right">Previous Mean %</th>
                        <th className="p-3 text-right">Difference %</th>
                        <th className="p-3 text-right">% Change</th>
                        <th className="p-3 text-center">Level Change</th>
                        <th className="p-3 text-center">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                      {comparison.subject_deviations.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{d.name}</td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{Math.round(d.current_mean)}%</td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">{Math.round(d.previous_mean)}%</td>
                          <td className={`p-3 text-right font-bold ${d.diff_mean > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.diff_mean < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {d.diff_mean > 0 ? '+' : ''}{Math.round(d.diff_mean)}%
                          </td>
                          <td className={`p-3 text-right font-bold ${d.percentage_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.percentage_change < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {d.percentage_change > 0 ? '+' : ''}{Math.round(d.percentage_change)}%
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {d.previous_level} → {d.current_level}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] ${d.trend.includes('Improved') ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : d.trend.includes('Declined') ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                              {d.trend}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};
