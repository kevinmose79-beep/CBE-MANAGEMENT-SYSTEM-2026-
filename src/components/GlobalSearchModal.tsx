import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  GraduationCap,
  UserCheck,
  Building2,
  BookOpen,
  FileSpreadsheet,
  CalendarDays,
  ChevronRight,
  Sparkles,
  Command,
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
} from 'lucide-react';
import {
  Student,
  Teacher,
  ClassStream,
  Subject,
  Examination,
  AcademicYear,
  SchoolTerm,
  User,
  getStudentFullName,
} from '../types';
import { TabType } from './Sidebar';
import { getDisplayExamName, getDisplayExamType } from '../utils/examDisplayUtils';

export interface SearchResultItem {
  id: string;
  category:
    | 'Learners'
    | 'Teachers'
    | 'Classes & Streams'
    | 'Learning Areas'
    | 'Assessments'
    | 'Academic Sessions';
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ReactNode;
  targetTab: TabType;
  data: any;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  activeTeacher: Teacher | null;
  students: Student[];
  teachers: Teacher[];
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  academicYears: AcademicYear[];
  schoolTerms: SchoolTerm[];
  onSelectResult: (category: string, item: any, targetTab: TabType) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  activeTeacher,
  students,
  teachers,
  classes,
  subjects,
  exams,
  academicYears,
  schoolTerms,
  onSelectResult,
}) => {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search query to prevent excessive computations
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim());
    }, 120);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  // Focus input on modal open
  useEffect(() => {
    if (isOpen) {
      setRawQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Perform search across all 7 authorized categories
  const searchResultsGrouped = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return [];

    const results: SearchResultItem[] = [];

    // 1. Learners
    if (students && students.length > 0) {
      const qCleanAdm = q.replace(/^adm\s*/i, '');
      const matchedLearners = students.filter((s) => {
        const fullName = getStudentFullName(s).toLowerCase();
        const adm = (s.admission_number || '').toLowerCase();
        const grade = (s.grade || '').toLowerCase();
        return (
          fullName.includes(q) ||
          adm.includes(q) ||
          adm.includes(qCleanAdm) ||
          grade.includes(q)
        );
      });

      matchedLearners.slice(0, 8).forEach((s) => {
        const matchedClass = classes.find(
          (c) => c.id === s.class_id || c.id === s.stream_id
        );
        const classNameStr = matchedClass
          ? `${matchedClass.class_name} ${matchedClass.stream ? `Stream ${matchedClass.stream}` : ''}`.trim()
          : s.grade || '';

        results.push({
          id: `learner_${s.id}`,
          category: 'Learners',
          title: getStudentFullName(s) || s.full_name,
          subtitle: `ADM ${s.admission_number} ${classNameStr ? `• ${classNameStr}` : ''}`,
          badge: s.grade || 'Learner',
          icon: <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />,
          targetTab: 'students',
          data: s,
        });
      });
    }

    // 2. Teachers / Staff
    if (teachers && teachers.length > 0) {
      const matchedTeachers = teachers.filter((t) => {
        const name = (t.teacher_name || '').toLowerCase();
        const tsc = (t.tsc_number || '').toLowerCase();
        const username = (t.username || '').toLowerCase();
        const email = (t.email || '').toLowerCase();
        return (
          name.includes(q) ||
          tsc.includes(q) ||
          username.includes(q) ||
          email.includes(q)
        );
      });

      matchedTeachers.slice(0, 6).forEach((t) => {
        results.push({
          id: `teacher_${t.id}`,
          category: 'Teachers',
          title: t.teacher_name,
          subtitle: `${t.tsc_number ? `TSC: ${t.tsc_number}` : ''} ${t.email ? `• ${t.email}` : ''}`.trim(),
          badge: t.is_class_teacher ? 'Class Teacher' : 'Teacher',
          icon: <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />,
          targetTab: 'teachers',
          data: t,
        });
      });
    }

    // 3. Classes & Streams
    if (classes && classes.length > 0) {
      const matchedClasses = classes.filter((c) => {
        const className = (c.class_name || '').toLowerCase();
        const stream = (c.stream || '').toLowerCase();
        const combined = `${className} ${stream}`.toLowerCase();
        return (
          className.includes(q) ||
          stream.includes(q) ||
          combined.includes(q)
        );
      });

      matchedClasses.slice(0, 6).forEach((c) => {
        results.push({
          id: `class_${c.stream_id || `${c.id}_${c.stream}`}`,
          category: 'Classes & Streams',
          title: `${c.class_name} ${c.stream ? `• Stream ${c.stream}` : ''}`,
          subtitle: `Capacity: ${c.capacity || 40} ${c.education_level ? `• ${c.education_level}` : ''}`,
          badge: c.stream ? `Stream ${c.stream}` : 'Class',
          icon: <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />,
          targetTab: 'classes',
          data: c,
        });
      });
    }

    // 4. Learning Areas (Subjects)
    if (subjects && subjects.length > 0) {
      const matchedSubjects = subjects.filter((s) => {
        const name = (s.subject_name || '').toLowerCase();
        const code = (s.subject_code || '').toLowerCase();
        const cat = (s.category || '').toLowerCase();
        return name.includes(q) || code.includes(q) || cat.includes(q);
      });

      matchedSubjects.slice(0, 6).forEach((s) => {
        results.push({
          id: `subject_${s.id}`,
          category: 'Learning Areas',
          title: s.subject_name,
          subtitle: `Code: ${s.subject_code} • ${s.category || 'Core'} ${s.education_level ? `• ${s.education_level}` : ''}`,
          badge: s.subject_code,
          icon: <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />,
          targetTab: 'subjects',
          data: s,
        });
      });
    }

    // 5. Assessments (Examinations)
    if (exams && exams.length > 0) {
      const matchedExams = exams.filter((e) => {
        const name = (e.exam_name || '').toLowerCase();
        const type = (e.exam_type || '').toLowerCase();
        const term = (e.term || '').toLowerCase();
        const status = (e.status || '').toLowerCase();
        const yearStr = (e.year || '').toString();
        const combined = `${name} ${term} ${yearStr}`.toLowerCase();
        return (
          name.includes(q) ||
          type.includes(q) ||
          term.includes(q) ||
          status.includes(q) ||
          combined.includes(q)
        );
      });

      matchedExams.slice(0, 6).forEach((e) => {
        results.push({
          id: `exam_${e.id}`,
          category: 'Assessments',
          title: getDisplayExamName(e.exam_name),
          subtitle: `${getDisplayExamType(e.exam_type)} • ${e.term} ${e.year} (${e.status})`,
          badge: e.term,
          icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />,
          targetTab: 'exams',
          data: e,
        });
      });
    }

    // 6. Academic Sessions
    if (schoolTerms && schoolTerms.length > 0) {
      const matchedTerms = schoolTerms.filter((t) => {
        const termName = (t.term_name || '').toLowerCase();
        const yearStr = (t.year || '').toString();
        const status = (t.status || '').toLowerCase();
        const combined = `${termName} ${yearStr}`.toLowerCase();
        return (
          termName.includes(q) ||
          yearStr.includes(q) ||
          status.includes(q) ||
          combined.includes(q)
        );
      });

      matchedTerms.slice(0, 5).forEach((t) => {
        results.push({
          id: `term_${t.id}`,
          category: 'Academic Sessions',
          title: `${t.term_name} • ${t.year}`,
          subtitle: `Academic Session (${t.status}) • ${t.opening_date ? `Opens ${t.opening_date}` : 'Scheduled'}`,
          badge: t.status,
          icon: <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0" />,
          targetTab: 'academic-session',
          data: t,
        });
      });
    }

    return results;
  }, [debouncedQuery, students, teachers, classes, subjects, exams, schoolTerms]);

  // Group items by category for scannable UI rendering
  const categoriesList = useMemo(() => {
    const map = new Map<string, SearchResultItem[]>();
    searchResultsGrouped.forEach((item) => {
      if (!map.has(item.category)) {
        map.set(item.category, []);
      }
      map.get(item.category)!.push(item);
    });
    return Array.from(map.entries());
  }, [searchResultsGrouped]);

  // Reset selected index if list length changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResultsGrouped.length]);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (searchResultsGrouped.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResultsGrouped.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev - 1 < 0 ? searchResultsGrouped.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentItem = searchResultsGrouped[selectedIndex];
      if (currentItem) {
        onSelectResult(currentItem.category, currentItem.data, currentItem.targetTab);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  let flatCounter = 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 md:p-6 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-1 sm:mt-12 flex flex-col max-h-[88vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Bar */}
        <div className="p-3 sm:p-4 bg-[#075E42] text-white flex items-center gap-3 shrink-0 border-b border-[#087F5B]">
          <Search className="w-5 h-5 text-emerald-200 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Search learners, teachers, classes, assessments…"
            className="w-full bg-transparent text-white placeholder-emerald-200/70 text-sm sm:text-base font-medium focus:outline-none"
            aria-label="Global Search Input"
          />
          {rawQuery && (
            <button
              onClick={() => {
                setRawQuery('');
                setDebouncedQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md hover:bg-[#054531] text-emerald-200 hover:text-white transition cursor-pointer"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold bg-[#054531] hover:bg-[#043828] text-emerald-100 hover:text-white rounded-lg border border-[#087F5B]/60 transition cursor-pointer flex items-center gap-1.5 shrink-0"
            aria-label="Close search"
            title="Close search"
          >
            <X className="w-3.5 h-3.5 shrink-0" />
            <span>Close</span>
            <kbd className="hidden md:inline text-[10px] bg-black/30 px-1 rounded text-emerald-300 font-mono">
              ESC
            </kbd>
          </button>
        </div>

        {/* Search Content & Results Body */}
        <div className="overflow-y-auto p-3 sm:p-4 space-y-4 flex-1">
          {/* Default state when search query is empty */}
          {!debouncedQuery && (
            <div className="py-8 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-800 shadow-2xs">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Global Search Platform</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Quickly locate learners by name or admission number, staff profiles, classes, streams, learning areas, or assessments across your school database.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setRawQuery('Brian')}
                  className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer"
                >
                  Try: "Brian"
                </button>
                <button
                  type="button"
                  onClick={() => setRawQuery('ADM 0245')}
                  className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer"
                >
                  Try: "ADM 0245"
                </button>
                <button
                  type="button"
                  onClick={() => setRawQuery('Grade 9')}
                  className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer"
                >
                  Try: "Grade 9"
                </button>
                <button
                  type="button"
                  onClick={() => setRawQuery('Mathematics')}
                  className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer"
                >
                  Try: "Mathematics"
                </button>
                <button
                  type="button"
                  onClick={() => setRawQuery('Mid-Term')}
                  className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer"
                >
                  Try: "Mid-Term"
                </button>
              </div>
            </div>
          )}

          {/* Empty search results state */}
          {debouncedQuery && searchResultsGrouped.length === 0 && (
            <div className="py-10 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 flex items-center justify-center mx-auto border border-slate-200 dark:border-slate-700">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">No results found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                No matching records found for <span className="font-semibold text-slate-700 dark:text-slate-200">"{debouncedQuery}"</span>. Please check spelling or search with broader terms like learner name, admission number, or grade level.
              </p>
            </div>
          )}

          {/* Categorized Search Results List */}
          {debouncedQuery && searchResultsGrouped.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Search Results ({searchResultsGrouped.length})
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden md:inline">
                  Use ↑ ↓ arrows to navigate, Enter to select
                </span>
              </div>

              {categoriesList.map(([categoryName, categoryItems]) => (
                <div key={categoryName} className="space-y-1.5">
                  <div className="px-2 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/60 rounded-lg border border-emerald-100/80 dark:border-emerald-800/80 flex items-center justify-between">
                    <span>{categoryName}</span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                      {categoryItems.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {categoryItems.map((item) => {
                      const itemIndex = flatCounter++;
                      const isSelected = itemIndex === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            onSelectResult(item.category, item.data, item.targetTab);
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 dark:border-emerald-500 shadow-xs'
                              : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'} transition`}>
                              {React.cloneElement(item.icon as React.ReactElement, {
                                className: `w-4 h-4 ${isSelected ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'}`,
                              })}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                                {item.subtitle}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {item.badge && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                                {item.badge}
                              </span>
                            )}
                            <ChevronRight
                              className={`w-4 h-4 ${
                                isSelected ? 'text-emerald-600 dark:text-emerald-400 translate-x-0.5' : 'text-slate-300 dark:text-slate-600'
                              } transition-transform`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <div className="hidden md:flex items-center space-x-3">
            <span className="flex items-center gap-1">
              <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 rounded shadow-2xs font-mono text-[10px] text-slate-700 dark:text-slate-300">
                ↵
              </kbd>{' '}
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 rounded shadow-2xs font-mono text-[10px] text-slate-700 dark:text-slate-300">
                ↑↓
              </kbd>{' '}
              to navigate
            </span>
          </div>
          <div className="text-slate-400 dark:text-slate-500 w-full md:w-auto text-center md:text-right">
            CBE Management System • Search Engine
          </div>
        </div>
      </div>
    </div>
  );
};
