import { describe, it, expect, beforeEach } from 'vitest';

import { StorageService } from './StorageService';

describe('StorageService - Repository Isolation', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
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
      const keys = Object.keys(localStorage);
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
      const keys = Object.keys(localStorage);
      expect(keys.length).toBe(2);
      expect(keys.some((k) => k.includes('repo-1'))).toBe(true);
      expect(keys.some((k) => k.includes('repo-2'))).toBe(true);
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

  describe('Data Migration from Old Format', () => {
    it('should NOT automatically migrate commit-to-commit data (to prevent cross-repo pollution)', () => {
      const comments = [
        {
          id: 'old-comment',
          filePath: 'test.ts',
          body: 'Comment in old format',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 10 },
        },
      ];

      // Save data in old format (without repositoryId) for commit-to-commit comparison
      service.saveComments('abc123', 'def456', comments, undefined, undefined, undefined);

      // Verify old format data exists
      const oldFormatData = service.getComments(
        'abc123',
        'def456',
        undefined,
        undefined,
        undefined
      );
      expect(oldFormatData.length).toBe(1);

      // Read with repositoryId - should NOT trigger migration for commit-to-commit
      const newRepoData = service.getComments('abc123', 'def456', undefined, undefined, 'repo-123');

      // Should get empty array (no migration)
      expect(newRepoData.length).toBe(0);

      // Verify new format data was NOT created
      const newFormatData = service.getDiffContextData(
        'abc123',
        'def456',
        undefined,
        undefined,
        'repo-123'
      );
      expect(newFormatData).toBeNull();

      // Old format should still exist
      const oldFormatStillExists = service.getComments('abc123', 'def456');
      expect(oldFormatStillExists.length).toBe(1);
    });

    it('should automatically migrate working diff viewed files from old format', () => {
      const viewedFiles = [
        {
          filePath: 'oldfile.ts',
          viewedAt: '2024-01-01T00:00:00Z',
          diffContentHash: 'hash-old',
        },
      ];

      // Save in old format for working diff
      service.saveViewedFiles('HEAD', 'WORKING', viewedFiles);

      // Read with repositoryId - should trigger migration for working diff
      const migratedFiles = service.getViewedFiles(
        'HEAD',
        'WORKING',
        undefined,
        undefined,
        'repo-456'
      );

      // Should get the same data
      expect(migratedFiles.length).toBe(1);
      expect(migratedFiles[0]?.filePath).toBe('oldfile.ts');

      // Verify new format exists
      const newFormatData = service.getDiffContextData(
        'HEAD',
        'WORKING',
        undefined,
        undefined,
        'repo-456'
      );
      expect(newFormatData).not.toBeNull();
      expect(newFormatData?.viewedFiles.length).toBe(1);
    });

    it('should migrate working diff data from old format', () => {
      const comments = [
        {
          id: 'working-old',
          filePath: 'working.ts',
          body: 'Old working diff comment',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ working @@',
          position: { side: 'new' as const, line: 5 },
        },
      ];

      // Save working diff data in old format
      service.saveComments('HEAD', 'working', comments, 'commit-hash');

      // Read with repositoryId - should migrate
      const migrated = service.getComments('HEAD', 'working', 'commit-hash', undefined, 'repo-789');

      expect(migrated.length).toBe(1);
      expect(migrated[0]?.id).toBe('working-old');

      // Verify migration to new format
      const newFormat = service.getDiffContextData(
        'HEAD',
        'working',
        'commit-hash',
        undefined,
        'repo-789'
      );
      expect(newFormat).not.toBeNull();
      expect(newFormat?.comments[0]?.id).toBe('working-old');
    });

    it('should not migrate if new format already has data (working diff)', () => {
      const oldComments = [
        {
          id: 'old-comment',
          filePath: 'test.ts',
          body: 'Old data',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 10 },
        },
      ];

      const newComments = [
        {
          id: 'new-comment',
          filePath: 'test.ts',
          body: 'New data',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          chunkHeader: '@@ test @@',
          position: { side: 'new' as const, line: 20 },
        },
      ];

      // Save old format for working diff
      service.saveComments('HEAD', 'WORKING', oldComments);

      // Save new format
      service.saveComments('HEAD', 'WORKING', newComments, undefined, undefined, 'repo-999');

      // Read with repositoryId - should get new format, not migrate old
      const retrieved = service.getComments('HEAD', 'WORKING', undefined, undefined, 'repo-999');

      expect(retrieved.length).toBe(1);
      expect(retrieved[0]?.id).toBe('new-comment');
      expect(retrieved[0]?.body).toBe('New data');
    });

    it('should handle migration when old format has no data', () => {
      // Try to read with repositoryId when nothing exists
      const comments = service.getComments('base', 'target', undefined, undefined, 'repo-empty');

      // Should return empty array
      expect(comments.length).toBe(0);

      // No migration should occur
      const keys = Object.keys(localStorage);
      expect(keys.length).toBe(0);
    });

    it('should preserve all fields during working diff migration', () => {
      const viewedFiles = [
        {
          filePath: 'file1.ts',
          viewedAt: '2024-01-01T10:30:00Z',
          diffContentHash: 'abc123hash',
        },
        {
          filePath: 'file2.ts',
          viewedAt: '2024-01-01T11:45:00Z',
          diffContentHash: 'def456hash',
        },
      ];

      const comments = [
        {
          id: 'comment-1',
          filePath: 'file1.ts',
          body: 'First comment',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          chunkHeader: '@@ chunk1 @@',
          position: { side: 'new' as const, line: 10 },
        },
        {
          id: 'comment-2',
          filePath: 'file2.ts',
          body: 'Second comment',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          chunkHeader: '@@ chunk2 @@',
          position: { side: 'old' as const, line: 20 },
        },
      ];

      // Save old format for working diff with both comments and viewed files
      service.saveComments('HEAD', 'working', comments);
      service.saveViewedFiles('HEAD', 'working', viewedFiles);

      // Migrate by reading with repositoryId
      const migratedComments = service.getComments(
        'HEAD',
        'working',
        undefined,
        undefined,
        'repo-preserve'
      );
      const migratedFiles = service.getViewedFiles(
        'HEAD',
        'working',
        undefined,
        undefined,
        'repo-preserve'
      );

      // Verify all comments preserved
      expect(migratedComments.length).toBe(2);
      expect(migratedComments[0]?.id).toBe('comment-1');
      expect(migratedComments[0]?.body).toBe('First comment');
      expect(migratedComments[0]?.position.side).toBe('new');
      expect(migratedComments[1]?.id).toBe('comment-2');
      expect(migratedComments[1]?.position.side).toBe('old');

      // Verify all viewed files preserved
      expect(migratedFiles.length).toBe(2);
      expect(migratedFiles[0]?.filePath).toBe('file1.ts');
      expect(migratedFiles[0]?.diffContentHash).toBe('abc123hash');
      expect(migratedFiles[1]?.filePath).toBe('file2.ts');
      expect(migratedFiles[1]?.diffContentHash).toBe('def456hash');
    });
  });
});
