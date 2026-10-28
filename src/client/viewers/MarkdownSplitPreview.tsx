import { ChevronsUpDown, MessageSquarePlus } from 'lucide-react';
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { DiffSide } from '../../types/diff';
import { CommentButton } from '../components/CommentButton';
import { CommentForm } from '../components/CommentForm';
import { CommentThreadCard } from '../components/CommentThreadCard';
import { FrontmatterTable } from '../components/FrontmatterTable';
import { extractFrontmatter } from '../utils/frontmatter';
import { computeFrontmatterDiff } from '../utils/frontmatterDiff';
import {
  alignMarkdownBlocks,
  diffRenderedText,
  findSourceLinesForText,
  parseMarkdownBlocks,
  type MarkdownBlock,
  type MarkdownBlockRow,
} from '../utils/markdownBlocks';
import {
  blockOnSide,
  buildSplitPreviewItems,
  placeThreadsOnRows,
  type RowThreads,
} from '../utils/markdownSplitLayout';
import { isSafeUrl } from '../utils/markdownUtils';
import { addTextHighlights, createTextRanges, layoutText } from '../utils/textHighlights';
import { MIN_WORD_DIFF_SIMILARITY } from '../utils/wordLevelDiff';

import { getMarkdownComponents } from './markdownComponents';
import type { DiffViewerBodyProps } from './types';

type LineRange = { start: number; end: number };
type CommentTarget = LineRange & { side: DiffSide; rowIndex: number; initialBody?: string };
type SelectionTarget = LineRange & {
  side: DiffSide;
  rowIndex: number;
  quote: string;
  top: number;
  left: number;
};
type HoverTarget = LineRange & { top: number; height: number };

/**
 * split: before and after side by side (Split Preview). unified: one column, removed and
 * added blocks stacked (Diff Preview). single: one file, no diff (Full Preview).
 */
type MarkdownPreviewLayout = 'split' | 'unified' | 'single';

export type MarkdownSplitPreviewProps = Pick<
  DiffViewerBodyProps,
  | 'threads'
  | 'showAuthorBadges'
  | 'syntaxTheme'
  | 'onAddComment'
  | 'onGenerateThreadPrompt'
  | 'onRemoveThread'
  | 'onReplyToThread'
  | 'onRemoveMessage'
  | 'onUpdateMessage'
> & {
  filePath: string;
  /** null when the file does not exist on that side (added / deleted file). */
  baseContent: string | null;
  targetContent: string | null;
  baseLabel?: string;
  targetLabel?: string;
  /** single shows targetContent, or baseContent when targetContent is null. */
  layout?: MarkdownPreviewLayout;
};

const NON_RENDERED_KINDS = new Set<MarkdownBlock['kind']>(['html', 'definition']);
const DEFINITION_KINDS = new Set<MarkdownBlock['kind']>(['definition', 'footnoteDefinition']);
const selectionButtonStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-yellow-btn-bg)',
  color: 'var(--color-yellow-btn-text)',
  border: '1px solid var(--color-yellow-btn-border)',
};

const splitLines = (content: string | null) =>
  (content ?? '').split('\n').map((line) => line.replace(/\r$/, ''));

const formatLineRange = ({ start, end }: LineRange) =>
  start === end ? `L${start}` : `L${start}-L${end}`;

const quoteSelection = (text: string) =>
  `${text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `> ${line}`)
    .join('\n')}\n\n`;

const readLineRange = (element: Element | null | undefined): LineRange | null => {
  const start = Number(element?.getAttribute('data-md-line-start'));
  const end = Number(element?.getAttribute('data-md-line-end'));
  return start > 0 && end >= start ? { start, end } : null;
};

const closestElement = (node: Node | null): Element | null =>
  node instanceof Element ? node : (node?.parentElement ?? null);

// Footnote definitions are appended to every block so `[^1]` renders as a reference; the
// section that remark-gfm then adds under the block would repeat the definition row.
const hideFootnoteSection = ({ className, children }: React.ComponentProps<'section'>) =>
  className?.includes('footnotes') ? null : <section className={className}>{children}</section>;

const toFootnoteDisplaySource = (source: string) =>
  source.replace(/^(\s*)\[\^([^\]]+)\]:\s?/, '$1\\[$2\\] ');

type FrontmatterPair = { old: MarkdownBlock | undefined; new: MarkdownBlock | undefined };

const readFrontmatter = (block: MarkdownBlock | undefined) =>
  block ? extractFrontmatter(`${block.source}\n`).data : null;

const BlockContent = memo(function BlockContent({
  block,
  definitions,
  syntaxTheme,
  frontmatterDiff,
}: {
  block: MarkdownBlock;
  definitions: string[];
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'];
  /** Set in the unified layout for an added or removed frontmatter: one key-by-key table. */
  frontmatterDiff?: FrontmatterPair;
}) {
  const components = useMemo(
    () => ({
      ...getMarkdownComponents(syntaxTheme, block.startLine - 1),
      section: hideFootnoteSection,
    }),
    [syntaxTheme, block.startLine],
  );
  const lineAttributes = {
    'data-md-line-start': block.startLine,
    'data-md-line-end': block.endLine,
  };

  if (block.kind === 'frontmatter' && frontmatterDiff) {
    const entries = computeFrontmatterDiff(
      readFrontmatter(frontmatterDiff.old),
      readFrontmatter(frontmatterDiff.new),
    );
    return (
      <div {...lineAttributes}>
        <FrontmatterTable mode="diff" entries={entries} label="Frontmatter" />
      </div>
    );
  }

  if (block.kind === 'frontmatter') {
    const data = readFrontmatter(block);
    return (
      <div {...lineAttributes}>
        {data ? (
          <FrontmatterTable mode="snapshot" data={data} label="Frontmatter" />
        ) : (
          <pre className="whitespace-pre-wrap text-sm font-mono">{block.source}</pre>
        )}
      </div>
    );
  }

  if (NON_RENDERED_KINDS.has(block.kind)) {
    return (
      <pre
        className="whitespace-pre-wrap text-sm font-mono text-github-text-muted"
        {...lineAttributes}
      >
        {block.source}
      </pre>
    );
  }

  // Blocks render one by one, so references need the document's definitions.
  const blockSource =
    block.kind === 'footnoteDefinition' ? toFootnoteDisplaySource(block.source) : block.source;
  const source =
    definitions.length > 0 ? `${blockSource}\n\n${definitions.join('\n\n')}` : blockSource;
  return (
    <div className="space-y-4" {...lineAttributes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (isSafeUrl(url) ? url : '')}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});

// A modified frontmatter renders as two snapshots instead, so each side's lines can take
// comments; one combined table would only accept new-side comments.
const getChangedFrontmatter = (row: MarkdownBlockRow): FrontmatterPair | undefined => {
  if (row.type !== 'added' && row.type !== 'removed') return undefined;
  const pair = { old: blockOnSide(row, 'old'), new: blockOnSide(row, 'new') };
  return (pair.old ?? pair.new)?.kind === 'frontmatter' ? pair : undefined;
};

const getCellSides = (
  row: MarkdownBlockRow,
  layout: MarkdownPreviewLayout,
  singleSide: DiffSide,
): DiffSide[] => {
  if (layout === 'split') return ['old', 'new'];
  if (layout === 'single') return [singleSide];
  if (row.type === 'modified') return ['old', 'new'];
  return row.type === 'removed' ? ['old'] : ['new'];
};

const getPaneStatus = (rowType: MarkdownBlockRow['type'], side: DiffSide) => {
  if (rowType === 'modified') return side === 'old' ? 'removed' : 'added';
  if (rowType === 'removed' && side === 'old') return 'removed';
  if (rowType === 'added' && side === 'new') return 'added';
  return null;
};

const PaneCell = memo(function PaneCell({
  side,
  rowIndex,
  rowType,
  block,
  definitions,
  syntaxTheme,
  formattingOnly,
  divided,
  frontmatterDiff,
  contentRef,
  onStartComment,
}: {
  side: DiffSide;
  rowIndex: number;
  rowType: MarkdownBlockRow['type'];
  block: MarkdownBlock | undefined;
  definitions: string[];
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'];
  formattingOnly: boolean;
  divided: boolean;
  frontmatterDiff?: FrontmatterPair;
  contentRef: React.RefObject<HTMLDivElement | null>;
  onStartComment: (target: CommentTarget) => void;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  // The frontmatter diff table colors its own rows.
  const status = block && !frontmatterDiff ? getPaneStatus(rowType, side) : null;

  const handleMouseMove = (event: React.MouseEvent) => {
    const cell = cellRef.current;
    const target = event.target as Element;
    if (!cell || target.closest('[data-comment-button]')) return;
    let anchor: Element | null | undefined = target.closest('[data-md-line-start]');
    if (!anchor || !cell.contains(anchor)) {
      // In the gutter: take the innermost element at the pointer's height, so the table row
      // or list item the pointer came from stays selected.
      anchor = null;
      for (const element of cell.querySelectorAll('[data-md-line-start]')) {
        const rect = element.getBoundingClientRect();
        if (event.clientY >= rect.top && event.clientY < rect.bottom) anchor = element;
      }
      anchor ??= contentRef.current?.firstElementChild;
    }
    const range = anchor && cell.contains(anchor) ? readLineRange(anchor) : null;
    if (!anchor || !range) {
      setHover(null);
      return;
    }
    const cellRect = cell.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const top = anchorRect.top - cellRect.top;
    setHover((previous) =>
      previous?.start === range.start && previous.end === range.end && previous.top === top
        ? previous
        : { ...range, top, height: anchorRect.height },
    );
  };

  const statusClass =
    status === 'removed'
      ? 'border-diff-deletion-border bg-diff-deletion-bg/40'
      : status === 'added'
        ? 'border-diff-addition-border bg-diff-addition-bg/40'
        : 'border-transparent';

  return (
    <div
      ref={cellRef}
      data-md-cell=""
      data-md-side={side}
      data-md-row={rowIndex}
      data-md-status={status ?? (block ? 'unchanged' : 'empty')}
      className={`relative min-w-0 border-l-4 py-2 pl-9 pr-4 ${statusClass} ${
        divided ? 'border-r border-r-github-border' : ''
      } ${block ? '' : 'md-split-spacer'}`}
      onMouseMove={block ? handleMouseMove : undefined}
      onMouseLeave={() => setHover(null)}
    >
      {block && (
        <div ref={contentRef} className="md-split-content">
          <BlockContent
            block={block}
            definitions={definitions}
            syntaxTheme={syntaxTheme}
            frontmatterDiff={frontmatterDiff}
          />
        </div>
      )}
      {formattingOnly && side === 'new' && (
        <span className="absolute right-2 top-1 rounded bg-github-bg-tertiary px-1.5 py-0.5 text-[10px] text-github-text-secondary">
          no visible text change
        </span>
      )}
      {hover && (
        <>
          <div
            className="pointer-events-none absolute left-7 w-0.5 rounded bg-yellow-400/70"
            style={{ top: hover.top, height: hover.height }}
          />
          <CommentButton
            title={`Add comment on ${formatLineRange(hover)}`}
            className="absolute left-1 h-6 w-6"
            style={{ top: hover.top }}
            onMouseDown={(event) => {
              event.preventDefault();
              onStartComment({ side, rowIndex, start: hover.start, end: hover.end });
            }}
          />
        </>
      )}
    </div>
  );
});

const SplitRow = memo(function SplitRow({
  row,
  rowIndex,
  layout,
  singleSide,
  oldDefinitions,
  newDefinitions,
  syntaxTheme,
  onStartComment,
}: {
  row: MarkdownBlockRow;
  rowIndex: number;
  layout: MarkdownPreviewLayout;
  singleSide: DiffSide;
  oldDefinitions: string[];
  newDefinitions: string[];
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'];
  onStartComment: (target: CommentTarget) => void;
}) {
  const oldContentRef = useRef<HTMLDivElement>(null);
  const newContentRef = useRef<HTMLDivElement>(null);
  const [formattingOnly, setFormattingOnly] = useState(false);

  useLayoutEffect(() => {
    const oldRoot = oldContentRef.current;
    const newRoot = newContentRef.current;
    if (row.type !== 'modified' || !oldRoot || !newRoot) return;

    let clearHighlights: Array<() => void> = [];
    const paint = () => {
      clearHighlights.forEach((clear) => clear());
      clearHighlights = [];
      const oldLayout = layoutText(oldRoot);
      const newLayout = layoutText(newRoot);
      const diff = diffRenderedText(oldLayout.text, newLayout.text);
      setFormattingOnly(diff.oldRanges.length === 0 && diff.newRanges.length === 0);
      if (diff.unchangedRatio < MIN_WORD_DIFF_SIMILARITY) return;
      clearHighlights = [
        addTextHighlights('difit-md-removed', createTextRanges(oldLayout, diff.oldRanges)),
        addTextHighlights('difit-md-added', createTextRanges(newLayout, diff.newRanges)),
      ];
    };
    paint();

    // Syntax highlighting and Mermaid render asynchronously and replace text nodes.
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    });
    const observed = { childList: true, subtree: true, characterData: true };
    observer.observe(oldRoot, observed);
    observer.observe(newRoot, observed);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearHighlights.forEach((clear) => clear());
    };
  }, [row]);

  const frontmatterDiff = layout === 'unified' ? getChangedFrontmatter(row) : undefined;

  return (
    <div
      className={`${layout === 'split' ? 'grid grid-cols-2' : ''} border-b border-github-border/30`}
      data-md-row-type={row.type}
    >
      {getCellSides(row, layout, singleSide).map((side) => (
        <PaneCell
          key={side}
          side={side}
          rowIndex={rowIndex}
          rowType={row.type}
          block={blockOnSide(row, side)}
          definitions={side === 'old' ? oldDefinitions : newDefinitions}
          syntaxTheme={syntaxTheme}
          formattingOnly={side === 'new' && row.type === 'modified' && formattingOnly}
          divided={layout === 'split' && side === 'old'}
          frontmatterDiff={frontmatterDiff}
          contentRef={side === 'old' ? oldContentRef : newContentRef}
          onStartComment={onStartComment}
        />
      ))}
    </div>
  );
});

export function MarkdownSplitPreview({
  filePath,
  baseContent,
  targetContent,
  baseLabel,
  targetLabel,
  layout = 'split',
  threads,
  showAuthorBadges,
  syntaxTheme,
  onAddComment,
  onGenerateThreadPrompt,
  onRemoveThread,
  onReplyToThread,
  onRemoveMessage,
  onUpdateMessage,
}: MarkdownSplitPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null);
  const [selectionTarget, setSelectionTarget] = useState<SelectionTarget | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => new Set());

  const oldBlocks = useMemo(() => parseMarkdownBlocks(baseContent ?? ''), [baseContent]);
  const newBlocks = useMemo(() => parseMarkdownBlocks(targetContent ?? ''), [targetContent]);
  const oldLines = useMemo(() => splitLines(baseContent), [baseContent]);
  const newLines = useMemo(() => splitLines(targetContent), [targetContent]);
  const oldDefinitions = useMemo(
    () =>
      oldBlocks.filter((block) => DEFINITION_KINDS.has(block.kind)).map((block) => block.source),
    [oldBlocks],
  );
  const newDefinitions = useMemo(
    () =>
      newBlocks.filter((block) => DEFINITION_KINDS.has(block.kind)).map((block) => block.source),
    [newBlocks],
  );
  const singleSide: DiffSide = targetContent === null ? 'old' : 'new';
  const rows = useMemo<MarkdownBlockRow[]>(() => {
    if (layout !== 'single') return alignMarkdownBlocks(oldBlocks, newBlocks);
    return (singleSide === 'old' ? oldBlocks : newBlocks).map((block) => ({
      type: 'unchanged',
      old: block,
      new: block,
    }));
  }, [layout, singleSide, oldBlocks, newBlocks]);
  const { byRow: threadsByRow, unplaced } = useMemo(() => {
    if (layout !== 'single') return placeThreadsOnRows(threads, rows);
    // The other side's line numbers do not point into this file, so list those threads on top.
    const isShownSide = (thread: (typeof threads)[number]) =>
      (thread.side === 'old' ? 'old' : 'new') === singleSide;
    const placed = placeThreadsOnRows(threads.filter(isShownSide), rows);
    return { ...placed, unplaced: [...placed.unplaced, ...threads.filter((t) => !isShownSide(t))] };
  }, [layout, singleSide, threads, rows]);
  const items = useMemo(() => {
    if (layout === 'single') return rows.map((_, index) => ({ kind: 'row' as const, index }));
    const pinned = new Set(threadsByRow.keys());
    if (commentTarget) pinned.add(commentTarget.rowIndex);
    return buildSplitPreviewItems(rows, pinned, expandedSections);
  }, [layout, rows, threadsByRow, commentTarget, expandedSections]);
  const hasRenderedChanges = layout === 'single' || rows.some((row) => row.type !== 'unchanged');

  const getSourceText = useCallback(
    ({ side, start, end }: LineRange & { side: DiffSide }) =>
      (side === 'old' ? oldLines : newLines).slice(start - 1, end).join('\n'),
    [oldLines, newLines],
  );

  const handleStartComment = useCallback((target: CommentTarget) => {
    setSelectionTarget(null);
    setCommentTarget((current) =>
      current &&
      !target.initialBody &&
      current.side === target.side &&
      current.start === target.start &&
      current.end === target.end
        ? null
        : target,
    );
  }, []);

  const handleSubmitComment = useCallback(
    async (body: string) => {
      if (!commentTarget) return;
      const { start, end, side } = commentTarget;
      await onAddComment(
        start === end ? start : [start, end],
        body,
        getSourceText(commentTarget),
        side,
      );
      setCommentTarget(null);
    },
    [commentTarget, getSourceText, onAddComment],
  );

  const handleMouseUp = useCallback(() => {
    const container = containerRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionTarget(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const startElement = closestElement(range.startContainer);
    const endElement = closestElement(range.endContainer);
    const cell = startElement?.closest('[data-md-cell]');
    const quote = selection.toString().trim();
    if (!cell || !container.contains(cell) || cell !== endElement?.closest('[data-md-cell]')) {
      setSelectionTarget(null);
      return;
    }
    const startRange = readLineRange(startElement?.closest('[data-md-line-start]'));
    const endRange = readLineRange(endElement?.closest('[data-md-line-start]'));
    if (!quote || !startRange || !endRange) {
      setSelectionTarget(null);
      return;
    }

    const side: DiffSide = cell.getAttribute('data-md-side') === 'old' ? 'old' : 'new';
    const enclosing = {
      start: Math.min(startRange.start, endRange.start),
      end: Math.max(startRange.end, endRange.end),
    };
    const sourceLines = (side === 'old' ? oldLines : newLines).slice(
      enclosing.start - 1,
      enclosing.end,
    );
    const lines = findSourceLinesForText(sourceLines, enclosing.start, quote) ?? enclosing;
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setSelectionTarget({
      ...lines,
      side,
      rowIndex: Number(cell.getAttribute('data-md-row')),
      quote,
      top: rect.bottom - containerRect.top + 6,
      left: Math.max(0, Math.min(rect.right - containerRect.left - 60, containerRect.width - 180)),
    });
  }, [oldLines, newLines]);

  useEffect(() => {
    if (!selectionTarget) return;
    const hideWhenCollapsed = () => {
      if (window.getSelection()?.isCollapsed ?? true) setSelectionTarget(null);
    };
    document.addEventListener('selectionchange', hideWhenCollapsed);
    return () => document.removeEventListener('selectionchange', hideWhenCollapsed);
  }, [selectionTarget]);

  const renderThreadCard = (thread: RowThreads['new'][number]) => (
    <div key={thread.id} className="m-2 mx-3">
      <CommentThreadCard
        thread={thread}
        showAuthorBadges={showAuthorBadges}
        onGeneratePrompt={onGenerateThreadPrompt}
        onRemoveThread={onRemoveThread}
        onReplyToThread={onReplyToThread}
        onRemoveMessage={onRemoveMessage}
        onUpdateMessage={onUpdateMessage}
        syntaxTheme={syntaxTheme}
      />
    </div>
  );

  const renderSideComments = (rowIndex: number, side: DiffSide) => {
    const rowThreads = threadsByRow.get(rowIndex)?.[side] ?? [];
    const isCommentingHere = commentTarget?.rowIndex === rowIndex && commentTarget.side === side;
    return (
      <div
        key={side}
        className={`min-w-0 ${layout === 'split' && side === 'old' ? 'border-r border-github-border' : ''}`}
      >
        {rowThreads.map(renderThreadCard)}
        {isCommentingHere && commentTarget && (
          <CommentForm
            key={`${commentTarget.start}-${commentTarget.end}-${commentTarget.initialBody ?? ''}`}
            onSubmit={handleSubmitComment}
            onCancel={() => setCommentTarget(null)}
            selectedCode={getSourceText(commentTarget)}
            syntaxTheme={syntaxTheme}
            filename={filePath}
            initialValue={commentTarget.initialBody}
            title={`Comment on ${formatLineRange(commentTarget)}${side === 'old' ? ' (before)' : ''}`}
          />
        )}
      </div>
    );
  };

  const expandSection = (start: number) =>
    setExpandedSections((current) => new Set(current).add(start));

  return (
    <div
      ref={containerRef}
      className="relative"
      data-testid={`markdown-${layout}-preview`}
      onMouseUp={handleMouseUp}
    >
      {layout === 'split' && (
        <div className="grid grid-cols-2 border-b border-github-border bg-github-bg-secondary text-xs text-github-text-secondary">
          <div className="border-r border-github-border px-4 py-2">
            <span className="font-semibold text-github-text-primary">Before</span>
            {baseContent === null ? (
              <span className="ml-2">file does not exist</span>
            ) : (
              baseLabel && <code className="ml-2 font-mono">{baseLabel}</code>
            )}
          </div>
          <div className="px-4 py-2">
            <span className="font-semibold text-github-text-primary">After</span>
            {targetContent === null ? (
              <span className="ml-2">file deleted</span>
            ) : (
              targetLabel && <code className="ml-2 font-mono">{targetLabel}</code>
            )}
          </div>
        </div>
      )}

      {!hasRenderedChanges && rows.length > 0 && (
        <div className="px-4 py-2 text-sm text-github-text-muted">
          No rendered changes — the diff only touches blank lines or whitespace.
        </div>
      )}

      {unplaced.length > 0 && (
        <div className="border-b border-github-border bg-github-bg-secondary">
          {unplaced.map(renderThreadCard)}
        </div>
      )}

      {items.map((item) => {
        if (item.kind === 'collapsed') {
          const hiddenCount = item.end - item.start;
          return (
            <button
              key={`collapsed-${item.start}`}
              type="button"
              className="flex w-full items-center justify-center gap-2 border-b border-github-border bg-github-bg-secondary py-1.5 text-xs text-github-text-secondary hover:bg-github-bg-tertiary hover:text-github-text-primary"
              onClick={() => expandSection(item.start)}
            >
              <ChevronsUpDown size={14} />
              Show {hiddenCount} unchanged {hiddenCount === 1 ? 'block' : 'blocks'}
            </button>
          );
        }

        const row = rows[item.index];
        if (!row) return null;
        const hasComments = threadsByRow.has(item.index) || commentTarget?.rowIndex === item.index;
        return (
          <React.Fragment key={`row-${item.index}`}>
            <SplitRow
              row={row}
              rowIndex={item.index}
              layout={layout}
              singleSide={singleSide}
              oldDefinitions={oldDefinitions}
              newDefinitions={newDefinitions}
              syntaxTheme={syntaxTheme}
              onStartComment={handleStartComment}
            />
            {hasComments && (
              <div
                className={`${layout === 'split' ? 'grid grid-cols-2' : ''} border-b border-github-border bg-github-bg-secondary`}
              >
                {(layout === 'single' ? [singleSide] : (['old', 'new'] as const)).map((side) =>
                  renderSideComments(item.index, side),
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {selectionTarget && (
        <button
          type="button"
          data-md-selection-comment=""
          className="absolute z-20 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium shadow-lg"
          style={{ ...selectionButtonStyle, top: selectionTarget.top, left: selectionTarget.left }}
          onMouseDown={(event) => event.preventDefault()}
          onMouseUp={(event) => event.stopPropagation()}
          onClick={() => {
            handleStartComment({
              side: selectionTarget.side,
              rowIndex: selectionTarget.rowIndex,
              start: selectionTarget.start,
              end: selectionTarget.end,
              initialBody: quoteSelection(selectionTarget.quote),
            });
            window.getSelection()?.removeAllRanges();
          }}
        >
          <MessageSquarePlus size={14} />
          Comment on {formatLineRange(selectionTarget)}
        </button>
      )}
    </div>
  );
}
