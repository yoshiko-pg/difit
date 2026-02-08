import type { DiffResponse } from '../../types/diff';

export interface StaticRevision {
  id: string;
  baseHash: string;
  baseShortHash: string;
  targetHash: string;
  targetShortHash: string;
  message: string;
  authorName: string;
  date: string;
}

export interface StaticDiffDataset {
  generatedAt: string;
  repository: string;
  initialRevisionId: string | null;
  revisions: StaticRevision[];
  diffs: Record<string, DiffResponse>;
}
