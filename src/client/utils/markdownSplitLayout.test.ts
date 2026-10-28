import { describe, expect, it } from 'vitest';

import type { CommentThread } from '../../types/diff';

import { alignMarkdownBlocks, parseMarkdownBlocks } from './markdownBlocks';
import { buildSplitPreviewItems, placeThreadsOnRows } from './markdownSplitLayout';

const thread = (id: string, line: CommentThread['line'], side?: CommentThread['side']) => ({
  id,
  file: 'doc.md',
  line,
  side,
  createdAt: '2026-09-29T00:00:00.000Z',
  updatedAt: '2026-09-29T00:00:00.000Z',
  messages: [],
});

const paragraphs = (count: number, changedIndex?: number) =>
  Array.from({ length: count }, (_, index) =>
    index === changedIndex ? `Changed paragraph ${index}` : `Paragraph ${index}`,
  ).join('\n\n');

describe('placeThreadsOnRows', () => {
  const rows = alignMarkdownBlocks(
    parseMarkdownBlocks('# Title\n\nOld text\n\nShared'),
    parseMarkdownBlocks('# Title\n\nNew text here\n\nShared'),
  );

  it('places a thread on the row whose block contains its end line, on its own side', () => {
    const newThread = thread('new', [3, 3], 'new');
    const oldThread = thread('old', 3, 'old');

    const { byRow, unplaced } = placeThreadsOnRows([newThread, oldThread], rows);

    expect(byRow.get(1)).toEqual({ old: [oldThread], new: [newThread] });
    expect(unplaced).toEqual([]);
  });

  it('treats threads without a side as new-side threads', () => {
    const legacy = thread('legacy', 5);

    expect(placeThreadsOnRows([legacy], rows).byRow.get(2)).toEqual({ old: [], new: [legacy] });
  });

  it('falls back to the nearest block above when the line is blank', () => {
    const onBlankLine = thread('blank', 4, 'new');

    expect(placeThreadsOnRows([onBlankLine], rows).byRow.get(1)).toEqual({
      old: [],
      new: [onBlankLine],
    });
  });

  it('reports threads that no block on their side can hold', () => {
    const addedRows = alignMarkdownBlocks([], parseMarkdownBlocks('Only new'));
    const oldThread = thread('old', 1, 'old');

    expect(placeThreadsOnRows([oldThread], addedRows)).toEqual({
      byRow: new Map(),
      unplaced: [oldThread],
    });
  });
});

describe('buildSplitPreviewItems', () => {
  const rows = alignMarkdownBlocks(
    parseMarkdownBlocks(paragraphs(12)),
    parseMarkdownBlocks(paragraphs(12, 6)),
  );

  it('collapses long unchanged runs and keeps two rows of context around changes', () => {
    expect(buildSplitPreviewItems(rows, new Set(), new Set())).toEqual([
      { kind: 'collapsed', start: 0, end: 4 },
      { kind: 'row', index: 4 },
      { kind: 'row', index: 5 },
      { kind: 'row', index: 6 },
      { kind: 'row', index: 7 },
      { kind: 'row', index: 8 },
      { kind: 'collapsed', start: 9, end: 12 },
    ]);
  });

  it('keeps pinned rows and their context visible', () => {
    const items = buildSplitPreviewItems(rows, new Set([0]), new Set());

    expect(items.slice(0, 4)).toEqual([
      { kind: 'row', index: 0 },
      { kind: 'row', index: 1 },
      { kind: 'row', index: 2 },
      { kind: 'row', index: 3 },
    ]);
  });

  it('shows a collapsed run once it has been expanded', () => {
    const items = buildSplitPreviewItems(rows, new Set(), new Set([9]));

    expect(items.slice(-3)).toEqual([
      { kind: 'row', index: 9 },
      { kind: 'row', index: 10 },
      { kind: 'row', index: 11 },
    ]);
  });
});
