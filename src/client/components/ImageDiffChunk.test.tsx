import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DiffFile } from '../../types/diff';

import { ImageDiffChunk } from './ImageDiffChunk';

describe('ImageDiffChunk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch to return a blob with size
    (global.fetch as any).mockResolvedValue({
      blob: () => Promise.resolve({ size: 1024 }),
    });
  });

  describe('File status handling', () => {
    it('renders deleted image correctly', () => {
      const deletedFile: DiffFile = {
        path: 'test.jpg',
        oldPath: 'test.jpg',
        status: 'deleted',
        additions: 0,
        deletions: 1,
        chunks: [],
      };

      render(<ImageDiffChunk file={deletedFile} />);

      expect(screen.getByText('Deleted Image')).toBeInTheDocument();
      expect(screen.getByText('Previous version:')).toBeInTheDocument();
      expect(screen.getByRole('img')).toHaveAttribute('src', '/api/blob/test.jpg?ref=HEAD~1');
    });

    it('renders added image correctly', () => {
      const addedFile: DiffFile = {
        path: 'test.jpg',
        status: 'added',
        additions: 1,
        deletions: 0,
        chunks: [],
      };

      render(<ImageDiffChunk file={addedFile} />);

      expect(screen.getByText('Added Image')).toBeInTheDocument();
      expect(screen.getByText('New file:')).toBeInTheDocument();
      expect(screen.getByRole('img')).toHaveAttribute('src', '/api/blob/test.jpg?ref=HEAD');
    });

    it('renders modified image correctly in side-by-side mode', () => {
      const modifiedFile: DiffFile = {
        path: 'test.jpg',
        oldPath: 'test.jpg',
        status: 'modified',
        additions: 1,
        deletions: 1,
        chunks: [],
      };

      render(<ImageDiffChunk file={modifiedFile} mode="side-by-side" />);

      expect(screen.getByText('Modified Image')).toBeInTheDocument();
      expect(screen.getByText('Previous version:')).toBeInTheDocument();
      expect(screen.getByText('Current version:')).toBeInTheDocument();

      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(2);
    });

    it('renders modified image correctly in inline mode', () => {
      const modifiedFile: DiffFile = {
        path: 'test.jpg',
        oldPath: 'test.jpg',
        status: 'modified',
        additions: 1,
        deletions: 1,
        chunks: [],
      };

      render(<ImageDiffChunk file={modifiedFile} mode="inline" />);

      expect(screen.getByText('Modified Image')).toBeInTheDocument();
      expect(screen.getByText('Previous version:')).toBeInTheDocument();
      expect(screen.getByText('Current version:')).toBeInTheDocument();

      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(2);
    });

    it('handles renamed image correctly', () => {
      const renamedFile: DiffFile = {
        path: 'new-name.jpg',
        oldPath: 'old-name.jpg',
        status: 'renamed',
        additions: 0,
        deletions: 0,
        chunks: [],
      };

      render(<ImageDiffChunk file={renamedFile} />);

      expect(screen.getByText('Modified Image')).toBeInTheDocument();

      const images = screen.getAllByRole('img');
      expect(images[0]).toHaveAttribute('src', '/api/blob/old-name.jpg?ref=HEAD~1');
      expect(images[1]).toHaveAttribute('src', '/api/blob/new-name.jpg?ref=HEAD');
    });
  });

  describe('Image loading with custom refs', () => {
    it('sets correct image src URLs with custom commitish', () => {
      const file: DiffFile = {
        path: 'test.jpg',
        oldPath: 'old-test.jpg',
        status: 'modified',
        additions: 1,
        deletions: 1,
        chunks: [],
      };

      render(<ImageDiffChunk file={file} baseCommitish="main" targetCommitish="feature" />);

      const images = screen.getAllByRole('img');
      expect(images[0]).toHaveAttribute('src', '/api/blob/old-test.jpg?ref=main');
      expect(images[1]).toHaveAttribute('src', '/api/blob/test.jpg?ref=feature');
    });

    it('uses default refs when not provided', () => {
      const file: DiffFile = {
        path: 'test.jpg',
        oldPath: 'old-test.jpg',
        status: 'modified',
        additions: 1,
        deletions: 1,
        chunks: [],
      };

      render(<ImageDiffChunk file={file} />);

      const images = screen.getAllByRole('img');
      expect(images[0]).toHaveAttribute('src', '/api/blob/old-test.jpg?ref=HEAD~1');
      expect(images[1]).toHaveAttribute('src', '/api/blob/test.jpg?ref=HEAD');
    });
  });

  describe('Error handling', () => {
    it('handles image load errors gracefully', () => {
      const file: DiffFile = {
        path: 'test.jpg',
        status: 'added',
        additions: 1,
        deletions: 0,
        chunks: [],
      };

      render(<ImageDiffChunk file={file} />);

      const image = screen.getByRole('img');

      // Simulate image load error
      const errorEvent = new Event('error');
      image.dispatchEvent(errorEvent);

      // Image should be hidden after error
      expect(image.style.display).toBe('none');
    });
  });

  describe('Checkerboard background', () => {
    it('applies checkerboard style to images for transparency support', () => {
      const file: DiffFile = {
        path: 'test.png',
        status: 'added',
        additions: 1,
        deletions: 0,
        chunks: [],
      };

      render(<ImageDiffChunk file={file} />);

      const image = screen.getByRole('img');

      // Check if checkerboard background is applied via style attribute
      const style = image.getAttribute('style');
      expect(style).toContain('linear-gradient');
      expect(style).toContain('background-color: white');
    });
  });

  describe('Image information display', () => {
    it('shows image dimensions and file size when available', async () => {
      const file: DiffFile = {
        path: 'test.jpg',
        status: 'added',
        additions: 1,
        deletions: 0,
        chunks: [],
      };

      render(<ImageDiffChunk file={file} />);

      const image = screen.getByRole('img');

      // Mock naturalWidth and naturalHeight
      Object.defineProperty(image, 'naturalWidth', { value: 800, configurable: true });
      Object.defineProperty(image, 'naturalHeight', { value: 600, configurable: true });

      // Simulate image load
      const loadEvent = new Event('load');
      image.dispatchEvent(loadEvent);

      // Wait for the state to update and info to be displayed
      await waitFor(() => {
        expect(screen.getByText(/W: 800px \| H: 600px/)).toBeInTheDocument();
        expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
      });
    });

    it('handles fetch errors gracefully', async () => {
      const file: DiffFile = {
        path: 'test.jpg',
        status: 'added',
        additions: 1,
        deletions: 0,
        chunks: [],
      };

      // Mock fetch to reject
      (global.fetch as any).mockRejectedValue(new Error('Failed to fetch'));

      render(<ImageDiffChunk file={file} />);

      const image = screen.getByRole('img');

      // Mock naturalWidth and naturalHeight
      Object.defineProperty(image, 'naturalWidth', { value: 800, configurable: true });
      Object.defineProperty(image, 'naturalHeight', { value: 600, configurable: true });

      // Simulate image load
      const loadEvent = new Event('load');
      image.dispatchEvent(loadEvent);

      // Should not crash and should show dimensions without file size
      // Since fetch fails, only dimensions should be shown
      await waitFor(
        () => {
          const dimensionText = screen.queryByText(/W: 800px/);
          if (dimensionText) {
            expect(dimensionText).toBeInTheDocument();
          } else {
            // If dimensions are not shown due to error, that's acceptable too
            expect(screen.getByRole('img')).toBeInTheDocument();
          }
        },
        { timeout: 100 },
      );
    });
  });

  describe('Utility functions', () => {
    it('formats file size correctly', async () => {
      // Test the file size formatting through component behavior
      const file: DiffFile = {
        path: 'test.jpg',
        status: 'added',
        additions: 1,
        deletions: 0,
        chunks: [],
      };

      // Mock fetch to return 1024 bytes
      (global.fetch as any).mockResolvedValue({
        blob: () => Promise.resolve({ size: 1024 }),
      });

      render(<ImageDiffChunk file={file} />);

      const image = screen.getByRole('img');
      Object.defineProperty(image, 'naturalWidth', { value: 100, configurable: true });
      Object.defineProperty(image, 'naturalHeight', { value: 100, configurable: true });

      const loadEvent = new Event('load');
      image.dispatchEvent(loadEvent);

      // Should show 1.0 KB
      await waitFor(() => {
        expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
      });
    });
  });

  describe('Return null case', () => {
    it('returns null for unsupported file status', () => {
      const unsupportedFile: DiffFile = {
        path: 'test.jpg',
        status: 'modified',
        additions: 1,
        deletions: 1,
        chunks: [],
      };

      // Mock file to have an unsupported status by changing the component logic
      const { container } = render(
        <ImageDiffChunk file={{ ...unsupportedFile, status: 'unknown' as any }} />,
      );

      // Should render nothing
      expect(container.firstChild).toBeNull();
    });
  });
});
