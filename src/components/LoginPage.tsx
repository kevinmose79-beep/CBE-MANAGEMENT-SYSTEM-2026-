import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { School, User as AppUser } from '../types';
import { authService } from '../services/authService';
import { getSupabaseClient } from '../lib/storage';
import { getUserFriendlyErrorMessage } from '../utils/errorUtils';

interface LoginPageProps {
  school: School;
  onLoginSuccess: (user: AppUser) => void;
  dbStatusSuccess?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  school,
  onLoginSuccess,
  dbStatusSuccess = true,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [currentSchool, setCurrentSchool] = useState<School>(school);

  // Fetch branding information dynamically from school_profile in Supabase
  useEffect(() => {
    let isMounted = true;
    const fetchSchoolProfile = async () => {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client.from('school_profile').select('*').limit(1);
          if (!error && data && data.length > 0) {
            const sp = data[0];
            if (sp.school_name && sp.school_name.trim().length > 0 && isMounted) {
              const postalVal = sp.postal_code || sp.address || '';
              setCurrentSchool({
                id: sp.id || 'sch_001',
                school_name: sp.school_name.trim(),
                motto: sp.motto || sp.school_motto || '',
                county: sp.county || '',
                postal_code: postalVal,
                address: postalVal,
                email: sp.email || sp.email_address || '',
              });
            }
          }
        }
      } catch (err) {
        // Fallback gracefully to school prop
      }
    };

    fetchSchoolProfile();

    if (school?.school_name?.trim()) {
      setCurrentSchool(school);
    }

    return () => {
      isMounted = false;
    };
  }, [school]);

  const hasSchoolProfile = Boolean(
    currentSchool?.school_name &&
    currentSchool.school_name.trim().length > 0 &&
    currentSchool.school_name !== 'Anon Hack' &&
    currentSchool.school_name !== 'Muchorwe Comprehensive School' &&
    currentSchool.school_name !== 'MUCHORWE COMPREHENSIVE SCHOOL'
  );
  const displaySchoolName = hasSchoolProfile ? currentSchool.school_name : 'CBE MANAGEMENT SYSTEM';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your Login ID and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Authenticate with Supabase Auth - the system resolves email/TSC number/admission number automatically
      const result = await authService.signIn(email, password);
      if (result.error) {
        setErrorMsg(getUserFriendlyErrorMessage(result.error, 'Authentication failed. Please verify your credentials.'));
      } else if (result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMsg('Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setErrorMsg(getUserFriendlyErrorMessage(err, 'An unexpected error occurred during authentication.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        
        {/* School Branding */}
        <div className="text-center space-y-4 min-h-[120px] flex flex-col items-center justify-center">
          <div className="flex justify-center">
            {hasSchoolProfile && currentSchool.logo_url && !logoError ? (
              <img
                src={currentSchool.logo_url}
                alt={displaySchoolName}
                onError={() => setLogoError(true)}
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-xl"
              />
            ) : (
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#176B45] text-white mb-2 shadow-lg shadow-[#0F5132]/30 dark:shadow-[#0F5132]/50">
                <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
              {displaySchoolName}
            </h1>
            <p className="font-script text-lg sm:text-xl text-slate-600 dark:text-slate-400 font-medium tracking-wide">
              Smarter Management. Better Decisions.
            </p>
          </div>
        </div>

        {/* Login Container */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-8 transition-colors duration-200">
          
          {/* Welcome Section */}
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Welcome
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enter Your Login ID and Password
            </p>
          </div>

          {/* Error Messages */}
          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm p-4 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Login ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Login ID"
                  required
                  autoComplete="username"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] transition placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-11 pr-12 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] transition placeholder-slate-400 dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#176B45] to-[#0F5132] hover:from-[#0F5132] hover:to-[#176B45] text-white font-medium rounded-xl shadow-lg shadow-[#0F5132]/20 transition flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4 cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-500 dark:text-slate-400 text-sm mt-8">
          <p>© 2026 {hasSchoolProfile ? currentSchool.school_name : 'CBE Management System'}</p>
        </div>
      </motion.div>
    </div>
  );
};

