import { ArrowDownFromLine, ArrowUpFromLine, Loader2, UnfoldVertical } from 'lucide-react';
import { memo, type ReactElement } from 'react';

const DEFAULT_EXPAND_COUNT = 20;

interface ExpandButtonProps {
  direction: 'up' | 'down' | 'both';
  hiddenLines: number;
  onExpandUp?: () => void;
  onExpandDown?: () => void;
  onExpandAll?: () => void;
  isLoading?: boolean;
}

// Memoized to avoid unnecessary re-renders (#8)
export const ExpandButton = memo(function ExpandButton({
  direction,
  hiddenLines,
  onExpandUp,
  onExpandDown,
  onExpandAll,
  isLoading = false,
}: ExpandButtonProps) {
  if (hiddenLines <= 0) {
    return null;
  }

  const lineLabel = `${hiddenLines} ${hiddenLines === 1 ? 'line' : 'lines'}`;
  const showOnlyExpandAll = hiddenLines <= DEFAULT_EXPAND_COUNT;
  const gridClass = 'grid-cols-[var(--line-number-width)_1fr]';
  const iconButtonClass =
    'flex flex-1 w-full items-center justify-center py-1 text-github-text-primary hover:bg-github-bg-secondary hover:text-github-text-muted transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const actions: {
    key: string;
    onClick: (() => void) | undefined;
    ariaLabel: string;
    icon: ReactElement;
  }[] = [];

  if (showOnlyExpandAll) {
    actions.push({
      key: 'all',
      onClick: onExpandAll,
      ariaLabel: `Expand all ${hiddenLines} hidden lines`,
      icon: <UnfoldVertical size={16} aria-hidden="true" />,
    });
  } else {
    if (direction === 'up' || direction === 'both') {
      actions.push({
        key: 'up',
        onClick: onExpandUp,
        ariaLabel: `Expand ${DEFAULT_EXPAND_COUNT} hidden lines above`,
        icon: <ArrowUpFromLine size={12} aria-hidden="true" className="translate-y-0.5" />,
      });
    }
    if (direction === 'down' || direction === 'both') {
      actions.push({
        key: 'down',
        onClick: onExpandDown,
        ariaLabel: `Expand ${DEFAULT_EXPAND_COUNT} hidden lines below`,
        icon: <ArrowDownFromLine size={12} aria-hidden="true" className="-translate-y-0.5" />,
      });
    }
  }

  return (
    <div
      className={`grid w-full border-l border-r border-github-border bg-github-bg-tertiary  text-sm ${gridClass}`}
    >
      <div className="flex flex-col items-stretch justify-center gap-0.5 border-r border-github-border">
        {isLoading ?
          <Loader2
            size={14}
            className="animate-spin text-github-text-muted self-center"
            aria-hidden="true"
          />
        : actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={isLoading || !action.onClick}
              className={iconButtonClass}
              title={action.ariaLabel}
              aria-label={action.ariaLabel}
            >
              {action.icon}
            </button>
          ))
        }
      </div>
      <div className="flex items-center justify-start px-3 py-1.5 font-mono text-github-text-muted select-none">
        {lineLabel}
      </div>
    </div>
  );
});
