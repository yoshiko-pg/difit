import { useState, useEffect, useCallback } from 'react';

import type { AppearanceSettings } from '../components/SettingsModal';

const DEFAULT_SETTINGS: AppearanceSettings = {
  fontSize: 14,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  theme: 'dark',
  syntaxTheme: 'vsDark',
};

const STORAGE_KEY = 'reviewit-appearance-settings';

export function useAppearanceSettings() {
  const [settings, setSettings] = useState<AppearanceSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as AppearanceSettings) };
      }
    } catch (error) {
      console.warn('Failed to load appearance settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  const applyTheme = useCallback((theme: 'light' | 'dark') => {
    const root = document.documentElement;

    // Set data-theme attribute for CSS selectors
    root.setAttribute('data-theme', theme);

    if (theme === 'light') {
      // Light theme colors
      root.style.setProperty('--color-github-bg-primary', '#ffffff');
      root.style.setProperty('--color-github-bg-secondary', '#f6f8fa');
      root.style.setProperty('--color-github-bg-tertiary', '#f1f3f4');
      root.style.setProperty('--color-github-border', '#d1d9e0');
      root.style.setProperty('--color-github-text-primary', '#24292f');
      root.style.setProperty('--color-github-text-secondary', '#656d76');
      root.style.setProperty('--color-github-text-muted', '#8c959f');
      root.style.setProperty('--color-github-accent', '#1f883d');
      root.style.setProperty('--color-github-danger', '#cf222e');
      root.style.setProperty('--color-github-warning', '#bf8700');

      // Light diff colors
      root.style.setProperty('--color-diff-addition-bg', '#d1f4cd');
      root.style.setProperty('--color-diff-addition-border', '#1f883d');
      root.style.setProperty('--color-diff-deletion-bg', '#ffd8d3');
      root.style.setProperty('--color-diff-deletion-border', '#cf222e');
      root.style.setProperty('--color-diff-neutral-bg', '#f1f3f4');

      // Light comment colors
      root.style.setProperty('--color-comment-bg', '#fff8e1');
      root.style.setProperty('--color-comment-border', '#ffd54f');
      root.style.setProperty('--color-comment-text', '#5d4037');

      // Light yellow button colors
      root.style.setProperty('--color-yellow-btn-bg', '#fef3c7');
      root.style.setProperty('--color-yellow-btn-border', '#f59e0b');
      root.style.setProperty('--color-yellow-btn-text', '#92400e');
      root.style.setProperty('--color-yellow-btn-hover-bg', '#fde68a');
      root.style.setProperty('--color-yellow-btn-hover-border', '#d97706');

      // Light yellow path colors
      root.style.setProperty('--color-yellow-path-bg', '#fde68a');
      root.style.setProperty('--color-yellow-path-text', '#92400e');
    } else {
      // Dark theme colors (default)
      root.style.setProperty('--color-github-bg-primary', '#0d1117');
      root.style.setProperty('--color-github-bg-secondary', '#161b22');
      root.style.setProperty('--color-github-bg-tertiary', '#21262d');
      root.style.setProperty('--color-github-border', '#30363d');
      root.style.setProperty('--color-github-text-primary', '#f0f6fc');
      root.style.setProperty('--color-github-text-secondary', '#8b949e');
      root.style.setProperty('--color-github-text-muted', '#6e7681');
      root.style.setProperty('--color-github-accent', '#238636');
      root.style.setProperty('--color-github-danger', '#da3633');
      root.style.setProperty('--color-github-warning', '#d29922');

      // Dark diff colors
      root.style.setProperty('--color-diff-addition-bg', '#0d4429');
      root.style.setProperty('--color-diff-addition-border', '#1b7c3d');
      root.style.setProperty('--color-diff-deletion-bg', '#67060c');
      root.style.setProperty('--color-diff-deletion-border', '#da3633');
      root.style.setProperty('--color-diff-neutral-bg', '#21262d');

      // Dark comment colors
      root.style.setProperty('--color-comment-bg', '#1c2128');
      root.style.setProperty('--color-comment-border', '#373e47');
      root.style.setProperty('--color-comment-text', '#e6edf3');

      // Dark yellow button colors
      root.style.setProperty('--color-yellow-btn-bg', 'rgba(180, 83, 9, 0.2)');
      root.style.setProperty('--color-yellow-btn-border', 'rgba(217, 119, 6, 0.5)');
      root.style.setProperty('--color-yellow-btn-text', '#fbbf24');
      root.style.setProperty('--color-yellow-btn-hover-bg', 'rgba(180, 83, 9, 0.3)');
      root.style.setProperty('--color-yellow-btn-hover-border', '#d97706');

      // Dark yellow path colors
      root.style.setProperty('--color-yellow-path-bg', 'rgba(180, 83, 9, 0.3)');
      root.style.setProperty('--color-yellow-path-text', '#fbbf24');
    }

    // Update body background color
    document.body.style.backgroundColor = `var(--color-github-bg-primary)`;
    document.body.style.color = `var(--color-github-text-primary)`;
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
      // Use system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.warn('Failed to save appearance settings to localStorage:', error);
    }
  };

  return {
    settings,
    updateSettings,
  };
}
