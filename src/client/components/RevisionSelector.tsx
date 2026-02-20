/* eslint-disable react-hooks/refs */
// @floating-ui/react uses callback refs which trigger false positives in react-hooks/refs rule
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
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
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { type RevisionsResponse } from '../../types/diff';

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
  disabledValues = [],
}: RevisionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
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

  // Get display text for current value
  const getDisplayText = () => {
    // Check special options
    const special = options.specialOptions.find((opt) => opt.value === value);
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

  // Calculate initial focus index for the current value
  const getInitialFocusIndex = (): number => {
    let index = 0;

    // Check special options
    const specialIndex = options.specialOptions.findIndex((opt) => opt.value === value);
    if (specialIndex !== -1) {
      return specialIndex;
    }
    index += options.specialOptions.length;

    // Check commits (only if not in working/staged mode)
    if (!isWorkingStagedMode) {
      const commitIndex = options.commits.findIndex((c) => c.shortHash === value);
      if (commitIndex !== -1) {
        return index + commitIndex;
      }
      index += options.commits.length;

      // Check branches
      const branchIndex = options.branches.findIndex((b) => b.name === value);
      if (branchIndex !== -1) {
        return index + branchIndex;
      }
    }

    return 0; // Default to first item
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
          <FloatingFocusManager
            context={context}
            modal={false}
            initialFocus={getInitialFocusIndex()}
          >
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="bg-github-bg-secondary border border-github-border rounded shadow-lg z-50 w-[360px] max-h-[400px] overflow-y-auto"
              {...getFloatingProps()}
            >
              {/* Special Options */}
              {options.specialOptions.length > 0 && (
                <div className="border-b border-github-border">
                  <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                    Special
                  </div>
                  {options.specialOptions.map((opt) => (
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
              {!isWorkingStagedMode && options.commits.length > 0 && (
                <div className="border-b border-github-border">
                  <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                    Recent Commits
                  </div>
                  {options.commits.map((commit) => (
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
              {!isWorkingStagedMode && options.branches.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
                    Branches
                  </div>
                  {options.branches.map((branch) => (
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
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
