export interface DiffFile {
  path: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  chunks: DiffChunk[];
}

export interface FileDiff {
  path: string;
  status: 'A' | 'M' | 'D';
  diff: string;
  additions: number;
  deletions: number;
}

export interface DiffChunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'delete' | 'normal' | 'hunk' | 'remove' | 'context' | 'header';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface ParsedDiff {
  chunks: DiffChunk[];
}

export type DiffViewMode = 'side-by-side' | 'inline';

export interface DiffResponse {
  commit: string;
  files: DiffFile[];
  ignoreWhitespace?: boolean;
  isEmpty?: boolean;
  mode?: DiffViewMode;
  baseCommitish?: string;
  targetCommitish?: string;
  clearComments?: boolean;
}

export type LineNumber = number | [number, number];

export interface Comment {
  id: string;
  file: string;
  line: LineNumber;
  body: string;
  timestamp: string;
  codeContent?: string; // The actual code content for this line
  side?: 'old' | 'new'; // Which side the comment is on
}

export interface LineSelection {
  side: 'old' | 'new';
  lineNumber: number;
}

// New data structures for enhanced comment and viewed state management

export interface DiffComment {
  id: string; // UUID format recommended
  filePath: string;
  body: string;
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format

  // Chunk information
  chunkHeader: string; // e.g., "@@ -10,7 +10,8 @@ function example()"

  // Comment position
  position: {
    side: 'old' | 'new'; // whether on deletion (-) or addition (+) side
    line: number | { start: number; end: number }; // single line or range
  };

  // Code snapshot at comment time (optional)
  codeSnapshot?: {
    content: string;
    language?: string; // inferred from file extension
  };
}

export interface ViewedFileRecord {
  filePath: string;
  viewedAt: string; // ISO 8601 format
  diffContentHash: string; // SHA-256 hash
}

export interface DiffContextStorage {
  version: 1; // Schema version
  baseCommitish: string;
  targetCommitish: string;
  createdAt: string; // ISO 8601 format
  lastModifiedAt: string; // ISO 8601 format

  comments: DiffComment[];
  viewedFiles: ViewedFileRecord[];
}
