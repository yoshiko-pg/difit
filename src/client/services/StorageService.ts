import { type DiffComment, type ViewedFileRecord, type DiffContextStorage } from '../../types/diff';

export const STORAGE_KEY_PREFIX = 'difit-storage-v1';

export class StorageService {
  /**
   * Generate a filesystem-safe storage key from commitish references
   */
  private generateStorageKey(baseCommitish: string, targetCommitish: string): string {
    const encode = (str: string) =>
      str.replace(/[^a-zA-Z0-9-_]/g, (char) => {
        return `_${char.charCodeAt(0).toString(16)}_`;
      });

    return `${encode(baseCommitish)}-${encode(targetCommitish)}`;
  }

  /**
   * Normalize dynamic references like HEAD, branch names, etc.
   */
  private normalizeCommitish(
    commitish: string,
    currentCommitHash?: string,
    branchToHash?: Map<string, string>
  ): string {
    // Handle working directory and staged cases
    if (commitish === '.' || commitish === 'working') {
      return 'WORKING';
    }
    if (commitish === 'staged') {
      return 'STAGED';
    }

    // Handle HEAD reference (including @ symbol which is git shorthand for HEAD)
    if ((commitish === 'HEAD' || commitish === '@') && currentCommitHash) {
      return currentCommitHash;
    }

    // Try to resolve branch names to hashes
    if (branchToHash?.has(commitish)) {
      const hash = branchToHash.get(commitish);
      if (hash) {
        return hash;
      }
    }

    // IMPORTANT: For commitish like @^, @~1, etc., we cannot normalize without commit hash
    // These will use the literal string as key, which may cause collision across different commits
    // Warn if this looks like a symbolic reference that couldn't be resolved
    if (
      commitish.startsWith('@') ||
      commitish.includes('^') ||
      commitish.includes('~') ||
      commitish.includes('HEAD')
    ) {
      console.warn(
        `[StorageService] Cannot normalize symbolic ref '${commitish}' - may cause key collision. ` +
          `currentCommitHash=${currentCommitHash}`
      );
    }

    // Return as-is (likely a commit hash or unresolved symbolic ref)
    return commitish;
  }

  /**
   * Get the full localStorage key for a diff context
   */
  private getStorageKey(
    baseCommitish: string,
    targetCommitish: string,
    currentCommitHash?: string,
    branchToHash?: Map<string, string>,
    repositoryId?: string
  ): string {
    let normalizedBase: string;
    let normalizedTarget: string;

    // Special handling for working/staged diffs
    if (targetCommitish === '.' || targetCommitish === 'working') {
      normalizedBase = currentCommitHash || baseCommitish;
      normalizedTarget = 'WORKING';
    } else if (targetCommitish === 'staged') {
      normalizedBase = currentCommitHash || baseCommitish;
      normalizedTarget = 'STAGED';
    } else {
      normalizedBase = this.normalizeCommitish(baseCommitish, currentCommitHash, branchToHash);
      normalizedTarget = this.normalizeCommitish(targetCommitish, currentCommitHash, branchToHash);
    }

    const key = this.generateStorageKey(normalizedBase, normalizedTarget);
    // Include repository ID in the key for isolation between projects
    if (repositoryId) {
      return `${STORAGE_KEY_PREFIX}/${repositoryId}/${key}`;
    }
    return `${STORAGE_KEY_PREFIX}/${key}`;
  }

  /**
   * Get diff context data from localStorage
   * Includes automatic migration from old format (without repositoryId) to new format
   */
  getDiffContextData(
    baseCommitish: string,
    targetCommitish: string,
    currentCommitHash?: string,
    branchToHash?: Map<string, string>,
    repositoryId?: string
  ): DiffContextStorage | null {
    try {
      // Try to read from new format (with repositoryId)
      const newKey = this.getStorageKey(
        baseCommitish,
        targetCommitish,
        currentCommitHash,
        branchToHash,
        repositoryId
      );
      const newData = localStorage.getItem(newKey);

      if (newData) {
        const parsed = JSON.parse(newData) as DiffContextStorage;
        // Validate version
        if (parsed.version !== 1) {
          console.warn(`Unknown storage version: ${parsed.version}`);
          return null;
        }
        return parsed;
      }

      // If no data in new format and repositoryId exists, try old format for migration
      // IMPORTANT: Only migrate for working/staged diffs to avoid cross-repository data pollution
      // For commit-to-commit comparisons, the same commit pair could exist in different repositories
      if (!newData && repositoryId) {
        // Determine if this is a working/staged diff (more likely to be same repository)
        const isWorkingDiff =
          targetCommitish === 'WORKING' ||
          targetCommitish === 'STAGED' ||
          targetCommitish === '.' ||
          targetCommitish === 'working' ||
          targetCommitish === 'staged';

        // Only auto-migrate for working/staged diffs
        if (isWorkingDiff) {
          const oldKey = this.getStorageKey(
            baseCommitish,
            targetCommitish,
            currentCommitHash,
            branchToHash,
            undefined // No repositoryId for old format
          );
          const oldData = localStorage.getItem(oldKey);

          if (oldData) {
            const parsed = JSON.parse(oldData) as DiffContextStorage;

            // Validate version
            if (parsed.version !== 1) {
              console.warn(`Unknown storage version: ${parsed.version}`);
              return null;
            }

            // Auto-migrate: save to new format
            console.info(
              `Migrating data from old format to new format for key: ${oldKey} -> ${newKey}`
            );
            this.saveDiffContextData(
              baseCommitish,
              targetCommitish,
              parsed,
              currentCommitHash,
              branchToHash,
              repositoryId
            );

            return parsed;
          }
        } else {
          // For commit-to-commit comparisons, warn user but don't auto-migrate
          const oldKey = this.getStorageKey(
            baseCommitish,
            targetCommitish,
            currentCommitHash,
            branchToHash,
            undefined
          );
          if (localStorage.getItem(oldKey)) {
            console.warn(
              `Old format data found for commit comparison: ${oldKey}\n` +
                `This data was NOT auto-migrated to prevent cross-repository pollution.\n` +
                `If this data belongs to the current repository, please use the migration tool.`
            );
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error reading diff context data:', error);
      return null;
    }
  }

  /**
   * Save diff context data to localStorage
   */
  saveDiffContextData(
    baseCommitish: string,
    targetCommitish: string,
    data: DiffContextStorage,
    currentCommitHash?: string,
    branchToHash?: Map<string, string>,
    repositoryId?: string
  ): void {
    try {
      const key = this.getStorageKey(
        baseCommitish,
        targetCommitish,
        currentCommitHash,
        branchToHash,
        repositoryId
      );
      // Ensure data includes original commitish values
      const dataToSave: DiffContextStorage = {
        ...data,
        baseCommitish,
        targetCommitish,
        lastModifiedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(dataToSave));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded');
        // Could implement cleanup here
      } else {
        console.error('Error saving diff context data:', error);
      }
    }
  }

  /**
   * Get comments for a specific diff context
   */
  getComments(
    baseCommitish: string,
    targetCommitish: string,
    currentCommitHash?: string,
    branchToHash?: Map<string, string>,
    repositoryId?: string
  ): DiffComment[] {
    const data = this.getDiffContextData(
      baseCommitish,
      targetCommitish,
      currentCommitHash,
      branchToHash,
      repositoryId
    );
    return data?.comments || [];
  }

  /**
   * Save comments for a specific diff context
   */
  saveComments(
    baseCommitish: string,
    targetCommitish: string,
    comments: DiffComment[],
    currentCommitHash?: string,
    branchToHash?: Map<string, string>,
    repositoryId?: string
  ): void {
    const existingData = this.getDiffContextData(
      baseCommitish,
      targetCommitish,
      currentCommitHash,
      branchToHash,
      repositoryId
    );
    const data: DiffContextStorage = existingData || {
      version: 1,
      baseCommitish,
      targetCommitish,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      comments: [],
      viewedFiles: [],
    };

    data.comments = comments;
    this.saveDiffContextData(
      baseCommitish,
      targetCommitish,
      data,
      currentCommitHash,
      branchToHash,
      repositoryId
    );
  }

  /**
   * Get viewed files for a specific diff context
   */
  getViewedFiles(
    baseCommitish: string,
    targetCommitish: string,
    currentCommitHash?: string,
    branchToHash?: Map<string, string>,
    repositoryId?: string
  ): ViewedFileRecord[] {
    const data = this.getDiffContextData(
      baseCommitish,
      targetCommitish,
      currentCommitHash,
      branchToHash,
      repositoryId
    );
    return data?.viewedFiles || [];
  }

  /**
   * Save viewed files for a specific diff context
   */
  saveViewedFiles(
    baseCommitish: string,
    targetCommitish: string,
    files: ViewedFileRecord[],
    currentCommitHash?: string,
    branchToHash?: Map<string, string>,
    repositoryId?: string
  ): void {
    const existingData = this.getDiffContextData(
      baseCommitish,
      targetCommitish,
      currentCommitHash,
      branchToHash,
      repositoryId
    );
    const data: DiffContextStorage = existingData || {
      version: 1,
      baseCommitish,
      targetCommitish,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      comments: [],
      viewedFiles: [],
    };

    data.viewedFiles = files;
    this.saveDiffContextData(
      baseCommitish,
      targetCommitish,
      data,
      currentCommitHash,
      branchToHash,
      repositoryId
    );
  }

  /**
   * Clean up old data based on days to keep
   */
  cleanupOldData(daysToKeep: number): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTime = cutoffDate.getTime();

    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_KEY_PREFIX)) continue;

      try {
        const data = localStorage.getItem(key);
        if (!data) continue;

        const parsed = JSON.parse(data) as DiffContextStorage;
        const lastModified = new Date(parsed.lastModifiedAt).getTime();

        if (lastModified < cutoffTime) {
          keysToRemove.push(key);
        }
      } catch {
        // Skip invalid entries
      }
    }

    // Remove old entries
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  /**
   * Get total storage size used by difit
   */
  getStorageSize(): number {
    let totalSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_KEY_PREFIX)) continue;

      const value = localStorage.getItem(key);
      if (value) {
        // Rough estimate: 2 bytes per character (UTF-16)
        totalSize += (key.length + value.length) * 2;
      }
    }

    return totalSize;
  }
}

// Export singleton instance
export const storageService = new StorageService();
