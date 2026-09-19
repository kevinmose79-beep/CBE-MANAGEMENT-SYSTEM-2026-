import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { Role } from '../types';

interface UnauthorizedViewProps {
  currentRole: Role;
  onReturnToDashboard: () => void;
}

export const UnauthorizedView: React.FC<UnauthorizedViewProps> = ({
  currentRole,
  onReturnToDashboard,
}) => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs font-mono font-bold uppercase">
            <Lock className="w-3.5 h-3.5" />
            <span>403 Access Forbidden</span>
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            You do not have permission to access this module.<br />
            Please contact the system administrator if you believe this is an error.
          </p>
        </div>

        

        <button
          onClick={onReturnToDashboard}
          className="w-full py-2.5 bg-[#176B45] hover:bg-[#0F5132] text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2 shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to My Dashboard</span>
        </button>
      </div>
    </div>
  );
};
