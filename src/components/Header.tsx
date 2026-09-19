import React, { useState } from 'react';
import {
  GraduationCap,
  School as SchoolIcon,
  User,
  LogOut,
  Database,
  Settings,
  Menu,
  Shield,
  BookOpen,
  UserCheck,
  Search,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
} from 'lucide-react';
import { School, User as UserType } from '../types';
import { SessionSwitcher } from './SessionSwitcher';
import { useTheme } from '../contexts/ThemeContext';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { ConnectionStatus } from '../lib/storage';

interface HeaderProps {
  school: School;
  currentUser: UserType;
  onLogout: () => void;
  onOpenSchoolProfile: () => void;
  onOpenSupabaseModal: () => void;
  onToggleSidebar: () => void;
  onNavigateToSystem?: () => void;
  onNavigateToDiagnostics?: () => void;
  onOpenSearch?: () => void;
  connectionStatus?: ConnectionStatus;
  dbStatus?: {
    checking: boolean;
    success: boolean;
    message?: string;
    error?: string;
  };
  onRetryConnection?: () => Promise<void> | void;
}

export const Header: React.FC<HeaderProps> = ({
  school,
  currentUser,
  onLogout,
  onOpenSchoolProfile,
  onOpenSupabaseModal,
  onToggleSidebar,
  onNavigateToSystem,
  onNavigateToDiagnostics,
  onOpenSearch,
  connectionStatus = 'online',
  dbStatus,
  onRetryConnection,
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleCycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <header className="bg-[#075E42] dark:bg-[#161a1d] text-white sticky top-0 z-30 shadow-xs border-b border-[#087F5B]/60 dark:border-zinc-800 pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Primary Row */}
        <div className="flex items-center justify-between h-14 md:h-16 gap-2">
          {/* Left Section: Mobile Menu Toggle & Brand Identity */}
          <div className="flex items-center space-x-2 min-w-0 shrink">
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-2 -ml-1 rounded-lg text-emerald-100 dark:text-zinc-300 hover:text-white hover:bg-[#054531] dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition shrink-0 min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div
              className={`flex items-center space-x-2 min-w-0 ${
                currentUser.role === 'admin' ? 'cursor-pointer hover:opacity-95' : ''
              }`}
              onClick={currentUser.role === 'admin' ? onOpenSchoolProfile : undefined}
              title={currentUser.role === 'admin' ? 'View/Edit School Profile' : undefined}
            >
              <div className="bg-[#054531] dark:bg-zinc-800 p-1.5 rounded-lg text-white shadow-2xs flex items-center justify-center w-8 h-8 md:w-9 md:h-9 shrink-0 border border-[#087F5B]/50 dark:border-zinc-700">
                {school.logo_url ? (
                  <img
                    src={school.logo_url}
                    alt="School Logo"
                    className="w-5 h-5 md:w-6 md:h-6 object-contain rounded"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <GraduationCap className="w-5 h-5 text-emerald-200 dark:text-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm md:text-base font-bold tracking-tight text-white dark:text-zinc-100 leading-tight truncate max-w-[120px] xs:max-w-[170px] sm:max-w-[240px] md:max-w-[320px]">
                  {school.school_name && school.school_name !== 'Anon Hack' ? school.school_name : 'Muchorwe Comprehensive School'}
                </h1>
                <p className="text-[10px] text-emerald-200/90 dark:text-zinc-400 hidden sm:block truncate font-medium">
                  CBE Management System
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Academic Session Switcher (Admin) */}
          {currentUser.role === 'admin' && (
            <div className="hidden md:block shrink-0 ml-2">
              <SessionSwitcher />
            </div>
          )}

          {/* Flexible Spacer for Desktop */}
          <div className="hidden md:block flex-1 min-w-2" />

          {/* Right Section: Actions, Theme, Search & User Profile */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Real-time Connection Status Indicator */}
            <ConnectionStatusIndicator
              connectionStatus={connectionStatus}
              dbStatus={dbStatus}
              currentUser={currentUser}
              onNavigateToDiagnostics={onNavigateToDiagnostics}
              onRetryConnection={onRetryConnection}
            />

            {/* System Settings Button (Admin, visible on large screens) */}
            {currentUser.role === 'admin' && (
              <button
                onClick={onNavigateToSystem}
                className="hidden lg:flex items-center space-x-1.5 text-xs bg-[#054531] dark:bg-zinc-800 hover:bg-[#043828] dark:hover:bg-zinc-700 text-emerald-100 dark:text-zinc-200 hover:text-white px-2.5 py-1.5 rounded-lg border border-[#087F5B]/50 dark:border-zinc-700 transition font-medium cursor-pointer"
                title="System Settings"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-200 dark:text-zinc-400" />
                <span>System Settings</span>
              </button>
            )}

            {/* Global Search Button */}
            <button
              onClick={onOpenSearch}
              className="bg-[#054531] dark:bg-zinc-800 hover:bg-[#043828] dark:hover:bg-zinc-700 text-emerald-100 dark:text-zinc-200 hover:text-white p-2 md:px-2.5 md:py-1.5 min-h-[36px] rounded-lg border border-[#087F5B]/50 dark:border-zinc-700 transition cursor-pointer flex items-center justify-center space-x-1.5 shrink-0"
              title="Global Search (Ctrl+K)"
              aria-label="Global Search"
            >
              <Search className="w-4 h-4 text-emerald-200 dark:text-zinc-400 shrink-0" />
              <span className="hidden xl:inline text-xs font-medium text-emerald-100 dark:text-zinc-200">Search</span>
              <kbd className="hidden md:inline-block text-[9px] bg-black/25 dark:bg-black/40 px-1 rounded text-emerald-300 dark:text-zinc-400 font-mono">
                ⌘K
              </kbd>
            </button>

            {/* Theme Switcher Button (Desktop & Tablet) */}
            <button
              onClick={handleCycleTheme}
              className="hidden sm:flex bg-[#054531] dark:bg-zinc-800 hover:bg-[#043828] dark:hover:bg-zinc-700 text-emerald-100 dark:text-zinc-200 hover:text-white p-2 md:px-2.5 md:py-1.5 min-h-[36px] rounded-lg border border-[#087F5B]/50 dark:border-zinc-700 transition cursor-pointer items-center justify-center space-x-1.5 shrink-0"
              title={`Theme: ${theme === 'system' ? `System (${resolvedTheme})` : theme === 'dark' ? 'Dark Mode' : 'Light Mode'}. Click to switch.`}
              aria-label="Toggle System Theme"
            >
              {theme === 'light' && <Sun className="w-4 h-4 text-amber-300 shrink-0" />}
              {theme === 'dark' && <Moon className="w-4 h-4 text-emerald-300 dark:text-emerald-400 shrink-0" />}
              {theme === 'system' && <Monitor className="w-4 h-4 text-emerald-200 dark:text-zinc-400 shrink-0" />}
              <span className="hidden xl:inline text-xs font-medium text-emerald-100 dark:text-zinc-200 capitalize">
                {theme}
              </span>
            </button>

            {/* User Identity Control & Profile Menu Trigger */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center space-x-2 bg-[#054531] dark:bg-zinc-800 hover:bg-[#043828] dark:hover:bg-zinc-700 px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg border border-[#087F5B]/50 dark:border-zinc-700 shrink-0 cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
                aria-expanded={isProfileMenuOpen}
                aria-label="User Menu"
              >
                <div className="w-7 h-7 md:w-7 md:h-7 rounded-md bg-[#087F5B] dark:bg-emerald-800 text-white flex items-center justify-center font-extrabold text-xs uppercase shrink-0">
                  {(currentUser.name || 'Admin').slice(0, 2)}
                </div>
                <div className="text-[10px] md:text-xs text-left hidden md:block">
                  <div className="font-semibold text-white dark:text-zinc-100 max-w-[120px] md:max-w-[150px] truncate leading-tight">
                    {currentUser.name || 'Administrator'}
                  </div>
                  <div className="text-[9px] md:text-[10px] text-emerald-200/90 dark:text-zinc-400 capitalize font-medium flex items-center space-x-1">
                    {currentUser.role === 'admin' && <Shield className="w-3 h-3 text-emerald-300 dark:text-emerald-400" />}
                    {(currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') && (
                      <UserCheck className="w-3 h-3 text-emerald-300 dark:text-emerald-400" />
                    )}
                    {currentUser.role === 'learner' && (
                      <GraduationCap className="w-3 h-3 text-emerald-300 dark:text-emerald-400" />
                    )}
                    <span>{currentUser.role.replace('_', ' ')}</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-200 dark:text-zinc-400 shrink-0 hidden md:block" />
              </button>

              {/* User Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <>
                  {/* Backdrop to dismiss menu */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />

                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-[#054531] border border-[#087F5B] rounded-xl shadow-xl z-50 p-3 space-y-2.5 text-white animate-in fade-in zoom-in-95 duration-100">
                    {/* Compact User Card inside Dropdown */}
                    <div className="flex items-center space-x-2.5 pb-2 border-b border-[#087F5B]/60">
                      <div className="w-9 h-9 rounded-lg bg-[#087F5B] text-white flex items-center justify-center font-bold text-sm uppercase shrink-0">
                        {(currentUser.name || 'Admin').slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-white truncate">
                          {currentUser.name || 'Administrator'}
                        </div>
                        <div className="text-[10px] text-emerald-200 capitalize flex items-center space-x-1 mt-0.5">
                          {currentUser.role === 'admin' && <Shield className="w-3 h-3 text-emerald-300" />}
                          {(currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') && (
                            <UserCheck className="w-3 h-3 text-emerald-300" />
                          )}
                          {currentUser.role === 'learner' && (
                            <GraduationCap className="w-3 h-3 text-emerald-300" />
                          )}
                          <span>{currentUser.role.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Theme Toggle Option */}
                    <button
                      onClick={() => {
                        handleCycleTheme();
                      }}
                      className="w-full flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-[#075E42] hover:bg-[#087F5B]/80 text-emerald-100 hover:text-white transition cursor-pointer"
                    >
                      <span className="flex items-center space-x-2 font-medium">
                        {theme === 'light' && <Sun className="w-4 h-4 text-amber-300" />}
                        {theme === 'dark' && <Moon className="w-4 h-4 text-emerald-300" />}
                        {theme === 'system' && <Monitor className="w-4 h-4 text-emerald-200" />}
                        <span>Theme</span>
                      </span>
                      <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded text-emerald-200 font-semibold capitalize">
                        {theme}
                      </span>
                    </button>

                    {/* System Settings option for mobile if admin */}
                    {currentUser.role === 'admin' && onNavigateToSystem && (
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onNavigateToSystem();
                        }}
                        className="w-full lg:hidden flex items-center space-x-2 text-xs px-2.5 py-2 rounded-lg bg-[#075E42] hover:bg-[#087F5B]/80 text-emerald-100 hover:text-white transition cursor-pointer font-medium"
                      >
                        <Settings className="w-4 h-4 text-emerald-200" />
                        <span>System Settings</span>
                      </button>
                    )}

                    {/* Logout Button inside Menu */}
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center space-x-2 text-xs px-2.5 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 hover:text-white border border-rose-800/60 font-semibold transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-300" />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Desktop Logout Button */}
            <button
              onClick={onLogout}
              className="hidden md:flex items-center justify-center space-x-1.5 text-xs bg-[#054531] hover:bg-rose-900/80 text-emerald-100 hover:text-white px-2.5 py-1.5 min-h-[36px] rounded-lg border border-[#087F5B]/50 hover:border-rose-700/60 font-semibold transition shrink-0 cursor-pointer"
              title="Sign Out of System"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Secondary Row for Mobile / Narrow screens (< md): Active Term Selector */}
        {currentUser.role === 'admin' && (
          <div className="md:hidden pb-2.5 pt-1 border-t border-[#087F5B]/40 flex items-center justify-between">
            <SessionSwitcher />
          </div>
        )}
      </div>
    </header>
  );
};
