import type { CommentThread, DiffSide } from '../../types/diff';

import type { MarkdownBlock, MarkdownBlockRow } from './markdownBlocks';

export const blockOnSide = (row: MarkdownBlockRow, side: DiffSide): MarkdownBlock | undefined => {
  if (side === 'old') return 'old' in row ? row.old : undefined;
  return 'new' in row ? row.new : undefined;
};

export type RowThreads = { old: CommentThread[]; new: CommentThread[] };

const threadEndLine = (thread: CommentThread) =>
  Array.isArray(thread.line) ? thread.line[1] : thread.line;

/**
 * Assigns each thread to the row whose block (on the thread's side) starts at or before
 * the thread's end line — the containing block, or the nearest one above a blank line.
 */
export function placeThreadsOnRows(
  threads: CommentThread[],
  rows: MarkdownBlockRow[],
): { byRow: Map<number, RowThreads>; unplaced: CommentThread[] } {
  const byRow = new Map<number, RowThreads>();
  const unplaced: CommentThread[] = [];

  for (const thread of threads) {
    const side: DiffSide = thread.side === 'old' ? 'old' : 'new';
    const endLine = threadEndLine(thread);
    let targetIndex = -1;
    let firstIndexOnSide = -1;
    rows.forEach((row, index) => {
      const block = blockOnSide(row, side);
      if (!block) return;
      if (firstIndexOnSide < 0) firstIndexOnSide = index;
      if (block.startLine <= endLine) targetIndex = index;
    });
    if (targetIndex < 0) targetIndex = firstIndexOnSide;
    if (targetIndex < 0) {
      unplaced.push(thread);
      continue;
    }
    const entry = byRow.get(targetIndex) ?? { old: [], new: [] };
    entry[side].push(thread);
    byRow.set(targetIndex, entry);
  }

  for (const entry of byRow.values()) {
    entry.old.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    entry.new.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  return { byRow, unplaced };
}

export type SplitPreviewItem =
  | { kind: 'row'; index: number }
  /** Hidden unchanged rows `start` (inclusive) to `end` (exclusive). */
  | { kind: 'collapsed'; start: number; end: number };

const CONTEXT_ROWS = 2;
const MIN_COLLAPSED_ROWS = 3;

/**
 * Decides which rows to show: changed rows and pinned rows (threads, open form) plus
 * CONTEXT_ROWS around them. Other unchanged runs collapse unless the user expanded them.
 */
export function buildSplitPreviewItems(
  rows: MarkdownBlockRow[],
  pinnedRows: Set<number>,
  expandedSections: Set<number>,
): SplitPreviewItem[] {
  const visible = rows.map(() => false);
  rows.forEach((row, index) => {
    if (row.type === 'unchanged' && !pinnedRows.has(index)) return;
    const from = Math.max(0, index - CONTEXT_ROWS);
    const to = Math.min(rows.length - 1, index + CONTEXT_ROWS);
    for (let cursor = from; cursor <= to; cursor++) visible[cursor] = true;
  });

  const items: SplitPreviewItem[] = [];
  let index = 0;
  while (index < rows.length) {
    if (visible[index]) {
      items.push({ kind: 'row', index });
      index++;
      continue;
    }
    const start = index;
    while (index < rows.length && !visible[index]) index++;
    if (index - start >= MIN_COLLAPSED_ROWS && !expandedSections.has(start)) {
      items.push({ kind: 'collapsed', start, end: index });
    } else {
      for (let cursor = start; cursor < index; cursor++) items.push({ kind: 'row', index: cursor });
    }
  }
  return items;
}
