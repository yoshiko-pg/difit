# Design Document

## Overview

This design document describes the technical design for improving the comment and viewed state management system in difit's WebUI. The current implementation manages comments only by commit hash, which causes issues when comments from different diff ranges (baseCommitish→targetCommitish) are mixed together. This design implements a new data structure that considers the entire diff context and adds persistent storage for file viewed states.

## Architecture

### Data Storage Hierarchy

```
localStorage
└── difit-storage-v1/
    └── {baseCommitish}-{targetCommitish}/
        ├── comments: Comment[]
        └── viewedFiles: ViewedFileRecord[]
```

### Key Changes

1. **Unified Storage Structure**: Manage comments and viewed states together per diff context
2. **Versioning**: Include version in storage key for future schema changes (starting with v1)
3. **Diff Content Validation**: Store hash of file diff content to validate viewed state
4. **No Migration Required**: Start as new structure without migrating existing data

## Components and Interfaces

### 1. Data Models

```typescript
// Comment data structure (designed from scratch)
interface DiffComment {
  id: string;  // UUID format recommended
  filePath: string;
  body: string;
  createdAt: string;  // ISO 8601 format
  updatedAt: string;  // ISO 8601 format
  
  // Comment position information
  position: {
    side: 'old' | 'new';  // Deletion side (-) or addition side (+)
    line: number | { start: number; end: number };  // Single line or range
  };
  
  // Code content at comment time (optional)
  codeSnapshot?: {
    content: string;
    language?: string;  // Inferred from file extension
  };
}

// Viewed state record
interface ViewedFileRecord {
  filePath: string;
  viewedAt: string;  // ISO 8601 format
  diffContentHash: string;  // SHA-256 hash
}

// Storage root structure
interface DiffContextStorage {
  version: 1;  // Schema version
  baseCommitish: string;
  targetCommitish: string;
  createdAt: string;  // ISO 8601 format
  lastModifiedAt: string;  // ISO 8601 format
  
  comments: DiffComment[];
  viewedFiles: ViewedFileRecord[];
}
```

### 2. Storage Service

```typescript
interface StorageService {
  // Unified data fetch/save
  getDiffContextData(baseCommitish: string, targetCommitish: string): DiffContextStorage;
  saveDiffContextData(baseCommitish: string, targetCommitish: string, data: DiffContextStorage): void;
  
  // Comment related
  getComments(baseCommitish: string, targetCommitish: string): DiffComment[];
  saveComments(baseCommitish: string, targetCommitish: string, comments: DiffComment[]): void;
  
  // Viewed state related
  getViewedFiles(baseCommitish: string, targetCommitish: string): ViewedFileRecord[];
  saveViewedFiles(baseCommitish: string, targetCommitish: string, files: ViewedFileRecord[]): void;
  
  // Utilities
  cleanupOldData(daysToKeep: number): void;
  getStorageSize(): number;
}
```

### 3. Hooks

```typescript
// Parameters for adding comments
interface AddCommentParams {
  filePath: string;
  body: string;
  side: 'old' | 'new';
  line: number | { start: number; end: number };
  codeSnapshot?: DiffComment['codeSnapshot'];
}

// New comment management hook
interface UseDiffCommentsReturn {
  comments: DiffComment[];
  addComment: (params: AddCommentParams) => DiffComment;
  removeComment: (commentId: string) => void;
  updateComment: (commentId: string, newBody: string) => void;
  clearAllComments: () => void;
  generatePrompt: (commentId: string) => string;
  generateAllCommentsPrompt: () => string;
}

// Viewed state management hook
interface UseViewedFilesReturn {
  viewedFiles: Set<string>;  // Set of file paths
  toggleFileViewed: (filePath: string, diffFile: DiffFile) => void;
  isFileContentChanged: (filePath: string) => boolean;
  getViewedFileRecord: (filePath: string) => ViewedFileRecord | undefined;
  clearViewedFiles: () => void;
}
```

## Data Model

### Storage Key Generation

```typescript
function generateStorageKey(baseCommitish: string, targetCommitish: string): string {
  // Use full commit hash or reference name as is
  // Encode special characters to filesystem-safe format
  const encode = (str: string) => str.replace(/[^a-zA-Z0-9-_]/g, (char) => {
    return `_${char.charCodeAt(0).toString(16)}_`;
  });
  
  return `${encode(baseCommitish)}-${encode(targetCommitish)}`;
}

// Examples:
// generateStorageKey("main", "feature/add-auth")
// => "main-feature_2f_add_2d_auth"
// generateStorageKey("abc1234", "def5678")  
// => "abc1234-def5678"
```

### Diff Content Hash Generation

```typescript
async function generateDiffHash(diffContent: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(diffContent);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

## Error Handling

### Storage Errors

1. **Capacity Exceeded**: When localStorage limit (usually 5-10MB) is reached
   - Suggest automatic deletion of old data
   - Notify user

2. **Data Corruption**: When JSON parse error occurs
   - Backup corrupted data
   - Initialize with new structure

3. **Migration Errors**: Errors during V1 to V2 migration
   - Retain original data
   - Log errors

### Hash Calculation Errors

- Fall back to simple hash function if Web Crypto API is unavailable
- Don't save viewed state if hash calculation fails

## Testing Strategy

### Unit Tests

1. **Storage Service**
   - Key generation accuracy
   - Data save and load
   - Migration processing
   - Error handling

2. **Hooks**
   - Comment CRUD operations
   - Viewed state management
   - Diff content change detection

3. **Hash Generation**
   - Same hash for same content
   - Different hash for different content
   - Edge cases (empty string, large files)

### Integration Tests

1. **Data Persistence**
   - Data restoration after page reload
   - Data separation in different diff contexts

2. **Migration**
   - Normal migration of V1 data
   - Operation verification after migration

3. **Performance**
   - Operation with large number of comments
   - Storage capacity monitoring

## Implementation Details

### Handling Dynamic References

`baseCommitish` and `targetCommitish` received from server may have the following values:

1. **Commit Hash**: `abc1234...` - Use as is
2. **Branch Name**: `main`, `feature/auth` - Resolve to commit hash
3. **HEAD**: Resolve to current commit hash
4. **Working Directory**: `.` or `working` - Requires special handling
5. **Staged**: `staged` - Requires special handling

```typescript
// Dynamic reference normalization
function normalizeCommitish(
  commitish: string, 
  currentCommitHash: string,  // Current HEAD hash
  branchToHash?: Map<string, string>  // Branch name → hash mapping
): string {
  // For working directory or staged
  // Use HEAD hash for base, special keyword for target to ensure uniqueness
  if (commitish === '.' || commitish === 'working') {
    return 'WORKING';
  }
  if (commitish === 'staged') {
    return 'STAGED';
  }
  
  // Use resolved hash for HEAD
  if (commitish === 'HEAD') {
    return currentCommitHash;
  }
  
  // Resolve branch name to hash
  if (branchToHash?.has(commitish)) {
    return branchToHash.get(commitish)!;
  }
  
  // Use commit hash as is
  return commitish;
}

// Storage key generation examples
// For difit staged:
// base: Resolved HEAD hash (e.g., "abc1234")
// target: "STAGED"
// → Key: "difit-storage-v1/abc1234-STAGED"

// For difit .:
// base: Resolved HEAD hash (e.g., "abc1234")
// target: "WORKING"
// → Key: "difit-storage-v1/abc1234-WORKING"
```

### localStorage Key Structure

```typescript
// Main storage key prefix
const STORAGE_KEY_PREFIX = 'difit-storage-v1';

// Generate key per diff context
function getStorageKey(
  baseCommitish: string, 
  targetCommitish: string,
  currentCommitHash: string,
  branchToHash?: Map<string, string>
): string {
  let normalizedBase: string;
  let normalizedTarget: string;
  
  // Handle special cases
  if (targetCommitish === '.' || targetCommitish === 'working') {
    normalizedBase = currentCommitHash;
    normalizedTarget = 'WORKING';
  } else if (targetCommitish === 'staged') {
    normalizedBase = currentCommitHash;
    normalizedTarget = 'STAGED';
  } else {
    // Normal cases
    normalizedBase = normalizeCommitish(baseCommitish, currentCommitHash, branchToHash);
    normalizedTarget = normalizeCommitish(targetCommitish, currentCommitHash, branchToHash);
  }
  
  const key = generateStorageKey(normalizedBase, normalizedTarget);
  return `${STORAGE_KEY_PREFIX}/${key}`;
}

// Data save example
const storageKey = getStorageKey('HEAD~1', 'staged', 'abc1234def5678');
// → "difit-storage-v1/abc1234def5678-STAGED"

const data: DiffContextStorage = {
  version: 1,
  baseCommitish: 'HEAD~1',  // Save original value (for UI display)
  targetCommitish: 'staged', // Save original value (for UI display)
  createdAt: new Date().toISOString(),
  lastModifiedAt: new Date().toISOString(),
  comments: [...],
  viewedFiles: [...]
};
localStorage.setItem(storageKey, JSON.stringify(data));
```

### Coexistence with Old Data

- Keep existing `difit-comments-${commitHash}` keys (read-only)
- Save new data under `difit-storage-v1/`
- Can add cleanup functionality for old data in the future