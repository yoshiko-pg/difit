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
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';

import {
  type DiffFile,
  type DiffViewMode,
  type DiffSide,
  type Comment,
  type LineNumber,
} from '../../types/diff';
import { type CursorPosition } from '../hooks/keyboardNavigation';
import { type MergedChunk } from '../hooks/useExpandedLines';
import { isImageFile } from '../utils/imageUtils';

import { DiffChunk } from './DiffChunk';
import { ExpandButton } from './ExpandButton';
import { ImageDiffChunk } from './ImageDiffChunk';
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
    chunkHeader?: string,
    side?: DiffSide
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
    count?: number
  ) => Promise<void>;
  expandAllBetweenChunks: (
    file: DiffFile,
    chunkIndex: number,
    hiddenLines: number
  ) => Promise<void>;
  prefetchFileContent: (file: DiffFile) => Promise<void>;
  isExpandLoading: boolean;
  onLineClick?: (
    fileIndex: number,
    chunkIndex: number,
    lineIndex: number,
    side: 'left' | 'right'
  ) => void;
  commentTrigger?: { fileIndex: number; chunkIndex: number; lineIndex: number } | null;
  onCommentTriggerHandled?: () => void;
}

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

  // File needs expand if it's a modified/renamed text file (not image, not added/deleted)
  const needsExpand =
    file.status !== 'added' && file.status !== 'deleted' && !isImageFile(file.path);

  // Observe visibility for lazy prefetch
  useEffect(() => {
    if (!needsExpand) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setIsVisible(true);
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [needsExpand]);

  // Pre-fetch line counts (lightweight) only for visible, non-collapsed files that need expand
  useEffect(() => {
    if (isVisible && !isCollapsed && needsExpand) {
      void prefetchFileContent(file);
    }
  }, [isVisible, isCollapsed, needsExpand, file, prefetchFileContent]);

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
    async (
      line: LineNumber,
      body: string,
      codeContent?: string,
      chunkHeader?: string,
      side?: DiffSide
    ) => {
      try {
        await onAddComment(file.path, line, body, codeContent, chunkHeader, side);
      } catch (error) {
        console.error('Failed to add comment:', error);
      }
    },
    [file.path, onAddComment]
  );

  const mergedChunkItems = useMemo(
    () =>
      mergedChunks.map((mergedChunk) => ({
        mergedChunk,
        onAddComment: (line: LineNumber, body: string, codeContent?: string, side?: DiffSide) =>
          handleAddComment(line, body, codeContent, mergedChunk.header, side),
      })),
    [mergedChunks, handleAddComment]
  );

  useEffect(() => {
    if (isCollapsed || isExpandLoading || !needsExpand || comments.length === 0) {
      return;
    }

    if (file.chunks.length === 0 || mergedChunks.length === 0) {
      return;
    }

    const commentRangesBySide: Record<DiffSide, Array<{ start: number; end: number }>> = {
      old: [],
      new: [],
    };

    comments.forEach((comment) => {
      const side = comment.side ?? 'new';
      const [start, end] =
        Array.isArray(comment.line) ?
          [comment.line[0], comment.line[1]]
        : [comment.line, comment.line];
      if (start <= 0 || end <= 0) return;
      commentRangesBySide[side].push({
        start: Math.min(start, end),
        end: Math.max(start, end),
      });
    });

    const buildRanges = (side: DiffSide) =>
      file.chunks
        .map((chunk, index) => {
          const start = side === 'old' ? chunk.oldStart : chunk.newStart;
          const lines = side === 'old' ? chunk.oldLines : chunk.newLines;
          if (!start || lines <= 0) return null;
          return { start, end: start + lines - 1, index };
        })
        .filter((range): range is { start: number; end: number; index: number } => !!range);

    const buildGaps = (ranges: Array<{ start: number; end: number; index: number }>) => {
      const gaps: Array<{
        type: 'before' | 'between' | 'after';
        start: number;
        end: number;
        nextChunkIndex?: number;
        prevChunkIndex?: number;
      }> = [];

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

    const mergedByFirstIndex = new Map<number, MergedChunk>();
    mergedChunks.forEach((chunk) => {
      const firstIndex = chunk.originalIndices[0];
      if (firstIndex !== undefined) {
        mergedByFirstIndex.set(firstIndex, chunk);
      }
    });

    const lastMerged = mergedChunks[mergedChunks.length - 1];
    const lastChunkIndex =
      lastMerged?.originalIndices[lastMerged.originalIndices.length - 1] ?? null;

    const queued = new Set<string>();
    const queueExpand = (key: string, action: () => void) => {
      if (queued.has(key)) return;
      queued.add(key);
      action();
    };

    (['old', 'new'] as const).forEach((side) => {
      const ranges = buildRanges(side);
      const gaps = buildGaps(ranges);
      const commentRanges = commentRangesBySide[side];
      if (commentRanges.length === 0) return;

      gaps.forEach((gap) => {
        const hasComment = commentRanges.some(
          (range) => range.start <= gap.end && range.end >= gap.start
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
    needsExpand,
  ]);

  // Helper to render expand button (#4 - consolidated logic)
  const renderExpandButton = (
    position: 'top' | 'middle' | 'bottom',
    mergedChunk: MergedChunk,
    firstOriginalIndex: number,
    lastOriginalIndex: number
  ) => {
    if (position === 'top' && mergedChunk.hiddenLinesBefore > 0) {
      return (
        <ExpandButton
          direction="down"
          hiddenLines={mergedChunk.hiddenLinesBefore}
          onExpandDown={() => expandLines(file, firstOriginalIndex, 'up')}
          onExpandAll={() =>
            expandAllBetweenChunks(file, firstOriginalIndex, mergedChunk.hiddenLinesBefore)
          }
          isLoading={isExpandLoading}
        />
      );
    }

    if (position === 'middle' && mergedChunk.hiddenLinesBefore > 0) {
      return (
        <ExpandButton
          direction="both"
          hiddenLines={mergedChunk.hiddenLinesBefore}
          onExpandUp={() => expandLines(file, firstOriginalIndex - 1, 'down')}
          onExpandDown={() => expandLines(file, firstOriginalIndex, 'up')}
          onExpandAll={() =>
            expandAllBetweenChunks(file, firstOriginalIndex, mergedChunk.hiddenLinesBefore)
          }
          isLoading={isExpandLoading}
        />
      );
    }

    if (position === 'bottom' && mergedChunk.hiddenLinesAfter > 0) {
      return (
        <ExpandButton
          direction="up"
          hiddenLines={mergedChunk.hiddenLinesAfter}
          onExpandUp={() => expandLines(file, lastOriginalIndex, 'down')}
          onExpandAll={() =>
            expandLines(file, lastOriginalIndex, 'down', mergedChunk.hiddenLinesAfter)
          }
          isLoading={isExpandLoading}
        />
      );
    }

    return null;
  };

  const lineNumberWidth = '4em';

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
          {isImageFile(file.path) ?
            <ImageDiffChunk
              file={file}
              mode={diffMode}
              baseCommitish={baseCommitish}
              targetCommitish={targetCommitish}
            />
          : mergedChunkItems.map(({ mergedChunk, onAddComment }, mergedIndex) => {
              const isFirstMerged = mergedIndex === 0;
              const isLastMerged = mergedIndex === mergedChunkItems.length - 1;
              const firstOriginalIndex = mergedChunk.originalIndices[0] ?? 0;
              const lastOriginalIndex =
                mergedChunk.originalIndices[mergedChunk.originalIndices.length - 1] ?? 0;

              return (
                <React.Fragment key={mergedIndex}>
                  {/* Expand button before first merged chunk (file start) */}
                  {isFirstMerged &&
                    renderExpandButton('top', mergedChunk, firstOriginalIndex, lastOriginalIndex)}

                  {/* Expand button between merged chunks */}
                  {!isFirstMerged &&
                    renderExpandButton(
                      'middle',
                      mergedChunk,
                      firstOriginalIndex,
                      lastOriginalIndex
                    )}

                  <div id={`chunk-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}-${mergedIndex}`}>
                    <DiffChunk
                      chunk={mergedChunk}
                      chunkIndex={mergedIndex}
                      comments={comments}
                      onAddComment={onAddComment}
                      onGeneratePrompt={onGeneratePrompt}
                      onRemoveComment={onRemoveComment}
                      onUpdateComment={onUpdateComment}
                      mode={diffMode}
                      syntaxTheme={syntaxTheme}
                      cursor={cursor && cursor.chunkIndex === mergedIndex ? cursor : null}
                      fileIndex={fileIndex}
                      onLineClick={onLineClick}
                      commentTrigger={
                        commentTrigger && commentTrigger.chunkIndex === mergedIndex ?
                          commentTrigger
                        : null
                      }
                      onCommentTriggerHandled={onCommentTriggerHandled}
                      filename={file.path}
                    />
                  </div>

                  {/* Expand button after last merged chunk */}
                  {isLastMerged &&
                    renderExpandButton(
                      'bottom',
                      mergedChunk,
                      firstOriginalIndex,
                      lastOriginalIndex
                    )}
                </React.Fragment>
              );
            })
          }
        </div>
      )}
    </div>
  );
});
