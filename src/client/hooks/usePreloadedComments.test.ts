import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { type DiffComment, type DiffSide } from '../../types/diff';

import { usePreloadedComments } from './usePreloadedComments';

interface AddCommentParams {
  filePath: string;
  body: string;
  side: DiffSide;
  line: number | { start: number; end: number };
}

// Mock EventSource (following useFileWatch.test.ts pattern)
class MockEventSource {
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public readyState: number = 0;
  public close = vi.fn();

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  dispatchMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  static instances: MockEventSource[] = [];
  static clearInstances() {
    MockEventSource.instances = [];
  }
}

vi.stubGlobal('EventSource', MockEventSource);

describe('usePreloadedComments', () => {
  let mockAddCommentsBatch: ReturnType<typeof vi.fn<(paramsList: AddCommentParams[]) => void>>;
  let mockFetchImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.clearInstances();
    mockAddCommentsBatch = vi.fn();
    mockFetchImpl = vi.fn();
    vi.stubGlobal('fetch', mockFetchImpl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial fetch', () => {
    it('fetches GET /api/comments and calls addCommentsBatch when ready=true', async () => {
      const serverComments = [{ file: 'src/App.tsx', line: 10, body: 'Fix this', side: 'new' }];
      mockFetchImpl.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: serverComments }),
      });

      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: true,
        }),
      );

      // Wait for async fetch to complete
      await vi.waitFor(() => {
        expect(mockFetchImpl).toHaveBeenCalledWith('/api/comments');
        expect(mockAddCommentsBatch).toHaveBeenCalledWith([
          { filePath: 'src/App.tsx', body: 'Fix this', side: 'new', line: 10 },
        ]);
      });
    });

    it('does not fetch when ready=false', () => {
      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: false,
        }),
      );

      expect(mockFetchImpl).not.toHaveBeenCalled();
    });

    it('does not re-fetch on second render (hasLoadedRef)', async () => {
      mockFetchImpl.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [{ file: 'a.ts', line: 1, body: 'x', side: 'new' }] }),
      });

      const { rerender } = renderHook(
        ({ ready }: { ready: boolean }) =>
          usePreloadedComments({
            addCommentsBatch: mockAddCommentsBatch,
            comments: [],
            ready,
          }),
        { initialProps: { ready: true } },
      );

      await vi.waitFor(() => {
        expect(mockFetchImpl).toHaveBeenCalledTimes(1);
      });

      // Rerender with same ready=true
      rerender({ ready: true });

      // Still only 1 call
      expect(mockFetchImpl).toHaveBeenCalledTimes(1);
    });

    it('does not call addCommentsBatch when response is empty', async () => {
      mockFetchImpl.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: true,
        }),
      );

      await vi.waitFor(() => {
        expect(mockFetchImpl).toHaveBeenCalledWith('/api/comments');
      });

      // addCommentsBatch should not have been called for empty
      expect(mockAddCommentsBatch).not.toHaveBeenCalled();
    });
  });

  describe('deduplication', () => {
    it('excludes comments that already exist (dedup key: filePath:side:line:body)', async () => {
      const existingComments: DiffComment[] = [
        {
          id: 'existing-1',
          filePath: 'src/App.tsx',
          body: 'Existing comment',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          position: { side: 'new', line: 10 },
        },
      ];

      const serverComments = [
        { file: 'src/App.tsx', line: 10, body: 'Existing comment', side: 'new' },
        { file: 'src/App.tsx', line: 20, body: 'New comment', side: 'new' },
      ];

      mockFetchImpl.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: serverComments }),
      });

      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: existingComments,
          ready: true,
        }),
      );

      await vi.waitFor(() => {
        expect(mockAddCommentsBatch).toHaveBeenCalledWith([
          { filePath: 'src/App.tsx', body: 'New comment', side: 'new', line: 20 },
        ]);
      });
    });
  });

  describe('side normalization', () => {
    it('falls back to "new" when side is not "old" or "new"', async () => {
      const serverComments = [{ file: 'a.ts', line: 1, body: 'comment', side: 'left' }];

      mockFetchImpl.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: serverComments }),
      });

      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: true,
        }),
      );

      await vi.waitFor(() => {
        expect(mockAddCommentsBatch).toHaveBeenCalledWith([
          { filePath: 'a.ts', body: 'comment', side: 'new', line: 1 },
        ]);
      });
    });
  });

  describe('line normalization', () => {
    it('normalizes array line [1,10] to {start:1, end:10}', async () => {
      const serverComments = [{ file: 'b.ts', line: [1, 10], body: 'range comment', side: 'new' }];

      mockFetchImpl.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: serverComments }),
      });

      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: true,
        }),
      );

      await vi.waitFor(() => {
        expect(mockAddCommentsBatch).toHaveBeenCalledWith([
          { filePath: 'b.ts', body: 'range comment', side: 'new', line: { start: 1, end: 10 } },
        ]);
      });
    });
  });

  describe('SSE connection', () => {
    it('connects to /api/comments-stream', () => {
      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: false,
        }),
      );

      expect(MockEventSource.instances).toHaveLength(1);
      expect(MockEventSource.instances[0]!.url).toBe('/api/comments-stream');
    });

    it('parses SSE JSON message and calls addCommentsBatch', () => {
      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: false,
        }),
      );

      const eventSource = MockEventSource.instances[0]!;

      act(() => {
        eventSource.dispatchMessage(
          JSON.stringify([{ file: 'sse.ts', line: 5, body: 'SSE comment', side: 'new' }]),
        );
      });

      expect(mockAddCommentsBatch).toHaveBeenCalledWith([
        { filePath: 'sse.ts', body: 'SSE comment', side: 'new', line: 5 },
      ]);
    });

    it('ignores "connected" message', () => {
      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: false,
        }),
      );

      const eventSource = MockEventSource.instances[0]!;

      act(() => {
        eventSource.dispatchMessage('connected');
      });

      expect(mockAddCommentsBatch).not.toHaveBeenCalled();
    });

    it('silently ignores non-JSON messages', () => {
      renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: false,
        }),
      );

      const eventSource = MockEventSource.instances[0]!;

      act(() => {
        eventSource.dispatchMessage('this is not json');
      });

      // Should not throw and should not call addCommentsBatch
      expect(mockAddCommentsBatch).not.toHaveBeenCalled();
    });

    it('calls eventSource.close() on unmount', () => {
      const { unmount } = renderHook(() =>
        usePreloadedComments({
          addCommentsBatch: mockAddCommentsBatch,
          comments: [],
          ready: false,
        }),
      );

      const eventSource = MockEventSource.instances[0]!;

      unmount();

      expect(eventSource.close).toHaveBeenCalled();
    });
  });
});
