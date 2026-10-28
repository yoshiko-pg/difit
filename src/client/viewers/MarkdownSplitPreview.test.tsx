import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CommentThread } from '../../types/diff';

import { MarkdownSplitPreview, type MarkdownSplitPreviewProps } from './MarkdownSplitPreview';

vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }) },
}));

const baseContent = [
  '# Guide',
  '',
  'The quick brown fox',
  'jumps over the dog.',
  '',
  'Shared end',
].join('\n');
const targetContent = [
  '# Guide',
  '',
  'The quick red fox',
  'jumps over the dog.',
  '',
  '- new item',
  '',
  'Shared end',
].join('\n');

const renderPreview = (overrides: Partial<MarkdownSplitPreviewProps> = {}) => {
  const props: MarkdownSplitPreviewProps = {
    filePath: 'docs/guide.md',
    baseContent,
    targetContent,
    baseLabel: 'HEAD',
    targetLabel: 'working',
    threads: [],
    onAddComment: vi.fn().mockResolvedValue(undefined),
    onGenerateThreadPrompt: vi.fn().mockReturnValue(''),
    onRemoveThread: vi.fn(),
    onReplyToThread: vi.fn().mockResolvedValue(undefined),
    onRemoveMessage: vi.fn(),
    onUpdateMessage: vi.fn(),
    ...overrides,
  };
  return { ...render(<MarkdownSplitPreview {...props} />), props };
};

const getCell = (container: HTMLElement, side: 'old' | 'new', text: string) => {
  const cell = [
    ...container.querySelectorAll<HTMLElement>(`[data-md-cell][data-md-side="${side}"]`),
  ].find((element) => element.textContent?.includes(text));
  if (!cell) throw new Error(`No ${side} cell containing "${text}"`);
  return cell;
};

const openGutterComment = (cell: HTMLElement, text: string) => {
  fireEvent.mouseMove(within(cell).getByText(text, { exact: false }));
  fireEvent.mouseDown(within(cell).getByRole('button', { name: /Add comment on/ }));
};

describe('MarkdownSplitPreview', () => {
  it('renders before on the left and after on the right, one row per block pair', () => {
    const { container } = renderPreview();

    const rowTypes = [...container.querySelectorAll('[data-md-row-type]')].map((row) =>
      row.getAttribute('data-md-row-type'),
    );
    expect(rowTypes).toEqual(['unchanged', 'modified', 'added', 'unchanged']);
    expect(getCell(container, 'old', 'brown').getAttribute('data-md-status')).toBe('removed');
    expect(getCell(container, 'new', 'red fox').getAttribute('data-md-status')).toBe('added');
    expect(getCell(container, 'new', 'new item').getAttribute('data-md-status')).toBe('added');
    expect(screen.getByText('HEAD')).toBeInTheDocument();
    expect(screen.getByText('working')).toBeInTheDocument();
  });

  it('adds a comment on the after side with the source line range and snapshot', async () => {
    const { container, props } = renderPreview();

    openGutterComment(getCell(container, 'new', 'red fox'), 'red fox');
    fireEvent.change(screen.getByPlaceholderText('Leave a comment...'), {
      target: { value: 'Keep brown?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(props.onAddComment).toHaveBeenCalledWith(
        [3, 4],
        'Keep brown?',
        'The quick red fox\njumps over the dog.',
        'new',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Leave a comment...')).not.toBeInTheDocument(),
    );
  });

  it('adds a comment on the before side as an old-side comment', async () => {
    const { container, props } = renderPreview();

    openGutterComment(getCell(container, 'old', 'Guide'), 'Guide');
    expect(screen.getByText('Comment on L1 (before)')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Leave a comment...'), {
      target: { value: 'Rename' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(props.onAddComment).toHaveBeenCalledWith(1, 'Rename', '# Guide', 'old'),
    );
  });

  it('keeps the table row under the pointer when the pointer moves into the gutter', () => {
    const table = ['| a | b |', '| - | - |', '| 1 | 2 |', '| 3 | 4 |'].join('\n');
    const { container } = renderPreview({
      baseContent: table,
      targetContent: `${table}\n| 5 | 6 |`,
    });
    const cell = getCell(container, 'new', '5');
    for (const element of cell.querySelectorAll<HTMLElement>('[data-md-line-start]')) {
      const line = Number(element.dataset.mdLineStart);
      const isRow = element.tagName === 'TR';
      const top = isRow ? line * 20 : 0;
      element.getBoundingClientRect = () =>
        ({ top, bottom: isRow ? top + 20 : 200, height: isRow ? 20 : 200 }) as DOMRect;
    }

    fireEvent.mouseMove(cell, { clientY: 4 * 20 + 5 });

    expect(within(cell).getByRole('button', { name: 'Add comment on L4' })).toBeInTheDocument();
  });

  it('renders footnote references and definitions instead of raw syntax', () => {
    const withFootnote = 'A claim[^1].\n\n[^1]: The source.';
    const { container } = renderPreview({
      baseContent: withFootnote,
      targetContent: withFootnote.replace('source', 'updated source'),
    });

    const claimCell = getCell(container, 'new', 'A claim');
    expect(claimCell.textContent).not.toContain('[^1]');
    expect(claimCell.querySelector('sup')?.textContent).toBe('1');
    expect(claimCell.textContent).not.toContain('updated source');
    expect(getCell(container, 'new', 'updated source').textContent).toBe('[1] The updated source.');
  });

  it('shows existing threads under the block they point at', () => {
    const thread: CommentThread = {
      id: 'thread-1',
      file: 'docs/guide.md',
      line: 6,
      side: 'new',
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T00:00:00.000Z',
      messages: [
        {
          id: 'message-1',
          body: 'Why a new item?',
          createdAt: '2026-09-29T00:00:00.000Z',
          updatedAt: '2026-09-29T00:00:00.000Z',
        },
      ],
    };

    const { container } = renderPreview({ threads: [thread] });

    const addedRow = getCell(container, 'new', 'new item').parentElement;
    expect(addedRow?.nextElementSibling?.textContent).toContain('Why a new item?');
  });

  it('turns a text selection into a comment that quotes it and points at its source line', async () => {
    const { container, props } = renderPreview();
    const paragraph = within(getCell(container, 'new', 'red fox')).getByText(/red fox/);
    const textNode = paragraph.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, textNode.data.indexOf('red'));
    range.setEnd(textNode, textNode.data.indexOf('red') + 'red fox'.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    fireEvent.mouseUp(paragraph);
    fireEvent.click(screen.getByRole('button', { name: 'Comment on L3' }));

    const textarea = screen.getByPlaceholderText('Leave a comment...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('> red fox\n\n');
    fireEvent.change(textarea, { target: { value: '> red fox\n\nWhy red?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(props.onAddComment).toHaveBeenCalledWith(
        3,
        '> red fox\n\nWhy red?',
        'The quick red fox',
        'new',
      ),
    );
  });

  it('collapses long unchanged runs until expanded', () => {
    const paragraphs = Array.from({ length: 10 }, (_, index) => `Paragraph ${index}`);
    renderPreview({
      baseContent: paragraphs.join('\n\n'),
      targetContent: [...paragraphs, 'Appended'].join('\n\n'),
    });

    expect(screen.queryByText('Paragraph 0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show 8 unchanged blocks' }));
    expect(screen.getAllByText('Paragraph 0')).toHaveLength(2);
  });

  it('shows hatched spacers on the before side of an added file', () => {
    const { container } = renderPreview({ baseContent: null });

    expect(screen.getByText('file does not exist')).toBeInTheDocument();
    const oldCells = container.querySelectorAll('[data-md-side="old"]');
    expect([...oldCells].every((cell) => cell.getAttribute('data-md-status') === 'empty')).toBe(
      true,
    );
  });
});

const createThread = (overrides: Partial<CommentThread>): CommentThread => ({
  id: 'thread-1',
  file: 'docs/guide.md',
  line: 1,
  side: 'new',
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
  messages: [
    {
      id: 'message-1',
      body: 'A note',
      createdAt: '2026-09-30T00:00:00.000Z',
      updatedAt: '2026-09-30T00:00:00.000Z',
    },
  ],
  ...overrides,
});

describe('MarkdownSplitPreview unified layout (Diff Preview)', () => {
  it('stacks a modified block as before then after in one column, without the header', () => {
    const { container } = renderPreview({ layout: 'unified' });

    const modifiedRow = container.querySelector('[data-md-row-type="modified"]');
    const sides = [...(modifiedRow?.querySelectorAll('[data-md-cell]') ?? [])].map((cell) =>
      cell.getAttribute('data-md-side'),
    );
    expect(sides).toEqual(['old', 'new']);
    const unchangedRow = container.querySelector('[data-md-row-type="unchanged"]');
    expect(unchangedRow?.querySelectorAll('[data-md-cell]')).toHaveLength(1);
    expect(container.querySelector('.md-split-spacer')).toBeNull();
    expect(screen.queryByText('Before')).not.toBeInTheDocument();
  });

  it('sends a comment on a removed block as an old-side comment', async () => {
    const { container, props } = renderPreview({ layout: 'unified' });

    openGutterComment(getCell(container, 'old', 'brown'), 'brown');
    expect(screen.getByText('Comment on L3-L4 (before)')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Leave a comment...'), {
      target: { value: 'Keep brown' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(props.onAddComment).toHaveBeenCalledWith(
        [3, 4],
        'Keep brown',
        'The quick brown fox\njumps over the dog.',
        'old',
      ),
    );
  });

  it('shows threads of both sides under the row', () => {
    renderPreview({
      layout: 'unified',
      threads: [
        createThread({ id: 'old-thread', line: 3, side: 'old' }),
        createThread({
          id: 'new-thread',
          line: 3,
          messages: [{ id: 'm', body: 'After note', createdAt: '', updatedAt: '' }],
        }),
      ],
    });

    expect(screen.getByText('A note')).toBeInTheDocument();
    expect(screen.getByText('After note')).toBeInTheDocument();
  });

  it('shows a changed frontmatter as a before and an after table, each commentable', async () => {
    const { container, props } = renderPreview({
      layout: 'unified',
      baseContent: '---\ntitle: Old\n---\n\nBody',
      targetContent: '---\ntitle: New\n---\n\nBody',
    });

    expect(getCell(container, 'old', 'Old').getAttribute('data-md-status')).toBe('removed');
    expect(getCell(container, 'new', 'New').getAttribute('data-md-status')).toBe('added');

    openGutterComment(getCell(container, 'old', 'Old'), 'Old');
    fireEvent.change(screen.getByPlaceholderText('Leave a comment...'), {
      target: { value: 'Keep the old title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(props.onAddComment).toHaveBeenCalledWith(
        [1, 3],
        'Keep the old title',
        '---\ntitle: Old\n---',
        'old',
      ),
    );
  });
});

describe('MarkdownSplitPreview single layout (Full Preview)', () => {
  it('shows every block of the file, with no diff colors and no collapsing', () => {
    const { container } = renderPreview({ layout: 'single', baseContent: null });

    const cells = [...container.querySelectorAll('[data-md-cell]')];
    expect(cells).toHaveLength(4);
    expect(cells.every((cell) => cell.getAttribute('data-md-status') === 'unchanged')).toBe(true);
    expect(cells.every((cell) => cell.getAttribute('data-md-side') === 'new')).toBe(true);
  });

  it('comments on the shown file with its line numbers', async () => {
    const { container, props } = renderPreview({ layout: 'single', baseContent: null });

    openGutterComment(getCell(container, 'new', 'new item'), 'new item');
    fireEvent.change(screen.getByPlaceholderText('Leave a comment...'), {
      target: { value: 'Why?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(props.onAddComment).toHaveBeenCalledWith(6, 'Why?', '- new item', 'new'),
    );
  });

  it('uses the before side for a deleted file', async () => {
    const { container, props } = renderPreview({ layout: 'single', targetContent: null });

    openGutterComment(getCell(container, 'old', 'brown'), 'brown');
    fireEvent.change(screen.getByPlaceholderText('Leave a comment...'), {
      target: { value: 'Gone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(props.onAddComment).toHaveBeenCalledWith(
        [3, 4],
        'Gone',
        'The quick brown fox\njumps over the dog.',
        'old',
      ),
    );
  });

  it('lists threads on the other side above the file, since their lines do not match it', () => {
    const { container } = renderPreview({
      layout: 'single',
      baseContent: null,
      threads: [createThread({ line: 3, side: 'old' })],
    });

    const firstCell = container.querySelector('[data-md-cell]');
    const note = screen.getByText('A note');
    expect(
      note.compareDocumentPosition(firstCell as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
