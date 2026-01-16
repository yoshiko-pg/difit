import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { type DiffFile, type ViewedFileRecord } from '../../types/diff';

import { useViewedFiles } from './useViewedFiles';

// Mock StorageService
const mockGetViewedFiles = vi.fn((): ViewedFileRecord[] => []);
const mockSaveViewedFiles = vi.fn();

vi.mock('../services/StorageService', () => ({
  storageService: {
    getViewedFiles: () => mockGetViewedFiles(),
    saveViewedFiles: (...args: unknown[]) => mockSaveViewedFiles(...args),
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
  isGenerated = false
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
        useViewedFiles('main', 'feature-branch', 'abc123', undefined, initialFiles)
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
        useViewedFiles('main', 'feature-branch', 'abc123', undefined, initialFiles)
      );

      await waitFor(() => {
        expect(result.current.viewedFiles.has('src/old-file.ts')).toBe(true);
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
        useViewedFiles('main', 'feature-branch', 'abc123', undefined, initialFiles)
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
        useViewedFiles('main', 'feature-branch', 'abc123', undefined, initialFiles)
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
        undefined
      );
    });
  });
});
