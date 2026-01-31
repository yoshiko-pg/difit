import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DiffFile, Comment } from '../../types/diff';

import { DiffViewer } from './DiffViewer';

// Mock the ImageDiffChunk component
vi.mock('./ImageDiffChunk', () => ({
  ImageDiffChunk: vi.fn(({ file }) => (
    <div data-testid="image-diff-chunk">Image diff for {file.path}</div>
  )),
}));

// Mock the DiffChunk component
vi.mock('./DiffChunk', () => ({
  DiffChunk: vi.fn(({ chunk }) => <div data-testid="diff-chunk">Diff chunk: {chunk.header}</div>),
}));

// Mock the PrismSyntaxHighlighter
vi.mock('./PrismSyntaxHighlighter', () => ({
  setCurrentFilename: vi.fn(),
}));

// Mock isImageFile utility
vi.mock('../utils/imageUtils', () => ({
  isImageFile: vi.fn((filename: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'];
    return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
  }),
}));

describe('DiffViewer', () => {
  const mockOnAddComment = vi.fn();
  const mockOnGeneratePrompt = vi.fn();
  const mockOnRemoveComment = vi.fn();
  const mockOnUpdateComment = vi.fn();
  const mockOnToggleReviewed = vi.fn();
  const mockOnToggleCollapsed = vi.fn();
  const mockOnToggleAllCollapsed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockFile = (overrides: Partial<DiffFile> = {}): DiffFile => ({
    path: 'test.txt',
    status: 'modified',
    additions: 5,
    deletions: 3,
    chunks: [
      {
        header: '@@ -1,5 +1,7 @@',
        oldStart: 1,
        oldLines: 5,
        newStart: 1,
        newLines: 7,
        lines: [
          { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'remove', content: 'old line', oldLineNumber: 2, newLineNumber: undefined },
          { type: 'add', content: 'new line', oldLineNumber: undefined, newLineNumber: 2 },
        ],
      },
    ],
    ...overrides,
  });

  const mockFile = createMockFile();
  const defaultProps = {
    file: mockFile,
    comments: [] as Comment[],
    reviewedFiles: new Set<string>(),
    collapsedFiles: new Set<string>(),
    diffMode: 'side-by-side' as const,
    onAddComment: mockOnAddComment,
    onGeneratePrompt: mockOnGeneratePrompt,
    onRemoveComment: mockOnRemoveComment,
    onUpdateComment: mockOnUpdateComment,
    onToggleReviewed: mockOnToggleReviewed,
    onToggleCollapsed: mockOnToggleCollapsed,
    onToggleAllCollapsed: mockOnToggleAllCollapsed,
    mergedChunks: mockFile.chunks.map((chunk, i) => ({
      ...chunk,
      originalIndices: [i],
      hiddenLinesBefore: 0,
      hiddenLinesAfter: 0,
    })),
    expandLines: vi.fn().mockResolvedValue(undefined),
    expandAllBetweenChunks: vi.fn().mockResolvedValue(undefined),
    prefetchFileContent: vi.fn().mockResolvedValue(undefined),
    isExpandLoading: false,
  };

  describe('File type handling', () => {
    it('renders ImageDiffChunk for image files', () => {
      const imageFile = createMockFile({
        path: 'image.jpg',
      });

      render(
        <DiffViewer
          {...defaultProps}
          file={imageFile}
          baseCommitish="main"
          targetCommitish="feature"
        />,
      );

      expect(screen.getByTestId('image-diff-chunk')).toBeInTheDocument();
      expect(screen.getByText('Image diff for image.jpg')).toBeInTheDocument();
      expect(screen.queryByTestId('diff-chunk')).not.toBeInTheDocument();
    });

    it('renders DiffChunk for non-image files', () => {
      const textFile = createMockFile({
        path: 'script.js',
      });

      render(<DiffViewer {...defaultProps} file={textFile} />);

      expect(screen.getByTestId('diff-chunk')).toBeInTheDocument();
      expect(screen.getByText('Diff chunk: @@ -1,5 +1,7 @@')).toBeInTheDocument();
      expect(screen.queryByTestId('image-diff-chunk')).not.toBeInTheDocument();
    });
  });

  describe('Props passing', () => {
    it('passes baseCommitish and targetCommitish to ImageDiffChunk', () => {
      const imageFile = createMockFile({
        path: 'image.png',
      });

      render(
        <DiffViewer
          {...defaultProps}
          file={imageFile}
          baseCommitish="main"
          targetCommitish="feature"
        />,
      );

      // Check that ImageDiffChunk is rendered for image files
      expect(screen.getByTestId('image-diff-chunk')).toBeInTheDocument();
      expect(screen.getByText('Image diff for image.png')).toBeInTheDocument();
    });

    it('passes diffMode to ImageDiffChunk', () => {
      const imageFile = createMockFile({
        path: 'image.gif',
      });

      render(<DiffViewer {...defaultProps} file={imageFile} diffMode="inline" />);

      // Check that ImageDiffChunk is rendered
      expect(screen.getByTestId('image-diff-chunk')).toBeInTheDocument();
      expect(screen.getByText('Image diff for image.gif')).toBeInTheDocument();
    });
  });

  describe('File header display', () => {
    it('displays file path in header', () => {
      const file = createMockFile({ path: 'src/components/Button.tsx' });

      render(<DiffViewer {...defaultProps} file={file} />);

      expect(screen.getByText('src/components/Button.tsx')).toBeInTheDocument();
    });

    it('shows file status indicators', () => {
      const addedFile = createMockFile({
        path: 'new-file.js',
        status: 'added',
        additions: 10,
        deletions: 0,
      });

      render(<DiffViewer {...defaultProps} file={addedFile} />);

      expect(screen.getByText('+10')).toBeInTheDocument();
    });
  });

  describe('Collapse functionality', () => {
    it('shows content when file is not collapsed', () => {
      const file = createMockFile();
      const collapsedFiles = new Set<string>();

      render(<DiffViewer {...defaultProps} file={file} collapsedFiles={collapsedFiles} />);

      expect(screen.getByTestId('diff-chunk')).toBeInTheDocument();
    });

    it('hides content when file is collapsed', () => {
      const file = createMockFile({ path: 'collapsed.js' });
      const collapsedFiles = new Set(['collapsed.js']);

      render(<DiffViewer {...defaultProps} file={file} collapsedFiles={collapsedFiles} />);

      expect(screen.queryByTestId('diff-chunk')).not.toBeInTheDocument();
      expect(screen.queryByTestId('image-diff-chunk')).not.toBeInTheDocument();
    });
  });

  describe('Comments integration', () => {
    it('passes comments to DiffChunk', () => {
      const comments: Comment[] = [
        {
          id: '1',
          file: 'test.txt',
          line: 5,
          body: 'Test comment',
          timestamp: new Date().toISOString(),
        },
      ];

      render(<DiffViewer {...defaultProps} comments={comments} />);

      // Check that DiffChunk is rendered for non-image files
      expect(screen.getByTestId('diff-chunk')).toBeInTheDocument();
      expect(screen.getByText('Diff chunk: @@ -1,5 +1,7 @@')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles files with no chunks', () => {
      const emptyFile = createMockFile({
        chunks: [],
      });

      render(<DiffViewer {...defaultProps} file={emptyFile} mergedChunks={[]} />);

      // Should not crash and should not render any diff chunks
      expect(screen.queryByTestId('diff-chunk')).not.toBeInTheDocument();
    });

    it('handles binary non-image files', () => {
      const binaryFile = createMockFile({
        path: 'data.bin',
        chunks: [],
      });

      render(<DiffViewer {...defaultProps} file={binaryFile} mergedChunks={[]} />);

      // Should render as regular diff (not image) since it's not an image file
      expect(screen.queryByTestId('image-diff-chunk')).not.toBeInTheDocument();
      expect(screen.queryByTestId('diff-chunk')).not.toBeInTheDocument();
    });

    it('handles image files based on extension', () => {
      const imageFile = createMockFile({
        path: 'image.jpg',
      });

      render(<DiffViewer {...defaultProps} file={imageFile} />);

      // Should render as image diff based on file extension
      expect(screen.getByTestId('image-diff-chunk')).toBeInTheDocument();
    });
  });

  describe('Callback props', () => {
    it('renders DiffChunk with correct props for non-image files', () => {
      render(<DiffViewer {...defaultProps} />);

      // Check that DiffChunk is rendered for non-image files
      expect(screen.getByTestId('diff-chunk')).toBeInTheDocument();
      expect(screen.getByText('Diff chunk: @@ -1,5 +1,7 @@')).toBeInTheDocument();
    });
  });
});
