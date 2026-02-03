import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DiffFile } from '../../types/diff';

import { FileList } from './FileList';

const createMockFile = (overrides: Partial<DiffFile> = {}): DiffFile => ({
  path: 'src/test.ts',
  status: 'modified',
  additions: 10,
  deletions: 5,
  chunks: [],
  ...overrides,
});

describe('FileList', () => {
  const defaultProps = {
    files: [createMockFile()],
    onScrollToFile: vi.fn(),
    comments: [],
    reviewedFiles: new Set<string>(),
    onToggleReviewed: vi.fn(),
    selectedFileIndex: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Discard button', () => {
    it('shows Discard button on hover when canDiscard is true and onDiscardChanges is provided', () => {
      const onDiscardChanges = vi.fn();
      render(<FileList {...defaultProps} onDiscardChanges={onDiscardChanges} canDiscard={true} />);

      // Button exists but may be hidden until hover
      const discardButton = screen.getByTitle('Discard changes');
      expect(discardButton).toBeInTheDocument();
    });

    it('hides Discard button when canDiscard is false', () => {
      const onDiscardChanges = vi.fn();
      render(<FileList {...defaultProps} onDiscardChanges={onDiscardChanges} canDiscard={false} />);

      expect(screen.queryByTitle('Discard changes')).not.toBeInTheDocument();
    });

    it('hides Discard button when onDiscardChanges is not provided', () => {
      render(<FileList {...defaultProps} canDiscard={true} />);

      expect(screen.queryByTitle('Discard changes')).not.toBeInTheDocument();
    });

    it('shows confirmation dialog when Discard button is clicked', async () => {
      const onDiscardChanges = vi.fn().mockResolvedValue(undefined);
      const confirmMock = vi.fn().mockReturnValue(false);
      vi.stubGlobal('confirm', confirmMock);

      render(<FileList {...defaultProps} onDiscardChanges={onDiscardChanges} canDiscard={true} />);

      fireEvent.click(screen.getByTitle('Discard changes'));

      expect(confirmMock).toHaveBeenCalledWith(
        expect.stringContaining('Are you sure you want to discard all changes'),
      );
      expect(onDiscardChanges).not.toHaveBeenCalled();
    });

    it('calls onDiscardChanges when user confirms discard', async () => {
      const onDiscardChanges = vi.fn().mockResolvedValue(undefined);
      const confirmMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal('confirm', confirmMock);

      render(<FileList {...defaultProps} onDiscardChanges={onDiscardChanges} canDiscard={true} />);

      fireEvent.click(screen.getByTitle('Discard changes'));

      await waitFor(() => {
        expect(onDiscardChanges).toHaveBeenCalledWith('src/test.ts');
      });
    });

    it('does not call onDiscardChanges when user cancels discard', () => {
      const onDiscardChanges = vi.fn();
      const confirmMock = vi.fn().mockReturnValue(false);
      vi.stubGlobal('confirm', confirmMock);

      render(<FileList {...defaultProps} onDiscardChanges={onDiscardChanges} canDiscard={true} />);

      fireEvent.click(screen.getByTitle('Discard changes'));

      expect(onDiscardChanges).not.toHaveBeenCalled();
    });

    it('shows error alert when discard fails', async () => {
      const onDiscardChanges = vi.fn().mockRejectedValue(new Error('Test error'));
      const confirmMock = vi.fn().mockReturnValue(true);
      const alertMock = vi.fn();
      vi.stubGlobal('confirm', confirmMock);
      vi.stubGlobal('alert', alertMock);

      render(<FileList {...defaultProps} onDiscardChanges={onDiscardChanges} canDiscard={true} />);

      fireEvent.click(screen.getByTitle('Discard changes'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Test error'));
      });
    });

    it('does not trigger file selection when clicking discard button', async () => {
      const onDiscardChanges = vi.fn().mockResolvedValue(undefined);
      const onScrollToFile = vi.fn();
      const confirmMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal('confirm', confirmMock);

      render(
        <FileList
          {...defaultProps}
          onScrollToFile={onScrollToFile}
          onDiscardChanges={onDiscardChanges}
          canDiscard={true}
        />,
      );

      fireEvent.click(screen.getByTitle('Discard changes'));

      // onScrollToFile should not be called when clicking discard button
      expect(onScrollToFile).not.toHaveBeenCalled();
    });
  });
});
