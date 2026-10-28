import { diffWords, diffWordsWithSpace, type ChangeObject } from 'diff';

/** Below this share of unchanged text, word highlights are noise rather than help. */
export const MIN_WORD_DIFF_SIMILARITY = 0.2;

/** Share of characters, over both sides, that a word diff left unchanged. */
export function getUnchangedRatio(changes: ChangeObject<string>[]): number {
  let unchangedLength = 0;
  let totalLength = 0;
  for (const change of changes) {
    totalLength += change.value.length;
    if (!change.added && !change.removed) {
      unchangedLength += change.value.length;
    }
  }
  return totalLength === 0 ? 1 : unchangedLength / totalLength;
}

export interface DiffSegment {
  value: string;
  type: 'unchanged' | 'added' | 'removed';
}

export interface WordLevelDiffResult {
  oldSegments: DiffSegment[];
  newSegments: DiffSegment[];
}

/**
 * Compute word-level diff between two strings.
 * Returns segments for both old and new lines, each marked as unchanged, added, or removed.
 */
export function computeWordLevelDiff(oldContent: string, newContent: string): WordLevelDiffResult {
  const changes = diffWordsWithSpace(oldContent, newContent);

  const oldSegments: DiffSegment[] = [];
  const newSegments: DiffSegment[] = [];

  for (const change of changes) {
    if (change.added) {
      // Added segment only appears in new
      newSegments.push({ value: change.value, type: 'added' });
    } else if (change.removed) {
      // Removed segment only appears in old
      oldSegments.push({ value: change.value, type: 'removed' });
    } else {
      // Unchanged segment appears in both
      oldSegments.push({ value: change.value, type: 'unchanged' });
      newSegments.push({ value: change.value, type: 'unchanged' });
    }
  }

  return { oldSegments, newSegments };
}

/**
 * Check if two lines are similar enough to warrant word-level diff.
 * Returns true if the lines share some common content.
 */
export function shouldComputeWordDiff(oldContent: string, newContent: string): boolean {
  // Skip if either line is empty or too short
  if (!oldContent.trim() || !newContent.trim()) {
    return false;
  }

  // Skip if lines are identical
  if (oldContent === newContent) {
    return false;
  }

  // Compute similarity ratio using Levenshtein-like approach
  // If lines are too different, skip word-level diff
  const changes = diffWords(oldContent, newContent);

  return getUnchangedRatio(changes) >= MIN_WORD_DIFF_SIMILARITY;
}
