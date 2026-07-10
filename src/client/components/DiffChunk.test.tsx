import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { DiffChunk as DiffChunkData } from '../../types/diff';
import { DEFAULT_DIFF_VIEW_MODE } from '../../utils/diffMode';
import { WordHighlightProvider } from '../contexts/WordHighlightContext';

import { DiffChunk } from './DiffChunk';
import { SideBySideDiffChunk } from './SideBySideDiffChunk';

const testChunk: DiffChunkData = {
  header: '@@ -10,3 +10,3 @@',
  oldStart: 10,
  oldLines: 2,
  newStart: 10,
  newLines: 3,
  lines: [
    {
      type: 'normal',
      content: 'const first = 1;',
      oldLineNumber: 10,
      newLineNumber: 10,
    },
    {
      type: 'normal',
      content: 'const second = 2;',
      oldLineNumber: 11,
      newLineNumber: 11,
    },
    {
      type: 'add',
      content: 'const third = 3;',
      newLineNumber: 12,
    },
  ],
};

const noop = () => {};
const asyncNoop = async () => {};
const renderWithProviders = (ui: ReactNode) =>
  render(<WordHighlightProvider>{ui}</WordHighlightProvider>);

describe('DiffChunk range comments', () => {
  it('opens a unified range comment with shift-click', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <DiffChunk
        chunk={testChunk}
        chunkIndex={0}
        threads={[]}
        mode="unified"
        onAddComment={onAddComment}
        onGenerateThreadPrompt={() => ''}
        onRemoveThread={noop}
        onReplyToThread={asyncNoop}
        onRemoveMessage={noop}
        onUpdateMessage={noop}
        filename="src/example.ts"
      />,
    );

    const rows = container.querySelectorAll('[data-diff-line-row="true"]');
    fireEvent.click(rows[0]!);
    fireEvent.click(rows[2]!, { shiftKey: true });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Please revisit this range' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith(
        [10, 12],
        'Please revisit this range',
        ['const first = 1;', 'const second = 2;', 'const third = 3;'].join('\n'),
        'new',
      );
    });
  });

  it('opens a split-view range comment with shift-click on the same side', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <SideBySideDiffChunk
        chunk={testChunk}
        chunkIndex={0}
        threads={[]}
        onAddComment={onAddComment}
        onGenerateThreadPrompt={() => ''}
        onRemoveThread={noop}
        onReplyToThread={asyncNoop}
        onRemoveMessage={noop}
        onUpdateMessage={noop}
        filename="src/example.ts"
      />,
    );

    const rows = container.querySelectorAll('[data-diff-line-row="true"]');
    fireEvent.click(rows[0]!.children[2]!);
    fireEvent.click(rows[2]!.children[2]!, { shiftKey: true });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Please revisit this range' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith(
        [10, 12],
        'Please revisit this range',
        ['const first = 1;', 'const second = 2;', 'const third = 3;'].join('\n'),
        'new',
      );
    });
  });

  it('falls back to a single-line comment when shift-click has no anchor', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <DiffChunk
        chunk={testChunk}
        chunkIndex={0}
        threads={[]}
        mode={DEFAULT_DIFF_VIEW_MODE}
        onAddComment={onAddComment}
        onGenerateThreadPrompt={() => ''}
        onRemoveThread={noop}
        onReplyToThread={asyncNoop}
        onRemoveMessage={noop}
        onUpdateMessage={noop}
        filename="src/example.ts"
      />,
    );

    const rows = container.querySelectorAll('[data-diff-line-row="true"]');
    fireEvent.click(rows[2]!.children[2]!, { shiftKey: true });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Single line only' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith(12, 'Single line only', 'const third = 3;', 'new');
    });
  });
});
