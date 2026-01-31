import { useState, useCallback, useRef } from 'react';

import {
  type DiffFile,
  type DiffChunk,
  type DiffLine,
  type ExpandedLinesState,
  type FileExpandedState,
} from '../../types/diff';

const DEFAULT_EXPAND_COUNT = 20;

interface UseExpandedLinesOptions {
  baseCommitish?: string;
  targetCommitish?: string;
}

export interface MergedChunk extends DiffChunk {
  originalIndices: number[];
  hiddenLinesBefore: number;
  hiddenLinesAfter: number;
}

interface UseExpandedLinesResult {
  expandedState: ExpandedLinesState;
  isLoading: boolean;
  lastUpdatedFilePath: string | null;
  lastUpdatedAt: number;
  expandLines: (
    file: DiffFile,
    chunkIndex: number,
    direction: 'up' | 'down',
    count?: number,
  ) => Promise<void>;
  expandAllBetweenChunks: (
    file: DiffFile,
    chunkIndex: number,
    hiddenLines: number,
  ) => Promise<void>;
  prefetchFileContent: (file: DiffFile) => Promise<void>;
  getMergedChunks: (file: DiffFile) => MergedChunk[];
  getHiddenLinesBefore: (file: DiffFile, chunk: DiffChunk, chunkIndex: number) => number;
  getHiddenLinesAfter: (file: DiffFile, chunk: DiffChunk, chunkIndex: number) => number;
}

async function fetchFileContent(
  filePath: string,
  commitish: string,
): Promise<{ lines: string[]; totalLines: number }> {
  const encodedPath = encodeURIComponent(filePath);
  const response = await fetch(`/api/blob/${encodedPath}?ref=${encodeURIComponent(commitish)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch file content: ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.split('\n');
  // Remove last empty line if file doesn't end with newline
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return { lines, totalLines: lines.length };
}

async function fetchLineCount(
  filePath: string,
  oldRef?: string,
  newRef?: string,
  oldPath?: string,
): Promise<{ oldLineCount?: number; newLineCount?: number }> {
  const encodedPath = encodeURIComponent(filePath);
  const params = new URLSearchParams();
  if (oldRef) params.set('oldRef', oldRef);
  if (newRef) params.set('newRef', newRef);
  if (oldPath && oldPath !== filePath) params.set('oldPath', oldPath);

  const response = await fetch(`/api/line-count/${encodedPath}?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch line count: ${response.statusText}`);
  }
  return response.json() as Promise<{ oldLineCount?: number; newLineCount?: number }>;
}

export function useExpandedLines({
  baseCommitish,
  targetCommitish,
}: UseExpandedLinesOptions): UseExpandedLinesResult {
  const [expandedState, setExpandedState] = useState<ExpandedLinesState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdatedFilePath, setLastUpdatedFilePath] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(0);
  // Track pending fetch promises to allow waiting for in-flight requests (#2)
  const pendingFetchesRef = useRef<Map<string, Promise<FileExpandedState>>>(new Map());
  // Use ref to access current state without causing dependency loop (#2)
  const expandedStateRef = useRef<ExpandedLinesState>({});
  expandedStateRef.current = expandedState;

  const ensureFileContent = useCallback(
    async (file: DiffFile): Promise<FileExpandedState> => {
      // Check if fetch is already in progress - wait for it instead of returning stale data
      const pendingFetch = pendingFetchesRef.current.get(file.path);
      if (pendingFetch) {
        return pendingFetch;
      }

      // Create the fetch promise
      const fetchPromise = (async (): Promise<FileExpandedState> => {
        // Read current state via ref to avoid dependency on expandedState
        const existingState = expandedStateRef.current[file.path];

        if (existingState?.oldContent && existingState?.newContent) {
          return existingState;
        }

        const state: FileExpandedState = {
          ...existingState,
          expandedRanges: existingState?.expandedRanges || [],
        };

        // Fetch old content for modified/deleted/renamed files
        if (file.status !== 'added' && baseCommitish) {
          const oldPath = file.oldPath || file.path;
          try {
            const { lines, totalLines } = await fetchFileContent(oldPath, baseCommitish);
            state.oldContent = lines;
            state.oldTotalLines = totalLines;
          } catch (error) {
            console.error('Failed to fetch old file content:', error);
            state.oldContent = [];
            state.oldTotalLines = 0;
          }
        }

        // Fetch new content for modified/added/renamed files
        if (file.status !== 'deleted' && targetCommitish) {
          try {
            const { lines, totalLines } = await fetchFileContent(file.path, targetCommitish);
            state.newContent = lines;
            state.newTotalLines = totalLines;
          } catch (error) {
            console.error('Failed to fetch new file content:', error);
            state.newContent = [];
            state.newTotalLines = 0;
          }
        }

        return state;
      })();

      pendingFetchesRef.current.set(file.path, fetchPromise);

      try {
        return await fetchPromise;
      } finally {
        pendingFetchesRef.current.delete(file.path);
      }
    },
    [baseCommitish, targetCommitish],
  );

  const markFileUpdated = useCallback((filePath: string) => {
    setLastUpdatedFilePath(filePath);
    setLastUpdatedAt((prev) => prev + 1);
  }, []);

  const expandLines = useCallback(
    async (
      file: DiffFile,
      chunkIndex: number,
      direction: 'up' | 'down',
      count: number = DEFAULT_EXPAND_COUNT,
    ) => {
      setIsLoading(true);
      try {
        const fileState = await ensureFileContent(file);

        // Use functional update to ensure we're working with the latest state
        setExpandedState((prev) => {
          const currentFileState = prev[file.path];
          // Merge: fileState has content from fetch, currentFileState has latest expandedRanges
          const currentRanges = currentFileState?.expandedRanges || fileState.expandedRanges || [];

          // Find existing range or create new one
          const existingRangeIndex = currentRanges.findIndex(
            (r) => r.chunkIndex === chunkIndex && r.direction === direction,
          );

          const newRanges = [...currentRanges];

          if (existingRangeIndex >= 0 && newRanges[existingRangeIndex]) {
            // Update existing range
            const existingRange = newRanges[existingRangeIndex];
            newRanges[existingRangeIndex] = {
              chunkIndex: existingRange.chunkIndex,
              direction: existingRange.direction,
              count: existingRange.count + count,
            };
          } else {
            // Add new range
            newRanges.push({ chunkIndex, direction, count });
          }

          return {
            ...prev,
            [file.path]: {
              // Use fileState for content (from fetch), preserve existing content if available
              oldContent: currentFileState?.oldContent ?? fileState.oldContent,
              newContent: currentFileState?.newContent ?? fileState.newContent,
              oldTotalLines: currentFileState?.oldTotalLines ?? fileState.oldTotalLines,
              newTotalLines: currentFileState?.newTotalLines ?? fileState.newTotalLines,
              expandedRanges: newRanges,
            },
          };
        });
        markFileUpdated(file.path);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureFileContent, markFileUpdated],
  );

  const expandAllBetweenChunks = useCallback(
    async (file: DiffFile, chunkIndex: number, hiddenLines: number) => {
      setIsLoading(true);
      try {
        const fileState = await ensureFileContent(file);

        // Use functional update to ensure we're working with the latest state
        setExpandedState((prev) => {
          const currentFileState = prev[file.path];
          // Merge: fileState has content from fetch, currentFileState has latest expandedRanges
          const currentRanges = currentFileState?.expandedRanges || fileState.expandedRanges || [];

          const newRanges = [...currentRanges];

          // For the gap before chunkIndex, we need to consider BOTH:
          // 1. 'up' direction from current chunk (user clicked "expand down" button in middle position)
          // 2. 'down' direction from previous chunk (user clicked "expand up" button in middle position)
          // This is because the UI buttons call different functions based on direction

          const existingUpIndex = newRanges.findIndex(
            (r) => r.chunkIndex === chunkIndex && r.direction === 'up',
          );

          const existingDownPrevIndex = newRanges.findIndex(
            (r) => r.chunkIndex === chunkIndex - 1 && r.direction === 'down',
          );

          // Calculate total already expanded from both directions
          let alreadyExpandedUp = 0;
          let alreadyExpandedDownPrev = 0;

          if (existingUpIndex >= 0 && newRanges[existingUpIndex]) {
            alreadyExpandedUp = newRanges[existingUpIndex].count;
          }
          if (existingDownPrevIndex >= 0 && newRanges[existingDownPrevIndex]) {
            alreadyExpandedDownPrev = newRanges[existingDownPrevIndex].count;
          }

          // hiddenLines is the REMAINING hidden lines after subtracting existing expanded
          // Total to expand = alreadyExpanded + remaining
          const totalToExpand = alreadyExpandedUp + alreadyExpandedDownPrev + hiddenLines;

          // Remove the 'down' range from previous chunk (if exists) to consolidate into 'up' direction
          // We need to remove it first before updating 'up' to avoid index shifting issues
          const filteredRanges = newRanges.filter(
            (r) => !(r.chunkIndex === chunkIndex - 1 && r.direction === 'down'),
          );

          // Now find or create the 'up' range
          const upIndexInFiltered = filteredRanges.findIndex(
            (r) => r.chunkIndex === chunkIndex && r.direction === 'up',
          );

          if (upIndexInFiltered >= 0 && filteredRanges[upIndexInFiltered]) {
            filteredRanges[upIndexInFiltered] = {
              chunkIndex,
              direction: 'up',
              count: totalToExpand,
            };
          } else {
            filteredRanges.push({ chunkIndex, direction: 'up', count: totalToExpand });
          }

          return {
            ...prev,
            [file.path]: {
              // Use fileState for content (from fetch), preserve existing content if available
              oldContent: currentFileState?.oldContent ?? fileState.oldContent,
              newContent: currentFileState?.newContent ?? fileState.newContent,
              oldTotalLines: currentFileState?.oldTotalLines ?? fileState.oldTotalLines,
              newTotalLines: currentFileState?.newTotalLines ?? fileState.newTotalLines,
              expandedRanges: filteredRanges,
            },
          };
        });
        markFileUpdated(file.path);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureFileContent, markFileUpdated],
  );

  // Pre-fetch only line counts (lightweight) to show bottom expand button
  const prefetchFileContent = useCallback(
    async (file: DiffFile) => {
      // Skip if we already have total lines info
      const existing = expandedStateRef.current[file.path];
      if (existing?.oldTotalLines !== undefined || existing?.newTotalLines !== undefined) {
        return;
      }

      const oldRef = file.status !== 'added' ? baseCommitish : undefined;
      const newRef = file.status !== 'deleted' ? targetCommitish : undefined;

      if (!oldRef && !newRef) return;

      try {
        const { oldLineCount, newLineCount } = await fetchLineCount(
          file.path,
          oldRef,
          newRef,
          file.oldPath,
        );

        setExpandedState((prev) => {
          const current = prev[file.path];
          if (current?.oldTotalLines !== undefined || current?.newTotalLines !== undefined) {
            return prev;
          }
          return {
            ...prev,
            [file.path]: {
              ...current,
              expandedRanges: current?.expandedRanges || [],
              oldTotalLines: oldLineCount,
              newTotalLines: newLineCount,
            },
          };
        });
        markFileUpdated(file.path);
      } catch (error) {
        console.error('Failed to prefetch line count:', error);
      }
    },
    [baseCommitish, targetCommitish, markFileUpdated],
  );

  const getExpandedCount = useCallback(
    (filePath: string, chunkIndex: number, direction: 'up' | 'down'): number => {
      const fileState = expandedState[filePath];
      if (!fileState) return 0;

      const range = fileState.expandedRanges.find(
        (r) => r.chunkIndex === chunkIndex && r.direction === direction,
      );
      return range?.count || 0;
    },
    [expandedState],
  );

  const getHiddenLinesBefore = useCallback(
    (file: DiffFile, chunk: DiffChunk, chunkIndex: number): number => {
      // Fully added/deleted files show all lines in the diff - no hidden lines
      if (file.status === 'added' || file.status === 'deleted') {
        return 0;
      }

      const prevChunk = file.chunks[chunkIndex - 1];
      let hiddenLines: number;

      if (!prevChunk) {
        // First chunk - lines before it
        hiddenLines = chunk.oldStart - 1;
      } else {
        // Gap between previous chunk and current chunk
        const prevEnd = prevChunk.oldStart + prevChunk.oldLines;
        hiddenLines = chunk.oldStart - prevEnd;
      }

      // Subtract already expanded lines
      // For "before" current chunk, we use "up" direction of current chunk
      const expandedUp = getExpandedCount(file.path, chunkIndex, 'up');
      // Also subtract "down" expansion from previous chunk
      const expandedDownPrev =
        chunkIndex > 0 ? getExpandedCount(file.path, chunkIndex - 1, 'down') : 0;

      return Math.max(0, hiddenLines - expandedUp - expandedDownPrev);
    },
    [getExpandedCount],
  );

  /**
   * Calculates the number of hidden lines after a chunk.
   * @param file - The diff file
   * @param chunk - The diff chunk
   * @param chunkIndex - The index of the chunk in the file
   * @returns The number of hidden lines after this chunk, or:
   *   - `-1` if the total file lines are unknown (file content not yet fetched)
   *   - `0` if this is not the last chunk (gaps are calculated by next chunk's hiddenLinesBefore)
   *   - `>= 0` for the actual hidden line count if known
   */
  const getHiddenLinesAfter = useCallback(
    (file: DiffFile, chunk: DiffChunk, chunkIndex: number): number => {
      // Fully added/deleted files show all lines in the diff - no hidden lines
      if (file.status === 'added' || file.status === 'deleted') {
        return 0;
      }

      const fileState = expandedState[file.path];
      const totalLines = fileState?.oldTotalLines || fileState?.newTotalLines;

      // If we don't know total lines yet, assume there might be more
      if (totalLines === undefined) {
        const nextChunk = file.chunks[chunkIndex + 1];
        if (!nextChunk) {
          // Last chunk - we don't know if there are more lines
          return -1; // Unknown - file content not yet fetched
        }
        return 0; // Will be calculated by getHiddenLinesBefore of next chunk
      }

      const nextChunk = file.chunks[chunkIndex + 1];
      if (nextChunk) {
        return 0; // Not the last chunk, no lines after
      }

      // Last chunk - lines after it
      const chunkEnd = chunk.oldStart + chunk.oldLines - 1;
      const hiddenLines = totalLines - chunkEnd;

      // Subtract already expanded lines
      const expandedDown = getExpandedCount(file.path, chunkIndex, 'down');

      return Math.max(0, hiddenLines - expandedDown);
    },
    [expandedState, getExpandedCount],
  );

  const getExpandedChunk = useCallback(
    (file: DiffFile, chunk: DiffChunk, chunkIndex: number): DiffChunk => {
      const fileState = expandedState[file.path];
      if (!fileState) return chunk;

      const expandedUp = getExpandedCount(file.path, chunkIndex, 'up');
      const expandedDown = getExpandedCount(file.path, chunkIndex, 'down');

      if (expandedUp === 0 && expandedDown === 0) {
        return chunk;
      }

      const oldContent = fileState.oldContent || [];
      const newContent = fileState.newContent || [];

      const newLines: DiffLine[] = [];

      // Add expanded lines before (up direction)
      if (expandedUp > 0) {
        const prevChunk = file.chunks[chunkIndex - 1];
        let startOld: number;

        if (!prevChunk) {
          startOld = Math.max(0, chunk.oldStart - 1 - expandedUp);
        } else {
          const prevEndOld = prevChunk.oldStart + prevChunk.oldLines - 1;
          startOld = prevEndOld;
        }

        const endOld = chunk.oldStart - 1;
        const endNew = chunk.newStart - 1;

        // Get the actual lines to show (limited by expandedUp)
        const linesToShowOld = Math.min(expandedUp, endOld - startOld);
        const actualStartOld = endOld - linesToShowOld;
        const actualStartNew = endNew - linesToShowOld;

        for (let i = 0; i < linesToShowOld; i++) {
          const oldLineNum = actualStartOld + i + 1;
          const newLineNum = actualStartNew + i + 1;
          const content = oldContent[oldLineNum - 1] ?? newContent[newLineNum - 1] ?? '';

          newLines.push({
            type: 'normal',
            content: content,
            oldLineNumber: oldLineNum,
            newLineNumber: newLineNum,
            isExpanded: true,
          } as DiffLine);
        }
      }

      // Add original chunk lines
      newLines.push(...chunk.lines);

      // Add expanded lines after (down direction)
      if (expandedDown > 0) {
        const chunkEndOld = chunk.oldStart + chunk.oldLines - 1;
        const chunkEndNew = chunk.newStart + chunk.newLines - 1;

        const nextChunk = file.chunks[chunkIndex + 1];
        const maxOld = nextChunk ? nextChunk.oldStart - 1 : fileState.oldTotalLines || chunkEndOld;

        const linesToShow = Math.min(expandedDown, maxOld - chunkEndOld);

        for (let i = 0; i < linesToShow; i++) {
          const oldLineNum = chunkEndOld + i + 1;
          const newLineNum = chunkEndNew + i + 1;
          const content = oldContent[oldLineNum - 1] ?? newContent[newLineNum - 1] ?? '';

          newLines.push({
            type: 'normal',
            content: content,
            oldLineNumber: oldLineNum,
            newLineNumber: newLineNum,
            isExpanded: true,
          } as DiffLine);
        }
      }

      // Update chunk metadata
      const firstLine = newLines[0];
      const lastLine = newLines[newLines.length - 1];

      return {
        ...chunk,
        lines: newLines,
        oldStart: firstLine?.oldLineNumber ?? chunk.oldStart,
        newStart: firstLine?.newLineNumber ?? chunk.newStart,
        oldLines:
          (lastLine?.oldLineNumber ?? chunk.oldStart + chunk.oldLines - 1) -
          (firstLine?.oldLineNumber ?? chunk.oldStart) +
          1,
        newLines:
          (lastLine?.newLineNumber ?? chunk.newStart + chunk.newLines - 1) -
          (firstLine?.newLineNumber ?? chunk.newStart) +
          1,
      };
    },
    [expandedState, getExpandedCount],
  );

  const getMergedChunks = useCallback(
    (file: DiffFile): MergedChunk[] => {
      const mergedChunks: MergedChunk[] = [];

      for (let i = 0; i < file.chunks.length; i++) {
        const chunk = file.chunks[i];
        if (!chunk) continue;

        const expandedChunk = getExpandedChunk(file, chunk, i);
        const hiddenBefore = getHiddenLinesBefore(file, chunk, i);
        const hiddenAfter = getHiddenLinesAfter(file, chunk, i);

        // Check if we should merge with previous chunk
        const lastMerged = mergedChunks[mergedChunks.length - 1];
        if (lastMerged && hiddenBefore === 0) {
          // Merge with previous chunk
          lastMerged.lines = [...lastMerged.lines, ...expandedChunk.lines];
          lastMerged.originalIndices.push(i);
          lastMerged.hiddenLinesAfter = hiddenAfter;
          // Update chunk metadata
          const lastLine = lastMerged.lines[lastMerged.lines.length - 1];
          lastMerged.oldLines =
            (lastLine?.oldLineNumber ?? lastMerged.oldStart + lastMerged.oldLines - 1) -
            lastMerged.oldStart +
            1;
          lastMerged.newLines =
            (lastLine?.newLineNumber ?? lastMerged.newStart + lastMerged.newLines - 1) -
            lastMerged.newStart +
            1;
        } else {
          // Create new merged chunk
          mergedChunks.push({
            ...expandedChunk,
            originalIndices: [i],
            hiddenLinesBefore: hiddenBefore,
            hiddenLinesAfter: hiddenAfter,
          });
        }
      }

      return mergedChunks;
    },
    [getExpandedChunk, getHiddenLinesBefore, getHiddenLinesAfter],
  );

  return {
    expandedState,
    isLoading,
    lastUpdatedFilePath,
    lastUpdatedAt,
    expandLines,
    expandAllBetweenChunks,
    prefetchFileContent,
    getMergedChunks,
    getHiddenLinesBefore,
    getHiddenLinesAfter,
  };
}
