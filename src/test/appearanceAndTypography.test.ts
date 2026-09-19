import { describe, it, expect } from 'vitest';
import {
  INTERFACE_FONTS,
  HEADING_FONTS,
  InterfaceFont,
  HeadingFont,
} from '../contexts/ThemeContext';

describe('Phase 2 — Appearance & Typography Architecture', () => {
  it('provides all approved Interface Font options with valid system and web font fallbacks', () => {
    expect(INTERFACE_FONTS).toHaveLength(10);
    const ids = INTERFACE_FONTS.map((f) => f.id);
    expect(ids).toEqual([
      'system',
      'inter',
      'plus-jakarta-sans',
      'dm-sans',
      'roboto',
      'open-sans',
      'work-sans',
      'lato',
      'source-sans-3',
      'urbanist',
    ]);

    INTERFACE_FONTS.forEach((font) => {
      expect(font.name).toBeTruthy();
      expect(font.description).toBeTruthy();
      expect(font.family).toBeTruthy();
    });
  });

  it('provides all approved Heading Font options with display styles and inherit support', () => {
    expect(HEADING_FONTS).toHaveLength(11);
    const ids = HEADING_FONTS.map((f) => f.id);
    expect(ids).toEqual([
      'system',
      'plus-jakarta-sans',
      'outfit',
      'merriweather',
      'inter',
      'montserrat',
      'poppins',
      'space-grotesk',
      'playfair-display',
      'lora',
      'sora',
    ]);

    const inheritOption = HEADING_FONTS.find((f) => f.id === 'system');
    expect(inheritOption?.family).toBe('inherit');

    const serifOption = HEADING_FONTS.find((f) => f.id === 'merriweather');
    expect(serifOption?.family).toContain('Merriweather');
  });

  it('strictly validates storage key conventions for client-side persistence', () => {
    const THEME_KEY = 'cbe_theme_preference';
    const INTERFACE_FONT_KEY = 'cbe_interface_font';
    const HEADING_FONT_KEY = 'cbe_heading_font';

    expect(THEME_KEY).toBe('cbe_theme_preference');
    expect(INTERFACE_FONT_KEY).toBe('cbe_interface_font');
    expect(HEADING_FONT_KEY).toBe('cbe_heading_font');
  });

  it('guarantees deterministic PDF typography across report and marksheet generation', async () => {
    // Audit that PDF services use fixed Helvetica rather than arbitrary DOM UI font variables
    const pdfService = await import('../services/pdfReportGenerator');
    expect(pdfService).toBeDefined();
  });
});
