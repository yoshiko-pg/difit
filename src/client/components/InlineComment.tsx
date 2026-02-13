import { Check, Edit2 } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { type Comment, type DiffLine } from '../../types/diff';
import { hasSuggestionBlock, parseSuggestionBlocks } from '../../utils/suggestionUtils';

import { DiffCodeLine } from './DiffCodeLine';
import type { AppearanceSettings } from './SettingsModal';
import { SuggestionTemplateButton } from './SuggestionTemplateButton';

interface InlineCommentProps {
  comment: Comment;
  onGeneratePrompt: (comment: Comment) => string;
  onRemoveComment: (commentId: string) => void;
  onUpdateComment: (commentId: string, newBody: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
}

const getSuggestionLineTypeClass = (type: 'add' | 'delete') =>
  type === 'add' ? 'bg-diff-addition-bg' : 'bg-diff-deletion-bg';

const createSuggestionLine = (
  type: 'add' | 'delete',
  content: string,
): Pick<DiffLine, 'type' | 'content'> => ({
  type,
  content,
});

function SuggestionLines({
  code,
  type,
  filename,
  keyPrefix,
  syntaxTheme,
}: {
  code: string;
  type: 'add' | 'delete';
  filename?: string;
  keyPrefix: string;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
}) {
  return (
    <>
      {code.split('\n').map((line, index) => (
        <div key={`${keyPrefix}-${index}`} className={getSuggestionLineTypeClass(type)}>
          <DiffCodeLine
            line={createSuggestionLine(type, line)}
            filename={filename}
            syntaxTheme={syntaxTheme}
          />
        </div>
      ))}
    </>
  );
}

// Component to render suggestion blocks with GitHub-style diff view
function SuggestionBlockRenderer({
  body,
  originalCode,
  filename,
  syntaxTheme,
}: {
  body: string;
  originalCode?: string;
  filename?: string;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
}) {
  const parts = useMemo(() => {
    const suggestions = parseSuggestionBlocks(body);
    if (suggestions.length === 0) {
      return [{ type: 'text' as const, content: body }];
    }

    const result: Array<
      { type: 'text'; content: string } | { type: 'suggestion'; code: string; original: string }
    > = [];
    let lastIndex = 0;

    for (const suggestion of suggestions) {
      // Add text before the suggestion
      if (suggestion.startIndex > lastIndex) {
        result.push({
          type: 'text',
          content: body.slice(lastIndex, suggestion.startIndex),
        });
      }
      // Add the suggestion block with original code from caller context
      result.push({
        type: 'suggestion',
        code: suggestion.suggestedCode,
        original: originalCode || '',
      });
      lastIndex = suggestion.endIndex;
    }

    // Add remaining text after the last suggestion
    if (lastIndex < body.length) {
      result.push({
        type: 'text',
        content: body.slice(lastIndex),
      });
    }

    return result;
  }, [body, originalCode]);

  return (
    <div className="text-github-text-primary text-sm leading-6">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <span key={index} className="whitespace-pre-wrap">
              {part.content}
            </span>
          );
        }
        // Suggestion block with diff view
        return (
          <div key={index} className="my-2 border border-github-border rounded-md overflow-hidden">
            <div className="font-mono text-sm border-l-4 border-transparent">
              {part.original && (
                <SuggestionLines
                  code={part.original}
                  type="delete"
                  filename={filename}
                  keyPrefix={`orig-${index}`}
                  syntaxTheme={syntaxTheme}
                />
              )}
              <SuggestionLines
                code={part.code}
                type="add"
                filename={filename}
                keyPrefix={`sugg-${index}`}
                syntaxTheme={syntaxTheme}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function InlineComment({
  comment,
  onGeneratePrompt,
  onRemoveComment,
  onUpdateComment,
  onClick,
  syntaxTheme,
}: InlineCommentProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(comment.body);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const prompt = onGeneratePrompt(comment);
      await navigator.clipboard.writeText(prompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedBody(comment.body);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedBody(comment.body);
  };

  const handleSaveEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editedBody.trim() !== comment.body) {
      onUpdateComment(comment.id, editedBody.trim());
    }
    setIsEditing(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveComment(comment.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Keyboard shortcuts for editing
  useHotkeys(
    'escape',
    () => {
      if (isEditing) {
        handleCancelEdit();
      }
    },
    { enableOnFormTags: ['textarea'], enabled: isEditing },
    [isEditing],
  );

  useHotkeys(
    'mod+enter',
    () => {
      if (isEditing) {
        handleSaveEdit();
      }
    },
    { enableOnFormTags: ['textarea'], enabled: isEditing },
    [isEditing, editedBody, comment.body],
  );

  return (
    <div
      id={`comment-${comment.id}`}
      className={`p-3 bg-github-bg-tertiary border border-yellow-600/50 rounded-md border-l-4 border-l-yellow-400 shadow-sm transition-all ${
        onClick ? 'hover:shadow-md cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="flex items-center gap-2 text-xs text-github-text-secondary flex-1 min-w-0">
          <span
            className="font-mono px-1 py-0.5 rounded overflow-hidden text-ellipsis whitespace-nowrap"
            style={{
              backgroundColor: 'var(--color-yellow-path-bg)',
              color: 'var(--color-yellow-path-text)',
            }}
          >
            {comment.file}:
            {Array.isArray(comment.line) ? `${comment.line[0]}-${comment.line[1]}` : comment.line}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ?
            <div onClick={(e) => e.stopPropagation()}>
              <SuggestionTemplateButton
                selectedCode={comment.codeContent}
                value={editedBody}
                onChange={setEditedBody}
                textareaRef={editTextareaRef}
              />
            </div>
          : <>
              <button
                onClick={handleCopyPrompt}
                className="text-xs px-2 py-1 rounded transition-all whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--color-yellow-btn-bg)',
                  color: 'var(--color-yellow-btn-text)',
                  border: '1px solid var(--color-yellow-btn-border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-yellow-btn-hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--color-yellow-btn-hover-border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-yellow-btn-bg)';
                  e.currentTarget.style.borderColor = 'var(--color-yellow-btn-border)';
                }}
                title="Copy prompt for AI coding agent"
              >
                {isCopied ? 'Copied!' : 'Copy Prompt'}
              </button>
              <button
                onClick={handleStartEdit}
                className="text-xs p-1.5 bg-github-bg-tertiary text-github-text-secondary border border-github-border rounded hover:text-github-text-primary hover:bg-github-bg-primary transition-all"
                title="Edit"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={handleRemove}
                className="text-xs p-1.5 bg-github-bg-tertiary text-green-600 border border-github-border rounded hover:bg-green-500/10 hover:border-green-600 transition-all"
                title="Resolve"
              >
                <Check size={12} />
              </button>
            </>
          }
        </div>
      </div>

      {!isEditing ?
        hasSuggestionBlock(comment.body) ?
          <SuggestionBlockRenderer
            body={comment.body}
            originalCode={comment.codeContent}
            filename={comment.file}
            syntaxTheme={syntaxTheme}
          />
        : <div className="text-github-text-primary text-sm leading-6 whitespace-pre-wrap">
            {comment.body}
          </div>

      : <div>
          <textarea
            ref={editTextareaRef}
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            className="w-full text-github-text-primary text-sm leading-6 bg-github-bg-secondary border border-github-border rounded px-2 py-1 resize-none focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30"
            rows={Math.max(2, editedBody.split('\n').length)}
            placeholder="Edit your comment..."
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Stop propagation to prevent triggering parent keyboard handlers
              e.stopPropagation();
              handleKeyDown(e);
            }}
          />
          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs px-3 py-1.5 bg-github-bg-tertiary text-github-text-primary border border-github-border rounded hover:opacity-80 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="text-xs px-3 py-1.5 rounded transition-all disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-yellow-btn-bg)',
                color: 'var(--color-yellow-btn-text)',
                border: '1px solid var(--color-yellow-btn-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-yellow-btn-hover-bg)';
                e.currentTarget.style.borderColor = 'var(--color-yellow-btn-hover-border)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-yellow-btn-bg)';
                e.currentTarget.style.borderColor = 'var(--color-yellow-btn-border)';
              }}
              disabled={!editedBody.trim()}
            >
              Submit
            </button>
          </div>
        </div>
      }
    </div>
  );
}
