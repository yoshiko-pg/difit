import type { CursorPosition, ViewMode } from '../../hooks/keyboardNavigation/types';

/**
 * Creates a DOM element ID from a cursor position
 * Format: file-{fileIndex}-chunk-{chunkIndex}-line-{lineIndex}[-{side}]
 */
export function getElementId(position: CursorPosition, viewMode: ViewMode): string {
  const baseId = `file-${position.fileIndex}-chunk-${position.chunkIndex}-line-${position.lineIndex}`;
  return viewMode === 'split' ? `${baseId}-${position.side}` : baseId;
}

/**
 * Creates a comment lookup key from file path and line number
 */
export function getCommentKey(filePath: string, lineNumber: number): string {
  return `${filePath}:${lineNumber}`;
}
