import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, X, ShieldAlert, ArrowRight, UserCheck, FileText } from 'lucide-react';
import { Mark, User } from '../types';

export interface ResolveYModalProps {
  isOpen: boolean;
  onClose: () => void;
  mark: Mark;
  learnerName: string;
  learnerAdmissionNumber?: string;
  subjectName: string;
  examName: string;
  outOf: number;
  originalReason: string;
  currentUser: User;
  onResolveSuccess: (resolvedMark: Mark) => void;
  onResolveApi: (params: {
    markId: string;
    studentId: string;
    subjectId: string;
    examId: string;
    replacementScore: number;
    outOf: number;
    resolutionReason: string;
    currentUser: User;
  }) => Promise<{ success: boolean; mark: Mark }>;
}

export const ResolveYModal: React.FC<ResolveYModalProps> = ({
  isOpen,
  onClose,
  mark,
  learnerName,
  learnerAdmissionNumber,
  subjectName,
  examName,
  outOf,
  originalReason,
  currentUser,
  onResolveSuccess,
  onResolveApi,
}) => {
  const [replacementScore, setReplacementScore] = useState<string>('');
  const [resolutionReason, setResolutionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const parsedScore = parseFloat(replacementScore);
  const isValidScore = !isNaN(parsedScore) && Number.isFinite(parsedScore) && parsedScore >= 0 && parsedScore <= outOf;
  const isValidReason = resolutionReason.trim().length > 0;
  const isFormValid = isValidScore && isValidReason;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isValidScore) {
      if (isNaN(parsedScore)) {
        setErrorMessage('Please enter a valid numerical replacement mark.');
      } else if (parsedScore < 0) {
        setErrorMessage('Replacement mark cannot be negative.');
      } else if (parsedScore > outOf) {
        setErrorMessage(`Replacement mark cannot exceed the assessment maximum of ${outOf}.`);
      }
      return;
    }

    if (!isValidReason) {
      setErrorMessage('Please provide a mandatory resolution reason for audit compliance.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onResolveApi({
        markId: mark.id,
        studentId: mark.student_id,
        subjectId: mark.subject_id,
        examId: mark.exam_id,
        replacementScore: parsedScore,
        outOf: outOf,
        resolutionReason: resolutionReason.trim(),
        currentUser: currentUser,
      });

      if (res && res.success) {
        onResolveSuccess(res.mark);
        onClose();
      } else {
        setErrorMessage('Failed to resolve Y mark.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during Y resolution.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="resolve-y-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div
        id="resolve-y-modal-container"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="resolve-y-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Resolve Y
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Authorised administrative replacement mark
              </p>
            </div>
          </div>
          <button
            id="resolve-y-close-btn"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Metadata Card */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 text-xs text-slate-600 dark:border-slate-800/80 dark:bg-slate-800/40 dark:text-slate-300">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-medium text-slate-400 dark:text-slate-500">Learner:</span>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {learnerName} {learnerAdmissionNumber ? `(${learnerAdmissionNumber})` : ''}
                </p>
              </div>
              <div>
                <span className="font-medium text-slate-400 dark:text-slate-500">Learning Area:</span>
                <p className="font-medium text-slate-900 dark:text-slate-100">{subjectName}</p>
              </div>
              <div>
                <span className="font-medium text-slate-400 dark:text-slate-500">Assessment:</span>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {examName} <span className="text-slate-400 dark:text-slate-500">(Max: {outOf})</span>
                </p>
              </div>
              <div>
                <span className="font-medium text-slate-400 dark:text-slate-500">Original Y Reason:</span>
                <p className="font-semibold text-amber-700 dark:text-amber-400">{originalReason || 'Absent'}</p>
              </div>
            </div>
          </div>

          {/* Replacement Mark Input */}
          <div>
            <label
              htmlFor="replacement-score-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Replacement Mark <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="replacement-score-input"
                type="number"
                step="any"
                min="0"
                max={outOf}
                placeholder={`0 to ${outOf}`}
                value={replacementScore}
                onChange={(e) => setReplacementScore(e.target.value)}
                disabled={isSubmitting}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 shadow-xs focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                / {outOf}
              </span>
              {isValidScore && (
                <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Normalized: {Math.round((parsedScore / outOf) * 100)}%
                </span>
              )}
            </div>
          </div>

          {/* Resolution Reason Input */}
          <div>
            <label
              htmlFor="resolution-reason-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Resolution Reason <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <textarea
                id="resolution-reason-input"
                rows={2}
                placeholder="e.g. Special makeup assessment sat following approved medical absence"
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              />
            </div>
          </div>

          {/* Authorised Resolver Identity */}
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              Authorised Resolver:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {currentUser.name || currentUser.email || 'Administrator'}
              </strong>{' '}
              ({currentUser.role || 'admin'})
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              id="resolve-y-error"
              className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              id="resolve-y-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              id="resolve-y-confirm-btn"
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-amber-500 focus:outline-hidden disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              {isSubmitting ? (
                <span>Resolving...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Confirm Authorised Resolution</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
