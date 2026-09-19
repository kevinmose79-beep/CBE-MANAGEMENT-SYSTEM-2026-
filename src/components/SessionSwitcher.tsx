import React from 'react';
import { Calendar, ChevronDown, RefreshCw } from 'lucide-react';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { api } from '../lib/storage';

export const SessionSwitcher: React.FC = () => {
  const { viewingYear, viewingTerm, activeYear, activeTerm, setViewingSession, resetToActiveSession, isViewingActiveSession } = useAcademicSession();

  const handleSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [yearId, termId] = val.split('|');
    setViewingSession(yearId, termId);
  };

  const years = api.getAcademicYears();
  const terms = api.getSchoolTerms();

  return (
    <div className="flex items-center justify-between space-x-1.5 bg-[#054531] hover:bg-[#043828] px-2.5 py-1 md:py-1.5 rounded-lg border border-[#087F5B]/50 w-full sm:w-auto overflow-hidden transition">
      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
        <Calendar className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
        <select
          value={`${viewingYear.id}|${viewingTerm.id}`}
          onChange={handleSwitch}
          className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer hover:text-emerald-100 appearance-none min-w-0 flex-1 truncate pr-1"
        >
          {years.map(year => (
            <optgroup key={year.id} label={`Year ${year.year}`} className="bg-[#075E42] text-white font-bold">
              {terms.filter(t => t.academic_year_id === year.id).map(term => (
                <option key={term.id} value={`${year.id}|${term.id}`} className="bg-slate-900 text-white font-medium">
                  {term.term_name} • {year.year} {activeYear.id === year.id && activeTerm.id === term.id ? '(Active)' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-emerald-200 pointer-events-none shrink-0" />
      </div>
      {!isViewingActiveSession && (
        <button
          onClick={resetToActiveSession}
          className="text-amber-300 hover:text-amber-200 ml-1 p-0.5 cursor-pointer shrink-0"
          title="Return to Active Session"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

