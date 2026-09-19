import React from 'react';
import { Clock, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { WarningType } from '../utils/useInactivityMonitor';

interface InactivityWarningToastProps {
  isOpen: boolean;
  warningType?: WarningType | null;
  onStaySignedIn: () => void;
  onDismiss?: () => void;
  minutesRemaining?: number;
}

export const InactivityWarningToast: React.FC<InactivityWarningToastProps> = ({
  isOpen,
  warningType = 'inactivity',
  onStaySignedIn,
  onDismiss,
  minutesRemaining,
}) => {
  if (!isOpen) return null;

  const isMaxSession = warningType === 'max_session';
  const defaultMinutes = isMaxSession ? 15 : 5;
  const remaining = minutesRemaining ?? defaultMinutes;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-40 max-w-sm bg-slate-900/95 dark:bg-slate-950/95 border border-amber-500/40 text-slate-100 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
          {isMaxSession ? (
            <AlertTriangle className="w-4 h-4 animate-pulse" />
          ) : (
            <Clock className="w-4 h-4 animate-pulse" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-semibold text-amber-200">
            {isMaxSession
              ? 'Your session reaches its limit in 15 minutes'
              : "You'll be signed out soon"}
          </h4>
          <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">
            {isMaxSession
              ? 'Please save your work. 8-hour maximum session limit approaching.'
              : `Session expiring due to inactivity in ~${remaining}m.`}
          </p>
        </div>
        {isMaxSession ? (
          <button
            type="button"
            onClick={onDismiss || onStaySignedIn}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs transition cursor-pointer border border-amber-500/30 flex items-center space-x-1"
          >
            <X className="w-3 h-3" />
            <span>Dismiss</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStaySignedIn}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-xs flex items-center space-x-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Stay Signed In</span>
          </button>
        )}
      </div>
    </div>
  );
};
