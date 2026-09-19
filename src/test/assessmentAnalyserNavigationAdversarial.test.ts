import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getFilteredStudents } from '../utils/filterUtils';
import { Student, ClassStream, Examination } from '../types';

describe('CBE Assessment Hub & Assessment Analyser Forensic Audit & Adversarial Probe', () => {
  const contextualNavPath = resolve(__dirname, '../components/AssessmentContextualNav.tsx');
  const contextualNavContent = readFileSync(contextualNavPath, 'utf-8');

  const analyserPath = resolve(__dirname, '../components/ExaminationAnalysisValidation.tsx');
  const analyserContent = readFileSync(analyserPath, 'utf-8');

  const streamApprovalPath = resolve(__dirname, '../components/AssessmentStreamApprovalView.tsx');
  const streamApprovalContent = readFileSync(streamApprovalPath, 'utf-8');

  const appPath = resolve(__dirname, '../App.tsx');
  const appContent = readFileSync(appPath, 'utf-8');

  // PART 1: Module Navigation Probe
  it('1. Hub Navigation: Verifies all 7 Assessment Hub modules are mapped and accessible', () => {
    const expectedModules = [
      { id: 'exams', label: 'Assessment Setup' },
      { id: 'marks-entry', label: 'Marks Entry' },
      { id: 'marks-monitoring', label: 'Marks Monitoring' },
      { id: 'exam-validation', label: 'Assessment Analyser' },
      { id: 'provisional', label: 'Provisional Results' },
      { id: 'results-approval', label: 'Results Approval' },
      { id: 'reports', label: 'Reports & Merit Lists' },
    ];

    for (const mod of expectedModules) {
      expect(contextualNavContent).toContain(`id: '${mod.id}'`);
      expect(contextualNavContent).toContain(`label: '${mod.label}'`);
      expect(contextualNavContent).toContain(`id={\`mobile-assessment-nav-\${item.id}\`}`);
      expect(contextualNavContent).toContain(`id={\`assessment-nav-\${item.id}\`}`);
    }
  });

  it('2. Mobile Presentation: Verifies collapsible module selector is compact and accessible on mobile', () => {
    expect(contextualNavContent).toContain('id="assessment-mobile-module-selector"');
    expect(contextualNavContent).toContain('className="block lg:hidden');
    expect(contextualNavContent).toContain('id="assessment-mobile-selector-trigger"');
    expect(contextualNavContent).toContain('aria-expanded={isMobileOpen}');
    expect(contextualNavContent).toContain('aria-haspopup="listbox"');
    expect(contextualNavContent).toContain('id="assessment-mobile-module-list"');
  });

  it('3. Mobile Interaction: Verifies auto-collapse on module selection and dismissals', () => {
    expect(contextualNavContent).toContain('handleSelectMobileModule');
    expect(contextualNavContent).toContain('onSelectTab(tabId);');
    expect(contextualNavContent).toContain('setIsMobileOpen(false);');
    expect(contextualNavContent).toContain("document.addEventListener('mousedown', handleOutsideClick);");
    expect(contextualNavContent).toContain("document.addEventListener('touchstart', handleOutsideClick);");
    expect(contextualNavContent).toContain("document.addEventListener('keydown', handleEscapeKey);");
  });

  it('4. Desktop Presentation: Verifies multi-column card grid is preserved on large viewports', () => {
    expect(contextualNavContent).toContain('id="assessment-desktop-module-nav"');
    expect(contextualNavContent).toContain('className="hidden lg:block');
  });

  // PART 2: App.tsx Route & Orchestration Probe
  it('5. App Orchestration: Verifies Assessment Analyser and Results Approval mount correctly', () => {
    expect(appContent).toContain("activeTab === 'exam-validation'");
    expect(appContent).toContain('<ExaminationAnalysisValidation');
    expect(appContent).toContain("activeTab === 'results-approval'");
    expect(appContent).toContain("['exams', 'marks-entry', 'marks-monitoring', 'class-marks-monitoring', 'stream-approval', 'results-approval', 'provisional', 'exam-validation', 'reports'].includes(activeTab)");
  });

  // PART 3: Assessment Analyser Class & Cohort Selection Adversarial Probe
  it('6. Assessment Analyser: Verifies class and stream selector controls exist and handle resets cleanly', () => {
    expect(analyserContent).toContain('const [selectedClassId, setSelectedClassId] = useState<string>');
    expect(analyserContent).toContain('const [selectedStreamId, setSelectedStreamId] = useState<string>');
    expect(analyserContent).toContain('const [selectedLevel, setSelectedLevel] = useState<EducationLevel');
    expect(analyserContent).toContain('const [selectedExamId, setSelectedExamId] = useState<string>');

    // Class selection handler resets stream selection to avoid cross-stream stale data
    expect(analyserContent).toContain('setSelectedClassId(e.target.value);');
    expect(analyserContent).toContain("setSelectedStreamId('');");
  });

  it('7. Class Selection Functional Logic: Tests pure cohort filtering with real class/stream data', () => {
    const mockClasses: ClassStream[] = [
      { id: 'cls-g7-blue', class_name: 'Grade 7', stream: 'Blue', education_level: 'Junior School', status: 'Active' },
      { id: 'cls-g7-red', class_name: 'Grade 7', stream: 'Red', education_level: 'Junior School', status: 'Active' },
      { id: 'cls-g8-blue', class_name: 'Grade 8', stream: 'Blue', education_level: 'Junior School', status: 'Active' },
      { id: 'cls-g8-red', class_name: 'Grade 8', stream: 'Red', education_level: 'Junior School', status: 'Active' },
      { id: 'cls-g9-blue', class_name: 'Grade 9', stream: 'Blue', education_level: 'Junior School', status: 'Active' },
      { id: 'cls-g9-red', class_name: 'Grade 9', stream: 'Red', education_level: 'Junior School', status: 'Active' },
    ];

    const mockStudents: Student[] = [
      { id: 'std-1', admission_number: '1001', full_name: 'Alice G7 Blue', gender: 'F', class_id: 'cls-g7-blue', stream_id: 'cls-g7-blue', active: true },
      { id: 'std-2', admission_number: '1002', full_name: 'Bob G7 Red', gender: 'M', class_id: 'cls-g7-red', stream_id: 'cls-g7-red', active: true },
      { id: 'std-3', admission_number: '1003', full_name: 'Charlie G8 Blue', gender: 'M', class_id: 'cls-g8-blue', stream_id: 'cls-g8-blue', active: true },
      { id: 'std-4', admission_number: '1004', full_name: 'Diana G8 Red', gender: 'F', class_id: 'cls-g8-red', stream_id: 'cls-g8-red', active: true },
      { id: 'std-5', admission_number: '1005', full_name: 'Evan G9 Blue', gender: 'M', class_id: 'cls-g9-blue', stream_id: 'cls-g9-blue', active: true },
      { id: 'std-6', admission_number: '1006', full_name: 'Fiona G9 Red', gender: 'F', class_id: 'cls-g9-red', stream_id: 'cls-g9-red', active: true },
    ];

    const mockExam: Examination = {
      id: 'exam-1',
      exam_name: 'Opener 2026',
      term: 'Term 1',
      year: 2026,
      status: 'Open',
      exam_type: 'CAT',
      max_marks: 100,
    };

    // Test Selection 1: Grade 8 All Streams
    const g8Students = getFilteredStudents(mockStudents, mockClasses, 'Grade 8', '', mockExam);
    expect(g8Students.map((s) => s.id)).toEqual(['std-3', 'std-4']);

    // Test Selection 2: Grade 8 Blue Stream
    const g8BlueStudents = getFilteredStudents(mockStudents, mockClasses, 'Grade 8', 'cls-g8-blue', mockExam);
    expect(g8BlueStudents.map((s) => s.id)).toEqual(['std-3']);

    // Test Selection 3: Rapid Switch to Grade 8 Red Stream
    const g8RedStudents = getFilteredStudents(mockStudents, mockClasses, 'Grade 8', 'cls-g8-red', mockExam);
    expect(g8RedStudents.map((s) => s.id)).toEqual(['std-4']);

    // Test Selection 4: Switch to Grade 7 Blue Stream
    const g7BlueStudents = getFilteredStudents(mockStudents, mockClasses, 'Grade 7', 'cls-g7-blue', mockExam);
    expect(g7BlueStudents.map((s) => s.id)).toEqual(['std-1']);

    // Test Selection 5: Switch to Grade 9 Red Stream
    const g9RedStudents = getFilteredStudents(mockStudents, mockClasses, 'Grade 9', 'cls-g9-red', mockExam);
    expect(g9RedStudents.map((s) => s.id)).toEqual(['std-6']);

    // Verify no cross-class or stale data leakage
    expect(g8BlueStudents.some((s) => s.class_id === 'cls-g7-blue' || s.stream_id === 'cls-g8-red')).toBe(false);
    expect(g7BlueStudents.some((s) => s.class_id === 'cls-g8-blue' || s.stream_id === 'cls-g7-red')).toBe(false);
  });

  // PART 4: Results Approval Quick Nav Probe
  it('8. Results Approval: Verifies stream approval view contains mobile collapsible navigation', () => {
    expect(streamApprovalContent).toContain('id="results-approval-mobile-nav-trigger"');
    expect(streamApprovalContent).toContain('id="results-approval-mobile-nav-dropdown"');
    expect(streamApprovalContent).toContain('Results Approval &amp; Release');
  });

  // PART 5: Database & Logic Safety Verification
  it('9. Database & Calculations Safety: Verifies no destructive modifications to calculations or APIs', () => {
    // Verifies analysis engine functions are imported and intact
    expect(analyserContent).toContain('getGradeForMark');
    expect(analyserContent).toContain('getLearnerReportSubjects');
    expect(analyserContent).toContain('computeExamReadiness');
    expect(analyserContent).toContain('evaluateMark');
  });

  // PART 6: Stream Inspection & Smooth Diagnostics Scroll Navigation
  it('10. Stream Diagnostics Navigation: Verifies handleInspectStream, scroll refs, and visual highlight states', () => {
    // Verifies stream inspection handler exists and updates level, class, and stream
    expect(analyserContent).toContain('const handleInspectStream = (level: EducationLevel, className: string, streamObj: ClassStream) =>');
    expect(analyserContent).toContain('setSelectedLevel(level);');
    expect(analyserContent).toContain('setSelectedClassId(className);');
    expect(analyserContent).toContain('const targetStreamKey = streamObj.stream_id || streamObj.stream || streamObj.id;');
    expect(analyserContent).toContain('setSelectedStreamId(targetStreamKey);');
    expect(analyserContent).toContain('setHighlightDiagnostics(true);');

    // Verifies smooth scrolling logic into diagnostics section
    expect(analyserContent).toContain('diagnosticsSectionRef.current.scrollIntoView');
    expect(analyserContent).toContain("behavior: 'smooth'");
    expect(analyserContent).toContain("block: 'start'");

    // Verifies DOM refs and anchor IDs
    expect(analyserContent).toContain('ref={diagnosticsSectionRef}');
    expect(analyserContent).toContain('id="detailed-diagnostics-section"');
    expect(analyserContent).toContain('ref={streamListSectionRef}');
    expect(analyserContent).toContain('id="assessment-analyser-streams-list"');

    // Verifies Back to Stream List button and handler
    expect(analyserContent).toContain('handleScrollToStreamList');
    expect(analyserContent).toContain('Back to Stream List');

    // Verifies Visual Highlight Badge / State
    expect(analyserContent).toContain('Focused Stream Diagnostics');
  });

  // PART 7: Single-Stream Strict Isolation Verification
  it('11. Single Stream Selection Isolation: Ensures only one stream is highlighted at a time without multi-detection', () => {
    // Verifies isInspected requires Boolean(selectedStreamId) and does not fall back to class-wide matching
    expect(analyserContent).toContain('Boolean(selectedStreamId)');
    expect(analyserContent).not.toContain('(!selectedStreamId && selectedClassId === st.className)');

    // Verifies individual stream matching logic
    expect(analyserContent).toContain('Boolean(st.streamObj.stream_id) && selectedStreamId === st.streamObj.stream_id');
    expect(analyserContent).toContain('Boolean(st.streamName) && selectedStreamId.trim().toLowerCase() === st.streamName.trim().toLowerCase()');
  });

  // PART 8: Educational Level Default Collapsed State Verification
  it('12. Educational Levels Default Collapsed: Ensures levels start compact/collapsed unless explicitly expanded', () => {
    expect(analyserContent).toContain('const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({});');
    expect(analyserContent).toContain('const isExpanded = Boolean(expandedLevels[lvlGrp.level]);');
    expect(analyserContent).toContain('toggleLevelExpand(lvlGrp.level)');
    expect(analyserContent).toContain('{isExpanded && (');
  });
});

