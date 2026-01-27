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
import React, { useState, useMemo, useEffect } from 'react';

import {
  type DiffFile,
  type DiffViewMode,
  type DiffSide,
  type Comment,
  type LineNumber,
} from '../../types/diff';
import { type CursorPosition } from '../hooks/keyboardNavigation';
import { useExpandedLines, type MergedChunk } from '../hooks/useExpandedLines';
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
  onLineClick?: (
    fileIndex: number,
    chunkIndex: number,
    lineIndex: number,
    side: 'left' | 'right'
  ) => void;
  commentTrigger?: { fileIndex: number; chunkIndex: number; lineIndex: number } | null;
  onCommentTriggerHandled?: () => void;
}

// Helper function: should show header at start when not starting from line 1
const shouldShowHeaderAtStart = (
  isFirst: boolean,
  hiddenBefore: number,
  oldStart: number
): boolean => isFirst && hiddenBefore <= 0 && oldStart > 1;

export function DiffViewer({
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
}: DiffViewerProps) {
  const isCollapsed = collapsedFiles.has(file.path);
  const [isCopied, setIsCopied] = useState(false);

  const {
    isLoading: isExpandLoading,
    expandLines,
    expandAllBetweenChunks,
    prefetchFileContent,
    getMergedChunks,
  } = useExpandedLines({ baseCommitish, targetCommitish });

  // Pre-fetch file content to know total lines for bottom expand button
  useEffect(() => {
    void prefetchFileContent(file);
  }, [file, prefetchFileContent]);

  // Memoize merged chunks to avoid recalculation on every render (#1)
  const mergedChunks = useMemo(() => getMergedChunks(file), [file, getMergedChunks]);

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

  const handleAddComment = async (
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
  };

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
          direction="up"
          hiddenLines={mergedChunk.hiddenLinesBefore}
          onExpandUp={() => expandLines(file, firstOriginalIndex, 'up')}
          onExpandAll={() =>
            expandAllBetweenChunks(file, firstOriginalIndex, mergedChunk.hiddenLinesBefore)
          }
          isLoading={isExpandLoading}
          header={mergedChunk.header}
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
          header={mergedChunk.header}
        />
      );
    }

    if (position === 'bottom' && mergedChunk.hiddenLinesAfter > 0) {
      return (
        <ExpandButton
          direction="down"
          hiddenLines={mergedChunk.hiddenLinesAfter}
          onExpandDown={() => expandLines(file, lastOriginalIndex, 'down')}
          onExpandAll={() =>
            expandLines(file, lastOriginalIndex, 'down', mergedChunk.hiddenLinesAfter)
          }
          isLoading={isExpandLoading}
          alignRight
        />
      );
    }

    return null;
  };

  return (
    <div className="bg-github-bg-primary">
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
          : mergedChunks.map((mergedChunk, mergedIndex) => {
              const isFirstMerged = mergedIndex === 0;
              const isLastMerged = mergedIndex === mergedChunks.length - 1;
              const firstOriginalIndex = mergedChunk.originalIndices[0] ?? 0;
              const lastOriginalIndex =
                mergedChunk.originalIndices[mergedChunk.originalIndices.length - 1] ?? 0;
              // Show bottom border only if there's a gap after this merged chunk
              const showBottomBorder = isLastMerged || mergedChunk.hiddenLinesAfter > 0;
              // Calculate if connected to previous chunk (#3 - fix hardcoded false)
              const isConnectedToPrevious = !isFirstMerged && mergedChunk.hiddenLinesBefore === 0;

              return (
                <React.Fragment key={mergedIndex}>
                  {/* First merged chunk: show header only when not starting from line 1 (#9) */}
                  {shouldShowHeaderAtStart(
                    isFirstMerged,
                    mergedChunk.hiddenLinesBefore,
                    mergedChunk.oldStart
                  ) && (
                    <div className="bg-github-bg-tertiary px-3 py-2 border-b border-github-border">
                      <code className="text-github-text-secondary text-xs font-mono">
                        {mergedChunk.header}
                      </code>
                    </div>
                  )}

                  {/* Expand button with header before first merged chunk (file start) */}
                  {isFirstMerged &&
                    renderExpandButton('top', mergedChunk, firstOriginalIndex, lastOriginalIndex)}

                  {/* Expand button with header between merged chunks */}
                  {!isFirstMerged &&
                    renderExpandButton(
                      'middle',
                      mergedChunk,
                      firstOriginalIndex,
                      lastOriginalIndex
                    )}

                  <div
                    id={`chunk-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}-${mergedIndex}`}
                    className={showBottomBorder ? 'border-b border-github-border' : ''}
                  >
                    <DiffChunk
                      chunk={mergedChunk}
                      chunkIndex={mergedIndex}
                      comments={comments}
                      onAddComment={(line, body, codeContent, side) =>
                        handleAddComment(line, body, codeContent, mergedChunk.header, side)
                      }
                      onGeneratePrompt={onGeneratePrompt}
                      onRemoveComment={onRemoveComment}
                      onUpdateComment={onUpdateComment}
                      mode={diffMode}
                      syntaxTheme={syntaxTheme}
                      cursor={cursor}
                      fileIndex={fileIndex}
                      onLineClick={onLineClick}
                      commentTrigger={
                        (
                          commentTrigger &&
                          mergedChunk.originalIndices.includes(commentTrigger.chunkIndex)
                        ) ?
                          commentTrigger
                        : null
                      }
                      onCommentTriggerHandled={onCommentTriggerHandled}
                      filename={file.path}
                      isConnectedToPrevious={isConnectedToPrevious}
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
}
