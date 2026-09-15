/**
 * Utilities for safe DOM manipulation
 */

// Use a Map to store stable IDs for files
const fileIdMap = new Map<string, string>();
let fileIdCounter = 0;

/**
 * Get a stable, safe DOM ID for a file path
 * Uses an internal counter to ensure uniqueness without exposing file paths
 */
export function getFileElementId(filePath: string): string {
  if (!fileIdMap.has(filePath)) {
    fileIdMap.set(filePath, `file-${++fileIdCounter}`);
  }
  return fileIdMap.get(filePath) ?? '';
}

/**
 * Whether the user currently has a non-empty text selection.
 * A mouse drag that selects text still fires `click` on the common ancestor,
 * so click-to-navigate handlers use this to leave the selection alone.
 */
export function hasActiveTextSelection(): boolean {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed) return false;
  return selection.toString().length > 0;
}
