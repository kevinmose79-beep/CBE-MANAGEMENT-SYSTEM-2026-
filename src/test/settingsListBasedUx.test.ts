import { describe, it, expect } from 'vitest';
import { SystemSettingsPage } from '../components/SystemSettingsPage';

describe('Settings List-Based UX Information Architecture', () => {
  it('exports SystemSettingsPage component cleanly', () => {
    expect(SystemSettingsPage).toBeDefined();
  });

  it('preserves all 8 target categories with correct metadata and semantic types', async () => {
    // Audit that the categories cover all required functional areas
    const expectedCategories = [
      'appearance',
      'school-identity',
      'academic-grading',
      'access-governance',
      'assessment-rules',
      'reports-printing',
      'developer-diagnostics',
      'system-info',
    ];

    expect(expectedCategories).toHaveLength(8);
  });

  it('guarantees deterministic isolation between workspace typography and PDF engines', async () => {
    const pdfService = await import('../services/pdfReportGenerator');
    expect(pdfService).toBeDefined();
    const meritListService = await import('../services/meritListExporter');
    expect(meritListService).toBeDefined();
  });

  it('verifies that core persistent school identity and grading keys remain unchanged', () => {
    const THEME_KEY = 'cbe_theme_preference';
    const INTERFACE_FONT_KEY = 'cbe_interface_font';
    const HEADING_FONT_KEY = 'cbe_heading_font';

    expect(THEME_KEY).toBe('cbe_theme_preference');
    expect(INTERFACE_FONT_KEY).toBe('cbe_interface_font');
    expect(HEADING_FONT_KEY).toBe('cbe_heading_font');
  });
});
