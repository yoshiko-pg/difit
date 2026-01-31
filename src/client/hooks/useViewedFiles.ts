import { useState, useEffect, useCallback, useMemo } from 'react';

import { type ViewedFileRecord, type DiffFile } from '../../types/diff';
import { storageService } from '../services/StorageService';
import { generateDiffHash, getDiffContentForHashing } from '../utils/diffUtils';

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
  initialFiles?: DiffFile[],
  repositoryId?: string,
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
      branchToHash,
      repositoryId,
    );

    // Auto-mark generated/deleted files as viewed if we have initial files and they are not already viewed
    const processAutoCollapsedFiles = async () => {
      if (initialFiles && initialFiles.length > 0) {
        const autoCollapsedFilesToAdd: ViewedFileRecord[] = [];

        // Create a Set of already viewed file paths for quick lookup
        const viewedPaths = new Set(loadedFiles.map((f) => f.filePath));

        // Find generated files or deleted files that aren't already marked as viewed
        for (const file of initialFiles) {
          if ((file.isGenerated || file.status === 'deleted') && !viewedPaths.has(file.path)) {
            try {
              // Generate hash for the file
              const content = getDiffContentForHashing(file);
              const hash = await generateDiffHash(content);

              const newRecord: ViewedFileRecord = {
                filePath: file.path,
                viewedAt: new Date().toISOString(),
                diffContentHash: hash,
              };

              autoCollapsedFilesToAdd.push(newRecord);
            } catch (err) {
              console.error('Failed to generate hash for auto-collapsed file:', err);
            }
          }
        }

        // Add all auto-collapsed files to storage at once
        if (autoCollapsedFilesToAdd.length > 0) {
          const updatedRecords = [...loadedFiles, ...autoCollapsedFilesToAdd];
          storageService.saveViewedFiles(
            baseCommitish,
            targetCommitish,
            updatedRecords,
            currentCommitHash,
            branchToHash,
            repositoryId,
          );
          setViewedFileRecords(updatedRecords);
          return;
        }
      }

      setViewedFileRecords(loadedFiles);
    };

    void processAutoCollapsedFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCommitish, targetCommitish, currentCommitHash, branchToHash, repositoryId]); // initialFiles intentionally omitted to run only on mount

  // Save viewed files to storage
  const saveViewedFiles = useCallback(
    (newRecords: ViewedFileRecord[]) => {
      if (!baseCommitish || !targetCommitish) return;

      storageService.saveViewedFiles(
        baseCommitish,
        targetCommitish,
        newRecords,
        currentCommitHash,
        branchToHash,
        repositoryId,
      );
      setViewedFileRecords(newRecords);
    },
    [baseCommitish, targetCommitish, currentCommitHash, branchToHash, repositoryId],
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
    [viewedFileRecords],
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
    [fileHashes],
  );

  // Check if file content has changed
  const isFileContentChanged = useCallback(
    async (filePath: string, diffFile: DiffFile): Promise<boolean> => {
      const record = getViewedFileRecord(filePath);
      if (!record) return false;

      const currentHash = await getFileHash(diffFile);
      return record.diffContentHash !== currentHash;
    },
    [getViewedFileRecord, getFileHash],
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
    [viewedFileRecords, getViewedFileRecord, getFileHash, saveViewedFiles],
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
