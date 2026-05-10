import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  type DiffFile,
  type ViewedFileRecord,
  type ViewedHashIndex,
  type ViewedHashIndexEntry,
} from '../../types/diff';

import { useViewedFiles } from './useViewedFiles';

// Mock StorageService
const mockGetViewedFiles = vi.fn((): ViewedFileRecord[] => []);
const mockSaveViewedFiles = vi.fn();
const mockGetViewedHashIndex = vi.fn(
  (_repositoryId?: string): ViewedHashIndex => ({
    version: 1,
    lastModifiedAt: new Date(0).toISOString(),
    entries: [],
  }),
);
const mockRecordViewedHashes = vi.fn(
  (_repositoryId: string | undefined, _entries: ViewedHashIndexEntry[]) => {},
);
const mockRemoveViewedHashes = vi.fn(
  (
    _repositoryId: string | undefined,
    _entries: Array<{ filePath: string; diffContentHash: string }>,
  ) => {},
);
const mockClearViewedHashIndex = vi.fn((_repositoryId?: string) => {});

vi.mock('../services/StorageService', () => ({
  VIEWED_HASH_VERSION: 1,
  storageService: {
    getViewedFiles: () => mockGetViewedFiles(),
    saveViewedFiles: (...args: unknown[]) => mockSaveViewedFiles(...args),
    getViewedHashIndex: (repositoryId?: string) => mockGetViewedHashIndex(repositoryId),
    recordViewedHashes: (repositoryId: string | undefined, entries: ViewedHashIndexEntry[]) =>
      mockRecordViewedHashes(repositoryId, entries),
    removeViewedHashes: (
      repositoryId: string | undefined,
      entries: Array<{ filePath: string; diffContentHash: string }>,
    ) => mockRemoveViewedHashes(repositoryId, entries),
    clearViewedHashIndex: (repositoryId?: string) => mockClearViewedHashIndex(repositoryId),
  },
}));

// Mock diffUtils
vi.mock('../utils/diffUtils', () => ({
  generateDiffHash: vi.fn(async (content: string) => `hash-${content.slice(0, 10)}`),
  getDiffContentForHashing: vi.fn((file: DiffFile) => `${file.path}-${file.status}`),
}));

// Helper to create a mock DiffFile
function createMockDiffFile(
  path: string,
  status: 'modified' | 'added' | 'deleted' | 'renamed' = 'modified',
  isGenerated = false,
): DiffFile {
  return {
    path,
    status,
    additions: 10,
    deletions: 5,
    chunks: [],
    isGenerated,
  };
}

describe('useViewedFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetViewedFiles.mockReturnValue([]);
    mockGetViewedHashIndex.mockReturnValue({
      version: 1,
      lastModifiedAt: new Date(0).toISOString(),
      entries: [],
    });
  });

  describe('initial state', () => {
    it('should initialize with empty viewed files', () => {
      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      expect(result.current.viewedFiles.size).toBe(0);
    });

    it('should not initialize without commitish values', () => {
      const { result } = renderHook(() => useViewedFiles(undefined, undefined));

      expect(mockGetViewedFiles).not.toHaveBeenCalled();
      expect(result.current.viewedFiles.size).toBe(0);
    });
  });

  describe('loading viewed files from storage', () => {
    it('should load viewed files from storage on mount', async () => {
      const storedRecords: ViewedFileRecord[] = [
        { filePath: 'src/file1.ts', viewedAt: '2024-01-01T00:00:00Z', diffContentHash: 'hash1' },
        { filePath: 'src/file2.ts', viewedAt: '2024-01-01T00:00:00Z', diffContentHash: 'hash2' },
      ];
      mockGetViewedFiles.mockReturnValue(storedRecords);

      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      await waitFor(() => {
        expect(result.current.viewedFiles.size).toBe(2);
      });

      expect(result.current.viewedFiles.has('src/file1.ts')).toBe(true);
      expect(result.current.viewedFiles.has('src/file2.ts')).toBe(true);
    });
  });

  describe('auto-collapsing files', () => {
    it('should auto-mark generated files as viewed', async () => {
      const initialFiles: DiffFile[] = [
        createMockDiffFile('package-lock.json', 'modified', true),
        createMockDiffFile('src/app.ts', 'modified', false),
      ];

      const { result } = renderHook(() =>
        useViewedFiles('main', 'feature-branch', 'abc123', undefined, initialFiles),
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.has('package-lock.json')).toBe(true);
      });

      expect(result.current.viewedFiles.has('src/app.ts')).toBe(false);
      expect(mockSaveViewedFiles).toHaveBeenCalled();
    });

    it('should auto-mark deleted files as viewed', async () => {
      const initialFiles: DiffFile[] = [
        createMockDiffFile('src/old-file.ts', 'deleted', false),
        createMockDiffFile('src/app.ts', 'modified', false),
      ];

      const { result } = renderHook(() =>
        useViewedFiles('main', 'feature-branch', 'abc123', undefined, initialFiles),
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/old-file.ts')).toBe(true);
      });

      expect(result.current.viewedFiles.has('src/app.ts')).toBe(false);
      expect(mockSaveViewedFiles).toHaveBeenCalled();
    });

    it('should auto-mark files matching configured auto-viewed patterns', async () => {
      const initialFiles: DiffFile[] = [
        createMockDiffFile('src/app.test.ts', 'modified', false),
        createMockDiffFile('src/app.ts', 'modified', false),
      ];

      const { result } = renderHook(() =>
        useViewedFiles('main', 'feature-branch', 'abc123', undefined, initialFiles, undefined, [
          '*.test.ts',
        ]),
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/app.test.ts')).toBe(true);
      });

      expect(result.current.viewedFiles.has('src/app.ts')).toBe(false);
      expect(mockSaveViewedFiles).toHaveBeenCalled();
    });

    it('should auto-mark both generated and deleted files as viewed', async () => {
      const initialFiles: DiffFile[] = [
        createMockDiffFile('package-lock.json', 'modified', true),
        createMockDiffFile('src/deleted.ts', 'deleted', false),
        createMockDiffFile('src/app.ts', 'modified', false),
      ];

      const { result } = renderHook(() =>
        useViewedFiles('main', 'feature-branch', 'abc123', undefined, initialFiles),
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.size).toBe(2);
      });

      expect(result.current.viewedFiles.has('package-lock.json')).toBe(true);
      expect(result.current.viewedFiles.has('src/deleted.ts')).toBe(true);
      expect(result.current.viewedFiles.has('src/app.ts')).toBe(false);
    });

    it('should not re-add already viewed files', async () => {
      const storedRecords: ViewedFileRecord[] = [
        {
          filePath: 'package-lock.json',
          viewedAt: '2024-01-01T00:00:00Z',
          diffContentHash: 'existing-hash',
        },
      ];
      mockGetViewedFiles.mockReturnValue(storedRecords);

      const initialFiles: DiffFile[] = [
        createMockDiffFile('package-lock.json', 'modified', true),
        createMockDiffFile('src/deleted.ts', 'deleted', false),
      ];

      const { result } = renderHook(() =>
        useViewedFiles('main', 'feature-branch', 'abc123', undefined, initialFiles),
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.size).toBe(2);
      });

      // The saved records should include the existing one plus the new deleted file
      const saveCall = mockSaveViewedFiles.mock.calls[0];
      const savedRecords = saveCall?.[2] as ViewedFileRecord[];
      expect(savedRecords).toHaveLength(2);

      // The existing record should keep its original hash
      const existingRecord = savedRecords?.find((r) => r.filePath === 'package-lock.json');
      expect(existingRecord?.diffContentHash).toBe('existing-hash');
    });
  });

  describe('toggleFileViewed', () => {
    it('should add file to viewed when not viewed', async () => {
      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      const diffFile = createMockDiffFile('src/app.ts', 'modified');

      await act(async () => {
        await result.current.toggleFileViewed('src/app.ts', diffFile);
      });

      expect(result.current.viewedFiles.has('src/app.ts')).toBe(true);
      expect(mockSaveViewedFiles).toHaveBeenCalled();
    });

    it('should remove file from viewed when already viewed', async () => {
      const storedRecords: ViewedFileRecord[] = [
        { filePath: 'src/app.ts', viewedAt: '2024-01-01T00:00:00Z', diffContentHash: 'hash1' },
      ];
      mockGetViewedFiles.mockReturnValue(storedRecords);

      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/app.ts')).toBe(true);
      });

      const diffFile = createMockDiffFile('src/app.ts', 'modified');

      await act(async () => {
        await result.current.toggleFileViewed('src/app.ts', diffFile);
      });

      expect(result.current.viewedFiles.has('src/app.ts')).toBe(false);
    });
  });

  describe('getViewedFileRecord', () => {
    it('should return record for viewed file', async () => {
      const storedRecords: ViewedFileRecord[] = [
        { filePath: 'src/app.ts', viewedAt: '2024-01-01T00:00:00Z', diffContentHash: 'hash1' },
      ];
      mockGetViewedFiles.mockReturnValue(storedRecords);

      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/app.ts')).toBe(true);
      });

      const record = result.current.getViewedFileRecord('src/app.ts');
      expect(record).toBeDefined();
      expect(record?.filePath).toBe('src/app.ts');
      expect(record?.diffContentHash).toBe('hash1');
    });

    it('should return undefined for non-viewed file', () => {
      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      const record = result.current.getViewedFileRecord('src/not-viewed.ts');
      expect(record).toBeUndefined();
    });
  });

  describe('isFileContentChanged', () => {
    it('should return false for non-viewed file', async () => {
      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      const diffFile = createMockDiffFile('src/app.ts', 'modified');
      const isChanged = await result.current.isFileContentChanged('src/app.ts', diffFile);

      expect(isChanged).toBe(false);
    });

    it('should return false when hash matches', async () => {
      // Mock generates hash as: hash- + first 10 chars of content
      // getDiffContentForHashing returns: src/app.ts-modified
      // So hash = hash-src/app.ts (first 10 chars)
      const storedRecords: ViewedFileRecord[] = [
        {
          filePath: 'src/app.ts',
          viewedAt: '2024-01-01T00:00:00Z',
          diffContentHash: 'hash-src/app.ts',
        },
      ];
      mockGetViewedFiles.mockReturnValue(storedRecords);

      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/app.ts')).toBe(true);
      });

      const diffFile = createMockDiffFile('src/app.ts', 'modified');
      const isChanged = await result.current.isFileContentChanged('src/app.ts', diffFile);

      expect(isChanged).toBe(false);
    });

    it('should return true when hash differs', async () => {
      const storedRecords: ViewedFileRecord[] = [
        {
          filePath: 'src/app.ts',
          viewedAt: '2024-01-01T00:00:00Z',
          diffContentHash: 'old-hash',
        },
      ];
      mockGetViewedFiles.mockReturnValue(storedRecords);

      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/app.ts')).toBe(true);
      });

      const diffFile = createMockDiffFile('src/app.ts', 'modified');
      const isChanged = await result.current.isFileContentChanged('src/app.ts', diffFile);

      expect(isChanged).toBe(true);
    });
  });

  describe('clearViewedFiles', () => {
    it('should clear all viewed files', async () => {
      const storedRecords: ViewedFileRecord[] = [
        { filePath: 'src/file1.ts', viewedAt: '2024-01-01T00:00:00Z', diffContentHash: 'hash1' },
        { filePath: 'src/file2.ts', viewedAt: '2024-01-01T00:00:00Z', diffContentHash: 'hash2' },
      ];
      mockGetViewedFiles.mockReturnValue(storedRecords);

      const { result } = renderHook(() => useViewedFiles('main', 'feature-branch'));

      await waitFor(() => {
        expect(result.current.viewedFiles.size).toBe(2);
      });

      act(() => {
        result.current.clearViewedFiles();
      });

      expect(result.current.viewedFiles.size).toBe(0);
      expect(mockSaveViewedFiles).toHaveBeenCalledWith(
        'main',
        'feature-branch',
        [],
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('cross-comparison viewed-state carryover', () => {
    // The mock generateDiffHash returns `hash-${path-status}.slice(0,10)`. For a
    // file `src/foo.ts` with status `modified`, getDiffContentForHashing yields
    // `src/foo.ts-modified` and the hash is `hash-src/foo.t`.
    const hashFor = (path: string, status: string) => {
      const content = `${path}-${status}`;
      return `hash-${content.slice(0, 10)}`;
    };

    it('restores files as viewed when their diff hash matches the per-repo index', async () => {
      const initialFiles: DiffFile[] = [
        createMockDiffFile('src/unchanged.ts', 'modified', false),
        createMockDiffFile('src/changed.ts', 'modified', false),
      ];
      mockGetViewedHashIndex.mockReturnValue({
        version: 1,
        lastModifiedAt: new Date().toISOString(),
        entries: [
          {
            filePath: 'src/unchanged.ts',
            diffContentHash: hashFor('src/unchanged.ts', 'modified'),
            hashVersion: 1,
            viewedAt: '2026-01-01T00:00:00Z',
          },
          {
            filePath: 'src/changed.ts',
            diffContentHash: 'stale-hash',
            hashVersion: 1,
            viewedAt: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const { result } = renderHook(() =>
        useViewedFiles('main', 'HEAD', 'newhead', undefined, initialFiles, 'repo-1', [], undefined),
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/unchanged.ts')).toBe(true);
      });
      expect(result.current.viewedFiles.has('src/changed.ts')).toBe(false);
    });

    it('restores from the matching (path, hash) entry when the index has multiple hashes for the same path', async () => {
      const initialFiles: DiffFile[] = [createMockDiffFile('src/foo.ts', 'modified', false)];
      mockGetViewedHashIndex.mockReturnValue({
        version: 1,
        lastModifiedAt: new Date().toISOString(),
        entries: [
          // A stale entry from a different comparison range (same path, different hash).
          {
            filePath: 'src/foo.ts',
            diffContentHash: 'some-other-hash',
            hashVersion: 1,
            viewedAt: '2026-01-01T00:00:00Z',
          },
          // The matching entry for the current diff.
          {
            filePath: 'src/foo.ts',
            diffContentHash: hashFor('src/foo.ts', 'modified'),
            hashVersion: 1,
            viewedAt: '2026-01-02T00:00:00Z',
          },
        ],
      });

      const { result } = renderHook(() =>
        useViewedFiles('main', 'HEAD', 'newhead', undefined, initialFiles, 'repo-1', [], undefined),
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/foo.ts')).toBe(true);
      });
    });

    it('does not hydrate when the index only contains entries for other hashes of this path', async () => {
      const initialFiles: DiffFile[] = [createMockDiffFile('src/foo.ts', 'modified', false)];
      mockGetViewedHashIndex.mockReturnValue({
        version: 1,
        lastModifiedAt: new Date().toISOString(),
        entries: [
          {
            filePath: 'src/foo.ts',
            diffContentHash: 'hash-from-different-comparison',
            hashVersion: 1,
            viewedAt: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const { result } = renderHook(() =>
        useViewedFiles('main', 'HEAD', 'newhead', undefined, initialFiles, 'repo-1', [], undefined),
      );

      await waitFor(() => {
        expect(mockGetViewedFiles).toHaveBeenCalled();
      });
      expect(result.current.viewedFiles.has('src/foo.ts')).toBe(false);
    });

    it('ignores index entries with a stale hashVersion', async () => {
      const initialFiles: DiffFile[] = [createMockDiffFile('src/unchanged.ts', 'modified', false)];
      mockGetViewedHashIndex.mockReturnValue({
        version: 1,
        lastModifiedAt: new Date().toISOString(),
        entries: [
          {
            filePath: 'src/unchanged.ts',
            diffContentHash: hashFor('src/unchanged.ts', 'modified'),
            // Cast through unknown to simulate a future version we don't understand.
            hashVersion: 999 as unknown as 1,
            viewedAt: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const { result } = renderHook(() =>
        useViewedFiles('main', 'HEAD', 'newhead', undefined, initialFiles, 'repo-1', [], undefined),
      );

      await waitFor(() => {
        expect(mockGetViewedFiles).toHaveBeenCalled();
      });
      expect(result.current.viewedFiles.has('src/unchanged.ts')).toBe(false);
    });

    it('writes to the index when toggling a file viewed', async () => {
      const file = createMockDiffFile('src/foo.ts', 'modified', false);
      const { result } = renderHook(() =>
        useViewedFiles('main', 'HEAD', 'abc', undefined, [file], 'repo-1', [], undefined),
      );

      await waitFor(() => {
        expect(mockGetViewedFiles).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.toggleFileViewed('src/foo.ts', file);
      });

      expect(mockRecordViewedHashes).toHaveBeenCalledTimes(1);
      const call = mockRecordViewedHashes.mock.calls[0]!;
      const repoArg = call[0] as string | undefined;
      const entriesArg = call[1] as ViewedHashIndexEntry[];
      expect(repoArg).toBe('repo-1');
      expect(entriesArg).toHaveLength(1);
      const first = entriesArg[0]!;
      expect(first.filePath).toBe('src/foo.ts');
      expect(first.hashVersion).toBe(1);
    });

    it('removes from the index when un-toggling a file', async () => {
      const file = createMockDiffFile('src/foo.ts', 'modified', false);
      mockGetViewedFiles.mockReturnValue([
        {
          filePath: 'src/foo.ts',
          viewedAt: '2026-01-01T00:00:00Z',
          diffContentHash: hashFor('src/foo.ts', 'modified'),
        },
      ]);

      const { result } = renderHook(() =>
        useViewedFiles('main', 'HEAD', 'abc', undefined, [file], 'repo-1', [], undefined),
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/foo.ts')).toBe(true);
      });

      await act(async () => {
        await result.current.toggleFileViewed('src/foo.ts', file);
      });

      expect(mockRemoveViewedHashes).toHaveBeenCalledWith('repo-1', [
        { filePath: 'src/foo.ts', diffContentHash: hashFor('src/foo.ts', 'modified') },
      ]);
    });

    it('flags files as changedSinceViewed when a prior view exists with a different hash', async () => {
      const initialFiles: DiffFile[] = [
        createMockDiffFile('src/changed.ts', 'modified', false),
        createMockDiffFile('src/never-viewed.ts', 'modified', false),
        createMockDiffFile('src/unchanged.ts', 'modified', false),
      ];
      mockGetViewedHashIndex.mockReturnValue({
        version: 1,
        lastModifiedAt: new Date().toISOString(),
        entries: [
          // Prior view of src/changed.ts had a different hash than the current diff.
          {
            filePath: 'src/changed.ts',
            diffContentHash: 'old-hash',
            hashVersion: 1,
            viewedAt: '2026-01-01T00:00:00Z',
          },
          // Prior view of src/unchanged.ts matches the current hash, so it gets hydrated, not flagged.
          {
            filePath: 'src/unchanged.ts',
            diffContentHash: hashFor('src/unchanged.ts', 'modified'),
            hashVersion: 1,
            viewedAt: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const { result } = renderHook(() =>
        useViewedFiles('main', 'HEAD', 'newhead', undefined, initialFiles, 'repo-1', [], undefined),
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/unchanged.ts')).toBe(true);
      });

      expect(result.current.changedSinceViewedFiles.has('src/changed.ts')).toBe(true);
      expect(result.current.changedSinceViewedFiles.has('src/never-viewed.ts')).toBe(false);
      expect(result.current.changedSinceViewedFiles.has('src/unchanged.ts')).toBe(false);
    });

    it('clearViewedFiles also clears the per-repo index', async () => {
      const { result } = renderHook(() =>
        useViewedFiles('main', 'HEAD', 'abc', undefined, [], 'repo-1', [], undefined),
      );

      await waitFor(() => {
        expect(mockGetViewedFiles).toHaveBeenCalled();
      });

      act(() => {
        result.current.clearViewedFiles();
      });

      expect(mockClearViewedHashIndex).toHaveBeenCalledWith('repo-1');
    });
  });
});
