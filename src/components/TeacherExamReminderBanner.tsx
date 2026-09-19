import React from 'react';
import {
  Bell,
  FileSpreadsheet,
  ChevronRight,
  X,
  FileBarChart,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import {
  TeacherExamReminderSummary,
  ReminderBadgeType,
} from '../utils/teacherExamReminderUtils';

export interface SemanticNotificationStyles {
  container: string;
  iconBg: string;
  badge: string;
  btn: string;
  bellAnimation: string;
}

/**
 * Maps reminder badge types to coherent, accessible semantic design tokens.
 * Matches the visual design language of the Academic Term Reminder Banner.
 */
export function getSemanticNotificationStyles(
  badgeType: ReminderBadgeType | 'urgent' | 'warning' | 'info' | 'success' | 'neutral' | 'critical'
): SemanticNotificationStyles {
  switch (badgeType) {
    case 'urgent':
      return {
        container:
          'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300/80 dark:border-amber-800 text-amber-950 dark:text-amber-100',
        iconBg: 'bg-amber-500 dark:bg-amber-600 text-white',
        badge:
          'bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
        btn: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-400',
        bellAnimation: 'animate-bounce motion-reduce:animate-none',
      };

    case 'warning':
      return {
        container:
          'bg-orange-50/90 dark:bg-orange-950/40 border-orange-300/80 dark:border-orange-800 text-orange-950 dark:text-orange-100',
        iconBg: 'bg-orange-500 dark:bg-orange-600 text-white',
        badge:
          'bg-orange-200/70 dark:bg-orange-900/60 text-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700',
        btn: 'bg-orange-600 hover:bg-orange-700 text-white focus:ring-orange-400',
        bellAnimation: 'animate-pulse motion-reduce:animate-none',
      };

    case 'critical':
      return {
        container:
          'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300/80 dark:border-rose-800 text-rose-950 dark:text-rose-100',
        iconBg: 'bg-rose-600 dark:bg-rose-700 text-white',
        badge:
          'bg-rose-200/70 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700',
        btn: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-400',
        bellAnimation: 'animate-bounce motion-reduce:animate-none',
      };

    case 'success':
      return {
        container:
          'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300/80 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100',
        iconBg: 'bg-[#176B45] dark:bg-[#2E7D5B] text-white',
        badge:
          'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
        btn: 'bg-[#176B45] hover:bg-[#0F5132] text-white focus:ring-emerald-400',
        bellAnimation: 'motion-reduce:animate-none',
      };

    case 'info':
      return {
        container:
          'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300/80 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100',
        iconBg: 'bg-[#176B45] dark:bg-[#2E7D5B] text-white',
        badge:
          'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
        btn: 'bg-[#176B45] hover:bg-[#0F5132] text-white focus:ring-emerald-400',
        bellAnimation: 'motion-reduce:animate-none',
      };

    case 'neutral':
    default:
      return {
        container:
          'bg-slate-50/90 dark:bg-slate-900/60 border-slate-300/80 dark:border-slate-800 text-slate-950 dark:text-slate-100',
        iconBg: 'bg-slate-700 dark:bg-slate-700 text-white',
        badge:
          'bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        btn: 'bg-slate-700 hover:bg-slate-800 text-white focus:ring-slate-400',
        bellAnimation: 'motion-reduce:animate-none',
      };
  }
}

interface TeacherExamReminderBannerProps {
  reminder: TeacherExamReminderSummary;
  onNavigate: (tab: any, context?: any) => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export const TeacherExamReminderBanner: React.FC<TeacherExamReminderBannerProps> = ({
  reminder,
  onNavigate,
  onDismiss,
  compact = false,
}) => {
  // If there's no active exam or no priority, don't render anything
  if (!reminder.hasActiveExam || reminder.reminderPriority === 'none') {
    return null;
  }

  const {
    badgeType,
    badgeLabel,
    title,
    headline,
    subtext,
    secondaryNote,
    primaryAction,
    primaryActionLabel,
    primaryActionTab,
    primaryActionContext,
  } = reminder;

  // Resolve semantic color and animation styles based on badgeType
  const styles = getSemanticNotificationStyles(badgeType);

  const handleActionClick = () => {
    if (primaryActionTab) {
      onNavigate(primaryActionTab, primaryActionContext);
    }
  };

  return (
    <div
      role="region"
      aria-label="Examination Reminder"
      className={`rounded-xl border shadow-xs transition-all duration-200 ${styles.container} ${
        compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Bell Icon & Notification Content */}
        <div className="flex items-start space-x-3 min-w-0 flex-1">
          {/* Notification Bell Icon in Semantic Container */}
          <div
            data-testid="exam-reminder-bell-container"
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${styles.iconBg}`}
          >
            <Bell
              data-testid="exam-reminder-bell-icon"
              className={`w-4 h-4 text-white ${styles.bellAnimation}`}
            />
          </div>

          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span
                className={`text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${styles.badge}`}
              >
                {badgeLabel}
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {title}
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 pt-0.5">
              {headline}
            </h3>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {subtext}
            </p>

            {secondaryNote && (
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 pt-0.5 italic">
                {secondaryNote}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0 justify-end pt-1 sm:pt-0">
          {primaryAction !== 'none' && primaryActionTab && (
            <button
              type="button"
              onClick={handleActionClick}
              className={`flex-1 sm:flex-none text-xs font-semibold px-3.5 py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 active:scale-[0.98] ${styles.btn}`}
            >
              {primaryAction === 'enter_marks' ? (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              ) : primaryAction === 'stream_approval' ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : primaryAction === 'view_monitoring' ? (
                <ClipboardList className="w-3.5 h-3.5" />
              ) : (
                <FileBarChart className="w-3.5 h-3.5" />
              )}
              <span>{primaryActionLabel}</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss Reminder"
              title="Dismiss reminder"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
