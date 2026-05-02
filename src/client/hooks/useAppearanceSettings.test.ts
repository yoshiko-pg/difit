import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APPEARANCE_STORAGE_KEY } from '../utils/appearanceTheme';

import { useAppearanceSettings } from './useAppearanceSettings';
import { usePreferredScrollBehavior } from './usePreferredScrollBehavior';

vi.mock('./usePreferredScrollBehavior', () => ({
  usePreferredScrollBehavior: vi.fn(),
}));

const mockedUsePreferredScrollBehavior = vi.mocked(usePreferredScrollBehavior);

const setMatchMedia = (initialMatches: boolean) => {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change' && typeof listener === 'function') {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change' && typeof listener === 'function') {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as MediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => mediaQueryList),
  });

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches: nextMatches, media: mediaQueryList.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
};

describe('useAppearanceSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('theme', () => {
    beforeEach(() => {
      document.documentElement.removeAttribute('data-color-vision');
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.removeAttribute('style');
      document.body.removeAttribute('style');
    });

    it('updates syntax highlighting theme when auto theme follows OS changes', async () => {
      localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({
          theme: 'auto',
          syntaxTheme: 'vsDark',
        }),
      );
      const matchMedia = setMatchMedia(true);

      const { result } = renderHook(() => useAppearanceSettings());

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(result.current.settings.syntaxTheme).toBe('vsDark');
      });

      act(() => {
        matchMedia.setMatches(false);
      });

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(result.current.settings.syntaxTheme).toBe('github');
      });

      expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}')).toMatchObject({
        theme: 'auto',
        syntaxTheme: 'github',
      });
    });
  });

  describe('scrollBehavior', () => {
    beforeEach(() => {
      mockedUsePreferredScrollBehavior.mockReset();
      mockedUsePreferredScrollBehavior.mockReturnValue('smooth');
      setMatchMedia(false);
    });

    it("defaults scrollAnimation to 'auto' and forwards it to usePreferredScrollBehavior", () => {
      const { result } = renderHook(() => useAppearanceSettings());

      expect(result.current.settings.scrollAnimation).toBe('auto');
      expect(mockedUsePreferredScrollBehavior).toHaveBeenLastCalledWith('auto');
    });

    it('forwards scrollAnimation loaded from localStorage to usePreferredScrollBehavior', () => {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ scrollAnimation: 'enabled' }));
      const { result } = renderHook(() => useAppearanceSettings());

      expect(result.current.settings.scrollAnimation).toBe('enabled');
      expect(mockedUsePreferredScrollBehavior).toHaveBeenLastCalledWith('enabled');
    });

    it('returns whatever usePreferredScrollBehavior resolves', () => {
      mockedUsePreferredScrollBehavior.mockReturnValue('instant');
      const { result } = renderHook(() => useAppearanceSettings());

      expect(result.current.scrollBehavior).toBe('instant');
    });

    it('persists updated scrollAnimation and forwards the new value to usePreferredScrollBehavior', () => {
      const { result } = renderHook(() => useAppearanceSettings());

      act(() => {
        result.current.updateSettings({
          ...result.current.settings,
          scrollAnimation: 'disabled',
        });
      });

      expect(result.current.settings.scrollAnimation).toBe('disabled');
      expect(mockedUsePreferredScrollBehavior).toHaveBeenLastCalledWith('disabled');
      expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}')).toMatchObject({
        scrollAnimation: 'disabled',
      });
    });
  });
});
