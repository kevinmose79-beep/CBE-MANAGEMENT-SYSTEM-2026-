import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('T-13C UI/UX Surgical Healing Verification', () => {
  const drawerPath = path.resolve(__dirname, '../components/terminal/AssessmentTrailDrawer.tsx');
  const cardPath = path.resolve(__dirname, '../components/terminal/TerminalResultsCard.tsx');
  const tablePath = path.resolve(__dirname, '../components/terminal/TerminalResultsTable.tsx');
  const viewPath = path.resolve(__dirname, '../components/terminal/TerminalResultsView.tsx');

  const drawerContent = fs.readFileSync(drawerPath, 'utf8');
  const cardContent = fs.readFileSync(cardPath, 'utf8');
  const tableContent = fs.readFileSync(tablePath, 'utf8');
  const viewContent = fs.readFileSync(viewPath, 'utf8');

  describe('Header & Crumbling Fix Verification', () => {
    it('verifies that the unwanted sentence is completely removed', () => {
      expect(viewContent).not.toContain('Session-centric summative calculation');
    });

    it('verifies the academic session badge and refresh action are protected against crumbling with shrink-0 and whitespace-nowrap', () => {
      expect(viewContent).toContain('shrink-0');
      expect(viewContent).toContain('whitespace-nowrap');
      expect(viewContent).toContain('id="refresh-terminal-results-btn"');
    });
  });

  describe('Defect A: Touch Target Sizing (≥44×44 CSS Pixels)', () => {
    it('verifies AssessmentTrailDrawer close button meets the 44x44px target standard', () => {
      expect(drawerContent).toContain('id="close-trail-drawer-btn"');
      expect(drawerContent).toMatch(/min-w-\[44px\]/);
      expect(drawerContent).toMatch(/min-h-\[44px\]/);
    });

    it('verifies AssessmentTrailDrawer Done footer button meets the 44px height target standard', () => {
      expect(drawerContent).toMatch(/min-h-\[44px\][^>]*>[\s\n]*Done/);
    });

    it('verifies TerminalResultsCard View Assessment Trail button meets the 44px height target standard', () => {
      expect(cardContent).toMatch(/min-h-\[44px\][^>]*>[\s\n]*<span>View Assessment Trail<\/span>/);
    });
  });

  describe('Defect B: Micro Typography Eradication (text-2xs and text-3xs removal)', () => {
    it('verifies complete absence of text-2xs in AssessmentTrailDrawer', () => {
      expect(drawerContent).not.toContain('text-2xs');
    });

    it('verifies complete absence of text-3xs in AssessmentTrailDrawer', () => {
      expect(drawerContent).not.toContain('text-3xs');
    });

    it('verifies complete absence of text-2xs in TerminalResultsCard', () => {
      expect(cardContent).not.toContain('text-2xs');
    });

    it('verifies complete absence of text-3xs in TerminalResultsCard', () => {
      expect(cardContent).not.toContain('text-3xs');
    });

    it('verifies complete absence of text-2xs in TerminalResultsTable', () => {
      expect(tableContent).not.toContain('text-2xs');
    });

    it('verifies complete absence of text-3xs in TerminalResultsTable', () => {
      expect(tableContent).not.toContain('text-3xs');
    });

    it('verifies complete absence of text-2xs in TerminalResultsView', () => {
      expect(viewContent).not.toContain('text-2xs');
    });

    it('verifies complete absence of text-3xs in TerminalResultsView', () => {
      expect(viewContent).not.toContain('text-3xs');
    });
  });

  describe('Business Rule & Static Safety Invariants', () => {
    it('confirms no CAT terminology is present in Terminal presentation files', () => {
      expect(drawerContent).not.toMatch(/\bCAT\b/);
      expect(cardContent).not.toMatch(/\bCAT\b/);
      expect(tableContent).not.toMatch(/\bCAT\b/);
    });

    it('confirms genuine zero is preserved (no falsy mark overrides or || 0)', () => {
      expect(drawerContent).not.toMatch(/entry\.rawScore\s*\|\|\s*0/);
      expect(cardContent).not.toMatch(/entry\.percentage\s*\|\|\s*0/);
    });

    it('confirms X and Y statuses are preserved and never coerced to 0', () => {
      expect(cardContent).toContain('INCOMPLETE (X)');
      expect(cardContent).toContain('INCOMPLETE (Y)');
      expect(tableContent).toContain('INCOMPLETE (X)');
      expect(tableContent).toContain('INCOMPLETE (Y)');
    });

    it('confirms strictly equal weighting banner and formula text remain intact', () => {
      expect(drawerContent).toContain('Strictly Equal Weighting');
      expect(drawerContent).toContain('Equal Weighting: (Σ Normalised %) ÷ Assessment Count');
    });
  });
});
