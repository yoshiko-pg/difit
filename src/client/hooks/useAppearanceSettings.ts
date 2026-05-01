import { useState, useEffect, useCallback } from 'react';

import {
  DEFAULT_EDITOR_OPTION,
  type EditorOptionId,
  resolveEditorOption,
} from '../../utils/editorOptions';
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

/**
 * Normalise whatever we find under `editor` in localStorage into the current
 * `{id, command, argsTemplate}` shape. Handles three legacy / partial cases so
 * that users upgrading from an older build don't crash on `.trim()` of an
 * undefined field:
 *   - missing / null / unknown type                → default editor preset
 *   - legacy string id (e.g. `'vscode'`, `'none'`) → resolve via preset table
 *   - partial object (e.g. `{ id: 'vscode' }`)     → backfill command/args
 *     from the matching preset; for `custom` keep user-supplied strings but
 *     coerce missing fields to `''`.
 */
const normalizeEditorSettings = (raw: unknown): AppearanceSettings['editor'] => {
  if (typeof raw === 'string') {
    const preset = resolveEditorOption(raw);
    return {
      id: preset.id,
      command: preset.command,
      argsTemplate: preset.argsTemplate,
    };
  }

  if (raw && typeof raw === 'object') {
    const candidate = raw as {
      id?: unknown;
      command?: unknown;
      argsTemplate?: unknown;
    };
    const preset = resolveEditorOption(typeof candidate.id === 'string' ? candidate.id : undefined);
    const id: EditorOptionId = preset.id;
    const command = typeof candidate.command === 'string' ? candidate.command : preset.command;
    const argsTemplate =
      typeof candidate.argsTemplate === 'string' ? candidate.argsTemplate : preset.argsTemplate;
    return { id, command, argsTemplate };
  }

  return DEFAULT_SETTINGS.editor;
};

export function useAppearanceSettings() {
  const [settings, setSettings] = useState<AppearanceSettings>(() => {
    try {
      const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppearanceSettings> & {
          autoViewedPatterns?: unknown;
          editor?: unknown;
        };

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          editor: normalizeEditorSettings(parsed.editor),
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
