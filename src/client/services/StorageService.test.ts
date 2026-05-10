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
        'repo-1',
      );
      const retrievedComments2 = service.getComments(
        'base',
        'target',
        undefined,
        undefined,
        'repo-2',
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
        'repo-1',
      );
      const retrievedFiles2 = service.getViewedFiles(
        'base',
        'target',
        undefined,
        undefined,
        'repo-2',
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

    it('preserves applied import ids when saving viewed files', () => {
      service.saveDiffContextData('base', 'target', {
        version: 2,
        baseCommitish: 'base',
        targetCommitish: 'target',
        createdAt: '2024-01-01T00:00:00Z',
        lastModifiedAt: '2024-01-01T00:00:00Z',
        threads: [],
        viewedFiles: [],
        appliedCommentImportIds: ['import-bundle-1'],
      });

      service.saveViewedFiles('base', 'target', [
        {
          filePath: 'file.ts',
          viewedAt: '2024-01-01T00:00:00Z',
          diffContentHash: 'hash',
        },
      ]);

      const data = service.getDiffContextData('base', 'target');
      expect(data?.appliedCommentImportIds).toEqual(['import-bundle-1']);
    });

    it('separates direct and merge-base diff contexts', () => {
      const directComments = [
        {
          id: 'direct-comment',
          filePath: 'test.ts',
          body: 'Direct diff comment',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          position: { side: 'new' as const, line: 10 },
        },
      ];
      const mergeBaseComments = [
        {
          id: 'merge-base-comment',
          filePath: 'test.ts',
          body: 'Merge-base diff comment',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          position: { side: 'new' as const, line: 12 },
        },
      ];

      service.saveComments('origin/main', '.', directComments, 'abc123', undefined, 'repo-1');
      service.saveComments(
        'origin/main',
        '.',
        mergeBaseComments,
        'abc123',
        undefined,
        'repo-1',
        'merge-base',
      );

      expect(service.getComments('origin/main', '.', 'abc123', undefined, 'repo-1')).toEqual(
        directComments,
      );
      expect(
        service.getComments('origin/main', '.', 'abc123', undefined, 'repo-1', 'merge-base'),
      ).toEqual(mergeBaseComments);

      const keys = (localStorage as any)._keys;
      expect(keys).toContain('difit-storage-v1/repo-1/abc123-WORKING');
      expect(keys).toContain('difit-storage-v1/repo-1/abc123-WORKING-merge-base');
      expect(keys.some((key: string) => key.endsWith('-direct'))).toBe(false);
    });
  });
});

describe('StorageService - Viewed Hash Index', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns an empty index when nothing is stored', () => {
    const index = service.getViewedHashIndex('repo-1');
    expect(index.entries).toEqual([]);
    expect(index.version).toBe(1);
  });

  it('upserts entries and reads them back', () => {
    service.recordViewedHashes('repo-1', [
      { filePath: 'a.ts', diffContentHash: 'h1', hashVersion: 1, viewedAt: '2026-01-01T00:00:00Z' },
      { filePath: 'b.ts', diffContentHash: 'h2', hashVersion: 1, viewedAt: '2026-01-01T00:00:01Z' },
    ]);

    const index = service.getViewedHashIndex('repo-1');
    expect(index.entries.map((e) => e.filePath).sort()).toEqual(['a.ts', 'b.ts']);

    // Re-recording the same (filePath, hash) pair updates viewedAt rather than duplicating.
    service.recordViewedHashes('repo-1', [
      { filePath: 'a.ts', diffContentHash: 'h1', hashVersion: 1, viewedAt: '2026-01-02T00:00:00Z' },
    ]);
    const refreshed = service.getViewedHashIndex('repo-1');
    const a = refreshed.entries.find((e) => e.filePath === 'a.ts');
    expect(a?.viewedAt).toBe('2026-01-02T00:00:00Z');
    expect(refreshed.entries).toHaveLength(2);
  });

  it('keeps independent entries for the same filePath with different hashes', () => {
    service.recordViewedHashes('repo-1', [
      { filePath: 'a.ts', diffContentHash: 'h1', hashVersion: 1, viewedAt: '2026-01-01T00:00:00Z' },
      { filePath: 'a.ts', diffContentHash: 'h2', hashVersion: 1, viewedAt: '2026-01-02T00:00:00Z' },
    ]);

    const entries = service.getViewedHashIndex('repo-1').entries;
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.diffContentHash).sort()).toEqual(['h1', 'h2']);
  });

  it('isolates the index per repositoryId', () => {
    service.recordViewedHashes('repo-1', [
      { filePath: 'a.ts', diffContentHash: 'h1', hashVersion: 1, viewedAt: '2026-01-01T00:00:00Z' },
    ]);
    service.recordViewedHashes('repo-2', [
      {
        filePath: 'a.ts',
        diffContentHash: 'other',
        hashVersion: 1,
        viewedAt: '2026-01-01T00:00:00Z',
      },
    ]);

    expect(service.getViewedHashIndex('repo-1').entries[0]!.diffContentHash).toBe('h1');
    expect(service.getViewedHashIndex('repo-2').entries[0]!.diffContentHash).toBe('other');
  });

  it('removes only the matching (path, hash) entry', () => {
    service.recordViewedHashes('repo-1', [
      { filePath: 'a.ts', diffContentHash: 'h1', hashVersion: 1, viewedAt: '2026-01-01T00:00:00Z' },
      { filePath: 'a.ts', diffContentHash: 'h2', hashVersion: 1, viewedAt: '2026-01-02T00:00:00Z' },
      { filePath: 'b.ts', diffContentHash: 'h3', hashVersion: 1, viewedAt: '2026-01-03T00:00:00Z' },
    ]);

    service.removeViewedHashes('repo-1', [{ filePath: 'a.ts', diffContentHash: 'h1' }]);
    const remaining = service.getViewedHashIndex('repo-1').entries;
    expect(remaining).toHaveLength(2);
    const aHashes = remaining.filter((e) => e.filePath === 'a.ts').map((e) => e.diffContentHash);
    expect(aHashes).toEqual(['h2']);
    expect(remaining.some((e) => e.filePath === 'b.ts' && e.diffContentHash === 'h3')).toBe(true);
  });

  it('clearViewedHashIndex empties only the targeted repository', () => {
    service.recordViewedHashes('repo-1', [
      { filePath: 'a.ts', diffContentHash: 'h1', hashVersion: 1, viewedAt: '2026-01-01T00:00:00Z' },
    ]);
    service.recordViewedHashes('repo-2', [
      { filePath: 'a.ts', diffContentHash: 'h1', hashVersion: 1, viewedAt: '2026-01-01T00:00:00Z' },
    ]);

    service.clearViewedHashIndex('repo-1');
    expect(service.getViewedHashIndex('repo-1').entries).toEqual([]);
    expect(service.getViewedHashIndex('repo-2').entries).toHaveLength(1);
  });

  it('trims to the LRU cap, dropping the oldest entries by viewedAt', () => {
    const entries = Array.from({ length: 5005 }, (_, i) => ({
      filePath: `file-${i}.ts`,
      diffContentHash: `h${i}`,
      hashVersion: 1 as const,
      // Lower index → older timestamp.
      viewedAt: new Date(2000 + i).toISOString(),
    }));
    service.recordViewedHashes('repo-1', entries);

    const stored = service.getViewedHashIndex('repo-1');
    expect(stored.entries.length).toBe(5000);
    // The five oldest entries should have been dropped.
    const paths = new Set(stored.entries.map((e) => e.filePath));
    for (let i = 0; i < 5; i++) {
      expect(paths.has(`file-${i}.ts`)).toBe(false);
    }
    expect(paths.has('file-5004.ts')).toBe(true);
  });

  it('cleanupOldData removes stale index entries alongside context entries', () => {
    service.recordViewedHashes('repo-1', [
      { filePath: 'a.ts', diffContentHash: 'h1', hashVersion: 1, viewedAt: '2020-01-01T00:00:00Z' },
    ]);
    // Force the index's lastModifiedAt to look ancient.
    const key = 'difit-viewed-index-v1/repo-1';
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
    raw.lastModifiedAt = '2020-01-01T00:00:00Z';
    localStorage.setItem(key, JSON.stringify(raw));

    service.cleanupOldData(30);
    expect(localStorage.getItem(key)).toBeNull();
  });
});
