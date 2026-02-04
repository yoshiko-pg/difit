import type { ComponentType } from 'react';

import type { Comment, DiffFile, DiffSide, DiffViewMode, LineNumber } from '../../types/diff';
import type { AppearanceSettings } from '../components/SettingsModal';
import type { CursorPosition } from '../hooks/keyboardNavigation';
import type { MergedChunk } from '../hooks/useExpandedLines';

export type DiffViewerBodyProps = {
  file: DiffFile;
  comments: Comment[];
  diffMode: DiffViewMode;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
  baseCommitish?: string;
  targetCommitish?: string;
  cursor?: CursorPosition | null;
  fileIndex?: number;
  mergedChunks: MergedChunk[];
  isExpandLoading: boolean;
  expandHiddenLines: (
    file: DiffFile,
    chunkIndex: number,
    direction: 'up' | 'down',
    count?: number,
  ) => Promise<void>;
  expandAllBetweenChunks: (
    file: DiffFile,
    chunkIndex: number,
    hiddenLines: number,
  ) => Promise<void>;
  onAddComment: (
    line: LineNumber,
    body: string,
    codeContent?: string,
    side?: DiffSide,
  ) => Promise<void>;
  onGeneratePrompt: (comment: Comment) => string;
  onRemoveComment: (commentId: string) => void;
  onUpdateComment: (commentId: string, newBody: string) => void;
  onOpenInEditor?: (filePath: string, lineNumber: number) => void;
  onLineClick?: (
    fileIndex: number,
    chunkIndex: number,
    lineIndex: number,
    side: 'left' | 'right',
  ) => void;
  commentTrigger?: { fileIndex: number; chunkIndex: number; lineIndex: number } | null;
  onCommentTriggerHandled?: () => void;
};

export type DiffViewerRegistration = {
  id: string;
  match: (file: DiffFile) => boolean;
  Component: ComponentType<DiffViewerBodyProps>;
  canExpandHiddenLines?: (file: DiffFile) => boolean;
};
