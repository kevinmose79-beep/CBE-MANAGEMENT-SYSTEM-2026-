import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Learner Portal — Enrolment Standing & Presentation Audit', () => {
  const learnerPortalContent = fs.readFileSync(
    path.resolve(__dirname, '../components/LearnerPortal.tsx'),
    'utf-8'
  );

  it('1. Verifies "Enrolment Standing" header is retained', () => {
    expect(learnerPortalContent).toContain('Enrolment Standing');
  });

  it('2. Verifies "Active Learner" is displayed as the active status badge text', () => {
    expect(learnerPortalContent).toContain('Active Learner');
  });

  it('3. Verifies clear learner-facing registration text is rendered', () => {
    expect(learnerPortalContent).toContain('You are currently registered as an active learner at this school.');
    expect(learnerPortalContent).not.toContain('Officially registered on the school roll under the CBC Competency Framework.');
  });

  it('4. Verifies technical security mode and RLS are completely removed from the learner view', () => {
    expect(learnerPortalContent).not.toContain('Security Mode:');
    expect(learnerPortalContent).not.toContain('Identity-Bound (RLS)');
    expect(learnerPortalContent).not.toContain('Row Level Security');
  });

  it('5. Verifies notice correctly states availability depends on school release state', () => {
    expect(learnerPortalContent).toContain(
      'Your marks and official report cards will appear here when they have been released by the school.'
    );
    expect(learnerPortalContent).not.toContain(
      'will become accessible in upcoming portal updates'
    );
  });

  it('6. Verifies institution and county information are maintained', () => {
    expect(learnerPortalContent).toContain('Institution:');
    expect(learnerPortalContent).toContain('County:');
  });

  it('7. Verifies inactive learner lifecycle gating remains strictly intact', () => {
    expect(learnerPortalContent).toContain("currentStudent.active === false || currentUser.status === 'Disabled'");
    expect(learnerPortalContent).toContain('Learner Account Inactive');
  });
});
