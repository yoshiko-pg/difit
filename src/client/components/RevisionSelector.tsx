import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useHover,
  useClick,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingFocusManager,
  FloatingPortal,
  safePolygon,
} from '@floating-ui/react';
import { ChevronDown, Search } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';

import { type RevisionsResponse } from '../../types/diff';

const RESERVED_SPECIAL_OPTION_VALUES = new Set(['merge-base']);
const EMPTY_DISABLED_VALUES: string[] = [];

interface RevisionSelectorProps {
  label: string;
  value: string;
  resolvedValue?: string;
  onChange: (value: string) => void;
  options: RevisionsResponse;
  disabledValues?: string[];
}

export function RevisionSelector({
  label,
  value,
  resolvedValue,
  onChange,
  options,
  disabledValues = EMPTY_DISABLED_VALUES,
}: RevisionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
      if (!open) setQuery('');
    },
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      // Cap the dropdown height to the space actually available so the sticky
      // search box is never pushed out of the viewport.
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.min(400, availableHeight)}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    handleClose: safePolygon(),
  });
  const click = useClick(context);
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    click,
    focus,
    dismiss,
    role,
  ]);

  // Check if the current value is 'working' or 'staged' special case
  const isWorkingStagedMode =
    (value === 'working' && disabledValues.includes('staged')) ||
    (value === 'staged' && disabledValues.includes('working'));
  const visibleSpecialOptions = options.specialOptions.filter(
    (opt) => !RESERVED_SPECIAL_OPTION_VALUES.has(opt.value),
  );

  // Get display text for current value
  const getDisplayText = () => {
    // Check special options
    const special = visibleSpecialOptions.find((opt) => opt.value === value);
    if (special) return special.label;

    // Check branches
    const branch = options.branches.find((b) => b.name === value);
    if (branch) return `${branch.name}${branch.current ? ' (current)' : ''}`;

    // Check commits
    const commit = options.commits.find((c) => c.shortHash === value || c.hash === value);
    if (commit) return `${commit.shortHash} - ${commit.message}`;

    return value || 'Select...';
  };

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
    setQuery('');
  };

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (...texts: string[]) =>
    normalizedQuery.length === 0 ||
    texts.some((text) => text.toLowerCase().includes(normalizedQuery));

  const filteredSpecialOptions = visibleSpecialOptions.filter((opt) =>
    matchesQuery(opt.label, opt.value),
  );
  const filteredCommits = isWorkingStagedMode
    ? []
    : options.commits.filter((commit) =>
        matchesQuery(commit.shortHash, commit.hash, commit.message),
      );
  const filteredBranches = isWorkingStagedMode
    ? []
    : options.branches.filter((branch) => matchesQuery(branch.name));

  const hasNoMatches =
    filteredSpecialOptions.length === 0 &&
    filteredCommits.length === 0 &&
    filteredBranches.length === 0;

  // Select the first enabled match when pressing Enter in the search box
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const firstMatch =
      filteredSpecialOptions.find((opt) => !isDisabled(opt.value))?.value ??
      filteredCommits.find((commit) => !isDisabled(commit.shortHash))?.shortHash ??
      filteredBranches.find((branch) => !isDisabled(branch.name))?.name;
    if (firstMatch !== undefined) {
      handleSelect(firstMatch);
    }
  };

  // Check if a value is disabled
  const isDisabled = (val: string) => {
    return disabledValues.includes(val);
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

  const isCommitHighlighted = (shortHash: string, hash: string) => {
    if (shortHash === value || hash === value) return true;
    if (!resolvedValue) return false;
    return shortHash === resolvedValue || hash === resolvedValue;
  };

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className="flex items-center gap-1.5 cursor-pointer group"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        {...getReferenceProps()}
      >
        <span className="text-xs text-github-text-secondary">{label}:</span>
        <div className="flex items-center gap-1 px-2 py-1 bg-github-bg-tertiary border border-github-border rounded hover:border-github-text-secondary transition-colors">
          <code className="text-xs text-github-text-primary max-w-[150px] truncate">
            {getDisplayText()}
          </code>
          <ChevronDown
            size={12}
            className="text-github-text-secondary group-hover:text-github-text-primary transition-colors"
          />
        </div>
      </button>

      {isOpen && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={searchInputRef}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="bg-github-bg-secondary border border-github-border rounded shadow-lg z-50 w-[360px] overflow-y-auto"
              {...getFloatingProps()}
            >
              {/* Search box */}
              <div className="sticky top-0 z-10 border-b border-github-border bg-github-bg-secondary p-2">
                <div className="flex items-center gap-2 rounded border border-github-border bg-github-bg-primary px-2 py-1.5 focus-within:border-blue-600">
                  <Search size={12} className="shrink-0 text-github-text-secondary" />
                  <input
                    ref={searchInputRef}
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

              {/* Special Options */}
              {filteredSpecialOptions.length > 0 && (
                <div className="border-b border-github-border">
                  <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                    Special
                  </div>
                  {filteredSpecialOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      disabled={isDisabled(opt.value)}
                      className={getItemClasses(opt.value === value, isDisabled(opt.value))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Recent Commits - hide in working/staged mode */}
              {filteredCommits.length > 0 && (
                <div className="border-b border-github-border">
                  <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                    Recent Commits
                  </div>
                  {filteredCommits.map((commit) => (
                    <button
                      key={commit.hash}
                      onClick={() => handleSelect(commit.shortHash)}
                      disabled={isDisabled(commit.shortHash)}
                      className={getItemClasses(
                        isCommitHighlighted(commit.shortHash, commit.hash),
                        isDisabled(commit.shortHash),
                      )}
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

              {/* Branches - hide in working/staged mode */}
              {filteredBranches.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                    Branches
                  </div>
                  {filteredBranches.map((branch) => (
                    <button
                      key={branch.name}
                      onClick={() => handleSelect(branch.name)}
                      disabled={isDisabled(branch.name)}
                      className={getItemClasses(branch.name === value, isDisabled(branch.name))}
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

              {/* Empty state when the query matches nothing */}
              {hasNoMatches && (
                <div className="px-3 py-4 text-center text-xs text-github-text-muted">
                  No matching branches or commits
                </div>
              )}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
