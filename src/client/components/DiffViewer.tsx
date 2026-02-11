import React, { useState, useEffect, useRef, useCallback, memo } from 'react';

import {
  type DiffFile,
  type DiffViewMode,
  type DiffSide,
  type Comment,
  type LineNumber,
  type PreviewMode,
} from '../../types/diff';
import { type CursorPosition } from '../hooks/keyboardNavigation';
import { type MergedChunk } from '../hooks/useExpandedLines';
import { getViewerForFile } from '../viewers/registry';
import type { DiffViewerBodyProps } from '../viewers/types';

import { DiffViewerHeader } from './DiffViewerHeader';
import type { AppearanceSettings } from './SettingsModal';

interface DiffViewerProps {
  file: DiffFile;
  comments: Comment[];
  diffMode: DiffViewMode;
  reviewedFiles: Set<string>;
  onToggleReviewed: (path: string) => void;
  collapsedFiles: Set<string>;
  onToggleCollapsed: (path: string) => void;
  onToggleAllCollapsed: (shouldCollapse: boolean) => void;
  onAddComment: (
    file: string,
    line: LineNumber,
    body: string,
    codeContent?: string,
    side?: DiffSide,
  ) => Promise<void>;
  onGeneratePrompt: (comment: Comment) => string;
  onRemoveComment: (commentId: string) => void;
  onUpdateComment: (commentId: string, newBody: string) => void;
  onOpenInEditor?: (filePath: string, lineNumber: number) => void;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
  baseCommitish?: string;
  targetCommitish?: string;
  cursor?: CursorPosition | null;
  fileIndex?: number;
  mergedChunks: MergedChunk[];
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
  isExpandLoading: boolean;
  onLineClick?: (
    fileIndex: number,
    chunkIndex: number,
    lineIndex: number,
    side: 'left' | 'right',
  ) => void;
  commentTrigger?: { fileIndex: number; chunkIndex: number; lineIndex: number } | null;
  onCommentTriggerHandled?: () => void;
  previewMode: PreviewMode;
}

type LineRange = { start: number; end: number };
type ChunkRange = LineRange & { index: number };
type Gap = {
  type: 'before' | 'between' | 'after';
  start: number;
  end: number;
  nextChunkIndex?: number;
  prevChunkIndex?: number;
};

const normalizeCommentRanges = (comments: Comment[]): Record<DiffSide, LineRange[]> => {
  const ranges: Record<DiffSide, LineRange[]> = { old: [], new: [] };

  comments.forEach((comment) => {
    const side = comment.side ?? 'new';
    const [start, end] =
      Array.isArray(comment.line) ?
        [comment.line[0], comment.line[1]]
      : [comment.line, comment.line];

    if (start <= 0 || end <= 0) return;

    ranges[side].push({
      start: Math.min(start, end),
      end: Math.max(start, end),
    });
  });

  return ranges;
};

const buildChunkRanges = (file: DiffFile, side: DiffSide): ChunkRange[] =>
  file.chunks
    .map((chunk, index) => {
      const start = side === 'old' ? chunk.oldStart : chunk.newStart;
      const lines = side === 'old' ? chunk.oldLines : chunk.newLines;
      if (!start || lines <= 0) return null;
      return { start, end: start + lines - 1, index };
    })
    .filter((range): range is ChunkRange => !!range);

const buildGaps = (ranges: ChunkRange[]): Gap[] => {
  const gaps: Gap[] = [];
  const firstRange = ranges[0];
  if (!firstRange) return gaps;

  if (firstRange.start > 1) {
    gaps.push({
      type: 'before',
      start: 1,
      end: firstRange.start - 1,
      nextChunkIndex: firstRange.index,
    });
  }

  for (let i = 1; i < ranges.length; i += 1) {
    const prev = ranges[i - 1];
    const current = ranges[i];
    if (!prev || !current) continue;
    if (current.start > prev.end + 1) {
      gaps.push({
        type: 'between',
        start: prev.end + 1,
        end: current.start - 1,
        prevChunkIndex: prev.index,
        nextChunkIndex: current.index,
      });
    }
  }

  const last = ranges[ranges.length - 1];
  if (!last) return gaps;
  gaps.push({
    type: 'after',
    start: last.end + 1,
    end: Number.POSITIVE_INFINITY,
    prevChunkIndex: last.index,
  });

  return gaps;
};

const buildMergedChunkIndex = (mergedChunks: MergedChunk[]) => {
  const mergedByFirstIndex = new Map<number, MergedChunk>();
  mergedChunks.forEach((chunk) => {
    const firstIndex = chunk.originalIndices[0];
    if (firstIndex !== undefined) {
      mergedByFirstIndex.set(firstIndex, chunk);
    }
  });
  return mergedByFirstIndex;
};

const getLastChunkIndex = (mergedChunks: MergedChunk[]): number | null => {
  const lastMerged = mergedChunks[mergedChunks.length - 1];
  const lastIndex = lastMerged?.originalIndices[lastMerged.originalIndices.length - 1];
  return lastIndex ?? null;
};

export const DiffViewer = memo(function DiffViewer({
  file,
  comments,
  diffMode,
  reviewedFiles,
  onToggleReviewed,
  collapsedFiles,
  onToggleCollapsed,
  onToggleAllCollapsed,
  onAddComment,
  onGeneratePrompt,
  onRemoveComment,
  onUpdateComment,
  onOpenInEditor,
  syntaxTheme,
  baseCommitish,
  targetCommitish,
  cursor = null,
  fileIndex = 0,
  onLineClick,
  commentTrigger,
  onCommentTriggerHandled,
  mergedChunks,
  expandLines,
  expandAllBetweenChunks,
  prefetchFileContent,
  isExpandLoading,
  previewMode,
}: DiffViewerProps) {
  const isCollapsed = collapsedFiles.has(file.path);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const viewer = getViewerForFile(file);
  const canExpandHiddenLines = viewer.canExpandHiddenLines?.(file) ?? false;

  // Observe visibility for lazy prefetch
  useEffect(() => {
    if (!canExpandHiddenLines) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canExpandHiddenLines]);

  // Pre-fetch line counts (lightweight) only for visible, non-collapsed files that can expand
  useEffect(() => {
    if (isVisible && !isCollapsed && canExpandHiddenLines) {
      void prefetchFileContent(file);
    }
  }, [isVisible, isCollapsed, canExpandHiddenLines, file, prefetchFileContent]);

  const handleAddComment = useCallback(
    async (line: LineNumber, body: string, codeContent?: string, side?: DiffSide) => {
      try {
        await onAddComment(file.path, line, body, codeContent, side);
      } catch (error) {
        console.error('Failed to add comment:', error);
      }
    },
    [file.path, onAddComment],
  );

  useEffect(() => {
    if (isCollapsed || isExpandLoading || !canExpandHiddenLines || comments.length === 0) {
      return;
    }

    if (file.chunks.length === 0 || mergedChunks.length === 0) {
      return;
    }

    const commentRangesBySide = normalizeCommentRanges(comments);
    const mergedByFirstIndex = buildMergedChunkIndex(mergedChunks);
    const lastChunkIndex = getLastChunkIndex(mergedChunks);
    const lastMerged = mergedChunks[mergedChunks.length - 1];

    const queued = new Set<string>();
    const queueExpand = (key: string, action: () => void) => {
      if (queued.has(key)) return;
      queued.add(key);
      action();
    };

    (['old', 'new'] as const).forEach((side) => {
      const commentRanges = commentRangesBySide[side];
      if (commentRanges.length === 0) return;

      const ranges = buildChunkRanges(file, side);
      const gaps = buildGaps(ranges);

      gaps.forEach((gap) => {
        const hasComment = commentRanges.some(
          (range) => range.start <= gap.end && range.end >= gap.start,
        );
        if (!hasComment) return;

        if (gap.type === 'after' && lastMerged && lastChunkIndex !== null) {
          if (lastMerged.hiddenLinesAfter > 0) {
            queueExpand(`after-${lastChunkIndex}`, () => {
              void expandLines(file, lastChunkIndex, 'down', lastMerged.hiddenLinesAfter);
            });
          }
          return;
        }

        const nextChunkIndex = gap.nextChunkIndex;
        if (nextChunkIndex === undefined) return;
        const mergedChunk = mergedByFirstIndex.get(nextChunkIndex);
        if (!mergedChunk || mergedChunk.hiddenLinesBefore <= 0) return;

        if (gap.type === 'before') {
          queueExpand(`before-${nextChunkIndex}`, () => {
            void expandLines(file, nextChunkIndex, 'up', mergedChunk.hiddenLinesBefore);
          });
        } else if (gap.type === 'between') {
          queueExpand(`between-${nextChunkIndex}`, () => {
            void expandAllBetweenChunks(file, nextChunkIndex, mergedChunk.hiddenLinesBefore);
          });
        }
      });
    });
  }, [
    comments,
    expandAllBetweenChunks,
    expandLines,
    file,
    isCollapsed,
    isExpandLoading,
    mergedChunks,
    canExpandHiddenLines,
  ]);

  const lineNumberWidth = '4em';
  const ViewerComponent = viewer.Component;
  const viewerProps: DiffViewerBodyProps = {
    file,
    comments,
    diffMode,
    syntaxTheme,
    baseCommitish,
    targetCommitish,
    cursor,
    fileIndex,
    mergedChunks,
    isExpandLoading,
    expandHiddenLines: expandLines,
    expandAllBetweenChunks,
    onAddComment: handleAddComment,
    onGeneratePrompt,
    onRemoveComment,
    onUpdateComment,
    onOpenInEditor,
    onLineClick,
    commentTrigger,
    onCommentTriggerHandled,
    previewMode,
  };

  return (
    <div
      ref={containerRef}
      className="bg-github-bg-primary"
      style={{ '--line-number-width': lineNumberWidth } as React.CSSProperties}
    >
      <DiffViewerHeader
        file={file}
        isCollapsed={isCollapsed}
        isReviewed={reviewedFiles.has(file.path)}
        onToggleCollapsed={onToggleCollapsed}
        onToggleAllCollapsed={onToggleAllCollapsed}
        onToggleReviewed={onToggleReviewed}
      />

      {!isCollapsed && (
        <div className="overflow-y-auto">
          <ViewerComponent {...viewerProps} />
        </div>
      )}
    </div>
  );
});
