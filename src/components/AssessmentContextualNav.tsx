import React, { useState, useEffect, useRef } from 'react';
import {
  BookMarked,
  FileSpreadsheet,
  BarChart3,
  ShieldCheck,
  CheckSquare,
  FileBarChart,
  ChevronRight,
  ChevronDown,
  Check,
  Layers,
} from 'lucide-react';
import { Role } from '../types';
import { TabType } from './Sidebar';

interface AssessmentContextualNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  userRole: Role;
}

interface AssessmentNavItem {
  id: TabType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export const AssessmentContextualNav: React.FC<AssessmentContextualNavProps> = ({
  activeTab,
  onSelectTab,
  userRole,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  const getNavItems = (): AssessmentNavItem[] => {
    if (userRole === 'admin') {
      return [
        {
          id: 'exams',
          label: 'Assessment Setup',
          description: 'Create and configure assessments',
          icon: <BookMarked className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'marks-entry',
          label: 'Marks Entry',
          description: 'Enter and manage learner marks',
          icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'marks-monitoring',
          label: 'Marks Monitoring',
          description: 'Monitor assessment completion',
          icon: <BarChart3 className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'exam-validation',
          label: 'Assessment Analyser',
          description: 'Analyse and diagnose assessment results',
          icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'provisional',
          label: 'Provisional Results',
          description: 'Review learner results before approval',
          icon: <CheckSquare className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'results-approval',
          label: 'Results Approval',
          description: 'Review, approve and lock results',
          icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'reports',
          label: 'Reports & Merit Lists',
          description: 'Generate reports and merit lists',
          icon: <FileBarChart className="w-4 h-4 shrink-0" />,
        },
      ];
    }

    if (userRole === 'class_teacher') {
      return [
        {
          id: 'marks-entry',
          label: 'Enter Marks',
          description: 'Enter and manage learner marks',
          icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'class-marks-monitoring',
          label: 'Class Marks Monitoring',
          description: 'Monitor class marks completion',
          icon: <BarChart3 className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'provisional',
          label: 'Provisional Results',
          description: 'Review learner results before approval',
          icon: <CheckSquare className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'results-approval',
          label: 'Results Approval',
          description: 'Review, approve and lock results',
          icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'reports',
          label: 'Reports & Merit Lists',
          description: 'Generate reports and merit lists',
          icon: <FileBarChart className="w-4 h-4 shrink-0" />,
        },
      ];
    }

    // subject_teacher
    return [
      {
        id: 'marks-entry',
        label: 'Enter Marks',
        description: 'Enter learner marks for assigned learning areas',
        icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
      },
      {
        id: 'reports',
        label: 'Learning Area Performance',
        description: 'Generate reports and view performance',
        icon: <FileBarChart className="w-4 h-4 shrink-0" />,
      },
    ];
  };

  const navItems = getNavItems();

  const isItemActive = (item: AssessmentNavItem) =>
    activeTab === item.id || (item.id === 'results-approval' && activeTab === 'stream-approval');

  const currentActiveItem = navItems.find(isItemActive) || navItems[0];

  // Close on outside tap
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (
        isMobileOpen &&
        mobileNavRef.current &&
        !mobileNavRef.current.contains(event.target as Node)
      ) {
        setIsMobileOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isMobileOpen && event.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMobileOpen]);

  const handleSelectMobileModule = (tabId: TabType) => {
    onSelectTab(tabId);
    setIsMobileOpen(false);
  };

  return (
    <nav
      id="assessment-summary-nav"
      aria-label="Assessment Navigation Flow"
      className="mb-4 sm:mb-6"
    >
      {/* MOBILE & TABLET: COLLAPSIBLE MODULE SELECTOR */}
      <div
        ref={mobileNavRef}
        id="assessment-mobile-module-selector"
        className="block lg:hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-200"
      >
        {/* Collapsed Compact Trigger */}
        <button
          type="button"
          id="assessment-mobile-selector-trigger"
          aria-expanded={isMobileOpen}
          aria-haspopup="listbox"
          aria-label={`Assessment Hub Module Selector. Current module: ${currentActiveItem.label}`}
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="w-full text-left p-3 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#176B45]/40 active:bg-slate-50 dark:active:bg-slate-800/80 transition-colors"
        >
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <div className="p-2 rounded-lg bg-[#176B45] text-white dark:bg-emerald-600 shadow-xs shrink-0">
              {currentActiveItem.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500">
                  Assessment Hub
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 text-[8px] font-extrabold uppercase tracking-wider rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60">
                  Active
                </span>
              </div>
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                {currentActiveItem.label}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 pl-1">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              {isMobileOpen ? 'Close' : 'Switch'}
            </span>
            <div
              className={`p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-transform duration-200 ${
                isMobileOpen ? 'rotate-180 text-[#176B45] dark:text-emerald-400' : ''
              }`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </button>

        {/* Expanded Module List on Mobile */}
        {isMobileOpen && (
          <div
            id="assessment-mobile-module-list"
            role="listbox"
            aria-label="Assessment Hub Modules"
            className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-2 space-y-1.5 animate-in slide-in-from-top-2 duration-150"
          >
            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span className="flex items-center space-x-1">
                <Layers className="w-3 h-3" />
                <span>Select Assessment Module</span>
              </span>
              <span>{navItems.length} Available</span>
            </div>

            {navItems.map((item) => {
              const active = isItemActive(item);
              return (
                <button
                  key={item.id}
                  id={`mobile-assessment-nav-${item.id}`}
                  role="option"
                  aria-selected={active}
                  type="button"
                  onClick={() => handleSelectMobileModule(item.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#176B45]/30 ${
                    active
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500/60 dark:border-emerald-600/70 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div
                      className={`p-1.5 rounded-md shrink-0 transition-colors ${
                        active
                          ? 'bg-[#176B45] text-white dark:bg-emerald-600 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`text-xs font-bold truncate block ${
                            active
                              ? 'text-emerald-950 dark:text-emerald-200 font-extrabold'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {item.label}
                        </span>
                        {active && (
                          <span className="inline-flex items-center px-1 py-0.2 text-[8px] font-extrabold uppercase tracking-wider rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                            Current
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[10px] truncate leading-tight mt-0.5 ${
                          active
                            ? 'text-emerald-800/80 dark:text-emerald-300/80'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-1">
                    {active ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* DESKTOP VIEW: MULTI-COLUMN GRID (PRESERVED) */}
      <div
        id="assessment-desktop-module-nav"
        className="hidden lg:block bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <BookMarked className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                Assessments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-none">
                Manage the complete assessment flow
              </p>
            </div>
          </div>
        </div>

        {/* Grid / List of Assessment Navigation Items */}
        <div
          role="tablist"
          aria-label="Assessment Flow Steps"
          className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5"
        >
          {navItems.map((item) => {
            const isActive = isItemActive(item);
            return (
              <button
                key={item.id}
                id={`assessment-nav-${item.id}`}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => onSelectTab(item.id)}
                className={`group text-left p-3 rounded-lg border transition-all duration-150 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#176B45]/30 dark:focus:ring-emerald-500/30 ${
                  isActive
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500/60 dark:border-emerald-600/70 shadow-xs'
                    : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                  <div
                    className={`p-2 rounded-lg shrink-0 transition-colors ${
                      isActive
                        ? 'bg-[#176B45] text-white dark:bg-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700/60 group-hover:text-slate-900 dark:group-hover:text-slate-200 group-hover:border-slate-300'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`text-xs font-bold truncate block ${
                          isActive
                            ? 'text-emerald-950 dark:text-emerald-200'
                            : 'text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white'
                        }`}
                      >
                        {item.label}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60">
                          Active
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] truncate leading-tight mt-0.5 ${
                        isActive
                          ? 'text-emerald-800/80 dark:text-emerald-300/80'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>

                <ChevronRight
                  className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                    isActive
                      ? 'text-[#176B45] dark:text-emerald-400 translate-x-0.5'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

