import { School, Student, Teacher, ClassStream, Subject, Examination, Mark, Grade } from '../types';
import { api } from '../lib/storage';
import { saveFile } from './fileDownloader';

export interface BackupPayloadOptions {
  school?: School;
  students?: Student[];
  teachers?: Teacher[];
  classes?: ClassStream[];
  subjects?: Subject[];
  exams?: Examination[];
  marks?: Mark[];
  grades?: Grade[];
}

export function generateBackupPayload({
  school,
  students = [],
  teachers = [],
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
}: BackupPayloadOptions) {
  const academicYears = api.getAcademicYears();
  const terms = api.getSchoolTerms();

  // Sanitize teacher records so no sensitive auth credentials (e.g. temporary_password) are exported
  const sanitizedTeachers = teachers.map((t) => {
    const { temporary_password, ...safeTeacher } = t;
    return safeTeacher;
  });

  const exportTimestamp = new Date().toISOString();
  const schoolId = school?.id || 'sch_default';
  const schoolName = school?.school_name || 'School';

  return {
    metadata: {
      backup_format_version: '1.0.0',
      app_version: '1.0.0',
      exported_at: exportTimestamp,
      school_id: schoolId,
      school_name: schoolName,
      backup_type: 'manual_admin_export',
      record_counts: {
        learners: students.length,
        teachers: teachers.length,
        classes: classes.length,
        subjects: subjects.length,
        examinations: exams.length,
        marks: marks.length,
        grades: grades.length,
        academic_years: academicYears.length,
        terms: terms.length,
      },
    },
    school,
    academic_years: academicYears,
    terms,
    classes,
    subjects,
    teachers: sanitizedTeachers,
    learners: students,
    students, // backward-compatibility alias
    examinations: exams,
    exams, // backward-compatibility alias
    marks,
    grades,
    exported_at: exportTimestamp, // backward-compatibility top-level field
  };
}

export async function exportSystemBackup(options: BackupPayloadOptions): Promise<{
  fileName: string;
  recordCount: number;
}> {
  const payload = generateBackupPayload(options);
  const jsonContent = JSON.stringify(payload, null, 2);
  const schoolName = options.school?.school_name || 'School';
  const dateStr = payload.metadata.exported_at.slice(0, 10);
  const fileName = `${schoolName.replace(/\s+/g, '_')}_CBE_Backup_${dateStr}.json`;

  await saveFile(jsonContent, fileName, {
    mimeType: 'application/json',
    dialogTitle: 'Export System Backup',
  });

  return {
    fileName,
    recordCount:
      (options.students?.length || 0) +
      (options.teachers?.length || 0) +
      (options.marks?.length || 0),
  };
}
