import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('CBE Results Approval & Release Mobile Navigation Forensic Test Suite', () => {
  const streamApprovalPath = resolve(__dirname, '../components/AssessmentStreamApprovalView.tsx');
  const streamApprovalContent = readFileSync(streamApprovalPath, 'utf-8');

  const assessmentContextualNavPath = resolve(__dirname, '../components/AssessmentContextualNav.tsx');
  const contextualNavContent = readFileSync(assessmentContextualNavPath, 'utf-8');

  it('1. Verifies Results Approval is a registered navigation item in Assessment Hub', () => {
    expect(contextualNavContent).toContain("id: 'results-approval'");
    expect(contextualNavContent).toContain("label: 'Results Approval'");
  });

  it('2. Verifies Collapsible Module Selector trigger is present in Stream Approval View on mobile', () => {
    expect(streamApprovalContent).toContain('id="results-approval-mobile-nav-trigger"');
    expect(streamApprovalContent).toContain('aria-expanded={isMobileNavOpen}');
    expect(streamApprovalContent).toContain('aria-haspopup="listbox"');
    expect(streamApprovalContent).toContain('Results Approval &amp; Release');
  });

  it('3. Verifies mobile dropdown contains valid destination options with automatic closing', () => {
    expect(streamApprovalContent).toContain('id="results-approval-mobile-nav-dropdown"');
    expect(streamApprovalContent).toContain('id="results-approval-mobile-nav-marks-entry"');
    expect(streamApprovalContent).toContain('id="results-approval-mobile-nav-reports"');
    expect(streamApprovalContent).toContain('handleSelectMobileNav');
    expect(streamApprovalContent).toContain('setIsMobileNavOpen(false)');
  });

  it('4. Verifies outside-click and Escape event listeners are registered', () => {
    expect(streamApprovalContent).toContain("document.addEventListener('mousedown', handleOutsideClick);");
    expect(streamApprovalContent).toContain("document.addEventListener('touchstart', handleOutsideClick);");
    expect(streamApprovalContent).toContain("document.addEventListener('keydown', handleEscapeKey);");
    expect(streamApprovalContent).toContain("if (isMobileNavOpen && event.key === 'Escape')");
  });

  it('5. Verifies desktop quick navigation is preserved for tablet/desktop viewports', () => {
    expect(streamApprovalContent).toContain('className="hidden md:flex flex-wrap items-center gap-2 shrink-0"');
    expect(streamApprovalContent).toContain('className="relative block md:hidden pt-2 border-t border-slate-100');
  });
});
