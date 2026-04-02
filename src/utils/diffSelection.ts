import type { DiffSelection } from '../types/diff.js';

export function createDiffSelection(baseCommitish: string, targetCommitish: string): DiffSelection {
  return {
    baseCommitish,
    targetCommitish,
  };
}

export function diffSelectionsEqual(
  left: DiffSelection | null | undefined,
  right: DiffSelection | null | undefined,
): boolean {
  return (
    left?.baseCommitish === right?.baseCommitish && left?.targetCommitish === right?.targetCommitish
  );
}

export function getDiffSelectionKey(selection: DiffSelection): string {
  return `${selection.baseCommitish}:${selection.targetCommitish}`;
}
