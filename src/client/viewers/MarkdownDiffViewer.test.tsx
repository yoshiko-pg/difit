import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mermaid from 'mermaid';

import type { DiffFile } from '../../types/diff';
import { WordHighlightProvider } from '../contexts/WordHighlightContext';
import type { MergedChunk } from '../hooks/useExpandedLines';
import { APPEARANCE_STORAGE_KEY } from '../utils/appearanceTheme';

import { MarkdownDiffViewer } from './MarkdownDiffViewer';
import type { DiffViewerBodyProps } from './types';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
      svg: '<svg><title>Mermaid</title></svg>',
      bindFunctions: undefined,
    }),
  },
}));

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
  threads: [],
  diffMode: 'unified',
  mergedChunks,
  isExpandLoading: false,
  expandHiddenLines: vi.fn().mockResolvedValue(undefined),
  expandAllBetweenChunks: vi.fn().mockResolvedValue(undefined),
  onAddComment: vi.fn().mockResolvedValue(undefined),
  onGenerateThreadPrompt: vi.fn(),
  onRemoveThread: vi.fn(),
  onReplyToThread: vi.fn().mockResolvedValue(undefined),
  onRemoveMessage: vi.fn(),
  onUpdateMessage: vi.fn(),
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

const mermaidChunks: MergedChunk[] = [
  {
    header: '@@ -1,4 +1,4 @@',
    oldStart: 1,
    oldLines: 4,
    newStart: 1,
    newLines: 4,
    lines: [
      { type: 'context', content: '```mermaid', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'graph TD', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: '  Start --> Finish', oldLineNumber: 3, newLineNumber: 3 },
      { type: 'context', content: '```', oldLineNumber: 4, newLineNumber: 4 },
    ],
    originalIndices: [0, 1, 2, 3],
    hiddenLinesBefore: 0,
    hiddenLinesAfter: 0,
  },
];

const setMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
};

describe('MarkdownDiffViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    setMatchMedia(true);
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

  it('renders Mermaid diagrams in Diff Preview', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { container } = renderViewer({ mergedChunks: mermaidChunks });

    fireEvent.click(screen.getByRole('button', { name: 'Diff Preview' }));

    await waitFor(() => {
      expect(mermaid.initialize).toHaveBeenCalledWith({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'dark',
      });
      expect(mermaid.render).toHaveBeenCalledWith(
        expect.stringMatching(/^mermaid-diagram-/),
        'graph TD\n  Start --> Finish',
      );
    });

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders Mermaid diagrams in Full Preview', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '```mermaid\ngraph TD\n  A --> B\n```',
    });

    const { container } = renderViewer();

    const fullPreviewButton = await screen.findByRole('button', {
      name: 'Full Preview',
    });
    fireEvent.click(fullPreviewButton);

    await waitFor(() => {
      expect(mermaid.render).toHaveBeenCalledWith(
        expect.stringMatching(/^mermaid-diagram-/),
        'graph TD\n  A --> B',
      );
    });

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('falls back to code when Mermaid rendering fails', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Parse error'));
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '```mermaid\ngraph TD\n  A --> B\n```',
    });

    renderViewer();

    const fullPreviewButton = await screen.findByRole('button', {
      name: 'Full Preview',
    });
    fireEvent.click(fullPreviewButton);

    expect(await screen.findByText('Unable to render Mermaid diagram.')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === 'PRE' && element.textContent === 'graph TD\n  A --> B',
      ),
    ).toBeInTheDocument();
  });

  it('uses the saved light theme for the initial Mermaid render', async () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        theme: 'light',
      }),
    );

    renderViewer({ mergedChunks: mermaidChunks });

    fireEvent.click(screen.getByRole('button', { name: 'Diff Preview' }));

    await waitFor(() => {
      expect(mermaid.initialize).toHaveBeenCalledWith({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default',
      });
    });
  });

  it('re-renders Mermaid diagrams when data-theme changes after mount', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    renderViewer({ mergedChunks: mermaidChunks });

    fireEvent.click(screen.getByRole('button', { name: 'Diff Preview' }));

    await waitFor(() => {
      expect(vi.mocked(mermaid.initialize)).toHaveBeenCalledWith({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'dark',
      });
    });

    document.documentElement.setAttribute('data-theme', 'light');

    await waitFor(() => {
      expect(vi.mocked(mermaid.initialize)).toHaveBeenLastCalledWith({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default',
      });
      expect(vi.mocked(mermaid.render)).toHaveBeenCalledTimes(2);
    });
  });
});
