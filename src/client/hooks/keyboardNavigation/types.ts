import type { DiffFile, Comment, DiffViewMode } from '../../../types/diff';

/**
 * Represents the current cursor position in the diff viewer
 */
export interface CursorPosition {
  fileIndex: number;
  chunkIndex: number;
  lineIndex: number;
  side: 'left' | 'right';
}

/**
 * Function that determines if a position should be included in navigation
 */
export type NavigationFilter = (position: CursorPosition, files: DiffFile[]) => boolean;

/**
 * Result of a navigation attempt
 */
export interface NavigationResult {
  position: CursorPosition | null;
  scrollTarget: string | null;
}

/**
 * Props for the useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationProps {
  files: DiffFile[];
  comments: Comment[];
  viewMode?: DiffViewMode;
  reviewedFiles: Set<string>;
  onToggleReviewed: (filePath: string) => void;
  onCreateComment?: () => void;
  onCopyAllComments?: () => void;
  onDeleteAllComments?: () => void;
  onShowCommentsList?: () => void;
  onRefresh?: () => void;
  isModalOpen?: boolean;
}

/**
 * Return value of the useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationReturn {
  cursor: CursorPosition | null;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  setCursorPosition: (position: CursorPosition | null) => void;
}

/**
 * View modes for the diff viewer
 */
export type ViewMode = DiffViewMode;

/**
 * Navigation direction
 */
export type NavigationDirection = 'next' | 'prev';

/**
 * Constants for scroll behavior
 */
export const SCROLL_CONSTANTS = {
  /** Position element at 1/3 from top of viewport */
  VIEWPORT_OFFSET_RATIO: 1 / 3,
} as const;
