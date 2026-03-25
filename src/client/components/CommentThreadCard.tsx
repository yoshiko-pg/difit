import { Check, Copy, Edit2, MessageSquareReply, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { type CommentThread, type DiffCommentMessage } from '../../types/diff';

import { CommentBodyRenderer } from './CommentBodyRenderer';
import { CommentForm } from './CommentForm';
import type { AppearanceSettings } from './SettingsModal';

interface ThreadMessageItemProps {
  message: DiffCommentMessage;
  isRootMessage?: boolean;
  showAuthorBadge: boolean;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
  filename?: string;
  originalCode?: string;
  onUpdate: (newBody: string) => void;
  onResolveOrDelete: () => void;
  actionLabel: string;
  confirmMessage?: string;
  onClick?: (e: React.MouseEvent) => void;
}

function ThreadMessageItem({
  message,
  isRootMessage = false,
  showAuthorBadge,
  syntaxTheme,
  filename,
  originalCode,
  onUpdate,
  onResolveOrDelete,
  actionLabel,
  confirmMessage,
  onClick,
}: ThreadMessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const showAuthorHeader = showAuthorBadge && Boolean(message.author);
  const isUserAuthoredMessage = message.author?.trim() === 'User';

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = (nextBody: string) => {
    if (nextBody !== message.body) {
      onUpdate(nextBody);
    }
    setIsEditing(false);
    return Promise.resolve();
  };

  return (
    <div className={isEditing ? '' : 'flex min-w-0 items-start gap-3'} onClick={onClick}>
      {!isEditing ? (
        <>
          <div className="min-w-0 flex-1">
            {showAuthorHeader && (
              <div className="mb-2 flex min-w-0 items-center gap-2 pr-2 text-xs text-github-text-secondary">
                <span className="inline-flex items-center rounded-full border border-github-border bg-github-bg-primary px-2 py-0.5 text-[11px] font-medium text-github-text-primary">
                  {message.author}
                </span>
              </div>
            )}

            <CommentBodyRenderer
              body={message.body}
              originalCode={originalCode}
              filename={filename}
              syntaxTheme={syntaxTheme}
            />
          </div>
          {(isRootMessage || isUserAuthoredMessage) && (
            <div className="flex shrink-0 items-start gap-2 pt-0.5">
              {isUserAuthoredMessage && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="rounded border border-github-border bg-github-bg-tertiary p-1.5 text-github-text-primary transition-all hover:bg-github-bg-primary"
                  title="Edit message"
                >
                  <Edit2 size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirmMessage && !confirm(confirmMessage)) {
                    return;
                  }
                  onResolveOrDelete();
                }}
                className={`rounded border border-github-border bg-github-bg-tertiary p-1.5 transition-all hover:bg-github-bg-primary ${
                  isRootMessage ? 'text-green-700 hover:text-green-800' : 'text-github-danger'
                }`}
                title={actionLabel}
                aria-label={actionLabel}
              >
                {isRootMessage ? <Check size={12} /> : <Trash2 size={12} />}
              </button>
            </div>
          )}
        </>
      ) : (
        <CommentForm
          onSubmit={handleSaveEdit}
          onCancel={handleCancelEdit}
          selectedCode={originalCode}
          syntaxTheme={syntaxTheme}
          filename={filename}
          initialValue={message.body}
          embedded={true}
          title="Edit comment"
          submitLabel="Save"
          placeholder="Edit your message..."
        />
      )}
    </div>
  );
}

interface CommentThreadCardProps {
  thread: CommentThread;
  showAuthorBadges?: boolean;
  confirmRootAction?: boolean;
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
  confirmRootAction = true,
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
          isRootMessage={true}
          showAuthorBadge={showAuthorBadges}
          syntaxTheme={syntaxTheme}
          filename={thread.file}
          originalCode={thread.codeContent}
          onUpdate={(newBody) => onUpdateMessage(thread.id, rootMessage.id, newBody)}
          onResolveOrDelete={() => onRemoveThread(thread.id)}
          actionLabel="Resolve thread"
          confirmMessage={
            confirmRootAction ? `Resolve this thread?\n\n"${rootMessage.body}"` : undefined
          }
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
              onResolveOrDelete={() => onRemoveMessage(thread.id, message.id)}
              actionLabel="Delete reply"
              confirmMessage={`Delete this reply?\n\n"${message.body}"`}
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
              embedded={true}
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
