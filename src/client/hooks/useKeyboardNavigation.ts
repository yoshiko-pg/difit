import { useState, useCallback, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import type { Comment } from '../../types/diff';
import { DEFAULT_DIFF_VIEW_MODE } from '../../utils/diffMode';
import { NAVIGATION_SELECTORS } from '../constants/navigation';
import { getElementId, getCommentKey } from '../utils/navigation/domHelpers';
import { fixSide, hasContentOnSide } from '../utils/navigation/lineHelpers';

import {
  type CursorPosition,
  type NavigationDirection,
  type NavigationFilter,
  type NavigationResult,
  type UseKeyboardNavigationProps,
  type UseKeyboardNavigationReturn,
  createNavigationFilters,
  createScrollToElement,
} from './keyboardNavigation';
import { getStartPosition, findNextMatchingPosition } from './keyboardNavigation/navigationCore';

/**
 * Keyboard navigation hook for diff viewer
 * Provides Gerrit-style keyboard shortcuts for navigating through diffs
 */
export function useKeyboardNavigation({
  files,
  comments,
  viewMode = DEFAULT_DIFF_VIEW_MODE,
  reviewedFiles,
  onToggleReviewed,
  onCreateComment,
  onCopyAllComments,
  onDeleteAllComments,
  onShowCommentsList,
  onRefresh,
}: UseKeyboardNavigationProps): UseKeyboardNavigationReturn {
  const [cursor, setCursor] = useState<CursorPosition | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Create scroll function
  const scrollToElement = useMemo(() => createScrollToElement(), []);

  // Build comment index for efficient lookup
  const commentIndex = useMemo(() => {
    const index = new Map<string, Comment[]>();
    comments.forEach((comment) => {
      const lineNum = Array.isArray(comment.line) ? comment.line[0] : comment.line;
      const key = getCommentKey(comment.file, lineNum);
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key)?.push(comment);
    });
    return index;
  }, [comments]);

  // Create navigation filters
  const filters = useMemo(
    () => createNavigationFilters(files, commentIndex, viewMode, reviewedFiles),
    [files, commentIndex, viewMode, reviewedFiles],
  );

  // Core navigation function - finds next/prev position matching filter
  const navigate = useCallback(
    (direction: NavigationDirection, filter: NavigationFilter): NavigationResult => {
      if (files.length === 0) {
        return { position: null, scrollTarget: null };
      }

      const startPosition = getStartPosition(cursor);
      return findNextMatchingPosition(startPosition, direction, filter, files, viewMode);
    },
    [cursor, files, viewMode],
  );

  // Create navigation commands
  const createNavigationCommand = useCallback(
    (filter: NavigationFilter) => {
      return (direction: NavigationDirection) => {
        const result = navigate(direction, filter);
        if (result.position) {
          setCursor(result.position);
          if (result.scrollTarget) {
            scrollToElement(result.scrollTarget);
          }
        }
      };
    },
    [navigate, scrollToElement],
  );

  // Navigation commands
  const navigateToLine = useMemo(
    () => createNavigationCommand(filters.line),
    [createNavigationCommand, filters.line],
  );

  const navigateToChunk = useMemo(
    () => createNavigationCommand(filters.chunk),
    [createNavigationCommand, filters.chunk],
  );

  const navigateToFile = useMemo(
    () => createNavigationCommand(filters.file),
    [createNavigationCommand, filters.file],
  );

  // Navigation to comments
  const navigateToComment = useMemo(
    () => createNavigationCommand(filters.comment),
    [createNavigationCommand, filters.comment],
  );

  // Switch between left and right sides in split mode
  const switchSide = useCallback(
    (side: 'left' | 'right') => {
      if (!cursor || viewMode !== 'split') return;

      // Create new cursor with the requested side
      let newCursor = { ...cursor, side };

      // Special handling for delete/add pairs in split view
      // These appear on the same visual line but are different line indices
      const currentLine =
        files[cursor.fileIndex]?.chunks[cursor.chunkIndex]?.lines[cursor.lineIndex];
      if (currentLine) {
        // If switching from right (add) to left (delete), check if previous line is a delete
        if (side === 'left' && currentLine.type === 'add' && cursor.lineIndex > 0) {
          const prevLine =
            files[cursor.fileIndex]?.chunks[cursor.chunkIndex]?.lines[cursor.lineIndex - 1];
          if (prevLine?.type === 'delete') {
            // Move to the delete line that pairs with this add line
            newCursor = { ...newCursor, lineIndex: cursor.lineIndex - 1 };
            setCursor(newCursor);
            scrollToElement(getElementId(newCursor, viewMode));
            return;
          }
        }
        // If switching from left (delete) to right (add), check if next line is an add
        else if (side === 'right' && currentLine.type === 'delete') {
          const nextLine =
            files[cursor.fileIndex]?.chunks[cursor.chunkIndex]?.lines[cursor.lineIndex + 1];
          if (nextLine?.type === 'add') {
            // Move to the add line that pairs with this delete line
            newCursor = { ...newCursor, lineIndex: cursor.lineIndex + 1 };
            setCursor(newCursor);
            scrollToElement(getElementId(newCursor, viewMode));
            return;
          }
        }
      }

      // Check if the new position has content
      if (!hasContentOnSide(newCursor, files)) {
        // Find the nearest line with content on the target side
        const file = files[cursor.fileIndex];
        if (!file) return;

        // First, try to find a line in the current chunk
        const currentChunk = file.chunks[cursor.chunkIndex];
        if (currentChunk) {
          // Search forward from current position
          for (let i = cursor.lineIndex + 1; i < currentChunk.lines.length; i++) {
            const testPos = { ...newCursor, lineIndex: i };
            if (hasContentOnSide(testPos, files)) {
              newCursor = testPos;
              break;
            }
          }

          // If not found forward, search backward
          if (!hasContentOnSide(newCursor, files)) {
            for (let i = cursor.lineIndex - 1; i >= 0; i--) {
              const testPos = { ...newCursor, lineIndex: i };
              if (hasContentOnSide(testPos, files)) {
                newCursor = testPos;
                break;
              }
            }
          }
        }

        // If still no content found in current chunk, search other chunks
        if (!hasContentOnSide(newCursor, files)) {
          // Search forward chunks
          for (let chunkIdx = cursor.chunkIndex + 1; chunkIdx < file.chunks.length; chunkIdx++) {
            const chunk = file.chunks[chunkIdx];
            if (!chunk) continue;
            for (let lineIdx = 0; lineIdx < chunk.lines.length; lineIdx++) {
              const testPos = { ...newCursor, chunkIndex: chunkIdx, lineIndex: lineIdx };
              if (hasContentOnSide(testPos, files)) {
                newCursor = testPos;
                break;
              }
            }
            if (hasContentOnSide(newCursor, files)) break;
          }

          // If still not found, search backward chunks
          if (!hasContentOnSide(newCursor, files)) {
            for (let chunkIdx = cursor.chunkIndex - 1; chunkIdx >= 0; chunkIdx--) {
              const chunk = file.chunks[chunkIdx];
              if (!chunk) continue;
              for (let lineIdx = chunk.lines.length - 1; lineIdx >= 0; lineIdx--) {
                const testPos = { ...newCursor, chunkIndex: chunkIdx, lineIndex: lineIdx };
                if (hasContentOnSide(testPos, files)) {
                  newCursor = testPos;
                  break;
                }
              }
              if (hasContentOnSide(newCursor, files)) break;
            }
          }
        }
      }

      // Update cursor and scroll
      setCursor(newCursor);
      scrollToElement(getElementId(newCursor, viewMode));
    },
    [cursor, viewMode, scrollToElement, files],
  );

  // Move cursor to center of viewport
  const moveToCenterOfViewport = useCallback(() => {
    // Get the scrollable container
    const scrollContainer = document.querySelector(
      NAVIGATION_SELECTORS.SCROLL_CONTAINER,
    ) as HTMLElement | null;
    if (!scrollContainer) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;

    // Find all diff line elements
    let closestDistance = Infinity;
    let closestPosition: CursorPosition | null = null;

    // Iterate through all files and lines to find the one closest to center
    files.forEach((file, fileIndex) => {
      file.chunks.forEach((chunk, chunkIndex) => {
        chunk.lines.forEach((_, lineIndex) => {
          // Check both sides in split mode
          const sides = viewMode === 'split' ? (['left', 'right'] as const) : (['right'] as const);

          for (const side of sides) {
            const position: CursorPosition = { fileIndex, chunkIndex, lineIndex, side };

            // Skip positions without content in split mode
            if (viewMode === 'split' && !hasContentOnSide(position, files)) {
              continue;
            }

            const elementId = getElementId(position, viewMode);
            const element = document.getElementById(elementId);

            if (element) {
              const rect = element.getBoundingClientRect();
              const elementCenterY = rect.top + rect.height / 2;
              const distance = Math.abs(elementCenterY - centerY);

              // Check if element is visible
              if (rect.top < containerRect.bottom && rect.bottom > containerRect.top) {
                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestPosition = position;
                }
              }
            }
          }
        });
      });
    });

    // Set cursor to the closest position
    if (closestPosition) {
      setCursor(closestPosition);
      // Don't scroll since we're moving to already visible content
    }
  }, [files, viewMode, setCursor]);

  // Set cursor position from external source (e.g., mouse click)
  const setCursorPosition = useCallback(
    (position: CursorPosition | null) => {
      if (!position) {
        setCursor(null);
        return;
      }
      // Fix the side if necessary
      const fixedPosition = fixSide(position, files);
      setCursor(fixedPosition);
      scrollToElement(getElementId(fixedPosition, viewMode));
    },
    [files, viewMode, scrollToElement],
  );

  // Common options for all hotkeys
  const hotkeyOptions = {
    scopes: 'navigation',
    enableOnFormTags: false,
    preventDefault: true,
  };

  // Line navigation
  useHotkeys('j, down', () => navigateToLine('next'), hotkeyOptions, [navigateToLine]);
  useHotkeys('k, up', () => navigateToLine('prev'), hotkeyOptions, [navigateToLine]);

  // Chunk navigation
  useHotkeys('n', () => navigateToChunk('next'), hotkeyOptions, [navigateToChunk]);
  useHotkeys('p', () => navigateToChunk('prev'), hotkeyOptions, [navigateToChunk]);

  // Comment navigation
  useHotkeys('shift+n', () => navigateToComment('next'), hotkeyOptions, [navigateToComment]);
  useHotkeys('shift+p', () => navigateToComment('prev'), hotkeyOptions, [navigateToComment]);

  // File navigation
  useHotkeys(']', () => navigateToFile('next'), { ...hotkeyOptions, useKey: true }, [
    navigateToFile,
  ]);
  useHotkeys('[', () => navigateToFile('prev'), { ...hotkeyOptions, useKey: true }, [
    navigateToFile,
  ]);

  // Jump to first/last file
  useHotkeys(
    '{',
    () => {
      if (files.length > 0) {
        setCursor({
          fileIndex: 0,
          chunkIndex: 0,
          lineIndex: 0,
          side: viewMode === 'split' ? 'left' : 'right',
        });
        scrollToElement(
          getElementId(
            {
              fileIndex: 0,
              chunkIndex: 0,
              lineIndex: 0,
              side: viewMode === 'split' ? 'left' : 'right',
            },
            viewMode,
          ),
        );
      }
    },
    { ...hotkeyOptions, useKey: true },
    [files, viewMode, scrollToElement],
  );

  useHotkeys(
    '}',
    () => {
      if (files.length > 0) {
        const lastFileIndex = files.length - 1;
        const lastFile = files[lastFileIndex];
        if (lastFile && lastFile.chunks.length > 0) {
          setCursor({
            fileIndex: lastFileIndex,
            chunkIndex: 0,
            lineIndex: 0,
            side: viewMode === 'split' ? 'left' : 'right',
          });
          scrollToElement(
            getElementId(
              {
                fileIndex: lastFileIndex,
                chunkIndex: 0,
                lineIndex: 0,
                side: viewMode === 'split' ? 'left' : 'right',
              },
              viewMode,
            ),
          );
        }
      }
    },
    { ...hotkeyOptions, useKey: true },
    [files, viewMode, scrollToElement],
  );

  // Side switching (split mode only)
  useHotkeys(
    'h, left',
    () => switchSide('left'),
    { ...hotkeyOptions, enabled: viewMode === 'split' },
    [switchSide, viewMode],
  );
  useHotkeys(
    'l, right',
    () => switchSide('right'),
    { ...hotkeyOptions, enabled: viewMode === 'split' },
    [switchSide, viewMode],
  );

  // File review toggle
  useHotkeys(
    'v',
    () => {
      if (cursor) {
        const file = files[cursor.fileIndex];
        if (file) {
          onToggleReviewed(file.path);
        }
      }
    },
    hotkeyOptions,
    [cursor, files, onToggleReviewed],
  );

  // Refresh
  useHotkeys(
    'shift+r',
    () => {
      if (onRefresh) {
        onRefresh();
      }
    },
    hotkeyOptions,
    [onRefresh],
  );

  // Comment creation
  useHotkeys(
    'c',
    () => {
      if (cursor && onCreateComment) {
        // Get the current line
        const line = files[cursor.fileIndex]?.chunks[cursor.chunkIndex]?.lines[cursor.lineIndex];
        // Only create comment if not on a deleted line
        if (line && line.type !== 'delete') {
          onCreateComment();
        }
      }
    },
    hotkeyOptions,
    [cursor, files, onCreateComment],
  );

  // Help toggle
  useHotkeys('?', () => setIsHelpOpen(!isHelpOpen), { ...hotkeyOptions, useKey: true }, [
    isHelpOpen,
  ]);

  // Move to center of viewport - only if no modifier keys are pressed
  useHotkeys(
    '.',
    (event) => {
      // Don't execute if any modifier keys are pressed
      if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
        return;
      }
      // Execute for standalone '.' key and prevent other handlers
      moveToCenterOfViewport();
      event.preventDefault();
    },
    { ...hotkeyOptions, useKey: true, preventDefault: false },
    [moveToCenterOfViewport],
  );

  // Copy all comments prompt - available in both navigation and comments-list scopes
  useHotkeys(
    'shift+c',
    () => {
      if (onCopyAllComments) {
        onCopyAllComments();
      }
    },
    { ...hotkeyOptions, scopes: ['navigation', 'comments-list'] },
    [onCopyAllComments],
  );

  // Delete all comments - available in both navigation and comments-list scopes
  useHotkeys(
    'shift+d',
    () => {
      if (onDeleteAllComments) {
        onDeleteAllComments();
      }
    },
    { ...hotkeyOptions, scopes: ['navigation', 'comments-list'] },
    [onDeleteAllComments],
  );

  // Show comments list
  useHotkeys(
    'shift+l',
    () => {
      if (onShowCommentsList) {
        onShowCommentsList();
      }
    },
    hotkeyOptions,
    [onShowCommentsList],
  );

  return {
    cursor,
    isHelpOpen,
    setIsHelpOpen,
    setCursorPosition,
  };
}
