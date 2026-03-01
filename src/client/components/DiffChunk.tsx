import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';

import {
  type DiffChunk as DiffChunkType,
  type DiffLine,
  type DiffSide,
  type Comment,
  type LineNumber,
  type DiffViewMode,
  type VirtualDiffRow,
} from '../../types/diff';
import { DEFAULT_DIFF_VIEW_MODE } from '../../utils/diffMode';
import { NAVIGATION_SELECTORS } from '../constants/navigation';
import { type CursorPosition } from '../hooks/keyboardNavigation';
import { registerVirtualRowScrollHandlers } from '../utils/virtualScrollRegistry';
import {
  computeWordLevelDiff,
  shouldComputeWordDiff,
  type DiffSegment,
} from '../utils/wordLevelDiff';

import { CommentForm } from './CommentForm';
import { DiffLineRow } from './DiffLineRow';
import { InlineComment } from './InlineComment';
import type { AppearanceSettings } from './SettingsModal';
import { SideBySideDiffChunk } from './SideBySideDiffChunk';

interface DiffChunkProps {
  chunk: DiffChunkType;
  chunkIndex: number;
  comments: Comment[];
  onAddComment: (
    line: LineNumber,
    body: string,
    codeContent?: string,
    side?: DiffSide,
  ) => Promise<void>;
  onGeneratePrompt: (comment: Comment) => string;
  onRemoveComment: (commentId: string) => void;
  onUpdateComment: (commentId: string, newBody: string) => void;
  mode?: DiffViewMode;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
  cursor?: CursorPosition | null;
  fileIndex?: number;
  onLineClick?: (
    fileIndex: number,
    chunkIndex: number,
    lineIndex: number,
    side: 'left' | 'right',
  ) => void;
  commentTrigger?: { fileIndex: number; chunkIndex: number; lineIndex: number } | null;
  onCommentTriggerHandled?: () => void;
  filename?: string;
  onOpenInEditor?: (filePath: string, lineNumber: number) => void;
}

type UnifiedVirtualLineRow = {
  type: 'line';
  virtual: VirtualDiffRow;
  line: DiffLine;
  lineIndex: number;
  lineId: string;
  lineComments: Comment[];
  commentLayout: 'left' | 'right' | 'full';
  currentLineNumber: number;
  currentLineSide: DiffSide;
  isCurrentLine: boolean;
};

type UnifiedVirtualCommentRow = {
  type: 'comment';
  virtual: VirtualDiffRow;
  line: DiffLine;
  comment: Comment;
  layout: 'left' | 'right' | 'full';
};

type UnifiedVirtualCommentFormRow = {
  type: 'commentForm';
  virtual: VirtualDiffRow;
  line: DiffLine;
  layout: 'left' | 'right' | 'full';
};

type UnifiedRenderableRow =
  | UnifiedVirtualLineRow
  | UnifiedVirtualCommentRow
  | UnifiedVirtualCommentFormRow;

const UNIFIED_VIRTUALIZATION_ROW_THRESHOLD = 180;
const ESTIMATED_ROW_HEIGHTS = {
  line: 24,
  comment: 120,
  commentForm: 230,
} as const;

export const DiffChunk = memo(function DiffChunk({
  chunk,
  chunkIndex,
  comments,
  onAddComment,
  onGeneratePrompt,
  onRemoveComment,
  onUpdateComment,
  mode = DEFAULT_DIFF_VIEW_MODE,
  syntaxTheme,
  cursor = null,
  fileIndex = 0,
  onLineClick,
  commentTrigger,
  onCommentTriggerHandled,
  filename,
  onOpenInEditor,
}: DiffChunkProps) {
  const [startLine, setStartLine] = useState<number | null>(null);
  const [endLine, setEndLine] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [commentingLine, setCommentingLine] = useState<{
    side: DiffSide;
    lineNumber: LineNumber;
  } | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  // Handle comment trigger from keyboard navigation
  useEffect(() => {
    if (commentTrigger?.lineIndex !== undefined) {
      const line = chunk.lines[commentTrigger.lineIndex];
      if (line) {
        const lineNumber = line.newLineNumber || line.oldLineNumber;
        const side: DiffSide = line.type === 'delete' ? 'old' : 'new';
        if (lineNumber) {
          setCommentingLine({ side, lineNumber });
          onCommentTriggerHandled?.();
        }
      }
    }
  }, [commentTrigger, chunk.lines, onCommentTriggerHandled]);

  // Global mouse up handler for drag selection
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
        setStartLine(null);
        setEndLine(null);
      };

      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
    return undefined;
  }, [isDragging]);

  const handleAddComment = useCallback(
    (side: DiffSide, lineNumber: LineNumber) => {
      if (commentingLine?.side === side && commentingLine?.lineNumber === lineNumber) {
        setCommentingLine(null);
      } else {
        setCommentingLine({ side, lineNumber });
      }
    },
    [commentingLine],
  );

  const handleCancelComment = useCallback(() => {
    setCommentingLine(null);
  }, []);

  // Get the code content for the selected lines (for suggestion feature)
  const getSelectedCodeContent = useCallback((): string => {
    if (!commentingLine) return '';

    const { side, lineNumber } = commentingLine;
    const lines = chunk.lines;

    if (typeof lineNumber === 'number') {
      // Single line
      const line = lines.find((l) =>
        side === 'old' ? l.oldLineNumber === lineNumber : l.newLineNumber === lineNumber,
      );
      return line?.content?.replace(/^[+-]/, '') || '';
    } else {
      // Range of lines
      const [start, end] = lineNumber;
      const selectedLines = lines.filter((l) => {
        const ln = side === 'old' ? l.oldLineNumber : l.newLineNumber;
        return ln !== undefined && ln >= start && ln <= end;
      });
      return selectedLines.map((l) => l.content?.replace(/^[+-]/, '') || '').join('\n');
    }
  }, [commentingLine, chunk.lines]);

  const handleSubmitComment = useCallback(
    async (body: string) => {
      if (commentingLine !== null) {
        const codeContent = getSelectedCodeContent();
        await onAddComment(
          commentingLine.lineNumber,
          body,
          codeContent || undefined,
          commentingLine.side,
        );
        setCommentingLine(null);
      }
    },
    [commentingLine, onAddComment, getSelectedCodeContent],
  );

  const getCommentsForLine = useCallback(
    (lineNumber: number, side: DiffSide) => {
      return comments.filter((c) => {
        // Check if line number matches (single line or end of range)
        const lineMatches = Array.isArray(c.line)
          ? c.line[1] === lineNumber
          : c.line === lineNumber;

        // Filter by side - if comment has no side (legacy), show on new side only
        const sideMatches = !c.side || c.side === side;

        return lineMatches && sideMatches;
      });
    },
    [comments],
  );

  const getCommentLayout = useCallback(
    (line: DiffLine): 'left' | 'right' | 'full' => {
      // In unified mode, always use full width for comments
      if (mode === 'unified') {
        return 'full';
      }

      switch (line.type) {
        case 'delete':
          return 'left';
        case 'add':
          return 'right';
        default:
          return 'full';
      }
    },
    [mode],
  );

  const getSelectedLineStyle = useCallback(
    (lineNumber: number | undefined, side: DiffSide): string => {
      if (!lineNumber) {
        return '';
      }

      // Show selection during drag
      if (isDragging && startLine && endLine) {
        const min = Math.min(startLine, endLine);
        const max = Math.max(startLine, endLine);
        if (lineNumber >= min && lineNumber <= max) {
          let classes =
            'after:bg-blue-100 after:absolute after:inset-0 after:opacity-30 after:border-l-4 after:border-blue-500 after:pointer-events-none';
          // Add top border for first line
          if (lineNumber === min) {
            classes += ' after:border-t-2';
          }
          // Add bottom border for last line
          if (lineNumber === max) {
            classes += ' after:border-b-2';
          }
          return classes;
        }
      }

      // Show selection for existing comment
      if (commentingLine && commentingLine.side === side) {
        const start = Array.isArray(commentingLine.lineNumber)
          ? commentingLine.lineNumber[0]
          : commentingLine.lineNumber;
        const end = Array.isArray(commentingLine.lineNumber)
          ? commentingLine.lineNumber[1]
          : commentingLine.lineNumber;
        if (lineNumber >= start && lineNumber <= end) {
          return 'after:bg-diff-selected-bg after:absolute after:inset-0 after:border-l-5 after:border-l-diff-selected-border after:pointer-events-none';
        }
      }

      return '';
    },
    [commentingLine, endLine, isDragging, startLine],
  );

  // Compute word-level diff for unified mode
  // Maps line index to diff segments for that line
  const wordLevelDiffMap = useMemo(() => {
    const map = new Map<number, DiffSegment[]>();
    const lines = chunk.lines;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line) {
        i++;
        continue;
      }

      if (line.type === 'delete') {
        // Look ahead for corresponding add lines
        let j = i + 1;
        while (j < lines.length && lines[j]?.type === 'delete') {
          j++;
        }

        const deleteLines = lines.slice(i, j);
        const deleteStartIndex = i;
        const addLines: { line: DiffLine; index: number }[] = [];

        while (j < lines.length && lines[j]?.type === 'add') {
          const addLine = lines[j];
          if (addLine) {
            addLines.push({ line: addLine, index: j });
          }
          j++;
        }

        // Pair delete and add lines and compute word-level diff
        const maxLines = Math.max(deleteLines.length, addLines.length);
        for (let k = 0; k < maxLines; k++) {
          const deleteLine = deleteLines[k];
          const addLineInfo = addLines[k];

          if (deleteLine && addLineInfo) {
            if (shouldComputeWordDiff(deleteLine.content, addLineInfo.line.content)) {
              const wordLevelDiff = computeWordLevelDiff(
                deleteLine.content,
                addLineInfo.line.content,
              );
              map.set(deleteStartIndex + k, wordLevelDiff.oldSegments);
              map.set(addLineInfo.index, wordLevelDiff.newSegments);
            }
          }
        }

        i = j;
      } else {
        i++;
      }
    }

    return map;
  }, [chunk.lines]);

  const unifiedRows = useMemo<UnifiedRenderableRow[]>(() => {
    if (mode !== 'unified') {
      return [];
    }

    const rows: UnifiedRenderableRow[] = [];
    const formTargetLineNumber = commentingLine
      ? Array.isArray(commentingLine.lineNumber)
        ? commentingLine.lineNumber[1]
        : commentingLine.lineNumber
      : null;

    chunk.lines.forEach((line, index) => {
      const currentLineNumber = line.newLineNumber || line.oldLineNumber || 0;
      const currentLineSide: DiffSide = line.type === 'delete' ? 'old' : 'new';
      const commentLineNumber = line.type === 'delete' ? line.oldLineNumber : line.newLineNumber;
      const commentSide: DiffSide = line.type === 'delete' ? 'old' : 'new';
      const lineComments = commentLineNumber
        ? getCommentsForLine(commentLineNumber, commentSide)
        : [];
      const lineId = `file-${fileIndex}-chunk-${chunkIndex}-line-${index}`;
      const isCurrentLine = Boolean(
        cursor && cursor.chunkIndex === chunkIndex && cursor.lineIndex === index,
      );
      const commentLayout = getCommentLayout(line);

      rows.push({
        type: 'line',
        virtual: {
          id: lineId,
          kind: 'line',
          filePath: filename || '',
          chunkIndex,
          lineIndex: index,
          estimatedHeight: ESTIMATED_ROW_HEIGHTS.line,
        },
        line,
        lineIndex: index,
        lineId,
        lineComments,
        commentLayout,
        currentLineNumber,
        currentLineSide,
        isCurrentLine,
      });

      lineComments.forEach((comment, commentIndex) => {
        rows.push({
          type: 'comment',
          virtual: {
            id: `${lineId}-comment-${comment.id}-${commentIndex}`,
            kind: 'inlineComment',
            filePath: filename || '',
            chunkIndex,
            lineIndex: index,
            estimatedHeight: ESTIMATED_ROW_HEIGHTS.comment,
          },
          line,
          comment,
          layout: commentLayout,
        });
      });

      if (
        commentingLine &&
        commentingLine.side === currentLineSide &&
        formTargetLineNumber === currentLineNumber
      ) {
        rows.push({
          type: 'commentForm',
          virtual: {
            id: `${lineId}-comment-form`,
            kind: 'commentForm',
            filePath: filename || '',
            chunkIndex,
            lineIndex: index,
            estimatedHeight: ESTIMATED_ROW_HEIGHTS.commentForm,
          },
          line,
          layout: commentLayout,
        });
      }
    });

    return rows;
  }, [
    chunk.lines,
    mode,
    commentingLine,
    cursor,
    chunkIndex,
    fileIndex,
    filename,
    getCommentsForLine,
    getCommentLayout,
  ]);

  const shouldVirtualizeUnified =
    mode === 'unified' && unifiedRows.length >= UNIFIED_VIRTUALIZATION_ROW_THRESHOLD;

  const unifiedRowVirtualizer = useVirtualizer({
    count: unifiedRows.length,
    enabled: shouldVirtualizeUnified,
    getScrollElement: () =>
      document.querySelector(NAVIGATION_SELECTORS.SCROLL_CONTAINER) as HTMLElement | null,
    estimateSize: (index) =>
      unifiedRows[index]?.virtual.estimatedHeight ?? ESTIMATED_ROW_HEIGHTS.line,
    getItemKey: (index) => unifiedRows[index]?.virtual.id ?? index,
    overscan: 24,
  });

  const lineRowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    unifiedRows.forEach((row, rowIndex) => {
      if (row.type === 'line') {
        map.set(row.lineId, rowIndex);
      }
    });
    return map;
  }, [unifiedRows]);

  useEffect(() => {
    const handlers = new Map<string, () => void>();
    lineRowIndexById.forEach((rowIndex, lineId) => {
      handlers.set(lineId, () => {
        unifiedRowVirtualizer.scrollToIndex(rowIndex, {
          align: 'center',
        });
      });
    });

    return registerVirtualRowScrollHandlers(handlers);
  }, [lineRowIndexById, unifiedRowVirtualizer]);

  const renderUnifiedRow = useCallback(
    (row: UnifiedRenderableRow, measureRef?: (node: HTMLTableRowElement | null) => void) => {
      if (row.type === 'line') {
        return (
          <DiffLineRow
            line={row.line}
            index={row.lineIndex}
            lineId={row.lineId}
            isCurrentLine={row.isCurrentLine}
            hoveredLineIndex={hoveredLine}
            selectedLineStyle={getSelectedLineStyle(
              row.line.newLineNumber || row.line.oldLineNumber,
              row.line.type === 'delete' ? 'old' : 'new',
            )}
            onMouseEnter={() => {
              setHoveredLine(row.lineIndex);
            }}
            onMouseLeave={() => setHoveredLine(null)}
            onMouseMove={() => {
              if (isDragging && startLine) {
                const lineNumber = row.line.newLineNumber || row.line.oldLineNumber;
                if (lineNumber) {
                  setEndLine(lineNumber);
                }
              }
            }}
            onCommentButtonMouseDown={(e) => {
              e.stopPropagation();
              const lineNumber = row.line.newLineNumber || row.line.oldLineNumber;
              if (lineNumber) {
                setStartLine(lineNumber);
                setEndLine(lineNumber);
                setIsDragging(true);
              }
            }}
            onCommentButtonMouseUp={(e) => {
              e.stopPropagation();
              const lineNumber = row.line.newLineNumber || row.line.oldLineNumber;
              const side: DiffSide = row.line.type === 'delete' ? 'old' : 'new';
              if (!lineNumber || !startLine) {
                setIsDragging(false);
                setStartLine(null);
                setEndLine(null);
                return;
              }

              const actualEndLine = endLine || lineNumber;
              if (startLine === actualEndLine) {
                handleAddComment(side, lineNumber);
              } else {
                const min = Math.min(startLine, actualEndLine);
                const max = Math.max(startLine, actualEndLine);
                handleAddComment(side, [min, max]);
              }

              setIsDragging(false);
              setStartLine(null);
              setEndLine(null);
            }}
            onOpenInEditor={
              onOpenInEditor &&
              filename &&
              row.line.type !== 'delete' &&
              (row.line.newLineNumber || row.line.oldLineNumber)
                ? () => {
                    const lineNumber = row.line.newLineNumber || row.line.oldLineNumber;
                    if (!lineNumber) return;
                    if (!filename) return;
                    onOpenInEditor(filename, lineNumber);
                  }
                : undefined
            }
            syntaxTheme={syntaxTheme}
            filename={filename}
            diffSegments={wordLevelDiffMap.get(row.lineIndex)}
            onClick={() => {
              // Determine the side based on line type for unified mode
              const side = row.line.type === 'delete' ? 'left' : 'right';
              onLineClick?.(fileIndex, chunkIndex, row.lineIndex, side);
            }}
            measureRef={measureRef}
          />
        );
      }

      if (row.type === 'comment') {
        return (
          <tr ref={measureRef} className="bg-github-bg-secondary">
            <td colSpan={3} className="p-0 border-t border-github-border">
              <div
                className={`flex ${
                  row.layout === 'left'
                    ? 'justify-start'
                    : row.layout === 'right'
                      ? 'justify-end'
                      : 'justify-center'
                }`}
              >
                <div className={`${row.layout === 'full' ? 'w-full' : 'w-1/2'} m-2 mx-4`}>
                  <InlineComment
                    comment={row.comment}
                    onGeneratePrompt={onGeneratePrompt}
                    onRemoveComment={onRemoveComment}
                    onUpdateComment={onUpdateComment}
                    syntaxTheme={syntaxTheme}
                  />
                </div>
              </div>
            </td>
          </tr>
        );
      }

      return (
        <tr ref={measureRef} className="bg-[var(--bg-secondary)]">
          <td colSpan={3} className="p-0">
            <div
              className={`flex ${
                row.layout === 'left'
                  ? 'justify-start'
                  : row.layout === 'right'
                    ? 'justify-end'
                    : 'justify-center'
              }`}
            >
              <div className={`${row.layout === 'full' ? 'w-full' : 'w-1/2'}`}>
                <CommentForm
                  onSubmit={handleSubmitComment}
                  onCancel={handleCancelComment}
                  selectedCode={getSelectedCodeContent()}
                  syntaxTheme={syntaxTheme}
                  filename={filename}
                />
              </div>
            </div>
          </td>
        </tr>
      );
    },
    [
      chunkIndex,
      endLine,
      fileIndex,
      filename,
      getSelectedCodeContent,
      getSelectedLineStyle,
      handleAddComment,
      handleCancelComment,
      handleSubmitComment,
      hoveredLine,
      isDragging,
      onGeneratePrompt,
      onLineClick,
      onOpenInEditor,
      onRemoveComment,
      onUpdateComment,
      startLine,
      syntaxTheme,
      wordLevelDiffMap,
    ],
  );

  // Use side-by-side component for split mode
  if (mode === 'split') {
    return (
      <SideBySideDiffChunk
        chunk={chunk}
        chunkIndex={chunkIndex}
        comments={comments}
        onAddComment={onAddComment}
        onGeneratePrompt={onGeneratePrompt}
        onRemoveComment={onRemoveComment}
        onUpdateComment={onUpdateComment}
        onOpenInEditor={onOpenInEditor}
        syntaxTheme={syntaxTheme}
        cursor={cursor}
        fileIndex={fileIndex}
        onLineClick={onLineClick}
        filename={filename}
        commentTrigger={commentTrigger}
        onCommentTriggerHandled={onCommentTriggerHandled}
      />
    );
  }

  const virtualItems = shouldVirtualizeUnified ? unifiedRowVirtualizer.getVirtualItems() : [];
  const paddingTop =
    shouldVirtualizeUnified && virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    shouldVirtualizeUnified && virtualItems.length > 0
      ? unifiedRowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  return (
    <div className="bg-github-bg-primary">
      <table className="w-full table-fixed border-collapse font-mono text-sm leading-5">
        <tbody>
          {shouldVirtualizeUnified && paddingTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={3} className="p-0 border-0" style={{ height: `${paddingTop}px` }} />
            </tr>
          )}

          {shouldVirtualizeUnified
            ? virtualItems.map((virtualItem) => {
                const row = unifiedRows[virtualItem.index];
                if (!row) {
                  return null;
                }

                return (
                  <React.Fragment key={row.virtual.id}>
                    {renderUnifiedRow(row, unifiedRowVirtualizer.measureElement)}
                  </React.Fragment>
                );
              })
            : unifiedRows.map((row) => (
                <React.Fragment key={row.virtual.id}>{renderUnifiedRow(row)}</React.Fragment>
              ))}

          {shouldVirtualizeUnified && paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={3} className="p-0 border-0" style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});
