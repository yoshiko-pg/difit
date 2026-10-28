import { Columns2, Eye, FileDiff } from 'lucide-react';
import type { ReactNode } from 'react';

export type PreviewMode = 'diff' | 'split-preview' | 'diff-preview' | 'full-preview';

export const DEFAULT_PREVIEW_MODE: PreviewMode = 'split-preview';

const PREVIEW_MODES: PreviewMode[] = ['diff', 'split-preview', 'diff-preview', 'full-preview'];

export const parsePreviewMode = (value: unknown): PreviewMode | null =>
  PREVIEW_MODES.find((mode) => mode === value) ?? null;

type PreviewModeTabsProps = {
  mode: PreviewMode;
  hasFullPreview: boolean;
  hasSplitPreview: boolean;
  onModeChange: (mode: PreviewMode) => void;
};

const TabButton = ({
  isActive,
  title,
  label = title,
  icon,
  onClick,
}: {
  isActive: boolean;
  title: string;
  label?: string;
  icon: ReactNode;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`px-2 py-1 text-xs font-medium rounded transition-colors duration-200 flex items-center gap-1 cursor-pointer ${
      isActive
        ? 'text-github-text-primary'
        : 'text-github-text-secondary hover:text-github-text-primary'
    }`}
    title={title}
  >
    {icon}
    {label}
  </button>
);

export const PreviewModeTabs = ({
  mode,
  hasFullPreview,
  hasSplitPreview,
  onModeChange,
}: PreviewModeTabsProps) => (
  <div className="flex items-center gap-1.5">
    <TabButton
      isActive={mode === 'diff'}
      title="Code Diff"
      label="Diff"
      icon={<FileDiff size={14} />}
      onClick={() => onModeChange('diff')}
    />
    {hasSplitPreview && (
      <TabButton
        isActive={mode === 'split-preview'}
        title="Split Preview"
        icon={<Columns2 size={14} />}
        onClick={() => onModeChange('split-preview')}
      />
    )}
    <TabButton
      isActive={mode === 'diff-preview'}
      title="Diff Preview"
      icon={<Eye size={14} />}
      onClick={() => onModeChange('diff-preview')}
    />
    {hasFullPreview && (
      <TabButton
        isActive={mode === 'full-preview'}
        title="Full Preview"
        icon={<Eye size={14} />}
        onClick={() => onModeChange('full-preview')}
      />
    )}
  </div>
);
