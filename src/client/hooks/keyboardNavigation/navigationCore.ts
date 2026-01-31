import type { DiffFile } from '../../../types/diff';
import { getElementId } from '../../utils/navigation/domHelpers';
import { fixSide } from '../../utils/navigation/lineHelpers';

import type {
  CursorPosition,
  NavigationDirection,
  NavigationFilter,
  NavigationResult,
  ViewMode,
} from './types';

/**
 * Get the starting position for navigation
 */
export function getStartPosition(cursor: CursorPosition | null): CursorPosition {
  return cursor || { fileIndex: 0, chunkIndex: 0, lineIndex: -1, side: 'right' };
}

/**
 * Check if we've wrapped around to the starting position
 */
export function hasWrappedAround(
  current: CursorPosition,
  start: CursorPosition,
  started: boolean,
): boolean {
  return (
    started &&
    current.fileIndex === start.fileIndex &&
    current.chunkIndex === start.chunkIndex &&
    current.lineIndex === start.lineIndex
  );
}

/**
 * Advance to the next position in the given direction
 */
export function advancePosition(
  pos: CursorPosition,
  direction: NavigationDirection,
  files: DiffFile[],
): CursorPosition | null {
  let { fileIndex, chunkIndex, lineIndex } = pos;
  const totalFiles = files.length;
  let wrappedCount = 0;

  if (direction === 'next') {
    lineIndex++;

    // Keep advancing until we find a valid position
    while (wrappedCount < totalFiles) {
      // Check if current line exists
      if (files[fileIndex]?.chunks[chunkIndex]?.lines[lineIndex]) {
        return { ...pos, fileIndex, chunkIndex, lineIndex };
      }

      // Move to next chunk
      chunkIndex++;
      lineIndex = 0;

      // Check if current chunk exists
      if (!files[fileIndex]?.chunks[chunkIndex]) {
        // Move to next file
        fileIndex++;
        chunkIndex = 0;
        lineIndex = 0;

        // Wrap around to beginning
        if (fileIndex >= totalFiles) {
          fileIndex = 0;
          wrappedCount++;
        }
      }
    }
  } else {
    lineIndex--;

    // Keep advancing backward until we find a valid position
    while (wrappedCount < totalFiles) {
      // Check if we need to move to previous chunk
      if (lineIndex < 0) {
        chunkIndex--;

        // Check if we need to move to previous file
        if (chunkIndex < 0) {
          fileIndex--;

          // Wrap around to end
          if (fileIndex < 0) {
            fileIndex = totalFiles - 1;
            wrappedCount++;
          }

          const file = files[fileIndex];
          if (file && file.chunks.length > 0) {
            chunkIndex = file.chunks.length - 1;
            const chunk = file.chunks[chunkIndex];
            lineIndex = chunk && chunk.lines.length > 0 ? chunk.lines.length - 1 : -1;
          } else {
            chunkIndex = -1;
            lineIndex = -1;
          }
        } else {
          const chunk = files[fileIndex]?.chunks[chunkIndex];
          lineIndex = chunk && chunk.lines.length > 0 ? chunk.lines.length - 1 : -1;
        }
      }

      // Check if current position is valid
      if (lineIndex >= 0 && files[fileIndex]?.chunks[chunkIndex]?.lines[lineIndex]) {
        return { ...pos, fileIndex, chunkIndex, lineIndex };
      }

      // If we couldn't find a valid line in this chunk, continue to previous chunk
      if (lineIndex < 0) {
        continue;
      }

      // Otherwise, keep going backward
      lineIndex--;
    }
  }

  return null;
}

/**
 * Search for the next position matching the filter
 */
export function findNextMatchingPosition(
  startPos: CursorPosition,
  direction: NavigationDirection,
  filter: NavigationFilter,
  files: DiffFile[],
  viewMode: ViewMode,
): NavigationResult {
  let current: CursorPosition | null = startPos;
  let started = false;

  while (true) {
    if (!current) break;

    const nextPos = advancePosition(current, direction, files);
    if (!nextPos) break;

    current = nextPos;

    // Check if we've wrapped around to start
    if (hasWrappedAround(current, startPos, started)) {
      break;
    }
    started = true;

    // Check if position matches filter
    if (filter(current, files)) {
      const fixed = fixSide(current, files);
      return {
        position: fixed,
        scrollTarget: getElementId(fixed, viewMode),
      };
    }
  }

  return { position: null, scrollTarget: null };
}
