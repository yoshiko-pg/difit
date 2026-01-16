import simpleGit from 'simple-git';

import { validateDiffArguments, createCommitRangeString } from '../cli/utils.js';
import type { FileDiff } from '../types/diff.js';

export async function loadGitDiff(
  targetCommitish: string,
  baseCommitish: string,
  repoPath?: string
): Promise<FileDiff[]> {
  // Validate arguments
  const validation = validateDiffArguments(targetCommitish, baseCommitish);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const git = simpleGit(repoPath);
  let diff: string;

  // Handle target special chars (base is always a regular commit)
  if (targetCommitish === 'working') {
    // Show unstaged changes (working vs staged)
    diff = await git.diff(['--name-status']);
  } else if (targetCommitish === 'staged') {
    // Show staged changes against base commit
    diff = await git.diff(['--cached', baseCommitish, '--name-status']);
  } else if (targetCommitish === '.') {
    // Show all uncommitted changes against base commit
    diff = await git.diff([baseCommitish, '--name-status']);
  } else {
    // Both are regular commits: standard commit-to-commit comparison
    diff = await git.diff([
      createCommitRangeString(baseCommitish, targetCommitish),
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

  // Get diff for each file individually
  const fileDiffs: FileDiff[] = await Promise.all(
    fileChanges.map(async ({ status, path }) => {
      let fileDiff = '';

      // Handle individual file diffs (base is always a regular commit)
      if (targetCommitish === 'working') {
        // Show unstaged changes (working vs staged)
        fileDiff = await git.diff(['--', path]);
      } else if (targetCommitish === 'staged') {
        // Show staged changes against base commit
        fileDiff = await git.diff(['--cached', baseCommitish, '--', path]);
      } else if (targetCommitish === '.') {
        // Show all uncommitted changes against base commit
        fileDiff = await git.diff([baseCommitish, '--', path]);
      } else {
        try {
          // Both are regular commits: standard commit-to-commit comparison
          fileDiff = await git.diff([
            createCommitRangeString(baseCommitish, targetCommitish),
            '--',
            path,
          ]);
        } catch {
          // For new files or if parent doesn't exist
          fileDiff = await git.diff([targetCommitish, '--', path]);
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
    })
  );

  return fileDiffs;
}
