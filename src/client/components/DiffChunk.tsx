import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';

import {
  type DiffChunk as DiffChunkType,
  type DiffLine,
  type DiffSide,
  type Comment,
  type LineNumber,
  type DiffViewMode,
} from '../../types/diff';
import { type CursorPosition } from '../hooks/keyboardNavigation';
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
    side?: DiffSide
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
    side: 'left' | 'right'
  ) => void;
  commentTrigger?: { fileIndex: number; chunkIndex: number; lineIndex: number } | null;
  onCommentTriggerHandled?: () => void;
  filename?: string;
}

export const DiffChunk = memo(function DiffChunk({
  chunk,
  chunkIndex,
  comments,
  onAddComment,
  onGeneratePrompt,
  onRemoveComment,
  onUpdateComment,
  mode = 'inline',
  syntaxTheme,
  cursor = null,
  fileIndex = 0,
  onLineClick,
  commentTrigger,
  onCommentTriggerHandled,
  filename,
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
          // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: respond to external keyboard trigger
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
    [commentingLine]
  );

  const handleCancelComment = useCallback(() => {
    setCommentingLine(null);
  }, []);

  const handleSubmitComment = useCallback(
    async (body: string) => {
      if (commentingLine !== null) {
        await onAddComment(commentingLine.lineNumber, body, undefined, commentingLine.side);
        setCommentingLine(null);
      }
    },
    [commentingLine, onAddComment]
  );

  const getCommentsForLine = (lineNumber: number, side: DiffSide) => {
    return comments.filter((c) => {
      // Check if line number matches (single line or end of range)
      const lineMatches = Array.isArray(c.line) ? c.line[1] === lineNumber : c.line === lineNumber;

      // Filter by side - if comment has no side (legacy), show on new side only
      const sideMatches = !c.side || c.side === side;

      return lineMatches && sideMatches;
    });
  };

  const getCommentLayout = (line: DiffLine): 'left' | 'right' | 'full' => {
    // In inline mode, always use full width for comments
    if (mode === 'inline') {
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
  };

  const getSelectedLineStyle = (lineNumber: number | undefined, side: DiffSide): string => {
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
      const start =
        Array.isArray(commentingLine.lineNumber) ?
          commentingLine.lineNumber[0]
        : commentingLine.lineNumber;
      const end =
        Array.isArray(commentingLine.lineNumber) ?
          commentingLine.lineNumber[1]
        : commentingLine.lineNumber;
      if (lineNumber >= start && lineNumber <= end) {
        return 'after:bg-diff-selected-bg after:absolute after:inset-0 after:border-l-5 after:border-l-diff-selected-border after:pointer-events-none';
      }
    }

    return '';
  };

  // Compute word-level diff for inline mode
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
                addLineInfo.line.content
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

  // Use side-by-side component for side-by-side mode
  if (mode === 'side-by-side') {
    return (
      <SideBySideDiffChunk
        chunk={chunk}
        chunkIndex={chunkIndex}
        comments={comments}
        onAddComment={onAddComment}
        onGeneratePrompt={onGeneratePrompt}
        onRemoveComment={onRemoveComment}
        onUpdateComment={onUpdateComment}
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

  return (
    <div className="bg-github-bg-primary">
      <table className="w-full table-fixed border-collapse font-mono text-sm leading-5">
        <tbody>
          {chunk.lines.map((line, index) => {
            const currentLineNumber = line.newLineNumber || line.oldLineNumber || 0;
            const currentLineSide: DiffSide = line.type === 'delete' ? 'old' : 'new';
            const formTargetLineNumber =
              commentingLine ?
                Array.isArray(commentingLine.lineNumber) ?
                  commentingLine.lineNumber[1]
                : commentingLine.lineNumber
              : null;

            // Determine which line number and side to use for fetching comments
            // Delete lines: use oldLineNumber and 'old' side
            // Add/normal lines: use newLineNumber and 'new' side
            const commentLineNumber =
              line.type === 'delete' ? line.oldLineNumber : line.newLineNumber;
            const commentSide: DiffSide = line.type === 'delete' ? 'old' : 'new';
            const lineComments =
              commentLineNumber ? getCommentsForLine(commentLineNumber, commentSide) : [];
            // Generate ID for all lines to match the format used in useKeyboardNavigation
            const lineId = `file-${fileIndex}-chunk-${chunkIndex}-line-${index}`;
            const isCurrentLine =
              cursor && cursor.chunkIndex === chunkIndex && cursor.lineIndex === index;

            return (
              <React.Fragment key={index}>
                <DiffLineRow
                  line={line}
                  index={index}
                  lineId={lineId}
                  isCurrentLine={isCurrentLine || false}
                  hoveredLineIndex={hoveredLine}
                  selectedLineStyle={getSelectedLineStyle(
                    line.newLineNumber || line.oldLineNumber,
                    line.type === 'delete' ? 'old' : 'new'
                  )}
                  onMouseEnter={() => {
                    setHoveredLine(index);
                  }}
                  onMouseLeave={() => setHoveredLine(null)}
                  onMouseMove={() => {
                    if (isDragging && startLine) {
                      const lineNumber = line.newLineNumber || line.oldLineNumber;
                      if (lineNumber) {
                        setEndLine(lineNumber);
                      }
                    }
                  }}
                  onCommentButtonMouseDown={(e) => {
                    e.stopPropagation();
                    const lineNumber = line.newLineNumber || line.oldLineNumber;
                    if (lineNumber) {
                      setStartLine(lineNumber);
                      setEndLine(lineNumber);
                      setIsDragging(true);
                    }
                  }}
                  onCommentButtonMouseUp={(e) => {
                    e.stopPropagation();
                    const lineNumber = line.newLineNumber || line.oldLineNumber;
                    const side: DiffSide = line.type === 'delete' ? 'old' : 'new';
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
                  syntaxTheme={syntaxTheme}
                  filename={filename}
                  diffSegments={wordLevelDiffMap.get(index)}
                  onClick={() => {
                    // Determine the side based on line type for inline mode
                    const side = line.type === 'delete' ? 'left' : 'right';
                    onLineClick?.(fileIndex, chunkIndex, index, side);
                  }}
                />

                {lineComments.map((comment) => {
                  const layout = getCommentLayout(line);
                  return (
                    <tr key={comment.id} className="bg-github-bg-secondary">
                      <td colSpan={3} className="p-0 border-t border-github-border">
                        <div
                          className={`flex ${
                            layout === 'left' ? 'justify-start'
                            : layout === 'right' ? 'justify-end'
                            : 'justify-center'
                          }`}
                        >
                          <div className={`${layout === 'full' ? 'w-full' : 'w-1/2'} m-2 mx-4`}>
                            <InlineComment
                              comment={comment}
                              onGeneratePrompt={onGeneratePrompt}
                              onRemoveComment={onRemoveComment}
                              onUpdateComment={onUpdateComment}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {commentingLine &&
                  commentingLine.side === currentLineSide &&
                  formTargetLineNumber === currentLineNumber && (
                    <tr className="bg-[var(--bg-secondary)]">
                      <td colSpan={3} className="p-0">
                        <div
                          className={`flex ${
                            getCommentLayout(line) === 'left' ? 'justify-start'
                            : getCommentLayout(line) === 'right' ? 'justify-end'
                            : 'justify-center'
                          }`}
                        >
                          <div
                            className={`${getCommentLayout(line) === 'full' ? 'w-full' : 'w-1/2'}`}
                          >
                            <CommentForm
                              onSubmit={handleSubmitComment}
                              onCancel={handleCancelComment}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
