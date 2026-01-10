import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { StorageService } from './StorageService';

// Mock localStorage with proper Storage interface
class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value.toString();
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  // Helper method to get all keys (for testing)
  get _keys(): string[] {
    return Object.keys(this.store);
  }
}

const localStorageMock = new LocalStorageMock();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

describe('StorageService - Repository Isolation', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Repository ID in storage keys', () => {
    it('should include repositoryId in storage key when provided', () => {
      const comments = [
        {
          id: 'comment-1',
          filePath: 'test.ts',
          body: 'Test comment',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 10 },
        },
      ];

      service.saveComments('base', 'target', comments, undefined, undefined, 'repo-123');

      // Check that the key includes the repository ID
      const keys = (localStorage as any)._keys;
      expect(keys.length).toBe(1);
      expect(keys[0]).toContain('repo-123');
    });

    it('should generate different keys for different repository IDs', () => {
      const comments1 = [
        {
          id: 'comment-1',
          filePath: 'test.ts',
          body: 'Comment in repo 1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 10 },
        },
      ];

      const comments2 = [
        {
          id: 'comment-2',
          filePath: 'test.ts',
          body: 'Comment in repo 2',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 10 },
        },
      ];

      service.saveComments('base', 'target', comments1, undefined, undefined, 'repo-1');
      service.saveComments('base', 'target', comments2, undefined, undefined, 'repo-2');

      // Should have two different keys
      const keys = (localStorage as any)._keys;
      expect(keys.length).toBe(2);
      expect(keys.some((k: string) => k.includes('repo-1'))).toBe(true);
      expect(keys.some((k: string) => k.includes('repo-2'))).toBe(true);
    });

    it('should isolate comments between different repositories', () => {
      const comments1 = [
        {
          id: 'comment-1',
          filePath: 'test.ts',
          body: 'Comment in repo 1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 10 },
        },
      ];

      const comments2 = [
        {
          id: 'comment-2',
          filePath: 'test.ts',
          body: 'Comment in repo 2',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 10 },
        },
      ];

      // Save comments to different repositories
      service.saveComments('base', 'target', comments1, undefined, undefined, 'repo-1');
      service.saveComments('base', 'target', comments2, undefined, undefined, 'repo-2');

      // Retrieve comments for each repository
      const retrievedComments1 = service.getComments(
        'base',
        'target',
        undefined,
        undefined,
        'repo-1'
      );
      const retrievedComments2 = service.getComments(
        'base',
        'target',
        undefined,
        undefined,
        'repo-2'
      );

      // Each repository should only see its own comments
      expect(retrievedComments1.length).toBe(1);
      expect(retrievedComments1[0]?.id).toBe('comment-1');
      expect(retrievedComments2.length).toBe(1);
      expect(retrievedComments2[0]?.id).toBe('comment-2');
    });

    it('should isolate viewed files between different repositories', () => {
      const viewedFiles1 = [
        {
          filePath: 'file1.ts',
          viewedAt: '2024-01-01T00:00:00Z',
          diffContentHash: 'hash1',
        },
      ];

      const viewedFiles2 = [
        {
          filePath: 'file2.ts',
          viewedAt: '2024-01-01T00:00:00Z',
          diffContentHash: 'hash2',
        },
      ];

      // Save viewed files to different repositories
      service.saveViewedFiles('base', 'target', viewedFiles1, undefined, undefined, 'repo-1');
      service.saveViewedFiles('base', 'target', viewedFiles2, undefined, undefined, 'repo-2');

      // Retrieve viewed files for each repository
      const retrievedFiles1 = service.getViewedFiles(
        'base',
        'target',
        undefined,
        undefined,
        'repo-1'
      );
      const retrievedFiles2 = service.getViewedFiles(
        'base',
        'target',
        undefined,
        undefined,
        'repo-2'
      );

      // Each repository should only see its own viewed files
      expect(retrievedFiles1.length).toBe(1);
      expect(retrievedFiles1[0]?.filePath).toBe('file1.ts');
      expect(retrievedFiles2.length).toBe(1);
      expect(retrievedFiles2[0]?.filePath).toBe('file2.ts');
    });

    it('should work without repositoryId (backward compatibility)', () => {
      const comments = [
        {
          id: 'comment-1',
          filePath: 'test.ts',
          body: 'Test comment',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 10 },
        },
      ];

      // Save without repositoryId
      service.saveComments('base', 'target', comments);

      // Should be able to retrieve without repositoryId
      const retrieved = service.getComments('base', 'target');
      expect(retrieved.length).toBe(1);
      expect(retrieved[0]?.id).toBe('comment-1');
    });

    it('should isolate working diff data between repositories', () => {
      const comments = [
        {
          id: 'working-comment',
          filePath: 'test.ts',
          body: 'Working diff comment',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 10 },
        },
      ];

      // Save comments for working diff in repo 1
      service.saveComments('HEAD', 'working', comments, 'abc123', undefined, 'repo-1');

      // Try to retrieve from repo 2 - should get empty array
      const retrieved = service.getComments('HEAD', 'working', 'abc123', undefined, 'repo-2');
      expect(retrieved.length).toBe(0);

      // Retrieve from repo 1 - should get the comment
      const retrieved1 = service.getComments('HEAD', 'working', 'abc123', undefined, 'repo-1');
      expect(retrieved1.length).toBe(1);
      expect(retrieved1[0]?.id).toBe('working-comment');
    });
  });
});
