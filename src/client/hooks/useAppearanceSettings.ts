import { useState, useEffect, useCallback } from 'react';

import { DEFAULT_EDITOR_ID } from '../../utils/editorOptions';
import type { AppearanceSettings } from '../components/SettingsModal';
import {
  APPEARANCE_STORAGE_KEY,
  applyResolvedTheme,
  resolveThemePreference,
} from '../utils/appearanceTheme';

const DEFAULT_SETTINGS: AppearanceSettings = {
  fontSize: 14,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  theme: 'dark',
  syntaxTheme: 'vsDark',
  editor: DEFAULT_EDITOR_ID,
};

export function useAppearanceSettings() {
  const [settings, setSettings] = useState<AppearanceSettings>(() => {
    try {
      const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as AppearanceSettings) };
      }
    } catch (error) {
      console.warn('Failed to load appearance settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  const applyTheme = useCallback((theme: 'light' | 'dark') => {
    applyResolvedTheme(theme);
  }, []);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply font size
    root.style.setProperty('--app-font-size', `${settings.fontSize}px`);

    // Apply font family
    root.style.setProperty('--app-font-family', settings.fontFamily);

    // Apply theme
    if (settings.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(resolveThemePreference('auto', mediaQuery.matches ? 'dark' : 'light'));

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(resolveThemePreference('auto', e.matches ? 'dark' : 'light'));
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyTheme(settings.theme);
      return undefined;
    }
  }, [settings, applyTheme]);

  const updateSettings = (newSettings: AppearanceSettings) => {
    setSettings(newSettings);

    // Save to localStorage
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.warn('Failed to save appearance settings to localStorage:', error);
    }
  };

  return {
    settings,
    updateSettings,
  };
}
