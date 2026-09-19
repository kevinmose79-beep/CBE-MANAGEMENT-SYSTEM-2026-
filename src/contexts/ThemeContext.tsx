import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type InterfaceFont =
  | 'system'
  | 'inter'
  | 'plus-jakarta-sans'
  | 'dm-sans'
  | 'roboto'
  | 'open-sans'
  | 'work-sans'
  | 'lato'
  | 'source-sans-3'
  | 'urbanist';

export type HeadingFont =
  | 'system'
  | 'plus-jakarta-sans'
  | 'outfit'
  | 'merriweather'
  | 'inter'
  | 'montserrat'
  | 'poppins'
  | 'space-grotesk'
  | 'playfair-display'
  | 'lora'
  | 'sora';

export interface FontOption<T extends string> {
  id: T;
  name: string;
  description: string;
  family: string;
}

export const INTERFACE_FONTS: FontOption<InterfaceFont>[] = [
  {
    id: 'system',
    name: 'System Default',
    description: 'Native operating system system-ui stack',
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: 'inter',
    name: 'Inter',
    description: 'Crisp, highly legible modern UI sans-serif',
    family: "'Inter', sans-serif",
  },
  {
    id: 'plus-jakarta-sans',
    name: 'Plus Jakarta Sans',
    description: 'Geometric, friendly and refined sans-serif',
    family: "'Plus Jakarta Sans', sans-serif",
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    description: 'Low-contrast, warm and contemporary sans-serif',
    family: "'DM Sans', sans-serif",
  },
  {
    id: 'roboto',
    name: 'Roboto',
    description: 'Balanced neo-grotesque standard typeface',
    family: "'Roboto', sans-serif",
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    description: 'Approachable, neutral humanist sans-serif',
    family: "'Open Sans', sans-serif",
  },
  {
    id: 'work-sans',
    name: 'Work Sans',
    description: 'Clean, grotesque sans-serif optimized for on-screen UI',
    family: "'Work Sans', sans-serif",
  },
  {
    id: 'lato',
    name: 'Lato',
    description: 'Warm, elegant, and harmonious modern sans-serif',
    family: "'Lato', sans-serif",
  },
  {
    id: 'source-sans-3',
    name: 'Source Sans 3',
    description: 'Professional, highly readable open-source UI standard',
    family: "'Source Sans 3', sans-serif",
  },
  {
    id: 'urbanist',
    name: 'Urbanist',
    description: 'Sleek, refined contemporary geometric sans-serif',
    family: "'Urbanist', sans-serif",
  },
];

export const HEADING_FONTS: FontOption<HeadingFont>[] = [
  {
    id: 'system',
    name: 'Inherit Interface Font',
    description: 'Seamlessly matches the active UI body font',
    family: 'inherit',
  },
  {
    id: 'plus-jakarta-sans',
    name: 'Plus Jakarta Sans',
    description: 'Modern geometric display style with strong hierarchy',
    family: "'Plus Jakarta Sans', sans-serif",
  },
  {
    id: 'outfit',
    name: 'Outfit',
    description: 'Bold, structured, and modern editorial heading style',
    family: "'Outfit', sans-serif",
  },
  {
    id: 'merriweather',
    name: 'Merriweather (Serif)',
    description: 'Distinguished, academic serif style for institutional authority',
    family: "'Merriweather', serif",
  },
  {
    id: 'inter',
    name: 'Inter Display',
    description: 'Clean, dense, and neutral tech heading style',
    family: "'Inter', sans-serif",
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    description: 'Confident, architectural geometric display typeface',
    family: "'Montserrat', sans-serif",
  },
  {
    id: 'poppins',
    name: 'Poppins',
    description: 'Friendly, geometric curves with balanced circular architecture',
    family: "'Poppins', sans-serif",
  },
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    description: 'Distinctive, tech-forward editorial display font',
    family: "'Space Grotesk', sans-serif",
  },
  {
    id: 'playfair-display',
    name: 'Playfair Display (Serif)',
    description: 'High-contrast, elegant serif for prestigious headers',
    family: "'Playfair Display', serif",
  },
  {
    id: 'lora',
    name: 'Lora (Serif)',
    description: 'Warm, literary contemporary serif with refined curves',
    family: "'Lora', serif",
  },
  {
    id: 'sora',
    name: 'Sora',
    description: 'Futuristic geometric display font designed for modern screens',
    family: "'Sora', sans-serif",
  },
];

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  interfaceFont: InterfaceFont;
  setInterfaceFont: (font: InterfaceFont) => void;
  headingFont: HeadingFont;
  setHeadingFont: (font: HeadingFont) => void;
  interfaceFonts: FontOption<InterfaceFont>[];
  headingFonts: FontOption<HeadingFont>[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'cbe_theme_preference';
const INTERFACE_FONT_STORAGE_KEY = 'cbe_interface_font';
const HEADING_FONT_STORAGE_KEY = 'cbe_heading_font';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'light'; // Light Mode default
  });

  const [interfaceFont, setInterfaceFontState] = useState<InterfaceFont>(() => {
    const saved = localStorage.getItem(INTERFACE_FONT_STORAGE_KEY);
    if (INTERFACE_FONTS.some((f) => f.id === saved)) {
      return saved as InterfaceFont;
    }
    return 'system';
  });

  const [headingFont, setHeadingFontState] = useState<HeadingFont>(() => {
    const saved = localStorage.getItem(HEADING_FONT_STORAGE_KEY);
    if (HEADING_FONTS.some((f) => f.id === saved)) {
      return saved as HeadingFont;
    }
    return 'system';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Handle system preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      // Legacy browser support
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [resolvedTheme]);

  // Synchronize Interface Font CSS custom property
  useEffect(() => {
    const fontObj = INTERFACE_FONTS.find((f) => f.id === interfaceFont) || INTERFACE_FONTS[0];
    document.documentElement.style.setProperty('--font-interface', fontObj.family);
  }, [interfaceFont]);

  // Synchronize Heading Font CSS custom property
  useEffect(() => {
    const headingObj = HEADING_FONTS.find((f) => f.id === headingFont) || HEADING_FONTS[0];
    document.documentElement.style.setProperty('--font-heading', headingObj.family);
  }, [headingFont]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  };

  const setInterfaceFont = (font: InterfaceFont) => {
    setInterfaceFontState(font);
    try {
      localStorage.setItem(INTERFACE_FONT_STORAGE_KEY, font);
    } catch (e) {
      console.warn('Failed to save interface font preference:', e);
    }
  };

  const setHeadingFont = (font: HeadingFont) => {
    setHeadingFontState(font);
    try {
      localStorage.setItem(HEADING_FONT_STORAGE_KEY, font);
    } catch (e) {
      console.warn('Failed to save heading font preference:', e);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        resolvedTheme,
        interfaceFont,
        setInterfaceFont,
        headingFont,
        setHeadingFont,
        interfaceFonts: INTERFACE_FONTS,
        headingFonts: HEADING_FONTS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
