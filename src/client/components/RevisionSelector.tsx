import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { type RevisionsResponse } from '../../types/diff';

interface RevisionSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: RevisionsResponse;
  disabledValue?: string;
  isBaseSelector?: boolean;
}

export function RevisionSelector({
  label,
  value,
  onChange,
  options,
  disabledValue,
  isBaseSelector = false,
}: RevisionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter special options based on working/staged constraints
  const getFilteredSpecialOptions = () => {
    return options.specialOptions.filter((opt) => {
      if (isBaseSelector && disabledValue === 'working') {
        return opt.value === 'staged';
      }
      if (!isBaseSelector && disabledValue === 'staged') {
        return opt.value === 'working';
      }
      if (isBaseSelector && opt.value === 'working') {
        return false;
      }
      return true;
    });
  };

  const filteredSpecialOptions = getFilteredSpecialOptions();

  // Check if the current value is 'working' or 'staged' special case
  const isWorkingStagedMode =
    (value === 'working' && disabledValue === 'staged') ||
    (value === 'staged' && disabledValue === 'working');

  // Get display text for current value
  const getDisplayText = () => {
    // Check special options
    const special = options.specialOptions.find((opt) => opt.value === value);
    if (special) return special.label;

    // Check branches
    const branch = options.branches.find((b) => b.name === value);
    if (branch) return `${branch.name}${branch.current ? ' (current)' : ''}`;

    // Check commits
    const commit = options.commits.find((c) => c.shortHash === value);
    if (commit) return `${commit.shortHash} - ${commit.message}`;

    return value || 'Select...';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="flex items-center gap-1.5 cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
      >
        <span className="text-xs text-github-text-secondary">{label}:</span>
        <div className="flex items-center gap-1 px-2 py-1 bg-github-bg-tertiary border border-github-border rounded hover:border-github-text-secondary transition-colors">
          <code className="text-xs text-github-text-primary max-w-[200px] truncate">
            {getDisplayText()}
          </code>
          <ChevronDown
            size={12}
            className="text-github-text-secondary group-hover:text-github-text-primary transition-colors"
          />
        </div>
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-1 bg-github-bg-secondary border border-github-border rounded shadow-lg z-50 min-w-[320px] max-h-[400px] overflow-y-auto"
          onMouseLeave={() => setIsOpen(false)}
        >
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
                  disabled={opt.value === disabledValue}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-github-bg-tertiary transition-colors ${
                    opt.value === value ? 'bg-github-bg-tertiary' : ''
                  } ${
                    opt.value === disabledValue ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
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
                  disabled={commit.shortHash === disabledValue}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-github-bg-tertiary transition-colors ${
                    commit.shortHash === value ? 'bg-github-bg-tertiary' : ''
                  } ${
                    commit.shortHash === disabledValue ?
                      'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <code className="text-github-text-primary font-mono">{commit.shortHash}</code>
                    <span className="text-github-text-secondary flex-1">{commit.message}</span>
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
                  disabled={branch.name === disabledValue}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-github-bg-tertiary transition-colors ${
                    branch.name === value ? 'bg-github-bg-tertiary' : ''
                  } ${
                    branch.name === disabledValue ?
                      'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                  }`}
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
      )}
    </div>
  );
}
