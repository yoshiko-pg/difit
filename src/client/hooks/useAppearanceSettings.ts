import { useState, useEffect, useCallback } from 'react';

import { DEFAULT_EDITOR_OPTION } from '../../utils/editorOptions';
import type { AppearanceSettings } from '../components/SettingsModal';
import { normalizeAutoViewedPatterns } from '../utils/autoViewedPatterns';
import {
  APPEARANCE_STORAGE_KEY,
  applyResolvedTheme,
  resolveThemePreference,
  type ColorVisionMode,
  type ResolvedTheme,
} from '../utils/appearanceTheme';
import { getFallbackSyntaxTheme, isSyntaxThemeForResolvedTheme } from '../utils/themeLoader';

const DEFAULT_SETTINGS: AppearanceSettings = {
  fontSize: 14,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  theme: 'dark',
  syntaxTheme: 'vsDark',
  editor: {
    id: DEFAULT_EDITOR_OPTION.id,
    command: DEFAULT_EDITOR_OPTION.command,
    argsTemplate: DEFAULT_EDITOR_OPTION.argsTemplate,
  },
  colorVision: 'normal',
  autoViewedPatterns: [],
};

export function useAppearanceSettings() {
  const [settings, setSettings] = useState<AppearanceSettings>(() => {
    try {
      const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppearanceSettings> & {
          autoViewedPatterns?: unknown;
        };

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          autoViewedPatterns: normalizeAutoViewedPatterns(parsed.autoViewedPatterns),
        };
      }
    } catch (error) {
      console.warn('Failed to load appearance settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  const applyTheme = useCallback(
    (theme: 'light' | 'dark', colorVision: ColorVisionMode = 'normal') => {
      applyResolvedTheme(theme, colorVision);
    },
    [],
  );

  const saveSettings = useCallback((newSettings: AppearanceSettings) => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.warn('Failed to save appearance settings to localStorage:', error);
    }
  }, []);

  const getSettingsForResolvedTheme = useCallback(
    (currentSettings: AppearanceSettings, resolvedTheme: ResolvedTheme) => {
      if (isSyntaxThemeForResolvedTheme(currentSettings.syntaxTheme, resolvedTheme)) {
        return currentSettings;
      }

      const fallbackSyntaxTheme = getFallbackSyntaxTheme(resolvedTheme);
      if (!fallbackSyntaxTheme) {
        return currentSettings;
      }

      return {
        ...currentSettings,
        syntaxTheme: fallbackSyntaxTheme.id,
      };
    },
    [],
  );

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply font size
    root.style.setProperty('--app-font-size', `${settings.fontSize}px`);

    // Apply font family
    root.style.setProperty('--app-font-family', settings.fontFamily);

    // Apply theme
    const colorVision = settings.colorVision ?? 'normal';
    const applyResolvedAppearance = (resolvedTheme: ResolvedTheme) => {
      applyTheme(resolvedTheme, colorVision);

      const nextSettings = getSettingsForResolvedTheme(settings, resolvedTheme);
      if (nextSettings !== settings) {
        setSettings(nextSettings);
        saveSettings(nextSettings);
      }
    };

    if (settings.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyResolvedAppearance(
        resolveThemePreference('auto', mediaQuery.matches ? 'dark' : 'light'),
      );

      const handleChange = (e: MediaQueryListEvent) => {
        applyResolvedAppearance(resolveThemePreference('auto', e.matches ? 'dark' : 'light'));
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyResolvedAppearance(settings.theme);
      return undefined;
    }
  }, [settings, applyTheme, getSettingsForResolvedTheme, saveSettings]);

  const updateSettings = (newSettings: AppearanceSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  return {
    settings,
    updateSettings,
  };
}
