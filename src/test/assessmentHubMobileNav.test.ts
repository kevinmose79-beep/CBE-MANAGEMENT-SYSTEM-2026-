import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('CBE Assessment Hub Mobile Navigation Forensic Test Suite', () => {
  const contextualNavPath = resolve(__dirname, '../components/AssessmentContextualNav.tsx');
  const contextualNavContent = readFileSync(contextualNavPath, 'utf-8');

  it('1. Verifies Collapsible Module Selector container and toggle are present on mobile', () => {
    expect(contextualNavContent).toContain('id="assessment-mobile-module-selector"');
    expect(contextualNavContent).toContain('id="assessment-mobile-selector-trigger"');
    expect(contextualNavContent).toContain('aria-expanded={isMobileOpen}');
    expect(contextualNavContent).toContain('aria-haspopup="listbox"');
    expect(contextualNavContent).toContain('id="assessment-mobile-module-list"');
  });

  it('2. Verifies all 7 admin Assessment Hub modules are defined and accessible', () => {
    const requiredModules = [
      { id: 'exams', label: 'Assessment Setup' },
      { id: 'marks-entry', label: 'Marks Entry' },
      { id: 'marks-monitoring', label: 'Marks Monitoring' },
      { id: 'exam-validation', label: 'Assessment Analyser' },
      { id: 'provisional', label: 'Provisional Results' },
      { id: 'results-approval', label: 'Results Approval' },
      { id: 'reports', label: 'Reports & Merit Lists' },
    ];

    for (const mod of requiredModules) {
      expect(contextualNavContent).toContain(`id: '${mod.id}'`);
      expect(contextualNavContent).toContain(`label: '${mod.label}'`);
      expect(contextualNavContent).toContain(`id={\`mobile-assessment-nav-\${item.id}\`}`);
      expect(contextualNavContent).toContain(`id={\`assessment-nav-\${item.id}\`}`);
    }
  });

  it('3. Verifies automatic collapse upon selecting a module', () => {
    expect(contextualNavContent).toContain('const handleSelectMobileModule = (tabId: TabType) => {');
    expect(contextualNavContent).toContain('onSelectTab(tabId);');
    expect(contextualNavContent).toContain('setIsMobileOpen(false);');
  });

  it('4. Verifies outside-tap and Escape-key dismissal event listeners are registered', () => {
    expect(contextualNavContent).toContain("document.addEventListener('mousedown', handleOutsideClick);");
    expect(contextualNavContent).toContain("document.addEventListener('touchstart', handleOutsideClick);");
    expect(contextualNavContent).toContain("document.addEventListener('keydown', handleEscapeKey);");
    expect(contextualNavContent).toContain("if (isMobileOpen && event.key === 'Escape')");
  });

  it('5. Verifies desktop multi-column view is preserved for larger screens', () => {
    expect(contextualNavContent).toContain('id="assessment-desktop-module-nav"');
    expect(contextualNavContent).toContain('className="hidden lg:block');
    expect(contextualNavContent).toContain('className="block lg:hidden');
  });

  it('6. Verifies current active module is identified and clearly indicated', () => {
    expect(contextualNavContent).toContain('const currentActiveItem = navItems.find(isItemActive) || navItems[0];');
    expect(contextualNavContent).toContain('{currentActiveItem.label}');
    expect(contextualNavContent).toContain('{currentActiveItem.icon}');
    expect(contextualNavContent).toContain('Current');
  });
});
