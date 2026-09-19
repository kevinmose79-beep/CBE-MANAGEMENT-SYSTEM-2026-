import React, { useState } from 'react';
import {
  Palette,
  School as SchoolIcon,
  Award,
  Key,
  Sliders,
  FileCheck,
  Database,
  Info,
  ChevronRight,
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Type,
  Eye,
  FileText,
  ShieldCheck,
  Check,
  Minus,
  Info as InfoIcon,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { TabType } from './Sidebar';
import { useTheme, InterfaceFont, HeadingFont } from '../contexts/ThemeContext';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { School, Grade, Student, Teacher, ClassStream, Subject, Examination, Mark } from '../types';
import { SchoolProfileView } from './SchoolProfileView';
import { GradingSettings } from './GradingSettings';
import { DeveloperSettingsPage } from './DeveloperSettingsPage';
import { OtaAdminDashboard } from './OtaAdminDashboard';

export type SettingsCategoryId =
  | 'appearance'
  | 'school-identity'
  | 'academic-grading'
  | 'access-governance'
  | 'assessment-rules'
  | 'reports-printing'
  | 'developer-diagnostics'
  | 'ota-releases'
  | 'system-info';

interface SystemSettingsPageProps {
  onNavigate: (tab: TabType) => void;
  school?: School;
  onSaveSchool?: (school: School) => void;
  grades?: Grade[];
  onUpdateGrades?: (grades: Grade[]) => Promise<void> | void;
  dbStatus?: {
    checking: boolean;
    success: boolean;
    message: string;
    url?: string;
    error?: string;
    fixInstructions?: string;
    records?: any[];
  };
  onVerifyAndSync?: () => Promise<void>;
  students?: Student[];
  teachers?: Teacher[];
  classes?: ClassStream[];
  subjects?: Subject[];
  exams?: Examination[];
  marks?: Mark[];
  onResetData?: () => void;
  initialCategory?: SettingsCategoryId | null;
}

interface CategoryCardDef {
  id: SettingsCategoryId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  type: 'editable' | 'reference' | 'developer' | 'system';
  badge?: string;
}

const CATEGORIES: CategoryCardDef[] = [
  {
    id: 'appearance',
    title: 'Appearance & Typography',
    subtitle: 'Theme and interface fonts',
    icon: Palette,
    type: 'editable',
  },
  {
    id: 'school-identity',
    title: 'School Identity & Branding',
    subtitle: 'Official school information and branding',
    icon: SchoolIcon,
    type: 'editable',
  },
  {
    id: 'academic-grading',
    title: 'Academic & CBE Grading',
    subtitle: 'Grading scale and achievement levels',
    icon: Award,
    type: 'editable',
  },
  {
    id: 'access-governance',
    title: 'Access & Role Governance',
    subtitle: 'Roles, permissions and security controls',
    icon: Key,
    type: 'reference',
    badge: 'Read-Only Policy',
  },
  {
    id: 'assessment-rules',
    title: 'Assessment & Results Rules',
    subtitle: 'Calculation and ranking policies',
    icon: Sliders,
    type: 'reference',
    badge: 'Read-Only Policy',
  },
  {
    id: 'reports-printing',
    title: 'Reports & Printing',
    subtitle: 'Report-card and printing standards',
    icon: FileCheck,
    type: 'reference',
    badge: 'Read-Only Policy',
  },
  {
    id: 'developer-diagnostics',
    title: 'Developer & Diagnostics',
    subtitle: 'Database connection and technical diagnostics',
    icon: Database,
    type: 'developer',
    badge: 'Advanced',
  },
  {
    id: 'ota-releases',
    title: 'OTA Update Management',
    subtitle: 'Manage Over-the-Air app releases and bundle promotions',
    icon: RefreshCw,
    type: 'developer',
    badge: 'Admin Only',
  },
  {
    id: 'system-info',
    title: 'System Information',
    subtitle: 'Version and system status',
    icon: Info,
    type: 'system',
    badge: 'v1.0.0',
  },
];

const renderPermissionBadge = (status: string) => {
  if (status === 'Allowed') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 text-xs">
        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        Allowed
      </span>
    );
  }
  if (status === 'Assigned') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 text-xs">
        <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        Assigned
      </span>
    );
  }
  if (status === 'Allocated') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-purple-700 dark:text-purple-400 text-xs">
        <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        Allocated
      </span>
    );
  }
  if (status === 'Own') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400 text-xs">
        <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        Own
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500 text-xs">
      <Minus className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
      Not available
    </span>
  );
};

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({
  onNavigate,
  school,
  onSaveSchool,
  grades = [],
  onUpdateGrades = () => {},
  dbStatus = { checking: false, success: true, message: 'Database Connected' },
  onVerifyAndSync = async () => {},
  students = [],
  teachers = [],
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  onResetData,
  initialCategory = null,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategoryId | null>(initialCategory);

  const {
    theme,
    setTheme,
    interfaceFont,
    setInterfaceFont,
    headingFont,
    setHeadingFont,
    interfaceFonts,
    headingFonts,
  } = useTheme();

  const { activeYear, activeTerm } = useAcademicSession();

  // Scroll to top when category changes
  const handleSelectCategory = (catId: SettingsCategoryId) => {
    setSelectedCategory(catId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHub = () => {
    setSelectedCategory(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // -------------------------------------------------------------
  // VIEW: LANDING PAGE (CATEGORY LIST)
  // -------------------------------------------------------------
  if (!selectedCategory) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-8">
        {/* Page Header */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center space-x-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#054531] text-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
            <Palette className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Administrator Settings
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              System configuration, governance and preferences.
            </p>
          </div>
        </div>

        {/* Categories List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Settings Categories
            </h2>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {CATEGORIES.length} Categories
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  id={`settings-category-${category.id}`}
                  type="button"
                  onClick={() => handleSelectCategory(category.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-4.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-all text-left group cursor-pointer focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-800/80"
                >
                  <div className="flex items-center space-x-3.5 sm:space-x-4 min-w-0 pr-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        category.type === 'developer'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 group-hover:bg-amber-100/80 dark:group-hover:bg-amber-900/60'
                          : category.type === 'reference'
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 group-hover:bg-blue-100/80 dark:group-hover:bg-blue-900/60'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50 group-hover:bg-emerald-100/80 dark:group-hover:bg-emerald-900/60'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">
                          {category.title}
                        </h3>
                        {category.badge && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                              category.type === 'developer'
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                                : category.type === 'reference'
                                ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {category.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal truncate">
                        {category.subtitle}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: CATEGORY DETAIL VIEW
  // -------------------------------------------------------------
  const activeDef = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];
  const Icon = activeDef.icon;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Category Detail Header with Back Navigation */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
        <button
          type="button"
          onClick={handleBackToHub}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 transition-colors group cursor-pointer focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Settings</span>
        </button>

        <div className="flex items-center space-x-3.5 min-w-0 pt-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              activeDef.type === 'developer'
                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                : activeDef.type === 'reference'
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                : 'bg-[#054531] text-emerald-100'
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {activeDef.title}
              </h1>
              {activeDef.badge && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                    activeDef.type === 'developer'
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                      : activeDef.type === 'reference'
                      ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {activeDef.badge}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {activeDef.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* 1. APPEARANCE & TYPOGRAPHY DETAIL */}
      {selectedCategory === 'appearance' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
          {/* Color Scheme */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug flex items-center gap-2">
                <Palette className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                Color Theme
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose how the system looks across your workspace.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center space-x-2.5 sm:space-x-3 p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer text-left min-w-0 ${
                  theme === 'light'
                    ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-600/20 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    theme === 'light' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {theme === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="text-xs font-medium min-w-0 truncate">Light</div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center space-x-2.5 sm:space-x-3 p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer text-left min-w-0 ${
                  theme === 'dark'
                    ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-600/20 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    theme === 'dark' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {theme === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="text-xs font-medium min-w-0 truncate">Dark</div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex items-center space-x-2.5 sm:space-x-3 p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer text-left min-w-0 ${
                  theme === 'system'
                    ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-600/20 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    theme === 'system' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {theme === 'system' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <Monitor className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                <div className="text-xs font-medium min-w-0 truncate">System Default</div>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200/80 dark:border-slate-800/80 pt-5 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug flex items-center gap-2">
                <Type className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                Workspace Typography
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose clean, accessible typefaces for dashboard interfaces, data tables, and section headings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Interface Font Selector */}
              <div className="space-y-2">
                <label
                  htmlFor="select-interface-font"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Interface & Body Font
                </label>
                <select
                  id="select-interface-font"
                  value={interfaceFont}
                  onChange={(e) => setInterfaceFont(e.target.value as InterfaceFont)}
                  className="w-full p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  {interfaceFonts.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {f.description}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Applied across navigation, buttons, form inputs, marks entry sheets, and table data.
                </p>
              </div>

              {/* Heading Font Selector */}
              <div className="space-y-2">
                <label
                  htmlFor="select-heading-font"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Heading & Display Font
                </label>
                <select
                  id="select-heading-font"
                  value={headingFont}
                  onChange={(e) => setHeadingFont(e.target.value as HeadingFont)}
                  className="w-full p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  {headingFonts.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {f.description}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Applied to module titles, modal banners, card headers, and analytical charts.
                </p>
              </div>
            </div>

            {/* Curated Typography Presets */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Curated Design Presets</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    name: 'Modern UI',
                    body: 'inter' as InterfaceFont,
                    head: 'plus-jakarta-sans' as HeadingFont,
                    desc: 'Inter + Jakarta',
                  },
                  {
                    name: 'Academic Serif',
                    body: 'dm-sans' as InterfaceFont,
                    head: 'merriweather' as HeadingFont,
                    desc: 'DM Sans + Merriweather',
                  },
                  {
                    name: 'Tech & Analytics',
                    body: 'source-sans-3' as InterfaceFont,
                    head: 'space-grotesk' as HeadingFont,
                    desc: 'Source Sans + Space Grotesk',
                  },
                  {
                    name: 'Approachable',
                    body: 'open-sans' as InterfaceFont,
                    head: 'poppins' as HeadingFont,
                    desc: 'Open Sans + Poppins',
                  },
                  {
                    name: 'Executive',
                    body: 'work-sans' as InterfaceFont,
                    head: 'montserrat' as HeadingFont,
                    desc: 'Work Sans + Montserrat',
                  },
                  {
                    name: 'Literary Warmth',
                    body: 'lato' as InterfaceFont,
                    head: 'lora' as HeadingFont,
                    desc: 'Lato + Lora Serif',
                  },
                  {
                    name: 'Contemporary',
                    body: 'urbanist' as InterfaceFont,
                    head: 'sora' as HeadingFont,
                    desc: 'Urbanist + Sora',
                  },
                  {
                    name: 'Native Clean',
                    body: 'system' as InterfaceFont,
                    head: 'system' as HeadingFont,
                    desc: 'System-UI stack',
                  },
                ].map((preset) => {
                  const isActive = interfaceFont === preset.body && headingFont === preset.head;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setInterfaceFont(preset.body);
                        setHeadingFont(preset.head);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-600/20 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">{preset.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{preset.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Typography Preview Box */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Live Typography & UI Preview</span>
                </div>
                <span className="text-[10px] lowercase font-normal px-2 py-0.5 rounded-md bg-emerald-100/70 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  {interfaceFont} + {headingFont}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  CBE Management System — Academic Excellence
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Empowering educators with accurate competency assessments, automated merit rankings, and real-time learner diagnostics across all academic cohorts.
                </p>

                {/* Sample UI Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Active Cohort: Grade 7
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    Mean Score: 78.4%
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition shadow-xs cursor-pointer"
                  >
                    Sample Action Button
                  </button>
                </div>

                <div className="pt-1.5 flex items-center gap-2 flex-wrap border-t border-slate-200/60 dark:border-slate-700/60 mt-2">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">School Motto (Fixed Script):</span>
                  <span className="font-script text-base text-emerald-800 dark:text-emerald-300 font-semibold">
                    Smarter Management. Better Decisions.
                  </span>
                </div>
              </div>
            </div>

            {/* Deterministic PDF Notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed">
              <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Deterministic PDF Typography:</span> Official report cards, merit lists, and assessment sheets preserve standard Helvetica typography to ensure mathematical coordinate precision, exact table widths, and deterministic document pagination.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. SCHOOL IDENTITY & BRANDING DETAIL */}
      {selectedCategory === 'school-identity' && (
        <div className="space-y-4">
          {school && onSaveSchool ? (
            <SchoolProfileView
              school={school}
              onSaveSchool={onSaveSchool}
              readOnly={false}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You can manage the full official School Profile directly from here or via the navigation shortcut.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('school-profile')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold"
              >
                <span>Open Dedicated School Profile Screen</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. ACADEMIC & CBE GRADING DETAIL */}
      {selectedCategory === 'academic-grading' && (
        <div className="space-y-4">
          <GradingSettings
            grades={grades}
            onUpdateGrades={onUpdateGrades}
          />
        </div>
      )}

      {/* 4. ACCESS & ROLE GOVERNANCE DETAIL */}
      {selectedCategory === 'access-governance' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
          {/* Security Enforcement Panel */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Security Enforcement Status (Read-Only Reference)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">Authentication</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">Supabase Auth</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">Role Authority</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">public.users.role</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Enforced
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">Database Protection</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">PostgreSQL RLS</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Enforced
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">Privileged Operations</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">Secured RPCs</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Enforced
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1 sm:col-span-2 lg:col-span-2">
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">Client UI Guards</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">Navigation & Route Restrictions</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                </span>
              </div>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-100/80 dark:border-emerald-900/50 flex items-start space-x-3">
            <InfoIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
              Your role determines what you can access. Database security independently verifies your permissions, so hiding a menu item in the application does not provide the security boundary.
            </p>
          </div>

          {/* Role Overview */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              System Roles & Access Scope
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Administrator */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Administrator</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
                    Full System Access
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Full system access. Manages authorized system configuration, academic setup, users, assessments, grading and school settings.
                </p>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> System settings & school profile</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Academic setup & user management</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Assessment rules & CBE grading</li>
                </ul>
              </div>

              {/* Class Teacher */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Class Teacher</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                    Assigned-Class Access
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Assigned-class access. Restricted to authorized classes/streams and the functions permitted for class teachers.
                </p>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Class roster & student records</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Marks entry for assigned classes</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Class reports & verification</li>
                </ul>
              </div>

              {/* Subject Teacher */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Subject Teacher</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                    Allocated-Subject Access
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Allocated-subject access. Restricted to allocated subjects and authorized classes/streams.
                </p>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Allocated subject marks entry</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Subject performance analysis</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Provisional results entry</li>
                </ul>
              </div>

              {/* Learner */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Learner</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                    Own-Results Access
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Own-results access. Restricted to own permitted academic information and published results.
                </p>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Own academic performance</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Published report cards</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Verified learner record</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Permission Matrix */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Permission Matrix Overview
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3.5">Capability</th>
                    <th className="py-2.5 px-3">Administrator</th>
                    <th className="py-2.5 px-3">Class Teacher</th>
                    <th className="py-2.5 px-3">Subject Teacher</th>
                    <th className="py-2.5 px-3">Learner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/50">
                  {[
                    { name: 'Dashboard', admin: 'Allowed', classT: 'Allowed', subjT: 'Allowed', learner: 'Allowed' },
                    { name: 'Manage Classes & Streams', admin: 'Allowed', classT: 'Not available', subjT: 'Not available', learner: 'Not available' },
                    { name: 'Manage Learning Areas', admin: 'Allowed', classT: 'Not available', subjT: 'Not available', learner: 'Not available' },
                    { name: 'Manage Learners', admin: 'Allowed', classT: 'Assigned', subjT: 'Not available', learner: 'Own' },
                    { name: 'Enter Marks', admin: 'Allowed', classT: 'Assigned', subjT: 'Allocated', learner: 'Not available' },
                    { name: 'Assessment Analysis', admin: 'Allowed', classT: 'Assigned', subjT: 'Allocated', learner: 'Not available' },
                    { name: 'Verify Results', admin: 'Allowed', classT: 'Assigned', subjT: 'Not available', learner: 'Not available' },
                    { name: 'Publish Results', admin: 'Allowed', classT: 'Not available', subjT: 'Not available', learner: 'Not available' },
                    { name: 'Configure Grading', admin: 'Allowed', classT: 'Not available', subjT: 'Not available', learner: 'Not available' },
                    { name: 'System Settings', admin: 'Allowed', classT: 'Not available', subjT: 'Not available', learner: 'Not available' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3.5 font-medium text-slate-800 dark:text-slate-200">{row.name}</td>
                      <td className="py-2.5 px-3">{renderPermissionBadge(row.admin)}</td>
                      <td className="py-2.5 px-3">{renderPermissionBadge(row.classT)}</td>
                      <td className="py-2.5 px-3">{renderPermissionBadge(row.subjT)}</td>
                      <td className="py-2.5 px-3">{renderPermissionBadge(row.learner)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick link to staff management */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('teachers')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm transition-colors cursor-pointer shadow-2xs group focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <span>Open Staff & Teacher Management</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* 5. ASSESSMENT & RESULTS RULES DETAIL */}
      {selectedCategory === 'assessment-rules' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100/80 dark:border-emerald-800/50 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug">
                  Academic & Ranking Policy Status
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                  Review the academic framework and rules currently active in the system.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 dark:text-slate-400">CBE Framework</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Active
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 dark:text-slate-400">Grading Scale</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">8-Point CBE</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 dark:text-slate-400">Assessment Workflow</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">Draft → Submitted → Verified → Published</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 dark:text-slate-400">Active Academic Session</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {activeTerm?.term_name || 'Term 2'} • {activeYear?.year || 2026}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 dark:text-slate-400">Weighted Scoring Framework</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">KNEC Standard (Formative SBA + Summative)</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 dark:text-slate-400">Missing Marks Handling</span>
                <span className="font-medium text-amber-700 dark:text-amber-400">Zero Synthetic Injection (Tracked dynamically per allocation)</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pt-2 border-t border-slate-100 dark:border-slate-800/40">
            Some academic rules are system-defined and are not currently administrator-configurable.
          </p>
        </div>
      )}

      {/* 6. REPORTS & PRINTING DETAIL */}
      {selectedCategory === 'reports-printing' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-start space-x-3.5 min-w-0 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug">
                Official Report Card & Merit List Format
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                Standardized printable CBE Report Cards, Provisional Approvals, and Merit Lists.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                Deterministic PDF Layout Engine
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                All generated PDF documents (Report Cards, Score Sheets, Merit Lists) use fixed built-in Helvetica typography with millimeter-precise coordinate math. Changes to workspace UI display fonts never alter printed PDF document geometry or pagination.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                Official Institutional Placeholders
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Report templates automatically embed the official school logo, motto, postal code, county, and principal signature block configured under <strong>School Identity & Branding</strong>.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm transition-colors cursor-pointer shadow-2xs group focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <span>Open Reports & Merit Lists View</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* 7. DEVELOPER & DIAGNOSTICS DETAIL */}
      {selectedCategory === 'developer-diagnostics' && (
        <div className="space-y-4">
          <DeveloperSettingsPage
            dbStatus={dbStatus}
            onVerifyAndSync={onVerifyAndSync}
            school={school}
            students={students}
            teachers={teachers}
            classes={classes}
            subjects={subjects}
            exams={exams}
            marks={marks}
            grades={grades}
            onResetData={onResetData}
          />
        </div>
      )}

      {/* 8. SYSTEM INFORMATION DETAIL */}
      {selectedCategory === 'system-info' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                  CBE School Management Information System
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Version 1.0.0 • Supabase Persistent Database Core
                </p>
              </div>
            </div>
            <div className="flex items-center self-start sm:self-auto shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                System Up to Date
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">Architecture</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">React 18 + Vite + Tailwind CSS</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">Authoritative Database</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">Supabase PostgreSQL</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">Active Academic Term</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">{activeTerm?.term_name || 'Term 2'} • {activeYear?.year || 2026}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">Evaluation Framework</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">Kenya CBE 8-Point Standard</span>
            </div>
          </div>
        </div>
      )}

      {/* 9. Over-the-Air Releases Detail */}
      {selectedCategory === 'ota-releases' && (
        <OtaAdminDashboard onBack={handleBackToHub} />
      )}
    </div>
  );
};
