import { RefreshCw } from 'lucide-react';

interface ReloadButtonProps {
  shouldReload: boolean;
  isReloading: boolean;
  onReload: () => void;
  changeType?: 'file' | 'commit' | 'staging' | null;
  className?: string;
  compact?: boolean;
}

export function ReloadButton({
  shouldReload,
  isReloading,
  onReload,
  changeType,
  className = '',
  compact = false,
}: ReloadButtonProps) {
  if (!shouldReload) {
    return null;
  }

  const getChangeMessage = () => {
    switch (changeType) {
      case 'commit':
        return 'New commits available';
      case 'staging':
        return 'Staging changes detected';
      case 'file':
        return 'File changes detected';
      default:
        return 'Changes detected';
    }
  };

  return (
    <button
      onClick={onReload}
      disabled={isReloading}
      className={`
        flex items-center gap-1.5 text-xs rounded-md border ${className} ${
          compact ? 'px-2 py-2' : 'px-3 py-1.5'
        }
        ${
          isReloading ?
            'bg-github-text-primary text-github-bg-primary border-github-text-primary cursor-not-allowed'
          : 'bg-github-text-primary text-github-bg-primary border-github-text-primary'
        }
      `}
      title={`${getChangeMessage()} - Click to refresh`}
      aria-label={compact ? 'Refresh' : undefined}
    >
      <RefreshCw size={12} className={`${isReloading ? 'animate-spin' : ''}`} />
      {compact ?
        <span className="sr-only">Refresh</span>
      : 'Refresh'}
    </button>
  );
}
