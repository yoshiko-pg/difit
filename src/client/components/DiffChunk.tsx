import React, { useState, useEffect, useCallback, useMemo } from 'react';

import {
  type DiffChunk as DiffChunkType,
  type DiffLine,
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
    side?: 'old' | 'new'
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

export function DiffChunk({
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
  const [commentingLine, setCommentingLine] = useState<LineNumber | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  // Handle comment trigger from keyboard navigation
  useEffect(() => {
    if (commentTrigger?.lineIndex !== undefined) {
      const line = chunk.lines[commentTrigger.lineIndex];
      if (line) {
        const lineNumber = line.newLineNumber || line.oldLineNumber;
        if (lineNumber) {
          setCommentingLine(lineNumber);
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
    (lineNumber: LineNumber) => {
      if (commentingLine === lineNumber) {
        setCommentingLine(null);
      } else {
        setCommentingLine(lineNumber);
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
        // Determine side based on the lines being commented
        let side: 'old' | 'new' | undefined = undefined;

        if (Array.isArray(commentingLine)) {
          // For multi-line comments, check the lines in the range
          const startLine = commentingLine[0];
          const endLine = commentingLine[1];
          const linesInRange = chunk.lines.filter((line) => {
            const lineNum = line.newLineNumber || line.oldLineNumber;
            return lineNum && lineNum >= startLine && lineNum <= endLine;
          });

          // Determine side based on line types in range
          const hasOldLines = linesInRange.some(
            (l) => l.type === 'delete' || (l.type === 'normal' && l.oldLineNumber)
          );
          const hasNewLines = linesInRange.some(
            (l) => l.type === 'add' || (l.type === 'normal' && l.newLineNumber)
          );

          if (hasOldLines && !hasNewLines) {
            side = 'old';
          } else if (hasNewLines) {
            side = 'new';
          }
        } else {
          // For single line comments
          const line = chunk.lines.find(
            (l) => l.newLineNumber === commentingLine || l.oldLineNumber === commentingLine
          );
          if (line) {
            if (line.type === 'delete') {
              side = 'old';
            } else if (line.type === 'add' || line.type === 'normal') {
              side = 'new';
            }
          }
        }

        await onAddComment(commentingLine, body, undefined, side);
        setCommentingLine(null);
      }
    },
    [commentingLine, onAddComment, chunk.lines]
  );

  const getCommentsForLine = (lineNumber: number) => {
    return comments.filter((c) =>
      Array.isArray(c.line) ? c.line[1] === lineNumber : c.line === lineNumber
    );
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

  const getSelectedLineStyle = (lineNumber: number | undefined): string => {
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
    if (commentingLine) {
      const start = Array.isArray(commentingLine) ? commentingLine[0] : commentingLine;
      const end = Array.isArray(commentingLine) ? commentingLine[1] : commentingLine;
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
      <table className="w-full border-collapse font-mono text-sm leading-5">
        <tbody>
          {chunk.lines.map((line, index) => {
            const lineComments = getCommentsForLine(line.newLineNumber || line.oldLineNumber || 0);
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
                  hoveredLine={hoveredLine}
                  selectedLineStyle={getSelectedLineStyle(line.newLineNumber || line.oldLineNumber)}
                  onMouseEnter={() => {
                    const lineNumber = line.newLineNumber || line.oldLineNumber;
                    if (lineNumber) {
                      setHoveredLine(lineNumber);
                    }
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
                    if (!lineNumber || !startLine) {
                      setIsDragging(false);
                      setStartLine(null);
                      setEndLine(null);
                      return;
                    }

                    const actualEndLine = endLine || lineNumber;
                    if (startLine === actualEndLine) {
                      handleAddComment(lineNumber);
                    } else {
                      const min = Math.min(startLine, actualEndLine);
                      const max = Math.max(startLine, actualEndLine);
                      handleAddComment([min, max]);
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
                  (commentingLine === (line.newLineNumber || line.oldLineNumber) ||
                    (Array.isArray(commentingLine) &&
                      commentingLine[1] === (line.newLineNumber || line.oldLineNumber))) && (
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
}
