import type { DiffCommentThread, DiffResponse } from '../../types/diff';
import type { SiteLanguage } from '../sitePageContent';

interface StaticRevision {
  id: string;
  demoTitle?: string;
  demoTitleByLanguage?: Partial<Record<SiteLanguage, string>>;
  demoMessageByLanguage?: Partial<Record<SiteLanguage, string>>;
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
  blobs: Record<string, string>;
  blobUrls?: Record<string, string>;
  comments?: Record<string, DiffCommentThread[]>;
}
