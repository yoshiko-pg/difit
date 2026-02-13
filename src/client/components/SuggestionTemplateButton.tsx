import { Code } from 'lucide-react';
import React from 'react';

import { createSuggestionTemplate } from '../../utils/suggestionUtils';

interface SuggestionTemplateButtonProps {
  selectedCode?: string;
  value: string;
  onChange: (nextValue: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  className?: string;
}

const DEFAULT_CLASSNAME =
  'text-xs px-3 py-1.5 bg-github-bg-tertiary text-github-text-primary border border-github-border rounded hover:opacity-80 transition-all flex items-center gap-1';

export function SuggestionTemplateButton({
  selectedCode,
  value,
  onChange,
  textareaRef,
  className = DEFAULT_CLASSNAME,
}: SuggestionTemplateButtonProps) {
  if (!selectedCode) return null;

  const handleAddSuggestion = () => {
    const template = createSuggestionTemplate(selectedCode);
    const textarea = textareaRef?.current;

    if (!textarea) {
      const prefix = value ? '\n\n' : '';
      onChange(`${value}${prefix}${template}\n\n`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before ? '\n\n' : '';
    const insertion = `${prefix}${template}\n\n`;
    const newBody = before + insertion + after;

    onChange(newBody);

    // Place cursor after the inserted suggestion block
    const cursorPosition = before.length + insertion.length;

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  return (
    <button
      type="button"
      onClick={handleAddSuggestion}
      className={className}
      title="Add code suggestion"
    >
      <Code size={12} />
      Add suggestion
    </button>
  );
}
