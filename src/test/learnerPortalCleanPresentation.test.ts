import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Learner Portal Clean Presentation & Phase Label Removal Audit', () => {
  const learnerPortalContent = fs.readFileSync(
    path.resolve(__dirname, '../components/LearnerPortal.tsx'),
    'utf-8'
  );

  it('1. Verifies navigation tab is cleanly named "My Report Card" without Phase pills', () => {
    expect(learnerPortalContent).toContain('<span>My Report Card</span>');
    // Ensure no Phase 6 badge inside the button
    const tabMatch = learnerPortalContent.match(/id="tab-learner-reports"[\s\S]*?<\/button>/);
    expect(tabMatch).toBeTruthy();
    if (tabMatch) {
      expect(tabMatch[0]).not.toContain('Phase 6');
      expect(tabMatch[0]).not.toContain('Phase 5');
    }
  });

  it('2. Verifies page heading is "Summative Report Card"', () => {
    expect(learnerPortalContent).toContain('Summative Report Card');
    expect(learnerPortalContent).not.toContain('Summative Report Cards (Phase 6)');
  });

  it('3. Verifies assessment status pill shows "Officially Released"', () => {
    expect(learnerPortalContent).toContain('Officially Released');
    expect(learnerPortalContent).not.toContain('Current Active Phase: Phase 6');
  });

  it('4. Verifies technical data pipeline bar does not expose internal phase or raw database UUID debug strings to learners', () => {
    expect(learnerPortalContent).not.toContain('Phase 5D Verified');
    expect(learnerPortalContent).not.toContain('Loaded {learnerMarks.length} raw database mark rows bound to student UUID');
    expect(learnerPortalContent).toContain('Assessment Records:');
    expect(learnerPortalContent).toContain('Verified by School');
  });

  it('5. Verifies internal developer comments are preserved for codebase maintainability', () => {
    expect(learnerPortalContent).toContain('// Gating for Inactive / Transferred Learner (Phase 6D.7.1)');
    expect(learnerPortalContent).toContain('{/* VIEW: REPORT CARD (PHASE 6) */}');
  });
});
