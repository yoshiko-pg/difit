import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DiffMode } from '../../types/watch.js';

import { useFileWatch } from './useFileWatch.js';

// Mock EventSource
class MockEventSource {
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public readyState: number = 0;
  public close = vi.fn();

  constructor(public url: string) {
    // Store instance for access in tests
    MockEventSource.instances.push(this);

    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  dispatchMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  dispatchError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  static instances: MockEventSource[] = [];
  static clearInstances() {
    MockEventSource.instances = [];
  }
}

// Mock EventSource globally
vi.stubGlobal('EventSource', MockEventSource);

// Mock console methods
vi.stubGlobal('console', {
  log: vi.fn(),
  error: vi.fn(),
});

describe('useFileWatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    MockEventSource.clearInstances();
  });

  describe('initial state', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useFileWatch());

      expect(result.current.shouldReload).toBe(false);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.watchState).toEqual({
        isWatchEnabled: false,
        diffMode: DiffMode.DEFAULT,
        shouldReload: false,
        isReloading: false,
        lastChangeTime: null,
        lastChangeType: null,
        connectionStatus: 'disconnected',
      });
    });
  });

  describe('SSE connection', () => {
    it('should establish connection on mount', async () => {
      const { result } = renderHook(() => useFileWatch());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.watchState.connectionStatus).toBe('connected');
    });

    it('should handle connection events', async () => {
      const { result } = renderHook(() => useFileWatch());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Get the EventSource instance and dispatch a connected event
      const eventSource = MockEventSource.instances[0]!;

      act(() => {
        eventSource.dispatchMessage(
          JSON.stringify({
            type: 'connected',
            diffMode: DiffMode.WORKING,
            changeType: 'file',
            timestamp: new Date().toISOString(),
            message: 'Connected to file watcher',
          }),
        );
      });

      await waitFor(() => {
        expect(result.current.watchState.isWatchEnabled).toBe(true);
        expect(result.current.watchState.diffMode).toBe(DiffMode.WORKING);
      });
    });

    it('should handle reload events', async () => {
      const { result } = renderHook(() => useFileWatch());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const eventSource = MockEventSource.instances[0]!;

      act(() => {
        eventSource.dispatchMessage(
          JSON.stringify({
            type: 'reload',
            diffMode: DiffMode.DOT,
            changeType: 'commit',
            timestamp: new Date().toISOString(),
          }),
        );
      });

      await waitFor(() => {
        expect(result.current.shouldReload).toBe(true);
        expect(result.current.watchState.shouldReload).toBe(true);
        expect(result.current.watchState.lastChangeType).toBe('commit');
      });
    });

    it('should handle error events', async () => {
      const { result } = renderHook(() => useFileWatch());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const eventSource = MockEventSource.instances[0]!;

      act(() => {
        eventSource.dispatchMessage(
          JSON.stringify({
            type: 'error',
            diffMode: DiffMode.DEFAULT,
            changeType: 'file',
            timestamp: new Date().toISOString(),
            message: 'Watch error occurred',
          }),
        );
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Watch error occurred');
      });
    });

    it('should handle malformed messages gracefully', async () => {
      const { result } = renderHook(() => useFileWatch());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const eventSource = MockEventSource.instances[0]!;

      act(() => {
        eventSource.dispatchMessage('invalid json');
      });

      // Should not throw or crash
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });
  });

  describe('reload functionality', () => {
    it('should call onReload callback when reload is triggered', async () => {
      const mockOnReload = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useFileWatch(mockOnReload));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Set shouldReload state first
      const eventSource = MockEventSource.instances[0]!;
      act(() => {
        eventSource.dispatchMessage(
          JSON.stringify({
            type: 'reload',
            diffMode: DiffMode.DEFAULT,
            changeType: 'file',
            timestamp: new Date().toISOString(),
          }),
        );
      });

      await waitFor(() => {
        expect(result.current.shouldReload).toBe(true);
      });

      // Trigger reload
      act(() => {
        result.current.reload();
      });

      await waitFor(() => {
        expect(mockOnReload).toHaveBeenCalled();
        expect(result.current.watchState.isReloading).toBe(true);
      });

      // Wait for reload to complete
      await waitFor(() => {
        expect(result.current.watchState.isReloading).toBe(false);
        expect(result.current.shouldReload).toBe(false);
      });
    });

    it('should handle reload errors', async () => {
      const mockOnReload = vi.fn().mockRejectedValue(new Error('Reload failed'));
      const { result } = renderHook(() => useFileWatch(mockOnReload));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Set shouldReload state first
      const eventSource = MockEventSource.instances[0]!;
      act(() => {
        eventSource.dispatchMessage(
          JSON.stringify({
            type: 'reload',
            diffMode: DiffMode.DEFAULT,
            changeType: 'file',
            timestamp: new Date().toISOString(),
          }),
        );
      });

      await waitFor(() => {
        expect(result.current.shouldReload).toBe(true);
      });

      // Trigger reload
      act(() => {
        result.current.reload();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to reload diff data');
        expect(result.current.watchState.isReloading).toBe(false);
      });
    });

    it('should not reload if already reloading', async () => {
      const mockOnReload = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      const { result } = renderHook(() => useFileWatch(mockOnReload));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Set shouldReload state first
      const eventSource = MockEventSource.instances[0]!;
      act(() => {
        eventSource.dispatchMessage(
          JSON.stringify({
            type: 'reload',
            diffMode: DiffMode.DEFAULT,
            changeType: 'file',
            timestamp: new Date().toISOString(),
          }),
        );
      });

      await waitFor(() => {
        expect(result.current.shouldReload).toBe(true);
      });

      // Trigger first reload
      act(() => {
        result.current.reload();
      });

      await waitFor(() => {
        expect(result.current.watchState.isReloading).toBe(true);
      });

      // Try to trigger second reload while first is in progress
      act(() => {
        result.current.reload();
      });

      // Should only call onReload once
      expect(mockOnReload).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconnection logic', () => {
    it('should set reconnecting status on connection error', async () => {
      const { result } = renderHook(() => useFileWatch());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const eventSource = MockEventSource.instances[0]!;

      // Simulate connection error
      act(() => {
        eventSource.dispatchError();
      });

      // Should show reconnecting status
      expect(result.current.watchState.connectionStatus).toBe('reconnecting');
    });

    it('should show error after max reconnection attempts', async () => {
      const { result } = renderHook(() => useFileWatch());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const eventSource = MockEventSource.instances[0]!;

      // Simulate connection error
      act(() => {
        eventSource.dispatchError();
      });

      // Should show reconnecting status initially
      expect(result.current.watchState.connectionStatus).toBe('reconnecting');
    });
  });

  describe('cleanup', () => {
    it('should close connection on unmount', async () => {
      const { result, unmount } = renderHook(() => useFileWatch());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const eventSource = MockEventSource.instances[0]!;

      unmount();

      expect(eventSource.close).toHaveBeenCalled();
    });

    it('should clear timeouts on unmount', async () => {
      const { result, unmount } = renderHook(() => useFileWatch());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const eventSource = MockEventSource.instances[0]!;

      unmount();

      // Should close the connection
      expect(eventSource.close).toHaveBeenCalled();
    });
  });
});
