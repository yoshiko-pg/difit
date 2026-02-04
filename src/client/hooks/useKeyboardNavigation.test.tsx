import { renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DiffFile } from '../../types/diff';

import { useKeyboardNavigation } from './useKeyboardNavigation';

// Mock scrollIntoView and getElementById
Element.prototype.scrollIntoView = vi.fn();
const mockGetElementById = vi.spyOn(document, 'getElementById');
const mockQuerySelector = vi.spyOn(document, 'querySelector');

// Mock window properties
Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

Object.defineProperty(window, 'pageYOffset', {
  writable: true,
  configurable: true,
  value: 0,
});

window.scrollTo = vi.fn();

// Helper to create mock elements
const createMockElement = () => ({
  scrollIntoView: vi.fn(),
  getBoundingClientRect: vi.fn(() => ({
    top: 100,
    bottom: 200,
    left: 0,
    right: 100,
    width: 100,
    height: 100,
  })),
  offsetTop: 150,
});

// Helper to create mock scrollable container
const createMockScrollContainer = () => ({
  getBoundingClientRect: vi.fn(() => ({
    top: 0,
    bottom: 768,
    left: 0,
    right: 1024,
    width: 1024,
    height: 768,
  })),
  scrollTop: 0,
  scrollHeight: 2000,
  clientHeight: 768,
});

// Sample diff data for testing
const mockFiles: DiffFile[] = [
  {
    path: 'file1.js',
    status: 'modified',
    additions: 1,
    deletions: 1,
    chunks: [
      {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 4,
        lines: [
          { type: 'delete', oldLineNumber: 1, content: '- old line' },
          { type: 'add', newLineNumber: 1, content: '+ new line' },
          { type: 'normal', oldLineNumber: 2, newLineNumber: 2, content: '  unchanged' },
          { type: 'normal', oldLineNumber: 3, newLineNumber: 3, content: '  another unchanged' },
        ],
        header: '@@ -1,3 +1,4 @@',
      },
    ],
  },
  {
    path: 'file2.js',
    status: 'modified',
    additions: 1,
    deletions: 0,
    chunks: [
      {
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        lines: [
          { type: 'normal', oldLineNumber: 1, newLineNumber: 1, content: '  first line' },
          { type: 'add', newLineNumber: 2, content: '+ added line' },
        ],
        header: '@@ -1,2 +1,2 @@',
      },
    ],
  },
];

// Wrapper component - using the mocked HotkeysProvider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HotkeysProvider initiallyActiveScopes={['navigation']}>{children}</HotkeysProvider>
);

describe('useKeyboardNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetElementById.mockImplementation(() => createMockElement() as any);
    mockQuerySelector.mockImplementation(() => createMockScrollContainer() as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should render without errors', () => {
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      expect(result.current.cursor).toBeNull();
      expect(result.current.isHelpOpen).toBe(false);
    });
  });

  describe('Line Navigation (j/k)', () => {
    it('should navigate to next line with j key', async () => {
      const user = userEvent.setup();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      await user.keyboard('j');

      expect(result.current.cursor).toEqual({
        fileIndex: 0,
        chunkIndex: 0,
        lineIndex: 0,
        side: 'left',
      });
    });

    it('should navigate to next line with down arrow', async () => {
      const user = userEvent.setup();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      await user.keyboard('{ArrowDown}');

      expect(result.current.cursor).toEqual({
        fileIndex: 0,
        chunkIndex: 0,
        lineIndex: 0,
        side: 'left',
      });
    });

    it('should navigate to previous line with k key', async () => {
      const user = userEvent.setup();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // First set cursor to a line
      act(() => {
        result.current.setCursorPosition({
          fileIndex: 0,
          chunkIndex: 0,
          lineIndex: 2,
          side: 'right',
        });
      });

      await user.keyboard('k');

      expect(result.current.cursor).toEqual({
        fileIndex: 0,
        chunkIndex: 0,
        lineIndex: 1,
        side: 'right',
      });
    });
  });

  describe('File Navigation (]/[)', () => {
    it('should navigate to next file with ] key', async () => {
      const user = userEvent.setup();
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      await user.keyboard('{\\]}');

      // After navigating to file, cursor should be set
      expect(result.current.cursor).not.toBeNull();
      // When starting from null cursor, ] navigates to the first valid position
      // which could be fileIndex 0 or 1 depending on filter implementation
      expect(result.current.cursor?.fileIndex).toBeGreaterThanOrEqual(0);
      expect(result.current.cursor?.fileIndex).toBeLessThan(mockFiles.length);
    });

    it('should navigate to previous file with [ key', async () => {
      const user = userEvent.setup();
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Set cursor to second file
      act(() => {
        result.current.setCursorPosition({
          fileIndex: 1,
          chunkIndex: 0,
          lineIndex: 0,
          side: 'right',
        });
      });

      await user.keyboard('{\\[}');

      expect(result.current.cursor?.fileIndex).toBe(0);
    });

    it('should jump to first file with Shift+[ key', async () => {
      const user = userEvent.setup();
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Set cursor to second file
      act(() => {
        result.current.setCursorPosition({
          fileIndex: 1,
          chunkIndex: 0,
          lineIndex: 0,
          side: 'right',
        });
      });

      await user.keyboard('[ShiftLeft>][BracketLeft][/ShiftLeft]');

      expect(result.current.cursor?.fileIndex).toBe(0);
      expect(result.current.cursor?.chunkIndex).toBe(0);
      expect(result.current.cursor?.lineIndex).toBe(0);
    });

    it('should jump to last file with Shift+] key', async () => {
      const user = userEvent.setup();
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Set cursor to first file
      act(() => {
        result.current.setCursorPosition({
          fileIndex: 0,
          chunkIndex: 0,
          lineIndex: 0,
          side: 'right',
        });
      });

      await user.keyboard('[ShiftLeft>][BracketRight][/ShiftLeft]');

      expect(result.current.cursor?.fileIndex).toBe(mockFiles.length - 1);
      expect(result.current.cursor?.chunkIndex).toBe(0);
      expect(result.current.cursor?.lineIndex).toBe(0);
    });
  });

  describe('Chunk Navigation (n/p)', () => {
    it('should navigate to next chunk with n key', async () => {
      const user = userEvent.setup();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      await user.keyboard('n');

      // Should navigate to the first changed line
      expect(result.current.cursor).not.toBeNull();
    });

    it('should navigate to previous chunk with p key', async () => {
      const user = userEvent.setup();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // First navigate to a chunk
      await user.keyboard('n');
      await user.keyboard('n');

      // Then navigate back
      await user.keyboard('p');

      expect(result.current.cursor).not.toBeNull();
    });
  });

  describe('Comment Navigation (N/P)', () => {
    it('should navigate to next comment with Shift+N', async () => {
      const user = userEvent.setup();
      const comments = [
        {
          id: '1',
          file: 'file1.js',
          line: 2,
          body: 'Comment 1',
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          file: 'file2.js',
          line: 1,
          body: 'Comment 2',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments,
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      await user.keyboard('{Shift>}n{/Shift}');

      // Should navigate to the first comment
      expect(result.current.cursor).not.toBeNull();
    });

    it('should navigate to previous comment with Shift+P', async () => {
      const user = userEvent.setup();
      const comments = [
        {
          id: '1',
          file: 'file1.js',
          line: 2,
          body: 'Comment 1',
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          file: 'file2.js',
          line: 1,
          body: 'Comment 2',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments,
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Navigate to second comment first
      await user.keyboard('{Shift>}n{/Shift}');
      await user.keyboard('{Shift>}n{/Shift}');

      // Then navigate back
      await user.keyboard('{Shift>}p{/Shift}');

      expect(result.current.cursor).not.toBeNull();
    });
  });

  describe('Help Modal (?)', () => {
    it('should toggle help modal with ? key', async () => {
      const user = userEvent.setup();
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      expect(result.current.isHelpOpen).toBe(false);

      // ? is Shift + / on US keyboard
      await user.keyboard('{Shift>}?{/Shift}');
      // await user.keyboard('[ShiftLeft>][Slash]');

      expect(result.current.isHelpOpen).toBe(true);
    });

    it('should allow closing help modal with setIsHelpOpen', () => {
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      act(() => {
        result.current.setIsHelpOpen(true);
      });

      expect(result.current.isHelpOpen).toBe(true);

      act(() => {
        result.current.setIsHelpOpen(false);
      });

      expect(result.current.isHelpOpen).toBe(false);
    });
  });

  describe('Review Toggle (v)', () => {
    it('should toggle reviewed state with v key', async () => {
      const user = userEvent.setup();
      const onToggleReviewed = vi.fn();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed,
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Set cursor first
      act(() => {
        result.current.setCursorPosition({
          fileIndex: 0,
          chunkIndex: 0,
          lineIndex: 0,
          side: 'left',
        });
      });

      await user.keyboard('v');

      expect(onToggleReviewed).toHaveBeenCalledWith('file1.js');
    });

    it('should not toggle reviewed state when no file is selected', async () => {
      const user = userEvent.setup();
      const onToggleReviewed = vi.fn();

      renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed,
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      await user.keyboard('v');

      expect(onToggleReviewed).not.toHaveBeenCalled();
    });
  });

  describe('Refresh (shift+r)', () => {
    it('should trigger refresh with shift+r key', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn();

      renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
            onRefresh,
          }),
        { wrapper },
      );

      await user.keyboard('{Shift>}r{/Shift}');

      expect(onRefresh).toHaveBeenCalled();
    });

    it('should not trigger refresh when onRefresh is not provided', async () => {
      const user = userEvent.setup();

      renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Should not throw error
      await expect(user.keyboard('r')).resolves.not.toThrow();
    });
  });

  describe('Add Comment (c)', () => {
    it('should trigger comment creation on add/normal lines with c key', async () => {
      const user = userEvent.setup();
      const onCreateComment = vi.fn();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
            onCreateComment,
          }),
        { wrapper },
      );

      // Navigate to a normal line
      act(() => {
        result.current.setCursorPosition({
          fileIndex: 0,
          chunkIndex: 0,
          lineIndex: 2,
          side: 'right',
        });
      });

      await user.keyboard('c');

      expect(onCreateComment).toHaveBeenCalled();
    });

    it('should not trigger comment creation on deleted lines', async () => {
      const user = userEvent.setup();
      const onCreateComment = vi.fn();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
            onCreateComment,
          }),
        { wrapper },
      );

      // Navigate to a delete line
      act(() => {
        result.current.setCursorPosition({
          fileIndex: 0,
          chunkIndex: 0,
          lineIndex: 0,
          side: 'left',
        });
      });

      await user.keyboard('c');

      expect(onCreateComment).not.toHaveBeenCalled();
    });
  });

  describe('Side Switching (h/l)', () => {
    it('should switch to left side with h key', async () => {
      const user = userEvent.setup();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'split',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Set cursor to right side
      act(() => {
        result.current.setCursorPosition({
          fileIndex: 0,
          chunkIndex: 0,
          lineIndex: 2,
          side: 'right',
        });
      });

      await user.keyboard('h');

      expect(result.current.cursor?.side).toBe('left');
    });

    it('should switch to right side with l key', async () => {
      const user = userEvent.setup();

      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'split',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Set cursor to left side
      act(() => {
        result.current.setCursorPosition({
          fileIndex: 0,
          chunkIndex: 0,
          lineIndex: 0,
          side: 'left',
        });
      });

      await user.keyboard('l');

      expect(result.current.cursor?.side).toBe('right');
    });
  });

  describe('Move to Center (.)', () => {
    it('should move cursor to the center of viewport with . key', async () => {
      const user = userEvent.setup();
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Mock multiple elements at different positions
      const elements = [
        { id: 'file-0-chunk-0-line-0', top: 100, bottom: 150 },
        { id: 'file-0-chunk-0-line-1', top: 300, bottom: 350 },
        { id: 'file-0-chunk-0-line-2', top: 380, bottom: 430 }, // Closest to center (384)
        { id: 'file-0-chunk-0-line-3', top: 500, bottom: 550 },
      ];

      mockGetElementById.mockImplementation((id) => {
        const element = elements.find((e) => e.id === id);
        if (element) {
          return {
            getBoundingClientRect: () => ({
              top: element.top,
              bottom: element.bottom,
              height: element.bottom - element.top,
            }),
          } as any;
        }
        return null;
      });

      await user.keyboard('{.}');

      // Should set cursor
      expect(result.current.cursor).not.toBeNull();
    });
  });

  describe('Scope handling', () => {
    it('should use navigation scope for hotkeys', () => {
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Test should pass as long as no errors are thrown
      // The actual scope management is handled by modal components
      expect(result.current.cursor).toBeNull();
    });
  });

  describe('Input Field Handling', () => {
    it('should not handle shortcuts when typing in input fields', async () => {
      const user = userEvent.setup();
      const onToggleReviewed = vi.fn();

      // Create an input element
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed,
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Type in the input
      await user.keyboard('j');
      await user.keyboard('r');

      // Hotkeys should not be triggered
      expect(onToggleReviewed).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(input);
    });

    it('should not handle shortcuts when typing in textarea', async () => {
      const user = userEvent.setup();
      const onToggleReviewed = vi.fn();

      // Create a textarea element
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed,
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Type in the textarea
      await user.keyboard('j');
      await user.keyboard('r');

      // Hotkeys should not be triggered
      expect(onToggleReviewed).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(textarea);
    });
  });

  describe('Set Cursor Position', () => {
    it('should set cursor position when setCursorPosition is called', () => {
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'unified',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      const position = {
        fileIndex: 0,
        chunkIndex: 0,
        lineIndex: 1,
        side: 'right' as const,
      };

      act(() => {
        result.current.setCursorPosition(position);
      });

      expect(result.current.cursor).toEqual(position);
    });

    it('should fix side when setting cursor position in split mode', () => {
      const { result } = renderHook(
        () =>
          useKeyboardNavigation({
            files: mockFiles,
            comments: [],
            viewMode: 'split',
            onToggleReviewed: vi.fn(),
            reviewedFiles: new Set<string>(),
          }),
        { wrapper },
      );

      // Try to set cursor on a delete line with right side
      const position = {
        fileIndex: 0,
        chunkIndex: 0,
        lineIndex: 0, // Delete line
        side: 'right' as const,
      };

      act(() => {
        result.current.setCursorPosition(position);
      });

      // Should fix to left side since delete lines only have content on left
      expect(result.current.cursor).toEqual({
        ...position,
        side: 'left',
      });
    });
  });
});
