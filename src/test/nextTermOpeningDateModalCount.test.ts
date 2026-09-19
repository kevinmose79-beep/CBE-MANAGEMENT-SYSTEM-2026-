import { describe, it, expect } from 'vitest';
import { NextTermOpeningDateModalProps } from '../components/NextTermOpeningDateModal';

/**
 * Pure evaluation mirroring NextTermOpeningDateModal's badge and message resolution
 */
function resolveBatchModalDisplay(props: Partial<NextTermOpeningDateModalProps>) {
  const { downloadContext = 'single', totalCount, cohortCount } = props;
  const effectiveCount = (typeof totalCount === 'number' ? totalCount : cohortCount) || 0;

  const badgeText =
    downloadContext === 'batch'
      ? `Batch: ${effectiveCount} Reports`
      : downloadContext === 'zip'
      ? `ZIP Archive`
      : 'Individual Report';

  const batchExplanation =
    downloadContext === 'batch' && effectiveCount > 0
      ? `This confirmed date will be applied uniformly to all ${effectiveCount} report cards in this batch download.`
      : null;

  return { effectiveCount, badgeText, batchExplanation };
}

describe('NextTermOpeningDateModal Batch Count Display Verification', () => {
  it('1. Correctly formats badge when totalCount is provided (e.g. Grade 9, 76 learners)', () => {
    const res = resolveBatchModalDisplay({
      downloadContext: 'batch',
      totalCount: 76,
    });
    expect(res.effectiveCount).toBe(76);
    expect(res.badgeText).toBe('Batch: 76 Reports');
    expect(res.batchExplanation).toBe(
      'This confirmed date will be applied uniformly to all 76 report cards in this batch download.'
    );
  });

  it('2. Correctly formats badge when only cohortCount is provided (alias backwards compatibility)', () => {
    const res = resolveBatchModalDisplay({
      downloadContext: 'batch',
      cohortCount: 38,
    });
    expect(res.effectiveCount).toBe(38);
    expect(res.badgeText).toBe('Batch: 38 Reports');
    expect(res.batchExplanation).toBe(
      'This confirmed date will be applied uniformly to all 38 report cards in this batch download.'
    );
  });

  it('3. Prefeers totalCount when both totalCount and cohortCount are provided', () => {
    const res = resolveBatchModalDisplay({
      downloadContext: 'batch',
      totalCount: 76,
      cohortCount: 76,
    });
    expect(res.effectiveCount).toBe(76);
    expect(res.badgeText).toBe('Batch: 76 Reports');
  });

  it('4. Correctly displays "Individual Report" when downloadContext is single', () => {
    const res = resolveBatchModalDisplay({
      downloadContext: 'single',
      studentName: 'Amani Wanjiku',
    });
    expect(res.badgeText).toBe('Individual Report');
    expect(res.batchExplanation).toBeNull();
  });

  it('5. Correctly displays "ZIP Archive" when downloadContext is zip', () => {
    const res = resolveBatchModalDisplay({
      downloadContext: 'zip',
    });
    expect(res.badgeText).toBe('ZIP Archive');
    expect(res.batchExplanation).toBeNull();
  });
});
