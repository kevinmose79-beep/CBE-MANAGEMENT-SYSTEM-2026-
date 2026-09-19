import React, { useState, useRef, useEffect } from 'react';
import {
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Database,
  ChevronDown,
  X,
  Server,
} from 'lucide-react';
import { ConnectionStatus } from '../lib/storage';
import { User } from '../types';

export type StatusCategory = 'checking' | 'interrupted' | 'offline' | 'connected' | 'auth_required';

interface StatusCopy {
  shortLabel: string;
  title: string;
  description: string;
  serverStateLabel: string;
  summaryLabel?: string;
  summaryValue?: string;
}

interface ConnectionStatusIndicatorProps {
  connectionStatus: ConnectionStatus;
  dbStatus?: {
    checking: boolean;
    success: boolean;
    message?: string;
    error?: string;
  };
  currentUser?: User | null;
  onNavigateToDiagnostics?: () => void;
  onRetryConnection?: () => Promise<void> | void;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  connectionStatus,
  dbStatus,
  currentUser,
  onNavigateToDiagnostics,
  onRetryConnection,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number>(Date.now());
  const popoverRef = useRef<HTMLDivElement>(null);

  const role = currentUser?.role;
  const isAdmin = role === 'admin';
  const isLearner = role === 'learner';
  const isTeacher = role === 'class_teacher' || role === 'subject_teacher';

  // Determine normalized status category
  const getStatusCategory = (): StatusCategory => {
    if (connectionStatus === 'offline') {
      return 'offline';
    }
    if (!dbStatus || dbStatus.checking || connectionStatus === 'syncing' || connectionStatus === 'reconnecting') {
      return 'checking';
    }
    if (connectionStatus === 'realtime_unavailable' || !dbStatus.success) {
      return 'interrupted';
    }
    if (!currentUser && typeof window !== 'undefined' && window.location.hash.includes('login')) {
      return 'auth_required';
    }
    if (dbStatus.success === true) {
      return 'connected';
    }
    return 'checking';
  };

  const statusCategory = getStatusCategory();

  // Close popover on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleRetry = async () => {
    if (isRetrying || !onRetryConnection) return;
    setIsRetrying(true);
    try {
      await onRetryConnection();
      setLastCheckedAt(Date.now());
    } finally {
      setTimeout(() => setIsRetrying(false), 800);
    }
  };

  const getLastCheckedText = () => {
    if (!lastCheckedAt) return 'Just now';
    const secondsAgo = Math.floor((Date.now() - lastCheckedAt) / 1000);
    if (secondsAgo < 15) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const mins = Math.floor(secondsAgo / 60);
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    return 'Just now';
  };

  // Role-tailored copy resolution
  const getRoleCopy = (category: StatusCategory): StatusCopy => {
    if (isAdmin) {
      switch (category) {
        case 'connected':
          return {
            shortLabel: 'Connected',
            title: 'System Connected',
            description: 'Connected to the school database.',
            serverStateLabel: 'Server connected',
          };
        case 'checking':
          return {
            shortLabel: 'Connecting…',
            title: 'Connecting to System',
            description: 'Verifying connection and syncing records with the school database.',
            serverStateLabel: 'Checking server connection...',
          };
        case 'interrupted':
          return {
            shortLabel: 'Reconnecting',
            title: 'System Connection',
            description: 'Temporary connection delay. Attempting to reconnect…',
            serverStateLabel: 'Unable to connect to server',
          };
        case 'offline':
          return {
            shortLabel: 'Offline',
            title: 'Offline Mode',
            description: 'No network connection detected. Please check your network connection.',
            serverStateLabel: 'Unable to connect to server',
          };
        case 'auth_required':
          return {
            shortLabel: 'Sign-in Required',
            title: 'Sign-in Required',
            description: 'Your sign-in session requires verification to access school data.',
            serverStateLabel: 'Authentication required',
          };
      }
    }

    if (isLearner) {
      switch (category) {
        case 'connected':
          return {
            shortLabel: 'Connected',
            title: 'System Connection',
            description: "You're ready to continue.",
            serverStateLabel: 'Server connected',
            summaryLabel: 'Status',
            summaryValue: 'Online & Ready',
          };
        case 'checking':
          return {
            shortLabel: 'Checking…',
            title: 'System Connection',
            description: 'Please wait while we connect you to the school portal.',
            serverStateLabel: 'Checking server connection...',
            summaryLabel: 'Status',
            summaryValue: 'Checking connection…',
          };
        case 'interrupted':
          return {
            shortLabel: 'Reconnecting',
            title: 'System Connection',
            description: "We're trying to reconnect. Please check your internet connection.",
            serverStateLabel: 'Unable to connect to server',
            summaryLabel: 'Status',
            summaryValue: 'Attempting to reconnect',
          };
        case 'offline':
          return {
            shortLabel: 'Offline',
            title: 'No Internet Connection',
            description: 'Please check your internet connection and try again.',
            serverStateLabel: 'Unable to connect to server',
            summaryLabel: 'Status',
            summaryValue: 'Offline',
          };
        case 'auth_required':
          return {
            shortLabel: 'Sign-in Required',
            title: 'Sign-in Required',
            description: 'Please sign in to view your classes and progress.',
            serverStateLabel: 'Authentication required',
            summaryLabel: 'Status',
            summaryValue: 'Sign-in required',
          };
      }
    }

    // Default for Teachers (class_teacher, subject_teacher) and general authenticated staff
    switch (category) {
      case 'connected':
        return {
          shortLabel: 'Connected',
          title: 'System Connection',
          description: 'Everything is ready. Your work and assessments are in sync.',
          serverStateLabel: 'Server connected',
          summaryLabel: 'Status',
          summaryValue: 'Ready & In Sync',
        };
      case 'checking':
        return {
          shortLabel: 'Checking…',
          title: 'System Connection',
          description: 'Please wait while we check the school system.',
          serverStateLabel: 'Checking server connection...',
          summaryLabel: 'Status',
          summaryValue: 'Checking connection…',
        };
      case 'interrupted':
        return {
          shortLabel: 'Reconnecting',
          title: 'System Connection',
          description: "We're trying to reconnect. Please check your internet connection.",
          serverStateLabel: 'Unable to connect to server',
          summaryLabel: 'Status',
          summaryValue: 'Attempting to reconnect',
        };
      case 'offline':
        return {
          shortLabel: 'Offline',
          title: "You're Offline",
          description: 'Please check your internet connection and try again.',
          serverStateLabel: 'Unable to connect to server',
          summaryLabel: 'Status',
          summaryValue: 'Offline',
        };
      case 'auth_required':
        return {
          shortLabel: 'Sign-in Required',
          title: 'Sign-in Required',
          description: 'Please sign in to access your classes and assessments.',
          serverStateLabel: 'Authentication required',
          summaryLabel: 'Status',
          summaryValue: 'Sign-in required',
        };
    }
  };

  const copy = getRoleCopy(statusCategory);

  // Config mapping for visual styles & status badges
  const config = {
    connected: {
      dotBg: 'bg-emerald-400',
      pillBg: 'bg-[#0d4f32] hover:bg-[#0b422a] border-[#087F5B]/50 text-emerald-100',
      icon: CheckCircle2,
      badgeText: 'Online',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      accentColor: 'text-[#176B45] dark:text-emerald-400',
      indicatorDot: 'bg-emerald-500',
    },
    checking: {
      dotBg: 'bg-amber-400 animate-pulse',
      pillBg: 'bg-amber-900/60 hover:bg-amber-900/80 border-amber-500/40 text-amber-100',
      icon: RefreshCw,
      iconClass: 'animate-spin',
      badgeText: 'Checking',
      badgeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      accentColor: 'text-amber-600 dark:text-amber-400',
      indicatorDot: 'bg-amber-500 animate-pulse',
    },
    interrupted: {
      dotBg: 'bg-amber-400',
      pillBg: 'bg-amber-900/60 hover:bg-amber-900/80 border-amber-500/40 text-amber-100',
      icon: AlertTriangle,
      badgeText: 'Offline',
      badgeClass: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      accentColor: 'text-rose-600 dark:text-rose-400',
      indicatorDot: 'bg-rose-500',
    },
    offline: {
      dotBg: 'bg-rose-400',
      pillBg: 'bg-rose-900/70 hover:bg-rose-900/90 border-rose-500/50 text-rose-100',
      icon: WifiOff,
      badgeText: 'Offline',
      badgeClass: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      accentColor: 'text-rose-600 dark:text-rose-400',
      indicatorDot: 'bg-rose-500',
    },
    auth_required: {
      dotBg: 'bg-blue-400',
      pillBg: 'bg-blue-900/60 hover:bg-blue-900/80 border-blue-500/40 text-blue-100',
      icon: Shield,
      badgeText: 'Sign-in',
      badgeClass: 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      accentColor: 'text-blue-600 dark:text-blue-400',
      indicatorDot: 'bg-blue-500',
    },
  }[statusCategory];

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Compact Status Pill Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${config.pillBg}`}
        title={`System Connection: ${copy.shortLabel}. Click for details.`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        role="status"
        aria-live="polite"
      >
        <span className={`w-2 h-2 rounded-full ${config.dotBg} shrink-0`} />
        <span className="hidden sm:inline font-medium">{copy.shortLabel}</span>
        <ChevronDown className={`w-3 h-3 opacity-75 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Accessible Detail Popover Card - Option 1 + Option 3 Hybrid */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="System Connection Details"
          className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl shadow-slate-900/10 z-50 p-4 text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-3.5"
        >
          {/* Card Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#176B45] dark:text-emerald-400 shrink-0" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                System Connection
              </h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close connection status card"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Option 3 Clear Status Badge & Hierarchy Block */}
          <div className="bg-slate-50/80 dark:bg-slate-950/60 rounded-lg p-3 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Server State
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${config.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.indicatorDot}`} />
                <span>{config.badgeText}</span>
              </span>
            </div>

            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {copy.serverStateLabel}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {copy.description}
              </p>
            </div>

            {/* Admin Breakdown detail lines if Admin */}
            {isAdmin && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1 text-[11px]">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Network</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {connectionStatus === 'offline' ? 'Offline' : 'Online'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>School Database</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {statusCategory === 'connected' ? 'Connected' : 'Connecting…'}
                  </span>
                </div>
              </div>
            )}

            {/* Last checked timestamp line */}
            <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
              <span>Last checked</span>
              <span className="font-medium text-slate-600 dark:text-slate-400">{getLastCheckedText()}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {onRetryConnection && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#176B45] hover:bg-[#125436] text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#176B45]/40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Checking…' : 'Check Connection'}</span>
              </button>
            )}

            {/* Administrator Diagnostics Access (Strictly Admin Only) */}
            {isAdmin && onNavigateToDiagnostics && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToDiagnostics();
                }}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                title="Open Database Diagnostics"
              >
                <Database className="w-3.5 h-3.5 text-[#176B45] dark:text-emerald-400" />
                <span>Diagnostics</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

