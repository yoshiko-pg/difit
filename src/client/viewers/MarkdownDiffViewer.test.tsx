import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../types/diff';
import { WordHighlightProvider } from '../contexts/WordHighlightContext';
import type { MergedChunk } from '../hooks/useExpandedLines';

import { MarkdownDiffViewer } from './MarkdownDiffViewer';
import type { DiffViewerBodyProps } from './types';

const createFile = (overrides: Partial<DiffFile> = {}): DiffFile => ({
  path: 'docs/guide.md',
  status: 'modified',
  additions: 1,
  deletions: 1,
  chunks: [],
  ...overrides,
});

const mergedChunks: MergedChunk[] = [
  {
    header: '@@ -1 +1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [{ type: 'context', content: '# Title', oldLineNumber: 1, newLineNumber: 1 }],
    originalIndices: [0],
    hiddenLinesBefore: 0,
    hiddenLinesAfter: 0,
  },
];

const createProps = (overrides: Partial<DiffViewerBodyProps> = {}): DiffViewerBodyProps => ({
  file: createFile(),
  comments: [],
  diffMode: 'unified',
  mergedChunks,
  isExpandLoading: false,
  expandHiddenLines: vi.fn().mockResolvedValue(undefined),
  expandAllBetweenChunks: vi.fn().mockResolvedValue(undefined),
  onAddComment: vi.fn().mockResolvedValue(undefined),
  onGeneratePrompt: vi.fn(),
  onRemoveComment: vi.fn(),
  onUpdateComment: vi.fn(),
  baseCommitish: 'HEAD~1',
  targetCommitish: 'HEAD',
  ...overrides,
});

const renderViewer = (overrides: Partial<DiffViewerBodyProps> = {}) =>
  render(
    <WordHighlightProvider>
      <MarkdownDiffViewer {...createProps(overrides)} />
    </WordHighlightProvider>,
  );

describe('MarkdownDiffViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Full Preview tab only after prefetch succeeds', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '# Prefetched title',
    });

    renderViewer();

    expect(screen.queryByRole('button', { name: 'Full Preview' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Full Preview' })).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/blob/docs%2Fguide.md?ref=HEAD');
  });

  it('does not show Full Preview tab when prefetch fails', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      text: async () => '',
    });

    renderViewer();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('button', { name: 'Full Preview' })).not.toBeInTheDocument();
  });

  it('uses prefetched content without refetch when switching to Full Preview', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '# Prefetched title',
    });

    renderViewer();

    const fullPreviewButton = await screen.findByRole('button', {
      name: 'Full Preview',
    });
    fireEvent.click(fullPreviewButton);

    expect(await screen.findByText('Prefetched title')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
