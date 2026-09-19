import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Assessment Reports Provisional Button Removal Audit', () => {
  const reportsViewPath = resolve(__dirname, '../components/ReportsView.tsx');
  const reportsViewContent = readFileSync(reportsViewPath, 'utf-8');

  it('1. Verifies Provisional button is completely removed from ReportsView tabs', () => {
    // Should not have Provisional tab button
    expect(reportsViewContent).not.toMatch(/<span>Provisional<\/span>/);
    expect(reportsViewContent).not.toMatch(/setReportTab\(['"]provisional['"]\)/);
  });

  it('2. Verifies Provisional action button and tab view are removed from ReportsView', () => {
    expect(reportsViewContent).not.toMatch(/<span>Export Provisional PDF<\/span>/);
    expect(reportsViewContent).not.toMatch(/<ProvisionalResultsView/);
    expect(reportsViewContent).not.toMatch(/exportProvisionalStudentResultsPDF/);
  });

  it('3. Verifies primary action container does not leave empty dead space', () => {
    // Action button container is only rendered when applicable
    expect(reportsViewContent).toContain("{(reportTab === 'batch' || reportTab === 'individual') && (");
  });

  it('4. Verifies Provisional approval functionality in other components is untouched', () => {
    const contextualNavPath = resolve(__dirname, '../components/AssessmentContextualNav.tsx');
    const contextualNavContent = readFileSync(contextualNavPath, 'utf-8');
    expect(contextualNavContent).toContain("id: 'provisional'");

    const appPath = resolve(__dirname, '../App.tsx');
    const appContent = readFileSync(appPath, 'utf-8');
    expect(appContent).toContain("activeTab === 'provisional'");
  });
});
