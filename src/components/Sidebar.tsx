import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Building2,
  BookMarked,
  FileSpreadsheet,
  CheckSquare,
  FileBarChart,
  Settings,
  X,
  LogOut,
  TrendingUp,
  CalendarDays,
  Calendar,
  ArrowUpRight,
  Database,
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Role } from '../types';
import { useConnectionStatus } from '../utils/useConnectionStatus';

export type TabType =
  | 'dashboard'
  | 'academic-session'
  | 'students'
  | 'student-promotion'
  | 'teachers'
  | 'classes'
  | 'subjects'
  | 'exams'
  | 'marks-entry'
  | 'marks-monitoring'
  | 'class-marks-monitoring'
  | 'stream-approval'
  | 'results-approval'
  | 'provisional'
  | 'exam-validation'
  | 'reports'
  | 'school-analytics'
  | 'grading'
  | 'school-profile'
  | 'system-settings'
  | 'developer-mode'
  | 'learner-portal';

interface SidebarProps {
  currentRole: Role;
  isClassTeacher?: boolean;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLogout?: () => void;
}

const isItemActive = (itemId: TabType | string, currentTab: TabType): boolean => {
  if (itemId === currentTab) return true;
  // Classes & Subjects unified
  if (itemId === 'classes' && (currentTab === 'classes' || currentTab === 'subjects')) {
    return true;
  }
  // Assessments unified (Admin)
  if (
    itemId === 'exams' &&
    ['exams', 'marks-entry', 'marks-monitoring', 'class-marks-monitoring', 'stream-approval', 'results-approval', 'exam-validation', 'provisional', 'reports'].includes(currentTab)
  ) {
    return true;
  }
  // Assessments unified (Teachers)
  if (
    itemId === 'marks-entry' &&
    ['marks-entry', 'class-marks-monitoring', 'stream-approval', 'results-approval', 'provisional', 'reports'].includes(currentTab)
  ) {
    return true;
  }
  return false;
};

interface NavItemDef {
  id: TabType | string;
  label: string;
  icon: React.ReactNode;
  children?: NavItemDef[];
}

interface NavGroupDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: NavItemDef[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  isClassTeacher = false,
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onLogout,
}) => {
  const connectionStatus = useConnectionStatus();

  // Define group structures per role
  const getNavGroups = (): NavGroupDef[] => {
    if (currentRole === 'admin') {
      return [
        {
          id: 'group_dashboard',
          title: 'Dashboard',
          icon: <LayoutDashboard className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
          ],
        },
        {
          id: 'group_academic',
          title: 'Academic Management',
          icon: <GraduationCap className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'academic-session', label: 'Academic Years & Terms', icon: <CalendarDays className="w-4 h-4 text-[#E8F3EE]" /> },
            { id: 'classes', label: 'Classes & Learning Areas', icon: <Building2 className="w-4 h-4" /> },
            { id: 'student-promotion', label: 'Student Promotion', icon: <ArrowUpRight className="w-4 h-4 text-[#E8F3EE]" /> },
          ],
        },
        {
          id: 'group_learners',
          title: 'Learners',
          icon: <Users className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'students', label: 'Learners Roster', icon: <Users className="w-4 h-4" /> },
          ],
        },
        {
          id: 'group_staff',
          title: 'Staff',
          icon: <UserCheck className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'teachers', label: 'Teachers Management', icon: <UserCheck className="w-4 h-4" /> },
          ],
        },
        {
          id: 'group_assessments',
          title: 'Assessments',
          icon: <BookMarked className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'exams', label: 'Assessments', icon: <BookMarked className="w-4 h-4" /> },
          ],
        },
        {
          id: 'group_analytics',
          title: 'Analytics',
          icon: <TrendingUp className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'school-analytics', label: 'School Analytics & Rankings', icon: <TrendingUp className="w-4 h-4 text-[#E8F3EE]" /> },
          ],
        },
        {
          id: 'group_administration',
          title: 'Settings',
          icon: <Settings className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'system-settings', label: 'Settings', icon: <Settings className="w-4 h-4 text-[#E8F3EE]" /> },
          ],
        },
      ];
    } else if (currentRole === 'class_teacher' || currentRole === 'subject_teacher') {
      const isClassTeacherRole = currentRole === 'class_teacher';
      const teacherItems: NavGroupDef[] = [];
      
      teacherItems.push(
        {
          id: 'group_dashboard',
          title: 'Dashboard',
          icon: <LayoutDashboard className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'dashboard', label: 'My Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
          ],
        },
        {
          id: 'group_academic',
          title: 'Academic Management',
          icon: <GraduationCap className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'academic-session', label: 'Academic Terms Info', icon: <CalendarDays className="w-4 h-4 text-[#E8F3EE]" /> },
          ],
        }
      );

      if (isClassTeacherRole) {
        teacherItems.push({
          id: 'group_learners',
          title: 'Learners',
          icon: <Users className="w-4 h-4 text-[#E8F3EE]" />,
          items: [
            { id: 'students', label: 'Learner Roster', icon: <Users className="w-4 h-4" /> },
          ],
        });
      }

      teacherItems.push({
        id: 'group_assessments',
        title: 'Assessments',
        icon: <BookMarked className="w-4 h-4 text-[#E8F3EE]" />,
        items: [
          { id: 'marks-entry', label: 'Assessments', icon: <BookMarked className="w-4 h-4" /> },
        ],
      });

      return teacherItems;
    }

    return [];
  };

  const navGroups = getNavGroups();

  // Expanded Groups State (stored in sessionStorage for persistence across navigation during session)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem('cbe_sidebar_expanded_groups');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // Ignore
    }
    // Initially expand ONLY the group containing activeTab
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      const containsActive = g.items.some(
        (item) =>
          isItemActive(item.id, activeTab) ||
          (item.children && item.children.some((child) => isItemActive(child.id, activeTab)))
      );
      initial[g.id] = containsActive;
    });
    return initial;
  });

  // Expanded Sub-Nav Parent Items State (e.g. Classes & Subjects parent)
  const [expandedSubNavs, setExpandedSubNavs] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem('cbe_sidebar_expanded_subnavs');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // Ignore
    }
    // Expand sub-nav ONLY if activeTab is a child of it
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      g.items.forEach((item) => {
        if (item.children) {
          const containsActive = item.children.some((child) => isItemActive(child.id, activeTab));
          initial[item.id] = containsActive;
        }
      });
    });
    return initial;
  });

  // Automatically expand parent group and parent sub-nav when activeTab changes
  useEffect(() => {
    const activeGroup = navGroups.find((g) =>
      g.items.some(
        (item) =>
          isItemActive(item.id, activeTab) ||
          (item.children && item.children.some((child) => isItemActive(child.id, activeTab)))
      )
    );
    if (activeGroup && !expandedGroups[activeGroup.id]) {
      setExpandedGroups((prev) => {
        const next = { ...prev, [activeGroup.id]: true };
        try {
          sessionStorage.setItem('cbe_sidebar_expanded_groups', JSON.stringify(next));
        } catch (e) {
          // Ignore
        }
        return next;
      });
    }

    // Auto-expand sub-nav if child is active
    navGroups.forEach((g) => {
      g.items.forEach((item) => {
        if (item.children && item.children.some((child) => isItemActive(child.id, activeTab))) {
          setExpandedSubNavs((prev) => {
            if (!prev[item.id]) {
              const next = { ...prev, [item.id]: true };
              try {
                sessionStorage.setItem('cbe_sidebar_expanded_subnavs', JSON.stringify(next));
              } catch (e) {}
              return next;
            }
            return prev;
          });
        }
      });
    });
  }, [activeTab, currentRole]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        sessionStorage.setItem('cbe_sidebar_expanded_groups', JSON.stringify(next));
      } catch (e) {
        // Ignore
      }
      return next;
    });
  };

  const toggleSubNav = (subNavId: string) => {
    setExpandedSubNavs((prev) => {
      const next = { ...prev, [subNavId]: !prev[subNavId] };
      try {
        sessionStorage.setItem('cbe_sidebar_expanded_subnavs', JSON.stringify(next));
      } catch (e) {
        // Ignore
      }
      return next;
    });
  };

  const content = (
    <div className="flex flex-col h-full bg-[#0F5132] dark:bg-[#161a1d] text-slate-200 w-full border-r border-[#2E7D5B]/40 dark:border-zinc-800 select-none">
      {/* Mobile Drawer Header */}
      <div className="p-3.5 pt-[max(0.875rem,env(safe-area-inset-top,0px))] pl-[max(0.875rem,env(safe-area-inset-left,0px))] flex items-center justify-between border-b border-[#2E7D5B]/40 dark:border-zinc-800 bg-[#0B3D26] dark:bg-[#141416] md:hidden">
        <div className="flex items-center space-x-2">
          <GraduationCap className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-bold text-white text-xs tracking-wider uppercase">Menu Navigation</span>
        </div>
        <button
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Role Badge Info */}
      <div className="px-3.5 py-2.5 bg-[#0B3D26]/90 dark:bg-[#141416] border-b border-[#2E7D5B]/40 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] uppercase font-bold text-[#E8F3EE]/80 dark:text-zinc-400 tracking-wider block">
            Active Workspace
          </span>
          <div className="text-xs font-bold text-white dark:text-zinc-100 capitalize mt-0.5 truncate">
            {currentRole === 'admin'
              ? 'System Administrator'
              : currentRole === 'class_teacher'
              ? 'Class Teacher View'
              : 'Subject Teacher View'}
          </div>
        </div>

        {/* Dynamic Connection Status Indicator */}
        {connectionStatus === 'online' && (
          <div
            className="flex items-center space-x-1.5 shrink-0 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full"
            title="System Online: Connection healthy"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-[10px] font-semibold text-emerald-300">Online</span>
          </div>
        )}
        {connectionStatus === 'offline' && (
          <div
            className="flex items-center space-x-1.5 shrink-0 bg-amber-950/80 border border-amber-500/60 px-2 py-0.5 rounded-full animate-pulse"
            title="You're offline: Changes cannot be saved until connection is restored"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-[10px] font-semibold text-amber-300">Offline</span>
          </div>
        )}
        {connectionStatus === 'reconnecting' && (
          <div
            className="flex items-center space-x-1.5 shrink-0 bg-sky-950/80 border border-sky-500/60 px-2 py-0.5 rounded-full"
            title="Reconnecting to service..."
          >
            <RefreshCw className="w-2.5 h-2.5 text-sky-300 animate-spin shrink-0" />
            <span className="text-[10px] font-semibold text-sky-300">Reconnecting</span>
          </div>
        )}
        {connectionStatus === 'syncing' && (
          <div
            className="flex items-center space-x-1.5 shrink-0 bg-emerald-950/80 border border-emerald-500/60 px-2 py-0.5 rounded-full"
            title="Connection restored: Synchronising changes..."
          >
            <RefreshCw className="w-2.5 h-2.5 text-emerald-300 animate-spin shrink-0" />
            <span className="text-[10px] font-semibold text-emerald-300">Syncing</span>
          </div>
        )}
        {connectionStatus === 'realtime_unavailable' && (
          <div
            className="flex items-center space-x-1.5 shrink-0 bg-amber-950/70 border border-amber-500/50 px-2 py-0.5 rounded-full"
            title="Live updates temporarily unavailable. Normal saving remains active."
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-[10px] font-semibold text-amber-300">Live Offline</span>
          </div>
        )}
      </div>

      {/* Grouped Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-3.5 overflow-y-auto">
        {navGroups.map((group) => {
          const isExpanded = Boolean(expandedGroups[group.id]);
          const containsActive = group.items.some(
            (i) =>
              isItemActive(i.id, activeTab) ||
              (i.children && i.children.some((c) => isItemActive(c.id, activeTab)))
          );

          // Top-level direct link (e.g., Dashboard)
          if (group.id === 'group_dashboard') {
            const item = group.items[0];
            const isActive = isItemActive(item.id, activeTab);
            return (
              <div key={group.id} className="space-y-1">
                <button
                  onClick={() => {
                    onSelectTab(item.id as TabType);
                    onCloseMobile();
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-bold rounded-lg transition-colors duration-150 cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#176B45] text-white shadow-xs ring-1 ring-emerald-400/30'
                      : 'text-slate-200 hover:bg-[#2E7D5B]/30 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-1">
                    <span className={`shrink-0 ${isActive ? 'text-emerald-300' : 'text-[#E8F3EE]/80'}`}>
                      {group.icon}
                    </span>
                    <span className="truncate">{group.title}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-1.5" />
                  )}
                </button>
              </div>
            );
          }

          return (
            <div key={group.id} className="space-y-1">
              {/* Group Collapsible Header (Level 1 Category) */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-colors duration-150 select-none cursor-pointer ${
                  containsActive
                    ? 'text-white bg-[#2E7D5B]/40 border border-[#2E7D5B]/50'
                    : 'text-[#E8F3EE]/80 hover:text-white hover:bg-[#2E7D5B]/20'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 pr-1">
                  <span className="shrink-0 text-[#E8F3EE]">{group.icon}</span>
                  <span className="truncate">{group.title}</span>
                </div>
                <span className="shrink-0 text-[#E8F3EE]/80">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>

              {/* Collapsible Sub-Items */}
              {isExpanded && (
                <div className="pl-2 space-y-1 border-l-2 border-[#2E7D5B]/35 ml-3 my-1">
                  {group.items.map((item) => {
                    if (item.children && item.children.length > 0) {
                      const isSubExpanded = Boolean(expandedSubNavs[item.id]);
                      const isChildActive = item.children.some((c) => isItemActive(c.id, activeTab));

                      return (
                        <div key={item.id} className="space-y-1">
                          {/* Parent expandable item header (Level 2 Parent) */}
                          <button
                            onClick={() => {
                              toggleSubNav(item.id);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors duration-150 cursor-pointer text-left ${
                              isChildActive
                                ? 'bg-[#2E7D5B]/40 text-white'
                                : 'text-slate-200 hover:bg-[#2E7D5B]/30 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center space-x-2 min-w-0 pr-1">
                              <span className={`shrink-0 ${isChildActive ? 'text-emerald-300' : 'text-[#E8F3EE]/80'}`}>
                                {item.icon}
                              </span>
                              <span className="leading-snug break-words">{item.label}</span>
                            </div>
                            <span className="shrink-0 text-[#E8F3EE] ml-1">
                              {isSubExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-emerald-300" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </span>
                          </button>

                          {/* Nested children (Level 3 Destination) */}
                          {isSubExpanded && (
                            <div className="pl-2.5 space-y-1 border-l-2 border-[#2E7D5B]/30 ml-3.5 my-1">
                              {item.children.map((child) => {
                                const isChildTabActive = isItemActive(child.id, activeTab);
                                return (
                                  <button
                                    key={child.id}
                                    onClick={() => {
                                      onSelectTab(child.id as TabType);
                                      onCloseMobile();
                                    }}
                                    aria-current={isChildTabActive ? 'page' : undefined}
                                    className={`w-full flex items-center px-2.5 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-left ${
                                      isChildTabActive
                                        ? 'bg-[#176B45] text-white font-bold shadow-xs ring-1 ring-emerald-400/30'
                                        : 'text-slate-200 font-medium hover:bg-[#2E7D5B]/35 hover:text-white'
                                    }`}
                                  >
                                    <span className={`shrink-0 mr-2 ${isChildTabActive ? 'text-emerald-300' : 'text-[#E8F3EE]/80'}`}>
                                      {child.icon}
                                    </span>
                                    <span className="leading-snug break-words flex-1">{child.label}</span>
                                    {isChildTabActive && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-1.5" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const isActive = isItemActive(item.id, activeTab);
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id as TabType);
                          onCloseMobile();
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center px-2.5 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer text-left ${
                          isActive
                            ? 'bg-[#176B45] text-white font-bold shadow-xs ring-1 ring-emerald-400/30'
                            : 'text-slate-200 font-medium hover:bg-[#2E7D5B]/35 hover:text-white'
                        }`}
                      >
                        <span className={`shrink-0 mr-2.5 ${isActive ? 'text-emerald-300' : 'text-[#E8F3EE]/80'}`}>
                          {item.icon}
                        </span>
                        <span className="leading-snug break-words flex-1">{item.label}</span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-1.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer info & Logout */}
      <div className="p-3 pb-[max(0.75rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] border-t border-[#2E7D5B]/40 dark:border-zinc-800 text-xs text-slate-300 space-y-2.5 bg-[#0B3D26] dark:bg-[#141416] shrink-0">
        {onLogout && (
          <button
            onClick={() => {
              onLogout();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center px-3 py-2.5 text-xs font-semibold rounded-lg bg-[#0F5132] dark:bg-zinc-800/80 text-slate-100 hover:bg-rose-900/80 hover:text-white hover:border-rose-700/50 transition-colors duration-150 border border-[#2E7D5B]/40 dark:border-zinc-700 active:scale-[0.98] cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2 text-rose-400 shrink-0" />
            <span>Sign Out</span>
          </button>
        )}
        <div className="text-center pt-0.5">
          <div className="font-bold text-white dark:text-zinc-200 text-[11px] tracking-wide">CBE Management System</div>
          <div className="text-[10px] text-[#E8F3EE]/70 dark:text-zinc-400">Competency-Based Education System</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block flex-shrink-0 w-64 h-full">{content}</aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          {/* Mobile Drawer Panel (approx 78-82% viewport width, max 320px) */}
          <div className="relative flex flex-col w-[80vw] max-w-[320px] sm:max-w-xs h-full bg-[#0F5132] z-50 shadow-2xl border-r border-[#2E7D5B]/50 transform transition-transform duration-200 ease-out pl-[env(safe-area-inset-left,0px)]">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

