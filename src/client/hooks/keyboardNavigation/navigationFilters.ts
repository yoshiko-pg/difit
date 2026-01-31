import type { DiffFile, Comment } from '../../../types/diff';
import { getCommentKey } from '../../utils/navigation/domHelpers';
import { hasContentOnSide } from '../../utils/navigation/lineHelpers';

import type { CursorPosition, ViewMode } from './types';

/**
 * Creates navigation filters for different navigation targets
 */
export function createNavigationFilters(
  files: DiffFile[],
  commentIndex: Map<string, Comment[]>,
  viewMode: ViewMode,
  reviewedFiles?: Set<string>,
) {
  return {
    /**
     * Line navigation - navigates to lines with content on the current side
     * In inline mode, all lines are navigable
     * In side-by-side mode, only lines with content on the current side
     * Skip lines in reviewed/collapsed files
     */
    line: (pos: CursorPosition): boolean => {
      const file = files[pos.fileIndex];
      if (!file) return false;

      // Skip if file is reviewed/collapsed
      if (reviewedFiles?.has(file.path)) return false;

      return viewMode === 'inline' || hasContentOnSide(pos, files);
    },

    /**
     * Chunk navigation - navigates to the first line of each change chunk
     * Skips normal (unchanged) lines and finds boundaries between chunks
     * Skip chunks in reviewed/collapsed files
     */
    chunk: (pos: CursorPosition): boolean => {
      const file = files[pos.fileIndex];
      if (!file) return false;

      // Skip if file is reviewed/collapsed
      if (reviewedFiles?.has(file.path)) return false;

      const line = file.chunks[pos.chunkIndex]?.lines[pos.lineIndex];
      if (!line || line.type === 'normal') return false;

      // First line of a chunk is always a chunk boundary
      if (pos.lineIndex === 0) return true;

      // Check if previous line is normal (indicating start of a change chunk)
      const prevLine = file.chunks[pos.chunkIndex]?.lines[pos.lineIndex - 1];
      return !prevLine || prevLine.type === 'normal';
    },

    /**
     * Comment navigation - navigates to lines that have comments
     * Comments can only exist on add and normal lines (right side)
     * Skip comments in reviewed/collapsed files
     */
    comment: (pos: CursorPosition): boolean => {
      const file = files[pos.fileIndex];
      if (!file) return false;

      // Skip if file is reviewed/collapsed
      if (reviewedFiles?.has(file.path)) return false;

      const line = file.chunks[pos.chunkIndex]?.lines[pos.lineIndex];
      if (!line) return false;

      // Comments can only exist on add and normal lines
      if (line.type === 'delete') return false;

      const lineNum = line.newLineNumber;
      if (!lineNum) return false;

      const key = getCommentKey(file.path, lineNum);
      return commentIndex.has(key);
    },

    /**
     * File navigation - navigates to the first line of each file
     */
    file: (pos: CursorPosition): boolean => {
      return pos.chunkIndex === 0 && pos.lineIndex === 0;
    },
  };
}

/**
 * Type for the navigation filters object
 */
export type NavigationFilters = ReturnType<typeof createNavigationFilters>;
