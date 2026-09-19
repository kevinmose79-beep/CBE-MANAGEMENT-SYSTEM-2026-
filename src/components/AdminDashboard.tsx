import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserCheck,
  Building2,
  BookMarked,
  Award,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Plus,
  Calendar,
  Lock,
  ChevronRight,
  Clock,
  Sparkles,
  Filter,
} from 'lucide-react';
import {
  School,
  Student,
  Teacher,
  ClassStream,
  Subject,
  Examination,
  Mark,
  Grade,
  ALL_EDUCATION_LEVELS,
  ALL_GRADES,
  LEVEL_TO_GRADES,
  getEducationLevelForGrade,
  getApplicableSubjectsForGrade,
  sortGrades,
} from '../types';
import { generateExamAnalysisSummary, calculateExamResults, CBE_4_POINT_GRADES, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { api } from '../lib/storage';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { groupExamsForDropdown } from '../utils/examDisplayUtils';
import { filterExamsForClassScope } from '../utils/filterUtils';
import { formatGreeting } from '../utils/greetingUtils';
import { getUpcomingTermReminder } from '../utils/termReminderUtils';
import { AcademicTermReminderBanner } from './AcademicTermReminderBanner';

const CustomDashboardChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0];
  const data = item.payload || {};
  const title = data.name || data.className || data.streamName || data.grade || label;
  const descriptor = data.descriptor || data.label;
  const value = item.value;
  const percentage = data.percentage;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 shadow-xl text-xs space-y-1 min-w-[150px] z-50 pointer-events-none">
      <div className="font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/80 pb-1 flex items-center justify-between gap-2">
        <span>{title}</span>
        {percentage !== undefined && (
          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/60">
            {percentage}%
          </span>
        )}
      </div>
      {descriptor && descriptor !== title && (
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {descriptor}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Population:</span>
        <span className="font-extrabold text-[#075E42] dark:text-emerald-400">
          {value} {value === 1 ? 'Learner' : 'Learners'}
        </span>
      </div>
    </div>
  );
};

interface AdminDashboardProps {
  userName?: string;
  school: School;
  students: Student[];
  teachers: Teacher[];
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  grades: Grade[];
  onNavigate: (tab: any) => void;
  onResetData?: () => void;
  onMarksUpdated?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  userName,
  school,
  students = [],
  teachers = [],
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  onNavigate,
  onResetData,
  onMarksUpdated,
}) => {
  const { viewingYear: activeAcademicYear, viewingTerm: activeTerm } = useAcademicSession();

  const [reminderDismissed, setReminderDismissed] = useState(false);

  const allSchoolTerms = api.getSchoolTerms();
  const termReminder = !reminderDismissed
    ? getUpcomingTermReminder({
        schoolTerms: allSchoolTerms,
        activeTerm,
        activeAcademicYear,
        checkDismissed: true,
      })
    : null;

  // Level & Grade filter states
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  const availableGrades = selectedLevelFilter === 'all'
    ? ALL_GRADES
    : LEVEL_TO_GRADES[selectedLevelFilter as keyof typeof LEVEL_TO_GRADES] || ALL_GRADES;

  const handleLevelChange = (lvl: string) => {
    setSelectedLevelFilter(lvl);
    setSelectedGradeFilter('all');
  };

  // Filtered sets for dynamic KPIs
  const filteredClasses = classes.filter((c) => {
    const cLevel = c.education_level || getEducationLevelForGrade(c.class_name);
    const matchesLevel = selectedLevelFilter === 'all' || cLevel === selectedLevelFilter;
    const matchesGrade = selectedGradeFilter === 'all' || c.class_name === selectedGradeFilter;
    return matchesLevel && matchesGrade;
  });

  const filteredClassIds = new Set(filteredClasses.map((c) => c.id));

  const filteredStudents = students.filter((s) => {
    const cls = classes.find((c) => c.id === s.class_id);
    const stdGrade = s.grade || cls?.class_name;
    const stdLevel = s.education_level || cls?.education_level || (stdGrade ? getEducationLevelForGrade(stdGrade) : undefined);

    const matchesLevel = selectedLevelFilter === 'all' || stdLevel === selectedLevelFilter;
    const matchesGrade = selectedGradeFilter === 'all' || stdGrade === selectedGradeFilter;
    return matchesLevel && matchesGrade;
  });

  const filteredSubjects = subjects.filter((s) => {
    if (s.status === 'Archived') return false;
    const matchesLevel = selectedLevelFilter === 'all' || s.education_level === selectedLevelFilter;
    const matchesGrade = selectedGradeFilter === 'all' || getApplicableSubjectsForGrade(selectedGradeFilter, subjects).some((sub) => sub.id === s.id);
    if (selectedGradeFilter !== 'all') {
      return matchesGrade;
    }
    return matchesLevel;
  });

  const filteredTeachers = teachers.filter((t) => {
    if (selectedLevelFilter === 'all' && selectedGradeFilter === 'all') return true;
    const teachesClass = (t.allocations || []).some(a => filteredClassIds.has(a.class_id));
    const teachesSubject = (t.allocations || []).some(a => filteredSubjects.some(fs => fs.id === a.subject_id));
    return teachesClass || teachesSubject;
  });

  // Filter exams that are applicable to the current level and grade filters
  const filteredExamsForDropdown = useMemo(() => {
    let filtered = exams || [];
    if (selectedGradeFilter !== 'all') {
      filtered = filterExamsForClassScope(filtered, selectedGradeFilter, classes, null, 'admin');
    } else if (selectedLevelFilter !== 'all') {
      filtered = filtered.filter((e) => {
        if (!e.education_level || e.education_level === 'All Levels' || e.education_level === 'all') return true;
        return e.education_level === selectedLevelFilter;
      });
    }
    return filtered;
  }, [exams, selectedLevelFilter, selectedGradeFilter, classes]);

  const activeExam = useMemo(() => {
    // 1. Try to find the selectedExamId in the filtered list of exams
    if (selectedExamId) {
      const found = filteredExamsForDropdown.find((e) => e.id === selectedExamId);
      if (found) return found;
    }
    // 2. Otherwise find the first filtered exam that is Provisional/Approved/Published
    const defaultActive = filteredExamsForDropdown.find(
      (e) => e.status === 'Provisional' || e.status === 'Approved' || e.status === 'Published'
    );
    if (defaultActive) return defaultActive;

    // 3. Fallback to first filtered exam
    if (filteredExamsForDropdown.length > 0) return filteredExamsForDropdown[0];

    // 4. Ultimate fallback to unfiltered selection
    if (selectedExamId) {
      const found = (exams || []).find((e) => e.id === selectedExamId);
      if (found) return found;
    }
    return (exams || [])[0];
  }, [selectedExamId, filteredExamsForDropdown, exams]);

  // Local marks state synced with props & fetched from Supabase for active exam
  const [dashboardMarks, setDashboardMarks] = useState<Mark[]>(marks);
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);

  useEffect(() => {
    setDashboardMarks(marks);
  }, [marks]);

  useEffect(() => {
    let isMounted = true;
    if (!activeExam?.id) return;

    setIsLoadingMarks(true);
    api.fetchMarksForExam(activeExam.id)
      .then((fetched) => {
        if (isMounted) {
          setIsLoadingMarks(false);
          setDashboardMarks(api.getMarks());
          onMarksUpdated?.();
        }
      })
      .catch((err) => {
        console.error('Error fetching marks for dashboard:', err);
        if (isMounted) setIsLoadingMarks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeExam?.id]);

  const analysis = activeExam
    ? generateExamAnalysisSummary(
        activeExam.id,
        activeExam.exam_name,
        filteredStudents,
        filteredSubjects,
        dashboardMarks,
        grades
      )
    : null;

  // Full examination results calculated using CBE 8-Point competition ranking rules
  const activeExamResults = useMemo(() => {
    if (!activeExam?.id) return [];
    return calculateExamResults(
      activeExam.id,
      students,
      dashboardMarks,
      grades,
      classes,
      subjects
    );
  }, [activeExam?.id, students, dashboardMarks, grades, classes, subjects]);

  // Streams available matching the active exam (exam-aware, class-aware, level-aware) and dashboard level & grade filters
  const availableStreams = useMemo(() => {
    return classes.filter((c) => {
      const cLevel = c.education_level || getEducationLevelForGrade(c.class_name);
      const matchesLevel = selectedLevelFilter === 'all' || cLevel === selectedLevelFilter;
      const matchesGrade = selectedGradeFilter === 'all' || c.class_name === selectedGradeFilter;
      if (!matchesLevel || !matchesGrade) return false;

      // Filter based on active exam scope
      if (activeExam) {
        // A. If the exam specifies a specific class_id
        if (activeExam.class_id && activeExam.class_id !== 'all') {
          const examClass = classes.find((cl) => cl.id === activeExam.class_id);
          if (examClass) {
            // Keep all streams of the same grade cohort (e.g. if the exam is for Grade 9 East, keep Grade 9 streams)
            return c.class_name === examClass.class_name;
          }
          return c.id === activeExam.class_id;
        }

        // B. If the exam specifies a specific education level
        if (activeExam.education_level && activeExam.education_level !== 'All Levels') {
          return cLevel === activeExam.education_level;
        }

        // C. Heuristics based on exam name
        const examNameLower = (activeExam.exam_name || '').toLowerCase();
        const classNameLower = (c.class_name || '').toLowerCase();

        // If the exam name contains a specific grade like "grade 9"
        if (examNameLower.includes('grade 9') && classNameLower !== 'grade 9') return false;
        if (examNameLower.includes('grade 8') && classNameLower !== 'grade 8') return false;
        if (examNameLower.includes('grade 7') && classNameLower !== 'grade 7') return false;
        if (examNameLower.includes('grade 6') && classNameLower !== 'grade 6') return false;
        if (examNameLower.includes('grade 5') && classNameLower !== 'grade 5') return false;
        if (examNameLower.includes('grade 4') && classNameLower !== 'grade 4') return false;

        // If the exam name contains education level
        if (examNameLower.includes('junior school') && cLevel !== 'Junior School') return false;
        if (examNameLower.includes('upper primary') && cLevel !== 'Upper Primary') return false;
      }

      return true;
    });
  }, [classes, activeExam, selectedLevelFilter, selectedGradeFilter]);

  // Assessment coverage per stream
  const streamsWithAssessmentInfo = useMemo(() => {
    return availableStreams.map((c) => {
      const streamKey = c.stream_id || c.id;
      const streamLabel = `${c.class_name}${c.stream ? ` ${c.stream}` : ''}`.trim();

      const streamStudents = filteredStudents.filter((s) => {
        if (c.stream_id && s.stream_id) return s.stream_id === c.stream_id;
        if (s.stream_id && s.stream_id === c.id) return true;
        return !s.stream_id && s.class_id === c.id;
      });

      const assessedStudents = streamStudents.filter((s) => {
        const r = activeExamResults.find((res) => res.student_id === s.id && res.subject_count > 0);
        return Boolean(r);
      });

      return {
        stream: c,
        streamKey,
        streamLabel,
        totalLearners: streamStudents.length,
        assessedCount: assessedStudents.length,
      };
    });
  }, [availableStreams, filteredStudents, activeExamResults]);

  // Total assessed learners across all streams in active assessment
  const totalAssessedAllStreams = useMemo(() => {
    const studentIdSet = new Set(filteredStudents.map((s) => s.id));
    return activeExamResults.filter((r) => r.subject_count > 0 && studentIdSet.has(r.student_id)).length;
  }, [activeExamResults, filteredStudents]);

  // Stream selected for Grade Distribution Analysis ('all' or specific streamKey)
  const [selectedGradeDistStreamKey, setSelectedGradeDistStreamKey] = useState<string>('all');

  // Results for Grade Distribution Analysis based on selected stream or All Streams
  const gradeDistResults = useMemo(() => {
    if (selectedGradeDistStreamKey === 'all') {
      const studentIdSet = new Set(filteredStudents.map((s) => s.id));
      return activeExamResults.filter((r) => r.subject_count > 0 && studentIdSet.has(r.student_id));
    }
    const targetStream = availableStreams.find((c) => (c.stream_id || c.id) === selectedGradeDistStreamKey);
    if (!targetStream) return [];

    const streamStudentIds = new Set(
      filteredStudents
        .filter((s) => {
          if (targetStream.stream_id && s.stream_id) return s.stream_id === targetStream.stream_id;
          if (s.stream_id && s.stream_id === targetStream.id) return true;
          return !s.stream_id && s.class_id === targetStream.id;
        })
        .map((s) => s.id)
    );

    return activeExamResults.filter((r) => r.subject_count > 0 && streamStudentIds.has(r.student_id));
  }, [selectedGradeDistStreamKey, activeExamResults, filteredStudents, availableStreams]);

  const effectiveGradeDistStreamLabel = useMemo(() => {
    if (selectedGradeDistStreamKey === 'all') return 'All Streams';
    const match = streamsWithAssessmentInfo.find((s) => s.streamKey === selectedGradeDistStreamKey);
    return match?.streamLabel || 'Stream';
  }, [selectedGradeDistStreamKey, streamsWithAssessmentInfo]);

  const gradeDistMeanScore = useMemo(() => {
    if (gradeDistResults.length === 0) return 0;
    const sum = gradeDistResults.reduce((acc, r) => acc + (r.average || 0), 0);
    return Math.round((sum / gradeDistResults.length) * 10) / 10;
  }, [gradeDistResults]);

  // Stream selected for Top Performers view ('all' or specific streamKey)
  const [selectedPerformerStreamKey, setSelectedPerformerStreamKey] = useState<string>('all');

  // Sanitize Grade Distribution Stream selection when activeExam or availableStreams changes
  useEffect(() => {
    if (selectedGradeDistStreamKey !== 'all') {
      const isValid = availableStreams.some((c) => (c.stream_id || c.id) === selectedGradeDistStreamKey);
      if (!isValid) {
        setSelectedGradeDistStreamKey('all');
      }
    }
  }, [availableStreams, selectedGradeDistStreamKey]);

  // Sanitize Top Performer Stream selection when activeExam or availableStreams changes
  useEffect(() => {
    if (selectedPerformerStreamKey !== 'all') {
      const isValid = availableStreams.some((c) => (c.stream_id || c.id) === selectedPerformerStreamKey);
      if (!isValid) {
        setSelectedPerformerStreamKey('all');
      }
    }
  }, [availableStreams, selectedPerformerStreamKey]);

  // Effective stream info for Top Performers
  const effectivePerformerStreamInfo = useMemo(() => {
    if (selectedPerformerStreamKey === 'all') {
      return {
        streamKey: 'all',
        streamLabel: 'All Streams',
        assessedCount: totalAssessedAllStreams,
        isAllStreams: true,
      };
    }
    const match = streamsWithAssessmentInfo.find((s) => s.streamKey === selectedPerformerStreamKey);
    if (match) {
      return {
        ...match,
        isAllStreams: false,
      };
    }
    return {
      streamKey: 'all',
      streamLabel: 'All Streams',
      assessedCount: totalAssessedAllStreams,
      isAllStreams: true,
    };
  }, [selectedPerformerStreamKey, streamsWithAssessmentInfo, totalAssessedAllStreams]);

  // Top performers ranked strictly by Total Marks (competition ranking) for All Streams or a specific stream
  const streamTopPerformers = useMemo(() => {
    let candidateStudents: Student[] = [];

    if (effectivePerformerStreamInfo.isAllStreams) {
      candidateStudents = filteredStudents;
    } else {
      const targetStream = streamsWithAssessmentInfo.find((s) => s.streamKey === effectivePerformerStreamInfo.streamKey)?.stream;
      if (!targetStream) return [];
      candidateStudents = filteredStudents.filter((s) => {
        if (targetStream.stream_id && s.stream_id) return s.stream_id === targetStream.stream_id;
        if (s.stream_id && s.stream_id === targetStream.id) return true;
        return !s.stream_id && s.class_id === targetStream.id;
      });
    }

    const assessedLearners = candidateStudents
      .map((st) => {
        const r = activeExamResults.find((res) => res.student_id === st.id && res.subject_count > 0);
        if (!r) return null;

        const cls = classes.find((c) => {
          if (c.stream_id && st.stream_id) return c.stream_id === st.stream_id;
          if (st.stream_id && c.id === st.stream_id) return true;
          return !st.stream_id && c.id === st.class_id;
        });
        const streamName = cls ? `${cls.class_name}${cls.stream ? ` ${cls.stream}` : ''}`.trim() : (st.grade || 'General');

        return {
          student_id: st.id,
          student_name: st.full_name,
          admission_number: st.admission_number,
          stream_name: streamName,
          total_marks: r.total_marks,
          total_max_marks: r.total_max_marks,
          average: r.average,
          grade_code: r.grade_code,
          performance_level: r.performance_level,
          subject_count: r.subject_count,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Sort strictly by Total Marks descending
    assessedLearners.sort((a, b) => b.total_marks - a.total_marks);

    // Truthful competition ranking (1, 1, 3) based strictly on Total Marks
    let currentRank = 1;
    const ranked = assessedLearners.map((item, idx) => {
      if (idx > 0 && item.total_marks < assessedLearners[idx - 1].total_marks) {
        currentRank = idx + 1;
      }
      return {
        ...item,
        rank: currentRank,
      };
    });

    return ranked;
  }, [effectivePerformerStreamInfo, filteredStudents, streamsWithAssessmentInfo, activeExamResults, classes]);

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Gender distribution calculations
  const isMale = (s: Student) => {
    if (!s.gender) return false;
    const g = String(s.gender).trim().toUpperCase();
    return g === 'M' || g === 'MALE' || g === 'BOY';
  };

  const isFemale = (s: Student) => {
    if (!s.gender) return false;
    const g = String(s.gender).trim().toUpperCase();
    return g === 'F' || g === 'FEMALE' || g === 'GIRL';
  };

  const maleCount = filteredStudents.filter(isMale).length;
  const femaleCount = filteredStudents.filter(isFemale).length;
  const unknownCount = filteredStudents.length - maleCount - femaleCount;
  const totalGenderLearners = filteredStudents.length;

  const genderChartData = [
    { name: 'Boys', count: maleCount, percentage: totalGenderLearners > 0 ? ((maleCount / totalGenderLearners) * 100).toFixed(1) : '0', color: '#2563EB' },
    { name: 'Girls', count: femaleCount, percentage: totalGenderLearners > 0 ? ((femaleCount / totalGenderLearners) * 100).toFixed(1) : '0', color: '#DC2626' },
    ...(unknownCount > 0 ? [{ name: 'Unspecified', count: unknownCount, percentage: ((unknownCount / totalGenderLearners) * 100).toFixed(1), color: '#6B7280' }] : []),
  ].filter((item) => item.count > 0 || totalGenderLearners === 0);

  // General class student distribution aggregation (aggregating streams into parent class)
  const generalClassesSet = new Set<string>();

  classes.forEach((c) => {
    if (c.class_name) {
      const cLevel = c.education_level || getEducationLevelForGrade(c.class_name);
      const matchesLevel = selectedLevelFilter === 'all' || cLevel === selectedLevelFilter;
      const matchesGrade = selectedGradeFilter === 'all' || c.class_name === selectedGradeFilter;
      if (matchesLevel && matchesGrade) {
        generalClassesSet.add(c.class_name);
      }
    }
  });

  filteredStudents.forEach((s) => {
    const cls = classes.find((c) => c.id === s.class_id);
    const gName = s.grade || cls?.class_name;
    if (gName) {
      generalClassesSet.add(gName);
    }
  });

  const sortedGeneralClasses = sortGrades(Array.from(generalClassesSet));

  const studentDistributionData = sortedGeneralClasses.map((gName) => {
    const count = filteredStudents.filter((s) => {
      const cls = classes.find((c) => c.id === s.class_id);
      const stdGrade = s.grade || cls?.class_name;
      return stdGrade === gName;
    }).length;

    return {
      className: gName,
      count,
    };
  });

  // Determine if the current assessment/selected class is a 4-point scale level (Upper Primary or Lower Primary)
  const is4PointScale = useMemo(() => {
    // 1. If we have selected a specific stream in the distribution
    if (selectedGradeDistStreamKey && selectedGradeDistStreamKey !== 'all') {
      const matchCls = classes.find((c) => (c.stream_id || c.id) === selectedGradeDistStreamKey || c.id === selectedGradeDistStreamKey);
      if (matchCls) {
        const lvl = matchCls.education_level || getEducationLevelForGrade(matchCls.class_name);
        return lvl === 'Upper Primary' || lvl === 'Lower Primary';
      }
    }

    // 2. If the active exam itself has an explicit education level
    if (activeExam?.education_level && activeExam.education_level !== 'All Levels') {
      return activeExam.education_level === 'Upper Primary' || activeExam.education_level === 'Lower Primary';
    }

    // 3. If active exam targets a specific class
    if (activeExam?.class_id && activeExam.class_id !== 'all') {
      const matchCls = classes.find((c) => c.id === activeExam.class_id);
      if (matchCls) {
        const lvl = matchCls.education_level || getEducationLevelForGrade(matchCls.class_name);
        return lvl === 'Upper Primary' || lvl === 'Lower Primary';
      }
    }

    // 4. Fallback based on exam name
    if (activeExam?.exam_name) {
      const examNameLower = activeExam.exam_name.toLowerCase();
      if (examNameLower.includes('grade 4') || examNameLower.includes('grade 5') || examNameLower.includes('grade 6')) {
        return true;
      }
      if (examNameLower.includes('grade 1') || examNameLower.includes('grade 2') || examNameLower.includes('grade 3') || examNameLower.includes('pp1') || examNameLower.includes('pp2')) {
        return true;
      }
    }

    // 5. Fallback based on dashboard's own level filter if chosen
    if (selectedLevelFilter && selectedLevelFilter !== 'all') {
      return selectedLevelFilter === 'Upper Primary' || selectedLevelFilter === 'Lower Primary';
    }

    // 6. Fallback based on dashboard's own grade filter if chosen
    if (selectedGradeFilter && selectedGradeFilter !== 'all') {
      const lvl = getEducationLevelForGrade(selectedGradeFilter);
      return lvl === 'Upper Primary' || lvl === 'Lower Primary';
    }

    return false;
  }, [activeExam, selectedGradeDistStreamKey, classes, selectedLevelFilter, selectedGradeFilter]);

  // Dynamic grades set for chart and legend mapping
  const activeGradesSet = useMemo(() => {
    if (is4PointScale) {
      return CBE_4_POINT_GRADES;
    }
    const has8PointCustom = grades && grades.length > 0 && (grades.some((g) => g.grade_code === 'EE1') || grades.length >= 8);
    return has8PointCustom ? grades : CBE_8_POINT_GRADES;
  }, [is4PointScale, grades]);

  const getGradeColor = (gradeCode: string, index: number) => {
    const code = String(gradeCode).trim().toUpperCase();
    if (code.startsWith('EE1')) return '#059669'; // Exceeding Level 1
    if (code.startsWith('EE2')) return '#10B981'; // Exceeding Level 2
    if (code.startsWith('ME1')) return '#2563EB'; // Meeting Level 1
    if (code.startsWith('ME2')) return '#3B82F6'; // Meeting Level 2
    if (code.startsWith('AE1')) return '#D97706'; // Approaching Level 1
    if (code.startsWith('AE2')) return '#F59E0B'; // Approaching Level 2
    if (code.startsWith('BE1')) return '#DC2626'; // Below Level 1
    if (code.startsWith('BE2')) return '#EF4444'; // Below Level 2

    // 4-point scale (EE, ME, AE, BE)
    if (code === 'EE') return '#059669'; // Emerald-600
    if (code === 'ME') return '#2563EB'; // Blue-600
    if (code === 'AE') return '#D97706'; // Amber-600
    if (code === 'BE') return '#DC2626'; // Red-600

    const defaultColors = ['#059669', '#10B981', '#2563EB', '#3B82F6', '#D97706', '#F59E0B', '#DC2626', '#EF4444'];
    return defaultColors[index % defaultColors.length];
  };

  // Grade counts chart data based on selected stream or All Streams
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    activeGradesSet.forEach((g) => {
      const code = g.grade_code || g.grade || '';
      if (code) counts[code] = 0;
    });

    gradeDistResults.forEach((r) => {
      const code = r.grade_code || r.grade || '';
      if (code && counts[code] !== undefined) {
        counts[code] = (counts[code] || 0) + 1;
      } else if (code) {
        counts[code] = (counts[code] || 0) + 1;
      }
    });

    return activeGradesSet.map((g, index) => {
      const code = g.grade_code || g.grade || '';
      return {
        grade: code,
        descriptor: `${g.remarks} (${g.descriptor})`,
        count: counts[code] || 0,
        color: getGradeColor(code, index),
      };
    });
  }, [activeGradesSet, gradeDistResults]);

  const COLORS = ['#059669', '#10B981', '#2563EB', '#3B82F6', '#D97706', '#F59E0B', '#DC2626', '#EF4444'];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#075E42] text-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-[#087F5B]/60 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          {/* Dynamic Time-Based Greeting */}
          <div className="text-emerald-100/95 text-xs sm:text-sm font-semibold tracking-wide">
            {formatGreeting(userName || 'Administrator')}
          </div>
          <div className="flex items-center space-x-1.5 text-emerald-200/90 font-semibold text-[11px] tracking-wider uppercase">
            <Award className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span>Competency-Based Education (CBE) Management System</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
            {school.school_name || 'Muchorwe Comprehensive School'}
          </h1>
          <p className="text-emerald-100/80 text-xs font-medium italic">
            {school.motto || 'Strive for Excellence'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
          <button
            onClick={() => onNavigate('students')}
            className="flex-1 sm:flex-none bg-[#054531] hover:bg-[#043828] text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center justify-center space-x-1.5 border border-emerald-400/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>Register Student</span>
          </button>
        </div>
      </div>

      {/* Academic Term Transition Reminder Banner */}
      {termReminder && (
        <AcademicTermReminderBanner
          reminder={termReminder}
          onNavigateToSession={() => onNavigate('academic-session')}
          onDismiss={() => setReminderDismissed(true)}
        />
      )}

      {/* --- CURRENT ACADEMIC SESSION CARD --- */}
      <div className="bg-white dark:bg-slate-900 text-[#1F2937] dark:text-slate-100 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#075E42] bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                Active Session Status
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${
                activeTerm.status === 'Active'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {activeTerm.status}
              </span>
            </div>

            <div className="flex items-baseline space-x-3 pt-1">
              <h2 className="text-xl font-bold text-[#1F2937] dark:text-slate-100">Academic Year {activeAcademicYear.year}</h2>
              <span className="text-base font-semibold text-[#075E42] dark:text-emerald-400">{activeTerm.term_name}</span>
            </div>
            <p className="text-xs text-[#667085] dark:text-slate-400">
              All examinations and marks records are automatically tagged to this session.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs w-full md:w-auto">
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700">
              <span className="text-[10px] text-[#667085] dark:text-slate-400 font-semibold block">Opening Date</span>
              <span className="font-bold text-[#1F2937] dark:text-slate-100">{formatDateLabel(activeTerm.opening_date)}</span>
            </div>
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700">
              <span className="text-[10px] text-[#667085] dark:text-slate-400 font-semibold block">Closing Date</span>
              <span className="font-bold text-[#1F2937] dark:text-slate-100">{formatDateLabel(activeTerm.closing_date)}</span>
            </div>
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700">
              <span className="text-[10px] text-[#667085] dark:text-slate-400 font-semibold block">Mid-Term Opening</span>
              <span className="font-bold text-[#1F2937] dark:text-slate-100">
                {activeTerm.mid_term_opening_date ? formatDateLabel(activeTerm.mid_term_opening_date) : 'N/A'}
              </span>
            </div>
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700">
              <span className="text-[10px] text-[#667085] dark:text-slate-400 font-semibold block">Mid-Term Closing</span>
              <span className="font-bold text-[#1F2937] dark:text-slate-100">
                {activeTerm.mid_term_closing_date ? formatDateLabel(activeTerm.mid_term_closing_date) : 'N/A'}
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('academic-session')}
            className="cbe-btn-secondary text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 self-stretch md:self-auto justify-center"
          >
            <span>Session Settings</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-[#1F2937] dark:text-slate-200">
          <Filter className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
          <span>Filter Stats by Education Level & Grade:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5">
            <label className="text-xs font-medium text-[#667085] dark:text-slate-400">Level:</label>
            <select
              value={selectedLevelFilter}
              onChange={(e) => handleLevelChange(e.target.value)}
              className="cbe-input text-xs font-semibold dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            >
              <option value="all">All Levels (PP1 - Grade 9)</option>
              {ALL_EDUCATION_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <label className="text-xs font-medium text-[#667085] dark:text-slate-400">Grade:</label>
            <select
              value={selectedGradeFilter}
              disabled={selectedLevelFilter === 'all'}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="cbe-input text-xs font-semibold dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">
                {selectedLevelFilter === 'all' ? 'Select Level first' : 'All Grades'}
              </option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {(selectedLevelFilter !== 'all' || selectedGradeFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedLevelFilter('all');
                setSelectedGradeFilter('all');
              }}
              className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid - 5 Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Total Students</div>
            <div className="text-xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">{filteredStudents.length}</div>
            <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">{filteredClasses.length} Streams Filtered</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Total Teachers</div>
            <div className="text-xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">{filteredTeachers.length}</div>
            <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">Assigned Teachers</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Total Classes</div>
            <div className="text-xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">{filteredClasses.length}</div>
            <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">Class Streams</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Total Subjects</div>
            <div className="text-xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">{filteredSubjects.length}</div>
            <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">Learning Areas</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Latest Assessment</div>
            <div className="text-xs font-bold text-[#1F2937] dark:text-slate-100 mt-0.5 truncate max-w-[120px]">
              {exams[0]?.exam_name || 'No Assessment Yet'}
            </div>
            <div className="text-[10px] mt-0.5">
              <span
                className={`px-1.5 py-0.5 rounded font-semibold text-[9px] ${
                  exams[0]?.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
                    : exams[0]?.status === 'Provisional'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                {exams[0]?.status || 'Draft'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Gender Distribution & Student Distribution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Distribution Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                  <Users className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                  <span>Gender Distribution</span>
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400">
                  Learner population breakdown by gender
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                {totalGenderLearners} Learners
              </span>
            </div>

            <ChartWrapper
              className="h-56 w-full"
              hasData={totalGenderLearners > 0}
              emptyTitle="No Learner Data Available"
              emptySubtext="Add learners to view gender distribution."
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {genderChartData.map((entry, index) => (
                      <Cell key={`gender-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomDashboardChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </div>

          {/* Gender Legend & Summary Metrics */}
          {totalGenderLearners > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-[#D9E0E7] dark:border-slate-800 text-xs mt-2">
              <div className="bg-[#F6F8FA] dark:bg-slate-800/80 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700/80 flex items-center space-x-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#2563EB] shrink-0" />
                <div>
                  <span className="font-bold text-[#1F2937] dark:text-slate-200 block">Boys / Male</span>
                  <span className="text-[11px] text-[#667085] dark:text-slate-400 font-semibold">
                    {maleCount} ({totalGenderLearners > 0 ? ((maleCount / totalGenderLearners) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>

              <div className="bg-[#F6F8FA] dark:bg-slate-800/80 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700/80 flex items-center space-x-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#DC2626] shrink-0" />
                <div>
                  <span className="font-bold text-[#1F2937] dark:text-slate-200 block">Girls / Female</span>
                  <span className="text-[11px] text-[#667085] dark:text-slate-400 font-semibold">
                    {femaleCount} ({totalGenderLearners > 0 ? ((femaleCount / totalGenderLearners) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>

              {unknownCount > 0 && (
                <div className="bg-[#F6F8FA] dark:bg-slate-800/80 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700/80 flex items-center space-x-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#6B7280] shrink-0" />
                  <div>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200 block">Unspecified</span>
                    <span className="text-[11px] text-[#667085] dark:text-slate-400 font-semibold">
                      {unknownCount} ({((unknownCount / totalGenderLearners) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-3 text-xs text-[#667085] dark:text-slate-400 font-medium">
              No learner gender data available.
            </div>
          )}
        </div>

        {/* Student Distribution Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                  <span>Student Distribution</span>
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400">
                  Learner population per general class (aggregated streams)
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                {studentDistributionData.reduce((acc, curr) => acc + curr.count, 0)} Total
              </span>
            </div>

            <ChartWrapper
              className="h-60 w-full"
              hasData={studentDistributionData.some((d) => d.count > 0)}
              emptyTitle="No Student Data Available"
              emptySubtext="Add learners to view student distribution by class."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 12 }}>
                  <XAxis
                    dataKey="className"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={42}
                    tick={{ fontSize: 10, fill: '#94A3B8' }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    content={<CustomDashboardChartTooltip />}
                  />
                  <Bar dataKey="count" fill="#075E42" radius={[4, 4, 0, 0]}>
                    {studentDistributionData.map((entry, index) => (
                      <Cell
                        key={`student-dist-cell-${index}`}
                        fill={['#075E42', '#059669', '#10B981', '#2563EB', '#3B82F6', '#D97706', '#087F5B'][index % 7]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </div>

          <div className="mt-4 pt-3 border-t border-[#D9E0E7] dark:border-slate-800 flex items-center justify-between text-xs text-[#667085] dark:text-slate-400 font-medium">
            <span>Aggregated by parent general class</span>
            <span className="font-bold text-[#1F2937] dark:text-slate-200">{studentDistributionData.length} General Classes</span>
          </div>
        </div>
      </div>

      {/* Analytics & Top Performers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CBE Grade Distribution Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
          {/* Main Header Row - Horizontal Layout */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/80 w-full">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100">Grade Distribution Analysis</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md shrink-0">
                {selectedGradeDistStreamKey === 'all' ? 'All Streams' : effectiveGradeDistStreamLabel}
              </span>
            </div>
          </div>

          {/* Filters & Actions Control Bar (Well-designed row below title) */}
          <div className="bg-[#F8FAFC] dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/80 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              {/* Assessment Select */}
              {exams && exams.length > 1 && (
                <div className="flex flex-col gap-1 min-w-0 sm:max-w-[280px] flex-1">
                  <label htmlFor="admin-dist-exam-select" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Assessment
                  </label>
                  <select
                    id="admin-dist-exam-select"
                    value={activeExam?.id || ''}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full truncate text-xs py-2 px-3 rounded-lg border border-[#D9E0E7] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-[#075E42] focus:border-[#075E42] cursor-pointer shadow-3xs"
                    title="Select assessment"
                  >
                    {groupExamsForDropdown(filteredExamsForDropdown, activeAcademicYear?.year, activeTerm?.term_name).map((grp, gIdx) => (
                      <optgroup key={`admin_exam_grp_${gIdx}`} label={grp.label} className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        {grp.exams.map(({ exam, label }) => (
                          <option key={exam.id} value={exam.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium">
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              {/* Stream Select */}
              {streamsWithAssessmentInfo.length > 0 && (
                <div className="flex flex-col gap-1 min-w-0 sm:max-w-[220px] flex-1">
                  <label htmlFor="grade-dist-stream-selector" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Stream Filter
                  </label>
                  <select
                    id="grade-dist-stream-selector"
                    value={selectedGradeDistStreamKey}
                    onChange={(e) => setSelectedGradeDistStreamKey(e.target.value)}
                    className="w-full truncate text-xs py-2 px-3 rounded-lg border border-[#D9E0E7] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-[#075E42] focus:border-[#075E42] cursor-pointer shadow-3xs"
                    title="Select stream for grade distribution"
                  >
                    <option value="all">All Streams ({totalAssessedAllStreams} assessed)</option>
                    {streamsWithAssessmentInfo.map((st) => (
                      <option key={st.streamKey} value={st.streamKey}>
                        {st.streamLabel} {st.assessedCount > 0 ? `(${st.assessedCount} assessed)` : '(0 marks)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* View Merit Lists Button */}
            <div className="flex items-end justify-start md:justify-end">
              <button
                onClick={() => onNavigate('reports')}
                className="w-full md:w-auto text-xs font-bold px-4 py-2.5 bg-[#075E42] hover:bg-[#064e35] text-white rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer shrink-0"
              >
                <span>View Merit Lists</span> &rarr;
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#667085] dark:text-slate-400 mb-3">
            <span>Assessment: <strong className="text-slate-800 dark:text-slate-200">{activeExam?.exam_name || 'Current Assessment'}</strong></span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>Scope: <strong className="text-slate-700 dark:text-slate-300">{effectiveGradeDistStreamLabel}</strong></span>
            {gradeDistResults.length > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span>{gradeDistResults.length} assessed</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#075E42] dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">Mean: {gradeDistMeanScore}%</span>
              </>
            )}
          </div>

          {/* Quick-switch stream pills when multiple streams have marks */}
          {streamsWithAssessmentInfo.filter((s) => s.assessedCount > 0).length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">Streams:</span>
              <button
                type="button"
                onClick={() => setSelectedGradeDistStreamKey('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  selectedGradeDistStreamKey === 'all'
                    ? 'bg-[#075E42] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>All Streams</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    selectedGradeDistStreamKey === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                  }`}
                >
                  {totalAssessedAllStreams}
                </span>
              </button>
              {streamsWithAssessmentInfo.filter((s) => s.assessedCount > 0).map((st) => {
                const isSelected = selectedGradeDistStreamKey === st.streamKey;
                return (
                  <button
                    key={st.streamKey}
                    type="button"
                    onClick={() => setSelectedGradeDistStreamKey(st.streamKey)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#075E42] text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{st.streamLabel}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {st.assessedCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <ChartWrapper
            className="h-64 w-full"
            hasData={chartData.some(d => d.count > 0)}
            emptyTitle="No marks entered yet"
            emptySubtext={
              selectedGradeDistStreamKey === 'all'
                ? "Grade distribution will appear once learner marks have been entered."
                : `No marks recorded for ${effectiveGradeDistStreamLabel} in this assessment.`
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                  content={<CustomDashboardChartTooltip />}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-[#D9E0E7] dark:border-slate-800 text-xs">
            {activeGradesSet.map((g, idx) => {
              const code = g.grade_code || g.grade || '';
              const min = g.minimum_score ?? g.minimum_marks ?? 0;
              const max = g.maximum_score ?? g.maximum_marks ?? 100;
              const color = getGradeColor(code, idx);
              return (
                <div key={g.id || code} className="flex items-center space-x-2">
                  <span
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{code}</span>: {min}-{max}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performers per Stream or All Streams */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2 flex-wrap">
                <Award className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
                <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100">Top Overall Performers</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md shrink-0">
                  {effectivePerformerStreamInfo.isAllStreams ? 'All Streams' : 'Per Stream'}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                {exams && exams.length > 1 && (
                  <div className="flex-1 sm:flex-none min-w-0">
                    <label htmlFor="admin-performer-exam-select" className="sr-only font-medium">Assessment</label>
                    <select
                      id="admin-performer-exam-select"
                      value={activeExam?.id || ''}
                      onChange={(e) => setSelectedExamId(e.target.value)}
                      className="w-full sm:w-auto max-w-full sm:max-w-[200px] truncate text-xs py-1.5 px-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700 bg-[#F6F8FA] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-[#075E42] cursor-pointer"
                      title="Select assessment"
                    >
                      {filteredExamsForDropdown.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.exam_name} {ex.term ? `(${ex.term})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {streamsWithAssessmentInfo.length > 0 && (
                  <div className="flex-1 sm:flex-none min-w-0">
                    <label htmlFor="performer-stream-selector" className="sr-only font-medium">Stream Filter</label>
                    <select
                      id="performer-stream-selector"
                      value={selectedPerformerStreamKey}
                      onChange={(e) => setSelectedPerformerStreamKey(e.target.value)}
                      className="w-full sm:w-auto max-w-full sm:max-w-[170px] truncate text-xs py-1.5 px-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700 bg-[#F6F8FA] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-[#075E42] cursor-pointer"
                      title="Select stream to view ranking"
                    >
                      <option value="all">All Streams ({totalAssessedAllStreams} assessed)</option>
                      {streamsWithAssessmentInfo.map((st) => (
                        <option key={st.streamKey} value={st.streamKey}>
                          {st.streamLabel} {st.assessedCount > 0 ? `(${st.assessedCount} assessed)` : '(0 marks)'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#667085] dark:text-slate-400 mb-3">
              <span>Assessment: <strong className="text-slate-800 dark:text-slate-200">{activeExam?.exam_name || 'No Assessment Selected'}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>Scope: <strong className="text-slate-700 dark:text-slate-300">{effectivePerformerStreamInfo.isAllStreams ? `All Streams (${totalAssessedAllStreams} assessed)` : `Stream: ${effectivePerformerStreamInfo.streamLabel}`}</strong></span>
            </div>

            {/* Quick-switch stream pills when multiple streams have marks */}
            {streamsWithAssessmentInfo.filter((s) => s.assessedCount > 0).length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">Streams:</span>
                <button
                  type="button"
                  onClick={() => setSelectedPerformerStreamKey('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    selectedPerformerStreamKey === 'all'
                      ? 'bg-[#075E42] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>All Streams</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      selectedPerformerStreamKey === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {totalAssessedAllStreams}
                  </span>
                </button>
                {streamsWithAssessmentInfo.filter((s) => s.assessedCount > 0).map((st) => {
                  const isSelected = selectedPerformerStreamKey === st.streamKey;
                  return (
                    <button
                      key={st.streamKey}
                      type="button"
                      onClick={() => setSelectedPerformerStreamKey(st.streamKey)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#075E42] text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{st.streamLabel}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {st.assessedCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Ranked performers for effective stream */}
            {streamTopPerformers.length > 0 ? (
              <div className="space-y-2.5">
                {streamTopPerformers.slice(0, 5).map((tp) => (
                  <div
                    key={tp.student_id}
                    className="p-3 bg-[#F6F8FA] dark:bg-slate-800/70 rounded-lg border border-[#D9E0E7] dark:border-slate-700/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          tp.rank === 1
                            ? 'bg-[#075E42] text-white shadow-xs'
                            : tp.rank === 2
                            ? 'bg-[#054531] text-white shadow-xs'
                            : tp.rank === 3
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                        title={`Rank #${tp.rank}`}
                      >
                        #{tp.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 truncate">{tp.student_name}</div>
                        <div className="text-xs text-[#667085] dark:text-slate-400 flex items-center space-x-1.5 flex-wrap">
                          <span>Adm: <span className="font-semibold text-slate-700 dark:text-slate-300">{tp.admission_number}</span></span>
                          {tp.stream_name && (
                            <>
                              <span>•</span>
                              <span className="truncate">{tp.stream_name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{tp.subject_count} Subj</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-[#075E42] dark:text-emerald-400">
                        Total Marks: <span className="font-extrabold">{tp.total_marks}</span>
                        {tp.total_max_marks ? <span className="text-xs font-normal text-slate-500 dark:text-slate-400"> / {tp.total_max_marks}</span> : null}
                      </div>
                      <div className="text-xs text-[#667085] dark:text-slate-400 font-medium">
                        Mean: {Math.round(tp.average * 10) / 10}%
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {tp.performance_level} ({tp.grade_code})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[#667085] dark:text-slate-400 text-xs">
                {isLoadingMarks ? (
                  <div className="space-y-1">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#075E42] border-t-transparent mx-auto mb-2" />
                    <p>Loading assessment marks...</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      No marks compiled for {effectivePerformerStreamInfo.streamLabel} in {activeExam?.exam_name || 'this assessment'} yet.
                    </p>
                    <p className="text-[11px] text-slate-500">Learners are ranked using Total Marks once marks are recorded.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#D9E0E7] dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-[#667085] dark:text-slate-400">
              {streamTopPerformers.length > 0
                ? `Showing top ${Math.min(5, streamTopPerformers.length)} of ${
                    effectivePerformerStreamInfo.isAllStreams
                      ? totalAssessedAllStreams
                      : (effectivePerformerStreamInfo.assessedCount || 0)
                  } in ${effectivePerformerStreamInfo.streamLabel}`
                : 'Ranked using Total Marks'}
            </span>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-[#075E42] dark:text-emerald-400 hover:underline flex items-center space-x-1"
            >
              <span>View Merit Lists</span> &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Cards Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
        <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 mb-4">Admin Quick Action Panel</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate('students')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <Users className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Learner Roster & CSV</span>
          </button>

          <button
            onClick={() => onNavigate('teachers')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <UserCheck className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Teachers & Subjects</span>
          </button>

          <button
            onClick={() => onNavigate('exams')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <BookMarked className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Assessments</span>
          </button>

          <button
            onClick={() => onNavigate('marks-entry')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <FileSpreadsheet className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Fast Marks Entry</span>
          </button>

          <button
            onClick={() => onNavigate('provisional')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <CheckCircle className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Provisional Verify</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <Award className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Report Cards</span>
          </button>
        </div>
      </div>
    </div>
  );
};
