import React, { useState, useEffect } from 'react';
import { Database, X, Copy, Check, Terminal, Server, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  SUPABASE_PART1,
  SUPABASE_PART2,
  SUPABASE_PART3,
  SUPABASE_PART4,
  SUPABASE_SQL_SCHEMA,
  SUPABASE_QUICK_MIGRATIONS,
} from '../lib/supabaseSql';
import {
  supabase,
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from '../lib/storage';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeSqlTab, setActiveSqlTab] = useState<'part1' | 'part2' | 'part3' | 'part4' | 'full' | 'migrations'>('part1');
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setUrl(creds.url);
      setAnonKey(creds.anonKey);
      setTestResult(null);
      setSavedMsg('');
      if (creds.url && creds.anonKey) {
        handleTestConnection(creds.url, creds.anonKey);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getSqlForTab = () => {
    switch (activeSqlTab) {
      case 'part1': return SUPABASE_PART1;
      case 'part2': return SUPABASE_PART2;
      case 'part3': return SUPABASE_PART3;
      case 'part4': return SUPABASE_PART4;
      case 'full': return SUPABASE_SQL_SCHEMA;
      case 'migrations': return SUPABASE_QUICK_MIGRATIONS;
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(getSqlForTab());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAndTest = async () => {
    saveSupabaseCredentials(url, anonKey);
    setSavedMsg('Credentials saved successfully!');
    setTimeout(() => setSavedMsg(''), 3000);
    await handleTestConnection(url, anonKey);
  };

  const handleTestConnection = async (testUrl?: string, testKey?: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection(testUrl || url, testKey || anonKey);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Unexpected test failure: ${err.message || String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-800 max-w-2xl w-full p-6 text-xs max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Supabase Connection & Database Tester</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Status Badge */}
          <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Supabase Cloud Engine Status:</span>
            </div>
            <span
              className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase ${
                testResult?.success || supabase
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {testResult?.success
                ? 'Connected & Verified'
                : url && anonKey
                ? 'Credentials Present (Pending Test)'
                : 'Not Connected (Missing Credentials)'}
            </span>
          </div>

          {/* Credentials Inputs */}
          <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-lg space-y-3">
            <div className="font-bold text-slate-200 text-xs flex items-center justify-between">
              <span>Supabase Project Configuration:</span>
              {savedMsg && <span className="text-emerald-400 text-[11px] font-semibold">{savedMsg}</span>}
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Supabase Project URL (VITE_SUPABASE_URL):</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project-ref.supabase.co"
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Supabase Anon API Key (VITE_SUPABASE_ANON_KEY):</label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhY2Nlc3NfdG9rZW4iOi..."
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={handleSaveAndTest}
                disabled={testing}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded text-xs transition flex items-center space-x-2"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                <span>{testing ? 'Testing Connection...' : 'Save & Test Connection'}</span>
              </button>

              <button
                onClick={() => handleTestConnection()}
                disabled={testing || !url || !anonKey}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white font-semibold px-3 py-2 rounded text-xs transition flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>Test Reading 'school_profile' Table</span>
              </button>
            </div>
          </div>

          {/* Test Results Output */}
          {testResult && (
            <div
              className={`p-3.5 border rounded-lg space-y-2 ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="flex items-start space-x-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="space-y-1">
                  <div className="font-bold text-xs">
                    {testResult.success ? 'Supabase Connection Successful!' : 'Supabase Connection Check Failed'}
                  </div>
                  <div className="text-[11px] leading-relaxed">{testResult.message}</div>
                </div>
              </div>

              {testResult.success && testResult.records && (
                <div className="mt-2 pt-2 border-t border-emerald-800/50">
                  <div className="font-mono text-[10px] text-emerald-300 font-bold mb-1">
                    Query Output (`SELECT * FROM school_profile LIMIT 5`):
                  </div>
                  <pre className="bg-slate-950 p-2 rounded text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-32">
                    {JSON.stringify(testResult.records, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Copy SQL Box with Split Parts */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-slate-300 flex items-center space-x-1">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>PostgreSQL DDL & RLS Policies (Execute in Order):</span>
              </span>

              <button
                onClick={handleCopySql}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1 rounded text-[11px] transition flex items-center space-x-1 self-start sm:self-auto"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Active Part!' : `Copy ${activeSqlTab.toUpperCase()}`}</span>
              </button>
            </div>

            {/* Tabs for 4 Parts + Full + Migrations */}
            <div className="flex items-center space-x-1 border-b border-slate-800 pb-1 overflow-x-auto">
              {[
                { id: 'part1', label: 'Part 1 (Core)' },
                { id: 'part2', label: 'Part 2 (Staff & Students)' },
                { id: 'part3', label: 'Part 3 (Exams & Marks)' },
                { id: 'part4', label: 'Part 4 (Indexes & RLS)' },
                { id: 'full', label: 'Full Combined' },
                { id: 'migrations', label: 'Quick Migrations' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSqlTab(tab.id as any)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition ${
                    activeSqlTab === tab.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 max-h-40 overflow-y-auto whitespace-pre">
              {getSqlForTab()}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

