export interface DiffFile {
  path: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  chunks: DiffChunk[];
  isGenerated?: boolean;
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

export type DiffViewMode = 'split' | 'unified';
export type LegacyDiffViewMode = 'side-by-side' | 'inline';
export type DiffSide = 'old' | 'new';

export interface DiffResponse {
  commit: string;
  files: DiffFile[];
  ignoreWhitespace?: boolean;
  isEmpty?: boolean;
  mode?: DiffViewMode | LegacyDiffViewMode;
  openInEditorAvailable?: boolean;
  baseCommitish?: string;
  targetCommitish?: string;
  requestedBaseCommitish?: string;
  requestedTargetCommitish?: string;
  clearComments?: boolean;
  repositoryId?: string;
}

export type LineNumber = number | [number, number];

export interface Comment {
  id: string;
  file: string;
  line: LineNumber;
  body: string;
  timestamp: string;
  codeContent?: string; // The actual code content for this line
  side?: DiffSide; // Which side the comment is on
}

export interface LineSelection {
  side: DiffSide;
  lineNumber: number;
}

// New data structures for enhanced comment and viewed state management

export interface DiffComment {
  id: string; // UUID format recommended
  filePath: string;
  body: string;
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format

  // Comment position
  position: {
    side: DiffSide; // whether on deletion (-) or addition (+) side
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

// Revision selector types
export interface RevisionOption {
  value: string;
  label: string;
}

export interface BranchInfo {
  name: string;
  current: boolean;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
}

export interface RevisionsResponse {
  specialOptions: RevisionOption[];
  branches: BranchInfo[];
  commits: CommitInfo[];
  resolvedBase?: string;
  resolvedTarget?: string;
}

// Expanded lines types for showing more context in diffs
export interface ExpandedLinesState {
  [filePath: string]: FileExpandedState;
}

export interface FileExpandedState {
  oldContent?: string[];
  newContent?: string[];
  expandedRanges: ExpandedRange[];
  oldTotalLines?: number;
  newTotalLines?: number;
}

export interface ExpandedRange {
  chunkIndex: number;
  direction: 'up' | 'down';
  count: number;
}

export interface ExpandedLine extends DiffLine {
  isExpanded?: boolean;
}
