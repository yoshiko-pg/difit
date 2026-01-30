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
