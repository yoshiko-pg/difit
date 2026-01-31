import {
  FileDiff,
  FilePlus,
  FileX,
  FilePen,
  Copy,
  ChevronRight,
  ChevronDown,
  Check,
  Square,
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';

import {
  type DiffFile,
  type DiffViewMode,
  type DiffSide,
  type Comment,
  type LineNumber,
} from '../../types/diff';
import { type CursorPosition } from '../hooks/keyboardNavigation';
import { type MergedChunk } from '../hooks/useExpandedLines';
import { getViewerForFile } from '../viewers/registry';
import type { DiffViewerBodyProps } from '../viewers/types';

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
}: DiffViewerProps) {
  const isCollapsed = collapsedFiles.has(file.path);
  const [isCopied, setIsCopied] = useState(false);
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

  const getFileIcon = (status: DiffFile['status']) => {
    switch (status) {
      case 'added':
        return <FilePlus size={16} className="text-github-accent" />;
      case 'deleted':
        return <FileX size={16} className="text-github-danger" />;
      case 'renamed':
        return <FilePen size={16} className="text-github-warning" />;
      default:
        return <FileDiff size={16} className="text-github-text-secondary" />;
    }
  };

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
    onLineClick,
    commentTrigger,
    onCommentTriggerHandled,
  };

  return (
    <div
      ref={containerRef}
      className="bg-github-bg-primary"
      style={{ '--line-number-width': lineNumberWidth } as React.CSSProperties}
    >
      <div className="bg-github-bg-secondary border-t-2 border-t-github-accent border-b border-github-border px-5 py-4 flex items-center justify-between flex-wrap gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={(e) => {
              if (e.altKey) {
                // When Alt+clicking, collapse all if this file is expanded, expand all if collapsed
                onToggleAllCollapsed(!isCollapsed);
              } else {
                onToggleCollapsed(file.path);
              }
            }}
            className="text-github-text-muted hover:text-github-text-primary transition-colors cursor-pointer"
            title={
              isCollapsed ?
                'Expand file (Alt+Click to expand all)'
              : 'Collapse file (Alt+Click to collapse all)'
            }
          >
            {isCollapsed ?
              <ChevronRight size={16} />
            : <ChevronDown size={16} />}
          </button>
          {getFileIcon(file.status)}
          <h2 className="text-sm font-mono text-github-text-primary m-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {file.path}
          </h2>
          <button
            className={`bg-transparent border-none cursor-pointer px-1.5 py-1 rounded text-sm transition-all hover:bg-github-bg-tertiary ${
              isCopied ? 'text-github-accent' : (
                'text-github-text-secondary hover:text-github-text-primary'
              )
            }`}
            onClick={() => {
              navigator.clipboard
                .writeText(file.path)
                .then(() => {
                  console.log('File path copied to clipboard:', file.path);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                })
                .catch((err) => {
                  console.error('Failed to copy file path:', err);
                });
            }}
            title="Copy file path"
          >
            {isCopied ?
              <Check size={14} />
            : <Copy size={14} />}
          </button>
          {file.oldPath && file.oldPath !== file.path && (
            <span className="text-xs text-github-text-muted italic">
              (renamed from {file.oldPath})
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium px-1 py-0.5 rounded text-github-accent bg-green-100/10">
              +{file.additions}
            </span>
            <span className="font-medium px-1 py-0.5 rounded text-github-danger bg-red-100/10">
              -{file.deletions}
            </span>
          </div>
          <button
            onClick={() => onToggleReviewed(file.path)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              reviewedFiles.has(file.path) ?
                'bg-github-accent text-white'
              : 'dark:bg-slate-600 dark:text-white dark:border-slate-500 dark:hover:bg-slate-500 dark:hover:border-slate-400 bg-github-bg-secondary text-github-text-primary border border-github-border hover:bg-github-bg-tertiary hover:border-github-text-muted'
            }`}
            title={reviewedFiles.has(file.path) ? 'Mark as not reviewed' : 'Mark as reviewed'}
          >
            {reviewedFiles.has(file.path) ?
              <Check size={14} />
            : <Square size={14} />}
            Viewed
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="overflow-y-auto">
          <ViewerComponent {...viewerProps} />
        </div>
      )}
    </div>
  );
});
