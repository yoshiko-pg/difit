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
  // Filter special options based on working/staged constraints
  const getFilteredSpecialOptions = () => {
    return options.specialOptions.filter((opt) => {
      // If this is the base selector and 'working' is selected as target,
      // only 'staged' is valid as base
      if (isBaseSelector && disabledValue === 'working') {
        return opt.value === 'staged';
      }
      // If this is the target selector and 'staged' is selected as base,
      // only 'working' is valid as target
      if (!isBaseSelector && disabledValue === 'staged') {
        return opt.value === 'working';
      }
      // 'working' can only be used as target (not base)
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

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-github-text-secondary">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-github-bg-tertiary border border-github-border rounded text-xs text-github-text-primary px-2 py-1 max-w-[180px]"
      >
        {/* Special Options */}
        {filteredSpecialOptions.length > 0 && (
          <optgroup label="Special">
            {filteredSpecialOptions.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.value === disabledValue}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        )}

        {/* Recent Commits - hide in working/staged mode */}
        {!isWorkingStagedMode && options.commits.length > 0 && (
          <optgroup label="Recent Commits">
            {options.commits.map((commit) => (
              <option
                key={commit.hash}
                value={commit.shortHash}
                disabled={commit.shortHash === disabledValue}
              >
                {commit.shortHash} - {commit.message}
              </option>
            ))}
          </optgroup>
        )}

        {/* Branches - hide in working/staged mode */}
        {!isWorkingStagedMode && options.branches.length > 0 && (
          <optgroup label="Branches">
            {options.branches.map((branch) => (
              <option
                key={branch.name}
                value={branch.name}
                disabled={branch.name === disabledValue}
              >
                {branch.name}
                {branch.current ? ' (current)' : ''}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
