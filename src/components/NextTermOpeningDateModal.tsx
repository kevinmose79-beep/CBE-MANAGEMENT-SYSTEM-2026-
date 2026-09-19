import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, X, Download, Clock, Info } from 'lucide-react';
import { Examination, SchoolTerm } from '../types';
import { formatKenyaDate } from '../utils/kenyaDateUtils';
import { resolveSuggestedNextTermOpeningDate } from '../services/nextTermOpeningDateResolver';

export interface NextTermOpeningDateModalProps {
  isOpen: boolean;
  exam?: Examination;
  schoolTerms?: SchoolTerm[];
  initialDate?: string;
  onConfirm: (confirmedDate: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
  downloadContext?: 'single' | 'batch' | 'zip';
  studentName?: string;
  totalCount?: number;
  cohortCount?: number;
}

export const NextTermOpeningDateModal: React.FC<NextTermOpeningDateModalProps> = ({
  isOpen,
  exam,
  schoolTerms = [],
  initialDate = '',
  onConfirm,
  onClose,
  isProcessing = false,
  downloadContext = 'single',
  studentName,
  totalCount,
  cohortCount,
}) => {
  const suggested = resolveSuggestedNextTermOpeningDate(exam, schoolTerms);
  const effectiveCount = (typeof totalCount === 'number' ? totalCount : cohortCount) || 0;

  // Initialize date selection: either passed initialDate, suggested rawDate, or empty
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialDate && initialDate.trim()) {
        setSelectedDate(initialDate.trim());
      } else if (suggested?.rawDate) {
        setSelectedDate(suggested.rawDate);
      } else {
        setSelectedDate('');
      }
    }
  }, [isOpen, initialDate, suggested?.rawDate]);

  if (!isOpen) return null;

  const isDateValid = Boolean(selectedDate && selectedDate.trim().length > 0);
  const formattedPreview = selectedDate ? formatKenyaDate(selectedDate) : '';

  const handleConfirm = () => {
    if (!isDateValid) return;
    onConfirm(selectedDate.trim());
  };

  return (
    <div
      id="next-term-date-modal-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="next-term-date-modal-title"
    >
      <div
        id="next-term-date-modal-card"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="next-term-date-modal-title"
                className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight"
              >
                Next Term Opening Date
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official Report Card Verification Gate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Assessment Context Banner */}
          {exam && (
            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Target Assessment
                </span>
                <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  {exam.exam_name}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  {exam.term} {exam.year}
                </div>
              </div>
              <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60">
                {downloadContext === 'batch'
                  ? `Batch: ${effectiveCount} Reports`
                  : downloadContext === 'zip'
                  ? `ZIP Archive`
                  : 'Individual Report'}
              </span>
            </div>
          )}

          {/* Explanation Text */}
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <p>
              Please explicitly confirm the official <strong className="text-slate-900 dark:text-slate-100">Next Term Opening Date</strong> to be rendered on the official report card footer.
            </p>
            {downloadContext === 'batch' && effectiveCount > 0 && (
              <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                This confirmed date will be applied uniformly to all {effectiveCount} report cards in this batch download.
              </p>
            )}
            {downloadContext === 'single' && studentName && (
              <p className="text-slate-700 dark:text-slate-300">
                Report for learner: <strong className="text-slate-900 dark:text-slate-100">{studentName}</strong>
              </p>
            )}
          </div>

          {/* Suggested Date Pill / Source */}
          {suggested ? (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#176B45] dark:text-emerald-400" />
                  <span>Configured Term Schedule</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {suggested.subsequentTermName}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="font-extrabold text-slate-900 dark:text-slate-100">
                  {suggested.formattedDate}
                </span>
                {selectedDate !== suggested.rawDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(suggested.rawDate)}
                    className="text-[10px] font-bold text-[#176B45] dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Reset to Configured
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl p-3 flex items-start space-x-2 text-xs text-amber-900 dark:text-amber-200">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">No Pre-Configured Schedule Found</div>
                <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                  The subsequent term opening date is not set in Academic Sessions. Please specify the date below.
                </div>
              </div>
            </div>
          )}

          {/* Date Selector Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="next-term-date-input"
              className="block text-xs font-extrabold text-slate-900 dark:text-slate-100"
            >
              Select Next Term Opening Date <span className="text-rose-500">*</span>
            </label>
            <input
              id="next-term-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isProcessing}
              required
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:opacity-50 transition"
            />
            {formattedPreview && (
              <div className="flex items-center space-x-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Will appear on official PDF as: <strong>{formattedPreview}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex items-center justify-end space-x-3">
          <button
            type="button"
            id="cancel-next-term-date-btn"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-download-next-term-date-btn"
            onClick={handleConfirm}
            disabled={!isDateValid || isProcessing}
            className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              {isProcessing
                ? 'Generating PDF...'
                : downloadContext === 'batch'
                ? `Confirm & Generate Batch PDF`
                : 'Confirm & Download PDF'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
