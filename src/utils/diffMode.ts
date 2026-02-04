import type { DiffViewMode } from '../types/diff.js';

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
