import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadGitDiff } from './git-diff-tui.js';

const mockDiff = vi.hoisted(() => vi.fn());
const mockSimpleGit = vi.hoisted(() => vi.fn(() => ({ diff: mockDiff })));

vi.mock('simple-git', () => ({
  default: mockSimpleGit,
}));

describe('loadGitDiff', () => {
  beforeEach(() => {
    mockDiff.mockReset();
    mockSimpleGit.mockClear();
  });

  it.each([
    {
      name: 'working tree diffs',
      targetCommitish: 'working',
      baseCommitish: 'staged',
      expectedListArgs: ['--name-status'],
      expectedFileArgs: ['-U5', '--', 'src/file.ts'],
    },
    {
      name: 'staged diffs',
      targetCommitish: 'staged',
      baseCommitish: 'HEAD',
      expectedListArgs: ['--cached', 'HEAD', '--name-status'],
      expectedFileArgs: ['--cached', 'HEAD', '-U5', '--', 'src/file.ts'],
    },
    {
      name: 'working tree against a base commit',
      targetCommitish: '.',
      baseCommitish: 'HEAD',
      expectedListArgs: ['HEAD', '--name-status'],
      expectedFileArgs: ['HEAD', '-U5', '--', 'src/file.ts'],
    },
    {
      name: 'commit comparisons',
      targetCommitish: 'HEAD',
      baseCommitish: 'HEAD^',
      expectedListArgs: ['HEAD^...HEAD', '--name-status'],
      expectedFileArgs: ['HEAD^...HEAD', '-U5', '--', 'src/file.ts'],
    },
  ])(
    'passes context lines for $name',
    async ({ targetCommitish, baseCommitish, expectedListArgs, expectedFileArgs }) => {
      mockDiff
        .mockResolvedValueOnce('M\tsrc/file.ts')
        .mockResolvedValueOnce('@@ -1 +1 @@\n-old line\n+new line\n');

      const result = await loadGitDiff({ targetCommitish, baseCommitish }, '/repo', 5);

      expect(mockSimpleGit).toHaveBeenCalledWith('/repo');
      expect(mockDiff).toHaveBeenNthCalledWith(1, expectedListArgs);
      expect(mockDiff).toHaveBeenNthCalledWith(2, expectedFileArgs);
      expect(result).toEqual([
        {
          path: 'src/file.ts',
          status: 'M',
          diff: '@@ -1 +1 @@\n-old line\n+new line\n',
          additions: 1,
          deletions: 1,
        },
      ]);
    },
  );
});
