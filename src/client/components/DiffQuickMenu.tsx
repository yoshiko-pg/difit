/* oxlint-disable react-hooks-js/refs */
// @floating-ui/react uses callback refs which trigger false positives in react-hooks/refs rule
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useHover,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  safePolygon,
} from '@floating-ui/react';
import { ChevronDown, ChevronLeft, GitBranch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { type CommitInfo, type DiffSelection, type RevisionsResponse } from '../../types/diff';
import { createDiffSelection, diffSelectionsEqual } from '../../utils/diffSelection';

interface DiffQuickMenuProps {
  options: RevisionsResponse;
  selection: DiffSelection;
  resolvedBaseRevision?: string;
  resolvedTargetRevision?: string;
  onSelectDiff: (selection: DiffSelection) => void;
  onOpenAdvanced: () => void;
  compact?: boolean;
}

const SPECIAL_LABEL_OVERRIDES: Record<string, string> = {
  '.': 'Uncommitted Changes',
  staged: 'Staging Area',
  working: 'Working Directory',
};

const UNCOMMITTED_TARGETS = new Set(['.', 'staged', 'working']);

export const getPreviousCommitPreset = (targetRevision: string): DiffSelection => {
  const target =
    !targetRevision || UNCOMMITTED_TARGETS.has(targetRevision) ? 'HEAD' : `${targetRevision}^`;
  return createDiffSelection(`${target}^`, target);
};

const isPreviousPair = (selection: DiffSelection) => {
  return (
    Boolean(selection.targetCommitish) &&
    selection.baseCommitish === `${selection.targetCommitish}^`
  );
};

const matchesCommitish = (value: string | undefined, commit: CommitInfo) => {
  if (!value) return false;
  return value === commit.shortHash || value === commit.hash;
};

const getCommitLabel = (commit: CommitInfo, withCaret: boolean) => {
  return withCaret ? `${commit.shortHash}^` : commit.shortHash;
};

const resolveDisplayLabel = (
  options: RevisionsResponse,
  value: string,
  resolvedValue?: string,
): string => {
  if (!value) return 'Select...';

  const caret = value.endsWith('^');
  const baseValue = caret ? value.slice(0, -1) : value;

  if (baseValue.startsWith('HEAD')) {
    return value;
  }

  const override = SPECIAL_LABEL_OVERRIDES[value];
  if (override) return override;

  const special = options.specialOptions.find((opt) => opt.value === value);
  if (special) return special.label;

  const branch = options.branches.find((b) => b.name === baseValue);
  if (branch) return caret ? `${branch.name}^` : branch.name;

  const commit = options.commits.find((c) => c.shortHash === baseValue || c.hash === baseValue);
  if (commit) return getCommitLabel(commit, caret);

  if (resolvedValue) {
    const resolvedCommit = options.commits.find(
      (c) => c.shortHash === resolvedValue || c.hash === resolvedValue,
    );
    if (resolvedCommit) return getCommitLabel(resolvedCommit, false);
  }

  return value;
};

export function DiffQuickMenu({
  options,
  selection,
  resolvedBaseRevision,
  resolvedTargetRevision,
  onSelectDiff,
  onOpenAdvanced,
  compact = false,
}: DiffQuickMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCommitMenuOpen, setIsCommitMenuOpen] = useState(false);
  const isCompact = compact;

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen || isCommitMenuOpen,
    onOpenChange: (open) => {
      if (!open && isCommitMenuOpen) return;
      setIsOpen(open);
    },
    placement: 'bottom-end',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    handleClose: safePolygon(),
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'menu' });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, click, dismiss, role]);

  const {
    refs: commitRefs,
    floatingStyles: commitFloatingStyles,
    context: commitContext,
  } = useFloating({
    open: isCommitMenuOpen,
    onOpenChange: (open) => {
      if (open) {
        setIsOpen(true);
      }
      setIsCommitMenuOpen(open);
    },
    placement: 'left-start',
    middleware: [offset(0), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const commitHover = useHover(commitContext, {
    handleClose: safePolygon(),
  });
  const commitClick = useClick(commitContext);
  const commitDismiss = useDismiss(commitContext);
  const commitRole = useRole(commitContext, { role: 'menu' });

  const { getReferenceProps: getCommitReferenceProps, getFloatingProps: getCommitFloatingProps } =
    useInteractions([commitHover, commitClick, commitDismiss, commitRole]);

  useEffect(() => {
    if (!isOpen) {
      setIsCommitMenuOpen(false);
    }
  }, [isOpen]);

  const currentLabel = useMemo(() => {
    const currentSelectionIsPreviousPair = isPreviousPair(selection);
    const commitMatch = options.commits.find((commit) => {
      if (!currentSelectionIsPreviousPair) return false;
      return (
        matchesCommitish(selection.targetCommitish, commit) ||
        matchesCommitish(resolvedTargetRevision, commit)
      );
    });

    if (commitMatch) {
      return `${commitMatch.shortHash} ${commitMatch.message}`;
    }

    const baseLabel = resolveDisplayLabel(options, selection.baseCommitish, resolvedBaseRevision);
    const targetLabel = resolveDisplayLabel(
      options,
      selection.targetCommitish,
      resolvedTargetRevision,
    );
    return `${baseLabel}...${targetLabel}`;
  }, [options, selection, resolvedBaseRevision, resolvedTargetRevision]);

  const mainBranch = useMemo(
    () =>
      options.branches.find((branch) => branch.name === 'main') ||
      options.branches.find((branch) => branch.name === 'master'),
    [options.branches],
  );

  const originDefaultBranch = options.originDefaultBranch;
  const headPreset = useMemo(() => createDiffSelection('HEAD^', 'HEAD'), []);
  const headUncommittedPreset = useMemo(() => createDiffSelection('HEAD', '.'), []);
  const mainUncommittedPreset = useMemo(
    () => (mainBranch ? createDiffSelection(mainBranch.name, '.') : null),
    [mainBranch],
  );
  const originUncommittedPreset = useMemo(
    () => (originDefaultBranch ? createDiffSelection(originDefaultBranch, '.') : null),
    [originDefaultBranch],
  );
  const previousCommitPreset = useMemo(
    () => getPreviousCommitPreset(selection.targetCommitish),
    [selection.targetCommitish],
  );

  const handleSelect = (nextSelection: DiffSelection) => {
    onSelectDiff(nextSelection);
    setIsCommitMenuOpen(false);
    setIsOpen(false);
  };

  const handleOpenAdvanced = () => {
    setIsCommitMenuOpen(false);
    setIsOpen(false);
    onOpenAdvanced();
  };

  const getItemClasses = (highlighted: boolean, disabled: boolean) => {
    const highlightClasses = highlighted
      ? 'bg-diff-selected-bg border-l-4 border-l-diff-selected-border font-semibold pl-2'
      : '';
    const hoverClasses = highlighted
      ? 'hover:bg-diff-selected-bg focus:bg-diff-selected-bg'
      : 'hover:bg-github-bg-tertiary focus:bg-github-bg-tertiary';
    const cursorClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

    return [
      'w-full text-left px-3 py-2 text-xs focus:outline-none transition-colors',
      hoverClasses,
      highlightClasses,
      cursorClasses,
    ].join(' ');
  };

  const isPresetActive = (preset: DiffSelection) => {
    return diffSelectionsEqual(selection, preset);
  };

  const isCommitActive = (commit: CommitInfo) => {
    if (!isPreviousPair(selection)) return false;
    return (
      matchesCommitish(selection.targetCommitish, commit) ||
      matchesCommitish(resolvedTargetRevision, commit)
    );
  };

  return (
    <div className="relative">
      <button
        ref={refs.setReference}
        type="button"
        className="flex items-center gap-1.5 cursor-pointer group"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Revision menu: ${currentLabel}`}
        title={currentLabel}
        {...getReferenceProps()}
      >
        {isCompact ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-github-bg-tertiary border border-github-border rounded hover:border-github-text-secondary transition-colors">
            <GitBranch size={14} className="text-github-text-secondary" />
            <ChevronDown
              size={12}
              className="text-github-text-secondary group-hover:text-github-text-primary transition-colors"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 bg-github-bg-tertiary border border-github-border rounded hover:border-github-text-secondary transition-colors">
            <code className="text-xs text-github-text-primary">{currentLabel}</code>
            <ChevronDown
              size={12}
              className="text-github-text-secondary group-hover:text-github-text-primary transition-colors"
            />
          </div>
        )}
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="bg-github-bg-secondary border border-github-border rounded shadow-lg z-50 w-[260px] max-h-[360px] overflow-y-auto"
            {...getFloatingProps()}
          >
            <div className="border-b border-github-border">
              <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                Quick Diffs
              </div>
              <button
                onClick={() => handleSelect(headPreset)}
                className={getItemClasses(isPresetActive(headPreset), false)}
              >
                HEAD
              </button>
              <button
                onClick={() => handleSelect(headUncommittedPreset)}
                className={getItemClasses(isPresetActive(headUncommittedPreset), false)}
              >
                HEAD...Uncommitted
              </button>
              {mainBranch && mainUncommittedPreset && (
                <>
                  <button
                    onClick={() => handleSelect(mainUncommittedPreset)}
                    className={getItemClasses(isPresetActive(mainUncommittedPreset), false)}
                  >
                    {mainBranch.name}...Uncommitted
                  </button>
                </>
              )}
              {originDefaultBranch && originUncommittedPreset && (
                <button
                  onClick={() => handleSelect(originUncommittedPreset)}
                  className={getItemClasses(isPresetActive(originUncommittedPreset), false)}
                >
                  {originDefaultBranch}...Uncommitted
                </button>
              )}
            </div>

            <div className="border-b border-github-border">
              <button
                onClick={() => handleSelect(previousCommitPreset)}
                className={getItemClasses(isPresetActive(previousCommitPreset), false)}
                type="button"
              >
                Previous commit
              </button>
            </div>

            <div className="border-b border-github-border">
              <button
                ref={options.commits.length > 0 ? commitRefs.setReference : undefined}
                className={getItemClasses(false, options.commits.length === 0)}
                {...(options.commits.length > 0 ? getCommitReferenceProps() : {})}
                disabled={options.commits.length === 0}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <ChevronLeft size={12} className="text-github-text-secondary" />
                  <span>Pick Commit...</span>
                </div>
              </button>
            </div>

            <div>
              <button
                onClick={handleOpenAdvanced}
                className={getItemClasses(false, false)}
                type="button"
              >
                Detailed...
              </button>
            </div>
          </div>
        </FloatingPortal>
      )}

      {isCommitMenuOpen && options.commits.length > 0 && (
        <FloatingPortal>
          <div
            ref={commitRefs.setFloating}
            style={commitFloatingStyles}
            className="bg-github-bg-secondary border border-github-border rounded shadow-lg z-50 w-[360px] max-h-[360px] overflow-y-auto"
            {...getCommitFloatingProps()}
          >
            <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
              Recent Commits
            </div>
            {options.commits.map((commit) => (
              <button
                key={commit.hash}
                onClick={() =>
                  handleSelect(createDiffSelection(`${commit.shortHash}^`, commit.shortHash))
                }
                className={getItemClasses(isCommitActive(commit), false)}
                type="button"
              >
                <div className="flex items-start gap-2">
                  <code className="text-xs text-github-text-primary font-mono whitespace-nowrap">
                    {commit.shortHash}
                  </code>
                  <span className="text-xs text-github-text-secondary flex-1 break-words">
                    {commit.message}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
