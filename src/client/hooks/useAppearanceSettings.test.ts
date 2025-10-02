import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAppearanceSettings } from './useAppearanceSettings';

const STORAGE_KEY = 'reviewit-appearance-settings';

describe('useAppearanceSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
  });

  it('applies font size settings to root variables', () => {
    const { result } = renderHook(() => useAppearanceSettings());

    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('14px');
    expect(document.documentElement.style.getPropertyValue('--app-code-font-size')).toBe('14px');

    act(() => {
      result.current.updateSettings({
        ...result.current.settings,
        fontSize: 18,
      });
    });

    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('18px');
    expect(document.documentElement.style.getPropertyValue('--app-code-font-size')).toBe('18px');
  });

  it('restores persisted font size to both text and code', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fontSize: 16,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: 'dark',
        syntaxTheme: 'vsDark',
      })
    );

    const { unmount } = renderHook(() => useAppearanceSettings());

    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('16px');
    expect(document.documentElement.style.getPropertyValue('--app-code-font-size')).toBe('16px');

    unmount();
  });
});
