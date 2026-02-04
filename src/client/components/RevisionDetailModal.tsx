import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useHotkeysContext } from 'react-hotkeys-hook';

import { type RevisionsResponse } from '../../types/diff';

import { RevisionSelector } from './RevisionSelector';

interface RevisionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: RevisionsResponse;
  baseRevision: string;
  targetRevision: string;
  resolvedBaseRevision?: string;
  resolvedTargetRevision?: string;
  onApply: (base: string, target: string) => void;
}

export function RevisionDetailModal({
  isOpen,
  onClose,
  options,
  baseRevision,
  targetRevision,
  resolvedBaseRevision,
  resolvedTargetRevision,
  onApply,
}: RevisionDetailModalProps) {
  const [localBase, setLocalBase] = useState(baseRevision);
  const [localTarget, setLocalTarget] = useState(targetRevision);
  const { enableScope, disableScope } = useHotkeysContext();

  useEffect(() => {
    if (isOpen) {
      disableScope('navigation');
    } else {
      enableScope('navigation');
    }

    return () => {
      enableScope('navigation');
    };
  }, [isOpen, enableScope, disableScope]);

  const baseDisabledValues = useMemo(() => {
    const targetCommitish = resolvedTargetRevision || localTarget;
    const targetIndex = options.commits.findIndex(
      (commit) => commit.shortHash === targetCommitish || commit.hash === targetCommitish,
    );
    if (targetIndex === -1) return localTarget ? [localTarget] : [];
    const disabledValues = options.commits
      .slice(0, targetIndex + 1)
      .map((commit) => commit.shortHash);
    if (localTarget && !disabledValues.includes(localTarget)) {
      disabledValues.push(localTarget);
    }
    if (!disabledValues.includes('working')) {
      disabledValues.push('working');
    }
    return disabledValues;
  }, [localTarget, resolvedTargetRevision, options.commits]);

  const targetDisabledValues = useMemo(() => {
    const baseCommitish = resolvedBaseRevision || localBase;
    const baseIndex = options.commits.findIndex(
      (commit) => commit.shortHash === baseCommitish || commit.hash === baseCommitish,
    );
    if (baseIndex === -1) return localBase ? [localBase] : [];
    const disabledValues = options.commits.slice(baseIndex).map((commit) => commit.shortHash);
    if (localBase && !disabledValues.includes(localBase)) {
      disabledValues.push(localBase);
    }
    return disabledValues;
  }, [localBase, resolvedBaseRevision, options.commits]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(localBase, localTarget);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-github-bg-secondary border border-github-border rounded-lg shadow-lg w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-github-border">
          <h2 className="text-lg font-semibold text-github-text-primary">Detailed Diff</h2>
          <button
            onClick={onClose}
            className="text-github-text-secondary hover:text-github-text-primary p-1"
            aria-label="Close detailed diff"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <RevisionSelector
              label="Base"
              value={localBase}
              resolvedValue={resolvedBaseRevision}
              onChange={setLocalBase}
              options={options}
              disabledValues={baseDisabledValues}
            />
            <span className="text-github-text-muted">...</span>
            <RevisionSelector
              label="Target"
              value={localTarget}
              resolvedValue={resolvedTargetRevision}
              onChange={setLocalTarget}
              options={options}
              disabledValues={targetDisabledValues}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded border border-github-border text-github-text-secondary hover:text-github-text-primary transition-colors"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1.5 text-xs font-medium rounded bg-github-accent text-white hover:bg-github-accent/90 transition-colors"
              type="button"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
