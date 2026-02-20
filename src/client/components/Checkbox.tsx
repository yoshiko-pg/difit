import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  title?: string;
}

export function Checkbox({ checked, onChange, label, className = '', title }: CheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onChange(!checked);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 text-xs text-github-text-primary cursor-pointer ${className}`}
      title={title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 cursor-pointer ${
          checked
            ? 'bg-github-accent border-github-accent'
            : 'bg-github-bg-tertiary border-github-text-muted hover:border-github-accent/50'
        }`}
      >
        {checked && <Check size={10} className="text-white" />}
      </div>
      {label && <span className="select-none">{label}</span>}
    </div>
  );
}
