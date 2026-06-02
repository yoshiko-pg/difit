import { describe, expect, it } from 'vitest';

import type { DiffCommentThread, DiffFile, DiffLine } from '../../types/diff';

import { buildFileLineIndex, isThreadOutdated } from './outdatedComments';

const buildThread = (overrides: Partial<DiffCommentThread> = {}): DiffCommentThread => ({
  id: 'thread-1',
  filePath: 'src/app.ts',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  position: { side: 'new', line: 10 },
  codeSnapshot: { content: 'const value = 1;' },
  messages: [
    {
      id: 'message-1',
      body: 'comment',
      author: 'User',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  ...overrides,
});

const buildFile = (lines: DiffLine[]): DiffFile => ({
  path: 'src/app.ts',
  status: 'modified',
  additions: 0,
  deletions: 0,
  chunks: [
    {
      header: '@@ -1,1 +1,1 @@',
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: lines.length,
      lines,
    },
  ],
});

const newLine = (lineNumber: number, content: string): DiffLine => ({
  type: 'add',
  content,
  newLineNumber: lineNumber,
});

const oldLine = (lineNumber: number, content: string): DiffLine => ({
  type: 'delete',
  content,
  oldLineNumber: lineNumber,
});

describe('isThreadOutdated', () => {
  it('returns false when the current line content matches the snapshot', () => {
    const thread = buildThread({
      codeSnapshot: { content: 'const value = 1;' },
      position: { side: 'new', line: 10 },
    });
    const index = buildFileLineIndex(buildFile([newLine(10, 'const value = 1;')]));

    expect(isThreadOutdated(thread, index)).toBe(false);
  });

  it('returns true when the current line content differs from the snapshot', () => {
    const thread = buildThread({
      codeSnapshot: { content: 'const value = 1;' },
      position: { side: 'new', line: 10 },
    });
    const index = buildFileLineIndex(buildFile([newLine(10, 'const value = 2;')]));

    expect(isThreadOutdated(thread, index)).toBe(true);
  });

  it('returns false when the target line is not present in the index (e.g. unexpanded context)', () => {
    const thread = buildThread({ position: { side: 'new', line: 10 } });
    const index = buildFileLineIndex(buildFile([newLine(5, 'const other = 99;')]));

    expect(isThreadOutdated(thread, index)).toBe(false);
  });

  it('returns true when the file is missing from the index map (file no longer in the diff)', () => {
    const thread = buildThread();

    expect(isThreadOutdated(thread, undefined)).toBe(true);
  });

  it('returns false when the thread has no code snapshot (legacy comment)', () => {
    const thread = buildThread({ codeSnapshot: undefined });
    const index = buildFileLineIndex(buildFile([newLine(10, 'anything')]));

    expect(isThreadOutdated(thread, index)).toBe(false);
  });

  it('returns false when the snapshot only differs by trailing whitespace or line endings', () => {
    const thread = buildThread({
      codeSnapshot: { content: 'const value = 1;  \r\nconst next = 2;\r\n' },
      position: { side: 'new', line: { start: 10, end: 11 } },
    });
    const index = buildFileLineIndex(
      buildFile([newLine(10, 'const value = 1;'), newLine(11, 'const next = 2;')]),
    );

    expect(isThreadOutdated(thread, index)).toBe(false);
  });

  it('returns false when a multi-line range is partially present and the present lines all match', () => {
    const thread = buildThread({
      codeSnapshot: { content: 'const a = 1;\nconst b = 2;' },
      position: { side: 'new', line: { start: 10, end: 11 } },
    });
    const index = buildFileLineIndex(buildFile([newLine(10, 'const a = 1;')]));

    expect(isThreadOutdated(thread, index)).toBe(false);
  });

  it('returns true when a partially-present multi-line range has a mismatch on the visible line', () => {
    const thread = buildThread({
      codeSnapshot: { content: 'const a = 1;\nconst b = 2;\nconst c = 3;' },
      position: { side: 'new', line: { start: 10, end: 12 } },
    });
    const index = buildFileLineIndex(buildFile([newLine(10, 'const a = 999;')]));

    expect(isThreadOutdated(thread, index)).toBe(true);
  });

  it('compares against the "old" side when the thread is anchored to a deletion', () => {
    const thread = buildThread({
      codeSnapshot: { content: 'const removed = true;' },
      position: { side: 'old', line: 42 },
    });
    const index = buildFileLineIndex(buildFile([oldLine(42, 'const removed = false;')]));

    expect(isThreadOutdated(thread, index)).toBe(true);
  });

  it('does not flag outdated when the actual code line starts with "+" or "-" and matches', () => {
    const thread = buildThread({
      codeSnapshot: { content: '++i;' },
      position: { side: 'new', line: 10 },
    });
    const index = buildFileLineIndex(buildFile([newLine(10, '++i;')]));

    expect(isThreadOutdated(thread, index)).toBe(false);
  });

  it('treats an empty-string snapshot as a valid blank-line comment (matches blank current line)', () => {
    const thread = buildThread({
      codeSnapshot: { content: '' },
      position: { side: 'new', line: 10 },
    });
    const index = buildFileLineIndex(buildFile([newLine(10, '')]));

    expect(isThreadOutdated(thread, index)).toBe(false);
  });

  it('flags an empty-string snapshot as outdated when the current line has gained content', () => {
    const thread = buildThread({
      codeSnapshot: { content: '' },
      position: { side: 'new', line: 10 },
    });
    const index = buildFileLineIndex(buildFile([newLine(10, 'const added = true;')]));

    expect(isThreadOutdated(thread, index)).toBe(true);
  });

  it('flags a snapshot with a trailing blank line as outdated when the current trailing line has content', () => {
    const thread = buildThread({
      codeSnapshot: { content: 'const a = 1;\nconst b = 2;\n' },
      position: { side: 'new', line: { start: 10, end: 12 } },
    });
    const index = buildFileLineIndex(
      buildFile([
        newLine(10, 'const a = 1;'),
        newLine(11, 'const b = 2;'),
        newLine(12, 'const c = 3;'),
      ]),
    );

    expect(isThreadOutdated(thread, index)).toBe(true);
  });

  it('does not confuse "old" and "new" line numbers when both sides exist', () => {
    const thread = buildThread({
      codeSnapshot: { content: 'old-side text' },
      position: { side: 'old', line: 5 },
    });
    const index = buildFileLineIndex(
      buildFile([
        {
          type: 'normal',
          content: 'new-side text',
          oldLineNumber: 5,
          newLineNumber: 5,
        },
      ]),
    );

    expect(isThreadOutdated(thread, index)).toBe(true);
  });
});
