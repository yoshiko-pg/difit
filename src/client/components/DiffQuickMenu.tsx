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
import { ChevronDown, ChevronLeft, GitBranch, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';

import { type CommitInfo, type DiffSelection, type RevisionsResponse } from '../../types/diff';
import {
  createDiffSelection,
  diffSelectionsEqual,
  normalizeBaseMode,
} from '../../utils/diffSelection';

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
  if (normalizeBaseMode(selection.baseMode) === 'merge-base') {
    return false;
  }

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
  const [query, setQuery] = useState('');
  const isCompact = compact;

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen || isCommitMenuOpen,
    onOpenChange: (open) => {
      if (!open && isCommitMenuOpen) return;
      setIsOpen(open);
      if (!open) setQuery('');
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
    const mergeBaseSuffix =
      normalizeBaseMode(selection.baseMode) === 'merge-base' ? ' (merge-base)' : '';
    return `${baseLabel}...${targetLabel}${mergeBaseSuffix}`;
  }, [options, selection, resolvedBaseRevision, resolvedTargetRevision]);

  const mainBranch = useMemo(
    () =>
      options.branches.find((branch) => branch.name === 'main') ||
      options.branches.find((branch) => branch.name === 'master'),
    [options.branches],
  );

  const originDefaultBranch = options.originDefaultBranch;
  const headPreset = useMemo(() => createDiffSelection('HEAD^', 'HEAD'), []);
  const headUncommittedPreset = useMemo(() => createDiffSelection('HEAD', '.', 'merge-base'), []);
  const mainUncommittedPreset = useMemo(
    () => (mainBranch ? createDiffSelection(mainBranch.name, '.', 'merge-base') : null),
    [mainBranch],
  );
  const originUncommittedPreset = useMemo(
    () =>
      originDefaultBranch ? createDiffSelection(originDefaultBranch, '.', 'merge-base') : null,
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
    setQuery('');
  };

  const handleOpenAdvanced = () => {
    setIsCommitMenuOpen(false);
    setIsOpen(false);
    setQuery('');
    onOpenAdvanced();
  };

  const presetItems = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      selection: DiffSelection;
    }> = [
      { key: 'head', label: 'HEAD', selection: headPreset },
      {
        key: 'head-uncommitted',
        label: 'HEAD...Uncommitted (merge-base)',
        selection: headUncommittedPreset,
      },
    ];
    if (mainBranch && mainUncommittedPreset) {
      items.push({
        key: 'main-uncommitted',
        label: `${mainBranch.name}...Uncommitted (merge-base)`,
        selection: mainUncommittedPreset,
      });
    }
    if (originDefaultBranch && originUncommittedPreset) {
      items.push({
        key: 'origin-uncommitted',
        label: `${originDefaultBranch}...Uncommitted (merge-base)`,
        selection: originUncommittedPreset,
      });
    }
    items.push({
      key: 'previous',
      label: 'Previous commit',
      selection: previousCommitPreset,
    });
    return items;
  }, [
    headPreset,
    headUncommittedPreset,
    mainBranch,
    mainUncommittedPreset,
    originDefaultBranch,
    originUncommittedPreset,
    previousCommitPreset,
  ]);

  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;
  const matchesQuery = (...texts: string[]) =>
    texts.some((text) => text.toLowerCase().includes(normalizedQuery));

  const filteredPresets = isFiltering
    ? presetItems.filter((item) => matchesQuery(item.label))
    : presetItems;
  const filteredCommits = isFiltering
    ? options.commits.filter((commit) =>
        matchesQuery(commit.shortHash, commit.hash, commit.message),
      )
    : [];
  const filteredBranches = isFiltering
    ? options.branches.filter((branch) => matchesQuery(branch.name))
    : [];

  const hasNoMatches =
    isFiltering &&
    filteredPresets.length === 0 &&
    filteredCommits.length === 0 &&
    filteredBranches.length === 0;

  const branchSelection = (branchName: string) =>
    createDiffSelection(branchName, '.', 'merge-base');

  // Select the first match when pressing Enter in the search box
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !isFiltering) return;
    event.preventDefault();

    const firstMatch =
      filteredPresets[0]?.selection ??
      (filteredCommits[0]
        ? createDiffSelection(`${filteredCommits[0].shortHash}^`, filteredCommits[0].shortHash)
        : undefined) ??
      (filteredBranches[0] ? branchSelection(filteredBranches[0].name) : undefined);
    if (firstMatch) {
      handleSelect(firstMatch);
    }
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
            className="bg-github-bg-secondary border border-github-border rounded shadow-lg z-50 w-[320px] max-h-[400px] overflow-y-auto"
            {...getFloatingProps()}
          >
            {/* Search box */}
            <div className="sticky top-0 z-10 border-b border-github-border bg-github-bg-secondary p-2">
              <div className="flex items-center gap-2 rounded border border-github-border bg-github-bg-primary px-2 py-1.5 focus-within:border-blue-600">
                <Search size={12} className="shrink-0 text-github-text-secondary" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Filter branches and commits..."
                  aria-label="Filter branches and commits"
                  className="w-full bg-transparent text-xs text-github-text-primary placeholder:text-github-text-muted focus:outline-none"
                />
              </div>
            </div>

            {isFiltering ? (
              <>
                {filteredPresets.length > 0 && (
                  <div className="border-b border-github-border">
                    <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                      Quick Diffs
                    </div>
                    {filteredPresets.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => handleSelect(item.selection)}
                        className={getItemClasses(isPresetActive(item.selection), false)}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}

                {filteredCommits.length > 0 && (
                  <div className="border-b border-github-border">
                    <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                      Commits
                    </div>
                    {filteredCommits.map((commit) => (
                      <button
                        key={commit.hash}
                        onClick={() =>
                          handleSelect(
                            createDiffSelection(`${commit.shortHash}^`, commit.shortHash),
                          )
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
                )}

                {filteredBranches.length > 0 && (
                  <div className="border-b border-github-border">
                    <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                      Branches
                    </div>
                    {filteredBranches.map((branch) => (
                      <button
                        key={branch.name}
                        onClick={() => handleSelect(branchSelection(branch.name))}
                        className={getItemClasses(
                          isPresetActive(branchSelection(branch.name)),
                          false,
                        )}
                        type="button"
                        title={`${branch.name}...Uncommitted (merge-base)`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-github-text-primary">{branch.name}</span>
                          {branch.current && (
                            <span className="text-xs text-github-text-muted">(current)</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {hasNoMatches && (
                  <div className="px-3 py-4 text-center text-xs text-github-text-muted">
                    No matching branches or commits
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="border-b border-github-border">
                  <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                    Quick Diffs
                  </div>
                  {presetItems
                    .filter((item) => item.key !== 'previous')
                    .map((item) => (
                      <button
                        key={item.key}
                        onClick={() => handleSelect(item.selection)}
                        className={getItemClasses(isPresetActive(item.selection), false)}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
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
              </>
            )}
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
