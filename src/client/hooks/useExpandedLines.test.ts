import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../types/diff';

import { useExpandedLines } from './useExpandedLines';

function createMockDiffFile(): DiffFile {
  return {
    path: 'src/app.ts',
    status: 'modified',
    additions: 1,
    deletions: 1,
    chunks: [
      {
        header: '@@ -2 +2 @@',
        oldStart: 2,
        oldLines: 1,
        newStart: 2,
        newLines: 1,
        lines: [
          {
            type: 'delete',
            content: 'old changed line',
            oldLineNumber: 2,
          },
          {
            type: 'add',
            content: 'new changed line',
            newLineNumber: 2,
          },
        ],
      },
    ],
  };
}

describe('useExpandedLines', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(global.fetch).mockImplementation((input: string | URL | Request) => {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, 'http://localhost');
      const ref = url.searchParams.get('ref');

      const contentByRef: Record<string, string> = {
        'base-a': 'base a line 1\nold changed line\n',
        'base-b': 'base b line 1\nold changed line\n',
        target: 'target line 1\nnew changed line\n',
      };
      const body = ref ? contentByRef[ref] : undefined;

      if (!body) {
        return Promise.resolve({
          ok: false,
          statusText: `missing fixture for ${rawUrl}`,
          text: async () => '',
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        text: async () => body,
      } as Response);
    });
  });

  it('clears expanded state and refetches content when the revision changes', async () => {
    const file = createMockDiffFile();
    const { result, rerender } = renderHook(
      ({ baseCommitish, targetCommitish }) =>
        useExpandedLines({
          baseCommitish,
          targetCommitish,
        }),
      {
        initialProps: {
          baseCommitish: 'base-a',
          targetCommitish: 'target',
        },
      },
    );

    await act(async () => {
      await result.current.expandLines(file, 0, 'up', 1);
    });

    expect(result.current.getMergedChunks(file)[0]?.lines[0]?.content).toBe('base a line 1');

    rerender({
      baseCommitish: 'base-b',
      targetCommitish: 'target',
    });

    await waitFor(() => {
      expect(result.current.expandedState).toEqual({});
    });

    await act(async () => {
      await result.current.expandLines(file, 0, 'up', 1);
    });

    expect(result.current.getMergedChunks(file)[0]?.lines[0]?.content).toBe('base b line 1');
  });
});
