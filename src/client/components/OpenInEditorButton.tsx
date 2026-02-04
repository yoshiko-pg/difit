import { ExternalLink } from 'lucide-react';
import React from 'react';

interface OpenInEditorButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
}

export const OpenInEditorButton: React.FC<OpenInEditorButtonProps> = React.memo(
  ({ onClick, title = 'Open in editor', className }) => {
    return (
      <button
        className={`absolute -right-10 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded transition-all duration-150 hover:scale-110 z-10 ${className || ''}`}
        data-open-in-editor-button="true"
        style={{
          backgroundColor: 'var(--color-editor-btn-bg)',
          color: 'var(--color-editor-btn-text)',
          border: '1px solid var(--color-editor-btn-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-editor-btn-hover-bg)';
          e.currentTarget.style.borderColor = 'var(--color-editor-btn-hover-border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-editor-btn-bg)';
          e.currentTarget.style.borderColor = 'var(--color-editor-btn-border)';
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        title={title}
      >
        <ExternalLink className="w-4 h-4 opacity-80" />
      </button>
    );
  },
);

OpenInEditorButton.displayName = 'OpenInEditorButton';
