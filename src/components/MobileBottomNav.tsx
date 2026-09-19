import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileSpreadsheet,
  FileBarChart,
  Building2,
  Menu,
  Sparkles,
  Plus,
  BookOpen,
  UserPlus,
  GraduationCap,
  X
} from 'lucide-react';
import { User, Role } from '../types';
import { TabType } from './Sidebar';
import { ROLE_ALLOWED_TABS } from '../utils/rbacUtils';

interface MobileBottomNavProps {
  currentRole: Role;
  currentUser?: User | null;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenMore: () => void;
}

interface NavItemConfig {
  id: string;
  tab?: TabType;
  label: string;
  icon: React.ElementType;
  isCenterAction?: boolean;
  action?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRole,
  activeTab,
  onSelectTab,
  onOpenMore,
}) => {
  const [isAdminQuickActionOpen, setIsAdminQuickActionOpen] = useState(false);

  // Suppress completely for learner role (Learner portal has self-contained tabs)
  if (currentRole === 'learner') {
    return null;
  }

  // Teacher navigation definitions
  const getNavItems = (): NavItemConfig[] => {
    if (currentRole === 'subject_teacher') {
      return [
        {
          id: 'dashboard',
          tab: 'dashboard',
          label: 'Home',
          icon: LayoutDashboard,
        },
        {
          id: 'academic-session',
          tab: 'academic-session',
          label: 'Sessions',
          icon: CalendarDays,
        },
        {
          id: 'center-marks',
          tab: 'marks-entry',
          label: 'Enter Marks',
          icon: FileSpreadsheet,
          isCenterAction: true,
        },
        {
          id: 'reports',
          tab: 'reports',
          label: 'Reports',
          icon: FileBarChart,
        },
        {
          id: 'more',
          label: 'More',
          icon: Menu,
          action: onOpenMore,
        },
      ];
    }

    if (currentRole === 'class_teacher') {
      return [
        {
          id: 'dashboard',
          tab: 'dashboard',
          label: 'Home',
          icon: LayoutDashboard,
        },
        {
          id: 'students',
          tab: 'students',
          label: 'Learners',
          icon: Users,
        },
        {
          id: 'center-marks',
          tab: 'marks-entry',
          label: 'Enter Marks',
          icon: FileSpreadsheet,
          isCenterAction: true,
        },
        {
          id: 'reports',
          tab: 'reports',
          label: 'Reports',
          icon: FileBarChart,
        },
        {
          id: 'more',
          label: 'More',
          icon: Menu,
          action: onOpenMore,
        },
      ];
    }

    // Administrator navigation
    return [
      {
        id: 'dashboard',
        tab: 'dashboard',
        label: 'Home',
        icon: LayoutDashboard,
      },
      {
        id: 'students',
        tab: 'students',
        label: 'Learners',
        icon: Users,
      },
      {
        id: 'center-admin-action',
        label: 'Actions',
        icon: Plus,
        isCenterAction: true,
        action: () => setIsAdminQuickActionOpen(true),
      },
      {
        id: 'classes',
        tab: 'classes',
        label: 'Classes',
        icon: Building2,
      },
      {
        id: 'more',
        label: 'More',
        icon: Menu,
        action: onOpenMore,
      },
    ];
  };

  const navItems = getNavItems();

  const handleItemClick = (item: NavItemConfig) => {
    if (item.action) {
      item.action();
      return;
    }

    if (item.tab) {
      const allowedTabs = ROLE_ALLOWED_TABS[currentRole] || [];
      if (allowedTabs.includes(item.tab)) {
        onSelectTab(item.tab);
      }
    }
  };

  return (
    <>
      {/* Admin Quick Action Bottom Sheet */}
      {isAdminQuickActionOpen && currentRole === 'admin' && (
        <div
          id="admin-quick-action-backdrop"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center md:hidden animate-in fade-in duration-200"
          onClick={() => setIsAdminQuickActionOpen(false)}
        >
          <div
            id="admin-quick-action-sheet"
            className="w-full max-w-lg bg-white dark:bg-[#161a1d] rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl p-5 pb-[max(2rem,calc(1.5rem+env(safe-area-inset-bottom,0px)))] pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] space-y-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Administrator Quick Actions
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Direct access to primary workflows
                  </p>
                </div>
              </div>
              <button
                id="btn-close-quick-action"
                onClick={() => setIsAdminQuickActionOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close Quick Actions"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                id="btn-quick-marks"
                onClick={() => {
                  setIsAdminQuickActionOpen(false);
                  onSelectTab('marks-entry');
                }}
                className="flex items-center space-x-3 p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 transition active:scale-[0.98] cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Enter Marks</div>
                  <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 truncate">Input scores</div>
                </div>
              </button>

              <button
                id="btn-quick-exams"
                onClick={() => {
                  setIsAdminQuickActionOpen(false);
                  onSelectTab('exams');
                }}
                className="flex items-center space-x-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition active:scale-[0.98] cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Examinations</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Manage exams</div>
                </div>
              </button>

              <button
                id="btn-quick-students"
                onClick={() => {
                  setIsAdminQuickActionOpen(false);
                  onSelectTab('students');
                }}
                className="flex items-center space-x-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition active:scale-[0.98] cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Register Learner</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Enroll student</div>
                </div>
              </button>

              <button
                id="btn-quick-teachers"
                onClick={() => {
                  setIsAdminQuickActionOpen(false);
                  onSelectTab('teachers');
                }}
                className="flex items-center space-x-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition active:scale-[0.98] cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Teachers</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Staff & allocation</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Fixed Bottom Navigation Bar */}
      <nav
        id="mobile-bottom-navigation"
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-[#161a1d]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom,0px)] transition-all duration-200"
      >
        <div className="max-w-md mx-auto px-2 h-16 flex items-center justify-around">
          {navItems.map((item) => {
            const isTabActive = Boolean(item.tab && activeTab === item.tab);
            const Icon = item.icon;

            if (item.isCenterAction) {
              return (
                <div key={item.id} className="relative -top-3 flex flex-col items-center">
                  <button
                    id={`mobile-nav-${item.id}`}
                    onClick={() => handleItemClick(item)}
                    aria-label={item.label}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-150 active:scale-95 cursor-pointer outline-none focus:outline-none focus-visible:outline-none select-none ${
                      isTabActive
                        ? 'bg-emerald-700 ring-4 ring-emerald-100 dark:ring-emerald-950/80'
                        : 'bg-emerald-600 hover:bg-emerald-700 ring-4 ring-white dark:ring-[#161a1d] shadow-emerald-600/30'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                  <span
                    className={`text-[10px] font-semibold mt-0.5 tracking-tight ${
                      isTabActive
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => handleItemClick(item)}
                aria-label={item.label}
                aria-current={isTabActive ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center justify-center h-full min-h-[48px] py-1 px-1 transition-colors duration-150 active:scale-95 cursor-pointer outline-none focus:outline-none focus-visible:outline-none select-none ${
                  isTabActive
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-150 ${
                      isTabActive ? 'scale-110 stroke-[2.25]' : 'stroke-[1.75]'
                    }`}
                  />
                  {isTabActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight truncate max-w-[64px] mt-1 ${
                    isTabActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
