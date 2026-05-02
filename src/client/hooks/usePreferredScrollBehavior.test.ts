import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePreferredScrollBehavior } from './usePreferredScrollBehavior';

const setMatchMedia = (initialMatches: boolean) => {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
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

describe('usePreferredScrollBehavior', () => {
  beforeEach(() => {
    setMatchMedia(false);
  });

  it("returns 'smooth' for setting 'enabled' even when OS prefers reduced motion", () => {
    setMatchMedia(true);
    const { result } = renderHook(() => usePreferredScrollBehavior('enabled'));
    expect(result.current).toBe('smooth');
  });

  it("returns 'instant' for setting 'disabled' even when OS does not prefer reduced motion", () => {
    setMatchMedia(false);
    const { result } = renderHook(() => usePreferredScrollBehavior('disabled'));
    expect(result.current).toBe('instant');
  });

  it("resolves 'auto' to 'smooth' when OS does not prefer reduced motion", () => {
    setMatchMedia(false);
    const { result } = renderHook(() => usePreferredScrollBehavior('auto'));
    expect(result.current).toBe('smooth');
  });

  it("resolves 'auto' to 'instant' when OS prefers reduced motion", () => {
    setMatchMedia(true);
    const { result } = renderHook(() => usePreferredScrollBehavior('auto'));
    expect(result.current).toBe('instant');
  });

  it("re-resolves 'auto' when OS preference toggles at runtime", async () => {
    const matchMedia = setMatchMedia(false);
    const { result } = renderHook(() => usePreferredScrollBehavior('auto'));
    expect(result.current).toBe('smooth');

    act(() => {
      matchMedia.setMatches(true);
    });

    await waitFor(() => {
      expect(result.current).toBe('instant');
    });

    act(() => {
      matchMedia.setMatches(false);
    });

    await waitFor(() => {
      expect(result.current).toBe('smooth');
    });
  });
});
