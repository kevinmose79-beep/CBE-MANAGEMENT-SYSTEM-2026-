import React from 'react';
import { School as SchoolIcon, X } from 'lucide-react';
import { School } from '../types';
import { SchoolProfileView } from './SchoolProfileView';

interface SchoolProfileModalProps {
  isOpen: boolean;
  school: School;
  onSave: (updatedSchool: School) => void;
  onClose: () => void;
}

export const SchoolProfileModal: React.FC<SchoolProfileModalProps> = ({
  isOpen,
  school,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleSaveAndClose = (updatedSchool: School) => {
    onSave(updatedSchool);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-4 sm:p-6 text-xs my-4 sm:my-8 max-h-[90vh] overflow-y-auto relative">
        <div className="flex items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 sticky top-0 bg-white dark:bg-slate-900 z-10 min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-start space-x-2.5 sm:space-x-2 min-w-0 pr-1.5">
            <SchoolIcon className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="min-w-0 leading-snug">School Information &amp; Official Branding</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 -mr-1"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <SchoolProfileView school={school} onSaveSchool={handleSaveAndClose} />
      </div>
    </div>
  );
};
