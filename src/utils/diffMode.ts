import type { DiffViewMode, PreviewMode } from '../types/diff.js';

export const DEFAULT_DIFF_VIEW_MODE: DiffViewMode = 'split';

export function normalizeDiffViewMode(mode?: string | null): DiffViewMode {
  switch (mode) {
    case 'split':
    case 'side-by-side':
      return 'split';
    case 'unified':
    case 'inline':
      return 'unified';
    default:
      return DEFAULT_DIFF_VIEW_MODE;
  }
}

export const DEFAULT_PREVIEW_MODE: PreviewMode = 'diff-preview';

export function normalizePreviewMode(mode?: string | null): PreviewMode {
  switch (mode) {
    case 'diff':
    case 'diff-preview':
    case 'full-preview':
      return mode;
    default:
      return DEFAULT_PREVIEW_MODE;
  }
}
