import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Search,
  Upload,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  AlertCircle,
  AlertTriangle,
  Download,
  ArrowRightLeft,
  GraduationCap,
  BookOpen,
  Shield,
  UserCheck,
  Calendar,
  Loader2,
  FileText,
  ClipboardCopy,
} from 'lucide-react';
import { Student, ClassStream, ALL_EDUCATION_LEVELS, getEducationLevelForGrade, User, Teacher, Subject, EducationLevel, sortGrades, sortClasses, getStudentFullName, normalizeGradeName, isIntakePeriodFuture, isMidTermAdmission, TermName, GradeName } from '../types';
import { api } from '../lib/storage';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { useNotification } from '../contexts/NotificationContext';
import Papa from 'papaparse';
import { getActiveTeacher, getAccessibleClasses, getAccessibleStudents } from '../utils/rbacUtils';
import { saveFile } from '../utils/fileDownloader';
import { parseLearnersCsv } from '../utils/csvLearnerParser';

interface StudentRegistrationProps {
  students: Student[];
  classes: ClassStream[];
  teachers?: Teacher[];
  subjects?: Subject[];
  currentUser?: User;
  onAddStudent: (student: Student) => void | Promise<void>;
  onBatchAddStudents: (students: Student[]) => Promise<void>;
  onUpdateStudent: (student: Student) => void | Promise<void>;
  onDeleteStudent: (id: string) => void | Promise<void>;
  onViewProfile?: (student: Student) => void;
}

export const StudentRegistration: React.FC<StudentRegistrationProps> = ({
  students = [],
  classes = [],
  teachers = [],
  subjects = [],
  currentUser,
  onAddStudent,
  onBatchAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onViewProfile,
}) => {
  const activeTeacher = getActiveTeacher(currentUser || null, teachers);
  const accessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);
  const accessibleStudents = getAccessibleStudents(currentUser || null, activeTeacher, students, classes);

  // Identify teacher guardianship: primary class teacher vs subject allocations
  const primaryClassObj = classes.find(
    (c) =>
      (activeTeacher?.class_teacher_of_id &&
        (c.stream_id === activeTeacher.class_teacher_of_id || c.id === activeTeacher.class_teacher_of_id)) ||
      c.class_teacher_id === activeTeacher?.id
  );

  const isClassTeacher = Boolean(
    primaryClassObj || (activeTeacher?.is_class_teacher && activeTeacher.class_teacher_of_id)
  );

  const isStudentInClass = (std: Student, cls?: ClassStream): boolean => {
    if (!cls || !std) return false;
    if (cls.stream_id && std.stream_id) return std.stream_id === cls.stream_id;
    if (cls.stream_id && (std.class_id === cls.stream_id || std.stream_id === cls.id)) return true;
    if (cls.stream && (std as any).stream) {
      const matchGrade = !cls.class_name || !std.grade || cls.class_name.toLowerCase() === std.grade.toLowerCase() || std.class_id === cls.id;
      return matchGrade && (std as any).stream.trim().toLowerCase() === cls.stream.trim().toLowerCase();
    }
    if (cls.class_name && std.grade && cls.class_name.toLowerCase() === std.grade.toLowerCase()) {
      if (cls.stream) {
        const stdCls = classes.find((c) => c.id === std.class_id || c.stream_id === std.stream_id);
        return Boolean(stdCls && stdCls.stream && stdCls.stream.toLowerCase() === cls.stream.toLowerCase());
      }
      return true;
    }
    if (cls.id && (std.class_id === cls.id || std.stream_id === cls.id)) {
      if (cls.stream_id && std.stream_id && std.stream_id !== cls.stream_id) return false;
      return true;
    }
    return false;
  };

  const isMyClassStudent = (std: Student) => isStudentInClass(std, primaryClassObj);

  const myClassStudents = accessibleStudents.filter((s) => isMyClassStudent(s));
  const subjectStudents = accessibleStudents.filter((s) => !isMyClassStudent(s));

  // Extract distinct class/stream groups for subject teaching (excluding primaryClassObj)
  const subjectClassGroups = React.useMemo(() => {
    if (currentUser?.role === 'admin') return [];
    if (!activeTeacher) return [];

    const groupsMap = new Map<string, { cls: ClassStream; subjectNames: string[]; students: Student[] }>();

    // 1. Gather all classes from allocations
    if (Array.isArray(activeTeacher.allocations)) {
      activeTeacher.allocations.forEach((alloc) => {
        const matchedClass = classes.find((c) => {
          if (alloc.stream_id && (c.stream_id === alloc.stream_id || c.id === alloc.stream_id)) return true;
          if (alloc.class_id && (c.id === alloc.class_id || c.stream_id === alloc.class_id)) return true;
          if (alloc.class_name && c.class_name && alloc.class_name.toLowerCase() === c.class_name.toLowerCase()) {
            if (alloc.stream && c.stream) {
              return alloc.stream.trim().toLowerCase() === c.stream.trim().toLowerCase();
            }
            return true;
          }
          return false;
        });

        if (!matchedClass) return;

        // Exclude if it is the teacher's primary Class Teacher class
        if (
          primaryClassObj &&
          (matchedClass.id === primaryClassObj.id ||
            (primaryClassObj.stream_id && matchedClass.stream_id === primaryClassObj.stream_id) ||
            (matchedClass.class_name && primaryClassObj.class_name &&
              matchedClass.class_name.toLowerCase() === primaryClassObj.class_name.toLowerCase() &&
              matchedClass.stream && primaryClassObj.stream &&
              matchedClass.stream.toLowerCase() === primaryClassObj.stream.toLowerCase()))
        ) {
          return;
        }

        const groupKey = matchedClass.stream_id || matchedClass.id || `${matchedClass.class_name}_${matchedClass.stream}`;

        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, {
            cls: matchedClass,
            subjectNames: [],
            students: [],
          });
        }

        const entry = groupsMap.get(groupKey)!;
        const subjName = alloc.subject_name || subjects.find((s) => s.id === alloc.subject_id)?.name || alloc.subject_code || alloc.subject_id;
        if (subjName && !entry.subjectNames.includes(subjName)) {
          entry.subjectNames.push(subjName);
        }
      });
    }

    // 2. Also check if there are any subjectStudents in classes not yet in groupsMap
    subjectStudents.forEach((std) => {
      const stdClass =
        (std.stream_id ? classes.find((c) => c.stream_id === std.stream_id || c.id === std.stream_id) : undefined) ||
        (std.class_id ? classes.find((c) => c.id === std.class_id || c.stream_id === std.class_id) : undefined) ||
        classes.find(
          (c) =>
            (c.class_name && std.class_id && c.class_name === std.class_id) ||
            (`${c.class_name || ''} ${c.stream || ''}`.trim().toLowerCase() === String(std.class_id || '').trim().toLowerCase())
        );

      if (!stdClass) return;

      if (
        primaryClassObj &&
        (stdClass.id === primaryClassObj.id ||
          (primaryClassObj.stream_id && stdClass.stream_id === primaryClassObj.stream_id) ||
          (stdClass.class_name && primaryClassObj.class_name &&
            stdClass.class_name.toLowerCase() === primaryClassObj.class_name.toLowerCase() &&
            stdClass.stream && primaryClassObj.stream &&
            stdClass.stream.toLowerCase() === primaryClassObj.stream.toLowerCase()))
      ) {
        return;
      }

      const groupKey = stdClass.stream_id || stdClass.id || `${stdClass.class_name}_${stdClass.stream}`;

      if (!groupsMap.has(groupKey)) {
        const subjs = (activeTeacher.allocations || [])
          .filter((a) => {
            if (a.stream_id && (stdClass.stream_id === a.stream_id || stdClass.id === a.stream_id)) return true;
            if (a.class_id && (stdClass.id === a.class_id || stdClass.stream_id === a.class_id)) return true;
            if (a.class_name && stdClass.class_name && a.class_name.toLowerCase() === stdClass.class_name.toLowerCase()) {
              if (a.stream && stdClass.stream) {
                return a.stream.trim().toLowerCase() === stdClass.stream.trim().toLowerCase();
              }
              return true;
            }
            return false;
          })
          .map((a) => a.subject_name || subjects.find((s) => s.id === a.subject_id)?.name || a.subject_code || a.subject_id)
          .filter(Boolean);

        groupsMap.set(groupKey, {
          cls: stdClass,
          subjectNames: Array.from(new Set(subjs)),
          students: [],
        });
      }
    });

    const seenStudentIds = new Set<string>();

    const result = Array.from(groupsMap.values()).map((group) => {
      const groupStudents = subjectStudents.filter((std) => {
        if (seenStudentIds.has(std.id)) return false;
        const inThisClass = isStudentInClass(std, group.cls);
        if (inThisClass) {
          seenStudentIds.add(std.id);
          return true;
        }
        return false;
      });

      return {
        ...group,
        students: groupStudents,
      };
    });

    return result.sort((a, b) => {
      const clsA = a.cls;
      const clsB = b.cls;
      const gradeA = clsA.class_name || '';
      const gradeB = clsB.class_name || '';
      if (gradeA !== gradeB) {
        return gradeA.localeCompare(gradeB);
      }
      const streamA = clsA.stream || '';
      const streamB = clsB.stream || '';
      return streamA.localeCompare(streamB);
    });
  }, [currentUser?.role, activeTeacher, classes, primaryClassObj, subjectStudents, subjects]);

  // Roster scope state for teachers: 'my_class' | 'subject_learners' | 'all'
  const [rosterScope, setRosterScope] = useState<'my_class' | 'subject_learners' | 'all'>('my_class');

  const effectiveRosterScope = React.useMemo(() => {
    if (currentUser?.role === 'admin') return 'all';
    if (!isClassTeacher || !primaryClassObj) return 'subject_learners';
    return rosterScope;
  }, [currentUser?.role, isClassTeacher, primaryClassObj, rosterScope]);

  const scopedStudents = React.useMemo(() => {
    if (currentUser?.role === 'admin') return accessibleStudents;
    if (!isClassTeacher || !primaryClassObj) return accessibleStudents;
    if (effectiveRosterScope === 'my_class') return myClassStudents;
    if (effectiveRosterScope === 'subject_learners') return subjectStudents;
    return accessibleStudents;
  }, [currentUser?.role, isClassTeacher, primaryClassObj, effectiveRosterScope, myClassStudents, subjectStudents, accessibleStudents]);

  const scopedClasses = React.useMemo(() => {
    if (currentUser?.role === 'admin') return accessibleClasses;
    if (!isClassTeacher || !primaryClassObj) return accessibleClasses;
    if (effectiveRosterScope === 'my_class') return [primaryClassObj];
    if (effectiveRosterScope === 'subject_learners') {
      return accessibleClasses.filter(
        (c) =>
          c.id !== primaryClassObj.id &&
          (!primaryClassObj.stream_id || c.stream_id !== primaryClassObj.stream_id)
      );
    }
    return accessibleClasses;
  }, [currentUser?.role, isClassTeacher, primaryClassObj, effectiveRosterScope, accessibleClasses]);

  const getTeacherAllocatedSubjectNames = (std: Student): string[] => {
    if (!activeTeacher || !Array.isArray(activeTeacher.allocations)) return [];
    const matched = activeTeacher.allocations.filter((a) => {
      if (a.stream_id && (std.stream_id === a.stream_id || std.class_id === a.stream_id)) return true;
      if (a.class_id && (std.class_id === a.class_id || std.stream_id === a.class_id)) return true;
      if (a.class_name && std.grade && a.class_name.toLowerCase() === std.grade.toLowerCase()) {
        if (a.stream) {
          const stdCls = classes.find((c) => c.id === std.class_id || c.stream_id === std.stream_id);
          return Boolean(stdCls && stdCls.stream && stdCls.stream.toLowerCase() === a.stream.toLowerCase());
        }
        return true;
      }
      return false;
    });

    return Array.from(
      new Set(
        matched
          .map((a) => {
            if (a.subject_name) return a.subject_name;
            const sub = subjects?.find((s) => s.id === a.subject_id);
            return sub?.name || a.subject_id;
          })
          .filter(Boolean)
      )
    );
  };

  const { activeYear, activeTerm } = useAcademicSession();
  const { showNotification } = useNotification();

  const [activeTab, setActiveTab] = useState<'list' | 'individual' | 'csv'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedStreamFilter, setSelectedStreamFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'future' | 'inactive'>('all');

  // Async submission and notification feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Single Student Form State (First Name, Second Name, Last Name, Intake Period)
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [lastName, setLastName] = useState('');
  const [admNo, setAdmNo] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [classId, setClassId] = useState<string>('');
  const [addLevel, setAddLevel] = useState<string>('');
  const [addClassName, setAddClassName] = useState<string>('');
  const [addStream, setAddStream] = useState<string>('');
  const [intakeYear, setIntakeYear] = useState<number>(activeYear?.year || 2026);
  const [intakeTerm, setIntakeTerm] = useState<TermName>(activeTerm?.term_name || 'Term 1');
  const [admissionDate, setAdmissionDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dob, setDob] = useState('');
  const [addFormError, setAddFormError] = useState<string | null>(null);

  // Synchronize intake defaults if active session loads/updates
  useEffect(() => {
    if (activeYear?.year) {
      setIntakeYear(activeYear.year);
    }
    if (activeTerm?.term_name) {
      setIntakeTerm(activeTerm.term_name);
    }
  }, [activeYear?.year, activeTerm?.term_name]);

  // Editing student state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editAdmissionDate, setEditAdmissionDate] = useState<string>('');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Transfer student modal state
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<boolean>(true);

  // Permanent Deletion state & modal
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Admit Learner state & modal
  const [admittingStudent, setAdmittingStudent] = useState<Student | null>(null);
  const [isAdmitting, setIsAdmitting] = useState<boolean>(false);
  const [admitError, setAdmitError] = useState<string | null>(null);

  // CSV Import State
  const [csvInputMethod, setCsvInputMethod] = useState<'file' | 'paste'>('file');
  const [pastedCsvText, setPastedCsvText] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvWarning, setCsvWarning] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  
  const [importEducationLevel, setImportEducationLevel] = useState<string>('');
  const [importClassName, setImportClassName] = useState<string>('');
  const [importStream, setImportStream] = useState<string>('');
  const [importIntakeYear, setImportIntakeYear] = useState<number>(activeYear?.year || 2026);
  const [importIntakeTerm, setImportIntakeTerm] = useState<TermName>(activeTerm?.term_name || 'Term 1');

  useEffect(() => {
    if (activeYear?.year) {
      setImportIntakeYear(activeYear.year);
    }
    if (activeTerm?.term_name) {
      setImportIntakeTerm(activeTerm.term_name);
    }
  }, [activeYear?.year, activeTerm?.term_name]);

  // Lifecycle Action: Execute Permanent Deletion
  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteStudent(deletingStudent.id);
      const studentName = deletingStudent.full_name || 'Learner';
      setToastMessage(`✓ Learner "${studentName}" permanently deleted from database`);
      setTimeout(() => setToastMessage(null), 4000);
      setDeletingStudent(null);
    } catch (err: any) {
      console.error('Failed to delete learner:', err);
      setDeleteError(err?.message || 'Failed to delete learner from database.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Lifecycle Action: Execute Admit Learner
  const handleConfirmAdmit = async () => {
    if (!admittingStudent) return;
    setIsAdmitting(true);
    setAdmitError(null);
    try {
      const updated = await api.admitLearner(admittingStudent.id);
      await onUpdateStudent(updated);
      const studentName = admittingStudent.full_name || 'Learner';
      setToastMessage(`✓ Learner "${studentName}" successfully admitted to Active roster`);
      setTimeout(() => setToastMessage(null), 4000);
      setAdmittingStudent(null);
    } catch (err: any) {
      console.error('Failed to admit learner:', err);
      setAdmitError(err?.message || 'Failed to admit learner to Active roster.');
    } finally {
      setIsAdmitting(false);
    }
  };

  // Helper to derive curriculum level from student and class relationship
  const getLearnerLevel = (std: Student): EducationLevel => {
    if (!std) return 'Junior School';
    const stdClass =
      (std.stream_id ? classes.find((c) => c.stream_id === std.stream_id || c.id === std.stream_id) : undefined) ||
      (std.class_id ? classes.find((c) => c.id === std.class_id || c.stream_id === std.class_id) : undefined) ||
      classes.find(
        (c) =>
          (c.class_name && std.class_id && c.class_name === std.class_id) ||
          (`${c.class_name || ''} ${c.stream || ''}`.trim().toLowerCase() === String(std.class_id || '').trim().toLowerCase())
      );
    const gradeName = stdClass?.class_name || std.grade;
    if (gradeName) {
      return getEducationLevelForGrade(gradeName);
    }
    if (stdClass?.education_level) {
      return stdClass.education_level;
    }
    if (std.education_level) {
      return std.education_level;
    }
    return 'Junior School';
  };

  const handleStartEdit = (std: Student) => {
    setEditFormError(null);
    let fName = std.first_name || '';
    let sName = std.second_name || '';
    let lName = std.last_name || '';

    if (!fName && !lName && std.full_name) {
      const parts = std.full_name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        fName = parts[0];
      } else if (parts.length === 2) {
        fName = parts[0];
        lName = parts[1];
      } else if (parts.length >= 3) {
        fName = parts[0];
        sName = parts.slice(1, -1).join(' ');
        lName = parts[parts.length - 1];
      }
    }

    setEditingStudent({
      ...std,
      first_name: fName,
      second_name: sName,
      last_name: lName,
    });
    setEditAdmissionDate(std.admission_date || '');
  };

  // Level-filtered classes for Single Learner form
  const addAvailableGrades = sortGrades(
    Array.from(
      new Set(
        accessibleClasses
          .filter((c) => {
            if (!addLevel) return false;
            const lvl = c.education_level || (c.class_name ? getEducationLevelForGrade(c.class_name) : '');
            return lvl === addLevel;
          })
          .map((c) => c.class_name)
          .filter(Boolean)
      )
    )
  );

  const addAvailableStreams = Array.from(
    new Set(
      accessibleClasses
        .filter((c) => {
          if (!addLevel || !addClassName) return false;
          const lvl = c.education_level || (c.class_name ? getEducationLevelForGrade(c.class_name) : '');
          return lvl === addLevel && c.class_name === addClassName;
        })
        .map((c) => c.stream)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const handleAddIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);
    const trimmedFirst = firstName.trim();
    const trimmedSecond = secondName.trim();
    const trimmedLast = lastName.trim();
    const trimmedAdm = admNo.trim();

    if (!trimmedFirst) {
      setAddFormError('First Name is required.');
      return;
    }
    if (!trimmedLast) {
      setAddFormError('Last Name is required.');
      return;
    }
    if (!trimmedAdm) {
      setAddFormError('Admission Number is required. Please enter an admission number manually.');
      return;
    }
    if (!addLevel) {
      setAddFormError('Please select an Education Level.');
      return;
    }
    if (!addClassName) {
      setAddFormError('Please select a Class / Grade.');
      return;
    }
    if (addAvailableStreams.length > 0 && !addStream) {
      setAddFormError('Please select a Stream.');
      return;
    }

    const selectedCls = accessibleClasses.find(
      (c) =>
        (c.education_level === addLevel || getEducationLevelForGrade(c.class_name) === addLevel) &&
        c.class_name === addClassName &&
        (c.stream === addStream || (!addStream && !c.stream))
    );

    if (!selectedCls) {
      setAddFormError('Selected Class and Stream combination was not found.');
      return;
    }

    const targetClassId = selectedCls.stream_id || selectedCls.id;

    if (students.some((s) => (s.admission_number || '').toLowerCase() === trimmedAdm.toLowerCase())) {
      setAddFormError(`A learner with admission number '${trimmedAdm}' already exists in the system.`);
      return;
    }

    const derivedGrade = selectedCls.class_name || addClassName;
    const derivedLevel = selectedCls.education_level || (derivedGrade ? getEducationLevelForGrade(derivedGrade) : addLevel);

    const constructedFullName = [trimmedFirst, trimmedSecond, trimmedLast].filter(Boolean).join(' ').toUpperCase();

    const isFutureIntake = isIntakePeriodFuture(intakeYear, intakeTerm, activeYear?.year, activeTerm?.term_name);

    const newStudent: Student = {
      id: `std_${Date.now()}`,
      admission_number: trimmedAdm,
      first_name: trimmedFirst,
      second_name: trimmedSecond || undefined,
      last_name: trimmedLast,
      full_name: constructedFullName,
      gender,
      class_id: selectedCls.id,
      stream_id: selectedCls.stream_id || selectedCls.id,
      grade: derivedGrade,
      education_level: derivedLevel,
      intake_year: Number(intakeYear),
      intake_term: intakeTerm,
      admission_date: isFutureIntake ? undefined : (admissionDate || new Date().toISOString().split('T')[0]),
      enrolment_status: isFutureIntake ? 'future' : 'active',
      dob,
      active: !isFutureIntake,
    };

    setIsSaving(true);
    try {
      await onAddStudent(newStudent);

      // Reset form
      setAddFormError(null);
      setFirstName('');
      setSecondName('');
      setLastName('');
      setAdmNo('');
      setAddLevel('');
      setAddClassName('');
      setAddStream('');
      setClassId('');
      setIntakeYear(activeYear?.year || 2026);
      setIntakeTerm(activeTerm?.term_name || 'Term 1');
      setAdmissionDate(new Date().toISOString().split('T')[0]);

      // Show success toast notification
      const isMidTerm = !isFutureIntake && isMidTermAdmission(intakeYear, intakeTerm, admissionDate, activeYear?.year, activeTerm?.term_name, activeTerm?.opening_date);
      setToastMessage(
        isFutureIntake
          ? '✓ Future intake learner successfully registered (Enrolment Status: Future)'
          : isMidTerm
          ? `✓ Mid-term learner successfully registered (Admitted: ${admissionDate || 'Today'})`
          : '✓ Learner successfully registered'
      );
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);

      // Navigate to roster
      setActiveTab('list');
    } catch (err: any) {
      console.error('Failed to register student:', err);
      setAddFormError(err?.message || 'Failed to register learner. Please check connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditFormError(null);

    if (!editingStudent.first_name?.trim()) {
      setEditFormError('First Name is required.');
      return;
    }
    if (!editingStudent.last_name?.trim()) {
      setEditFormError('Last Name is required.');
      return;
    }
    if (!editingStudent.admission_number?.trim()) {
      setEditFormError('Admission Number is required.');
      return;
    }

    const trimmedAdm = editingStudent.admission_number.trim();
    const duplicate = students.some(
      (s) => s.id !== editingStudent.id && (s.admission_number || '').toLowerCase() === trimmedAdm.toLowerCase()
    );
    if (duplicate) {
      setEditFormError(`A learner with admission number '${trimmedAdm}' already exists in the system.`);
      return;
    }

    const selectedCls =
      (editingStudent.stream_id &&
        classes.find((c) => (c.stream_id || c.id) === editingStudent.stream_id)) ||
      classes.find(
        (c) => c.id === editingStudent.class_id || (c.stream_id && c.stream_id === editingStudent.class_id)
      );
    const derivedGrade = selectedCls?.class_name || editingStudent.grade;
    const derivedLevel = selectedCls?.education_level || (derivedGrade ? getEducationLevelForGrade(derivedGrade) : editingStudent.education_level);

    const nameParts = [editingStudent.first_name?.trim(), editingStudent.second_name?.trim(), editingStudent.last_name?.trim()].filter(Boolean);
    const constructedFullName = (nameParts.length > 0 ? nameParts.join(' ') : (editingStudent.full_name || '')).toUpperCase();

    const updatedStudent: Student = {
      ...editingStudent,
      class_id: selectedCls ? selectedCls.id : editingStudent.class_id,
      stream_id: selectedCls ? (selectedCls.stream_id || selectedCls.id) : editingStudent.stream_id,
      first_name: editingStudent.first_name?.trim(),
      second_name: editingStudent.second_name?.trim() || undefined,
      last_name: editingStudent.last_name?.trim(),
      full_name: constructedFullName,
      admission_date: editAdmissionDate ? editAdmissionDate : editingStudent.admission_date,
      grade: derivedGrade,
      education_level: derivedLevel,
    };

    setIsSaving(true);
    try {
      await onUpdateStudent(updatedStudent);
      const studentDisplayName =
        getStudentFullName(updatedStudent) ||
        updatedStudent.full_name ||
        'Learner';
      showNotification(
        'success',
        `Learner profile for "${studentDisplayName}" updated successfully.`
      );
      setEditingStudent(null);
    } catch (err: any) {
      setEditFormError(err?.message || 'Failed to update learner in database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringStudent) return;

    const targetClass = classes.find((c) => c.stream_id === targetClassId || c.id === targetClassId);
    const derivedGrade = targetClass?.class_name || transferringStudent.grade;
    const derivedLevel = targetClass?.education_level || (derivedGrade ? getEducationLevelForGrade(derivedGrade) : transferringStudent.education_level);

    onUpdateStudent({
      ...transferringStudent,
      class_id: targetClass?.id || transferringStudent.class_id,
      stream_id: targetClass?.stream_id || targetClass?.id || transferringStudent.stream_id,
      grade: derivedGrade,
      education_level: derivedLevel,
      active: targetStatus,
    });

    setTransferringStudent(null);
  };

  // CSV Parsing
  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    setCsvWarning(null);
    setCsvSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    try {
      const result = await parseLearnersCsv(file);
      if (result.errors.length > 0) {
        setCsvError(`CSV Error: ${result.errors[0]}`);
      } else {
        setParsedRows(result.data);
        if (result.warnings.length > 0) {
          setCsvWarning(result.warnings[0]);
        }
      }
    } catch (err: any) {
      setCsvError(`Failed to parse CSV file: ${err?.message || 'Unknown error'}`);
    }
  };

  const handlePastedCsvChange = async (text: string) => {
    setPastedCsvText(text);
    setCsvError(null);
    setCsvWarning(null);
    setCsvSuccess(null);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    try {
      const result = await parseLearnersCsv(text.trim());
      if (result.errors.length > 0) {
        setCsvError(`CSV Error: ${result.errors[0]}`);
      } else {
        setParsedRows(result.data);
        if (result.warnings.length > 0) {
          setCsvWarning(result.warnings[0]);
        }
      }
    } catch (err: any) {
      setCsvError(`Failed to parse pasted text: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleProcessCsvImport = async () => {
    if (isImporting) return;
    if (parsedRows.length === 0) return;
    setCsvError(null);
    setCsvSuccess(null);

    if (!importEducationLevel || !importClassName) {
      setCsvError('Please select the destination Class (and Stream where applicable) before importing learners.');
      return;
    }

    const expectedLevelForClass = getEducationLevelForGrade(importClassName);
    if (expectedLevelForClass !== importEducationLevel) {
      setCsvError(`Invalid curriculum level combination: '${importClassName}' belongs to '${expectedLevelForClass}', not '${importEducationLevel}'.`);
      return;
    }

    const availableStreams = classes.filter((c) => c.class_name === importClassName).map((c) => c.stream).filter(Boolean);
    if (availableStreams.length > 0 && !importStream) {
      setCsvError('Please select the destination Stream before importing learners.');
      return;
    }

    const targetClassStream = classes.find(
      (c) => c.class_name === importClassName && (c.stream === importStream || (!importStream && !c.stream))
    );

    if (!targetClassStream) {
      setCsvError(`Selected class '${importClassName} ${importStream || ''}' was not found in school class records.`);
      return;
    }

    const existingAdmSet = new Set(students.map((s) => (s.admission_number || '').trim().toLowerCase()));
    const batchAdmSet = new Set<string>();
    const newBatch: Student[] = [];
    let duplicateCount = 0;

    let missingAdmCount = 0;

    parsedRows.forEach((row: any, idx: number) => {
      let fName = (row['First Name'] || row['first_name'] || row['FirstName'] || '').trim();
      let sName = (row['Second Name'] || row['second_name'] || row['SecondName'] || row['Middle Name'] || row['middle_name'] || '').trim();
      let lName = (row['Last Name'] || row['last_name'] || row['LastName'] || row['Surname'] || row['surname'] || '').trim();
      const rawFullName = (row['Full Name'] || row['full_name'] || row['Name'] || row['student_name'] || '').trim();

      if (!fName && rawFullName) {
        const parts = rawFullName.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          fName = parts[0];
        } else if (parts.length === 2) {
          fName = parts[0];
          lName = parts[1];
        } else if (parts.length >= 3) {
          fName = parts[0];
          sName = parts.slice(1, -1).join(' ');
          lName = parts[parts.length - 1];
        }
      }

      const nameParts = [fName, sName, lName].filter(Boolean);
      const constructedName = (nameParts.length > 0 ? nameParts.join(' ') : rawFullName).toUpperCase();

      const admission_number =
        row['Admission Number'] ||
        row['admission_number'] ||
        row['Adm No'] ||
        row['ADM NO'];

      if (!admission_number || !String(admission_number).trim()) {
        missingAdmCount++;
        return;
      }

      const trimmedAdm = String(admission_number).trim();
      const admLower = trimmedAdm.toLowerCase();

      if (existingAdmSet.has(admLower) || batchAdmSet.has(admLower)) {
        duplicateCount++;
        return;
      }

      const genderVal = (row['Gender'] || row['gender'] || 'M').toUpperCase().startsWith('F')
        ? 'F'
        : 'M';

      const rowIntakeYear = row['Intake Year'] || row['intake_year'] ? Number(row['Intake Year'] || row['intake_year']) : Number(importIntakeYear);
      const rowIntakeTerm = (row['Intake Term'] || row['intake_term'] || importIntakeTerm) as TermName;
      const isFutureBatchIntake = isIntakePeriodFuture(rowIntakeYear, rowIntakeTerm, activeYear?.year, activeTerm?.term_name);
      const rowAdmissionDate = row['Admission Date'] || row['admission_date'] || row['AdmissionDate'];
      const finalAdmissionDate = isFutureBatchIntake ? undefined : (rowAdmissionDate || new Date().toISOString().split('T')[0]);

      // Resolve per-row class & stream if provided in CSV (e.g. "Grade 7", "Blue", "Red"), otherwise fallback to dropdown selections
      const rowClassRaw = (row['Class'] || row['class'] || row['Grade'] || row['grade'] || row['Class Name'] || '').trim();
      const rowStreamRaw = (row['Stream'] || row['stream'] || row['Stream Name'] || '').trim();

      const targetGradeName = rowClassRaw || importClassName;
      let resolvedClassStream = targetClassStream;

      if (rowClassRaw || rowStreamRaw) {
        // Try finding exact class_name and stream match
        const foundExact = classes.find(
          (c) =>
            c.class_name.toLowerCase() === targetGradeName.toLowerCase() &&
            (rowStreamRaw
              ? c.stream && c.stream.trim().toLowerCase() === rowStreamRaw.toLowerCase()
              : c.stream === importStream || (!importStream && !c.stream))
        );
        if (foundExact) {
          resolvedClassStream = foundExact;
        } else if (rowClassRaw) {
          // If row specifies a class name, find matching class
          const foundClass = classes.find((c) => c.class_name.toLowerCase() === rowClassRaw.toLowerCase());
          if (foundClass) {
            resolvedClassStream = foundClass;
          }
        }
      }

      if (constructedName && resolvedClassStream) {
        const rowGrade = (resolvedClassStream.class_name || targetGradeName) as GradeName;
        const rowLevel = (resolvedClassStream.education_level || getEducationLevelForGrade(rowGrade) || importEducationLevel) as EducationLevel;
        batchAdmSet.add(admLower);
        newBatch.push({
          id: `std_csv_${Date.now()}_${idx}`,
          admission_number: trimmedAdm,
          first_name: fName || undefined,
          second_name: sName || undefined,
          last_name: lName || undefined,
          full_name: constructedName,
          gender: genderVal,
          class_id: resolvedClassStream.id,
          stream_id: resolvedClassStream.stream_id || resolvedClassStream.id,
          education_level: rowLevel,
          grade: rowGrade,
          intake_year: rowIntakeYear,
          intake_term: rowIntakeTerm,
          admission_date: finalAdmissionDate,
          enrolment_status: isFutureBatchIntake ? 'future' : 'active',
          active: !isFutureBatchIntake,
        });
      }
    });

    if (newBatch.length > 0) {
      setIsImporting(true);
      try {
        await onBatchAddStudents(newBatch);

        let msg = `Successfully imported ${newBatch.length} learners!`;
        if (duplicateCount > 0) {
          msg += ` (${duplicateCount} duplicate learner(s) skipped)`;
        }
        if (missingAdmCount > 0) {
          msg += ` (${missingAdmCount} row(s) missing admission number skipped)`;
        }
        setCsvSuccess(msg);
        setParsedRows([]);
        setCsvFile(null);
        setImportEducationLevel('');
        setImportClassName('');
        setImportStream('');

        // Navigation occurs only after successful Supabase persistence
        setActiveTab('list');
      } catch (err: any) {
        console.error('Failed to import CSV learner batch:', err);
        const userMsg = err?.message || 'Failed to import learners into database. Please check connection and try again.';
        setCsvError(userMsg);
      } finally {
        setIsImporting(false);
      }
    } else {
      let errMsg = 'No valid student rows found in CSV.';
      if (duplicateCount > 0) {
        errMsg = `All ${duplicateCount} learner(s) in CSV already exist in the system (duplicate admission numbers).`;
      } else if (missingAdmCount > 0) {
        errMsg = `${missingAdmCount} row(s) in CSV are missing Admission Number. Please enter Admission Numbers manually in your CSV file before importing.`;
      }
      setCsvError(errMsg);
    }
  };

  // Download sample CSV template with separate name fields and optional stream
  const handleDownloadSampleCsv = async () => {
    const csvContent =
      'Admission Number,First Name,Second Name,Last Name,Gender,Stream\n' +
      'ADM-2026-050,Mercy,Chebet,Kipkemoi,F,Blue\n' +
      'ADM-2026-051,Peter,,Kamau,M,Red\n';
    await saveFile(csvContent, 'CBE_Learners_Import_Template.csv', {
      mimeType: 'text/csv;charset=utf-8;',
      dialogTitle: 'Download Learners Import Template',
    });
  };

  // Level-filtered classes for the dropdown
  const levelFilteredClasses = scopedClasses.filter((cls) => {
    if (!cls) return false;
    if (selectedLevelFilter === 'all') return true;
    const clsLevel = cls.education_level || (cls.class_name ? getEducationLevelForGrade(cls.class_name) : 'Junior School');
    return clsLevel === selectedLevelFilter;
  });

  // Unique available grades/classes for current Level selection
  const availableGrades = sortGrades(
    Array.from<string>(new Set(levelFilteredClasses.map((cls) => cls.class_name).filter((name): name is string => Boolean(name))))
  );

  // Classes filtered by Level AND Grade
  const gradeFilteredClasses = levelFilteredClasses.filter((cls) => {
    if (!cls) return false;
    if (selectedGradeFilter === 'all') return true;
    return cls.class_name === selectedGradeFilter;
  });

  // Unique available streams for current Level and Grade selection
  const availableStreams: string[] = Array.from<string>(
    new Set(gradeFilteredClasses.map((cls) => cls.stream).filter((st): st is string => Boolean(st)))
  ).sort((a: string, b: string) => a.localeCompare(b));

  // Filtered students list matching search + Level + Grade + Stream
  const filteredStudents = scopedStudents.filter((s) => {
    if (!s) return false;

    // Search query check
    const query = searchQuery.trim().toLowerCase();
    const fullName = getStudentFullName(s);
    const admNo = s.admission_number || '';
    const matchesSearch =
      !query ||
      fullName.toLowerCase().includes(query) ||
      admNo.toLowerCase().includes(query);
    if (!matchesSearch) return false;

    // Find matching class stream object (prioritize stream_id over class_id)
    const cls =
      (s.stream_id ? classes.find((c) => c.stream_id === s.stream_id || c.id === s.stream_id) : undefined) ||
      (s.class_id ? classes.find((c) => c.id === s.class_id || c.stream_id === s.class_id) : undefined) ||
      classes.find(
        (c) =>
          (c.class_name && s.class_id && c.class_name === s.class_id) ||
          (`${c.class_name || ''} ${c.stream || ''}`.trim().toLowerCase() === String(s.class_id || '').trim().toLowerCase())
      );

    // Level check
    const stdLevel = getLearnerLevel(s);
    const matchesLevel = selectedLevelFilter === 'all' || stdLevel === selectedLevelFilter;
    if (!matchesLevel) return false;

    // Grade / Class check
    const stdGrade = cls?.class_name || s.grade;
    const matchesGrade =
      selectedGradeFilter === 'all' ||
      stdGrade === selectedGradeFilter ||
      s.class_id === selectedGradeFilter;
    if (!matchesGrade) return false;

    // Stream check
    const stdStream = cls?.stream || s.stream_id;
    const matchesStream =
      selectedStreamFilter === 'all' ||
      stdStream === selectedStreamFilter ||
      cls?.id === selectedStreamFilter ||
      cls?.stream_id === selectedStreamFilter ||
      s.stream_id === selectedStreamFilter ||
      s.class_id === selectedStreamFilter;
    if (!matchesStream) return false;

    // Status check (all / active / future / inactive)
    if (selectedStatusFilter !== 'all') {
      const isFuture = s.enrolment_status === 'future' || (!s.active && isIntakePeriodFuture(s.intake_year, s.intake_term, activeYear?.year, activeTerm?.term_name));
      if (selectedStatusFilter === 'active' && (!s.active || isFuture)) return false;
      if (selectedStatusFilter === 'future' && !isFuture) return false;
      if (selectedStatusFilter === 'inactive' && (s.active || isFuture)) return false;
    }

    return true;
  });

  const isAnyFilterActive =
    selectedLevelFilter !== 'all' ||
    selectedGradeFilter !== 'all' ||
    selectedStreamFilter !== 'all' ||
    selectedStatusFilter !== 'all' ||
    searchQuery.trim() !== '';

  const handleClearFilters = () => {
    setSelectedLevelFilter('all');
    setSelectedGradeFilter('all');
    setSelectedStreamFilter('all');
    setSelectedStatusFilter('all');
    setSearchQuery('');
  };

  const myClassFilteredStudents = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return myClassStudents;
    return myClassStudents.filter((s) => {
      const fullName = getStudentFullName(s);
      const admNo = s.admission_number || '';
      return fullName.toLowerCase().includes(query) || admNo.toLowerCase().includes(query);
    });
  }, [myClassStudents, searchQuery]);

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Floating Brief Pop-up Toast: Learner Registration */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 sm:top-5 z-50 flex items-center bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border border-emerald-300 dark:border-emerald-700/80 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md space-x-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
        >
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-bold leading-tight truncate">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-1 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <span>Learner Roster</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {currentUser?.role === 'admin'
              ? 'Comprehensive school-wide learner records and enrollment management.'
              : 'View learners according to your class-teacher and subject-teaching responsibilities.'}
          </p>
        </div>

        {currentUser?.role === 'admin' && (
          <div className="flex items-center space-x-1 sm:space-x-3 border-b border-slate-200/80 dark:border-slate-800 pb-0.5">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold transition border-b-2 -mb-1 cursor-pointer ${
                activeTab === 'list'
                  ? 'border-[#176B45] dark:border-emerald-400 text-[#176B45] dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Learners Roster ({accessibleStudents.length})
            </button>

            <button
              onClick={() => setActiveTab('individual')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold transition border-b-2 -mb-1 flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'individual'
                  ? 'border-[#176B45] dark:border-emerald-400 text-[#176B45] dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Single Learner</span>
            </button>

            <button
              onClick={() => setActiveTab('csv')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold transition border-b-2 -mb-1 flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'csv'
                  ? 'border-[#176B45] dark:border-emerald-400 text-[#176B45] dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: LEARNERS ROSTER */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* TEACHER VIEW: Separated Class Learners and Subject Learners */}
          {currentUser?.role !== 'admin' ? (
            <div className="space-y-5">
              {/* Quick Search & Summary Bar */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by learner name or adm no..."
                    className="w-full pl-9 pr-8 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Total Assigned: <strong className="text-slate-900 dark:text-slate-100">{accessibleStudents.length}</strong></span>
                  </div>
                  {isClassTeacher && primaryClassObj && (
                    <div className="text-slate-400 dark:text-slate-500 hidden sm:inline">&bull;</div>
                  )}
                  {isClassTeacher && primaryClassObj && (
                    <div className="text-slate-500 dark:text-slate-400">
                      Class: <strong className="text-emerald-700 dark:text-emerald-300">{myClassStudents.length}</strong> | Subject: <strong className="text-slate-700 dark:text-slate-300">{subjectStudents.length}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* 1. CLASS LEARNERS SECTION (for Class Teachers) */}
              {isClassTeacher && primaryClassObj && (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Class Learners</span>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Learners in your assigned class stream.
                      </p>
                    </div>
                  </div>

                  {/* Class Stream Banner Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 rounded-lg border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {primaryClassObj.class_name} {primaryClassObj.stream}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Class Teacher
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {myClassFilteredStudents.length} {myClassFilteredStudents.length === 1 ? 'Learner' : 'Learners'}
                    </span>
                  </div>

                  {/* Class Learners Table */}
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800/80 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                          <th className="p-3">Adm No</th>
                          <th className="p-3">Full Name</th>
                          <th className="p-3">Gender</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {myClassFilteredStudents.length > 0 ? (
                          myClassFilteredStudents.map((std) => (
                            <tr key={std.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                              <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">{std.admission_number}</td>
                              <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{getStudentFullName(std)}</td>
                              <td className="p-3">
                                <span className="inline-block px-2 py-0.5 rounded-md font-medium text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                                  {std.gender === 'F' ? 'Female' : 'Male'}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className="inline-flex items-center gap-1.5 font-medium text-[11px] text-slate-700 dark:text-slate-300">
                                  <span className={`w-1.5 h-1.5 rounded-full ${std.active ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-slate-500'}`} />
                                  <span>{std.active ? 'Active' : 'Inactive / Transferred'}</span>
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {onViewProfile && (
                                  <button
                                    onClick={() => onViewProfile(std)}
                                    className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition inline-flex items-center space-x-1 border border-slate-200 dark:border-slate-700/60 cursor-pointer"
                                    title="View CBE Profile"
                                  >
                                    <GraduationCap className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                    <span className="text-[11px] font-medium">Profile</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-slate-500 dark:text-slate-400">
                              <p className="font-semibold text-sm">
                                {searchQuery.trim() ? 'No class learners match your search query.' : 'No learners registered in your class.'}
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. SUBJECT LEARNERS SECTION */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Subject Learners</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Learners you teach through your assigned learning areas.
                  </p>
                </div>

                {subjectClassGroups.length > 0 ? (
                  <div className="space-y-4">
                    {subjectClassGroups.map((group) => {
                      const query = searchQuery.trim().toLowerCase();
                      const groupFilteredStudents = query
                        ? group.students.filter((s) => {
                            const fullName = getStudentFullName(s);
                            const admNo = s.admission_number || '';
                            return fullName.toLowerCase().includes(query) || admNo.toLowerCase().includes(query);
                          })
                        : group.students;

                      return (
                        <div
                          key={group.cls.stream_id || group.cls.id || `${group.cls.class_name}_${group.cls.stream}`}
                          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
                        >
                          {/* Mandatory UX Rule: Class + Stream is primary visual heading, immediately beneath it the assigned learning areas */}
                          <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {group.cls.class_name} {group.cls.stream}
                              </h3>
                              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                {group.subjectNames.length > 0
                                  ? group.subjectNames.join(' · ')
                                  : 'Assigned Learning Areas'}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                {groupFilteredStudents.length} {groupFilteredStudents.length === 1 ? 'Learner' : 'Learners'}
                              </span>
                            </div>
                          </div>

                          {/* Table of Subject Learners for this group */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                                  <th className="p-3">Adm No</th>
                                  <th className="p-3">Full Name</th>
                                  <th className="p-3">Gender</th>
                                  <th className="p-3 text-center">Status</th>
                                  <th className="p-3 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {groupFilteredStudents.length > 0 ? (
                                  groupFilteredStudents.map((std) => (
                                    <tr key={std.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                                      <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">{std.admission_number}</td>
                                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{getStudentFullName(std)}</td>
                                      <td className="p-3">
                                        <span className="inline-block px-2 py-0.5 rounded-md font-medium text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                                          {std.gender === 'F' ? 'Female' : 'Male'}
                                        </span>
                                      </td>
                                      <td className="p-3 text-center">
                                        <span className="inline-flex items-center gap-1.5 font-medium text-[11px] text-slate-700 dark:text-slate-300">
                                          <span className={`w-1.5 h-1.5 rounded-full ${std.active ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-slate-500'}`} />
                                          <span>{std.active ? 'Active' : 'Inactive / Transferred'}</span>
                                        </span>
                                      </td>
                                      <td className="p-3 text-center">
                                        {onViewProfile && (
                                          <button
                                            onClick={() => onViewProfile(std)}
                                            className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition inline-flex items-center space-x-1 border border-slate-200 dark:border-slate-700/60 cursor-pointer"
                                            title="View CBE Profile"
                                          >
                                            <GraduationCap className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                            <span className="text-[11px] font-medium">Profile</span>
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={5} className="text-center py-6 text-slate-500 dark:text-slate-400">
                                      <p className="font-semibold text-sm">
                                        {searchQuery.trim() ? 'No learners in this group match your search query.' : 'No learners found in this class/stream.'}
                                      </p>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                      No other subject classes allocated.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ADMIN VIEW: Standard Administrative Table with Full Filtering */
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              {/* Cascading Filters & Search */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative w-full lg:w-72 shrink-0">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by learner name or adm no..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                  />
                </div>

                {/* Cascading Filter Controls: Educational Level -> Class / Grade -> Stream */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                  {/* 1. Educational Level */}
                  <div className="flex items-center space-x-1.5 min-w-[130px] flex-1 sm:flex-initial">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Level:</label>
                    <select
                      value={selectedLevelFilter}
                      onChange={(e) => {
                        const newLevel = e.target.value;
                        setSelectedLevelFilter(newLevel);
                        setSelectedGradeFilter('all');
                        setSelectedStreamFilter('all');
                      }}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-[#176B45] focus:outline-none font-medium text-slate-800 dark:text-slate-100"
                    >
                      <option value="all">All Levels</option>
                      {ALL_EDUCATION_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Class / Grade */}
                  <div className="flex items-center space-x-1.5 min-w-[130px] flex-1 sm:flex-initial">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Class:</label>
                    <select
                      value={selectedGradeFilter}
                      disabled={selectedLevelFilter === 'all'}
                      onChange={(e) => {
                        setSelectedGradeFilter(e.target.value);
                        setSelectedStreamFilter('all');
                      }}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-[#176B45] focus:outline-none font-medium text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                    >
                      <option value="all">
                        {selectedLevelFilter === 'all' ? 'Select Level first' : 'All Classes'}
                      </option>
                      {availableGrades.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Stream */}
                  <div className="flex items-center space-x-1.5 min-w-[120px] flex-1 sm:flex-initial">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Stream:</label>
                    <select
                      value={selectedStreamFilter}
                      disabled={selectedLevelFilter === 'all' || selectedGradeFilter === 'all'}
                      onChange={(e) => setSelectedStreamFilter(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-[#176B45] focus:outline-none font-medium text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                    >
                      <option value="all">
                        {selectedGradeFilter === 'all' ? 'Select Class first' : 'All Streams'}
                      </option>
                      {availableStreams.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Status Filter */}
                  <div className="flex items-center space-x-1.5 min-w-[120px] flex-1 sm:flex-initial">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Status:</label>
                    <select
                      value={selectedStatusFilter}
                      onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-[#176B45] focus:outline-none font-medium text-slate-800 dark:text-slate-100"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active Only</option>
                      <option value="future">Future Intake</option>
                      <option value="inactive">Inactive / Transferred</option>
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  {isAnyFilterActive && (
                    <button
                      onClick={handleClearFilters}
                      className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg transition flex items-center gap-1 whitespace-nowrap"
                      title="Reset all filters"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear Filters</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Learner Count Indicator */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5 pt-1">
                <span>
                  Showing <strong className="font-bold text-slate-800 dark:text-slate-200">{filteredStudents.length}</strong> {filteredStudents.length === 1 ? 'learner' : 'learners'}
                  {scopedStudents.length !== filteredStudents.length && (
                    <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                      (filtered from {scopedStudents.length} total)
                    </span>
                  )}
                </span>
              </div>

              {/* Admin Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800/80 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="p-3">Adm No</th>
                      <th className="p-3">Full Name</th>
                      <th className="p-3">Gender</th>
                      <th className="p-3">Class & Stream</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((std) => {
                        const cls =
                          (std.stream_id ? classes.find((c) => c.stream_id === std.stream_id || c.id === std.stream_id) : undefined) ||
                          (std.class_id ? classes.find((c) => c.id === std.class_id || c.stream_id === std.class_id) : undefined) ||
                          classes.find(
                            (c) =>
                              (c.class_name && std.class_id && c.class_name === std.class_id) ||
                              (`${c.class_name || ''} ${c.stream || ''}`.trim().toLowerCase() === String(std.class_id || '').trim().toLowerCase())
                          );

                        const isFuture = std.enrolment_status === 'future' || (!std.active && isIntakePeriodFuture(std.intake_year, std.intake_term, activeYear?.year, activeTerm?.term_name));

                        return (
                          <tr key={std.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                            <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">{std.admission_number}</td>
                            <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{getStudentFullName(std)}</td>
                            <td className="p-3">
                              <span className="inline-block px-2 py-0.5 rounded-md font-medium text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                                {std.gender === 'F' ? 'Female' : 'Male'}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                              {cls ? `${cls.class_name} ${cls.stream}` : 'Unassigned'}
                            </td>
                            <td className="p-3 text-center">
                              {isFuture ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title={`Intake: ${std.intake_year || 'Future'} ${std.intake_term || ''}`}>
                                  <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                  <span>Future ({std.intake_year ? `${std.intake_year} ${std.intake_term || ''}` : 'Pending'})</span>
                                </span>
                              ) : std.active ? (
                                isMidTermAdmission(std.intake_year, std.intake_term, std.admission_date, activeYear?.year, activeTerm?.term_name, activeTerm?.opening_date) ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title={`Mid-Term Admitted: ${std.admission_date || 'Current Term'}`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                                    <span>Active (Mid-Term)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-[11px] text-slate-700 dark:text-slate-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                                    <span>Active</span>
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1.5 font-medium text-[11px] text-slate-700 dark:text-slate-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                                  <span>Inactive / Transferred</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                {isFuture && (
                                  <button
                                    type="button"
                                    id={`admit-learner-btn-${std.id}`}
                                    onClick={() => {
                                      setAdmittingStudent(std);
                                      setAdmitError(null);
                                    }}
                                    disabled={isSaving || isAdmitting}
                                    className="px-2 py-1 text-emerald-800 dark:text-emerald-300 hover:text-white dark:hover:text-white bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-700 dark:hover:bg-emerald-700 rounded transition flex items-center space-x-1 border border-emerald-300 dark:border-emerald-700 font-semibold cursor-pointer"
                                    title="Admit Learner to Active Roster"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span className="text-[10px]">Admit</span>
                                  </button>
                                )}
                                {onViewProfile && (
                                  <button
                                    type="button"
                                    id={`view-profile-btn-${std.id}`}
                                    onClick={() => onViewProfile(std)}
                                    className="px-2 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition flex items-center space-x-1 border border-slate-200 dark:border-slate-700/60 cursor-pointer"
                                    title="View CBE Profile"
                                  >
                                    <GraduationCap className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                    <span className="hidden sm:inline text-[10px] font-medium">Profile</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  id={`transfer-learner-btn-${std.id}`}
                                  onClick={() => {
                                    setTransferringStudent(std);
                                    setTargetClassId(std.class_id);
                                    setTargetStatus(std.active);
                                  }}
                                  className="px-2 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition flex items-center space-x-1 border border-slate-200 dark:border-slate-700/60 cursor-pointer"
                                  title="Transfer Learner"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                  <span className="hidden sm:inline text-[10px] font-medium">Transfer</span>
                                </button>
                                <button
                                  type="button"
                                  id={`edit-learner-btn-${std.id}`}
                                  onClick={() => handleStartEdit(std)}
                                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                                  title="Edit Learner Info"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  id={`delete-learner-btn-${std.id}`}
                                  onClick={() => {
                                    setDeletingStudent(std);
                                    setDeleteError(null);
                                  }}
                                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                                  title="Permanently Delete Learner"
                                  aria-label={`Permanently Delete Learner ${std.full_name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500 dark:text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                              {scopedStudents.length === 0
                                ? 'No learners found.'
                                : 'No learners match the selected filters.'}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
                              {scopedStudents.length === 0
                                ? 'No registered learners available.'
                                : 'Try clearing or adjusting your search filters to find the learners you are looking for.'}
                            </p>
                            {isAnyFilterActive && (
                              <button
                                onClick={handleClearFilters}
                                className="mt-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg transition inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                              >
                                <X className="w-3.5 h-3.5" />
                                Clear Filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SINGLE INDIVIDUAL REGISTRATION FORM */}
      {activeTab === 'individual' && (() => {
        const recentStudents = [...accessibleStudents].slice(-5).reverse();
        return (
          <div className="w-full space-y-3.5 sm:space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
              {/* HEADER */}
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                  <span>Register Single Learner</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Add learner details</p>
              </div>

              <form onSubmit={handleAddIndividual} className="space-y-3.5">
                {addFormError && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                    <span>{addFormError}</span>
                  </div>
                )}

                {/* RESPONSIVE FULL-WIDTH GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* First Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSaving}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g., Stacy"
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  {/* Second Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Second Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      disabled={isSaving}
                      value={secondName}
                      onChange={(e) => setSecondName(e.target.value)}
                      placeholder="e.g., Njeri"
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSaving}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g., Mwangi"
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  {/* Admission Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Admission Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSaving}
                      value={admNo}
                      onChange={(e) => setAdmNo(e.target.value)}
                      placeholder="e.g., ADM-2026-001"
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-mono font-bold rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      disabled={isSaving}
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'M' | 'F')}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>

                  {/* Education Level */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Education Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      disabled={isSaving}
                      value={addLevel}
                      onChange={(e) => {
                        const newLvl = e.target.value;
                        setAddLevel(newLvl);
                        setAddClassName('');
                        setAddStream('');
                        setClassId('');
                      }}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none font-medium disabled:opacity-60"
                    >
                      <option value="">Select level...</option>
                      {ALL_EDUCATION_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Class / Grade */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Class / Grade <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={addClassName}
                      disabled={!addLevel || isSaving}
                      onChange={(e) => {
                        const newGrade = e.target.value;
                        setAddClassName(newGrade);
                        setAddStream('');
                        setClassId('');
                      }}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none font-medium disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                    >
                      <option value="">{addLevel ? 'Select class...' : 'Select level first'}</option>
                      {addAvailableGrades.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stream */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Stream <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={addStream}
                      disabled={!addLevel || !addClassName || isSaving}
                      onChange={(e) => {
                        const newSt = e.target.value;
                        setAddStream(newSt);
                        const matchingCls = accessibleClasses.find(
                          (c) =>
                            (c.education_level === addLevel || getEducationLevelForGrade(c.class_name) === addLevel) &&
                            c.class_name === addClassName &&
                            (c.stream === newSt || (!newSt && !c.stream))
                        );
                        if (matchingCls) {
                          setClassId(matchingCls.stream_id || matchingCls.id);
                        } else {
                          setClassId('');
                        }
                      }}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none font-medium disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                    >
                      <option value="">
                        {!addLevel || !addClassName
                          ? 'Select class first'
                          : addAvailableStreams.length === 0
                          ? 'No streams'
                          : 'Select stream...'}
                      </option>
                      {addAvailableStreams.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Intake Academic Year */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Intake Academic Year <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={intakeYear}
                      disabled={isSaving}
                      onChange={(e) => setIntakeYear(Number(e.target.value))}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none font-medium disabled:opacity-60"
                    >
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                        <option key={yr} value={yr}>
                          {yr} {yr === activeYear?.year ? '(Active Academic Year)' : yr > (activeYear?.year || 2026) ? '(Future Year)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Intake Term */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Intake Term <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={intakeTerm}
                      disabled={isSaving}
                      onChange={(e) => setIntakeTerm(e.target.value as TermName)}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none font-medium disabled:opacity-60"
                    >
                      {(['Term 1', 'Term 2', 'Term 3'] as TermName[]).map((t) => (
                        <option key={t} value={t}>
                          {t} {t === activeTerm?.term_name && intakeYear === (activeYear?.year || 2026) ? '(Current Active Term)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Admission Date (Effective Start Date for Active Intake) */}
                  {!isIntakePeriodFuture(intakeYear, intakeTerm, activeYear?.year, activeTerm?.term_name) && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        Admission Date <span className="text-slate-400 font-normal">(Effective Start)</span>
                      </label>
                      <input
                        type="date"
                        disabled={isSaving}
                        value={admissionDate}
                        onChange={(e) => setAdmissionDate(e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-lg px-3 py-2 focus:ring-1.5 focus:ring-[#176B45] focus:outline-none font-medium disabled:opacity-60"
                      />
                    </div>
                  )}

                  {/* Curriculum Level (derived) */}
                  <div className={!isIntakePeriodFuture(intakeYear, intakeTerm, activeYear?.year, activeTerm?.term_name) ? "col-span-1" : "col-span-1 sm:col-span-2"}>
                    <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Curriculum Level
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={
                        addClassName
                          ? (getEducationLevelForGrade(addClassName) || addLevel)
                          : addLevel || 'Auto-established from class selection'
                      }
                      className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-xs sm:text-sm rounded-lg px-3 py-2 font-medium cursor-not-allowed"
                    />
                  </div>

                  {/* Future Intake Lifecycle Notice */}
                  {isIntakePeriodFuture(intakeYear, intakeTerm, activeYear?.year, activeTerm?.term_name) && (
                    <div className="col-span-1 sm:col-span-2 lg:col-span-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <strong className="font-semibold">Future Intake Scheduled: </strong>
                        This learner will be registered with <span className="font-semibold font-mono">Enrolment Status: Future</span> for {intakeYear} {intakeTerm}. They will not appear in current operational mark-entry rosters or merit calculations until admitted.
                      </div>
                    </div>
                  )}

                  {/* Mid-Term Admission Lifecycle Notice */}
                  {!isIntakePeriodFuture(intakeYear, intakeTerm, activeYear?.year, activeTerm?.term_name) &&
                    isMidTermAdmission(intakeYear, intakeTerm, admissionDate, activeYear?.year, activeTerm?.term_name, activeTerm?.opening_date) && (
                      <div className="col-span-1 sm:col-span-2 lg:col-span-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <strong className="font-semibold">Mid-Term Admission: </strong>
                          This learner is admitted mid-term with <span className="font-semibold font-mono">Enrolment Status: Active</span>. Academic participation and mark entries begin from their admission date ({admissionDate || 'effective today'}) without manufacturing retrospective marks or historical reports.
                        </div>
                      </div>
                  )}
                </div>

                {/* ACTION BUTTONS */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setFirstName('');
                      setSecondName('');
                      setLastName('');
                      setAdmNo('');
                      setAddLevel('');
                      setAddClassName('');
                      setAddStream('');
                      setClassId('');
                      setAddFormError(null);
                      setActiveTab('list');
                    }}
                    className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 text-xs sm:text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-[#176B45] hover:bg-[#0F5132] text-white font-bold rounded-lg shadow-sm transition disabled:opacity-60 flex items-center space-x-1.5 text-xs sm:text-sm"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving Learner...</span>
                      </>
                    ) : (
                      <span>Save Learner</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* RECENT REGISTRATIONS (SECONDARY & FULL-WIDTH ALIGNED) */}
            <div className="bg-white/90 dark:bg-slate-900/90 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                    Recent Registrations
                  </h3>
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {recentStudents.length > 0 ? `${recentStudents.length} learner${recentStudents.length > 1 ? 's' : ''}` : '0 learners'}
                </span>
              </div>

              {recentStudents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                  {recentStudents.map((std) => {
                    const cls = classes.find(
                      (c) =>
                        c.id === std.class_id ||
                        c.stream_id === std.class_id ||
                        (c.class_name && std.class_id && c.class_name === std.class_id) ||
                        (`${c.class_name || ''} ${c.stream || ''}`.trim().toLowerCase() === String(std.class_id || '').trim().toLowerCase())
                    );
                    return (
                      <div key={std.id} className="p-3 bg-slate-50/80 dark:bg-slate-800/60 rounded-lg border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between text-xs gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs bg-slate-200/70 dark:bg-slate-700/80 px-2 py-0.5 rounded border border-slate-300/50 dark:border-slate-600/50">
                              {std.admission_number}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {getStudentFullName(std)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <span>{cls ? `${cls.class_name} ${cls.stream}` : (std.class_id ? normalizeGradeName(std.class_id) : 'Unassigned')}</span>
                            <span>•</span>
                            <span>{std.gender === 'F' ? 'Female' : 'Male'}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{std.active ? 'Active' : 'Registered'}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  <p>No recent registrations yet. Newly added learners will appear here.</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 3: CSV BATCH IMPORT MODULE */}
      {activeTab === 'csv' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm w-full space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Batch CSV Learner Import</span>
              </h2>
            </div>

            <button
              onClick={handleDownloadSampleCsv}
              disabled={isImporting}
              className="text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 border border-emerald-300 dark:border-emerald-700 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 hover:bg-emerald-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Download Sample CSV</span>
            </button>
          </div>

          {/* Filters for Destination Class & Intake Session */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">1. Education Level</label>
              <select
                value={importEducationLevel}
                disabled={isImporting}
                onChange={(e) => {
                  setImportEducationLevel(e.target.value);
                  setImportClassName('');
                  setImportStream('');
                }}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select Level...</option>
                {ALL_EDUCATION_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            
            {importEducationLevel && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">2. Class</label>
                <select
                  value={importClassName}
                  disabled={isImporting}
                  onChange={(e) => {
                    setImportClassName(e.target.value);
                    setImportStream('');
                  }}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Class...</option>
                  {sortGrades(Array.from(new Set(
                    classes.filter(c => c.education_level === importEducationLevel || getEducationLevelForGrade(c.class_name) === importEducationLevel)
                           .map(c => c.class_name)
                  ))).map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
            )}
            
            {importClassName && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">3. Stream</label>
                <select
                  value={importStream}
                  disabled={isImporting}
                  onChange={(e) => setImportStream(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select Stream...</option>
                  {classes.filter(c => c.class_name === importClassName && c.stream).map(c => c.stream).filter((v, i, a) => a.indexOf(v) === i).map(stream => (
                    <option key={stream} value={stream}>{stream}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">4. Intake Year</label>
              <select
                value={importIntakeYear}
                disabled={isImporting}
                onChange={(e) => setImportIntakeYear(Number(e.target.value))}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr} {yr === activeYear?.year ? '(Active)' : yr > (activeYear?.year || 2026) ? '(Future)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">5. Intake Term</label>
              <select
                value={importIntakeTerm}
                disabled={isImporting}
                onChange={(e) => setImportIntakeTerm(e.target.value as TermName)}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {(['Term 1', 'Term 2', 'Term 3'] as TermName[]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Input Method Toggle: Upload File vs Paste Raw CSV */}
          <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => {
                setCsvInputMethod('file');
                setCsvError(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                csvInputMethod === 'file'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV / Text File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCsvInputMethod('paste');
                setCsvError(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                csvInputMethod === 'paste'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              <span>Paste CSV Data (Mobile Friendly)</span>
            </button>
          </div>

          {/* Mode 1: File Upload Drop Area */}
          {csvInputMethod === 'file' && (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-600 dark:hover:border-emerald-500 rounded-xl p-6 sm:p-8 text-center bg-slate-50 dark:bg-slate-800/40 hover:bg-emerald-50/40 dark:hover:bg-slate-800/80 transition cursor-pointer relative">
              <input
                type="file"
                accept=".csv,text/csv,text/plain,text/x-csv,application/vnd.ms-excel,application/csv,text/comma-separated-values,application/octet-stream,text/*"
                disabled={isImporting}
                onChange={handleCsvFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Upload className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {csvFile ? csvFile.name : 'Click or Drag & Drop CSV File Here'}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 max-w-lg mx-auto leading-relaxed">
                Supported columns: <span className="font-mono font-medium text-slate-700 dark:text-slate-200">First Name, Second Name, Last Name (or Full Name), Admission Number, Gender, Stream (Optional)</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Supports <span className="font-semibold">.csv</span>, <span className="font-semibold">.txt</span> and phone document manager files.
              </p>
            </div>
          )}

          {/* Mode 2: Direct Paste CSV Area */}
          {csvInputMethod === 'paste' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Paste Raw CSV Rows / Tab-Separated Data:
                </label>
                {pastedCsvText && (
                  <button
                    type="button"
                    onClick={() => {
                      setPastedCsvText('');
                      setParsedRows([]);
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    Clear Text
                  </button>
                )}
              </div>
              <textarea
                value={pastedCsvText}
                onChange={(e) => handlePastedCsvChange(e.target.value)}
                placeholder={"Admission Number,First Name,Second Name,Last Name,Gender,Stream\nADM-2026-001,Faith,Kerubo,Mokaya,F,Blue\nADM-2026-002,Brian,Omondi,Otieno,M,Red"}
                rows={6}
                disabled={isImporting}
                className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                You can copy directly from WhatsApp, Excel mobile, or Google Sheets and paste here. Include a <span className="font-semibold">Stream</span> column to assign learners to specific streams automatically.
              </p>
            </div>
          )}

          {csvError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{csvError}</span>
            </div>
          )}

          {csvWarning && !csvError && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{csvWarning}</span>
            </div>
          )}

          {csvSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{csvSuccess}</span>
            </div>
          )}

          {/* Parsed CSV Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Preview ({parsedRows.length} rows parsed)
                </span>
                <button
                  onClick={handleProcessCsvImport}
                  disabled={isImporting}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition flex items-center space-x-2"
                >
                  {isImporting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Importing Learners...</span>
                    </>
                  ) : (
                    <span>Import All {parsedRows.length} Learners</span>
                  )}
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="p-2.5">No.</th>
                      <th className="p-2.5">Adm No</th>
                      <th className="p-2.5">Full Name</th>
                      <th className="p-2.5">Gender</th>
                      <th className="p-2.5">Assigned Stream</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedRows.map((r, i) => {
                      const adm = r['Admission Number'] || r['admission_number'] || r['Adm No'] || r['ADM NO'] || '-';
                      const fName = (r['First Name'] || r['first_name'] || r['FirstName'] || '').trim();
                      const sName = (r['Second Name'] || r['second_name'] || r['SecondName'] || r['Middle Name'] || r['middle_name'] || '').trim();
                      const lName = (r['Last Name'] || r['last_name'] || r['LastName'] || r['Surname'] || r['surname'] || '').trim();
                      const combined = [fName, sName, lName].filter(Boolean).join(' ');
                      const resolvedName = r['Full Name'] || r['full_name'] || r['Name'] || r['student_name'] || combined || '-';
                      const gender = r['Gender'] || r['gender'] || 'M';
                      const rowStream = (r['Stream'] || r['stream'] || r['Stream Name'] || '').trim() || importStream || '-';

                      return (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 text-slate-400 dark:text-slate-500">{i + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-blue-700 dark:text-blue-400">
                            {adm}
                          </td>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                            {resolvedName}
                          </td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300">{gender}</td>
                          <td className="p-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {rowStream}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDITING MODAL */}
      {editingStudent && (() => {
        const selectedOptionClass =
          (editingStudent.stream_id &&
            classes.find((c) => (c.stream_id || c.id) === editingStudent.stream_id)) ||
          classes.find(
            (c) => c.id === editingStudent.class_id || (c.stream_id && c.stream_id === editingStudent.class_id)
          );

        const currentStreamValue = selectedOptionClass
          ? (selectedOptionClass.stream_id || selectedOptionClass.id)
          : (editingStudent.stream_id || editingStudent.class_id);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Edit Learner Profile</h3>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setEditingStudent(null)}
                  className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                {editFormError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                    <span>{editFormError}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      disabled={isSaving}
                      value={editingStudent.first_name || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, first_name: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Second Name</label>
                    <input
                      type="text"
                      disabled={isSaving}
                      value={editingStudent.second_name || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, second_name: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      disabled={isSaving}
                      value={editingStudent.last_name || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, last_name: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Admission Number *</label>
                  <input
                    type="text"
                    required
                    disabled={isSaving}
                    value={editingStudent.admission_number}
                    onChange={(e) => setEditingStudent({ ...editingStudent, admission_number: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                    <select
                      disabled={isSaving}
                      value={editingStudent.gender}
                      onChange={(e) =>
                        setEditingStudent({ ...editingStudent, gender: e.target.value as 'M' | 'F' })
                      }
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Class & Stream</label>
                    <select
                      disabled={isSaving}
                      value={currentStreamValue}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        const targetCls = classes.find(
                          (c) => (c.stream_id || c.id) === selectedVal || c.id === selectedVal
                        );
                        if (targetCls) {
                          const derivedGrade = targetCls.class_name as GradeName;
                          const derivedLevel = targetCls.education_level || (derivedGrade ? getEducationLevelForGrade(derivedGrade) : editingStudent.education_level);
                          setEditingStudent({
                            ...editingStudent,
                            class_id: targetCls.id,
                            stream_id: targetCls.stream_id || targetCls.id,
                            grade: derivedGrade,
                            education_level: derivedLevel,
                          });
                        }
                      }}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    >
                      {sortClasses(classes).map((cls) => (
                        <option key={cls.stream_id || `${cls.id}_${cls.stream}`} value={cls.stream_id || cls.id}>
                          {cls.class_name} {cls.stream}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Learner Status</label>
                    <select
                      disabled={isSaving}
                      value={editingStudent.active ? 'active' : 'inactive'}
                      onChange={(e) => setEditingStudent({ ...editingStudent, active: e.target.value === 'active' })}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    >
                      <option value="active">Active Learner</option>
                      <option value="inactive">Transferred / Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Admission Date</label>
                    <input
                      type="date"
                      disabled={isSaving}
                      value={editAdmissionDate}
                      onChange={(e) => setEditAdmissionDate(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setEditingStudent(null)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-[#176B45] hover:bg-[#0F5132] text-white font-bold rounded-lg shadow-sm transition disabled:opacity-60 flex items-center justify-center space-x-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* TRANSFER MODAL */}
      {transferringStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <ArrowRightLeft className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>Transfer Learner</span>
              </h3>
              <button
                onClick={() => setTransferringStudent(null)}
                className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/60 rounded-lg border border-purple-100 dark:border-purple-800">
                <div className="font-bold text-slate-900 dark:text-slate-100">{transferringStudent.full_name}</div>
                <div className="text-[11px] text-purple-700 dark:text-purple-300 font-mono">
                  {transferringStudent.admission_number}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Class & Stream
                </label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                >
                  {sortClasses(classes).map((cls) => (
                    <option key={cls.stream_id || `${cls.id}_${cls.stream}`} value={cls.stream_id || cls.id}>
                      {cls.class_name} {cls.stream}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Learner Status</label>
                <select
                  value={targetStatus ? 'active' : 'inactive'}
                  onChange={(e) => setTargetStatus(e.target.value === 'active')}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                >
                  <option value="active">Active Learner</option>
                  <option value="inactive">Transferred / Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferringStudent(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-sm"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE LEARNER CONFIRMATION MODAL */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            id="delete-learner-modal"
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full text-xs space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/80">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Permanently Delete Learner
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Database removal and account de-provisioning
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-delete-learner-modal-btn"
                onClick={() => {
                  if (!isDeleting) {
                    setDeletingStudent(null);
                    setDeleteError(null);
                  }
                }}
                disabled={isDeleting}
                className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Full Name</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{deletingStudent.full_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Admission No.</span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{deletingStudent.admission_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Enrolment Status</span>
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {deletingStudent.active ? 'Active Learner' : 'Inactive / Transferred'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 flex items-start space-x-2 text-[11px] leading-relaxed">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-bold">Permanent Deletion:</span> This action permanently deletes the learner from the database and removes their associated learner portal login account.
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{deleteError}</div>
              </div>
            )}

            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                id="cancel-delete-learner-btn"
                onClick={() => {
                  setDeletingStudent(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-learner-btn"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Learner...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIT LEARNER CONFIRMATION MODAL */}
      {admittingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            id="admit-learner-modal"
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full text-xs space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/80">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Admit Learner to Active Roster
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Transition future enrolment to active status
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-admit-learner-modal-btn"
                onClick={() => {
                  if (!isAdmitting) {
                    setAdmittingStudent(null);
                    setAdmitError(null);
                  }
                }}
                disabled={isAdmitting}
                className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Full Name</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{admittingStudent.full_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Admission No.</span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{admittingStudent.admission_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Intake Period</span>
                <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                  {admittingStudent.intake_year || 'Current Year'} {admittingStudent.intake_term || ''}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Admitting this learner will transition their enrolment standing to <strong>Active</strong>, enable authentication credentials, and include them in current operational class rosters and score sheets.
            </p>

            {admitError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{admitError}</div>
              </div>
            )}

            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                id="cancel-admit-learner-btn"
                onClick={() => {
                  setAdmittingStudent(null);
                  setAdmitError(null);
                }}
                disabled={isAdmitting}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-admit-learner-btn"
                onClick={handleConfirmAdmit}
                disabled={isAdmitting}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-2 cursor-pointer"
              >
                {isAdmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Admitting Learner...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Admit to Active</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
