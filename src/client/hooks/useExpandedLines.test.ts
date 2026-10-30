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
      ({ baseCommitish, targetCommitish, diffIdentity }) =>
        useExpandedLines({
          baseCommitish,
          targetCommitish,
          diffIdentity,
        }),
      {
        initialProps: {
          baseCommitish: 'base-a',
          targetCommitish: 'target',
          diffIdentity: 'diff-a',
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
      diffIdentity: 'diff-b',
    });

    await waitFor(() => {
      expect(result.current.expandedState).toEqual({});
    });

    await act(async () => {
      await result.current.expandLines(file, 0, 'up', 1);
    });

    expect(result.current.getMergedChunks(file)[0]?.lines[0]?.content).toBe('base b line 1');
  });

  it('clears expanded state and refetches content when the diff identity changes', async () => {
    const file = createMockDiffFile();
    let baseAContent = 'base a line 1\nold changed line\n';

    vi.mocked(global.fetch).mockImplementation((input: string | URL | Request) => {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, 'http://localhost');
      const ref = url.searchParams.get('ref');

      const contentByRef: Record<string, string> = {
        'base-a': baseAContent,
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

    const { result, rerender } = renderHook(
      ({ diffIdentity }) =>
        useExpandedLines({
          baseCommitish: 'base-a',
          targetCommitish: 'target',
          diffIdentity,
        }),
      {
        initialProps: {
          diffIdentity: 'diff-a',
        },
      },
    );

    await act(async () => {
      await result.current.expandLines(file, 0, 'up', 1);
    });

    expect(result.current.getMergedChunks(file)[0]?.lines[0]?.content).toBe('base a line 1');

    baseAContent = 'base a rewritten line 1\nold changed line\n';

    rerender({
      diffIdentity: 'diff-b',
    });

    await waitFor(() => {
      expect(result.current.expandedState).toEqual({});
    });

    await act(async () => {
      await result.current.expandLines(file, 0, 'up', 1);
    });

    expect(result.current.getMergedChunks(file)[0]?.lines[0]?.content).toBe(
      'base a rewritten line 1',
    );
  });

  it('does not request unavailable blob data for stdin diffs', async () => {
    const file = createMockDiffFile();
    const { result } = renderHook(() =>
      useExpandedLines({
        baseCommitish: 'stdin',
        targetCommitish: 'stdin',
        diffIdentity: 'stdin-diff',
      }),
    );

    await act(async () => {
      await result.current.prefetchFileContent(file);
      await result.current.expandLines(file, 0, 'up', 1);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.expandedState).toEqual({});
  });

  it('expands every hidden line of a file and collapses them again', async () => {
    const fileLines = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5', 'line 6', 'line 7'];
    vi.mocked(global.fetch).mockImplementation(
      async () => ({ ok: true, text: async () => `${fileLines.join('\n')}\n` }) as Response,
    );
    const changed = (line: number) => ({
      header: `@@ -${line} +${line} @@`,
      oldStart: line,
      oldLines: 1,
      newStart: line,
      newLines: 1,
      lines: [
        { type: 'delete' as const, content: `old ${line}`, oldLineNumber: line },
        { type: 'add' as const, content: `line ${line}`, newLineNumber: line },
      ],
    });
    const file: DiffFile = {
      path: 'src/app.ts',
      status: 'modified',
      additions: 2,
      deletions: 2,
      chunks: [changed(3), changed(5)],
    };
    const { result } = renderHook(() =>
      useExpandedLines({ baseCommitish: 'base', targetCommitish: 'target' }),
    );

    await act(async () => {
      await result.current.expandAllLines(file);
    });

    const merged = result.current.getMergedChunks(file);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.hiddenLinesBefore).toBe(0);
    expect(merged[0]?.hiddenLinesAfter).toBe(0);
    expect(merged[0]?.lines.map((line) => line.newLineNumber ?? line.oldLineNumber)).toEqual([
      1, 2, 3, 3, 4, 5, 5, 6, 7,
    ]);

    act(() => {
      result.current.collapseExpandedLines(file);
    });

    const collapsed = result.current.getMergedChunks(file);
    expect(collapsed).toHaveLength(2);
    expect(collapsed[0]?.hiddenLinesBefore).toBe(2);
    expect(collapsed[1]?.hiddenLinesAfter).toBe(2);
  });
});
