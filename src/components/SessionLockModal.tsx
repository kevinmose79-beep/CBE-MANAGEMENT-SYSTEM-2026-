import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, LogOut, ArrowRight, Loader2, ShieldCheck, Clock } from 'lucide-react';
import { User, School } from '../types';
import { authService } from '../services/authService';
import { getUserFriendlyErrorMessage } from '../utils/errorUtils';
import { LockReason } from '../utils/useInactivityMonitor';

interface SessionLockModalProps {
  isOpen: boolean;
  lockReason?: LockReason | null;
  currentUser: User | null;
  school: School;
  onUnlock: (user: User) => void;
  onSignOut: () => void;
}

export const SessionLockModal: React.FC<SessionLockModalProps> = ({
  isOpen,
  lockReason = 'inactivity',
  currentUser,
  school,
  onUnlock,
  onSignOut,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const isMaxSession = lockReason === 'max_session';

  const handleReAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = isMaxSession
        ? await authService.signIn(currentUser.email, password)
        : await authService.reauthenticate(currentUser.email, password);
      if (result.error) {
        setErrorMessage(
          getUserFriendlyErrorMessage(
            result.error,
            'Incorrect password. Please verify and try again.'
          )
        );
      } else if (result.user) {
        setPassword('');
        setErrorMessage(null);
        onUnlock(result.user);
      } else {
        setErrorMessage('Authentication failed. Please check your password.');
      }
    } catch (err: any) {
      setErrorMessage(
        getUserFriendlyErrorMessage(
          err,
          'An unexpected authentication error occurred. Please try again.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'class_teacher':
        return 'Class Teacher';
      case 'subject_teacher':
        return 'Subject Teacher';
      case 'learner':
        return 'Learner';
      default:
        return 'User';
    }
  };

  const getRoleBadgeClasses = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/50';
      case 'class_teacher':
      case 'subject_teacher':
        return 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50';
      case 'learner':
        return 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/50';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-lock-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 mb-1 shadow-xs">
            {isMaxSession ? (
              <Clock className="w-7 h-7" />
            ) : (
              <Lock className="w-7 h-7" />
            )}
          </div>
          <h2 id="session-lock-title" className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {isMaxSession ? 'Session Limit Reached' : 'Workspace Locked'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
            {isMaxSession
              ? 'Your 8-hour maximum session has ended. Please sign in again to continue.'
              : 'Your session was locked after 30 minutes of inactivity to safeguard assessment data.'}
          </p>
        </div>

        {/* User Badge */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {currentUser.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {currentUser.email}
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 border ${getRoleBadgeClasses(currentUser.role)}`}>
            {getRoleLabel(currentUser.role)}
          </span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-medium animate-in fade-in duration-150"
          >
            {errorMessage}
          </div>
        )}

        {/* Re-Authentication Form */}
        <form onSubmit={handleReAuthenticate} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="reauth-password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Enter Password to Unlock
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="reauth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoFocus
                disabled={isLoading}
                className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying credentials…</span>
              </>
            ) : (
              <>
                <span>Unlock Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Unsaved entries preserved</span>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign in as different user</span>
          </button>
        </div>
      </div>
    </div>
  );
};
