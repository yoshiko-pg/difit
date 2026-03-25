import { Copy, Edit2, MessageSquareReply, Trash2 } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { type CommentThread, type DiffCommentMessage } from '../../types/diff';

import { CommentBodyRenderer, hasSuggestionInBody } from './CommentBodyRenderer';
import { CommentForm } from './CommentForm';
import type { AppearanceSettings } from './SettingsModal';
import { SuggestionTemplateButton } from './SuggestionTemplateButton';

type CommentEditMode = 'edit' | 'preview';

interface ThreadMessageItemProps {
  message: DiffCommentMessage;
  showAuthorBadge: boolean;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
  filename?: string;
  originalCode?: string;
  onUpdate: (newBody: string) => void;
  onDelete: () => void;
  deleteLabel: string;
  onClick?: (e: React.MouseEvent) => void;
}

function ThreadMessageItem({
  message,
  showAuthorBadge,
  syntaxTheme,
  filename,
  originalCode,
  onUpdate,
  onDelete,
  deleteLabel,
  onClick,
}: ThreadMessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(message.body);
  const [editMode, setEditMode] = useState<CommentEditMode>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const showAuthorHeader = showAuthorBadge && Boolean(message.author);

  const hasSuggestionInEditedBody = hasSuggestionInBody(editedBody);
  const effectiveEditMode: CommentEditMode = hasSuggestionInEditedBody ? editMode : 'edit';

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditMode('edit');
    setEditedBody(message.body);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditMode('edit');
    setEditedBody(message.body);
  };

  const handleSaveEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextBody = editedBody.trim();
    if (nextBody && nextBody !== message.body) {
      onUpdate(nextBody);
    }
    setIsEditing(false);
    setEditMode('edit');
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

  return (
    <div
      className={
        isEditing
          ? 'relative min-w-0 rounded-md border border-github-border bg-github-bg-secondary p-3 pr-28'
          : 'flex min-w-0 items-start gap-3'
      }
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        {showAuthorHeader && (
          <div className="mb-2 flex min-w-0 items-center gap-2 pr-2 text-xs text-github-text-secondary">
            <span className="inline-flex items-center rounded-full border border-github-border bg-github-bg-primary px-2 py-0.5 text-[11px] font-medium text-github-text-primary">
              {message.author}
            </span>
          </div>
        )}

        {!isEditing ? (
          <CommentBodyRenderer
            body={message.body}
            originalCode={originalCode}
            filename={filename}
            syntaxTheme={syntaxTheme}
          />
        ) : hasSuggestionInEditedBody && effectiveEditMode === 'preview' ? (
          <CommentBodyRenderer
            body={editedBody}
            originalCode={originalCode}
            filename={filename}
            syntaxTheme={syntaxTheme}
          />
        ) : (
          <div>
            {!hasSuggestionInEditedBody && (
              <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                <SuggestionTemplateButton
                  selectedCode={originalCode}
                  value={editedBody}
                  onChange={setEditedBody}
                  textareaRef={textareaRef}
                />
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="w-full resize-none rounded border border-github-border bg-github-bg-primary px-2 py-1 text-sm leading-6 text-github-text-primary focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30"
              rows={Math.max(2, editedBody.split('\n').length)}
              placeholder="Edit your message..."
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                handleKeyDown(e);
              }}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
                className="rounded border border-github-border bg-github-bg-tertiary px-3 py-1.5 text-xs text-github-text-primary transition-all hover:opacity-80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleSaveEdit(e)}
                className="rounded px-3 py-1.5 text-xs transition-all"
                style={{
                  backgroundColor: 'var(--color-yellow-btn-bg)',
                  color: 'var(--color-yellow-btn-text)',
                  border: '1px solid var(--color-yellow-btn-border)',
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        className={
          isEditing
            ? 'absolute right-3 top-3 flex items-center gap-2'
            : 'flex shrink-0 items-start gap-2 pt-0.5'
        }
      >
        {!isEditing ? (
          <>
            <button
              type="button"
              onClick={handleStartEdit}
              className="rounded border border-github-border bg-github-bg-tertiary p-1.5 text-github-text-secondary transition-all hover:bg-github-bg-primary hover:text-github-text-primary"
              title="Edit message"
            >
              <Edit2 size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded border border-github-border bg-github-bg-tertiary p-1.5 text-github-danger transition-all hover:bg-github-danger/10"
              title={deleteLabel}
            >
              <Trash2 size={12} />
            </button>
          </>
        ) : (
          hasSuggestionInEditedBody && (
            <div
              className="flex items-center rounded border border-github-border bg-github-bg-tertiary p-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setEditMode('edit')}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  effectiveEditMode === 'edit'
                    ? 'bg-github-bg-primary text-github-text-primary shadow-sm'
                    : 'text-github-text-secondary hover:text-github-text-primary'
                }`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setEditMode('preview')}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  effectiveEditMode === 'preview'
                    ? 'bg-github-bg-primary text-github-text-primary shadow-sm'
                    : 'text-github-text-secondary hover:text-github-text-primary'
                }`}
              >
                Preview
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

interface CommentThreadCardProps {
  thread: CommentThread;
  showAuthorBadges?: boolean;
  onGeneratePrompt: (thread: CommentThread) => string;
  onRemoveThread: (threadId: string) => void;
  onReplyToThread: (threadId: string, body: string) => Promise<void>;
  onRemoveMessage: (threadId: string, messageId: string) => void;
  onUpdateMessage: (threadId: string, messageId: string, newBody: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
}

export function CommentThreadCard({
  thread,
  showAuthorBadges = false,
  onGeneratePrompt,
  onRemoveThread,
  onReplyToThread,
  onRemoveMessage,
  onUpdateMessage,
  onClick,
  syntaxTheme,
}: CommentThreadCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const lineLabel = Array.isArray(thread.line)
    ? `${thread.line[0]}-${thread.line[1]}`
    : thread.line;

  const handleCopyThread = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const prompt = onGeneratePrompt(thread);
      await navigator.clipboard.writeText(prompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy thread prompt:', error);
    }
  };

  const rootMessage = thread.messages[0];
  if (!rootMessage) return null;

  return (
    <div
      id={`comment-thread-${thread.id}`}
      className={`rounded-md border border-yellow-600/50 border-l-4 border-l-yellow-400 bg-github-bg-tertiary p-3 shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
      onClick={onClick}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-github-text-secondary">
          <span
            className="font-mono px-1 py-0.5 rounded overflow-hidden text-ellipsis whitespace-nowrap"
            style={{
              backgroundColor: 'var(--color-yellow-path-bg)',
              color: 'var(--color-yellow-path-text)',
            }}
          >
            {thread.file}:{lineLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyThread}
            className="whitespace-nowrap rounded px-2 py-1 text-xs transition-all"
            style={{
              backgroundColor: 'var(--color-yellow-btn-bg)',
              color: 'var(--color-yellow-btn-text)',
              border: '1px solid var(--color-yellow-btn-border)',
            }}
            title="Copy thread prompt for AI coding agent"
          >
            <span className="inline-flex items-center gap-1">
              <Copy size={12} />
              {isCopied ? 'Copied!' : 'Copy Prompt'}
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsReplying((prev) => !prev);
            }}
            aria-label="Reply"
            className="rounded border border-github-border bg-github-bg-tertiary p-1.5 text-github-text-primary transition-all hover:bg-github-bg-primary"
            title="Reply to thread"
          >
            <MessageSquareReply size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <ThreadMessageItem
          message={rootMessage}
          showAuthorBadge={showAuthorBadges}
          syntaxTheme={syntaxTheme}
          filename={thread.file}
          originalCode={thread.codeContent}
          onUpdate={(newBody) => onUpdateMessage(thread.id, rootMessage.id, newBody)}
          onDelete={() => onRemoveThread(thread.id)}
          deleteLabel="Delete thread"
        />

        {thread.messages.slice(1).map((message) => (
          <div key={message.id} className="ml-4 border-l border-github-border pl-3">
            <ThreadMessageItem
              message={message}
              showAuthorBadge={showAuthorBadges}
              syntaxTheme={syntaxTheme}
              filename={thread.file}
              originalCode={thread.codeContent}
              onUpdate={(newBody) => onUpdateMessage(thread.id, message.id, newBody)}
              onDelete={() => onRemoveMessage(thread.id, message.id)}
              deleteLabel="Delete reply"
            />
          </div>
        ))}

        {isReplying && (
          <div
            className="ml-4 border-l border-github-border pl-3"
            onClick={(e) => e.stopPropagation()}
          >
            <CommentForm
              onSubmit={async (body) => {
                await onReplyToThread(thread.id, body);
                setIsReplying(false);
              }}
              onCancel={() => setIsReplying(false)}
              selectedCode={thread.codeContent}
              syntaxTheme={syntaxTheme}
              filename={thread.file}
              title="Reply to thread"
              submitLabel="Reply"
              placeholder="Write a reply..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
