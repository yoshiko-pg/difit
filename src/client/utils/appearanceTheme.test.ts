import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APPEARANCE_STORAGE_KEY,
  bootstrapAppearanceTheme,
  getResolvedTheme,
  resolveThemePreference,
} from './appearanceTheme';

const setMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
};

describe('appearanceTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    setMatchMedia(true);
  });

  it('resolves an explicit theme preference', () => {
    expect(resolveThemePreference('light', 'dark')).toBe('light');
    expect(resolveThemePreference('dark', 'light')).toBe('dark');
  });

  it('bootstraps the saved light theme before app mount', () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        theme: 'light',
      }),
    );

    expect(bootstrapAppearanceTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--color-github-bg-primary')).toBe(
      '#ffffff',
    );
  });

  it('resolves auto theme from system preference when no attribute is present', () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        theme: 'auto',
      }),
    );
    setMatchMedia(false);

    expect(getResolvedTheme()).toBe('light');
    expect(bootstrapAppearanceTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
