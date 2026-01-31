import { MessageSquare } from 'lucide-react';
import React from 'react';

interface CommentButtonProps {
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
}

export const CommentButton: React.FC<CommentButtonProps> = React.memo(
  ({ onMouseDown, onMouseUp, title = 'Add a comment' }) => {
    return (
      <button
        className="absolute -right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded transition-all duration-150 hover:scale-110 z-10"
        data-comment-button="true"
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
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        title={title}
      >
        <MessageSquare className="w-4 h-4" />
      </button>
    );
  },
);

CommentButton.displayName = 'CommentButton';
