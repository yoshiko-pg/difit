import { useState, useEffect, useCallback, useMemo } from 'react';

import { type ViewedFileRecord, type DiffFile } from '../../types/diff';
import { storageService } from '../services/StorageService';
import { generateDiffHash, getDiffContentForHashing } from '../utils/diffUtils';

// Helper function to check if a file is a lock file
function isLockFile(filePath: string): boolean {
  const lockFilePatterns = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Cargo.lock',
    'Gemfile.lock',
    'poetry.lock',
    'composer.lock',
    'Pipfile.lock',
    'go.sum',
    'pubspec.lock',
    'flake.lock',
  ];

  const fileName = filePath.split('/').pop() || '';
  return lockFilePatterns.includes(fileName);
}

export interface UseViewedFilesReturn {
  viewedFiles: Set<string>; // Set of file paths
  toggleFileViewed: (filePath: string, diffFile: DiffFile) => Promise<void>;
  isFileContentChanged: (filePath: string, diffFile: DiffFile) => Promise<boolean>;
  getViewedFileRecord: (filePath: string) => ViewedFileRecord | undefined;
  clearViewedFiles: () => void;
}

export function useViewedFiles(
  baseCommitish?: string,
  targetCommitish?: string,
  currentCommitHash?: string,
  branchToHash?: Map<string, string>,
  initialFiles?: DiffFile[]
): UseViewedFilesReturn {
  const [viewedFileRecords, setViewedFileRecords] = useState<ViewedFileRecord[]>([]);
  const [fileHashes, setFileHashes] = useState<Map<string, string>>(new Map());

  // Load viewed files from storage and auto-mark lock files
  useEffect(() => {
    if (!baseCommitish || !targetCommitish) return;

    const loadedFiles = storageService.getViewedFiles(
      baseCommitish,
      targetCommitish,
      currentCommitHash,
      branchToHash
    );

    // Auto-mark lock files as viewed if we have initial files
    const processLockFiles = async () => {
      if (initialFiles && initialFiles.length > 0) {
        const lockFilesToAdd: ViewedFileRecord[] = [];

        // Create a Set of already viewed file paths for quick lookup
        const viewedPaths = new Set(loadedFiles.map((f) => f.filePath));

        // Find lock files that aren't already marked as viewed
        for (const file of initialFiles) {
          if (isLockFile(file.path) && !viewedPaths.has(file.path)) {
            try {
              // Generate hash for the lock file
              const content = getDiffContentForHashing(file);
              const hash = await generateDiffHash(content);

              const newRecord: ViewedFileRecord = {
                filePath: file.path,
                viewedAt: new Date().toISOString(),
                diffContentHash: hash,
              };

              lockFilesToAdd.push(newRecord);
            } catch (err) {
              console.error('Failed to generate hash for lock file:', err);
            }
          }
        }

        // Add all lock files to storage at once
        if (lockFilesToAdd.length > 0) {
          const updatedRecords = [...loadedFiles, ...lockFilesToAdd];
          storageService.saveViewedFiles(
            baseCommitish,
            targetCommitish,
            updatedRecords,
            currentCommitHash,
            branchToHash
          );
          setViewedFileRecords(updatedRecords);
          return;
        }
      }

      setViewedFileRecords(loadedFiles);
    };

    void processLockFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCommitish, targetCommitish, currentCommitHash, branchToHash]); // initialFiles intentionally omitted to run only on mount

  // Save viewed files to storage
  const saveViewedFiles = useCallback(
    (newRecords: ViewedFileRecord[]) => {
      if (!baseCommitish || !targetCommitish) return;

      storageService.saveViewedFiles(
        baseCommitish,
        targetCommitish,
        newRecords,
        currentCommitHash,
        branchToHash
      );
      setViewedFileRecords(newRecords);
    },
    [baseCommitish, targetCommitish, currentCommitHash, branchToHash]
  );

  // Convert records to Set of file paths for easy checking
  const viewedFiles = useMemo(() => {
    return new Set(viewedFileRecords.map((record) => record.filePath));
  }, [viewedFileRecords]);

  // Get specific file record
  const getViewedFileRecord = useCallback(
    (filePath: string): ViewedFileRecord | undefined => {
      return viewedFileRecords.find((record) => record.filePath === filePath);
    },
    [viewedFileRecords]
  );

  // Generate and cache hash for a file
  const getFileHash = useCallback(
    async (diffFile: DiffFile): Promise<string> => {
      const cached = fileHashes.get(diffFile.path);
      if (cached) return cached;

      const content = getDiffContentForHashing(diffFile);
      const hash = await generateDiffHash(content);

      setFileHashes((prev) => new Map(prev).set(diffFile.path, hash));
      return hash;
    },
    [fileHashes]
  );

  // Check if file content has changed
  const isFileContentChanged = useCallback(
    async (filePath: string, diffFile: DiffFile): Promise<boolean> => {
      const record = getViewedFileRecord(filePath);
      if (!record) return false;

      const currentHash = await getFileHash(diffFile);
      return record.diffContentHash !== currentHash;
    },
    [getViewedFileRecord, getFileHash]
  );

  // Toggle viewed state for a file
  const toggleFileViewed = useCallback(
    async (filePath: string, diffFile: DiffFile): Promise<void> => {
      const existingRecord = getViewedFileRecord(filePath);

      if (existingRecord) {
        // File is already viewed, remove it
        const newRecords = viewedFileRecords.filter((r) => r.filePath !== filePath);
        saveViewedFiles(newRecords);
      } else {
        // File is not viewed, add it
        const hash = await getFileHash(diffFile);
        const newRecord: ViewedFileRecord = {
          filePath,
          viewedAt: new Date().toISOString(),
          diffContentHash: hash,
        };

        const newRecords = [...viewedFileRecords, newRecord];
        saveViewedFiles(newRecords);
      }
    },
    [viewedFileRecords, getViewedFileRecord, getFileHash, saveViewedFiles]
  );

  // Clear all viewed files
  const clearViewedFiles = useCallback(() => {
    saveViewedFiles([]);
    setFileHashes(new Map());
  }, [saveViewedFiles]);

  return {
    viewedFiles,
    toggleFileViewed,
    isFileContentChanged,
    getViewedFileRecord,
    clearViewedFiles,
  };
}
