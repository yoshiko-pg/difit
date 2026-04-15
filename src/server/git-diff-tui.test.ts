import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadGitDiff } from './git-diff-tui.js';

const mockDiff = vi.hoisted(() => vi.fn());
const mockRaw = vi.hoisted(() => vi.fn());
const mockSimpleGit = vi.hoisted(() => vi.fn(() => ({ diff: mockDiff, raw: mockRaw })));

vi.mock('simple-git', () => ({
  default: mockSimpleGit,
}));

describe('loadGitDiff', () => {
  beforeEach(() => {
    mockDiff.mockReset();
    mockRaw.mockReset();
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
      expectedListArgs: ['HEAD^', 'HEAD', '--name-status'],
      expectedFileArgs: ['HEAD^', 'HEAD', '-U5', '--', 'src/file.ts'],
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

  it('uses merge-base for merge-base selections', async () => {
    mockRaw.mockResolvedValue('mergebase123\n');
    mockDiff
      .mockResolvedValueOnce('M\tsrc/file.ts')
      .mockResolvedValueOnce('@@ -1 +1 @@\n-old line\n+new line\n');

    await loadGitDiff(
      {
        targetCommitish: '.',
        baseCommitish: 'origin/main',
        baseMode: 'merge-base',
      },
      '/repo',
      5,
    );

    expect(mockRaw).toHaveBeenCalledWith(['merge-base', 'HEAD', 'origin/main']);
    expect(mockDiff).toHaveBeenNthCalledWith(1, ['mergebase123', '--name-status']);
    expect(mockDiff).toHaveBeenNthCalledWith(2, ['mergebase123', '-U5', '--', 'src/file.ts']);
  });
});
