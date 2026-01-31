import type { DiffFile, Comment } from '../../../types/diff';
import type { CursorPosition } from '../../hooks/keyboardNavigation/types';

/**
 * Finds the position of a specific line number within a file's diff chunks
 * @param file The diff file to search in
 * @param fileIndex The index of the file in the files array
 * @param targetLineNumber The line number to find
 * @returns The cursor position including file, chunk, and line indices, or null if not found
 */
export function findLinePosition(
  file: DiffFile,
  fileIndex: number,
  targetLineNumber: number,
): CursorPosition | null {
  for (let chunkIndex = 0; chunkIndex < file.chunks.length; chunkIndex++) {
    const chunk = file.chunks[chunkIndex];
    if (!chunk) continue;

    for (let lineIndex = 0; lineIndex < chunk.lines.length; lineIndex++) {
      const line = chunk.lines[lineIndex];
      if (!line) continue;

      const lineNumber = line.newLineNumber || line.oldLineNumber;
      if (lineNumber === targetLineNumber) {
        return {
          fileIndex,
          chunkIndex,
          lineIndex,
          side: line.newLineNumber ? 'right' : 'left',
        };
      }
    }
  }
  return null;
}

/**
 * Finds the cursor position for a specific comment within the diff files
 * @param comment The comment to find the position for
 * @param files The array of diff files to search in
 * @returns The cursor position including file, chunk, and line indices, or null if not found
 */
export function findCommentPosition(comment: Comment, files: DiffFile[]): CursorPosition | null {
  const fileIndex = files.findIndex((f) => f.path === comment.file);
  if (fileIndex === -1) return null;

  const file = files[fileIndex];
  if (!file) return null;

  const targetLineNumber = Array.isArray(comment.line) ? comment.line[1] : comment.line;
  return findLinePosition(file, fileIndex, targetLineNumber);
}
