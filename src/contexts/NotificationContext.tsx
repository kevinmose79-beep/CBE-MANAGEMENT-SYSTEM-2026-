import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  createdAt: number;
}

export interface NotificationContextType {
  showNotification: (type: NotificationType, message: string, duration?: number) => string;
  dismissNotification: (id: string) => void;
  notifications: NotificationItem[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissNotification = useCallback((id: string) => {
    // Clear scheduled timer if any
    const timer = timeoutsRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timeoutsRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showNotification = useCallback(
    (type: NotificationType, message: string, customDuration?: number) => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const duration = customDuration !== undefined ? customDuration : DEFAULT_DURATIONS[type];

      const item: NotificationItem = {
        id,
        type,
        message,
        duration,
        createdAt: Date.now(),
      };

      setNotifications((prev) => [...prev, item]);

      // Schedule auto-dismiss if duration > 0
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissNotification(id);
        }, duration);
        timeoutsRef.current.set(id, timer);
      }

      return id;
    },
    [dismissNotification]
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const currentTimers = timeoutsRef.current;
    return () => {
      currentTimers.forEach((timer) => clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        dismissNotification,
        notifications,
      }}
    >
      {children}
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// UI Notification Container
interface NotificationContainerProps {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onDismiss,
}) => {
  if (notifications.length === 0) return null;

  return (
    <aside
      aria-label="System Notifications"
      className="fixed top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 sm:top-[calc(1.25rem+env(safe-area-inset-top,0px))] sm:right-5 left-4 sm:left-auto z-[9999] flex flex-col gap-2.5 max-w-md w-full sm:w-96 pointer-events-none"
    >
      {notifications.map((item) => (
        <NotificationToast key={item.id} notification={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </aside>
  );
};

interface NotificationToastProps {
  notification: NotificationItem;
  onDismiss: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onDismiss }) => {
  const { type, message } = notification;

  const config = {
    success: {
      containerClass:
        'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100',
      iconBadgeClass: 'bg-emerald-600 dark:bg-emerald-500 text-white',
      dismissHoverClass: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
      icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" />,
      label: 'Success',
    },
    error: {
      containerClass:
        'bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100',
      iconBadgeClass: 'bg-rose-600 dark:bg-rose-500 text-white',
      dismissHoverClass: 'hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300',
      icon: <AlertCircle className="w-4 h-4" aria-hidden="true" />,
      label: 'Error',
    },
    warning: {
      containerClass:
        'bg-amber-50 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100',
      iconBadgeClass: 'bg-amber-600 dark:bg-amber-500 text-white',
      dismissHoverClass: 'hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300',
      icon: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
      label: 'Warning',
    },
    info: {
      containerClass:
        'bg-sky-50 dark:bg-sky-950/90 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100',
      iconBadgeClass: 'bg-sky-600 dark:bg-sky-500 text-white',
      dismissHoverClass: 'hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300',
      icon: <Info className="w-4 h-4" aria-hidden="true" />,
      label: 'Information',
    },
  }[type];

  const role = type === 'error' ? 'alert' : 'status';
  const ariaLive = type === 'error' ? 'assertive' : 'polite';

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-2xl border shadow-lg backdrop-blur-xs transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${config.containerClass}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${config.iconBadgeClass}`}
        >
          {config.icon}
        </div>
        <div className="flex flex-col min-w-0 pt-0.5">
          <span className="sr-only">{config.label}: </span>
          <p className="text-xs font-medium leading-relaxed break-words">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={`p-1 rounded-lg transition-colors shrink-0 cursor-pointer ${config.dismissHoverClass}`}
        aria-label="Dismiss notification"
        title="Dismiss notification"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};
