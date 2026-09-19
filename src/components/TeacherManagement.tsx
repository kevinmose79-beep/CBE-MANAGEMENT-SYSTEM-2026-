import React, { useState } from 'react';
import {
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  BookOpen,
  Building2,
  Phone,
  Mail,
  X,
  Search,
  User as UserIcon,
  ShieldAlert,
  CheckCircle2,
  Ban,
  Lock,
  KeyRound,
  Eye,
  History,
  Shield,
  Clock,
  Laptop,
  Globe,
  AlertCircle,
  Unlock,
  Sparkles,
  Layers,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Teacher, Subject, ClassStream, AccountStatus, Role, LoginLog, TeacherAllocation, EducationLevel, ALL_EDUCATION_LEVELS, sortGrades, sortClasses, canonicalizeRole, getEducationLevelForGrade, getApplicableSubjectsForGrade, LEVEL_TO_GRADES } from '../types';
import { authService } from '../services/authService';
import { api, getSupabaseClient, isUUID } from '../lib/storage';
import { useNotification } from '../contexts/NotificationContext';

interface TeacherManagementProps {
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassStream[];
  onAddTeacher: (teacher: Teacher, authUserId?: string) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void | Promise<void>;
}

const isClassStreamAllocatedToTeacher = (c: ClassStream, tch: Teacher): boolean => {
  if (c.class_teacher_id && c.class_teacher_id === tch.id) return true;
  if (tch.is_class_teacher && tch.class_teacher_of_id && c.stream_id && tch.class_teacher_of_id === c.stream_id) return true;
  if (!tch.allocations || tch.allocations.length === 0) return false;
  return tch.allocations.some((a) => {
    if (a.stream_id || a.stream) {
      if (a.stream_id && (a.stream_id === c.stream_id || a.stream_id === c.id)) return true;
      if (a.stream && c.stream) {
        const gradeMatches = (a.class_name && c.class_name && a.class_name.toLowerCase() === c.class_name.toLowerCase()) ||
                             (a.class_id && (a.class_id === c.id || (c.stream_id && a.class_id === c.stream_id)));
        return Boolean(gradeMatches && a.stream.trim().toLowerCase() === c.stream.trim().toLowerCase());
      }
      return false;
    }
    if (a.class_id && (a.class_id === c.id || (c.stream_id && a.class_id === c.stream_id))) return true;
    if (a.class_name && c.class_name && a.class_name.toLowerCase() === c.class_name.toLowerCase()) return true;
    return false;
  });
};

export const TeacherManagement: React.FC<TeacherManagementProps> = ({
  teachers = [],
  subjects = [],
  classes = [],
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
}) => {
  const { showNotification } = useNotification();
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);
  const [resetPasswordTeacher, setResetPasswordTeacher] = useState<Teacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [detailTab, setDetailTab] = useState<'profile' | 'allocations' | 'logs'>('profile');
  const [expandedTeacherIds, setExpandedTeacherIds] = useState<Record<string, boolean>>({});

  const toggleTeacherExpand = (id: string) => {
    setExpandedTeacherIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // New Account Creation Form State
  const [createRole, setCreateRole] = useState<Role>('class_teacher');
  const [name, setName] = useState('');
  const [tscNumber, setTscNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<AccountStatus>('Active');
  const [tempPassword, setTempPassword] = useState('Teacher@2026');
  const [confirmTempPassword, setConfirmTempPassword] = useState('Teacher@2026');
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [allocations, setAllocations] = useState<TeacherAllocation[]>([]);
  const [allocEduLevel, setAllocEduLevel] = useState<EducationLevel | ''>('');
  const [allocClassLevel, setAllocClassLevel] = useState<string>('');
  const [allocStreamId, setAllocStreamId] = useState<string>('');
  const [allocSubjectId, setAllocSubjectId] = useState<string>('');

  const [assignedEduLevel, setAssignedEduLevel] = useState<EducationLevel | ''>('');
  const [assignedClassLevel, setAssignedClassLevel] = useState<string>('');
  const [assignedStreamId, setAssignedStreamId] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Password State
  const [newResetPassword, setNewResetPassword] = useState('Teacher@2026');
  const [confirmResetPassword, setConfirmResetPassword] = useState('Teacher@2026');
  const [resetForceChange, setResetForceChange] = useState(true);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Edit Teacher Form State
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTscNumber, setEditTscNumber] = useState('');
  const [editStatus, setEditStatus] = useState<AccountStatus>('Active');

  // Edit Teacher Class Teacher Assignment State
  const [editClassEduLevel, setEditClassEduLevel] = useState<EducationLevel | ''>('');
  const [editClassGrade, setEditClassGrade] = useState<string>('');
  const [editClassStreamId, setEditClassStreamId] = useState<string>('');

  // Edit Teacher Allocations State
  const [editAllocations, setEditAllocations] = useState<TeacherAllocation[]>([]);
  const [editAddEduLevel, setEditAddEduLevel] = useState<EducationLevel | ''>('');
  const [editAddGrade, setEditAddGrade] = useState<string>('');
  const [editAddStreamId, setEditAddStreamId] = useState<string>('');
  const [editAddSubjectId, setEditAddSubjectId] = useState<string>('');

  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editFormSuccess, setEditFormSuccess] = useState<string | null>(null);
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [isLoadingTeacherData, setIsLoadingTeacherData] = useState(false);

  const handleAddAllocation = () => {
    if (!allocEduLevel || !allocStreamId || !allocSubjectId) {
      setFormError('Please select Education Level, Class, Stream, and Learning Area.');
      return;
    }
    const selectedClassObj = classes.find(c => c.stream_id === allocStreamId || c.id === allocStreamId);
    const selectedSubjectObj = subjects.find(s => s.id === allocSubjectId);

    const isDuplicate = allocations.some(
      (a) => (a.stream_id === allocStreamId || a.class_id === allocStreamId || (selectedClassObj && a.class_id === selectedClassObj.id && (a.stream_id === selectedClassObj.stream_id || !a.stream_id))) && a.subject_id === allocSubjectId
    );
    if (isDuplicate) {
      setFormError('This Learning Area allocation (Class, Stream & Subject) is already assigned to this teacher.');
      return;
    }

    const newAlloc: TeacherAllocation = {
      id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      education_level: allocEduLevel,
      class_id: selectedClassObj?.id || allocStreamId,
      stream_id: selectedClassObj?.stream_id || allocStreamId,
      class_name: selectedClassObj?.class_name || allocClassLevel,
      stream: selectedClassObj?.stream,
      subject_id: allocSubjectId,
      subject_name: selectedSubjectObj?.subject_name,
      subject_code: selectedSubjectObj?.subject_code,
    };
    setAllocations([...allocations, newAlloc]);
    setAllocClassLevel('');
    setAllocStreamId('');
    setAllocSubjectId('');
    setFormError(null);
  };

  const removeAllocation = (allocId: string) => {
    setAllocations(allocations.filter((a) => a.id !== allocId));
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!name.trim() || !email.trim()) {
      setFormError('Full Name and Email Address are required.');
      return;
    }

    if (!tempPassword || tempPassword.length < 6) {
      setFormError('Temporary password must be at least 6 characters.');
      return;
    }

    if (tempPassword !== confirmTempPassword) {
      setFormError('Temporary password and confirmation password do not match.');
      return;
    }

    let finalAllocations: TeacherAllocation[] = [];
    let classTeacherOfId: string | undefined = undefined;

    if (createRole === 'class_teacher') {
      if (!assignedStreamId) {
        setFormError('Assigned Class (Education Level, Class, Stream) is required for Class Teachers.');
        return;
      }
      classTeacherOfId = assignedStreamId;

      if (assignedEduLevel === 'Pre-Primary' || assignedEduLevel === 'Lower Primary') {
        const levelGrades = LEVEL_TO_GRADES[assignedEduLevel] || [];
        const levelSubjects = subjects.filter(
          (s) =>
            s.status !== 'Archived' &&
            (s.applicable_grades && s.applicable_grades.length > 0
              ? s.applicable_grades.some((g) => levelGrades.includes(g) || getEducationLevelForGrade(g) === assignedEduLevel)
              : s.education_level === assignedEduLevel || !s.education_level)
        );
        const assignedClassObj = classes.find(c => c.stream_id === assignedStreamId);
        finalAllocations = levelSubjects.map((s) => ({
          id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          education_level: assignedEduLevel,
          class_id: assignedClassObj?.id || assignedStreamId,
          stream_id: assignedClassObj?.stream_id || assignedStreamId,
          class_name: assignedClassObj?.class_name || assignedClassLevel,
          stream: assignedClassObj?.stream,
          subject_id: s.id,
          subject_name: s.subject_name,
          subject_code: s.subject_code,
        }));
      } else {
        finalAllocations = [...allocations];
      }
    } else if (createRole === 'subject_teacher') {
      if (allocations.length === 0) {
        setFormError('Subject Teachers must have at least one Teaching Allocation.');
        return;
      }
      finalAllocations = [...allocations];
    } else {
      finalAllocations = [];
    }

    setIsSubmitting(true);
    try {
      const canonicalRole = canonicalizeRole(createRole);
      const res = await authService.adminCreateAccount({
        role: canonicalRole,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || '',
        tsc_number: tscNumber.trim() || undefined,
        username: username.trim() || undefined,
        status,
        temporary_password: tempPassword,
        force_password_change: forcePasswordChange,
        allocations: finalAllocations,
        class_teacher_of_id: classTeacherOfId,
      });

      if (res.error) {
        console.error('Teacher account creation error detail:', res.error);
        if (typeof res.error === 'string' && res.error.includes('users_role_check')) {
          setFormError('Unable to create user profile due to an invalid role specification. Please re-select the User Role and try again.');
        } else if (typeof res.error === 'string' && (res.error.toLowerCase().includes('already registered') || res.error.toLowerCase().includes('already exists') || res.error.toLowerCase().includes('already been registered'))) {
          setFormError('A user account with this email address has already been registered. Please enter a different email address or edit the existing account.');
        } else {
          setFormError(res.error);
        }
      } else {
        const roleLabel = canonicalRole === 'admin' ? 'Administrator' : canonicalRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher';
        setFormSuccess(`Successfully created ${roleLabel} account for ${name.trim()}!`);
        if (res.teacher) {
          onAddTeacher(res.teacher, res.user?.id);
        }

        const teacherDisplayName = res.teacher?.teacher_name || name.trim();
        showNotification('success', `Teacher "${teacherDisplayName}" was created successfully.`);

        setTimeout(() => {
          setIsAddingModalOpen(false);
          resetCreateForm();
        }, 1200);
      }
    } catch (err: any) {
      console.error('Unexpected account creation error:', err);
      setFormError(err.message || 'An unexpected error occurred while creating the user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setCreateRole('class_teacher');
    setName('');
    setTscNumber('');
    setPhone('');
    setEmail('');
    setUsername('');
    setStatus('Active');
    setTempPassword('Teacher@2026');
    setConfirmTempPassword('Teacher@2026');
    setForcePasswordChange(true);
    setAllocations([]);
    setAllocEduLevel('Junior School');
    setAllocClassLevel('');
    setAllocStreamId('');
    setAllocSubjectId('');
    setAssignedEduLevel('Pre-Primary');
    setAssignedClassLevel('');
    setAssignedStreamId('');
    setFormError(null);
    setFormSuccess(null);
  };

  const openEditTeacherModal = async (tch: Teacher) => {
    setEditFormError(null);
    setEditFormSuccess(null);
    setIsLoadingTeacherData(true);

    // Profile fields
    const rawP = (tch.phone || '').trim();
    const isFakeP = !rawP || rawP === '+254 700 000 000' || rawP === '700000000' || rawP === '+254700000000' || rawP === '0700000000';
    setEditPhone(isFakeP ? '' : rawP);

    const rawT = (tch.tsc_number || '').trim();
    const isFakeT = !rawT || rawT === 'TSC-PENDING' || rawT === 'N/A';
    setEditTscNumber(isFakeT ? '' : rawT);

    setEditTeacherName(tch.teacher_name || '');
    setEditEmail(tch.email || '');
    setEditStatus(tch.status || 'Active');
    setEditAllocations(tch.allocations ? [...tch.allocations] : []);

    // Find assigned class teacher stream
    const matchedStream = classes.find(
      (c) =>
        c.class_teacher_id === tch.id ||
        (tch.class_teacher_of_id && c.stream_id && c.stream_id === tch.class_teacher_of_id)
    );

    if (matchedStream && matchedStream.stream_id) {
      setEditClassStreamId(matchedStream.stream_id);
      setEditClassGrade(matchedStream.class_name);
      setEditClassEduLevel(matchedStream.education_level || getEducationLevelForGrade(matchedStream.class_name));
    } else {
      setEditClassStreamId('');
      setEditClassGrade('');
      setEditClassEduLevel('');
    }

    // Reset add allocation form
    setEditAddEduLevel('');
    setEditAddGrade('');
    setEditAddStreamId('');
    setEditAddSubjectId('');

    setEditingTeacher(tch);

    // Fetch fresh database state from Supabase if connected (Section 7 Data Loading)
    const client = getSupabaseClient();
    if (client) {
      try {
        let dbTch: any = null;
        let effectiveTeacherId: string | null = isUUID(tch.id) ? tch.id : null;

        if (effectiveTeacherId) {
          const res = await client.from('teachers').select('*').eq('id', effectiveTeacherId).maybeSingle();
          dbTch = res.data;
        } else if (tch.email) {
          const res = await client.from('teachers').select('*').eq('email', tch.email.trim().toLowerCase()).maybeSingle();
          dbTch = res.data;
          if (dbTch && isUUID(dbTch.id)) {
            effectiveTeacherId = dbTch.id;
          }
        }

        let dbAllocations: any = null;
        let dbStreams: any = null;

        if (effectiveTeacherId && isUUID(effectiveTeacherId)) {
          const allocRes = await client.from('teacher_subjects').select('*').eq('teacher_id', effectiveTeacherId);
          dbAllocations = allocRes.data;
          const streamRes = await client.from('streams').select('*').eq('class_teacher_id', effectiveTeacherId);
          dbStreams = streamRes.data;
        }

        if (dbTch) {
          setEditTeacherName(dbTch.teacher_name || tch.teacher_name);
          setEditEmail(dbTch.email || tch.email);
          const dbP = (dbTch.phone || tch.phone || '').trim();
          const isDbFakeP = !dbP || dbP === '+254 700 000 000' || dbP === '700000000' || dbP === '+254700000000' || dbP === '0700000000';
          setEditPhone(isDbFakeP ? '' : dbP);

          const dbT = (dbTch.tsc_number || tch.tsc_number || '').trim();
          const isDbFakeT = !dbT || dbT === 'TSC-PENDING' || dbT === 'N/A';
          setEditTscNumber(isDbFakeT ? '' : dbT);

          setEditStatus(dbTch.status || tch.status || 'Active');
        }

        let freshStreamId = (matchedStream && matchedStream.stream_id) ? matchedStream.stream_id : '';
        if (dbStreams && dbStreams.length > 0 && dbStreams[0].id) {
          freshStreamId = dbStreams[0].id;
        } else if (dbTch?.class_teacher_of_id) {
          freshStreamId = dbTch.class_teacher_of_id;
        }

        if (freshStreamId) {
          const freshCls = classes.find(
            (c) => c.stream_id && c.stream_id === freshStreamId
          );
          if (freshCls && freshCls.stream_id) {
            setEditClassStreamId(freshCls.stream_id);
            setEditClassGrade(freshCls.class_name);
            setEditClassEduLevel(freshCls.education_level || getEducationLevelForGrade(freshCls.class_name));
          }
        } else if (!matchedStream) {
          setEditClassStreamId('');
          setEditClassGrade('');
          setEditClassEduLevel('');
        }

        if (dbAllocations && dbAllocations.length > 0) {
          const freshAllocations: TeacherAllocation[] = dbAllocations.map((ts: any) => {
            const matchedCls = (ts.stream_id ? classes.find((c) => c.stream_id === ts.stream_id || c.id === ts.stream_id) : undefined) ||
                               classes.find((c) => c.id === ts.class_id);
            const matchedSub = subjects.find((s) => s.id === ts.subject_id);
            return {
              id: ts.id,
              class_id: ts.class_id || (matchedCls ? matchedCls.id : ts.stream_id),
              stream_id: ts.stream_id || (matchedCls ? matchedCls.stream_id : undefined),
              subject_id: ts.subject_id,
              class_name: matchedCls?.class_name,
              stream: matchedCls?.stream,
              subject_name: matchedSub?.subject_name,
              subject_code: matchedSub?.subject_code,
              education_level: matchedCls?.education_level || (matchedCls ? getEducationLevelForGrade(matchedCls.class_name) : 'Upper Primary'),
            };
          });
          setEditAllocations(freshAllocations);
        }
      } catch (err) {
        console.warn('Could not fetch fresh teacher state from Supabase:', err);
      }
    }

    setIsLoadingTeacherData(false);
  };

  const handleEditAddAllocation = () => {
    setEditFormError(null);
    if (!editAddEduLevel || !editAddStreamId || !editAddSubjectId) {
      setEditFormError('Please select Education Level, Class, Stream, and Learning Area.');
      return;
    }

    const selectedClassObj = classes.find((c) => c.stream_id === editAddStreamId || c.id === editAddStreamId);
    const selectedSubjectObj = subjects.find((s) => s.id === editAddSubjectId);

    // Check duplicate allocation
    const isDuplicate = editAllocations.some(
      (a) => (a.stream_id === editAddStreamId || a.class_id === editAddStreamId || (selectedClassObj && a.class_id === selectedClassObj.id && (a.stream_id === selectedClassObj.stream_id || !a.stream_id))) && a.subject_id === editAddSubjectId
    );
    if (isDuplicate) {
      setEditFormError('This Learning Area allocation (Class, Stream & Subject) is already assigned to this teacher.');
      return;
    }

    const newAlloc: TeacherAllocation = {
      id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      education_level: editAddEduLevel,
      class_id: selectedClassObj?.id || editAddStreamId,
      stream_id: selectedClassObj?.stream_id || editAddStreamId,
      class_name: selectedClassObj?.class_name || editAddGrade,
      stream: selectedClassObj?.stream,
      subject_id: editAddSubjectId,
      subject_name: selectedSubjectObj?.subject_name,
      subject_code: selectedSubjectObj?.subject_code,
    };

    setEditAllocations([...editAllocations, newAlloc]);
    setEditAddGrade('');
    setEditAddStreamId('');
    setEditAddSubjectId('');
    setEditFormError(null);
  };

  const handleEditRemoveAllocation = (allocId: string) => {
    setEditAllocations(editAllocations.filter((a) => a.id !== allocId));
  };

  const handleSaveEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    setEditFormError(null);
    setEditFormSuccess(null);

    if (!editTeacherName.trim() || !editEmail.trim()) {
      setEditFormError('Full Name and Email address are required.');
      return;
    }

    const isClassTeacher = Boolean(editClassStreamId);

    const updatedTeacher: Teacher = {
      ...editingTeacher,
      teacher_name: editTeacherName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      tsc_number: editTscNumber.trim() || undefined,
      status: editStatus,
      is_class_teacher: isClassTeacher,
      class_teacher_of_id: isClassTeacher ? editClassStreamId : undefined,
      allocations: editAllocations,
    };

    setIsSavingTeacher(true);
    try {
      await onUpdateTeacher(updatedTeacher);
      authService.adminUpdateAccountStatus(editEmail.trim(), editStatus);

      const teacherDisplayName = updatedTeacher.teacher_name || editingTeacher.teacher_name || 'Teacher';
      showNotification('success', `Teacher details for "${teacherDisplayName}" updated successfully.`);

      setEditFormSuccess('Teacher record updated successfully!');
      setTimeout(() => {
        setEditingTeacher(null);
        setEditFormSuccess(null);
        setEditFormError(null);
      }, 800);
    } catch (err: any) {
      console.error('Failed updating teacher record:', err);
      setEditFormError(err.message || 'Failed to save changes.');
    } finally {
      setIsSavingTeacher(false);
    }
  };

  const handleStatusChange = async (tch: Teacher, newStatus: AccountStatus) => {
    const updated = { ...tch, status: newStatus };
    try {
      await onUpdateTeacher(updated);
      authService.adminUpdateAccountStatus(tch.email, newStatus);
      if (viewingTeacher && viewingTeacher.id === tch.id) {
        setViewingTeacher(updated);
      }
    } catch (err: any) {
      console.error('Failed to update teacher status:', err);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTeacher) return;

    setResetError(null);
    setResetSuccess(null);

    if (newResetPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const currentUser = api.getCurrentUser();
      const res = await authService.adminResetPassword(
        resetPasswordTeacher.email,
        newResetPassword,
        resetForceChange,
        currentUser
      );
      if (res.error) {
        setResetError(res.error);
      } else {
        setResetSuccess(`Password successfully reset for ${resetPasswordTeacher.teacher_name}!`);
        onUpdateTeacher({
          ...resetPasswordTeacher,
          force_password_change: resetForceChange,
        });
        setTimeout(() => {
          setResetPasswordTeacher(null);
          setResetError(null);
          setResetSuccess(null);
        }, 1200);
      }
    } catch (err: any) {
      setResetError(err?.message || 'Failed to reset password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingTeacher) {
      const deletedTeacherName = deletingTeacher.teacher_name || 'Teacher';
      setIsSubmitting(true);
      setDeleteError(null);
      try {
        await onDeleteTeacher(deletingTeacher.id);
        setDeletingTeacher(null);
        setDeleteSuccess(`${deletedTeacherName}'s account was deleted successfully.`);
        setTimeout(() => {
          setDeleteSuccess(null);
        }, 5000);
      } catch (err: any) {
        console.error('Failed to delete teacher:', err);
        setDeleteError(err?.message || 'Failed to delete teacher.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    if (!t) return false;
    const query = searchQuery.toLowerCase();
    const name = (t.teacher_name || '').toLowerCase();
    const email = (t.email || '').toLowerCase();
    const phone = (t.phone || '').toLowerCase();
    const tsc = (t.tsc_number || '').toLowerCase();
    const uname = (t.username || '').toLowerCase();

    const matchesQuery =
      name.includes(query) ||
      email.includes(query) ||
      phone.includes(query) ||
      tsc.includes(query) ||
      uname.includes(query);

    const matchesStatus =
      selectedStatusFilter === 'all'
        ? true
        : (t.status || 'Active') === selectedStatusFilter;

    return matchesQuery && matchesStatus;
  });

  const getStatusBadge = (st?: AccountStatus) => {
    const currentSt = st || 'Active';
    if (currentSt === 'Active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Active</span>
        </span>
      );
    }
    if (currentSt === 'Disabled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 shadow-2xs">
          <Ban className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>Disabled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
        <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Locked</span>
      </span>
    );
  };

  const currentViewingLogs: LoginLog[] = viewingTeacher
    ? api.getLoginLogs(viewingTeacher.email)
    : [];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 md:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs shrink-0">
            <UserCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Teachers & User Account Management
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetCreateForm();
            setIsAddingModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-[#075E42] hover:bg-[#054531] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer border border-[#054531]/30 self-start md:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create User Account</span>
        </button>
      </div>

      {/* SUCCESS NOTIFICATION TOAST/BANNER */}
      {deleteSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span>{deleteSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccess(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 p-1 rounded-lg transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, TSC or username..."
            className="w-full pl-9 pr-8 py-2 border border-slate-300/80 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded-md"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">Account Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="border border-slate-300/80 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none cursor-pointer transition-all shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Disabled">Disabled Only</option>
              <option value="Locked">Locked Only</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium pl-3 border-l border-slate-200/80 dark:border-slate-800 hidden md:block">
            Showing <strong className="text-slate-800 dark:text-slate-200 font-bold">{filteredTeachers.length}</strong> of <strong className="text-slate-800 dark:text-slate-200 font-bold">{teachers.length}</strong> accounts
          </div>
        </div>
      </div>

      {/* Mobile Teacher Cards View (Visible on < md) */}
      <div className="block md:hidden space-y-3.5">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200 font-bold">{filteredTeachers.length}</strong> of <strong className="text-slate-800 dark:text-slate-200 font-bold">{teachers.length}</strong> accounts
          </span>
        </div>

        {filteredTeachers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col items-center justify-center space-y-2">
              <UserCheck className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-slate-600 dark:text-slate-300">No teacher accounts found</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Try adjusting your search filters or create a new user account.
              </p>
            </div>
          </div>
        ) : (
          filteredTeachers.map((tch) => {
            const isExpanded = !!expandedTeacherIds[tch.id];
            const assignedClassesList = classes.filter((c) => isClassStreamAllocatedToTeacher(c, tch));
            const matchedSubjects = subjects.filter(
              (s) =>
                tch.allocations &&
                tch.allocations.some(
                  (a) => a.subject_id === s.id || (a.subject_code && a.subject_code === s.subject_code)
                )
            );
            const assignedSubjectsList =
              matchedSubjects.length > 0
                ? matchedSubjects
                : (tch.allocations || [])
                    .map((a) => {
                      const sb = subjects.find(
                        (s) => s.id === a.subject_id || (a.subject_code && s.subject_code === a.subject_code)
                      );
                      return {
                        id: a.subject_id || a.id,
                        subject_name: sb?.subject_name || a.subject_name || 'Subject',
                        subject_code: sb?.subject_code || a.subject_code || '',
                        category: sb?.category || 'Core',
                        learning_area: sb?.learning_area || '',
                      };
                    })
                    .filter((s) => s.subject_name);

            return (
              <div
                key={tch.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden transition-all p-4 space-y-3.5"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-sm border border-emerald-200/60 dark:border-emerald-800/60 shrink-0 shadow-2xs">
                      {tch.teacher_name ? tch.teacher_name.charAt(0).toUpperCase() : 'T'}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
                          {tch.teacher_name}
                        </h3>
                        {getStatusBadge(tch.status)}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                        {(() => {
                          const rawTsc = tch.tsc_number ? tch.tsc_number.trim() : '';
                          const isFakeTsc = !rawTsc || rawTsc === 'TSC-PENDING' || rawTsc === 'N/A';
                          return <span>TSC: {isFakeTsc ? 'Not provided' : rawTsc}</span>;
                        })()}
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="font-mono bg-slate-100/80 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] border border-slate-200/60 dark:border-slate-700">
                          @{tch.username || tch.email.split('@')[0]}
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleTeacherExpand(tch.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`teacher-card-details-${tch.id}`}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors shrink-0"
                    title={isExpanded ? 'Collapse extra details' : 'Expand extra details'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Contact Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium break-all">
                    <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span>{tch.email}</span>
                  </div>
                  {(() => {
                    const rawPhone = tch.phone ? tch.phone.trim() : '';
                    const isFakePhone = !rawPhone || rawPhone === '+254 700 000 000' || rawPhone === '700000000' || rawPhone === '+254700000000' || rawPhone === '0700000000';
                    return (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className={isFakePhone ? "text-slate-400 italic" : ""}>{isFakePhone ? 'Not provided' : rawPhone}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* All Assigned Classes & Streams (Spread Out) */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Assigned Classes & Streams
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {assignedClassesList.length === 0 ? (
                      <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Unassigned</span>
                    ) : (
                      assignedClassesList.map((c) => (
                        <span
                          key={c.stream_id || `${c.id}_${c.stream}`}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md text-xs font-semibold border border-slate-200/80 dark:border-slate-700 shadow-2xs"
                        >
                          {c.stream ? `${c.class_name} · ${c.stream}` : c.class_name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* All Assigned Learning Areas (Spread Out) */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Assigned Learning Areas
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {assignedSubjectsList.length === 0 ? (
                      <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Unassigned</span>
                    ) : (
                      assignedSubjectsList.map((s) => (
                        <span
                          key={s.id}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 shadow-2xs"
                        >
                          {s.subject_name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Quick Actions & Audit Bar */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {tch.last_login ? (
                        `Last login: ${new Date(tch.last_login).toLocaleDateString()}`
                      ) : (
                        'Never logged in'
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 gap-y-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setViewingTeacher(tch);
                        setDetailTab('profile');
                      }}
                      className="shrink-0 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-[#075E42] dark:hover:text-emerald-400 rounded-lg text-xs font-medium border border-slate-200/80 dark:border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditTeacherModal(tch)}
                      className="shrink-0 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium border border-slate-200/80 dark:border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setResetPasswordTeacher(tch);
                        setNewResetPassword('Teacher@2026');
                        setConfirmResetPassword('Teacher@2026');
                        setResetForceChange(true);
                        setResetError(null);
                        setResetSuccess(null);
                      }}
                      className="shrink-0 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 rounded-lg text-xs font-medium border border-slate-200/80 dark:border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                      <span>Reset</span>
                    </button>

                    {tch.status === 'Disabled' || tch.status === 'Locked' ? (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(tch, 'Active')}
                        className="shrink-0 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Enable</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(tch, 'Disabled')}
                        className="shrink-0 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-medium border border-amber-200 dark:border-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5 text-amber-600" />
                        <span>Disable</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeletingTeacher(tch)}
                      className="shrink-0 p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Collapsible Extra Logs/Details if expanded */}
                {isExpanded && (
                  <div
                    id={`teacher-card-details-${tch.id}`}
                    className="pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-xl space-y-2 text-xs"
                  >
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Full Account Logs & Details
                    </span>
                    <div className="text-slate-600 dark:text-slate-400 space-y-1">
                      <div>Account Username: <code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">@{tch.username || tch.email.split('@')[0]}</code></div>
                      <div>Force Password Change: {tch.force_password_change ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Teachers List Table (Desktop View, Visible on >= md) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="py-3.5 px-4">Teacher / Staff</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">TSC / Username</th>
                <th className="py-3.5 px-4">Classes & Streams</th>
                <th className="py-3.5 px-4">Learning Areas</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <UserCheck className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-medium text-slate-600 dark:text-slate-300">No teacher accounts found</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">Try adjusting your search filters or create a new user account.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((tch) => {
                  const assignedClassesList = classes.filter((c) => isClassStreamAllocatedToTeacher(c, tch));
                  const matchedSubjects = subjects.filter((s) =>
                    tch.allocations && tch.allocations.some(a => a.subject_id === s.id || (a.subject_code && a.subject_code === s.subject_code))
                  );
                  const assignedSubjectsList = matchedSubjects.length > 0
                    ? matchedSubjects
                    : (tch.allocations || []).map((a) => {
                        const sb = subjects.find((s) => s.id === a.subject_id || (a.subject_code && s.subject_code === a.subject_code));
                        return {
                          id: a.subject_id || a.id,
                          subject_name: sb?.subject_name || a.subject_name || 'Subject',
                          subject_code: sb?.subject_code || a.subject_code || '',
                          category: sb?.category || 'Core',
                          learning_area: sb?.learning_area || '',
                        };
                      }).filter((s) => s.subject_name);

                  return (
                    <tr key={tch.id} className="hover:bg-emerald-50/30 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Teacher Name & Identity */}
                      <td className="py-4 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs border border-emerald-200/60 dark:border-emerald-800/60 shrink-0 shadow-2xs">
                            {tch.teacher_name ? tch.teacher_name.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block tracking-tight">{tch.teacher_name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                        <div className="space-y-0.5">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" /> {tch.email}
                          </span>
                          {(() => {
                            const rawPhone = tch.phone ? tch.phone.trim() : '';
                            const isFakePhone = !rawPhone || rawPhone === '+254 700 000 000' || rawPhone === '700000000' || rawPhone === '+254700000000' || rawPhone === '0700000000';
                            return (
                              <span className={`text-[11px] flex items-center gap-1.5 ${isFakePhone ? 'text-slate-400 italic' : 'text-slate-500 dark:text-slate-400'}`}>
                                <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" /> {isFakePhone ? 'Not provided' : rawPhone}
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* TSC & Username */}
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                        <div className="space-y-1">
                          {(() => {
                            const rawTsc = tch.tsc_number ? tch.tsc_number.trim() : '';
                            const isFakeTsc = !rawTsc || rawTsc === 'TSC-PENDING' || rawTsc === 'N/A';
                            return (
                              <span className={`block text-xs ${isFakeTsc ? 'text-slate-400 italic' : 'font-semibold text-slate-800 dark:text-slate-200'}`}>
                                TSC: {isFakeTsc ? 'Not provided' : rawTsc}
                              </span>
                            );
                          })()}
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100/80 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700 inline-block">
                            @{tch.username || tch.email.split('@')[0]}
                          </span>
                        </div>
                      </td>

                      {/* Classes & Streams (Spread out, no max-w restriction) */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {assignedClassesList.length === 0 ? (
                            <span className="inline-flex items-center text-[11px] font-medium text-slate-400 dark:text-slate-500 italic bg-slate-100/80 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">
                              Unassigned
                            </span>
                          ) : (
                            assignedClassesList.map((c) => (
                              <span key={c.stream_id || `${c.id}_${c.stream}`} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold border border-slate-200/80 dark:border-slate-700">
                                {c.class_name} {c.stream}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Learning Areas (Spread out, full subject names) */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {assignedSubjectsList.length === 0 ? (
                            <span className="inline-flex items-center text-[11px] font-medium text-slate-400 dark:text-slate-500 italic bg-slate-100/80 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">
                              Unassigned
                            </span>
                          ) : (
                            assignedSubjectsList.map((s) => (
                              <span
                                key={s.id}
                                title={s.subject_name}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 inline-block"
                              >
                                {s.subject_name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(tch.status)}
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-xs">
                        {tch.last_login ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                            {new Date(tch.last_login).toLocaleDateString()} {new Date(tch.last_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" /> Never logged in
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* View Audit Logs & Profile */}
                          <button
                            type="button"
                            title="View Account Profile & Login History"
                            onClick={() => {
                              setViewingTeacher(tch);
                              setDetailTab('profile');
                            }}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-[#075E42] dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            title="Reset Password"
                            onClick={() => {
                              setResetPasswordTeacher(tch);
                              setNewResetPassword('Teacher@2026');
                              setConfirmResetPassword('Teacher@2026');
                              setResetForceChange(true);
                              setResetError(null);
                              setResetSuccess(null);
                            }}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Account Status Toggle */}
                          {tch.status === 'Disabled' ? (
                            <button
                              type="button"
                              title="Enable Account"
                              onClick={() => handleStatusChange(tch, 'Active')}
                              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : tch.status === 'Locked' ? (
                            <button
                              type="button"
                              title="Unlock Account"
                              onClick={() => handleStatusChange(tch, 'Active')}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Disable Account"
                              onClick={() => handleStatusChange(tch, 'Disabled')}
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Edit Teacher */}
                          <button
                            type="button"
                            title="Edit Teacher Record"
                            onClick={() => openEditTeacherModal(tch)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Account */}
                          <button
                            type="button"
                            title="Delete Account"
                            onClick={() => setDeletingTeacher(tch)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ACCOUNT MODAL */}
      {isAddingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Create New User Account</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Administrator creation of accounts.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddingModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300 font-medium">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  User Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateRole('class_teacher')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      createRole === 'class_teacher'
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 dark:border-emerald-600 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Class Teacher</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateRole('subject_teacher')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      createRole === 'subject_teacher'
                        ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-500 dark:border-amber-600 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Subject Teacher</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateRole('admin')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      createRole === 'admin'
                        ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 dark:border-blue-600 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Administrator</span>
                  </button>
                </div>
              </div>

              {/* Name & TSC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Madam Grace Wanjiku"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    TSC Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={tscNumber}
                    onChange={(e) => setTscNumber(e.target.value)}
                    placeholder="e.g. TSC-789012"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="grace.wanjiku@school.ac.ke"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 722 000 111"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Username & Account Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="gwanjiku"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AccountStatus)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option value="Active">Active (Can log in)</option>
                    <option value="Disabled">Disabled (Access denied)</option>
                    <option value="Locked">Locked (Locked by Admin)</option>
                  </select>
                </div>
              </div>

              {/* Temporary Password & Confirmation */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Temporary Password Credentials</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Temporary Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Teacher@2026"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm Temporary Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={confirmTempPassword}
                      onChange={(e) => setConfirmTempPassword(e.target.value)}
                      placeholder="Teacher@2026"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="forcePasswordChange"
                    checked={forcePasswordChange}
                    onChange={(e) => setForcePasswordChange(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                  />
                  <label htmlFor="forcePasswordChange" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Force password change on first login <span className="text-slate-400 font-normal">(Recommended)</span>
                  </label>
                </div>
              </div>

              {/* Assigned Class Selection (Class Teachers Only) */}
              {createRole === 'class_teacher' && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Assigned Class <span className="text-red-500">*</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Education Level</label>
                      <select
                        required
                        value={assignedEduLevel}
                        onChange={(e) => {
                          setAssignedEduLevel(e.target.value as EducationLevel);
                          setAssignedClassLevel('');
                          setAssignedStreamId('');
                        }}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">Select Level...</option>
                        {ALL_EDUCATION_LEVELS.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] font-semibold mb-1 ${!assignedEduLevel ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>Class</label>
                      <select
                        required
                        value={assignedClassLevel}
                        disabled={!assignedEduLevel}
                        onChange={(e) => {
                          setAssignedClassLevel(e.target.value);
                          setAssignedStreamId('');
                        }}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                      >
                        <option value="">{!assignedEduLevel ? 'Select Level First...' : 'Select Class...'}</option>
                        {assignedEduLevel && sortGrades(Array.from(new Set(classes.filter(c => (c.education_level || getEducationLevelForGrade(c.class_name)) === assignedEduLevel).map(c => c.class_name)))).map(cName => (
                          <option key={cName} value={cName}>{cName}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] font-semibold mb-1 ${!assignedClassLevel ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>Stream</label>
                      <select
                        required
                        value={assignedStreamId}
                        disabled={!assignedClassLevel}
                        onChange={(e) => setAssignedStreamId(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                      >
                        <option value="">{!assignedClassLevel ? 'Select Class First...' : 'Select Stream...'}</option>
                        {assignedClassLevel && sortClasses(classes.filter(c => c.class_name === assignedClassLevel && Boolean(c.stream_id))).map(c => (
                          <option key={c.stream_id} value={c.stream_id}>{c.class_name} - {c.stream}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Teaching Allocations Selection */}
              {((createRole === 'class_teacher' && (assignedEduLevel === 'Upper Primary' || assignedEduLevel === 'Junior School')) || createRole === 'subject_teacher') && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      {createRole === 'class_teacher' ? 'Additional Teaching Allocations' : 'Teaching Allocations'}
                    </label>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                      {allocations.length} Added
                    </span>
                  </div>

                  {allocations.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {allocations.map((alloc) => {
                        const cl = (alloc.stream_id ? classes.find(c => c.stream_id === alloc.stream_id || c.id === alloc.stream_id) : undefined) ||
                                   (alloc.stream ? classes.find(c => (c.class_name === alloc.class_name || c.id === alloc.class_id) && c.stream.toLowerCase() === alloc.stream.toLowerCase()) : undefined) ||
                                   classes.find(c => c.id === alloc.class_id);
                        const sb = subjects.find(s => s.id === alloc.subject_id);
                        return (
                          <div key={alloc.id} className="flex flex-row items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg shadow-sm">
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {cl ? `${cl.class_name} ${cl.stream}` : alloc.class_id} — {sb ? sb.subject_name : alloc.subject_id}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                {alloc.education_level}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAllocation(alloc.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-slate-700 p-1.5 rounded-md transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Level</label>
                      <select
                        value={allocEduLevel}
                        onChange={(e) => {
                          setAllocEduLevel(e.target.value as EducationLevel);
                          setAllocClassLevel('');
                          setAllocStreamId('');
                          setAllocSubjectId('');
                        }}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">Select Level...</option>
                        {ALL_EDUCATION_LEVELS.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] font-semibold mb-1 ${!allocEduLevel ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>Class</label>
                      <select
                        value={allocClassLevel}
                        disabled={!allocEduLevel}
                        onChange={(e) => {
                          setAllocClassLevel(e.target.value);
                          setAllocStreamId('');
                          setAllocSubjectId('');
                        }}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                      >
                        <option value="">{!allocEduLevel ? 'Select Level First...' : 'Select Class...'}</option>
                        {allocEduLevel && sortGrades(Array.from(new Set(classes.filter(c => (c.education_level || getEducationLevelForGrade(c.class_name)) === allocEduLevel).map(c => c.class_name)))).map(cName => (
                          <option key={cName} value={cName}>{cName}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] font-semibold mb-1 ${!allocClassLevel ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>Stream</label>
                      <select
                        value={allocStreamId}
                        disabled={!allocClassLevel}
                        onChange={(e) => setAllocStreamId(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                      >
                        <option value="">{!allocClassLevel ? 'Select Class First...' : 'Select Stream...'}</option>
                        {allocClassLevel && sortClasses(classes.filter(c => c.class_name === allocClassLevel && Boolean(c.stream_id))).map(c => (
                          <option key={c.stream_id} value={c.stream_id}>{c.class_name} - {c.stream}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] font-semibold mb-1 ${!allocClassLevel ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>Learning Area</label>
                      <select
                        value={allocSubjectId}
                        disabled={!allocClassLevel}
                        onChange={(e) => setAllocSubjectId(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                      >
                        <option value="">{!allocClassLevel ? 'Select Class First...' : 'Select Learning Area...'}</option>
                        {subjects
                          .filter((s) => s.status !== 'Archived')
                          .filter((s) => {
                            if (allocClassLevel) {
                              return getApplicableSubjectsForGrade(allocClassLevel, [s]).length > 0;
                            }
                            if (allocEduLevel) {
                              const levelGrades = LEVEL_TO_GRADES[allocEduLevel] || [];
                              if (s.applicable_grades && s.applicable_grades.length > 0) {
                                return s.applicable_grades.some((g) => levelGrades.includes(g) || getEducationLevelForGrade(g) === allocEduLevel);
                              }
                              return !s.education_level || s.education_level === allocEduLevel;
                            }
                            return true;
                          })
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.subject_name} {s.subject_code ? `(${s.subject_code})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddAllocation}
                    className="w-full mt-2 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg transition flex justify-center items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Allocation
                  </button>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEACHER MODAL */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Edit Teacher Record</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Manage teacher profile, class assignments, and teaching allocations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTeacher} className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Error & Success Messages */}
              {editFormError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{editFormError}</span>
                </div>
              )}
              {editFormSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{editFormSuccess}</span>
                </div>
              )}

              {isLoadingTeacherData ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs font-medium">Loading teacher database record...</p>
                </div>
              ) : (
                <>
                  {/* SECTION 1: Personal Information */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Personal Information</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={editTeacherName}
                          onChange={(e) => setEditTeacherName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Full Name"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address <span className="text-rose-500">*</span></label>
                        <input
                          type="email"
                          required
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="teacher@school.ac.ke"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="e.g. +254 712 345 678"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">TSC Number</label>
                        <input
                          type="text"
                          value={editTscNumber}
                          onChange={(e) => setEditTscNumber(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="e.g. TSC123456"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as AccountStatus)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        >
                          <option value="Active">Active</option>
                          <option value="Disabled">Disabled</option>
                          <option value="Locked">Locked</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: Class Teacher Assignment */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Class Teacher Assignment</h4>
                      </div>
                      {editClassStreamId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditClassStreamId('');
                            setEditClassGrade('');
                          }}
                          className="text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium underline"
                        >
                          Unassign Class Teacher
                        </button>
                      ) : null}
                    </div>

                    {/* Current Assignment Status Badge */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Class Teacher Status: </span>
                        {editClassStreamId ? (
                          (() => {
                            const strm = classes.find((c) => c.stream_id && c.stream_id === editClassStreamId);
                            return (
                              <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 ml-1">
                                <UserCheck className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                Class Teacher of {strm ? `${strm.class_name} - ${strm.stream}` : editClassGrade || 'Class'}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700 px-2 py-0.5 rounded-md ml-1 italic">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Class Teacher Assignment Dropdowns */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Education Level</label>
                        <select
                          value={editClassEduLevel}
                          onChange={(e) => {
                            const lvl = e.target.value as EducationLevel;
                            setEditClassEduLevel(lvl);
                            setEditClassGrade('');
                            setEditClassStreamId('');
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        >
                          <option value="">Select Level...</option>
                          {ALL_EDUCATION_LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[11px] font-semibold mb-1 ${!editClassEduLevel ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>Class / Grade</label>
                        <select
                          value={editClassGrade}
                          disabled={!editClassEduLevel}
                          onChange={(e) => {
                            setEditClassGrade(e.target.value);
                            setEditClassStreamId('');
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                        >
                          <option value="">{!editClassEduLevel ? 'Select Level First...' : 'Select Class...'}</option>
                          {editClassEduLevel && sortGrades(
                            Array.from(
                              new Set(
                                classes
                                  .filter((c) => (c.education_level || getEducationLevelForGrade(c.class_name)) === editClassEduLevel)
                                  .map((c) => c.class_name)
                              )
                            )
                          ).map((grade) => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[11px] font-semibold mb-1 ${!editClassGrade ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>Stream</label>
                        <select
                          value={editClassStreamId}
                          onChange={(e) => setEditClassStreamId(e.target.value)}
                          disabled={!editClassGrade}
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                        >
                          <option value="">{!editClassGrade ? 'Select Class First...' : 'Select Stream...'}</option>
                          {editClassGrade && classes
                            .filter((c) => c.class_name === editClassGrade && Boolean(c.stream_id))
                            .map((c) => (
                              <option key={c.stream_id} value={c.stream_id}>{c.class_name} - {c.stream}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: Learning Areas & Teaching Allocations */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Learning Areas & Teaching Allocations</h4>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {editAllocations.length} {editAllocations.length === 1 ? 'allocation' : 'allocations'}
                      </span>
                    </div>

                    {/* Current Allocations List */}
                    <div className="space-y-2">
                      {editAllocations.length === 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-400 dark:text-slate-500 text-xs">
                          <p className="font-medium text-slate-500 dark:text-slate-400">Unassigned</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">No learning area allocations assigned yet. Use the form below to add allocations.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                          {editAllocations.map((alloc) => {
                            const matchedCls = (alloc.stream_id ? classes.find((c) => c.stream_id === alloc.stream_id || c.id === alloc.stream_id) : undefined) ||
                                               (alloc.stream ? classes.find((c) => (c.class_name === alloc.class_name || c.id === alloc.class_id) && c.stream.toLowerCase() === alloc.stream.toLowerCase()) : undefined) ||
                                               classes.find((c) => c.id === alloc.class_id);
                            const matchedSub = subjects.find((s) => s.id === alloc.subject_id);
                            const classNameStr = matchedCls ? matchedCls.class_name : alloc.class_name || 'Class';
                            const streamStr = matchedCls ? matchedCls.stream : alloc.stream || '';
                            const subjectNameStr = matchedSub ? matchedSub.subject_name : alloc.subject_name || 'Subject';

                            return (
                              <div
                                key={alloc.id}
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 flex items-center justify-between shadow-2xs hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                      {classNameStr} {streamStr ? `— ${streamStr}` : ''}
                                    </span>
                                    {alloc.education_level && (
                                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                                        {alloc.education_level}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5">{subjectNameStr}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleEditRemoveAllocation(alloc.id)}
                                  title="Remove Allocation"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Add Allocation Form inside Edit Modal */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                      <h5 className="font-bold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1.5 uppercase tracking-wider">
                        <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Add Learning Area Allocation
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Education Level</label>
                          <select
                            value={editAddEduLevel}
                            onChange={(e) => {
                              const lvl = e.target.value as EducationLevel;
                              setEditAddEduLevel(lvl);
                              setEditAddGrade('');
                              setEditAddStreamId('');
                              setEditAddSubjectId('');
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          >
                            <option value="">Select Level...</option>
                            {ALL_EDUCATION_LEVELS.map((lvl) => (
                              <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${!editAddEduLevel ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>Class / Grade</label>
                          <select
                            value={editAddGrade}
                            disabled={!editAddEduLevel}
                            onChange={(e) => {
                              setEditAddGrade(e.target.value);
                              setEditAddStreamId('');
                              setEditAddSubjectId('');
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                          >
                            <option value="">{!editAddEduLevel ? 'Select Level First...' : 'Select Class...'}</option>
                            {editAddEduLevel && sortGrades(
                              Array.from(
                                new Set(
                                  classes
                                    .filter((c) => (c.education_level || getEducationLevelForGrade(c.class_name)) === editAddEduLevel)
                                    .map((c) => c.class_name)
                                )
                              )
                            ).map((grade) => (
                              <option key={grade} value={grade}>{grade}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${!editAddGrade ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>Stream</label>
                          <select
                            value={editAddStreamId}
                            onChange={(e) => setEditAddStreamId(e.target.value)}
                            disabled={!editAddGrade}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                          >
                            <option value="">{!editAddGrade ? 'Select Class First...' : 'Select Stream...'}</option>
                            {editAddGrade && classes
                              .filter((c) => c.class_name === editAddGrade && Boolean(c.stream_id))
                              .map((c) => (
                                <option key={c.stream_id} value={c.stream_id}>{c.class_name} - {c.stream}</option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${!editAddGrade ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>Learning Area / Subject</label>
                          <select
                            value={editAddSubjectId}
                            onChange={(e) => setEditAddSubjectId(e.target.value)}
                            disabled={!editAddGrade}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                          >
                            <option value="">{!editAddGrade ? 'Select Class First...' : 'Select Learning Area...'}</option>
                            {subjects
                              .filter((s) => s.status !== 'Archived')
                              .filter((s) => {
                                if (editAddGrade) {
                                  return getApplicableSubjectsForGrade(editAddGrade, [s]).length > 0;
                                }
                                if (editAddEduLevel) {
                                  const levelGrades = LEVEL_TO_GRADES[editAddEduLevel] || [];
                                  if (s.applicable_grades && s.applicable_grades.length > 0) {
                                    return s.applicable_grades.some((g) => levelGrades.includes(g) || getEducationLevelForGrade(g) === editAddEduLevel);
                                  }
                                  return !s.education_level || s.education_level === editAddEduLevel;
                                }
                                return true;
                              })
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.subject_name} ({s.subject_code})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleEditAddAllocation}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Allocation
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTeacher || isLoadingTeacherData}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isSavingTeacher ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-sm">Reset Teacher Password</h3>
              </div>
              <button
                onClick={() => setResetPasswordTeacher(null)}
                className="text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              {resetError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  {resetSuccess}
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200">{resetPasswordTeacher.teacher_name}</div>
                <div className="text-slate-500 dark:text-slate-400">{resetPasswordTeacher.email}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Temporary Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isResettingPassword}
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isResettingPassword}
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#176B45] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="resetForceChange"
                  disabled={isResettingPassword}
                  checked={resetForceChange}
                  onChange={(e) => setResetForceChange(e.target.checked)}
                  className="w-4 h-4 text-[#176B45] rounded focus:ring-[#176B45] border-slate-300 dark:border-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <label htmlFor="resetForceChange" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer disabled:opacity-60">
                  Force password change on next login
                </label>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isResettingPassword}
                  onClick={() => setResetPasswordTeacher(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#176B45] hover:bg-[#0F5132] rounded-xl shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed min-w-[150px]"
                >
                  {isResettingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Password Now'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW TEACHER & LOGIN HISTORY MODAL */}
      {viewingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold flex items-center justify-center text-sm border border-emerald-500/30 shrink-0">
                  {(() => {
                    const parts = (viewingTeacher.teacher_name || '').trim().split(/\s+/).filter(Boolean);
                    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
                    return parts[0] ? parts[0][0].toUpperCase() : 'T';
                  })()}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{viewingTeacher.teacher_name}</h3>
                  <p className="text-[11px] text-slate-400">{viewingTeacher.email}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingTeacher(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-5 gap-4">
              <button
                onClick={() => setDetailTab('profile')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  detailTab === 'profile'
                    ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Account Profile</span>
              </button>

              <button
                onClick={() => setDetailTab('allocations')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  detailTab === 'allocations'
                    ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Classes & Learning Areas</span>
              </button>

              <button
                onClick={() => setDetailTab('logs')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  detailTab === 'logs'
                    ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Login History Audit ({currentViewingLogs.length})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {detailTab === 'profile' && (() => {
                const getInitials = (name: string) => {
                  if (!name) return 'T';
                  const parts = name.trim().split(/\s+/).filter(Boolean);
                  if (parts.length >= 2) {
                    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                  }
                  if (parts.length === 1 && parts[0].length >= 2) {
                    return parts[0].slice(0, 2).toUpperCase();
                  }
                  return parts[0] ? parts[0][0].toUpperCase() : 'T';
                };

                const rawPhone = viewingTeacher.phone ? viewingTeacher.phone.trim() : '';
                const isFakePhone = !rawPhone || rawPhone === '+254 700 000 000' || rawPhone === '700000000' || rawPhone === '+254700000000' || rawPhone === '0700000000';
                const phoneDisplay = isFakePhone ? 'Not provided' : rawPhone;

                const rawTsc = viewingTeacher.tsc_number ? viewingTeacher.tsc_number.trim() : '';
                const isFakeTsc = !rawTsc || rawTsc === 'TSC-PENDING' || rawTsc === 'N/A';
                const tscDisplay = isFakeTsc ? 'Not provided' : rawTsc;

                const rawUsername = viewingTeacher.username ? viewingTeacher.username.trim() : '';
                const usernameDisplay = rawUsername ? (rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`) : 'Not provided';

                const emailDisplay = viewingTeacher.email ? viewingTeacher.email.trim() : 'Not provided';

                const ctStream = classes.find(
                  c => (c.class_teacher_id && c.class_teacher_id === viewingTeacher.id) ||
                  (viewingTeacher.class_teacher_of_id && c.stream_id && c.stream_id === viewingTeacher.class_teacher_of_id)
                );
                const isClassTeacher = Boolean(ctStream || viewingTeacher.is_class_teacher || viewingTeacher.class_teacher_of_id);
                const isSubjectTeacher = Boolean(viewingTeacher.allocations && viewingTeacher.allocations.length > 0);

                let roleLabel = 'Teacher';
                if (isClassTeacher && isSubjectTeacher) {
                  roleLabel = 'Class Teacher • Subject Teacher';
                } else if (isClassTeacher) {
                  roleLabel = 'Class Teacher';
                } else if (isSubjectTeacher) {
                  roleLabel = 'Subject Teacher';
                }

                const assignedClassList: { name: string; isCT: boolean }[] = [];
                if (ctStream) {
                  assignedClassList.push({ name: `${ctStream.class_name} - ${ctStream.stream}`, isCT: true });
                }
                if (viewingTeacher.allocations) {
                  viewingTeacher.allocations.forEach(alloc => {
                    const cl = (alloc.stream_id ? classes.find(c => c.stream_id === alloc.stream_id || c.id === alloc.stream_id) : undefined) ||
                               (alloc.stream ? classes.find(c => (c.class_name === alloc.class_name || c.id === alloc.class_id) && c.stream.toLowerCase() === alloc.stream.toLowerCase()) : undefined) ||
                               classes.find(c => c.id === alloc.class_id);
                    if (cl) {
                      const classNameStr = `${cl.class_name} ${cl.stream}`;
                      if (!assignedClassList.some(item => item.name === classNameStr)) {
                        assignedClassList.push({ name: classNameStr, isCT: false });
                      }
                    }
                  });
                }

                const assignedSubjectsList: string[] = [];
                if (viewingTeacher.allocations) {
                  viewingTeacher.allocations.forEach(alloc => {
                    const sb = subjects.find(s => s.id === alloc.subject_id);
                    const subjectNameStr = sb ? sb.subject_name : (alloc.subject_name || alloc.subject_id);
                    if (subjectNameStr && !assignedSubjectsList.includes(subjectNameStr)) {
                      assignedSubjectsList.push(subjectNameStr);
                    }
                  });
                }

                const lastLoginText = viewingTeacher.last_login
                  ? `${new Date(viewingTeacher.last_login).toLocaleDateString()} ${new Date(viewingTeacher.last_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : currentViewingLogs.find(l => l.status === 'Success')
                    ? `${currentViewingLogs[0].date} ${currentViewingLogs[0].time}`
                    : 'Never';

                return (
                  <div className="space-y-6">
                    {/* 1. PROFILE HEADER */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start space-x-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-base flex items-center justify-center shrink-0 border border-slate-300/60 dark:border-slate-600 shadow-2xs">
                            {getInitials(viewingTeacher.teacher_name)}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                {viewingTeacher.teacher_name}
                              </h3>
                              {getStatusBadge(viewingTeacher.status)}
                            </div>
                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              {usernameDisplay}
                            </p>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              <span className="text-slate-400 dark:text-slate-500">TSC: </span>
                              <span className={isFakeTsc ? 'text-slate-400 italic font-normal' : 'font-semibold text-slate-700 dark:text-slate-300'}>
                                {tscDisplay}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start">
                          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            {roleLabel}
                          </span>
                        </div>
                      </div>

                      {/* Account Contact Details */}
                      <div className="pt-3.5 border-t border-slate-200/70 dark:border-slate-700/70 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium break-all">
                          <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>{emailDisplay}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span className={isFakePhone ? 'text-slate-400 italic' : 'font-medium text-slate-700 dark:text-slate-300'}>
                            {phoneDisplay}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. ASSIGNED CLASSES & STREAMS */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          Assigned Classes & Streams
                        </h4>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          {(() => {
                            const count = classes.filter((c) => isClassStreamAllocatedToTeacher(c, viewingTeacher)).length;
                            return `${count} ${count === 1 ? 'assignment' : 'assignments'}`;
                          })()}
                        </span>
                      </div>

                      {(() => {
                        const matchedClasses = classes.filter((c) => isClassStreamAllocatedToTeacher(c, viewingTeacher));
                        if (matchedClasses.length === 0) {
                          return (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-400 italic">
                              No classes or streams assigned
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-wrap gap-2">
                            {matchedClasses.map((c) => {
                              const isCT = (c.class_teacher_id && c.class_teacher_id === viewingTeacher.id) ||
                                Boolean(viewingTeacher.is_class_teacher && viewingTeacher.class_teacher_of_id && c.stream_id && c.stream_id === viewingTeacher.class_teacher_of_id);
                              const label = c.stream ? `${c.class_name} - ${c.stream}` : c.class_name;
                              return (
                                <div
                                  key={c.stream_id || `${c.id}_${c.stream}`}
                                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md border border-slate-200/80 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                                >
                                  <span>{label}</span>
                                  {isCT && (
                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">
                                      Class Teacher
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 3. ASSIGNED LEARNING AREAS */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          Assigned Learning Areas
                        </h4>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          {assignedSubjectsList.length} {assignedSubjectsList.length === 1 ? 'learning area' : 'learning areas'}
                        </span>
                      </div>

                      {assignedSubjectsList.length === 0 ? (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-400 italic">
                          No learning areas assigned
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {assignedSubjectsList.map((subjectName, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200/80 dark:border-slate-700 text-xs font-medium shadow-2xs"
                            >
                              {subjectName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 4. ACCOUNT SECURITY */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        Account Security
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700 shrink-0">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase block">
                              Force Password Change
                            </span>
                            <div>
                              {viewingTeacher.force_password_change ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Required on next login
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Not required (Password active)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700 shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase block">
                              Last Login
                            </span>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {lastLoginText}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 5. ACTIONS */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Account Actions
                      </h4>
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Edit Teacher (Primary action) */}
                          <button
                            type="button"
                            onClick={() => {
                              setViewingTeacher(null);
                              openEditTeacherModal(viewingTeacher);
                            }}
                            className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {/* Reset Password (Secondary action) */}
                          <button
                            type="button"
                            onClick={() => {
                              setViewingTeacher(null);
                              setResetPasswordTeacher(viewingTeacher);
                              setNewResetPassword('Teacher@2026');
                              setConfirmResetPassword('Teacher@2026');
                              setResetForceChange(true);
                              setResetError(null);
                              setResetSuccess(null);
                            }}
                            className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            <span>Reset Password</span>
                          </button>

                          {/* View Logs (Secondary action) */}
                          <button
                            type="button"
                            onClick={() => setDetailTab('logs')}
                            className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            <span>View Logs</span>
                          </button>

                          {/* Enable / Disable status toggle */}
                          {viewingTeacher.status === 'Disabled' || viewingTeacher.status === 'Locked' ? (
                            <button
                              type="button"
                              onClick={() => {
                                handleStatusChange(viewingTeacher, 'Active');
                                setViewingTeacher({ ...viewingTeacher, status: 'Active' });
                              }}
                              className="px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Enable Account</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                handleStatusChange(viewingTeacher, 'Disabled');
                                setViewingTeacher({ ...viewingTeacher, status: 'Disabled' });
                              }}
                              className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-700 dark:text-slate-300 hover:text-amber-800 dark:hover:text-amber-300 border border-slate-300 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-600" />
                              <span>Disable Account</span>
                            </button>
                          )}
                        </div>

                        {/* Delete Account (Destructive, secondary visual weight) */}
                        <button
                          type="button"
                          onClick={() => {
                            setViewingTeacher(null);
                            setDeletingTeacher(viewingTeacher);
                          }}
                          className="px-3 py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-900"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {detailTab === 'allocations' && (
                <div className="space-y-4">
                  {/* Class Teacher assignment if applicable */}
                  {(() => {
                    const ctStream = classes.find(
                      c => (c.class_teacher_id && c.class_teacher_id === viewingTeacher.id) ||
                      (viewingTeacher.class_teacher_of_id && c.stream_id && c.stream_id === viewingTeacher.class_teacher_of_id)
                    );
                    if (ctStream || viewingTeacher.is_class_teacher) {
                      return (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">Class Teacher Role</span>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {ctStream ? `Class Teacher of ${ctStream.class_name} - ${ctStream.stream}` : 'Assigned Class Teacher'}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs mb-2">Teaching Allocations</h4>
                    <div className="flex flex-col gap-2">
                      {viewingTeacher.allocations && viewingTeacher.allocations.length > 0 ? (
                        viewingTeacher.allocations.map((alloc) => {
                          const cl = (alloc.stream_id ? classes.find((c) => c.stream_id === alloc.stream_id || c.id === alloc.stream_id) : undefined) ||
                                     (alloc.stream ? classes.find((c) => (c.class_name === alloc.class_name || c.id === alloc.class_id) && c.stream.toLowerCase() === alloc.stream.toLowerCase()) : undefined) ||
                                     classes.find((c) => c.id === alloc.class_id);
                          const sb = subjects.find((s) => s.id === alloc.subject_id);
                          return (
                            <div key={alloc.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                  {cl ? `${cl.class_name} ${cl.stream}` : alloc.class_id}
                                </span>
                                <span className="text-slate-400 mx-2">—</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                  {sb ? sb.subject_name : alloc.subject_id}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                                {alloc.education_level}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-400 dark:text-slate-500">No additional subject allocations assigned.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'logs' && (
                <div className="space-y-3">
                  {currentViewingLogs.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                      No login attempts recorded yet for this account.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                            <th className="py-2.5 px-3">Date & Time</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Device & Browser</th>
                            <th className="py-2.5 px-3">IP Address</th>
                            <th className="py-2.5 px-3">Remarks / Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {currentViewingLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                                {log.date} {log.time}
                              </td>
                              <td className="py-2.5 px-3">
                                {log.status === 'Success' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                    Success
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">
                                    Failed
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                {log.device} &bull; {log.browser}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {log.ip_address}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                {log.reason || 'Normal Sign In'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => setViewingTeacher(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-sm p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Delete Teacher Account</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200">{deletingTeacher.teacher_name}</strong>? This will permanently remove their user credentials and class assignments.
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 text-left">
                {deleteError}
              </div>
            )}

            <div className="flex justify-center space-x-2 pt-2">
              <button
                onClick={() => {
                  setDeletingTeacher(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
