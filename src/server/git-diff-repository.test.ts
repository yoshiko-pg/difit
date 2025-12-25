import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GitDiffParser } from './git-diff';

describe('GitDiffParser - getRemoteUrl', () => {
  let parser: GitDiffParser;

  beforeEach(() => {
    parser = new GitDiffParser();
  });

  it('should return remote URL for origin remote', async () => {
    // Mock the git.getRemotes method
    const mockGetRemotes = vi.fn().mockResolvedValue([
      {
        name: 'origin',
        refs: {
          fetch: 'https://github.com/user/repo.git',
          push: 'https://github.com/user/repo.git',
        },
      },
    ]);

    // Replace the git instance with a mock
    (parser as any).git = {
      getRemotes: mockGetRemotes,
    };

    const result = await parser.getRemoteUrl();

    expect(result).toBe('https://github.com/user/repo.git');
    expect(mockGetRemotes).toHaveBeenCalledWith(true);
  });

  it('should return first remote if origin is not found', async () => {
    const mockGetRemotes = vi.fn().mockResolvedValue([
      {
        name: 'upstream',
        refs: {
          fetch: 'https://github.com/org/repo.git',
          push: 'https://github.com/org/repo.git',
        },
      },
    ]);

    (parser as any).git = {
      getRemotes: mockGetRemotes,
    };

    const result = await parser.getRemoteUrl();

    expect(result).toBe('https://github.com/org/repo.git');
  });

  it('should return null when no remotes are configured', async () => {
    const mockGetRemotes = vi.fn().mockResolvedValue([]);

    (parser as any).git = {
      getRemotes: mockGetRemotes,
    };

    const result = await parser.getRemoteUrl();

    expect(result).toBeNull();
  });

  it('should return null when remote has no fetch URL', async () => {
    const mockGetRemotes = vi.fn().mockResolvedValue([
      {
        name: 'origin',
        refs: {},
      },
    ]);

    (parser as any).git = {
      getRemotes: mockGetRemotes,
    };

    const result = await parser.getRemoteUrl();

    expect(result).toBeNull();
  });

  it('should return null on git command error', async () => {
    const mockGetRemotes = vi.fn().mockRejectedValue(new Error('Git command failed'));

    (parser as any).git = {
      getRemotes: mockGetRemotes,
    };

    const result = await parser.getRemoteUrl();

    expect(result).toBeNull();
  });

  it('should prefer origin over other remotes', async () => {
    const mockGetRemotes = vi.fn().mockResolvedValue([
      {
        name: 'upstream',
        refs: {
          fetch: 'https://github.com/org/repo.git',
        },
      },
      {
        name: 'origin',
        refs: {
          fetch: 'https://github.com/user/repo.git',
        },
      },
    ]);

    (parser as any).git = {
      getRemotes: mockGetRemotes,
    };

    const result = await parser.getRemoteUrl();

    // Should return origin, not upstream
    expect(result).toBe('https://github.com/user/repo.git');
  });

  it('should handle SSH URLs', async () => {
    const mockGetRemotes = vi.fn().mockResolvedValue([
      {
        name: 'origin',
        refs: {
          fetch: 'git@github.com:user/repo.git',
        },
      },
    ]);

    (parser as any).git = {
      getRemotes: mockGetRemotes,
    };

    const result = await parser.getRemoteUrl();

    expect(result).toBe('git@github.com:user/repo.git');
  });
});
