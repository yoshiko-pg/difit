import React, { useState, useEffect, useCallback } from 'react';

import {
  type DiffChunk as DiffChunkType,
  type DiffLine,
  type Comment,
  type LineNumber,
} from '../../types/diff';

import { CommentForm } from './CommentForm';
import { DiffLineRow } from './DiffLineRow';
import { InlineComment } from './InlineComment';
import type { AppearanceSettings } from './SettingsModal';
import { SideBySideDiffChunk } from './SideBySideDiffChunk';

interface DiffChunkProps {
  chunk: DiffChunkType;
  comments: Comment[];
  onAddComment: (line: LineNumber, body: string, codeContent?: string) => Promise<void>;
  onGeneratePrompt: (comment: Comment) => string;
  onRemoveComment: (commentId: string) => void;
  onUpdateComment: (commentId: string, newBody: string) => void;
  mode?: 'side-by-side' | 'inline';
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
}

export function DiffChunk({
  chunk,
  comments,
  onAddComment,
  onGeneratePrompt,
  onRemoveComment,
  onUpdateComment,
  mode = 'inline',
  syntaxTheme,
}: DiffChunkProps) {
  const [startLine, setStartLine] = useState<number | null>(null);
  const [endLine, setEndLine] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [commentingLine, setCommentingLine] = useState<LineNumber | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

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
        await onAddComment(commentingLine, body);
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

  // Use side-by-side component for side-by-side mode
  if (mode === 'side-by-side') {
    return (
      <SideBySideDiffChunk
        chunk={chunk}
        comments={comments}
        onAddComment={onAddComment}
        onGeneratePrompt={onGeneratePrompt}
        onRemoveComment={onRemoveComment}
        onUpdateComment={onUpdateComment}
        syntaxTheme={syntaxTheme}
      />
    );
  }

  return (
    <div className="bg-github-bg-primary">
      <table className="w-full border-collapse font-mono text-xs leading-5">
        <tbody>
          {chunk.lines.map((line, index) => {
            const lineComments = getCommentsForLine(line.newLineNumber || line.oldLineNumber || 0);

            return (
              <React.Fragment key={index}>
                <DiffLineRow
                  line={line}
                  index={index}
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
                          <div className={`${layout === 'full' ? 'w-full' : 'w-1/2'}`}>
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
                      <td colSpan={3} className="p-0 border-t border-[var(--border-muted)]">
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
