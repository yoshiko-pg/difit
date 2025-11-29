import React, { useState, useEffect, useCallback, useMemo } from 'react';

import {
  type DiffChunk as DiffChunkType,
  type DiffLine,
  type Comment,
  type LineNumber,
  type LineSelection,
} from '../../types/diff';
import { type CursorPosition } from '../hooks/keyboardNavigation';
import {
  computeWordLevelDiff,
  shouldComputeWordDiff,
  type WordLevelDiffResult,
} from '../utils/wordLevelDiff';

import { CommentButton } from './CommentButton';
import { CommentForm } from './CommentForm';
import { EnhancedPrismSyntaxHighlighter } from './EnhancedPrismSyntaxHighlighter';
import { InlineComment } from './InlineComment';
import type { AppearanceSettings } from './SettingsModal';
import { WordLevelDiffHighlighter } from './WordLevelDiffHighlighter';

interface SideBySideDiffChunkProps {
  chunk: DiffChunkType;
  chunkIndex: number;
  comments: Comment[];
  onAddComment: (
    line: LineNumber,
    body: string,
    codeContent?: string,
    side?: 'old' | 'new'
  ) => Promise<void>;
  onGeneratePrompt: (comment: Comment) => string;
  onRemoveComment: (commentId: string) => void;
  onUpdateComment: (commentId: string, newBody: string) => void;
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

interface SideBySideLine {
  oldLine?: DiffLine;
  newLine?: DiffLine;
  oldLineNumber?: number;
  newLineNumber?: number;
  oldLineOriginalIndex?: number;
  newLineOriginalIndex?: number;
  wordLevelDiff?: WordLevelDiffResult;
}

export function SideBySideDiffChunk({
  chunk,
  chunkIndex,
  comments,
  onAddComment,
  onGeneratePrompt,
  onRemoveComment,
  onUpdateComment,
  syntaxTheme,
  cursor = null,
  fileIndex = 0,
  onLineClick,
  commentTrigger,
  onCommentTriggerHandled,
  filename,
}: SideBySideDiffChunkProps) {
  const [startLine, setStartLine] = useState<LineSelection | null>(null);
  const [endLine, setEndLine] = useState<LineSelection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [commentingLine, setCommentingLine] = useState<{
    side: 'old' | 'new';
    lineNumber: LineNumber;
  } | null>(null);
  const [hoveredLine, setHoveredLine] = useState<LineSelection | null>(null);

  // Handle comment trigger from keyboard navigation
  useEffect(() => {
    if (commentTrigger?.lineIndex !== undefined) {
      const line = chunk.lines[commentTrigger.lineIndex];
      if (line && line.type !== 'delete') {
        const lineNumber = line.newLineNumber;
        if (lineNumber) {
          setCommentingLine({ side: 'new', lineNumber });
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
    (side: 'old' | 'new', lineNumber: LineNumber) => {
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

  const getCommentsForLine = (lineNumber: number) => {
    return comments.filter((c) =>
      Array.isArray(c.line) ? c.line[1] === lineNumber : c.line === lineNumber
    );
  };

  const getCommentLayout = (sideLine: SideBySideLine): 'left' | 'right' | 'full' => {
    // サイドバイサイドでは、削除行側（左）にコメントがある場合は左半分、
    // 追加行側（右）にコメントがある場合は右半分、
    // 変更なし行の場合は全幅で表示
    if (sideLine.oldLine?.type === 'delete' && sideLine.newLine?.type === 'add') {
      // 変更行の場合、newLineNumberを使って判定
      return sideLine.newLineNumber ? 'right' : 'left';
    }
    if (sideLine.oldLine?.type === 'delete') {
      return 'left';
    }
    if (sideLine.newLine?.type === 'add') {
      return 'right';
    }
    return 'full';
  };

  const getSelectedLineStyle = (side: 'old' | 'new', sideLine: SideBySideLine): string => {
    const lineNumber = side === 'old' ? sideLine.oldLineNumber : sideLine.newLineNumber;
    if (!lineNumber) {
      return '';
    }

    // Show selection during drag
    if (isDragging && startLine && endLine && startLine.side === side && endLine.side === side) {
      const min = Math.min(startLine.lineNumber, endLine.lineNumber);
      const max = Math.max(startLine.lineNumber, endLine.lineNumber);
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
      const lineNumberRange =
        Array.isArray(commentingLine.lineNumber) ?
          commentingLine.lineNumber
        : [commentingLine.lineNumber, commentingLine.lineNumber];
      const start = lineNumberRange[0];
      const end = lineNumberRange[1];

      if (start !== undefined && end !== undefined && lineNumber >= start && lineNumber <= end) {
        return 'after:bg-diff-selected-bg after:absolute after:inset-0 after:border-l-5 after:border-l-diff-selected-border after:pointer-events-none';
      }
    }

    return '';
  };

  // Convert unified diff to side-by-side format
  const convertToSideBySide = useCallback((lines: DiffLine[]): SideBySideLine[] => {
    const result: SideBySideLine[] = [];
    let oldLineNum = chunk.oldStart;
    let newLineNum = chunk.newStart;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line) {
        i++;
        continue;
      }

      if (line.type === 'normal') {
        result.push({
          oldLine: line,
          newLine: { ...line },
          oldLineNumber: line.oldLineNumber ?? oldLineNum,
          newLineNumber: line.newLineNumber ?? newLineNum,
          oldLineOriginalIndex: i,
          newLineOriginalIndex: i,
        });
        oldLineNum++;
        newLineNum++;
        i++;
      } else if (line.type === 'delete') {
        // Look ahead for corresponding add
        let j = i + 1;
        while (j < lines.length && lines[j]?.type === 'delete') {
          j++;
        }

        const deleteLines = lines.slice(i, j);
        const deleteStartIndex = i;
        const addLines: DiffLine[] = [];
        const addStartIndex = j;

        // Collect corresponding add lines
        while (j < lines.length && lines[j]?.type === 'add') {
          const addLine = lines[j];
          if (addLine) {
            addLines.push(addLine);
          }
          j++;
        }

        // Pair delete and add lines
        const maxLines = Math.max(deleteLines.length, addLines.length);
        for (let k = 0; k < maxLines; k++) {
          const deleteLine = deleteLines[k];
          const addLine = addLines[k];

          // Compute word-level diff if both lines exist
          let wordLevelDiff: WordLevelDiffResult | undefined;
          if (deleteLine && addLine) {
            if (shouldComputeWordDiff(deleteLine.content, addLine.content)) {
              wordLevelDiff = computeWordLevelDiff(deleteLine.content, addLine.content);
            }
          }

          result.push({
            oldLine: deleteLine,
            newLine: addLine,
            oldLineNumber: deleteLine ? (deleteLine.oldLineNumber ?? oldLineNum + k) : undefined,
            newLineNumber: addLine ? (addLine.newLineNumber ?? newLineNum + k) : undefined,
            oldLineOriginalIndex: deleteLine ? deleteStartIndex + k : undefined,
            newLineOriginalIndex: addLine ? addStartIndex + k : undefined,
            wordLevelDiff,
          });
        }

        oldLineNum += deleteLines.length;
        newLineNum += addLines.length;
        i = j;
      } else if (line.type === 'add') {
        result.push({
          newLine: line,
          newLineNumber: line.newLineNumber ?? newLineNum,
          newLineOriginalIndex: i,
        });
        newLineNum++;
        i++;
      }
    }

    return result;
  }, [chunk.oldStart, chunk.newStart]);

  const sideBySideLines = useMemo(
    () => convertToSideBySide(chunk.lines),
    [chunk.lines, convertToSideBySide]
  );

  return (
    <div className="bg-github-bg-primary border border-github-border rounded-md overflow-hidden">
      <table className="w-full border-collapse font-mono text-sm leading-5">
        <tbody>
          {sideBySideLines.map((sideLine, index) => {
            // For side-by-side view, only show comments on the right side (new line numbers)
            // to avoid duplication. Comments are associated with line numbers and should
            // only be displayed once per line number.
            const allComments =
              sideLine.newLineNumber ? getCommentsForLine(sideLine.newLineNumber)
              : sideLine.oldLineNumber ? getCommentsForLine(sideLine.oldLineNumber)
              : [];

            // Use the stored original indices
            const oldLineOriginalIndex = sideLine.oldLineOriginalIndex ?? -1;
            const newLineOriginalIndex = sideLine.newLineOriginalIndex ?? -1;

            // Check if the current side's line matches the cursor position
            const isHighlighted = (() => {
              if (!cursor) return false;

              // Only highlight the line on the current side
              if (cursor.side === 'left' && oldLineOriginalIndex >= 0) {
                return (
                  cursor.chunkIndex === chunkIndex && cursor.lineIndex === oldLineOriginalIndex
                );
              } else if (cursor.side === 'right' && newLineOriginalIndex >= 0) {
                return (
                  cursor.chunkIndex === chunkIndex && cursor.lineIndex === newLineOriginalIndex
                );
              }

              return false;
            })();

            // Generate IDs for navigation with side suffix
            const oldLineNavId =
              oldLineOriginalIndex >= 0 ?
                `file-${fileIndex}-chunk-${chunkIndex}-line-${oldLineOriginalIndex}-left`
              : undefined;
            const newLineNavId =
              newLineOriginalIndex >= 0 ?
                `file-${fileIndex}-chunk-${chunkIndex}-line-${newLineOriginalIndex}-right`
              : undefined;

            // Determine which cell to highlight
            const highlightOldCell = isHighlighted && cursor?.side === 'left';
            const highlightNewCell = isHighlighted && cursor?.side === 'right';

            const cellHighlightClass = 'keyboard-cursor';

            return (
              <React.Fragment key={index}>
                <tr
                  className="group cursor-pointer"
                  onClick={(e) => {
                    if (!isDragging) {
                      const target = e.target as HTMLElement;
                      const isInOldSide =
                        target.closest('td:nth-child(1)') || target.closest('td:nth-child(2)');
                      const isInNewSide =
                        target.closest('td:nth-child(3)') || target.closest('td:nth-child(4)');

                      if (isInOldSide && oldLineOriginalIndex >= 0) {
                        onLineClick?.(fileIndex, chunkIndex, oldLineOriginalIndex, 'left');
                      } else if (isInNewSide && newLineOriginalIndex >= 0) {
                        onLineClick?.(fileIndex, chunkIndex, newLineOriginalIndex, 'right');
                      }
                    }
                  }}
                  onMouseEnter={(e) => {
                    const target = e.target as HTMLElement;
                    const isInOldSide =
                      target.closest('td:nth-child(1)') || target.closest('td:nth-child(2)');
                    const isInNewSide =
                      target.closest('td:nth-child(3)') || target.closest('td:nth-child(4)');

                    if (isInOldSide && sideLine.oldLineNumber) {
                      setHoveredLine({ side: 'old', lineNumber: sideLine.oldLineNumber });
                    } else if (isInNewSide && sideLine.newLineNumber) {
                      setHoveredLine({ side: 'new', lineNumber: sideLine.newLineNumber });
                    }
                  }}
                  onMouseMove={(e) => {
                    const target = e.target as HTMLElement;
                    const isInOldSide =
                      target.closest('td:nth-child(1)') || target.closest('td:nth-child(2)');
                    const isInNewSide =
                      target.closest('td:nth-child(3)') || target.closest('td:nth-child(4)');

                    // Update hover state based on mouse position
                    if (isInOldSide && sideLine.oldLineNumber) {
                      if (
                        hoveredLine?.side !== 'old' ||
                        hoveredLine?.lineNumber !== sideLine.oldLineNumber
                      ) {
                        setHoveredLine({ side: 'old', lineNumber: sideLine.oldLineNumber });
                      }
                    } else if (isInNewSide && sideLine.newLineNumber) {
                      if (
                        hoveredLine?.side !== 'new' ||
                        hoveredLine?.lineNumber !== sideLine.newLineNumber
                      ) {
                        setHoveredLine({ side: 'new', lineNumber: sideLine.newLineNumber });
                      }
                    }

                    // Handle dragging
                    if (isDragging && startLine) {
                      if (startLine.side === 'old' && sideLine.oldLineNumber) {
                        setEndLine({ side: 'old', lineNumber: sideLine.oldLineNumber });
                      } else if (startLine.side === 'new' && sideLine.newLineNumber) {
                        setEndLine({ side: 'new', lineNumber: sideLine.newLineNumber });
                      }
                    }
                  }}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {/* Old side */}
                  <td
                    id={oldLineNavId}
                    className={`w-[60px] px-2 text-right text-github-text-muted bg-github-bg-secondary border-r border-github-border select-none align-top relative overflow-visible ${highlightOldCell ? cellHighlightClass : ''}`}
                  >
                    <span className="pr-5">{sideLine.oldLineNumber || ''}</span>
                    {hoveredLine?.side === 'old' &&
                      hoveredLine?.lineNumber === sideLine.oldLineNumber && (
                        <CommentButton
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (sideLine.oldLineNumber) {
                              setStartLine({ side: 'old', lineNumber: sideLine.oldLineNumber });
                              setEndLine({ side: 'old', lineNumber: sideLine.oldLineNumber });
                              setIsDragging(true);
                            }
                          }}
                          onMouseUp={(e) => {
                            e.stopPropagation();
                            if (!sideLine.oldLineNumber || !startLine) {
                              setIsDragging(false);
                              setStartLine(null);
                              setEndLine(null);
                              return;
                            }

                            const actualEndLine =
                              endLine && endLine.side === 'old' ?
                                endLine.lineNumber
                              : sideLine.oldLineNumber;
                            if (
                              startLine.side !== 'old' ||
                              startLine.lineNumber === actualEndLine
                            ) {
                              handleAddComment('old', sideLine.oldLineNumber);
                            } else {
                              const min = Math.min(startLine.lineNumber, actualEndLine);
                              const max = Math.max(startLine.lineNumber, actualEndLine);
                              handleAddComment('old', [min, max]);
                            }

                            setIsDragging(false);
                            setStartLine(null);
                            setEndLine(null);
                          }}
                        />
                      )}
                  </td>
                  <td
                    className={`w-1/2 p-0 align-top border-r border-github-border relative ${
                      sideLine.oldLine?.type === 'delete' ? 'bg-diff-deletion-bg'
                      : sideLine.oldLine?.type === 'normal' ? 'bg-transparent'
                      : 'bg-github-bg-secondary'
                    } ${getSelectedLineStyle('old', sideLine)} ${highlightOldCell ? cellHighlightClass : ''}`}
                  >
                    {sideLine.oldLine && (
                      <div className="flex items-center relative min-h-[20px] px-3">
                        {sideLine.wordLevelDiff ? (
                          <WordLevelDiffHighlighter
                            segments={sideLine.wordLevelDiff.oldSegments}
                            className="flex-1 text-github-text-primary whitespace-pre-wrap break-all overflow-wrap-break-word select-text"
                          />
                        ) : (
                          <EnhancedPrismSyntaxHighlighter
                            code={sideLine.oldLine.content}
                            className="flex-1 text-github-text-primary whitespace-pre-wrap break-all overflow-wrap-break-word select-text [&_pre]:m-0 [&_pre]:p-0 [&_pre]:!bg-transparent [&_pre]:font-inherit [&_pre]:text-inherit [&_pre]:leading-inherit [&_code]:!bg-transparent [&_code]:font-inherit [&_code]:text-inherit [&_code]:leading-inherit"
                            syntaxTheme={syntaxTheme}
                            filename={filename}
                          />
                        )}
                      </div>
                    )}
                  </td>

                  {/* New side */}
                  <td
                    id={newLineNavId}
                    className={`w-[60px] px-2 text-right text-github-text-muted bg-github-bg-secondary border-r border-github-border select-none align-top relative overflow-visible ${highlightNewCell ? cellHighlightClass : ''}`}
                  >
                    <span className="pr-5">{sideLine.newLineNumber || ''}</span>
                    {hoveredLine?.side === 'new' &&
                      hoveredLine?.lineNumber === sideLine.newLineNumber && (
                        <CommentButton
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (sideLine.newLineNumber) {
                              setStartLine({ side: 'new', lineNumber: sideLine.newLineNumber });
                              setEndLine({ side: 'new', lineNumber: sideLine.newLineNumber });
                              setIsDragging(true);
                            }
                          }}
                          onMouseUp={(e) => {
                            e.stopPropagation();
                            if (!sideLine.newLineNumber || !startLine) {
                              setIsDragging(false);
                              setStartLine(null);
                              setEndLine(null);
                              return;
                            }

                            const actualEndLine =
                              endLine && endLine.side === 'new' ?
                                endLine.lineNumber
                              : sideLine.newLineNumber;
                            if (
                              startLine.side !== 'new' ||
                              startLine.lineNumber === actualEndLine
                            ) {
                              handleAddComment('new', sideLine.newLineNumber);
                            } else {
                              const min = Math.min(startLine.lineNumber, actualEndLine);
                              const max = Math.max(startLine.lineNumber, actualEndLine);
                              handleAddComment('new', [min, max]);
                            }

                            setIsDragging(false);
                            setStartLine(null);
                            setEndLine(null);
                          }}
                        />
                      )}
                  </td>
                  <td
                    className={`w-1/2 p-0 align-top relative ${
                      sideLine.newLine?.type === 'add' ? 'bg-diff-addition-bg'
                      : sideLine.newLine?.type === 'normal' ? 'bg-transparent'
                      : 'bg-github-bg-secondary'
                    } ${getSelectedLineStyle('new', sideLine)} ${highlightNewCell ? cellHighlightClass : ''}`}
                  >
                    {sideLine.newLine && (
                      <div className="flex items-center relative min-h-[20px] px-3">
                        {sideLine.wordLevelDiff ? (
                          <WordLevelDiffHighlighter
                            segments={sideLine.wordLevelDiff.newSegments}
                            className="flex-1 text-github-text-primary whitespace-pre-wrap break-all overflow-wrap-break-word select-text"
                          />
                        ) : (
                          <EnhancedPrismSyntaxHighlighter
                            code={sideLine.newLine.content}
                            className="flex-1 text-github-text-primary whitespace-pre-wrap break-all overflow-wrap-break-word select-text [&_pre]:m-0 [&_pre]:p-0 [&_pre]:!bg-transparent [&_pre]:font-inherit [&_pre]:text-inherit [&_pre]:leading-inherit [&_code]:!bg-transparent [&_code]:font-inherit [&_code]:text-inherit [&_code]:leading-inherit"
                            syntaxTheme={syntaxTheme}
                            filename={filename}
                          />
                        )}
                      </div>
                    )}
                  </td>
                </tr>

                {/* Comments row */}
                {allComments.length > 0 && (
                  <tr className="bg-github-bg-secondary">
                    <td colSpan={4} className="p-0 border-t border-github-border">
                      {allComments.map((comment) => {
                        const layout = getCommentLayout(sideLine);
                        return (
                          <div
                            key={comment.id}
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
                        );
                      })}
                    </td>
                  </tr>
                )}

                {/* Comment form row */}
                {commentingLine &&
                  ((commentingLine.side === 'old' &&
                    commentingLine.lineNumber === sideLine.oldLineNumber) ||
                    (commentingLine.side === 'new' &&
                      commentingLine.lineNumber === sideLine.newLineNumber) ||
                    (Array.isArray(commentingLine.lineNumber) &&
                      ((commentingLine.side === 'new' &&
                        commentingLine.lineNumber[1] === sideLine.newLineNumber) ||
                        (commentingLine.side === 'old' &&
                          commentingLine.lineNumber[1] === sideLine.oldLineNumber)))) && (
                    <tr className="bg-github-bg-secondary">
                      <td colSpan={4} className="p-0">
                        <div
                          className={`flex ${
                            getCommentLayout(sideLine) === 'left' ? 'justify-start'
                            : getCommentLayout(sideLine) === 'right' ? 'justify-end'
                            : 'justify-center'
                          }`}
                        >
                          <div
                            className={`${getCommentLayout(sideLine) === 'full' ? 'w-full' : 'w-1/2'}`}
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
}
