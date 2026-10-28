import { diffArrays, diffWords } from 'diff';
import type { RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { getFrontmatterLines } from './frontmatter';
import { getUnchangedRatio } from './wordLevelDiff';

// Same parser and GFM settings as the react-markdown renderer, so block splits match rendering.
const markdownParser = unified().use(remarkParse).use(remarkGfm);

type MarkdownBlockKind = RootContent['type'] | 'frontmatter';

export interface MarkdownBlock {
  kind: MarkdownBlockKind;
  /** 1-based, inclusive line numbers in the full file (frontmatter included). */
  startLine: number;
  endLine: number;
  source: string;
}

export type MarkdownBlockRow =
  | { type: 'unchanged'; old: MarkdownBlock; new: MarkdownBlock }
  | { type: 'modified'; old: MarkdownBlock; new: MarkdownBlock }
  | { type: 'removed'; old: MarkdownBlock }
  | { type: 'added'; new: MarkdownBlock };

const PAIRING_SIMILARITY_THRESHOLD = 0.5;
// Similarity search is quadratic; above this many candidate pairs we pair by position only.
const MAX_SIMILARITY_COMPARISONS = 2500;

const stripCarriageReturn = (line: string) => line.replace(/\r$/, '');

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split('\n').map(stripCarriageReturn);
  const frontmatterLines = getFrontmatterLines(text);
  const lineOffset = frontmatterLines.length;
  const blocks: MarkdownBlock[] = [];

  if (lineOffset > 0) {
    blocks.push({
      kind: 'frontmatter',
      startLine: 1,
      endLine: lineOffset,
      source: frontmatterLines.join('\n'),
    });
  }

  const tree = markdownParser.parse(lines.slice(lineOffset).join('\n'));

  for (const node of tree.children) {
    // List items become separate rows so one edited item does not mark the whole list as changed.
    const nodes: RootContent[] = node.type === 'list' ? node.children : [node];
    for (const child of nodes) {
      if (!child.position) continue;
      const startLine = child.position.start.line + lineOffset;
      const endLine = child.position.end.line + lineOffset;
      blocks.push({
        kind: child.type,
        startLine,
        endLine,
        source: lines.slice(startLine - 1, endLine).join('\n'),
      });
    }
  }

  return blocks;
}

const normalizeBlockSource = (source: string) =>
  source
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

const blockKey = (block: MarkdownBlock) =>
  `${block.kind}\u0000${normalizeBlockSource(block.source)}`;

const toBigrams = (text: string): Map<string, number> => {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const bigrams = new Map<string, number>();
  for (let index = 0; index < normalized.length - 1; index++) {
    const bigram = normalized.slice(index, index + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }
  return bigrams;
};

/** Dice coefficient over character bigrams: 1 for identical text, 0 for nothing in common. */
const similarity = (left: string, right: string): number => {
  const leftBigrams = toBigrams(left);
  const rightBigrams = toBigrams(right);
  let leftTotal = 0;
  let rightTotal = 0;
  let shared = 0;
  for (const count of rightBigrams.values()) rightTotal += count;
  for (const [bigram, count] of leftBigrams) {
    leftTotal += count;
    shared += Math.min(count, rightBigrams.get(bigram) ?? 0);
  }
  if (leftTotal + rightTotal === 0) return left.trim() === right.trim() ? 1 : 0;
  return (2 * shared) / (leftTotal + rightTotal);
};

const findSimilarPairs = (removed: MarkdownBlock[], added: MarkdownBlock[]) => {
  const pairs: Array<[number, number]> = [];
  if (removed.length * added.length > MAX_SIMILARITY_COMPARISONS) return pairs;

  let nextAddedIndex = 0;
  removed.forEach((removedBlock, removedIndex) => {
    let bestIndex = -1;
    let bestScore = PAIRING_SIMILARITY_THRESHOLD;
    for (let addedIndex = nextAddedIndex; addedIndex < added.length; addedIndex++) {
      const addedBlock = added[addedIndex];
      if (!addedBlock || addedBlock.kind !== removedBlock.kind) continue;
      const score = similarity(removedBlock.source, addedBlock.source);
      if (score > bestScore) {
        bestIndex = addedIndex;
        bestScore = score;
      }
    }
    if (bestIndex >= 0) {
      pairs.push([removedIndex, bestIndex]);
      nextAddedIndex = bestIndex + 1;
    }
  });
  return pairs;
};

const pairChangedBlocks = (
  removed: MarkdownBlock[],
  added: MarkdownBlock[],
): MarkdownBlockRow[] => {
  const rows: MarkdownBlockRow[] = [];
  let removedCursor = 0;
  let addedCursor = 0;

  // Blocks between two similar pairs are paired by position so both panes stay level.
  const emitGap = (removedEnd: number, addedEnd: number) => {
    const gapRemoved = removed.slice(removedCursor, removedEnd);
    const gapAdded = added.slice(addedCursor, addedEnd);
    gapRemoved.forEach((oldBlock, index) => {
      const newBlock = gapAdded[index];
      rows.push(
        newBlock
          ? { type: 'modified', old: oldBlock, new: newBlock }
          : { type: 'removed', old: oldBlock },
      );
    });
    gapAdded
      .slice(gapRemoved.length)
      .forEach((newBlock) => rows.push({ type: 'added', new: newBlock }));
  };

  for (const [removedIndex, addedIndex] of findSimilarPairs(removed, added)) {
    emitGap(removedIndex, addedIndex);
    const oldBlock = removed[removedIndex];
    const newBlock = added[addedIndex];
    if (oldBlock && newBlock) rows.push({ type: 'modified', old: oldBlock, new: newBlock });
    removedCursor = removedIndex + 1;
    addedCursor = addedIndex + 1;
  }
  emitGap(removed.length, added.length);

  return rows;
};

export function alignMarkdownBlocks(
  oldBlocks: MarkdownBlock[],
  newBlocks: MarkdownBlock[],
): MarkdownBlockRow[] {
  const changes = diffArrays(oldBlocks.map(blockKey), newBlocks.map(blockKey));
  const rows: MarkdownBlockRow[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let pendingRemoved: MarkdownBlock[] = [];
  let pendingAdded: MarkdownBlock[] = [];

  const flushPending = () => {
    rows.push(...pairChangedBlocks(pendingRemoved, pendingAdded));
    pendingRemoved = [];
    pendingAdded = [];
  };

  for (const change of changes) {
    const count = change.value.length;
    if (change.removed) {
      pendingRemoved.push(...oldBlocks.slice(oldIndex, oldIndex + count));
      oldIndex += count;
    } else if (change.added) {
      pendingAdded.push(...newBlocks.slice(newIndex, newIndex + count));
      newIndex += count;
    } else {
      flushPending();
      const unchangedNew = newBlocks.slice(newIndex, newIndex + count);
      oldBlocks.slice(oldIndex, oldIndex + count).forEach((oldBlock, offset) => {
        const newBlock = unchangedNew[offset];
        if (newBlock) rows.push({ type: 'unchanged', old: oldBlock, new: newBlock });
      });
      oldIndex += count;
      newIndex += count;
    }
  }
  flushPending();

  return rows;
}

export type TextRange = [start: number, end: number];

export interface RenderedTextDiff {
  oldRanges: TextRange[];
  newRanges: TextRange[];
  /** See `getUnchangedRatio`. */
  unchangedRatio: number;
}

const wordSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : undefined;

const trimRange = (text: string, start: number, end: number): TextRange | null => {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && /\s/.test(text[trimmedStart] ?? '')) trimmedStart++;
  while (trimmedEnd > trimmedStart && /\s/.test(text[trimmedEnd - 1] ?? '')) trimmedEnd--;
  return trimmedStart < trimmedEnd ? [trimmedStart, trimmedEnd] : null;
};

/** Word-level diff of the rendered text of two blocks, as character ranges into each text. */
export function diffRenderedText(oldText: string, newText: string): RenderedTextDiff {
  const changes = diffWords(
    oldText,
    newText,
    wordSegmenter ? { intlSegmenter: wordSegmenter } : {},
  );
  const oldRanges: TextRange[] = [];
  const newRanges: TextRange[] = [];
  let oldOffset = 0;
  let newOffset = 0;

  for (const change of changes) {
    const length = change.value.length;
    if (change.removed) {
      const range = trimRange(oldText, oldOffset, oldOffset + length);
      if (range) oldRanges.push(range);
      oldOffset += length;
    } else if (change.added) {
      const range = trimRange(newText, newOffset, newOffset + length);
      if (range) newRanges.push(range);
      newOffset += length;
    } else {
      oldOffset += length;
      newOffset += length;
    }
  }

  return { oldRanges, newRanges, unchangedRatio: getUnchangedRatio(changes) };
}

const normalizeForSearch = (text: string) =>
  text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '')
    .replace(/[*_~`#>|\\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Finds which source lines a piece of rendered text came from, so a comment on a text
 * selection can point at those lines instead of the whole block. Returns null when the
 * text cannot be located (for example when it spans rendered-only content).
 */
export function findSourceLinesForText(
  sourceLines: string[],
  firstLineNumber: number,
  selectedText: string,
): { start: number; end: number } | null {
  const needle = normalizeForSearch(selectedText);
  if (!needle) return null;

  const lineStarts: number[] = [];
  let joined = '';
  for (const line of sourceLines) {
    const normalized = normalizeForSearch(line);
    if (joined && normalized) joined += ' ';
    lineStarts.push(joined.length);
    joined += normalized;
  }

  const lineAt = (offset: number) => {
    let lineIndex = 0;
    while (lineIndex + 1 < lineStarts.length && (lineStarts[lineIndex + 1] ?? 0) <= offset) {
      lineIndex++;
    }
    return lineIndex;
  };

  const matchIndex = joined.indexOf(needle);
  if (matchIndex < 0) return null;

  return {
    start: firstLineNumber + lineAt(matchIndex),
    end: firstLineNumber + lineAt(matchIndex + needle.length - 1),
  };
}
