import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useWordHighlight, WordHighlightProvider } from './WordHighlightContext';

describe('WordHighlightContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WordHighlightProvider>{children}</WordHighlightProvider>
  );

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with no highlighted word', () => {
    const { result } = renderHook(() => useWordHighlight(), { wrapper });

    expect(result.current.highlightedWord).toBeNull();
    expect(result.current.isWordHighlighted('test')).toBe(false);
  });

  it('should highlight word on mouse over after delay', () => {
    const { result } = renderHook(() => useWordHighlight(), { wrapper });

    const mockEvent = {
      target: {
        classList: { contains: vi.fn(() => true) },
        getAttribute: vi.fn(() => 'hello'),
      },
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseOver(mockEvent);
    });

    // Word should not be highlighted immediately
    expect(result.current.highlightedWord).toBeNull();

    // Fast forward past the delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Word should now be highlighted
    expect(result.current.highlightedWord).toBe('hello');
    expect(result.current.isWordHighlighted('hello')).toBe(true);
    expect(result.current.isWordHighlighted('HELLO')).toBe(true); // Case insensitive
  });

  it('should clear highlight on mouse out', () => {
    const { result } = renderHook(() => useWordHighlight(), { wrapper });

    const mockEvent = {
      target: {
        classList: { contains: vi.fn(() => true) },
        getAttribute: vi.fn(() => 'hello'),
      },
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseOver(mockEvent);
      vi.advanceTimersByTime(200);
    });

    expect(result.current.highlightedWord).toBe('hello');

    act(() => {
      result.current.handleMouseOut();
    });

    expect(result.current.highlightedWord).toBeNull();
  });

  it('should cancel pending highlight on mouse out', () => {
    const { result } = renderHook(() => useWordHighlight(), { wrapper });

    const mockEvent = {
      target: {
        classList: { contains: vi.fn(() => true) },
        getAttribute: vi.fn(() => 'hello'),
      },
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseOver(mockEvent);
    });

    // Mouse out before delay
    act(() => {
      result.current.handleMouseOut();
    });

    // Fast forward past the delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Word should not be highlighted
    expect(result.current.highlightedWord).toBeNull();
  });

  it('should not highlight if target is not a word token element', () => {
    const { result } = renderHook(() => useWordHighlight(), { wrapper });

    const mockEvent = {
      target: { classList: { contains: vi.fn(() => false) } },
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseOver(mockEvent);
      vi.advanceTimersByTime(200);
    });

    expect(result.current.highlightedWord).toBeNull();
  });

  it('should not highlight if data-word attribute is missing', () => {
    const { result } = renderHook(() => useWordHighlight(), { wrapper });

    const mockEvent = {
      target: {
        classList: { contains: vi.fn(() => true) },
        getAttribute: vi.fn(() => null),
      },
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseOver(mockEvent);
      vi.advanceTimersByTime(200);
    });

    expect(result.current.highlightedWord).toBeNull();
  });

  it('should update highlight when moving to different word', () => {
    const { result } = renderHook(() => useWordHighlight(), { wrapper });

    const mockEvent1 = {
      target: {
        classList: { contains: vi.fn(() => true) },
        getAttribute: vi.fn(() => 'hello'),
      },
    } as unknown as React.MouseEvent;

    const mockEvent2 = {
      target: {
        classList: { contains: vi.fn(() => true) },
        getAttribute: vi.fn(() => 'world'),
      },
    } as unknown as React.MouseEvent;

    // Hover over first word
    act(() => {
      result.current.handleMouseOver(mockEvent1);
      vi.advanceTimersByTime(200);
    });

    expect(result.current.highlightedWord).toBe('hello');

    // Move to second word
    act(() => {
      result.current.handleMouseOver(mockEvent2);
      vi.advanceTimersByTime(200);
    });

    expect(result.current.highlightedWord).toBe('world');
  });

  it('should throw error when used outside provider', () => {
    // This test doesn't use the wrapper to test the error case
    const { result } = renderHook(() => {
      try {
        return useWordHighlight();
      } catch (error) {
        return { error };
      }
    });

    expect((result.current as { error: unknown }).error).toEqual(
      new Error('useWordHighlight must be used within a WordHighlightProvider'),
    );
  });
});
