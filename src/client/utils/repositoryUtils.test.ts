import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { getRepositoryIdentifier, clearRepositoryIdentifierCache } from './repositoryUtils';

describe('repositoryUtils', () => {
  beforeEach(() => {
    clearRepositoryIdentifierCache();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRepositoryIdentifier', () => {
    it('should fetch and hash repository identifier', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          remoteUrl: 'git@github.com:user/repo.git',
          repositoryPath: '/path/to/repo',
          repositoryIdentifier: 'git@github.com:user/repo.git',
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await getRepositoryIdentifier();

      expect(global.fetch).toHaveBeenCalledWith('/api/repository-info');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      // SHA-256 hash should be 64 characters (hex)
      expect(result.length).toBe(64);
    });

    it('should cache repository identifier after first fetch', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          remoteUrl: 'git@github.com:user/repo.git',
          repositoryPath: '/path/to/repo',
          repositoryIdentifier: 'git@github.com:user/repo.git',
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      // First call - should fetch
      const result1 = await getRepositoryIdentifier();

      // Second call - should use cache
      const result2 = await getRepositoryIdentifier();

      // fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
      // Results should be the same
      expect(result1).toBe(result2);
    });

    it('should return "default" fallback on fetch error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const result = await getRepositoryIdentifier();

      expect(result).toBe('default');
    });

    it('should return "default" fallback on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await getRepositoryIdentifier();

      expect(result).toBe('default');
    });

    it('should generate different hashes for different repositories', async () => {
      clearRepositoryIdentifierCache();

      const mockResponse1 = {
        ok: true,
        json: async () => ({
          repositoryIdentifier: 'git@github.com:user/repo1.git',
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse1);
      const hash1 = await getRepositoryIdentifier();

      clearRepositoryIdentifierCache();

      const mockResponse2 = {
        ok: true,
        json: async () => ({
          repositoryIdentifier: 'git@github.com:user/repo2.git',
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse2);
      const hash2 = await getRepositoryIdentifier();

      expect(hash1).not.toBe(hash2);
      expect(hash1.length).toBe(64);
      expect(hash2.length).toBe(64);
    });

    it('should use repositoryPath as fallback when remoteUrl is null', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          remoteUrl: null,
          repositoryPath: '/path/to/local/repo',
          repositoryIdentifier: '/path/to/local/repo',
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await getRepositoryIdentifier();

      expect(result).toBeTruthy();
      expect(result.length).toBe(64);
    });

    it('should clear cache when clearRepositoryIdentifierCache is called', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          repositoryIdentifier: 'git@github.com:user/repo.git',
        }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      // First call
      await getRepositoryIdentifier();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearRepositoryIdentifierCache();

      // Second call should fetch again
      await getRepositoryIdentifier();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
