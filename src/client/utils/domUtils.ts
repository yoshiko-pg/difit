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
