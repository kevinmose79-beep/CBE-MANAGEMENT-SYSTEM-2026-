import { getMeritListDisplayCode } from '../types';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Info,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  UserX,
  Filter,
} from 'lucide-react';
import {
  Examination,
  Student,
  Subject,
  Mark,
  Grade,
  ClassStream,
  School,
  User,
  Teacher,
  sortGrades,
  sortClasses,
  getApplicableSubjectsForGrade,
} from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { getFilteredStudents, getClassStreamLabel, isClassInExamScope, isLearnerInExamScope, filterExamsForClassScope } from '../utils/filterUtils';
import { exportProvisionalStudentResultsPDF } from '../services/provisionalStudentResultsPdfExporter';
import { sortSubjectsByStandardOrder } from '../services/meritListExporter';
import { evaluateMark, formatPercentage, isUpperPrimaryCompOrInsha } from '../utils/markUtils';
import { getGradeForMark, getLearnerReportSubjects } from '../services/analysisEngine';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { groupExamsForDropdown } from '../utils/examDisplayUtils';
import { getActiveTeacher, getAccessibleClasses, getAccessiblePrimaryClasses, getAccessibleStudents } from '../utils/rbacUtils';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { api } from '../lib/storage';

interface ProvisionalResultsViewProps {
  school?: School;
  exams?: Examination[];
  students?: Student[];
  subjects?: Subject[];
  marks?: Mark[];
  grades?: Grade[];
  classes?: ClassStream[];
  teachers?: Teacher[];
  currentUser?: User;
  selectedExamId?: string;
  selectedClassId?: string;
  selectedStreamId?: string;
  onMarksUpdated?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

export const ProvisionalResultsView: React.FC<ProvisionalResultsViewProps> = ({
  school,
  exams = [],
  students = [],
  subjects = [],
  marks = [],
  grades = [],
  classes = [],
  teachers = [],
  currentUser,
  selectedExamId: propExamId,
  selectedClassId: propClassId,
  selectedStreamId: propStreamId,
  onMarksUpdated,
  onNavigateToTab,
}) => {
  const activeTeacher = useMemo(
    () => getActiveTeacher(currentUser || null, teachers),
    [currentUser, teachers]
  );
  const isAdmin = currentUser?.role === 'admin';

  const accessibleClasses = useMemo(
    () => getAccessibleClasses(currentUser || null, activeTeacher, classes),
    [currentUser, activeTeacher, classes]
  );

  const primaryClasses = useMemo(
    () => getAccessiblePrimaryClasses(currentUser || null, activeTeacher, classes),
    [currentUser, activeTeacher, classes]
  );

  const primaryClass = primaryClasses.length > 0 ? primaryClasses[0] : null;

  // Determine authorized default class and stream for non-admin
  const defaultAuthClass = useMemo(() => {
    if (isAdmin) return '';
    return primaryClass?.class_name || (accessibleClasses.length > 0 ? accessibleClasses[0].class_name : '');
  }, [isAdmin, primaryClass, accessibleClasses]);

  const defaultAuthStream = useMemo(() => {
    if (isAdmin) return 'all';
    if (primaryClass) return primaryClass.stream_id || primaryClass.id;
    if (accessibleClasses.length === 1) return accessibleClasses[0].stream_id || accessibleClasses[0].id;
    return 'all';
  }, [isAdmin, primaryClass, accessibleClasses]);

  const { viewingTerm: activeTermObj, viewingYear: activeYearObj } = useAcademicSession();

  const [internalExamId, setInternalExamId] = useState<string>(() => propExamId || '');
  const [internalClassId, setInternalClassId] = useState<string>(() => propClassId || defaultAuthClass);
  const [internalStreamId, setInternalStreamId] = useState<string>(() => propStreamId || defaultAuthStream);

  // Synchronize internal state with props and authorized defaults
  useEffect(() => {
    if (propExamId !== undefined) {
      setInternalExamId(propExamId);
    }
  }, [propExamId]);

  useEffect(() => {
    if (propClassId !== undefined) {
      setInternalClassId(propClassId);
    } else if (!isAdmin && defaultAuthClass && !internalClassId) {
      setInternalClassId(defaultAuthClass);
    }
  }, [propClassId, isAdmin, defaultAuthClass, internalClassId]);

  useEffect(() => {
    if (propStreamId !== undefined) {
      setInternalStreamId(propStreamId);
    } else if (!isAdmin && defaultAuthStream && (!internalStreamId || internalStreamId === 'all')) {
      if (primaryClass) {
        setInternalStreamId(primaryClass.stream_id || primaryClass.id);
      } else if (accessibleClasses.length === 1) {
        setInternalStreamId(accessibleClasses[0].stream_id || accessibleClasses[0].id);
      }
    }
  }, [propStreamId, isAdmin, defaultAuthStream, internalStreamId, primaryClass, accessibleClasses]);

  // Auto-detect exam matching current active/viewing term session
  React.useEffect(() => {
    if (propExamId !== undefined || !exams || exams.length === 0) return;
    if (!internalExamId || !exams.some((e) => e.id === internalExamId)) {
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
        setInternalExamId(match.id);
      }
    }
  }, [exams, activeYearObj?.year, activeTermObj?.term_name, propExamId, internalExamId]);

  const classSelectRef = useRef<HTMLSelectElement>(null);
  const streamSelectRef = useRef<HTMLSelectElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [sortKey, setSortKey] = useState<'adm' | 'name'>('adm');
  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);

  const rawExamId = propExamId !== undefined ? propExamId : internalExamId;
  const rawClassId = rawExamId ? (propClassId !== undefined ? propClassId : internalClassId) : '';
  const rawStreamId = rawClassId ? (propStreamId !== undefined ? propStreamId : internalStreamId) : 'all';

  // Defensive Guard against manipulated or unauthorized class/stream
  const { effectiveExamId, effectiveClassId, effectiveStreamId } = useMemo(() => {
    const examId = rawExamId;
    if (isAdmin) {
      return {
        effectiveExamId: examId,
        effectiveClassId: rawClassId,
        effectiveStreamId: rawStreamId,
      };
    }

    if (accessibleClasses.length === 0) {
      return {
        effectiveExamId: examId,
        effectiveClassId: '',
        effectiveStreamId: '',
      };
    }

    // Verify rawClassId against accessibleClasses
    const isClassAuth = rawClassId
      ? accessibleClasses.some(
          (c) =>
            c.class_name.toLowerCase() === rawClassId.toLowerCase() ||
            c.id === rawClassId ||
            c.stream_id === rawClassId
        )
      : false;

    const authClassId = isClassAuth
      ? rawClassId
      : (primaryClass?.class_name || accessibleClasses[0]?.class_name || '');

    const matchingStreams = accessibleClasses.filter(
      (c) =>
        c.class_name.toLowerCase() === authClassId.toLowerCase() ||
        c.id === authClassId
    );

    let authStreamId = rawStreamId;
    if (rawStreamId === 'all') {
      if (matchingStreams.length === 1) {
        authStreamId = matchingStreams[0].stream_id || matchingStreams[0].id;
      }
    } else {
      const isStreamAuth = matchingStreams.some(
        (c) => (c.stream_id || c.id) === rawStreamId
      );
      if (!isStreamAuth) {
        authStreamId = matchingStreams[0]
          ? (matchingStreams[0].stream_id || matchingStreams[0].id)
          : (primaryClass?.stream_id || primaryClass?.id || 'all');
      }
    }

    return {
      effectiveExamId: examId,
      effectiveClassId: authClassId,
      effectiveStreamId: authStreamId,
    };
  }, [isAdmin, rawExamId, rawClassId, rawStreamId, accessibleClasses, primaryClass]);

  const filteredExamsForDropdown = useMemo(() => {
    return filterExamsForClassScope(
      exams,
      effectiveClassId,
      accessibleClasses,
      primaryClass,
      currentUser?.role
    );
  }, [exams, effectiveClassId, accessibleClasses, primaryClass, currentUser?.role]);

  const handleExamChange = (newExamId: string) => {
    setInternalExamId(newExamId);
    if (isAdmin) {
      setInternalClassId('');
      setInternalStreamId('all');
    } else {
      setInternalClassId(defaultAuthClass);
      setInternalStreamId(defaultAuthStream);
    }

    if (newExamId) {
      setTimeout(() => {
        classSelectRef.current?.focus();
        try {
          classSelectRef.current?.showPicker();
        } catch {
          // ignore
        }
      }, 50);
    }
  };

  const handleClassChange = (newClassId: string) => {
    setInternalClassId(newClassId);
    if (!isAdmin) {
      const streamsForNewClass = accessibleClasses.filter(
        (c) =>
          c.class_name.toLowerCase() === newClassId.toLowerCase() ||
          c.id === newClassId
      );
      if (streamsForNewClass.length === 1) {
        setInternalStreamId(streamsForNewClass[0].stream_id || streamsForNewClass[0].id);
      } else {
        setInternalStreamId('all');
      }
    } else {
      setInternalStreamId('all');
    }

    if (newClassId) {
      setTimeout(() => {
        streamSelectRef.current?.focus();
        try {
          streamSelectRef.current?.showPicker();
        } catch {
          // ignore
        }
      }, 50);
    }
  };

  const handleStreamChange = (newStreamId: string) => {
    setInternalStreamId(newStreamId);
  };

  // Fetch targeted marks for active exam from Supabase
  React.useEffect(() => {
    let isMounted = true;
    if (!effectiveExamId) {
      setIsLoadingMarks(false);
      return;
    }
    if (!isAdmin && accessibleClasses.length === 0) {
      setIsLoadingMarks(false);
      return;
    }

    setIsLoadingMarks(true);
    api
      .fetchMarksForExam(effectiveExamId, {
        classId: effectiveClassId,
        streamId: effectiveStreamId,
      })
      .then(() => {
        if (isMounted) {
          setIsLoadingMarks(false);
          onMarksUpdated?.();
        }
      })
      .catch((err) => {
        console.error('Error fetching provisional marks:', err);
        if (isMounted) setIsLoadingMarks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveExamId, effectiveClassId, effectiveStreamId, isAdmin, accessibleClasses.length]);

  const selectedExam = (exams || []).find((e) => e.id === effectiveExamId);

  const inScopeClasses = useMemo(() => {
    const baseList = isAdmin ? classes : accessibleClasses;
    if (!selectedExam) return baseList;
    return baseList.filter((c) => isClassInExamScope(c, selectedExam));
  }, [isAdmin, classes, accessibleClasses, selectedExam]);

  const uniqueClasses = useMemo(() => {
    return sortGrades(Array.from(new Set<string>((inScopeClasses || []).map((c) => c.class_name))));
  }, [inScopeClasses]);

  const baseAccessibleStudents = useMemo(() => {
    if (isAdmin) return students;
    return getAccessibleStudents(currentUser || null, activeTeacher, students, classes);
  }, [isAdmin, currentUser, activeTeacher, students, classes]);

  const inScopeStudents = useMemo(() => {
    const baseList = isAdmin ? students : baseAccessibleStudents;
    if (!selectedExam) return baseList;
    return baseList.filter((student) => {
      const ctx = getLearnerClassAtExamTime(student, selectedExam, classes);
      return isLearnerInExamScope(ctx, selectedExam, classes);
    });
  }, [isAdmin, students, baseAccessibleStudents, selectedExam, classes]);

  // Filter students by selected class & stream (historical exam context aware)
  const targetStudents = useMemo(() => {
    if (!effectiveExamId || (!isAdmin && accessibleClasses.length === 0)) return [];
    return getFilteredStudents(
      inScopeStudents,
      inScopeClasses,
      effectiveClassId,
      effectiveStreamId,
      selectedExam
    );
  }, [
    effectiveExamId,
    isAdmin,
    accessibleClasses.length,
    inScopeStudents,
    inScopeClasses,
    effectiveClassId,
    effectiveStreamId,
    selectedExam,
  ]);

  // Sort students by admission number / name for standard verification roster order (NO RANKING)
  const sortedStudents = [...targetStudents].sort((a, b) => {
    if (sortKey === 'name') {
      const nameComp = (a.full_name || '').localeCompare(b.full_name || '');
      if (nameComp !== 0) return nameComp;
      const admA = (a.admission_number || '').toString().toLowerCase();
      const admB = (b.admission_number || '').toString().toLowerCase();
      return admA.localeCompare(admB, undefined, { numeric: true });
    } else {
      const admA = (a.admission_number || '').toString().toLowerCase();
      const admB = (b.admission_number || '').toString().toLowerCase();
      if (admA && admB) {
        const comp = admA.localeCompare(admB, undefined, { numeric: true });
        if (comp !== 0) return comp;
      }
      return (a.full_name || '').localeCompare(b.full_name || '');
    }
  });

  // Group students by their resolved historical class and stream
  const learnerGroups = useMemo(() => {
    if (!sortedStudents || sortedStudents.length === 0) return [];

    const studentWithContext = sortedStudents.map((student) => {
      const ctx = selectedExam ? getLearnerClassAtExamTime(student, selectedExam, classes) : null;
      const cls =
        classes.find((c) => c.id === (ctx?.class_id || student.class_id)) ||
        classes.find(
          (c) =>
            (c.class_name || '').toLowerCase() === (ctx?.class_name || student.grade || '').toLowerCase() &&
            (c.stream || '').toLowerCase() === (ctx?.stream_name || '').toLowerCase()
        ) ||
        classes.find(
          (c) => (c.class_name || '').toLowerCase() === (ctx?.class_name || student.grade || '').toLowerCase()
        );

      const gradeName = cls?.class_name || ctx?.class_name || ctx?.grade || student.grade || 'Unknown Grade';
      const streamName = cls?.stream || ctx?.stream_name || '';
      const fullClassName = streamName ? `${gradeName} ${streamName}`.trim() : gradeName;

      return {
        student,
        ctx,
        cls,
        gradeName,
        streamName,
        fullClassName,
      };
    });

    const groupMap = new Map<
      string,
      {
        fullClassName: string;
        gradeName: string;
        streamName: string;
        clsObj?: ClassStream;
        students: Student[];
      }
    >();

    for (const item of studentWithContext) {
      const key = item.fullClassName;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          fullClassName: item.fullClassName,
          gradeName: item.gradeName,
          streamName: item.streamName,
          clsObj: item.cls,
          students: [],
        });
      }
      groupMap.get(key)!.students.push(item.student);
    }

    const groups = Array.from(groupMap.values()).map((grp) => {
      const firstStd = grp.students[0];
      const rawSubjects = grp.clsObj
        ? getLearnerReportSubjects(firstStd || ({} as any), grp.clsObj, subjects, teachers)
        : getApplicableSubjectsForGrade(grp.gradeName, subjects);

      const grpSubjects = sortSubjectsByStandardOrder(
        rawSubjects && rawSubjects.length > 0
          ? rawSubjects
          : getApplicableSubjectsForGrade(grp.gradeName, subjects)
      );

      return {
        ...grp,
        subjects: grpSubjects,
      };
    });

    return groups.sort((a, b) => {
      const sortedNames = sortGrades([a.gradeName, b.gradeName]);
      if (sortedNames[0] !== sortedNames[1]) {
        return sortedNames[0] === a.gradeName ? -1 : 1;
      }
      return a.streamName.localeCompare(b.streamName);
    });
  }, [sortedStudents, selectedExam, classes, subjects, teachers]);

  const handleDownloadPdf = async () => {
    if (!selectedExam || sortedStudents.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const activeSchool = school || {
        school_name: 'School',
        address: '',
        email: '',
        phone: '',
      };
      await exportProvisionalStudentResultsPDF({
        school: activeSchool,
        exam: selectedExam,
        selectedClassId: effectiveClassId,
        selectedStreamId: effectiveStreamId,
        classes: inScopeClasses,
        students: inScopeStudents,
        subjects,
        marks,
        grades,
        teachers,
        generatedBy: currentUser?.name || 'Administrator',
      });
    } catch (err) {
      console.error('Error generating Provisional Student Results PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const classStreamLabel = getClassStreamLabel(inScopeClasses, effectiveClassId, effectiveStreamId, selectedExam);
  const isPdfDisabled = isExportingPdf || !selectedExam || sortedStudents.length === 0;
  const pdfTooltipText = sortedStudents.length === 0
    ? 'No results available to export.'
    : !selectedExam
    ? 'Please select an assessment to export.'
    : 'Download Provisional PDF';

  return (
    <div className="space-y-4">
      {/* Standalone Selectors (Only shown if props were not provided by parent component) */}
      {(propExamId === undefined || propClassId === undefined) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-xs border border-slate-200 dark:border-slate-800 space-y-2 w-full max-w-full">
          <div className="flex items-center space-x-1.5 text-[#176B45] dark:text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-[#176B45] dark:text-emerald-400" />
            <span>Filter Results</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs w-full">
            {/* Assessment Selection */}
            <div className="space-y-1">
              <label className="block text-slate-700 dark:text-slate-300 font-bold">Assessment</label>
              <select
                value={effectiveExamId}
                onChange={(e) => handleExamChange(e.target.value)}
                className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] dark:focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="">Select Assessment...</option>
                {groupExamsForDropdown(filteredExamsForDropdown, activeYearObj?.year, activeTermObj?.term_name).map((grp, gIdx) => (
                  <optgroup key={`grp_${gIdx}`} label={grp.label}>
                    {grp.exams.map(({ exam: ex, label: optLabel }) => (
                      <option key={ex.id} value={ex.id}>
                        {optLabel}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Class Selection */}
            <div className="space-y-1">
              <label className="block text-slate-700 dark:text-slate-300 font-bold">Class</label>
              <select
                ref={classSelectRef}
                disabled={!effectiveExamId}
                value={effectiveClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] dark:focus:border-emerald-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
              >
                {!effectiveExamId ? (
                  <option value="">Select Assessment First...</option>
                ) : (
                  <>
                    <option value="">Select Class...</option>
                    {uniqueClasses.map((cn, idx) => (
                      <option key={`${cn}_${idx}`} value={cn}>
                        {cn}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Stream Selection */}
            <div className="space-y-1">
              <label className="block text-slate-700 dark:text-slate-300 font-bold">Stream</label>
              <select
                ref={streamSelectRef}
                disabled={!effectiveClassId}
                value={effectiveStreamId}
                onChange={(e) => handleStreamChange(e.target.value)}
                className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] dark:focus:border-emerald-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
              >
                {!effectiveExamId ? (
                  <option value="">Select Assessment First...</option>
                ) : !effectiveClassId ? (
                  <option value="">Select Class First...</option>
                ) : (
                  <>
                    <option value="all">All Streams</option>
                    {sortClasses(
                      inScopeClasses.filter(
                        (c) =>
                          c.class_name.toLowerCase() === effectiveClassId.toLowerCase() ||
                          c.id === effectiveClassId
                      )
                    ).map((c, idx) => (
                      <option key={`${c.stream_id || c.id}_${c.stream}_${idx}`} value={c.stream_id || c.id}>
                        {c.class_name} - {c.stream}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 mb-0.5">
            <span className="bg-emerald-100 dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300 text-[10px] px-2 py-0.5 rounded font-extrabold border border-emerald-200 dark:border-emerald-800 tracking-wider uppercase">
              MARK VERIFICATION REPORT
            </span>
          </div>
          <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
            PROVISIONAL RESULTS
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedExam?.exam_name || 'Selected Assessment'}</span>
            <span>·</span>
            <span>{classStreamLabel || 'All Classes'}</span>
            {activeTermObj?.name && (
              <>
                <span>·</span>
                <span>{activeTermObj.name}</span>
              </>
            )}
            <span>·</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {sortedStudents.length} Candidate{sortedStudents.length === 1 ? '' : 's'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isPdfDisabled}
            title={pdfTooltipText}
            aria-label={pdfTooltipText}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:border-slate-200 dark:disabled:border-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer"
          >
            {isExportingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExportingPdf ? 'Generating...' : 'Download PDF'}</span>
          </button>

          {(currentUser?.role === 'admin' || currentUser?.role === 'class_teacher') && onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('results-approval')}
              className="bg-[#176B45] dark:bg-emerald-600 hover:bg-[#0F5132] dark:hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Go to Results Approval</span>
            </button>
          )}
        </div>
      </div>

      {/* Provisional Results Warning Banner */}
      <div className="bg-yellow-50/90 dark:bg-yellow-950/40 border border-yellow-200/80 dark:border-yellow-800/50 rounded-xl px-3 py-2 text-yellow-900 dark:text-yellow-200 text-xs flex items-center space-x-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <p className="font-semibold text-[11.5px] leading-snug">
          <span className="font-bold">Provisional Results:</span> For verification only — results are subject to administrative correction prior to official approval.
        </p>
      </div>

      {/* Learner Results Roster Tables (Divided by Grade and Stream) */}
      {isLoadingMarks ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <LoadingIndicator minHeight="min-h-[300px]" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Learner Results</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {sortedStudents.length} {sortedStudents.length === 1 ? 'candidate' : 'candidates'} across {learnerGroups.length} {learnerGroups.length === 1 ? 'stream' : 'streams'}
                </span>
              </h2>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Sort:</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as 'adm' | 'name')}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#176B45]"
              >
                <option value="adm">Admission No.</option>
                <option value="name">Student Name</option>
              </select>
            </div>
          </div>

          {learnerGroups.length > 0 ? (
            learnerGroups.map((group, grpIdx) => (
              <div
                key={`${group.fullClassName}_${grpIdx}`}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
              >
                {/* Group Header Bar */}
                <div className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                      {group.fullClassName}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                      {group.students.length} {group.students.length === 1 ? 'candidate' : 'candidates'}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {group.subjects.length} Learning Area{group.subjects.length === 1 ? '' : 's'}
                  </div>
                </div>

                {/* Table for this specific Grade & Stream */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-800 dark:bg-slate-950 text-slate-100 font-extrabold uppercase text-[10px] tracking-wider text-center">
                        <th className="p-2 border-r border-slate-700 dark:border-slate-800 sticky left-0 z-20 bg-slate-800 dark:bg-slate-950 min-w-[40px]">
                          NO.
                        </th>
                        <th className="p-2 border-r border-slate-700 dark:border-slate-800 sticky left-[40px] z-20 bg-slate-800 dark:bg-slate-950 min-w-[75px]">
                          ADM NO
                        </th>
                        <th className="p-2 border-r border-slate-700 dark:border-slate-800 text-left sticky left-[115px] z-20 bg-slate-800 dark:bg-slate-950 min-w-[150px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                          STUDENT
                        </th>

                        {/* Subject Columns */}
                        {group.subjects.map((sb, sbIdx) => (
                          <th
                            key={`${sb.id}_${sbIdx}`}
                            title={sb.subject_name}
                            className="p-2 border-r border-slate-700 dark:border-slate-800 min-w-[55px]"
                          >
                            <span className="block font-black text-emerald-300 dark:text-emerald-400 text-xs">
                              {getMeritListDisplayCode(sb.subject_code, sb.subject_name)}
                            </span>
                          </th>
                        ))}

                        <th className="p-2 border-r border-slate-700 dark:border-slate-800 bg-slate-700/80 dark:bg-slate-900 text-emerald-300">
                          TOTAL
                        </th>
                        <th className="p-2 border-r border-slate-700 dark:border-slate-800 bg-slate-700/80 dark:bg-slate-900 text-slate-300">
                          AVG %
                        </th>
                        <th className="p-2 bg-slate-700/80 dark:bg-slate-900 text-slate-300">
                          CBE LEVEL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-800 dark:text-slate-200">
                      {group.students.map((student, idx) => {
                        let totalScore = 0;
                        let enteredCount = 0;

                        return (
                          <tr
                            key={`${student.id}_${idx}`}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                          >
                            <td className="p-1.5 text-center font-semibold text-slate-500 dark:text-slate-400 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
                              {idx + 1}
                            </td>
                            <td className="p-1.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300 sticky left-[40px] z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
                              {student.admission_number || '-'}
                            </td>
                            <td className="p-1.5 font-bold text-slate-900 dark:text-slate-100 uppercase sticky left-[115px] z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                              {student.full_name}
                            </td>

                            {/* Subject Marks */}
                            {group.subjects.map((sb, sbIdx) => {
                              const stdMark = marks.find(
                                (m) =>
                                  String(m.student_id) === String(student.id) &&
                                  String(m.subject_id) === String(sb.id) &&
                                  String(m.exam_id) === String(effectiveExamId)
                              );
                              const eduLevel = selectedExam?.education_level || group.clsObj?.education_level;
                              const isCompInsha = isUpperPrimaryCompOrInsha(sb, group.clsObj, eduLevel);
                              const markInfo = evaluateMark(stdMark, {
                                isUpperPrimaryCompOrInsha: isCompInsha,
                                subject: sb,
                                classObj: group.clsObj,
                                educationLevel: eduLevel,
                              });

                              if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
                                totalScore += markInfo.percentage;
                                enteredCount += 1;
                                const roundedVal = Math.round(markInfo.percentage);
                                const scoreDisplay = isCompInsha ? markInfo.displayScore : roundedVal;
                                const gr = getGradeForMark(
                                  markInfo.percentage,
                                  grades,
                                  eduLevel,
                                  group.gradeName || group.fullClassName
                                );
                                const cbeCode = gr.grade_code || gr.grade || gr.performance_level || 'ME';
                                const perfLevel = gr.performance_level || 'ME';

                                const badgeColorClass =
                                  perfLevel === 'EE'
                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/40'
                                    : perfLevel === 'ME'
                                    ? 'bg-slate-100/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                                    : perfLevel === 'AE'
                                    ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40'
                                    : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200/50 dark:border-rose-800/40';

                                return (
                                  <td
                                    key={`${sb.id}_${sbIdx}`}
                                    className="p-1 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap"
                                  >
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {scoreDisplay}{' '}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${badgeColorClass}`}>
                                      {cbeCode}
                                    </span>
                                  </td>
                                );
                              } else if (markInfo.status === 'X') {
                                return (
                                  <td
                                    key={`${sb.id}_${sbIdx}`}
                                    className="p-1 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-[10.5px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-950/50"
                                  >
                                    X
                                  </td>
                                );
                              } else if (markInfo.status === 'Y') {
                                return (
                                  <td
                                    key={`${sb.id}_${sbIdx}`}
                                    className="p-1 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-[10.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/50"
                                  >
                                    Y
                                  </td>
                                );
                              } else {
                                return (
                                  <td
                                    key={`${sb.id}_${sbIdx}`}
                                    className="p-1 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-slate-400 dark:text-slate-500 font-normal"
                                  >
                                    —
                                  </td>
                                );
                              }
                            })}

                            {/* Summary Totals */}
                            {(() => {
                              const avg = enteredCount > 0 ? totalScore / enteredCount : 0;
                              const overallGrade = getGradeForMark(
                                avg,
                                grades,
                                selectedExam?.education_level || group.clsObj?.education_level,
                                group.gradeName || group.fullClassName
                              );
                              const level = overallGrade.performance_level || 'ME';

                              return (
                                <>
                                  <td className="p-1.5 text-center font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/80 border-r border-slate-100 dark:border-slate-800">
                                    {enteredCount > 0 ? Math.round(totalScore) : '—'}
                                  </td>
                                  <td className="p-1.5 text-center font-bold text-slate-800 dark:text-slate-200 bg-slate-50/40 dark:bg-slate-800/40 border-r border-slate-100 dark:border-slate-800">
                                    {enteredCount > 0 ? `${formatPercentage(avg)}%` : '—'}
                                  </td>
                                  <td className="p-1.5 text-center">
                                    {enteredCount > 0 ? (
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                          level === 'EE'
                                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                            : level === 'ME'
                                            ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                            : level === 'AE'
                                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                            : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                        }`}
                                      >
                                        {level} ({overallGrade.grade_code || 'ME1'})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-500 font-normal">
                                        —
                                      </span>
                                    )}
                                  </td>
                                </>
                              );
                            })()}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-[#176B45] dark:text-emerald-400">
                <UserX className="w-5 h-5" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">No learners found</h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                  There are currently no learners registered for this assessment and class.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Audit Notice Banner */}
      <div className="bg-sky-50/90 dark:bg-sky-950/50 border border-sky-200/80 dark:border-sky-800/50 rounded-xl px-3.5 py-2.5 text-sky-900 dark:text-sky-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <p className="font-semibold text-[11.5px] leading-snug">
            <span className="font-bold">Mark Verification Notice:</span> Check and verify missing (X/Y) or incorrect marks prior to final approval.
          </p>
        </div>
        {(currentUser?.role === 'admin' || currentUser?.role === 'class_teacher') && onNavigateToTab && (
          <button
            type="button"
            onClick={() => onNavigateToTab('results-approval')}
            className="text-xs font-bold text-[#176B45] dark:text-emerald-400 hover:underline flex items-center space-x-1 shrink-0 cursor-pointer self-end sm:self-auto"
          >
            <span>Proceed to Results Approval &rarr;</span>
          </button>
        )}
      </div>
    </div>
  );
};

