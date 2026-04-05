import simpleGit from 'simple-git';

import { validateDiffArguments, createCommitRangeString } from '../cli/utils.js';
import type { DiffSelection, FileDiff } from '../types/diff.js';
import { getMergeBaseTargetRef, normalizeBaseMode } from '../utils/diffSelection.js';

export async function loadGitDiff(
  selection: DiffSelection,
  repoPath?: string,
  contextLines?: number,
): Promise<FileDiff[]> {
  const { targetCommitish, baseCommitish } = selection;

  // Validate arguments
  const validation = validateDiffArguments(targetCommitish, baseCommitish);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const git = simpleGit(repoPath);
  const effectiveBaseCommitish =
    normalizeBaseMode(selection.baseMode) === 'merge-base'
      ? (
          await git.raw(['merge-base', getMergeBaseTargetRef(targetCommitish), baseCommitish])
        ).trim()
      : baseCommitish;
  let diff: string;

  // Handle target special chars (base is always a regular commit)
  if (targetCommitish === 'working') {
    // Show unstaged changes (working vs staged)
    diff = await git.diff(['--name-status']);
  } else if (targetCommitish === 'staged') {
    // Show staged changes against base commit
    diff = await git.diff(['--cached', effectiveBaseCommitish, '--name-status']);
  } else if (targetCommitish === '.') {
    // Show all uncommitted changes against base commit
    diff = await git.diff([effectiveBaseCommitish, '--name-status']);
  } else {
    // Both are regular commits: standard commit-to-commit comparison
    diff = await git.diff([
      createCommitRangeString(effectiveBaseCommitish, targetCommitish),
      '--name-status',
    ]);

    if (!diff.trim()) {
      // Try without parent (for initial commit)
      const diffInitial = await git.diff([targetCommitish, '--name-status']);
      if (!diffInitial.trim()) {
        throw new Error('No changes found in this commit');
      }
      diff = diffInitial;
    }
  }

  const fileChanges = diff
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [status, ...pathParts] = line.split('\t');
      const path = pathParts.join('\t');
      return { status, path };
    });

  const contextArgs = contextLines !== undefined ? [`-U${contextLines}`] : [];

  // Get diff for each file individually
  const fileDiffs: FileDiff[] = await Promise.all(
    fileChanges.map(async ({ status, path }) => {
      let fileDiff = '';

      // Handle individual file diffs (base is always a regular commit)
      if (targetCommitish === 'working') {
        // Show unstaged changes (working vs staged)
        fileDiff = await git.diff([...contextArgs, '--', path]);
      } else if (targetCommitish === 'staged') {
        // Show staged changes against base commit
        fileDiff = await git.diff(['--cached', effectiveBaseCommitish, ...contextArgs, '--', path]);
      } else if (targetCommitish === '.') {
        // Show all uncommitted changes against base commit
        fileDiff = await git.diff([effectiveBaseCommitish, ...contextArgs, '--', path]);
      } else {
        try {
          // Both are regular commits: standard commit-to-commit comparison
          fileDiff = await git.diff([
            createCommitRangeString(effectiveBaseCommitish, targetCommitish),
            ...contextArgs,
            '--',
            path,
          ]);
        } catch {
          // For new files or if parent doesn't exist
          fileDiff = await git.diff([targetCommitish, ...contextArgs, '--', path]);
        }
      }

      const lines = fileDiff.split('\n');
      let additions = 0;
      let deletions = 0;

      lines.forEach((line) => {
        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
        if (line.startsWith('-') && !line.startsWith('---')) deletions++;
      });

      return {
        path,
        status: status as 'A' | 'M' | 'D',
        diff: fileDiff,
        additions,
        deletions,
      };
    }),
  );

  return fileDiffs;
}
