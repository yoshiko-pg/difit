import { describe, expect, it } from 'vitest';

import type { DiffFile } from '../../types/diff';
import type { MergedChunk } from '../hooks/useExpandedLines';

import { buildMergedChunksState, getMergedChunksForVersion } from './mergedChunks';

function createMergedChunk(content: string): MergedChunk {
  return {
    header: '@@ -1 +1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [
      {
        type: 'normal',
        content,
        oldLineNumber: 1,
        newLineNumber: 1,
      },
    ],
    originalIndices: [0],
    hiddenLinesBefore: 0,
    hiddenLinesAfter: 0,
  };
}

function createFile(path: string): DiffFile {
  return {
    path,
    status: 'modified',
    additions: 1,
    deletions: 1,
    chunks: [],
  };
}

describe('mergedChunks cache helpers', () => {
  it('returns the chunks for the current diff version', () => {
    const file = createFile('src/app.ts');
    const state = buildMergedChunksState(
      3,
      new Set([file.path]),
      new Map([[file.path, file]]),
      () => [createMergedChunk('current chunk')],
    );

    expect(getMergedChunksForVersion(state, 3, file.path)?.[0]?.lines[0]?.content).toBe(
      'current chunk',
    );
  });

  it('does not reuse chunks from an older diff version for the same file path', () => {
    const file = createFile('src/app.ts');
    const oldState = buildMergedChunksState(
      1,
      new Set([file.path]),
      new Map([[file.path, file]]),
      () => [createMergedChunk('old chunk')],
    );

    expect(getMergedChunksForVersion(oldState, 2, file.path)).toBeUndefined();

    const newState = buildMergedChunksState(
      2,
      new Set([file.path]),
      new Map([[file.path, file]]),
      () => [createMergedChunk('new chunk')],
    );

    expect(getMergedChunksForVersion(newState, 2, file.path)?.[0]?.lines[0]?.content).toBe(
      'new chunk',
    );
  });
});
