import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Learner Portal — Non-Technical Learner-Facing Profile Audit', () => {
  const learnerPortalContent = fs.readFileSync(
    path.resolve(__dirname, '../components/LearnerPortal.tsx'),
    'utf-8'
  );

  it('1. Verifies technical login email/account binding details are removed from the learner UI', () => {
    expect(learnerPortalContent).not.toContain('Linked Account Login');
    expect(learnerPortalContent).not.toContain('Identity-Isolated');
  });

  it('2. Verifies raw database record UUID presentation is removed from the learner profile', () => {
    expect(learnerPortalContent).not.toContain('Database Record UUID');
    expect(learnerPortalContent).not.toContain('{currentStudent.id}');
  });

  it('3. Verifies "Read-Only Official Record" technical prefix is removed', () => {
    expect(learnerPortalContent).not.toContain('Read-Only Official Record:');
  });

  it('4. Verifies clean, friendly learner-facing account message is rendered', () => {
    expect(learnerPortalContent).toContain(
      'Your learner account is securely linked to your official school record.'
    );
    expect(learnerPortalContent).toContain(
      'Your name, class and admission details are managed by the school administration. If any information is incorrect, please contact your Class Teacher.'
    );
  });

  it('5. Verifies marks overview status badge uses non-technical wording', () => {
    expect(learnerPortalContent).toContain('Official School Record');
    expect(learnerPortalContent).not.toContain('Verified Database Record');
  });

  it('6. Verifies background student identity resolution and security pipelines remain intact', () => {
    expect(learnerPortalContent).toContain('const studentUuid = currentStudent?.id || studentId;');
    expect(learnerPortalContent).toContain('api.fetchMarksForLearner');
  });
});
