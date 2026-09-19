import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AcademicYear, SchoolTerm, User } from '../types';
import { api, isUUID } from '../lib/storage';

interface AcademicSessionContextType {
  activeYear: AcademicYear;
  activeTerm: SchoolTerm;
  
  viewingYear: AcademicYear;
  viewingTerm: SchoolTerm;
  
  setViewingSession: (yearId: string, termId: string) => void;
  resetToActiveSession: () => void;
  refreshSessionState: () => void;
  
  // Expose these so modules can check permissions directly against the viewing session
  isViewingActiveSession: boolean;
}

const AcademicSessionContext = createContext<AcademicSessionContextType | undefined>(undefined);

export const AcademicSessionProvider: React.FC<{ children: ReactNode; currentUser: User | null }> = ({ children, currentUser }) => {
  const [activeYear, setActiveYear] = useState<AcademicYear>(api.getActiveAcademicYear());
  const [activeTerm, setActiveTerm] = useState<SchoolTerm>(api.getActiveTerm());
  
  const [viewingYear, setViewingYear] = useState<AcademicYear>(api.getActiveAcademicYear());
  const [viewingTerm, setViewingTerm] = useState<SchoolTerm>(api.getActiveTerm());

  const refreshSessionState = () => {
    const year = api.getActiveAcademicYear();
    const term = api.getActiveTerm();
    setActiveYear(year);
    setActiveTerm(term);
    
    const years = api.getAcademicYears();
    const terms = api.getSchoolTerms();

    // If viewing active session or using legacy seed IDs, update with authoritative objects
    if (
      !isUUID(viewingYear.id) ||
      !isUUID(viewingTerm.id) ||
      (viewingYear.year === activeYear.year && viewingTerm.term_name === activeTerm.term_name) ||
      (viewingYear.id === activeYear.id && viewingTerm.id === activeTerm.id)
    ) {
      setViewingYear(year);
      setViewingTerm(term);
    } else {
      const matchedViewingYear = years.find(y => y.id === viewingYear.id || y.year === viewingYear.year);
      if (matchedViewingYear) setViewingYear(matchedViewingYear);
      
      const matchedViewingTerm = terms.find(t => 
        t.id === viewingTerm.id || 
        ((t.academic_year_id === (matchedViewingYear?.id || viewingYear.id) || t.year === viewingYear.year) && t.term_name === viewingTerm.term_name)
      );
      if (matchedViewingTerm) setViewingTerm(matchedViewingTerm);
    }
  };

  const setViewingSession = (yearId: string, termId: string) => {
    // Only admins should be able to switch sessions, or teachers with specific permission
    // But this logic will be handled by the UI component rendering the selector.
    const years = api.getAcademicYears();
    const terms = api.getSchoolTerms();
    
    const selectedYear = years.find(y => y.id === yearId);
    const selectedTerm = terms.find(t => t.id === termId);
    
    if (selectedYear && selectedTerm) {
      setViewingYear(selectedYear);
      setViewingTerm(selectedTerm);
    }
  };

  const resetToActiveSession = () => {
    setViewingYear(activeYear);
    setViewingTerm(activeTerm);
  };

  useEffect(() => {
    // Setup a listener for storage changes if needed, but for now we rely on explicit refreshes
    window.addEventListener('session-changed', refreshSessionState);
    return () => window.removeEventListener('session-changed', refreshSessionState);
  }, [activeYear.id, activeTerm.id, viewingYear.id, viewingTerm.id]);

  const isViewingActiveSession = viewingYear.id === activeYear.id && viewingTerm.id === activeTerm.id;

  return (
    <AcademicSessionContext.Provider
      value={{
        activeYear,
        activeTerm,
        viewingYear,
        viewingTerm,
        setViewingSession,
        resetToActiveSession,
        refreshSessionState,
        isViewingActiveSession
      }}
    >
      {children}
    </AcademicSessionContext.Provider>
  );
};

export const useAcademicSession = () => {
  const context = useContext(AcademicSessionContext);
  if (context === undefined) {
    throw new Error('useAcademicSession must be used within an AcademicSessionProvider');
  }
  return context;
};
