import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mermaid from 'mermaid';

import type { DiffFile } from '../../types/diff';
import { WordHighlightProvider } from '../contexts/WordHighlightContext';
import type { MergedChunk } from '../hooks/useExpandedLines';

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

const htmlCommentChunks: MergedChunk[] = [
  {
    header: '@@ -1 +1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [
      { type: 'context', content: '  <!-- hidden note -->  ', oldLineNumber: 1, newLineNumber: 1 },
    ],
    originalIndices: [0],
    hiddenLinesBefore: 0,
    hiddenLinesAfter: 0,
  },
];

const codeFenceDiffChunks: MergedChunk[] = [
  {
    header: '@@ -1,7 +1,9 @@',
    oldStart: 1,
    oldLines: 7,
    newStart: 1,
    newLines: 9,
    lines: [
      {
        type: 'context',
        content: 'AIエージェントから使えるようにする',
        oldLineNumber: 1,
        newLineNumber: 1,
      },
      { type: 'context', content: '', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: '```bash', oldLineNumber: 3, newLineNumber: 3 },
      {
        type: 'delete',
        content: 'npx skills add yoshiko-pg/difit # エージェントにスキルを追加',
        oldLineNumber: 4,
        newLineNumber: undefined,
      },
      {
        type: 'add',
        content: 'npx skills add yoshiko-pg/difit # エージェントにスキル群を追加',
        oldLineNumber: undefined,
        newLineNumber: 4,
      },
      { type: 'context', content: '```', oldLineNumber: 5, newLineNumber: 5 },
      { type: 'context', content: '', oldLineNumber: 6, newLineNumber: 6 },
      {
        type: 'context',
        content: 'インストールされる主な skill:',
        oldLineNumber: 7,
        newLineNumber: 7,
      },
    ],
    originalIndices: [0, 1, 2, 3, 4, 5, 6, 7],
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
      expect(global.fetch).toHaveBeenCalledTimes(2);
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
    expect(global.fetch).toHaveBeenCalledTimes(2);
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

  it('renders comment-only markdown lines as plain text in Diff Preview', () => {
    renderViewer({ mergedChunks: htmlCommentChunks });

    fireEvent.click(screen.getByRole('button', { name: 'Diff Preview' }));

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'PRE' && element.textContent === '<!-- hidden note -->',
      ),
    ).toBeInTheDocument();
  });

  it('renders changed fenced code blocks without dropping surrounding markdown in Diff Preview', () => {
    renderViewer({ mergedChunks: codeFenceDiffChunks });

    fireEvent.click(screen.getByRole('button', { name: 'Diff Preview' }));

    const oldLine = screen.getByText(
      'npx skills add yoshiko-pg/difit # エージェントにスキルを追加',
    );
    const newLine = screen.getByText(
      'npx skills add yoshiko-pg/difit # エージェントにスキル群を追加',
    );

    expect(oldLine.closest('.markdown-preview-code')).toContainElement(newLine);
    expect(screen.getByText('インストールされる主な skill:')).toBeInTheDocument();
    expect(screen.queryByText('```bash')).not.toBeInTheDocument();
    expect(screen.queryByText('```')).not.toBeInTheDocument();
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

describe('MarkdownDiffViewer two-side fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    setMatchMedia(true);
  });

  it('fetches both base and target blobs for a modified file', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, text: async () => 'old content' })
      .mockResolvedValueOnce({ ok: true, text: async () => 'new content' });

    renderViewer();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/blob/docs%2Fguide.md?ref=HEAD~1');
    expect(global.fetch).toHaveBeenCalledWith('/api/blob/docs%2Fguide.md?ref=HEAD');
  });

  it('fetches only the target blob for an added file', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, text: async () => 'new content' });

    renderViewer({ file: createFile({ status: 'added', additions: 5, deletions: 0 }) });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/blob/docs%2Fguide.md?ref=HEAD');
  });

  it('fetches only the base blob for a deleted file', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, text: async () => 'old content' });

    renderViewer({
      file: createFile({ status: 'deleted', additions: 0, deletions: 5, oldPath: 'old.md' }),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/blob/old.md?ref=HEAD~1');
  });

  it('shows the Full Preview tab and renders base content for a deleted file', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '# Deleted doc\n\nBase body content.\n',
    });

    renderViewer({
      file: createFile({ status: 'deleted', additions: 0, deletions: 5, oldPath: 'old.md' }),
    });

    const fullPreviewButton = await screen.findByRole('button', { name: 'Full Preview' });
    fireEvent.click(fullPreviewButton);

    expect(await screen.findByText('Deleted doc')).toBeInTheDocument();
    expect(screen.getByText('Base body content.')).toBeInTheDocument();
  });

  it('does not fetch when both refs are stdin', async () => {
    renderViewer({ baseCommitish: 'stdin', targetCommitish: 'stdin' });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Full Preview' })).not.toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(0);
  });
});

describe('MarkdownFullPreview integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    setMatchMedia(true);
  });

  it('renders content without a frontmatter table when there is no frontmatter', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '# Hello\n\nBody paragraph.\n',
    });

    renderViewer();

    const fullPreviewButton = await screen.findByRole('button', { name: 'Full Preview' });
    fireEvent.click(fullPreviewButton);

    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Body paragraph.')).toBeInTheDocument();
    expect(screen.queryByText('Key')).not.toBeInTheDocument();
  });

  it('renders a frontmatter table above the body when frontmatter is present', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '---\ntitle: Hello\npublished: true\n---\n\n# Body\n\nText.\n',
    });

    renderViewer();

    const fullPreviewButton = await screen.findByRole('button', { name: 'Full Preview' });
    fireEvent.click(fullPreviewButton);

    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.queryByText('---')).not.toBeInTheDocument();
  });

  it('falls back to rendering the raw body when frontmatter YAML is invalid', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '---\n[unclosed\n---\n\n# Body\n\nText.\n',
    });

    renderViewer();

    const fullPreviewButton = await screen.findByRole('button', { name: 'Full Preview' });
    fireEvent.click(fullPreviewButton);

    expect(await screen.findByText('Body')).toBeInTheDocument();
    expect(screen.queryByText('Key')).not.toBeInTheDocument();
  });
});

describe('MarkdownDiffPreview frontmatter diff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    setMatchMedia(true);
  });

  const goToDiffPreview = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Diff Preview' }));
  };

  it('renders a frontmatter diff table for a modified file when both sides have frontmatter', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '---\ntitle: Old\npublished: false\n---\n\n# Body\n',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '---\ntitle: New\npublished: true\n---\n\n# Body\n',
      });

    renderViewer();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    goToDiffPreview();

    expect(await screen.findAllByText('title')).toHaveLength(1); // modified → single Before/After row
    expect(screen.getByText('Old')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getAllByText('published')).toHaveLength(1);
    expect(screen.getByText('false')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('renders no frontmatter table when neither side has frontmatter', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, text: async () => '# Just body\n' })
      .mockResolvedValueOnce({ ok: true, text: async () => '# Just body updated\n' });

    renderViewer();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    goToDiffPreview();

    expect(screen.queryByText('Key')).not.toBeInTheDocument();
  });

  it('shows all frontmatter keys as additions for an added file', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '---\ntitle: Hello\n---\n\n# Body\n',
    });

    const { container } = renderViewer({
      file: createFile({ status: 'added', additions: 5, deletions: 0 }),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    goToDiffPreview();

    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(container.querySelector('td.bg-diff-addition-bg')).not.toBeNull();
  });

  it('shows all frontmatter keys as removals for a deleted file', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '---\ntitle: Bye\n---\n\n# Body\n',
    });

    const { container } = renderViewer({
      file: createFile({ status: 'deleted', additions: 0, deletions: 5, oldPath: 'old.md' }),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    goToDiffPreview();

    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(screen.getByText('Bye')).toBeInTheDocument();
    expect(container.querySelector('td.bg-diff-deletion-bg')).not.toBeNull();
  });

  it('falls back to a snapshot label when the base fetch fails on a modified file', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: false, statusText: 'Not Found', text: async () => '' })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '---\ntitle: OnlyTarget\n---\n\n# Body\n',
      });

    renderViewer();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    goToDiffPreview();

    expect(await screen.findByText(/target only/i)).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('OnlyTarget')).toBeInTheDocument();
  });

  it('renders no frontmatter table for stdin (no fetch performed)', async () => {
    renderViewer({ baseCommitish: 'stdin', targetCommitish: 'stdin' });

    // wait a tick so any pending state settles
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(0);
    });

    goToDiffPreview();

    expect(screen.queryByText('title')).not.toBeInTheDocument();
    expect(screen.queryByText(/frontmatter/i)).not.toBeInTheDocument();
  });
});
