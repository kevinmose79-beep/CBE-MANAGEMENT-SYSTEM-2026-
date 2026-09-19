import React, { useState, useEffect } from 'react';
import { Building2, BookOpen, Plus, Trash2, Edit2, Layers, X, UserCheck, CheckCircle2, ShieldAlert, Lock, Users, RotateCcw, AlertTriangle } from 'lucide-react';
import { ClassStream, Subject, Teacher, EducationLevel, GradeName, Student, Mark, ALL_GRADES, LEVEL_TO_GRADES, getEducationLevelForGrade, getApplicableSubjectsForGrade, sortGrades, sortClasses, sortSubjectsByStandardOrder } from '../types';
import { api, generateUUID, isUUID } from '../lib/storage';
import { isStandardSubject } from '../data/seedData';
import { useNotification } from '../contexts/NotificationContext';

interface ClassSubjectManagementProps {
  classes: ClassStream[];
  subjects: Subject[];
  teachers?: Teacher[];
  initialTab?: 'classes' | 'subjects';
  onAddClass: (cls: ClassStream) => void | Promise<void>;
  onUpdateClass?: (cls: ClassStream) => void | Promise<void>;
  onDeleteClass: (id: string) => void;
  onDeleteStream?: (streamId: string) => void;
  onAddSubject: (sb: Subject) => void;
  onUpdateSubject?: (sb: Subject) => void;
  onDeleteSubject: (id: string) => void;
}

const CURRICULUM_LEVELS: { level: EducationLevel; title: string; subtitle: string; gradesStr: string }[] = [
  { level: 'Pre-Primary', title: 'Pre-Primary', subtitle: '', gradesStr: 'PP1–PP2' },
  { level: 'Lower Primary', title: 'Lower Primary', subtitle: '', gradesStr: 'Grade 1–3' },
  { level: 'Upper Primary', title: 'Upper Primary', subtitle: '', gradesStr: 'Grade 4–6' },
  { level: 'Junior School', title: 'Junior School', subtitle: '', gradesStr: 'Grade 7–9' },
];

interface StreamCardProps {
  c: ClassStream;
  teachers: Teacher[];
  subjects: Subject[];
  allStudents: Student[];
  onEdit: (c: ClassStream) => void;
  onDelete: (c: ClassStream) => void;
  onUpdateClass?: (cls: ClassStream) => void | Promise<void>;
}

const StreamCard: React.FC<StreamCardProps> = ({
  c,
  teachers,
  subjects,
  allStudents,
  onEdit,
  onDelete,
  onUpdateClass,
}) => {
  const { showNotification } = useNotification();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(c.class_teacher_id || '');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  useEffect(() => {
    setSelectedTeacherId(c.class_teacher_id || '');
  }, [c.class_teacher_id]);
  // Count active learners in this stream
  const streamStudents = allStudents.filter(
    (s) =>
      (c.stream_id ? s.stream_id === c.stream_id : (s.class_id === c.id || s.stream_id === c.id)) ||
      ((s.grade === c.class_name || (s as any).class_name === c.class_name) &&
        (s as any).stream &&
        (s as any).stream.toLowerCase() === c.stream.toLowerCase())
  );
  const learnerCount = streamStudents.length;
  const capacity = c.capacity || 40;
  const availablePlaces = Math.max(0, capacity - learnerCount);
  const utilizationPct = Math.min(100, Math.round((learnerCount / capacity) * 100));

  // Grade-applicable active subjects
  const gradeApplicableSubjects = getApplicableSubjectsForGrade(c.class_name, subjects);

  const allocatedIds =
    c.allocated_subject_ids && c.allocated_subject_ids.length > 0
      ? c.allocated_subject_ids
      : gradeApplicableSubjects.map((s) => s.id);

  const allocatedCount = gradeApplicableSubjects.filter((s) => allocatedIds.includes(s.id)).length;

  return (
    <div
      className={`p-4 bg-white dark:bg-slate-900 border rounded-xl flex flex-col justify-between transition shadow-2xs space-y-3 ${
        c.status === 'Inactive'
          ? 'opacity-60 border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20'
          : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/40'
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2 flex-wrap">
            <span>{c.class_name}</span>
            {c.stream ? (
              <>
                <span className="text-slate-300 dark:text-slate-600 font-normal">•</span>
                <span className="text-[#176B45] dark:text-emerald-400 font-bold">{c.stream}</span>
              </>
            ) : null}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                c.status === 'Inactive'
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                  : learnerCount >= capacity
                  ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                  : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
              }`}
            >
              {c.status === 'Inactive' ? 'Inactive' : learnerCount >= capacity ? 'Full' : 'Active'}
            </span>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-3 flex-wrap gap-y-1">
            <span className="flex items-center space-x-1">
              <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>
                Learners: <strong className="text-slate-800 dark:text-slate-200 font-bold">{learnerCount}</strong> / {capacity}
              </span>
            </span>
            <span>
              Available:{' '}
              <strong
                className={
                  availablePlaces === 0
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-[#176B45] dark:text-emerald-400 font-bold'
                }
              >
                {availablePlaces} places
              </strong>
            </span>
          </div>
        </div>

        {/* Touch-Friendly Action Buttons */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(c)}
            className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition border border-emerald-200 dark:border-emerald-800/60 flex items-center space-x-1 min-h-[36px] cursor-pointer"
            title="Edit Stream"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(c)}
            className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition border border-rose-200 dark:border-rose-800/60 flex items-center space-x-1 min-h-[36px] cursor-pointer"
            title="Delete Stream"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Capacity Utilization Progress Bar */}
      <div className="py-1 space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Capacity Utilisation</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{utilizationPct}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              utilizationPct >= 100
                ? 'bg-rose-500'
                : utilizationPct >= 85
                ? 'bg-amber-500'
                : 'bg-[#176B45] dark:bg-emerald-500'
            }`}
            style={{ width: `${utilizationPct}%` }}
          />
        </div>
      </div>

      {/* Class Teacher Assignment */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 shrink-0">
          <UserCheck className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
          <span>Class Teacher:</span>
          {isAssigning && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium animate-pulse">
              Updating...
            </span>
          )}
        </span>
        <select
          disabled={isAssigning}
          value={selectedTeacherId}
          onChange={async (e) => {
            const newTeacherId = e.target.value || '';
            if (newTeacherId === selectedTeacherId) return;
            if (isAssigning) return; // Prevent duplicate rapid requests

            // STREAM ID RULE: The operation MUST use: c.stream_id. Never: c.id. Do not introduce fallback.
            if (!c.stream_id || !isUUID(c.stream_id)) {
              showNotification('error', 'Cannot assign class teacher: Stream ID is missing or invalid.');
              return;
            }

            const previousTeacherId = selectedTeacherId;
            const targetTeacherId = newTeacherId ? newTeacherId : null;
            const streamName = c.stream
              ? (c.stream.toLowerCase().startsWith(c.class_name.toLowerCase())
                  ? c.stream
                  : `${c.class_name} ${c.stream}`.trim())
              : c.class_name;
            const newTeacher = teachers.find((t) => t.id === newTeacherId);
            const newTeacherName = newTeacher?.teacher_name || 'Teacher';

            // 1. Loading state
            setIsAssigning(true);
            setSelectedTeacherId(newTeacherId);

            try {
              // 2. Call authoritative backend & await response
              const result = await api.assignClassTeacher(c.stream_id, targetTeacherId);

              // 3. Verify confirmed success (HTTP 200 alone is not sufficient if result is not confirmed success)
              if (!result || !result.success) {
                throw new Error((result as any)?.error || 'Class teacher assignment was not confirmed by the server.');
              }

              // 4. Update React state in parent if provided
              if (onUpdateClass) {
                await onUpdateClass({
                  ...c,
                  class_teacher_id: targetTeacherId || undefined,
                });
              }

              // 5. Success toast only AFTER confirmed database mutation
              if (targetTeacherId) {
                if (previousTeacherId) {
                  showNotification('success', `Class teacher for "${streamName}" was updated to "${newTeacherName}" successfully.`);
                } else {
                  showNotification('success', `Class teacher "${newTeacherName}" was assigned to "${streamName}" successfully.`);
                }
              } else if (previousTeacherId) {
                showNotification('success', `Class teacher for "${streamName}" was unassigned successfully.`);
              }
            } catch (err: any) {
              // FAILURE:
              // Restore previous valid selection
              setSelectedTeacherId(previousTeacherId);
              console.error('Failed to update class teacher:', err);
              // Show truthful error
              showNotification('error', err?.message || `Failed to update class teacher for "${streamName}".`);
            } finally {
              setIsAssigning(false);
            }
          }}
          className={`text-xs py-1.5 px-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-[#176B45] focus:outline-none w-full sm:w-auto min-w-[180px] ${
            isAssigning ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <option value="">-- No Teacher Assigned --</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.teacher_name}
            </option>
          ))}
        </select>
      </div>

      {/* Allocated Learning Areas Checklist */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
            <span>Allocated Learning Areas</span>
          </span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            {allocatedCount} / {gradeApplicableSubjects.length} Allocated
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          {gradeApplicableSubjects.map((s) => {
            const isAllocated = allocatedIds.includes(s.id);

            return (
              <label
                key={s.id}
                className={`flex items-start space-x-2.5 text-xs p-2 rounded-lg cursor-pointer transition border ${
                  isAllocated
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200 font-semibold border-emerald-300 dark:border-emerald-700 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 opacity-75'
                }`}
              >
                <input
                  type="checkbox"
                  className="rounded text-[#176B45] accent-[#176B45] focus:ring-[#176B45] w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
                  checked={isAllocated}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    let currentAllocated =
                      c.allocated_subject_ids && c.allocated_subject_ids.length > 0
                        ? [...c.allocated_subject_ids]
                        : gradeApplicableSubjects.map((sub) => sub.id);

                    if (checked) {
                      currentAllocated = [...new Set([...currentAllocated, s.id])];
                    } else {
                      currentAllocated = currentAllocated.filter((id) => id !== s.id);
                    }

                    if (onUpdateClass) {
                      onUpdateClass({
                        ...c,
                        allocated_subject_ids: currentAllocated,
                      });
                    }
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight break-words">
                    {s.subject_name}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="font-mono text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.2 rounded font-bold">
                      {s.subject_code}
                    </span>
                    <span className={isAllocated ? 'text-[#176B45] dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}>
                      {isAllocated ? 'Allocated' : 'Not Allocated'}
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const ClassSubjectManagement: React.FC<ClassSubjectManagementProps> = ({
  classes = [],
  subjects = [],
  teachers = [],
  initialTab = 'classes',
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onDeleteStream,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
}) => {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<'classes' | 'subjects'>(initialTab || 'classes');
  const [levelFilter, setLevelFilter] = useState<EducationLevel>('Junior School');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Load students & marks for learner count and deletion safety checks
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allMarks, setAllMarks] = useState<Mark[]>([]);

  useEffect(() => {
    setAllStudents(api.getAllStudentsForMarks());
    setAllMarks(api.getMarks());
  }, [classes]);

  // Sync Subject & Class form defaults whenever levelFilter changes
  useEffect(() => {
    setSbEduLevel(levelFilter);
    const levelGrades = LEVEL_TO_GRADES[levelFilter] || [];
    if (levelGrades.length > 0) {
      setClassName(levelGrades[0]);
    }
  }, [levelFilter]);

  // Class Form State
  const [className, setClassName] = useState<GradeName>('Grade 7');
  const [stream, setStream] = useState('');
  const [capacity, setCapacity] = useState(40);
  const [classStatus, setClassStatus] = useState<'Active' | 'Inactive'>('Active');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [editingClass, setEditingClass] = useState<ClassStream | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassStream | null>(null);
  const [deleteStreamError, setDeleteStreamError] = useState<string | null>(null);
  const [classFormError, setClassFormError] = useState<string | null>(null);

  // Subject Form State
  const [sbName, setSbName] = useState('');
  const [sbCode, setSbCode] = useState('');
  const [sbEduLevel, setSbEduLevel] = useState<EducationLevel>('Junior School');
  const [sbCategory, setSbCategory] = useState<'Core' | 'Elective' | 'Optional' | 'Activity'>('Core');
  const [sbStatus, setSbStatus] = useState<'Active' | 'Archived'>('Active');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectStatusFilter, setSubjectStatusFilter] = useState<'Active' | 'Archived' | 'All'>('Active');
  const [subjectFormError, setSubjectFormError] = useState<string | null>(null);
  const [subjectActionError, setSubjectActionError] = useState<string | null>(null);
  const [subjectActionModal, setSubjectActionModal] = useState<{
    subject: Subject;
    inUse: boolean;
    actionType: 'deactivate' | 'delete' | 'restore';
  } | null>(null);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassFormError(null);
    if (!className || !stream.trim()) {
      setClassFormError('Please select a Class Grade Level and enter a Stream Name.');
      return;
    }

    const level = getEducationLevelForGrade(className);
    if (level !== levelFilter) {
      setClassFormError(`Invalid grade "${className}" for education level "${levelFilter}".`);
      return;
    }

    const trimmedStream = stream.trim();
    const streamExists = classes.some(
      (c) => c.class_name === className && c.stream.trim().toLowerCase() === trimmedStream.toLowerCase()
    );
    if (streamExists) {
      setClassFormError(`A stream named "${trimmedStream}" already exists for ${className}.`);
      return;
    }

    // Auto-allocate active subjects for this level if applicable
    const levelSubjects = subjects.filter((s) => {
      const sLevel =
        s.education_level ||
        (s.applicable_grades && s.applicable_grades.length > 0
          ? getEducationLevelForGrade(s.applicable_grades[0])
          : undefined);
      return sLevel === levelFilter && s.status !== 'Archived';
    });

    const defaultAllocatedIds = levelSubjects
      .filter((s) => s.applicable_grades?.includes(className))
      .map((s) => s.id);

    const newClass: ClassStream = {
      id: `cls_${Date.now()}`,
      class_name: className,
      stream: trimmedStream,
      capacity: capacity || 40,
      education_level: level,
      status: classStatus,
      class_teacher_id: selectedTeacherId || undefined,
      allocated_subject_ids: defaultAllocatedIds,
    };

    try {
      await onAddClass(newClass);
      showNotification('success', `Stream "${className} ${trimmedStream}" created successfully.`);
      setClassFormError(null);
      setStream('');
      setSelectedTeacherId('');
    } catch (err: any) {
      console.error('Failed to create stream:', err);
      setClassFormError(err?.message || 'Failed to create stream.');
    }
  };

  const handleSaveEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    const level = getEducationLevelForGrade(editingClass.class_name);
    const updated = {
      ...editingClass,
      stream: editingClass.stream.trim(),
      education_level: level,
    };
    const originalClass = classes.find((cls) => cls.id === editingClass.id);
    const previousTeacherId = originalClass?.class_teacher_id;
    const newTeacherId = updated.class_teacher_id;
    const teacherChanged = previousTeacherId !== newTeacherId;
    const streamName = updated.stream ? (updated.stream.toLowerCase().startsWith(updated.class_name.toLowerCase()) ? updated.stream : `${updated.class_name} ${updated.stream}`.trim()) : updated.class_name;
    const newTeacher = teachers.find((t) => t.id === newTeacherId);
    const newTeacherName = newTeacher?.teacher_name || 'Teacher';

    try {
      if (teacherChanged) {
        if (!updated.stream_id || !isUUID(updated.stream_id)) {
          showNotification('error', 'Cannot assign class teacher: Stream ID is missing or invalid.');
          return;
        }
      }
      if (onUpdateClass) {
        await onUpdateClass(updated);
      }
      if (teacherChanged) {
        if (newTeacherId) {
          if (previousTeacherId) {
            showNotification('success', `Class teacher for "${streamName}" was updated to "${newTeacherName}" successfully.`);
          } else {
            showNotification('success', `Class teacher "${newTeacherName}" was assigned to "${streamName}" successfully.`);
          }
        } else if (previousTeacherId) {
          showNotification('success', `Class teacher for "${streamName}" was unassigned successfully.`);
        }
      } else {
        showNotification('success', `Stream details for "${streamName}" updated successfully.`);
      }
      setEditingClass(null);
    } catch (err: any) {
      console.error('Failed to update stream:', err);
      showNotification('error', err?.message || 'Failed to update stream details.');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubjectFormError(null);
    if (!sbName.trim() || !sbCode.trim()) {
      setSubjectFormError('Learning Area Name and Subject Code are required.');
      return;
    }

    const trimmedCode = sbCode.trim().toUpperCase();
    const trimmedName = sbName.trim();

    const codeExists = subjects.some((s) => s.subject_code.trim().toUpperCase() === trimmedCode);
    if (codeExists) {
      setSubjectFormError(`A Learning Area with Subject Code '${trimmedCode}' already exists in the system.`);
      return;
    }

    const autoGrades = LEVEL_TO_GRADES[sbEduLevel] || LEVEL_TO_GRADES[levelFilter] || [];

    const newSubject: Subject = {
      id: generateUUID(),
      subject_name: trimmedName,
      subject_code: trimmedCode,
      category: sbCategory,
      education_level: sbEduLevel,
      applicable_grades: autoGrades,
      status: sbStatus,
    };

    try {
      await onAddSubject(newSubject);
      setSubjectFormError(null);
      setSbName('');
      setSbCode('');
    } catch (err: any) {
      console.error('Failed to create learning area:', err);
      setSubjectFormError(err?.message || 'Failed to create learning area.');
    }
  };

  const handleSaveEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;

    const sLevel = editingSubject.education_level || levelFilter;
    const autoGrades = LEVEL_TO_GRADES[sLevel] || [];
    const updatedSubject: Subject = {
      ...editingSubject,
      education_level: sLevel,
      applicable_grades:
        editingSubject.applicable_grades && editingSubject.applicable_grades.length > 0
          ? editingSubject.applicable_grades
          : autoGrades,
    };

    if (onUpdateSubject) {
      try {
        await onUpdateSubject(updatedSubject);
        setEditingSubject(null);
      } catch (err) {
        console.error('Failed to update learning area:', err);
      }
    } else {
      setEditingSubject(null);
    }
  };

  // Filtered Classes & Subjects for active Level
  const filteredClasses = classes.filter((c) => {
    const level = c.education_level || getEducationLevelForGrade(c.class_name);
    return level === levelFilter;
  });

  const levelGrades = LEVEL_TO_GRADES[levelFilter] || [];
  const levelAllSubjects = (() => {
    const seenIds = new Set<string>();
    return subjects.filter((s) => {
      if (!s || !s.id || seenIds.has(s.id)) return false;
      if (levelFilter === 'Lower Primary') {
        const code = (s.subject_code || '').toUpperCase().trim();
        if (!['ENG', 'KIS', 'ILA'].includes(code)) return false;
      }
      let match = false;
      if (s.applicable_grades && s.applicable_grades.length > 0) {
        match = s.applicable_grades.some((g) => levelGrades.includes(g));
      } else {
        match = s.education_level === levelFilter;
      }
      if (match) {
        seenIds.add(s.id);
        return true;
      }
      return false;
    });
  })();

  const activeSubjectsCount = levelAllSubjects.filter((s) => s.status !== 'Archived').length;
  const archivedSubjectsCount = levelAllSubjects.filter((s) => s.status === 'Archived').length;

  const rawFilteredSubjects = levelAllSubjects.filter((s) => {
    if (subjectStatusFilter === 'Active') return s.status !== 'Archived';
    if (subjectStatusFilter === 'Archived') return s.status === 'Archived';
    return true;
  });
  const filteredSubjects = sortSubjectsByStandardOrder(rawFilteredSubjects);

  // Group classes by grade level
  const classGradesMap: Record<string, ClassStream[]> = filteredClasses.reduce((acc, c) => {
    if (!acc[c.class_name]) acc[c.class_name] = [];
    acc[c.class_name].push(c);
    return acc;
  }, {} as Record<string, ClassStream[]>);

  return (
    <div className="space-y-6">
      {/* Header Title Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-[#176B45] dark:text-emerald-400" />
            <span>Classes, Streams & Learning Areas</span>
          </h1>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start md:self-auto flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
              activeTab === 'classes'
                ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Classes ({filteredClasses.length})
          </button>

          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
              activeTab === 'subjects'
                ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Learning Areas ({filteredSubjects.length})
          </button>
        </div>
      </div>

      {/* 4 CURRICULUM LEVEL SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {CURRICULUM_LEVELS.map((item) => {
          const isSelected = levelFilter === item.level;

          // Distinct grades count
          const cardLevelGrades = LEVEL_TO_GRADES[item.level] || [];

          // Exact streams count
          const levelClasses = classes.filter((c) => {
            const lvl = c.education_level || getEducationLevelForGrade(c.class_name);
            return lvl === item.level && c.status !== 'Inactive';
          });

          // Exact learning areas count
          const levelSubjects = subjects.filter((s) => {
            if (s.status === 'Archived') return false;
            if (item.level === 'Lower Primary') {
              const code = (s.subject_code || '').toUpperCase().trim();
              if (!['ENG', 'KIS', 'ILA'].includes(code)) return false;
            }
            if (s.applicable_grades && s.applicable_grades.length > 0) {
              return s.applicable_grades.some((g) => cardLevelGrades.includes(g));
            }
            return s.education_level === item.level;
          });

          return (
            <button
              key={item.level}
              type="button"
              onClick={() => {
                setLevelFilter(item.level);
                setSbEduLevel(item.level);
                const levelGradesList = LEVEL_TO_GRADES[item.level] || [];
                if (levelGradesList.length > 0) setClassName(levelGradesList[0]);
              }}
              className={`text-left p-4 rounded-xl border transition cursor-pointer relative flex flex-col justify-between overflow-hidden ${
                isSelected
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-[#176B45] dark:border-emerald-500 shadow-md ring-2 ring-[#176B45]/20 dark:ring-emerald-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 shadow-2xs'
              }`}
            >
              <div className="w-full">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-[#176B45] dark:bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.gradesStr}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-[#176B45] dark:text-emerald-400 shrink-0" />}
                </div>

                <h3
                  className={`font-extrabold text-sm mt-2 ${
                    isSelected ? 'text-[#176B45] dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {item.title}
                </h3>
                {item.subtitle ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {item.subtitle}
                  </p>
                ) : null}
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] sm:text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 min-w-0">
                  <Layers className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="truncate">
                    Grades: <strong className="text-slate-900 dark:text-slate-100 font-bold">{cardLevelGrades.length}</strong>
                    <span className="mx-1 text-slate-300 dark:text-slate-600">|</span>
                    Streams: <strong className="text-slate-900 dark:text-slate-100 font-bold">{levelClasses.length}</strong>
                  </span>
                </span>
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 shrink-0 ml-auto">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span>
                    Areas: <strong className="text-[#176B45] dark:text-emerald-400 font-bold">{levelSubjects.length}</strong>
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* CLASSES & STREAMS MODULE */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Class Form */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs h-fit space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              Create {levelFilter} Class Stream
            </h2>
            <form onSubmit={handleCreateClass} className="space-y-3 text-xs">
              {classFormError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                  <span>{classFormError}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Class Grade Level *</label>
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value as GradeName)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none font-semibold text-slate-800 dark:text-slate-100"
                >
                  {LEVEL_TO_GRADES[levelFilter].map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#176B45] dark:text-emerald-400 mt-1 font-medium">
                  Curriculum Section: {levelFilter}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Stream Name *</label>
                <input
                  type="text"
                  required
                  value={stream}
                  onChange={(e) => setStream(e.target.value)}
                  placeholder="e.g., Blue, Red, East, West, Gold"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Capacity</label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={classStatus}
                    onChange={(e) => setClassStatus(e.target.value as any)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-slate-800 dark:text-slate-100"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assign Class Teacher (Optional)</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- No Class Teacher Assigned --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teacher_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 bg-[#176B45] hover:bg-[#0F5132] text-white font-bold rounded-lg shadow-xs transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save Class Stream</span>
              </button>
            </form>
          </div>

          {/* List grouped by Grade */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
              <span>Registered {levelFilter} Streams</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{filteredClasses.length} total stream(s)</span>
            </h2>

            {Object.keys(classGradesMap).length > 0 ? (
              sortGrades(Object.keys(classGradesMap)).map((gradeName) => {
                const gradeStreams = sortClasses(classGradesMap[gradeName] || []);
                const eduLevel = getEducationLevelForGrade(gradeName);
                return (
                  <div key={gradeName} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                        <span>{gradeName}</span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                          {eduLevel}
                        </span>
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{gradeStreams.length} Stream(s)</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {gradeStreams.map((c) => (
                        <StreamCard
                          key={c.stream_id || `${c.id}_${c.stream}`}
                          c={c}
                          teachers={teachers}
                          subjects={subjects}
                          allStudents={allStudents}
                          onEdit={(cls) => setEditingClass(cls)}
                          onDelete={(cls) => setDeletingClass(cls)}
                          onUpdateClass={onUpdateClass}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                No class streams found for {levelFilter}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBJECTS / LEARNING AREAS MODULE */}
      {activeTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Subject Form */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs h-fit space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
              <span>Add Learning Area</span>
              <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                {levelFilter}
              </span>
            </h2>

            <form onSubmit={handleCreateSubject} className="space-y-3 text-xs">
              {subjectFormError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                  <span>{subjectFormError}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Learning Area Name *</label>
                <input
                  type="text"
                  required
                  value={sbName}
                  onChange={(e) => setSbName(e.target.value)}
                  placeholder="e.g., Language Activities, Integrated Science"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject Code *</label>
                <input
                  type="text"
                  required
                  value={sbCode}
                  onChange={(e) => setSbCode(e.target.value)}
                  placeholder="e.g., PP-LANG, ENG, KIS, ILA, SCT"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-[#176B45] focus:outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Education Level *</label>
                <div className="relative">
                  <select
                    value={sbEduLevel}
                    disabled
                    className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-bold text-slate-800 dark:text-slate-200 cursor-not-allowed focus:outline-none appearance-none pr-8"
                  >
                    <option value="Pre-Primary">Pre-Primary (PP1, PP2)</option>
                    <option value="Lower Primary">Lower Primary (Grade 1–3)</option>
                    <option value="Upper Primary">Upper Primary (Grade 4–6)</option>
                    <option value="Junior School">Junior School (Grade 7–9)</option>
                  </select>
                  <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-3 top-3.5" />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Locked to active section: <strong className="text-slate-800 dark:text-slate-200">{levelFilter}</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={sbCategory}
                    onChange={(e) => setSbCategory(e.target.value as any)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-slate-800 dark:text-slate-100"
                  >
                    <option value="Core">Core Subject</option>
                    <option value="Activity">Activity</option>
                    <option value="Elective">Elective</option>
                    <option value="Optional">Optional</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={sbStatus}
                    onChange={(e) => setSbStatus(e.target.value as any)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-slate-800 dark:text-slate-100"
                  >
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 bg-[#176B45] hover:bg-[#0F5132] text-white font-bold rounded-lg shadow-xs transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save Learning Area</span>
              </button>
            </form>
          </div>

          {/* Table */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{levelFilter} Learning Areas</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Manage active learning areas and view archived historical subjects.</p>
              </div>
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSubjectStatusFilter('Active')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    subjectStatusFilter === 'Active' ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Active ({activeSubjectsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSubjectStatusFilter('Archived')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    subjectStatusFilter === 'Archived' ? 'bg-white dark:bg-slate-700 text-rose-800 dark:text-rose-300 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Inactive / Archived ({archivedSubjectsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSubjectStatusFilter('All')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    subjectStatusFilter === 'All' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({levelAllSubjects.length})
                </button>
              </div>
            </div>

            {subjectStatusFilter === 'Archived' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg flex items-start space-x-2 text-xs text-amber-900 dark:text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Safeguarded Historical Records:</span> Inactive or Archived Learning Areas are preserved to protect historical student marks, assessment results, and merit list report cards. They cannot be chosen for new class allocations or mark entries, but can be reactivated at any time.
                </div>
              </div>
            )}

            {filteredSubjects.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Learning Area</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredSubjects.map((sb) => {
                      const isArchived = sb.status === 'Archived';
                      const isStandard = isStandardSubject(sb);
                      const inUse = isStandard || api.isSubjectInUse(sb.id);
                      return (
                        <tr key={sb.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${isArchived ? 'bg-slate-50/70 dark:bg-slate-800/30 opacity-90' : ''}`}>
                          <td className="p-2.5 font-mono font-bold text-[#176B45] dark:text-emerald-400">{sb.subject_code}</td>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">
                            <div>{sb.subject_name}</div>
                            {inUse && (
                              <span className="inline-block text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.2 rounded mt-0.5">
                                {isStandard ? 'Standard Curriculum' : 'Linked to records'}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {sb.category}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isArchived ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {isArchived ? 'Inactive' : 'Active'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {!isArchived && (
                                <button
                                  type="button"
                                  onClick={() => setEditingSubject(sb)}
                                  className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded transition cursor-pointer border border-emerald-200/60 dark:border-emerald-800/60"
                                  title="Edit Learning Area"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {isArchived ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubjectActionError(null);
                                      setSubjectActionModal({ subject: sb, inUse, actionType: 'restore' });
                                    }}
                                    className="px-2 py-1 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded border border-emerald-200 dark:border-emerald-800/60 transition cursor-pointer flex items-center space-x-1"
                                    title="Restore Learning Area to Active status"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Restore</span>
                                  </button>
                                  {!isStandard && !inUse && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSubjectActionError(null);
                                        setSubjectActionModal({
                                          subject: sb,
                                          inUse: false,
                                          actionType: 'delete',
                                        });
                                      }}
                                      className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 rounded transition cursor-pointer"
                                      title="Permanently Delete Unused Custom Learning Area"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              ) : (isStandard || inUse) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSubjectActionError(null);
                                    setSubjectActionModal({ subject: sb, inUse: true, actionType: 'deactivate' });
                                  }}
                                  className="px-2.5 py-1 text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded border border-amber-200 dark:border-amber-800/60 transition cursor-pointer flex items-center space-x-1"
                                  title={isStandard ? "Deactivate Standard Learning Area" : "Deactivate Learning Area (In Use)"}
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSubjectActionError(null);
                                    setSubjectActionModal({ subject: sb, inUse: false, actionType: 'delete' });
                                  }}
                                  className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded transition cursor-pointer"
                                  title="Delete Unused Custom Learning Area"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                No learning areas found matching criteria for {levelFilter}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT SUBJECT MODAL */}
      {editingSubject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Edit Learning Area</h3>
              <button onClick={() => setEditingSubject(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubject} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Learning Area Name *</label>
                <input
                  type="text"
                  required
                  value={editingSubject.subject_name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, subject_name: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject Code *</label>
                <input
                  type="text"
                  required
                  value={editingSubject.subject_code}
                  onChange={(e) => setEditingSubject({ ...editingSubject, subject_code: e.target.value.toUpperCase() })}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-[#176B45]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#176B45] text-white rounded-lg font-bold hover:bg-[#0F5132]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CLASS MODAL */}
      {editingClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Edit Class Stream</h3>
              <button onClick={() => setEditingClass(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditClass} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Class Grade *</label>
                  <select
                    value={editingClass.class_name}
                    onChange={(e) => setEditingClass({ ...editingClass, class_name: e.target.value as GradeName })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-[#176B45]"
                  >
                    {ALL_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g} ({getEducationLevelForGrade(g)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Stream Name *</label>
                  <input
                    type="text"
                    required
                    value={editingClass.stream}
                    onChange={(e) => setEditingClass({ ...editingClass, stream: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Capacity</label>
                  <input
                    type="number"
                    value={editingClass.capacity || 40}
                    onChange={(e) => setEditingClass({ ...editingClass, capacity: Number(e.target.value) })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={editingClass.status || 'Active'}
                    onChange={(e) => setEditingClass({ ...editingClass, status: e.target.value as any })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Class Teacher</label>
                <select
                  value={editingClass.class_teacher_id || ''}
                  onChange={(e) => setEditingClass({ ...editingClass, class_teacher_id: e.target.value || undefined })}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45]"
                >
                  <option value="">-- No Class Teacher Assigned --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teacher_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#176B45] text-white rounded-lg font-bold hover:bg-[#0F5132] transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deletingClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Delete Stream</h3>
              </div>
              <button onClick={() => setDeletingClass(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const targetStreamId = deletingClass.stream_id;
              const targetClassId = deletingClass.id;

              const streamStudents = allStudents.filter(
                (s) =>
                  (targetStreamId && s.stream_id === targetStreamId) ||
                  (s.class_id === targetClassId && s.stream && s.stream.toLowerCase() === deletingClass.stream.toLowerCase()) ||
                  ((s.grade === deletingClass.class_name || (s as any).class_name === deletingClass.class_name) &&
                    s.stream &&
                    s.stream.toLowerCase() === deletingClass.stream.toLowerCase())
              );
              const linkedMarks = allMarks.filter(
                (m) =>
                  (targetStreamId && m.stream_id === targetStreamId) ||
                  (m.class_id === targetClassId && (m as any).stream && (m as any).stream.toLowerCase() === deletingClass.stream.toLowerCase())
              );
              const hasLearners = streamStudents.length > 0;
              const hasMarks = linkedMarks.length > 0;
              const isSafe = !hasLearners && !hasMarks;

              return (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1">
                    <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      {deletingClass.class_name} • {deletingClass.stream}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Education Level:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {deletingClass.education_level || getEducationLevelForGrade(deletingClass.class_name)}
                      </strong>
                    </div>
                  </div>

                  {!isSafe ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-amber-900 dark:text-amber-200 space-y-2">
                      <div className="font-bold flex items-center space-x-1 text-amber-800 dark:text-amber-300 text-xs">
                        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Stream Has Active Dependencies</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                        This stream currently contains{' '}
                        {hasLearners && <strong>{streamStudents.length} registered learner(s)</strong>}
                        {hasLearners && hasMarks && ' and '}
                        {hasMarks && <strong>{linkedMarks.length} examination mark record(s)</strong>}.
                      </p>
                      <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300 font-semibold">
                        To maintain assessment history and data integrity, please reassign or transfer learners to another stream before deleting.
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      Are you sure you want to delete stream{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {deletingClass.class_name} • {deletingClass.stream}
                      </strong>
                      ? This action cannot be undone.
                    </p>
                  )}

                  {deleteStreamError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg text-rose-800 dark:text-rose-200 text-xs font-semibold">
                      {deleteStreamError}
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingClass(null);
                        setDeleteStreamError(null);
                      }}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    {isSafe ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!deletingClass.stream_id) {
                            setDeleteStreamError('Cannot delete stream: Missing valid stream_id.');
                            return;
                          }
                          const streamDisplayName = deletingClass.stream
                            ? deletingClass.stream.toLowerCase().includes(deletingClass.class_name.toLowerCase())
                              ? deletingClass.stream
                              : `${deletingClass.class_name} ${deletingClass.stream}`
                            : deletingClass.class_name;
                          try {
                            if (onDeleteStream) {
                              await onDeleteStream(deletingClass.stream_id);
                            } else {
                              await api.deleteStream(deletingClass.stream_id);
                            }
                            setDeletingClass(null);
                            setDeleteStreamError(null);
                            showNotification('success', `Stream "${streamDisplayName}" deleted successfully.`);
                          } catch (err: any) {
                            setDeleteStreamError(err?.message || 'Failed to delete stream.');
                          }
                        }}
                        className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition cursor-pointer"
                      >
                        Confirm Delete Stream
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 rounded-lg font-bold cursor-not-allowed"
                      >
                        Cannot Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SUBJECT ACTION CONFIRMATION MODAL (Deactivate, Delete, Restore) */}
      {subjectActionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            {subjectActionError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{subjectActionError}</span>
              </div>
            )}

            {/* MODAL TYPE: DEACTIVATE */}
            {subjectActionModal.actionType === 'deactivate' && (
              <>
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="w-5 h-5" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Learning Area In Use</h3>
                  </div>
                  <button onClick={() => { setSubjectActionModal(null); setSubjectActionError(null); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{subjectActionModal.subject.subject_name}</span>
                    <span className="font-mono font-bold text-[#176B45] dark:text-emerald-400">{subjectActionModal.subject.subject_code}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Category: {subjectActionModal.subject.category}</div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-3">
                  <p className="leading-relaxed">
                    This Learning Area is already linked to existing school records (such as class allocations, learner marks, assessments, or report cards). It <strong>cannot be permanently deleted</strong> because doing so would corrupt historical academic data.
                  </p>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-amber-900 dark:text-amber-200 space-y-1.5">
                    <span className="font-bold block text-amber-800 dark:text-amber-300">Would you like to deactivate it instead?</span>
                    <ul className="list-disc list-inside text-[11px] space-y-1 text-amber-800 dark:text-amber-300">
                      <li>Removes it from active class allocations and new mark entries</li>
                      <li>Preserves all historical marks, assessments, & reports intact</li>
                      <li>Permanent Learning Area Code and ID remain safely archived</li>
                      <li>Can be restored at any time from the Inactive view</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => { setSubjectActionModal(null); setSubjectActionError(null); }}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const subjectName = subjectActionModal.subject.subject_name;
                      const subjectId = subjectActionModal.subject.id;
                      try {
                        await api.deactivateSubject(subjectId);
                        if (onDeleteSubject) {
                          await onDeleteSubject(subjectId);
                        }
                        setSubjectActionModal(null);
                        setSubjectActionError(null);
                        showNotification('success', `Subject "${subjectName}" was deactivated successfully.`);
                      } catch (err: any) {
                        console.error('Failed to deactivate subject:', err);
                        setSubjectActionError(err?.message || 'Failed to deactivate subject.');
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs transition cursor-pointer flex items-center space-x-1"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Deactivate Learning Area</span>
                  </button>
                </div>
              </>
            )}

            {/* MODAL TYPE: DELETE */}
            {subjectActionModal.actionType === 'delete' && (
              <>
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                    <Trash2 className="w-5 h-5" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Permanently Delete Learning Area</h3>
                  </div>
                  <button onClick={() => { setSubjectActionModal(null); setSubjectActionError(null); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{subjectActionModal.subject.subject_name}</span>
                    <span className="font-mono font-bold text-[#176B45] dark:text-emerald-400">{subjectActionModal.subject.subject_code}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Category: {subjectActionModal.subject.category}</div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to permanently delete this Learning Area? This subject has <strong>never been used</strong> in any class allocations, student marks, or assessment records. This action cannot be undone.
                </p>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => { setSubjectActionModal(null); setSubjectActionError(null); }}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const subjectName = subjectActionModal.subject.subject_name;
                      const subjectId = subjectActionModal.subject.id;
                      try {
                        if (onDeleteSubject) {
                          await onDeleteSubject(subjectId);
                        } else {
                          await api.deleteSubject(subjectId);
                        }
                        setSubjectActionModal(null);
                        setSubjectActionError(null);
                        showNotification('success', `Subject "${subjectName}" was deleted successfully.`);
                      } catch (err: any) {
                        console.error('Failed to delete subject:', err);
                        setSubjectActionError(err?.message || 'Failed to delete subject.');
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs transition cursor-pointer flex items-center space-x-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete</span>
                  </button>
                </div>
              </>
            )}

            {/* MODAL TYPE: RESTORE */}
            {subjectActionModal.actionType === 'restore' && (
              <>
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                    <RotateCcw className="w-5 h-5" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Restore Learning Area</h3>
                  </div>
                  <button onClick={() => { setSubjectActionModal(null); setSubjectActionError(null); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{subjectActionModal.subject.subject_name}</span>
                    <span className="font-mono font-bold text-[#176B45] dark:text-emerald-400">{subjectActionModal.subject.subject_code}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Category: {subjectActionModal.subject.category}</div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Restoring <strong>{subjectActionModal.subject.subject_name}</strong> will return it to active status. It will become immediately available for new class allocations and mark entry without creating duplicate records or changing its ID.
                </p>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => { setSubjectActionModal(null); setSubjectActionError(null); }}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const subjectName = subjectActionModal.subject.subject_name;
                      const subjectId = subjectActionModal.subject.id;
                      try {
                        await api.restoreSubject(subjectId);
                        const activeSub = { ...subjectActionModal.subject, status: 'Active' as const };
                        if (onUpdateSubject) {
                          await onUpdateSubject(activeSub);
                        }
                        setSubjectActionModal(null);
                        setSubjectActionError(null);
                        showNotification('success', `Subject "${subjectName}" was restored successfully.`);
                      } catch (err: any) {
                        console.error('Failed to restore subject:', err);
                        setSubjectActionError(err?.message || 'Failed to restore subject.');
                      }
                    }}
                    className="px-4 py-2 bg-[#176B45] hover:bg-[#0F5132] text-white font-bold rounded-lg shadow-xs transition cursor-pointer flex items-center space-x-1"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reactivate Learning Area</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
