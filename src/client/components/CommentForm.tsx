import { Code } from 'lucide-react';
import React, { useState, useRef } from 'react';

import { createSuggestionTemplate } from '../../utils/suggestionUtils';

interface CommentFormProps {
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
  selectedCode?: string;
}

export function CommentForm({ onSubmit, onCancel, selectedCode }: CommentFormProps) {
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!body.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(body.trim());
      setBody('');
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSubmit(e);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleAddSuggestion = () => {
    if (!selectedCode) return;

    const template = createSuggestionTemplate(selectedCode);
    const textarea = textareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = body.slice(0, start);
      const after = body.slice(end);
      const newBody =
        before +
        (before && !before.endsWith('\n') ? '\n' : '') +
        template +
        (after && !after.startsWith('\n') ? '\n' : '') +
        after;
      setBody(newBody);

      // Move cursor to the suggested code for editing
      const cursorStart =
        before.length + (before && !before.endsWith('\n') ? 1 : 0) + '```suggestion\n'.length;
      const cursorEnd = cursorStart + selectedCode.length;
      setTimeout(() => {
        textarea.setSelectionRange(cursorStart, cursorEnd);
        textarea.focus();
      }, 0);
    } else {
      // Fallback if ref is not available
      setBody((prev) => (prev ? prev + '\n' : '') + template);
    }
  };

  return (
    <form
      className="m-2 mx-3 p-3 bg-github-bg-tertiary border border-yellow-600/50 rounded-md border-l-4 border-l-yellow-400"
      onSubmit={handleSubmit}
      data-empty={!body.trim()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--color-yellow-path-text)' }}>
          Add a comment
        </span>
        {selectedCode && (
          <button
            type="button"
            onClick={handleAddSuggestion}
            className="text-xs px-2.5 py-1.5 bg-amber-500 text-amber-950 border border-amber-400 rounded hover:bg-amber-400 hover:border-amber-300 transition-colors flex items-center gap-1 font-semibold shadow-sm"
            title="Add code suggestion"
          >
            <Code size={12} />
            Add suggestion
          </button>
        )}
      </div>

      <textarea
        ref={textareaRef}
        className="w-full min-h-[60px] mb-2 resize-y bg-github-bg-secondary border border-github-border rounded px-3 py-2 text-github-text-primary text-sm leading-6 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/30 focus:min-h-[80px] disabled:opacity-50"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Leave a comment..."
        rows={3}
        autoFocus
        disabled={isSubmitting}
      />

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1.5 bg-github-bg-tertiary text-github-text-primary border border-github-border rounded hover:opacity-80 transition-all disabled:opacity-50"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
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
          disabled={!body.trim() || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
