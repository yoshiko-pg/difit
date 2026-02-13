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
      onChange(value ? `${value}\n${template}` : template);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newBody =
      before +
      (before && !before.endsWith('\n') ? '\n' : '') +
      template +
      (after && !after.startsWith('\n') ? '\n' : '') +
      after;

    onChange(newBody);

    // Move cursor to the suggested code for editing
    const cursorStart =
      before.length + (before && !before.endsWith('\n') ? 1 : 0) + '```suggestion\n'.length;
    const cursorEnd = cursorStart + selectedCode.length;

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
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
