import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_EDITOR_OPTION } from '../../utils/editorOptions';
import { APPEARANCE_STORAGE_KEY } from '../utils/appearanceTheme';

import { useAppearanceSettings } from './useAppearanceSettings';

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

  describe('legacy editor storage migration', () => {
    beforeEach(() => {
      setMatchMedia(false);
    });

    it('upgrades the pre-refactor string shape `editor: "vscode"` to the new object', () => {
      localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({ theme: 'dark', editor: 'vscode' }),
      );

      const { result } = renderHook(() => useAppearanceSettings());

      expect(result.current.settings.editor).toEqual({
        id: 'vscode',
        command: 'code',
        argsTemplate: '-g %file:%line',
      });
    });

    it('backfills command/argsTemplate from preset when only `id` was stored', () => {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ editor: { id: 'cursor' } }));

      const { result } = renderHook(() => useAppearanceSettings());

      expect(result.current.settings.editor).toEqual({
        id: 'cursor',
        command: 'cursor',
        argsTemplate: '-g %file:%line',
      });
    });

    it('preserves custom command/argsTemplate as stored', () => {
      localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({
          editor: { id: 'custom', command: 'emacsclient', argsTemplate: '+%line %file' },
        }),
      );

      const { result } = renderHook(() => useAppearanceSettings());

      expect(result.current.settings.editor).toEqual({
        id: 'custom',
        command: 'emacsclient',
        argsTemplate: '+%line %file',
      });
    });

    it('falls back to the default preset when `editor` is missing or malformed', () => {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ theme: 'dark', editor: 42 }));

      const { result } = renderHook(() => useAppearanceSettings());

      expect(result.current.settings.editor).toEqual({
        id: DEFAULT_EDITOR_OPTION.id,
        command: DEFAULT_EDITOR_OPTION.command,
        argsTemplate: DEFAULT_EDITOR_OPTION.argsTemplate,
      });
    });
  });
});
