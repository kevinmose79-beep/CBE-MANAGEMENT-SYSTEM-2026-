import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  Shield,
  Key,
  Globe,
  Sliders,
  CheckSquare,
  AlertTriangle,
  Code2,
  Download,
  RotateCcw,
  FileJson,
  HardDrive,
} from 'lucide-react';
import {
  SUPABASE_PART1,
  SUPABASE_PART2,
  SUPABASE_PART3,
  SUPABASE_PART4,
  SUPABASE_SQL_SCHEMA,
  SUPABASE_QUICK_MIGRATIONS,
} from '../lib/supabaseSql';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from '../lib/storage';
import {
  School,
  Student,
  Teacher,
  ClassStream,
  Subject,
  Examination,
  Mark,
  Grade,
} from '../types';
import { exportSystemBackup } from '../utils/backupExporter';

interface DeveloperSettingsPageProps {
  dbStatus: {
    checking: boolean;
    success: boolean;
    message: string;
    url?: string;
    error?: string;
    fixInstructions?: string;
    records?: any[];
  };
  onVerifyAndSync: () => Promise<void>;
  school?: School;
  students?: Student[];
  teachers?: Teacher[];
  classes?: ClassStream[];
  subjects?: Subject[];
  exams?: Examination[];
  marks?: Mark[];
  grades?: Grade[];
  onResetData?: () => void;
}

export const DeveloperSettingsPage: React.FC<DeveloperSettingsPageProps> = ({
  dbStatus,
  onVerifyAndSync,
  school,
  students = [],
  teachers = [],
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  onResetData,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeSqlTab, setActiveSqlTab] = useState<'part1' | 'part2' | 'part3' | 'part4' | 'full' | 'migrations'>('part1');
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [savedMsg, setSavedMsg] = useState('');
  const [exportingBackup, setExportingBackup] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState('');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resettingData, setResettingData] = useState(false);

  useEffect(() => {
    const creds = getSupabaseCredentials();
    setUrl(creds.url || '');
    setAnonKey(creds.anonKey || '');
  }, []);

  const handleExportBackup = async () => {
    try {
      setExportingBackup(true);
      const result = await exportSystemBackup({
        school,
        students,
        teachers,
        classes,
        subjects,
        exams,
        marks,
        grades,
      });
      setBackupSuccessMsg(`Backup exported: ${result.fileName}`);
      setTimeout(() => setBackupSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to export backup:', err);
    } finally {
      setExportingBackup(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!onResetData) return;
    try {
      setResettingData(true);
      setShowResetConfirmModal(false);
      onResetData();
    } finally {
      setResettingData(false);
    }
  };

  const getSqlForTab = () => {
    switch (activeSqlTab) {
      case 'part1':
        return SUPABASE_PART1;
      case 'part2':
        return SUPABASE_PART2;
      case 'part3':
        return SUPABASE_PART3;
      case 'part4':
        return SUPABASE_PART4;
      case 'full':
        return SUPABASE_SQL_SCHEMA;
      case 'migrations':
        return SUPABASE_QUICK_MIGRATIONS;
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(getSqlForTab());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAndTest = async () => {
    saveSupabaseCredentials(url, anonKey);
    setSavedMsg('Database credentials saved!');
    setTimeout(() => setSavedMsg(''), 3000);
    await handleTestConnection(url, anonKey);
  };

  const handleTestConnection = async (testUrl?: string, testKey?: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection(testUrl || url, testKey || anonKey);
      setTestResult(result);
      if (result.success) {
        await onVerifyAndSync();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Unexpected test failure: ${err.message || String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const isEnvProvided = Boolean(envUrl && envKey);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Shield className="w-4 h-4" />
              <span>Developer Mode &bull; Restricted Access</span>
            </div>
            <h1 className="text-xl font-bold flex items-center space-x-2 text-white">
              <Database className="w-6 h-6 text-emerald-400" />
              <span>Developer Tools & Diagnostics</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Configure Supabase PostgreSQL backend endpoints, monitor connection health, and view or export database DDL schemas.
            </p>
          </div>

          <button
            onClick={() => handleTestConnection()}
            disabled={testing || dbStatus.checking}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow transition text-xs flex items-center space-x-2 self-start sm:self-center"
          >
            <RefreshCw className={`w-4 h-4 ${testing || dbStatus.checking ? 'animate-spin' : ''}`} />
            <span>{testing || dbStatus.checking ? 'Testing Connection...' : 'Re-test Connection'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Health Status & Credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Health Overview */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center space-x-2">
              <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Database Health Status</span>
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                dbStatus.success
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
              }`}
            >
              {dbStatus.checking
                ? 'Verifying...'
                : dbStatus.success
                ? 'Connected & Operational'
                : 'Connection Failed'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                <span>Active Endpoint URL:</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                  {url || envUrl || 'Not Configured'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                <span>Environment Variable Source:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold ${
                    isEnvProvided
                      ? 'bg-[#E8F3EE] dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {isEnvProvided ? 'VITE_SUPABASE_URL (.env)' : 'Local Override / Storage'}
                </span>
              </div>
            </div>

            {/* Diagnostic Message */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 ${
                dbStatus.success
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50/50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-start space-x-2">
                {dbStatus.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <div className="font-bold text-xs">
                    {dbStatus.success
                      ? 'Supabase Connection Verified'
                      : 'Database Connection Error'}
                  </div>
                  <div className="text-[11px] leading-relaxed mt-0.5">
                    {dbStatus.message}
                  </div>
                </div>
              </div>

              {dbStatus.fixInstructions && (
                <div className="mt-2 p-2.5 bg-rose-950 text-rose-200 font-mono text-[11px] rounded-lg border border-rose-800 whitespace-pre-line">
                  <div className="font-bold text-rose-300 mb-1 flex items-center space-x-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Resolution Instructions:</span>
                  </div>
                  {dbStatus.fixInstructions}
                </div>
              )}
            </div>

            {/* Test Results Output */}
            {testResult && (
              <div
                className={`p-3 border rounded-xl space-y-2 text-xs ${
                  testResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}
              >
                <div className="font-bold text-[11px]">
                  Manual Test Result: {testResult.message}
                </div>
                {testResult.success && testResult.records && (
                  <div>
                    <div className="font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                      Sample `school_profile` Query Response:
                    </div>
                    <pre className="bg-slate-900 text-emerald-400 p-2 rounded text-[10px] font-mono overflow-x-auto max-h-28">
                      {JSON.stringify(testResult.records, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Credentials Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center space-x-2">
              <Key className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
              <span>Supabase API Credentials</span>
            </h2>
            {savedMsg && (
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-pulse">
                {savedMsg}
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                Supabase Project URL (`VITE_SUPABASE_URL`):
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                Supabase Anon Key (`VITE_SUPABASE_ANON_KEY`):
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhY2Nlc3NfdG9rZW4iOi..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-2">
              <button
                onClick={handleSaveAndTest}
                disabled={testing}
                className="bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg text-xs transition flex items-center space-x-2 shadow-sm cursor-pointer"
              >
                {testing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Save Credentials & Test Connection</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">
              Note: System configurations are automatically saved in local environment storage and take effect immediately.
            </p>
          </div>
        </div>
      </div>

      {/* System Data Backup & Maintenance Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                System Data Backup & Maintenance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Safely export system snapshots or reset application state in a protected administrative environment.
              </p>
            </div>
          </div>

          {backupSuccessMsg && (
            <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-3 py-1 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
              {backupSuccessMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Card 1: Full System Backup */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
                <FileJson className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Full System Backup (.json)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Export all active learners, teachers, allocations, assessments, and marks into a standalone JSON file.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                  {students.length} Learners
                </span>
                <span className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                  {teachers.length} Teachers
                </span>
                <span className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                  {classes.length} Streams
                </span>
                <span className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                  {marks.length} Marks
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportBackup}
              disabled={exportingBackup}
              className="w-full bg-[#054531] hover:bg-[#043828] text-white px-3.5 py-2.5 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center justify-center space-x-2 border border-emerald-400/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.98] disabled:opacity-50"
            >
              {exportingBackup ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
              ) : (
                <Download className="w-4 h-4 text-emerald-200" />
              )}
              <span>{exportingBackup ? 'Exporting Backup...' : 'Export Backup File (.json)'}</span>
            </button>
          </div>

          {/* Card 2: Reset Seed Data */}
          <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Reset System Seed Data</span>
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                Restore the default CBE sample records (learners, classes, assessments, and grade scales). Custom unsaved data will be replaced.
              </p>
              <div className="p-2 bg-amber-100/60 dark:bg-amber-900/40 rounded-lg text-[11px] text-amber-900 dark:text-amber-200">
                Protected administrative tool for demo & test reset.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowResetConfirmModal(true)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2.5 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center justify-center space-x-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4 text-amber-100" />
              <span>Reset Seed Data...</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Seed Data Double-Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Reset System Seed Data
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to reset all records to the clean initial seed data? This operation will restore default sample records and overwrite active session modifications.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={resettingData}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition shadow-2xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{resettingData ? 'Resetting...' : 'Confirm Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Setup & DDL Schema Section */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Code2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              PostgreSQL DDL Schema & Setup Tools
            </h2>
          </div>

          <button
            onClick={handleCopySql}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 self-start sm:self-auto"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Active Script!' : `Copy ${activeSqlTab.toUpperCase()} Script`}</span>
          </button>
        </div>

        {/* Tabs for SQL Parts */}
        <div className="flex items-center space-x-1 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'part1', label: 'Part 1 (Core Tables)' },
            { id: 'part2', label: 'Part 2 (Staff & Students)' },
            { id: 'part3', label: 'Part 3 (Assessments & Marks)' },
            { id: 'part4', label: 'Part 4 (Indexes & RLS)' },
            { id: 'full', label: 'Full Combined Schema' },
            { id: 'migrations', label: 'Quick Migrations / Patches' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSqlTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap text-xs transition ${
                activeSqlTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 max-h-72 overflow-y-auto whitespace-pre leading-relaxed">
          {getSqlForTab()}
        </pre>

        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-slate-300 text-[11px] space-y-1">
          <div className="font-bold text-emerald-400 flex items-center space-x-1">
            <Terminal className="w-3.5 h-3.5" />
            <span>How to execute in Supabase:</span>
          </div>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-300">
            <li>Log into your Supabase Dashboard at your project URL.</li>
            <li>Go to <strong>SQL Editor</strong> &rarr; Click <strong>New Query</strong>.</li>
            <li>Paste the copied script and click <strong>Run</strong>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
