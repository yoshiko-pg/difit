import { ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from 'lucide-react';
import { memo } from 'react';

const DEFAULT_EXPAND_COUNT = 20;

interface ExpandButtonProps {
  direction: 'up' | 'down' | 'both';
  hiddenLines: number;
  onExpandUp?: () => void;
  onExpandDown?: () => void;
  onExpandAll?: () => void;
  isLoading?: boolean;
  header?: string;
  alignRight?: boolean;
}

// Memoized to avoid unnecessary re-renders (#8)
export const ExpandButton = memo(function ExpandButton({
  direction,
  hiddenLines,
  onExpandUp,
  onExpandDown,
  onExpandAll,
  isLoading = false,
  header,
  alignRight = false,
}: ExpandButtonProps) {
  if (hiddenLines <= 0) {
    return null;
  }

  const buttonBaseClass =
    'flex items-center gap-1 px-2 py-1 text-xs text-github-text-muted hover:text-github-text-primary hover:bg-github-bg-tertiary rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  // If hidden lines <= DEFAULT_EXPAND_COUNT, only show "Expand All" button
  const showOnlyExpandAll = hiddenLines <= DEFAULT_EXPAND_COUNT;

  const renderButton = (
    dir: 'up' | 'down' | 'all',
    onClick: (() => void) | undefined,
    label: string
  ) => {
    const ariaLabel =
      dir === 'all' ?
        `Expand all ${hiddenLines} hidden lines`
      : `Expand ${Math.min(hiddenLines, DEFAULT_EXPAND_COUNT)} hidden lines ${dir === 'up' ? 'above' : 'below'}`;

    return (
      <button
        onClick={onClick}
        disabled={isLoading || !onClick}
        className={buttonBaseClass}
        title={ariaLabel}
        aria-label={ariaLabel}
        aria-busy={isLoading}
      >
        {isLoading ?
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        : dir === 'up' ?
          <ChevronDown size={14} aria-hidden="true" />
        : dir === 'down' ?
          <ChevronUp size={14} aria-hidden="true" />
        : <ChevronsUpDown size={14} aria-hidden="true" />}
        <span>{label}</span>
      </button>
    );
  };

  const renderButtons = () => {
    if (showOnlyExpandAll) {
      return renderButton('all', onExpandAll, `Expand ${hiddenLines} lines`);
    }

    return (
      <>
        {(direction === 'up' || direction === 'both') &&
          renderButton('up', onExpandUp, `Expand ${DEFAULT_EXPAND_COUNT} lines`)}

        {onExpandAll && renderButton('all', onExpandAll, `Expand all ${hiddenLines} lines`)}

        {(direction === 'down' || direction === 'both') &&
          renderButton('down', onExpandDown, `Expand ${DEFAULT_EXPAND_COUNT} lines`)}
      </>
    );
  };

  // With header: show header on the left, buttons on the right
  if (header) {
    return (
      <div className="flex items-center justify-between bg-github-bg-tertiary border-y border-github-border">
        <code className="text-github-text-secondary text-xs font-mono px-3 py-2 truncate">
          {header}
        </code>
        <div className="flex items-center gap-2 px-3 py-1 flex-shrink-0">{renderButtons()}</div>
      </div>
    );
  }

  // Align right: buttons on the right side
  if (alignRight) {
    return (
      <div className="flex items-center justify-end bg-github-bg-tertiary border-y border-github-border">
        <div className="flex items-center gap-2 px-3 py-1">{renderButtons()}</div>
      </div>
    );
  }

  // Default: centered buttons
  return (
    <div className="flex items-center justify-center py-1 px-4 bg-github-bg-secondary border-y border-github-border">
      <div className="flex items-center gap-3">{renderButtons()}</div>
    </div>
  );
});
