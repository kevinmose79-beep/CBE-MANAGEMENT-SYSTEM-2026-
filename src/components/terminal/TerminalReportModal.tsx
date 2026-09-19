import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { Student, School, ClassStream, Subject, Grade, Teacher, getEducationLevelForGrade } from '../../types';
import { ContributingAssessmentRef, LearningAreaTerminalResult } from '../../services/terminalResultsEngine';
import { TerminalLearnerRanking, isJuniorSchoolEducationLevel, calculateSingleLearnerRanking } from '../../services/terminalRankingEngine';
import { downloadSingleTerminalReportPDF, getDefaultSubjectComment } from '../../services/terminalReportPdfGenerator';
import { getStreamNameForLearner } from '../../services/terminalMeritListExporter';
import { formatKenyaDate } from '../../utils/kenyaDateUtils';
import { stripSurroundingQuotes } from '../../utils/filterUtils';
import { resolveSubjectTeacher } from '../../utils/teacherResolutionUtils';

export interface TerminalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  school: School;
  classStream?: ClassStream;
  academicYear: string | number;
  term: string;
  isProvisionalMode?: boolean;
  contributingAssessments: ContributingAssessmentRef[];
  subjects: Subject[];
  resultsBySubject: Map<string, LearningAreaTerminalResult>;
  grades?: Grade[];
  teachers?: Teacher[];
  classes?: ClassStream[];
  nextTermOpeningDate?: string;
  customSubjectComments?: Record<string, string>;
  savedRemarks?: {
    class_teacher_name?: string;
    class_teacher_comment?: string;
    headteacher_name?: string;
    headteacher_comment?: string;
    hoi_name?: string;
    subject_comments?: Record<string, string>;
  };
  ranking?: TerminalLearnerRanking;
}

export const TerminalReportModal: React.FC<TerminalReportModalProps> = ({
  isOpen,
  onClose,
  student,
  school,
  classStream,
  academicYear,
  term,
  isProvisionalMode = false,
  contributingAssessments,
  subjects,
  resultsBySubject,
  grades,
  teachers,
  classes,
  nextTermOpeningDate,
  customSubjectComments,
  savedRemarks,
  ranking,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const targetClassId = classStream?.id || student.class_id;
  const targetStreamId = classStream?.stream_id || student.stream_id;

  const isJuniorSchool = isJuniorSchoolEducationLevel(undefined, classStream, student);
  const effectiveRanking: TerminalLearnerRanking | undefined = isJuniorSchool
    ? (ranking || calculateSingleLearnerRanking({
        student,
        classStream,
        resultsBySubject,
        applicableSubjects: subjects,
        isProvisionalMode,
      }))
    : undefined;

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      await downloadSingleTerminalReportPDF({
        student,
        school,
        classStream,
        classes,
        academicYear,
        term,
        isProvisionalMode,
        contributingAssessments,
        subjects,
        resultsBySubject,
        grades,
        teachers,
        nextTermOpeningDate,
        customSubjectComments,
        savedRemarks,
        ranking: effectiveRanking,
      });
    } catch (err) {
      console.error('Failed to download terminal report PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const learnerFullName = (
    student.full_name || `${student.first_name || ''} ${student.last_name || ''}`
  ).trim().toUpperCase() || 'LEARNER';

  const learnerStreamName = getStreamNameForLearner(student, classes || (classStream ? [classStream] : []));
  const baseClassName = classStream?.class_name || student.grade || (student as any).class_name || 'Class';
  const classNameStr = learnerStreamName && learnerStreamName !== '—'
    ? `${baseClassName} · ${learnerStreamName}`
    : classStream?.stream
      ? `${baseClassName} · ${classStream.stream}`
      : baseClassName;

  const eduLevelStr = classStream?.education_level || 'Junior School';

  const evaluatedCount = subjects.filter((s) => {
    const res = resultsBySubject.get(s.id);
    return res && res.isComplete;
  }).length;
  const totalCount = subjects.length;

  // Gather resolved Y items for provenance
  const resolvedProvenanceList: Array<{
    subjectName: string;
    examName: string;
    reason: string;
    replacement: string;
    auth: string;
    date: string;
  }> = [];

  subjects.forEach((subj) => {
    const res = resultsBySubject.get(subj.id);
    res?.assessmentTrail?.forEach((trail) => {
      if (trail.resolvedFromY) {
        resolvedProvenanceList.push({
          subjectName: subj.subject_name,
          examName: trail.examName,
          reason: trail.irregularityReason || 'Absence / Irregularity',
          replacement: `${trail.rawScore}/${trail.outOf} (${Math.round(trail.percentage || 0)}%)`,
          auth: trail.resolvedBy || 'Academic Board',
          date: trail.resolvedAt ? formatKenyaDate(trail.resolvedAt) : 'Recorded',
        });
      }
    });
  });

  const classTeacher = targetClassId
    ? (teachers?.find((t) => t.id === classStream?.class_teacher_id) || teachers?.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.headteacher_name || savedRemarks?.hoi_name || school.principal_name || 'Head of Institution';

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment) ||
    'Demonstrates commendable dedication and effort throughout the term. Encouraged to sustain focus and consistency across all learning areas.';

  const hoiComment = stripSurroundingQuotes(savedRemarks?.headteacher_comment) ||
    'A satisfactory terminal evaluation showing steady academic development. Well done on the term\'s work.';

  return (
    <div
      id="terminal-report-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terminal-report-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 print:hidden shrink-0">
          <div className="flex items-center space-x-2">
            <h2 id="terminal-report-modal-title" className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              Terminal Report Form
            </h2>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isProvisionalMode
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
              }`}
            >
              {isProvisionalMode ? 'Provisional Review' : 'Official Report'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="print-terminal-report-btn"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>

            <button
              id="modal-download-terminal-pdf-btn"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#176B45] hover:bg-[#125335] disabled:opacity-50 transition shadow-2xs"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download PDF</span>
            </button>

            <button
              id="close-terminal-report-modal-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 print:p-4 print:overflow-visible">
          {/* Top Decorative Border */}
          <div
            className={`h-1.5 w-full rounded-full ${
              isProvisionalMode ? 'bg-amber-600' : 'bg-[#176B45]'
            }`}
          />

          {/* School Header */}
          <div className="text-center space-y-1">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              {school.school_name || 'Competency-Based Education Center'}
            </h1>
            {school.motto && (
              <p className="text-xs italic text-slate-500 dark:text-slate-400">
                "{stripSurroundingQuotes(school.motto)}"
              </p>
            )}
            {(school.phone || school.email || school.address) && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {[school.phone && `Tel: ${school.phone}`, school.email && `Email: ${school.email}`, school.address]
                  .filter(Boolean)
                  .join(' | ')}
              </p>
            )}
          </div>

          {/* Report Title Banner */}
          <div
            className={`py-2 px-4 rounded-lg text-center font-black text-xs sm:text-sm tracking-wider uppercase text-white shadow-2xs ${
              isProvisionalMode ? 'bg-amber-600' : 'bg-[#176B45]'
            }`}
          >
            {isProvisionalMode ? 'PROVISIONAL TERMINAL REPORT' : 'OFFICIAL TERMINAL REPORT'}
          </div>

          {/* Provisional Warning Banner */}
          {isProvisionalMode && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-lg flex items-center justify-center space-x-2 text-xs font-bold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>PROVISIONAL — FOR STAFF REVIEW ONLY — NOT FOR OFFICIAL LEARNER RELEASE</span>
            </div>
          )}

          {/* Learner Identity Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Learner Name
              </span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate block">
                {learnerFullName}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Admission No
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {student.admission_number || 'N/A'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Class & Stream
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {classNameStr}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Session
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {academicYear} · {term}
              </span>
            </div>
          </div>

          {/* Terminal Evaluation Summary Banner & Junior School Ranking */}
          <div className="p-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Learning Areas:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {evaluatedCount} of {totalCount} Evaluated
                </span>
              </div>
              <div className="flex items-center space-x-2 sm:justify-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Term Scope:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {contributingAssessments.length} Contributing Assessment{contributingAssessments.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-center space-x-2 sm:justify-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                <span
                  className={`font-extrabold ${
                    isProvisionalMode
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-[#176B45] dark:text-emerald-400'
                  }`}
                >
                  {isProvisionalMode ? 'PROVISIONAL REVIEW' : 'OFFICIAL RELEASE'}
                </span>
              </div>
            </div>

            {/* Junior School Ranking Row */}
            {isJuniorSchool && effectiveRanking && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Terminal Total Marks:</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                    {effectiveRanking.isRankable && effectiveRanking.terminalTotalMarks !== null
                      ? `${effectiveRanking.terminalTotalMarks} / ${effectiveRanking.terminalTotalMaximum}`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 sm:justify-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {isProvisionalMode ? 'Prov. Stream Pos:' : 'Stream Position:'}
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                    {effectiveRanking.isRankable && effectiveRanking.streamPosition !== null
                      ? `${effectiveRanking.streamPosition} / ${effectiveRanking.streamPositionDenominator}`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 sm:justify-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {isProvisionalMode ? 'Prov. Overall Pos:' : 'Overall Position:'}
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                    {effectiveRanking.overallPosition !== null
                      ? `${effectiveRanking.overallPosition} / ${effectiveRanking.overallPositionDenominator}`
                      : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Main Learning Area Results Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#176B45] text-white">
                  <th className="py-2.5 px-3 font-bold w-[22%]">Learning Area</th>
                  {contributingAssessments.map((a, idx) => {
                    const cleanName = a.exam_name.replace(/\bCAT\s*(\d+)?\b/gi, (_, n) => (n ? `Assessment ${n}` : 'Assessment'));
                    const maxScore = typeof a.max_marks === 'number' ? a.max_marks : (typeof a.out_of === 'number' ? a.out_of : 100);
                    return (
                      <th key={a.id || idx} className="py-2.5 px-2 font-bold text-center border-l border-emerald-700/50">
                        <div>{cleanName}</div>
                        <div className="text-[10px] font-normal text-emerald-100/80">Max: {maxScore}</div>
                      </th>
                    );
                  })}
                  <th className="py-2.5 px-3 font-bold text-center border-l border-emerald-700/50 bg-[#125335]">
                    Terminal Result
                  </th>
                  <th className="py-2.5 px-3 font-bold text-left border-l border-emerald-700/50 w-[24%]">
                    Comments
                  </th>
                  <th className="py-2.5 px-3 font-bold text-left border-l border-emerald-700/50 w-[12%]">
                    Instructor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {subjects.map((subject) => {
                  const result = resultsBySubject.get(subject.id);
                  const isComplete = result?.isComplete ?? false;

                  // Teacher custom comment or default developmental comment
                  const customComment = customSubjectComments?.[subject.id] || savedRemarks?.subject_comments?.[subject.id];
                  const commentStr = customComment
                    ? stripSurroundingQuotes(customComment)
                    : getDefaultSubjectComment(subject, result);

                  // Instructor
                  const subjTeacher = resolveSubjectTeacher(teachers, subject.id, targetClassId, targetStreamId);
                  const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : '';

                  return (
                    <tr key={subject.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                        <div>{subject.subject_name}</div>
                        {subject.subject_code && (
                          <div className="text-[10px] font-mono text-slate-400">
                            ({subject.subject_code})
                          </div>
                        )}
                      </td>

                      {contributingAssessments.map((a) => {
                        const entry = result?.assessmentTrail?.find((t) => t.examId === a.id);
                        if (!entry || entry.status === 'Blank' || entry.status === 'X') {
                          return (
                            <td key={a.id} className="py-2 px-2 text-center border-l border-slate-100 dark:border-slate-800">
                              <div className="font-bold text-slate-500">X</div>
                              <div className="text-[10px] text-slate-400">Missing</div>
                            </td>
                          );
                        }

                        if (entry.status === 'Y') {
                          return (
                            <td key={a.id} className="py-2 px-2 text-center border-l border-slate-100 dark:border-slate-800">
                              <div className="font-bold text-amber-600">Y</div>
                              <div className="text-[10px] text-amber-500">Irregularity</div>
                            </td>
                          );
                        }

                        const roundedPct = Math.round(entry.percentage || 0);
                        const band = entry.cbePerformanceLevel || '';
                        return (
                          <td key={a.id} className="py-2 px-2 text-center border-l border-slate-100 dark:border-slate-800">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {roundedPct}%
                            </div>
                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              {band}
                              {entry.resolvedFromY && <span className="text-amber-600 ml-0.5">*</span>}
                            </div>
                          </td>
                        );
                      })}

                      {/* Terminal Result Column */}
                      <td className="py-2.5 px-3 text-center border-l border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        {result ? (
                          isComplete ? (
                            <div>
                              <div className="font-extrabold text-[#176B45] dark:text-emerald-400 text-xs">
                                {result.terminalPercentage}% {result.cbePerformanceLevel}
                              </div>
                              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                {result.points} pts
                              </div>
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                result.status === 'INCOMPLETE (X)'
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300'
                                  : result.status === 'INCOMPLETE (Y)'
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300'
                                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border border-rose-300'
                              }`}
                            >
                              {result.status}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 font-bold">INCOMPLETE (X)</span>
                        )}
                      </td>

                      {/* Comments Column */}
                      <td className="py-2.5 px-3 border-l border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 italic text-[11px] leading-snug">
                        {commentStr}
                      </td>

                      {/* Instructor Column */}
                      <td className="py-2.5 px-3 border-l border-slate-100 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                        {teacherNameStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Remarks Section */}
          <div className="space-y-3">
            {/* Class Teacher Remarks Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1">
              <span className="text-[11px] font-extrabold text-[#176B45] dark:text-emerald-400 block uppercase tracking-wide">
                CLASS TEACHER'S REMARKS (Tr. {classTeacherName}):
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                "{ctComment}"
              </p>
            </div>

            {/* Head of Institution Remarks Card */}
            <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-1">
              <span className="text-[11px] font-extrabold text-[#176B45] dark:text-emerald-400 block uppercase tracking-wide">
                HEAD OF INSTITUTION'S REMARKS (HOI: {hoiName}):
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                "{hoiComment}"
              </p>
            </div>
          </div>

          {/* Supplementary Provenance Section (Only if Resolved Y exists) */}
          {resolvedProvenanceList.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5">
              <span className="font-bold text-[#176B45] dark:text-emerald-400 block text-[11px]">
                * Special Status Resolution & Provenance Log
              </span>
              {resolvedProvenanceList.map((item, idx) => (
                <p key={idx} className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  • <strong className="text-slate-800 dark:text-slate-200">{item.subjectName}</strong> [{item.examName}]: Replaced Y with {item.replacement}. Reason: {item.reason} (Auth: {item.auth}, {item.date})
                </p>
              ))}
            </div>
          )}

          {/* CBE Achievement Scale Grading Key */}
          {(() => {
            const currentEducationLevel = classStream?.education_level || (classStream?.class_name ? getEducationLevelForGrade(classStream.class_name) : (student?.grade_name ? getEducationLevelForGrade(student.grade_name) : undefined));
            const isUpperPrimary = currentEducationLevel === 'Upper Primary';

            if (isUpperPrimary) {
              return (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    CBE 4-Point Achievement Scale Grading Key
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-emerald-600">EE:</span> 76–100% (4 Pts)
                    </div>
                    <div className="text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-blue-600">ME:</span> 51–75% (3 Pts)
                    </div>
                    <div className="text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-amber-600">AE:</span> 26–50% (2 Pts)
                    </div>
                    <div className="text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-rose-600">BE:</span> 0–25% (1 Pt)
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  CBE 8-Point Achievement Scale Grading Key
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-emerald-600">EE1:</span> 90–100% (8 Pts)
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-emerald-600">EE2:</span> 75–89% (7 Pts)
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-blue-600">ME1:</span> 58–74% (6 Pts)
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-blue-600">ME2:</span> 41–57% (5 Pts)
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-amber-600">AE1:</span> 31–40% (4 Pts)
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-amber-600">AE2:</span> 21–30% (3 Pts)
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-rose-600">BE1:</span> 11–20% (2 Pts)
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-rose-600">BE2:</span> 0–10% (1 Pt)
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Signatures */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Class Teacher Signature
              </span>
              <div className="border-b border-dashed border-slate-300 dark:border-slate-700 pt-3" />
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Head of Institution & Stamp
              </span>
              <div className="border-b border-dashed border-slate-300 dark:border-slate-700 pt-3" />
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Parent / Guardian Signature
              </span>
              <div className="border-b border-dashed border-slate-300 dark:border-slate-700 pt-3" />
            </div>
          </div>

          {/* Footer Info */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              {nextTermOpeningDate ? `Next Term Opening Date: ${formatKenyaDate(nextTermOpeningDate)}` : 'CBE Management System'}
            </span>
            <span>
              Generated: {formatKenyaDate(new Date().toISOString())} · {isProvisionalMode ? 'PROVISIONAL' : 'OFFICIAL'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
