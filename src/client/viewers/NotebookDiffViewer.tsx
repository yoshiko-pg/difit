import { Eye, FileDiff } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { DiffLine } from '../../types/diff';
import { EnhancedPrismSyntaxHighlighter } from '../components/EnhancedPrismSyntaxHighlighter';
import { PrismSyntaxHighlighter } from '../components/PrismSyntaxHighlighter';
import type { MergedChunk } from '../hooks/useExpandedLines';

import { TextDiffViewer } from './TextDiffViewer';
import type { DiffViewerBodyProps } from './types';

type PreviewMode = 'diff' | 'preview';

type PreviewLineType = 'add' | 'delete' | 'context';

type NotebookCellType = 'markdown' | 'code' | 'raw' | 'unknown';

type NotebookCellStatus = 'add' | 'delete' | 'change' | 'context';

type NotebookSourceLine = {
  type: PreviewLineType;
  content: string;
};

type NotebookCellPreview = {
  cellType: NotebookCellType;
  sourceLines: NotebookSourceLine[];
  status: NotebookCellStatus;
  id?: string;
  executionCount?: string | null;
};

type NotebookCellContent = {
  cellType: NotebookCellType;
  sourceText: string;
  id?: string;
  executionCount?: string | null;
};

type NotebookDocument = {
  cells: NotebookCellContent[];
  language?: string;
};

type PreviewState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  cells: NotebookCellPreview[];
  message?: string;
  source?: 'blob' | 'diff';
  language?: string;
};

type SectionTone = 'before' | 'after' | 'neutral';

type Section = {
  label: string;
  content: string;
  tone: SectionTone;
};

const headingStyles = [
  'text-2xl font-semibold',
  'text-xl font-semibold',
  'text-lg font-semibold',
  'text-base font-semibold',
  'text-sm font-semibold uppercase tracking-wide',
  'text-sm font-semibold',
];

const cellTypeLabels: Record<NotebookCellType, string> = {
  markdown: 'Markdown',
  code: 'Code',
  raw: 'Raw',
  unknown: 'Cell',
};

const statusLabels: Record<NotebookCellStatus, string> = {
  add: 'Added',
  delete: 'Deleted',
  change: 'Modified',
  context: 'Unchanged',
};

const cellTypePattern = /"cell_type"\s*:\s*"([^"]+)"/;
const sourcePattern = /"source"\s*:/;
const executionPattern = /"execution_count"\s*:\s*(null|[0-9]+)/;
const idPattern = /"id"\s*:\s*"([^"]+)"/;

const isDeletionLine = (line: DiffLine) => line.type === 'delete' || line.type === 'remove';

const isContextLine = (line: DiffLine) => line.type === 'normal' || line.type === 'context';

const toPreviewLineType = (line: DiffLine): PreviewLineType | null => {
  if (line.type === 'add') return 'add';
  if (isDeletionLine(line)) return 'delete';
  if (isContextLine(line)) return 'context';
  return null;
};

const normalizeCellType = (value: string): NotebookCellType => {
  if (value === 'markdown' || value === 'code' || value === 'raw') {
    return value;
  }
  return 'unknown';
};

const parseNotebookStringLine = (line: string): string | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('"')) return null;

  let raw = trimmed;
  if (raw.endsWith(',')) {
    raw = raw.slice(0, -1);
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    const fallback = raw.replace(/^"/, '').replace(/"$/, '');
    return fallback
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
};

const parseInlineSource = (line: string): string[] | null => {
  const sourceIndex = line.indexOf('"source"');
  if (sourceIndex === -1) return null;

  const colonIndex = line.indexOf(':', sourceIndex);
  if (colonIndex === -1) return null;

  let value = line.slice(colonIndex + 1).trim();
  if (!value) return null;

  if (value.endsWith(',')) {
    value = value.slice(0, -1).trim();
  }

  if (value.startsWith('[')) {
    const endIndex = value.lastIndexOf(']');
    if (endIndex === -1) return null;
    const arrayText = value.slice(0, endIndex + 1);
    try {
      const parsed: unknown = JSON.parse(arrayText);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string');
      }
    } catch {
      return null;
    }
    return [];
  }

  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === 'string' ? [parsed] : null;
    } catch {
      return null;
    }
  }

  return null;
};

const buildNotebookCellsFromDiff = (chunks: MergedChunk[]): NotebookPreviewData => {
  const contentBased = buildNotebookCellsFromContent(chunks);
  if (contentBased) {
    return contentBased;
  }

  const cells: NotebookCellPreview[] = [];
  let current: NotebookCellPreview | null = null;
  let hasAdd = false;
  let hasDelete = false;
  let inSource = false;

  const finalizeCell = () => {
    if (!current) return;

    current.status =
      hasAdd && hasDelete ? 'change'
      : hasAdd ? 'add'
      : hasDelete ? 'delete'
      : 'context';
    cells.push(current);
    current = null;
    hasAdd = false;
    hasDelete = false;
    inSource = false;
  };

  const startCell = (cellType: NotebookCellType) => {
    finalizeCell();
    current = {
      cellType,
      sourceLines: [],
      status: 'context',
    };
  };

  chunks.forEach((chunk) => {
    chunk.lines.forEach((line) => {
      const lineType = toPreviewLineType(line);
      if (!lineType) return;

      const cellTypeMatch = line.content.match(cellTypePattern);
      if (cellTypeMatch) {
        startCell(normalizeCellType(cellTypeMatch[1] ?? ''));
      } else if (!current && sourcePattern.test(line.content)) {
        startCell('unknown');
      }

      if (!current) return;

      if (lineType === 'add') hasAdd = true;
      if (lineType === 'delete') hasDelete = true;

      if (!current.id) {
        const idMatch = line.content.match(idPattern);
        if (idMatch) current.id = idMatch[1];
      }

      if (current.executionCount === undefined) {
        const executionMatch = line.content.match(executionPattern);
        if (executionMatch) {
          current.executionCount = executionMatch[1] === 'null' ? null : executionMatch[1];
        }
      }

      if (sourcePattern.test(line.content)) {
        const inlineSource = parseInlineSource(line.content);
        if (inlineSource) {
          inlineSource.forEach((entry) => {
            current?.sourceLines.push({ type: lineType, content: entry });
          });
          inSource = false;
          return;
        }

        inSource = true;
        return;
      }

      if (!inSource) return;

      const trimmed = line.content.trim();
      if (trimmed.startsWith(']')) {
        inSource = false;
        return;
      }

      const parsed = parseNotebookStringLine(line.content);
      if (parsed !== null) {
        current.sourceLines.push({ type: lineType, content: parsed });
      }
    });
  });

  finalizeCell();

  return { cells };
};

type NotebookPreviewData = {
  cells: NotebookCellPreview[];
  language?: string;
};

const buildNotebookCellsFromContent = (chunks: MergedChunk[]): NotebookPreviewData | null => {
  const afterText = buildTextFromChunks(chunks, ['add', 'context']);
  const beforeText = buildTextFromChunks(chunks, ['delete', 'context']);

  const afterDoc = parseNotebookContent(afterText);
  const beforeDoc = parseNotebookContent(beforeText);

  if (!afterDoc && !beforeDoc) {
    return null;
  }

  if (afterDoc && afterDoc.cells.length === 0 && !beforeDoc) {
    return null;
  }

  const language = afterDoc?.language ?? beforeDoc?.language;
  return {
    cells: buildCellsFromNotebookContent(beforeDoc?.cells ?? [], afterDoc?.cells ?? []),
    language,
  };
};

const buildTextFromChunks = (chunks: MergedChunk[], allow: PreviewLineType[]): string =>
  chunks
    .flatMap((chunk) => chunk.lines)
    .map((line) => {
      const lineType = toPreviewLineType(line);
      if (!lineType || !allow.includes(lineType)) return null;
      return line.content;
    })
    .filter((line): line is string => line !== null)
    .join('\n');

const parseNotebookContent = (text: string): NotebookDocument | null => {
  if (!text.trim()) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!('cells' in parsed)) return null;
    const cells = (parsed as { cells?: unknown }).cells;
    if (!Array.isArray(cells)) return null;

    const metadata = (parsed as { metadata?: unknown }).metadata;
    const language = extractNotebookLanguage(metadata);

    return {
      cells: cells.map((cell) => normalizeNotebookCell(cell)),
      language,
    };
  } catch {
    return null;
  }
};

const extractNotebookLanguage = (metadata: unknown): string | undefined => {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const record = metadata as Record<string, unknown>;
  const languageInfo = record.language_info;
  if (languageInfo && typeof languageInfo === 'object') {
    const name = (languageInfo as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim()) {
      return name;
    }
  }

  const kernelSpec = record.kernelspec;
  if (kernelSpec && typeof kernelSpec === 'object') {
    const language = (kernelSpec as Record<string, unknown>).language;
    if (typeof language === 'string' && language.trim()) {
      return language;
    }
  }

  return undefined;
};

const normalizeNotebookCell = (cell: unknown): NotebookCellContent => {
  const cellObject = typeof cell === 'object' && cell ? (cell as Record<string, unknown>) : {};
  const cellTypeValue = typeof cellObject.cell_type === 'string' ? cellObject.cell_type : '';
  const cellType = normalizeCellType(cellTypeValue);
  const id = typeof cellObject.id === 'string' ? cellObject.id : undefined;
  const executionCountValue = cellObject.execution_count;
  const executionCount =
    executionCountValue === null ? null
    : typeof executionCountValue === 'number' ? String(executionCountValue)
    : typeof executionCountValue === 'string' ? executionCountValue
    : undefined;

  const sourceText = normalizeSourceText(cellObject.source);

  return {
    cellType,
    sourceText,
    id,
    executionCount,
  };
};

const normalizeSourceText = (source: unknown): string => {
  if (typeof source === 'string') {
    return source;
  }
  if (Array.isArray(source)) {
    return source.filter((entry): entry is string => typeof entry === 'string').join('');
  }
  return '';
};

const buildCellsFromNotebookContent = (
  beforeCells: NotebookCellContent[],
  afterCells: NotebookCellContent[],
): NotebookCellPreview[] => {
  const results: NotebookCellPreview[] = [];
  const hasIds =
    beforeCells.some((cell) => Boolean(cell.id)) || afterCells.some((cell) => Boolean(cell.id));

  if (hasIds) {
    const beforeById = new Map<string, { cell: NotebookCellContent; index: number }>();
    beforeCells.forEach((cell, index) => {
      if (cell.id) {
        beforeById.set(cell.id, { cell, index });
      }
    });

    const usedBefore = new Set<number>();
    afterCells.forEach((cell) => {
      const match = cell.id ? beforeById.get(cell.id) : undefined;
      if (match) usedBefore.add(match.index);
      results.push(buildPreviewFromContent(match?.cell ?? null, cell));
    });

    beforeCells.forEach((cell, index) => {
      if (!usedBefore.has(index)) {
        results.push(buildPreviewFromContent(cell, null));
      }
    });

    return results;
  }

  const maxLength = Math.max(beforeCells.length, afterCells.length);
  for (let i = 0; i < maxLength; i += 1) {
    const beforeCell = beforeCells[i] ?? null;
    const afterCell = afterCells[i] ?? null;
    results.push(buildPreviewFromContent(beforeCell, afterCell));
  }

  return results;
};

const buildPreviewFromContent = (
  beforeCell: NotebookCellContent | null,
  afterCell: NotebookCellContent | null,
): NotebookCellPreview => {
  if (!afterCell && beforeCell) {
    return {
      cellType: beforeCell.cellType,
      sourceLines: buildSourceLines(beforeCell.sourceText, 'delete'),
      status: 'delete',
      id: beforeCell.id,
      executionCount: beforeCell.executionCount,
    };
  }

  if (afterCell && !beforeCell) {
    return {
      cellType: afterCell.cellType,
      sourceLines: buildSourceLines(afterCell.sourceText, 'add'),
      status: 'add',
      id: afterCell.id,
      executionCount: afterCell.executionCount,
    };
  }

  const beforeText = beforeCell?.sourceText ?? '';
  const afterText = afterCell?.sourceText ?? '';
  const cellType = afterCell?.cellType ?? beforeCell?.cellType ?? 'unknown';
  const id = afterCell?.id ?? beforeCell?.id;
  const executionCount = afterCell?.executionCount ?? beforeCell?.executionCount;

  if (beforeText === afterText && (beforeCell?.cellType ?? '') === (afterCell?.cellType ?? '')) {
    return {
      cellType,
      sourceLines: buildSourceLines(afterText, 'context'),
      status: 'context',
      id,
      executionCount,
    };
  }

  return {
    cellType,
    sourceLines: [...buildSourceLines(beforeText, 'delete'), ...buildSourceLines(afterText, 'add')],
    status: 'change',
    id,
    executionCount,
  };
};

const buildSourceLines = (text: string, type: PreviewLineType): NotebookSourceLine[] => {
  if (!text) return [];
  return [{ type, content: text }];
};

const isFetchableRef = (ref?: string) => Boolean(ref && ref !== 'stdin');

const fetchNotebookContent = async (filePath: string, ref: string): Promise<string | null> => {
  const encodedPath = encodeURIComponent(filePath);
  const response = await fetch(`/api/blob/${encodedPath}?ref=${encodeURIComponent(ref)}`);
  if (!response.ok) return null;
  return response.text();
};

const buildSourceText = (lines: NotebookSourceLine[], allow: PreviewLineType[]): string =>
  lines
    .filter((line) => allow.includes(line.type))
    .map((line) => line.content)
    .join('');

const isElementWithChildren = (
  node: React.ReactNode,
): node is React.ReactElement<{ children?: React.ReactNode }> => React.isValidElement(node);

const isElementWithCodeProps = (
  node: React.ReactNode,
): node is React.ReactElement<{ className?: string; children?: React.ReactNode }> =>
  React.isValidElement(node);

const extractText = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  if (isElementWithChildren(node)) {
    return extractText(node.props.children);
  }
  return '';
};

const getCellBorderStyle = (status: NotebookCellStatus) => {
  switch (status) {
    case 'add':
      return 'border-l-4 border-diff-addition-border';
    case 'delete':
      return 'border-l-4 border-diff-deletion-border';
    case 'change':
      return 'border-l-4 border-diff-addition-border';
    default:
      return 'border-l-4 border-transparent';
  }
};

const getStatusClass = (status: NotebookCellStatus) => {
  switch (status) {
    case 'add':
      return 'text-github-accent';
    case 'delete':
      return 'text-github-danger';
    case 'change':
      return 'text-github-warning';
    default:
      return 'text-github-text-muted';
  }
};

const getSectionClass = (tone: SectionTone) => {
  switch (tone) {
    case 'before':
      return 'border-l-4 border-diff-deletion-border bg-diff-deletion-bg/20';
    case 'after':
      return 'border-l-4 border-diff-addition-border bg-diff-addition-bg/20';
    default:
      return 'border-l-4 border-transparent bg-github-bg-tertiary/50';
  }
};

const getSectionLabelClass = (tone: SectionTone) => {
  switch (tone) {
    case 'before':
      return 'text-github-danger';
    case 'after':
      return 'text-github-accent';
    default:
      return 'text-github-text-muted';
  }
};

const isSafeUrl = (url: string) => /^(https?:|mailto:|#|\.{0,2}\/|\/)/i.test(url.trim());

const getMarkdownComponents = (syntaxTheme?: DiffViewerBodyProps['syntaxTheme']) => ({
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className={`${headingStyles[0]} mb-2`}>{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className={`${headingStyles[1]} mb-2`}>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className={`${headingStyles[2]} mb-2`}>{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className={`${headingStyles[3]} mb-2`}>{children}</h4>
  ),
  h5: ({ children }: { children?: React.ReactNode }) => (
    <h5 className={`${headingStyles[4]} mb-2`}>{children}</h5>
  ),
  h6: ({ children }: { children?: React.ReactNode }) => (
    <h6 className={`${headingStyles[5]} mb-2`}>{children}</h6>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-7">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-6 text-sm space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-6 text-sm space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-github-border pl-4 text-github-text-muted italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-github-border" />,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const safeHref = href ?? '';
    if (!safeHref || !isSafeUrl(safeHref)) {
      return <span>{children}</span>;
    }
    const isExternal = safeHref.startsWith('http');
    return (
      <a
        href={safeHref}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noreferrer' : undefined}
        className="text-sky-400 hover:text-sky-300 underline underline-offset-4"
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }: { src?: string; alt?: string }) => {
    const safeSrc = src ?? '';
    if (!safeSrc || !isSafeUrl(safeSrc)) {
      return null;
    }
    return (
      <img
        src={safeSrc}
        alt={alt ?? ''}
        loading="lazy"
        className="max-w-full rounded border border-github-border"
      />
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => {
    const nodes = Array.isArray(children) ? children : [children];
    const codeElement = nodes.find(isElementWithCodeProps);
    const codeText = extractText(codeElement ?? children);
    const match = /language-(\S+)/.exec(codeElement?.props.className ?? '');
    const language = match?.[1];

    if (!codeText.trim()) {
      return (
        <pre className="border border-github-border bg-github-bg-secondary p-3 overflow-x-auto text-xs">
          {children}
        </pre>
      );
    }

    return (
      <pre className="border border-github-border bg-github-bg-secondary p-3 overflow-x-auto text-xs">
        <PrismSyntaxHighlighter
          code={codeText.replace(/\n$/, '')}
          language={language}
          syntaxTheme={syntaxTheme}
          className="font-mono text-github-text-primary [&_.token-line]:block [&_.token-line]:whitespace-pre"
        />
      </pre>
    );
  },
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    if (className) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="px-1 py-0.5 rounded bg-github-bg-tertiary border border-github-border text-xs font-mono">
        {children}
      </code>
    );
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-github-border">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-github-border px-2 py-1 bg-github-bg-tertiary text-sm">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-github-border px-2 py-1 text-sm">{children}</td>
  ),
});

const buildSectionsForCell = (cell: NotebookCellPreview): Section[] => {
  const beforeText = buildSourceText(cell.sourceLines, ['context', 'delete']);
  const afterText = buildSourceText(cell.sourceLines, ['context', 'add']);
  const sections: Section[] = [];

  if (cell.status === 'change') {
    if (beforeText.trim()) {
      sections.push({ label: 'Before', content: beforeText, tone: 'before' });
    }
    if (afterText.trim()) {
      sections.push({ label: 'After', content: afterText, tone: 'after' });
    }
    if (sections.length === 0) {
      sections.push({ label: 'After', content: afterText, tone: 'after' });
    }
    return sections;
  }

  if (cell.status === 'delete') {
    sections.push({ label: 'Before', content: beforeText || afterText, tone: 'before' });
    return sections;
  }

  sections.push({ label: 'After', content: afterText || beforeText, tone: 'after' });
  return sections;
};

const renderCellContent = (
  cellType: NotebookCellType,
  content: string,
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'],
  language?: string,
) => {
  if (!content.trim()) {
    return <span className="text-xs text-github-text-muted">Empty cell</span>;
  }

  if (cellType === 'markdown') {
    const components = getMarkdownComponents(syntaxTheme);
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (isSafeUrl(url) ? url : '')}
        components={components}
      >
        {content}
      </ReactMarkdown>
    );
  }

  if (cellType === 'raw') {
    return (
      <pre className="whitespace-pre-wrap break-words text-xs font-mono text-github-text-primary">
        {content}
      </pre>
    );
  }

  return (
    <pre className="overflow-x-auto text-xs">
      <EnhancedPrismSyntaxHighlighter
        code={content.replace(/\n$/, '')}
        language={language || 'python'}
        syntaxTheme={syntaxTheme}
        className="font-mono text-github-text-primary [&_.token-line]:block [&_.token-line]:whitespace-pre"
      />
    </pre>
  );
};

const NotebookPreview = ({
  cells,
  syntaxTheme,
  language,
}: {
  cells: NotebookCellPreview[];
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'];
  language?: string;
}) => (
  <div className="space-y-4">
    {cells.map((cell, index) => {
      const sections = buildSectionsForCell(cell);
      const executionLabel =
        cell.cellType === 'code' && cell.executionCount !== undefined ?
          `In[${cell.executionCount ?? ' '}]`
        : null;

      return (
        <div
          key={`notebook-cell-${index}`}
          className={`rounded border border-github-border bg-github-bg-secondary/40 p-4 ${getCellBorderStyle(
            cell.status,
          )}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-github-text-muted">
                {cellTypeLabels[cell.cellType]}
              </span>
              {executionLabel && (
                <span className="text-xs font-mono text-github-text-secondary">
                  {executionLabel}
                </span>
              )}
              {cell.id && (
                <span className="text-xs font-mono text-github-text-muted">{cell.id}</span>
              )}
            </div>
            <span className={`text-xs font-semibold ${getStatusClass(cell.status)}`}>
              {statusLabels[cell.status]}
            </span>
          </div>

          <div className="space-y-3">
            {sections.map((section, sectionIndex) => (
              <div
                key={`notebook-cell-${index}-section-${sectionIndex}`}
                className={`rounded border border-github-border p-3 ${getSectionClass(section.tone)}`}
              >
                <div
                  className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${getSectionLabelClass(
                    section.tone,
                  )}`}
                >
                  {section.label}
                </div>
                <div className="text-sm text-github-text-primary">
                  {renderCellContent(cell.cellType, section.content, syntaxTheme, language)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

export function NotebookDiffViewer(props: DiffViewerBodyProps) {
  const [mode, setMode] = useState<PreviewMode>('diff');
  const fallbackPreview = useMemo(
    () => buildNotebookCellsFromDiff(props.mergedChunks),
    [props.mergedChunks],
  );
  const [previewState, setPreviewState] = useState<PreviewState>({
    status: 'idle',
    cells: fallbackPreview.cells,
    language: fallbackPreview.language,
  });

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      const baseRef = props.baseCommitish || 'HEAD~1';
      const targetRef = props.targetCommitish || 'HEAD';
      const oldPath = props.file.oldPath || props.file.path;

      const canFetchOld = props.file.status !== 'added' && isFetchableRef(baseRef);
      const canFetchNew = props.file.status !== 'deleted' && isFetchableRef(targetRef);

      if (!canFetchOld && !canFetchNew) {
        setPreviewState({
          status: 'ready',
          cells: fallbackPreview.cells,
          language: fallbackPreview.language,
          source: 'diff',
          message: 'Notebook content could not be loaded, falling back to diff preview.',
        });
        return;
      }

      setPreviewState((prev) => ({
        ...prev,
        status: 'loading',
      }));

      try {
        const [oldText, newText] = await Promise.all([
          canFetchOld ? fetchNotebookContent(oldPath, baseRef) : Promise.resolve(null),
          canFetchNew ? fetchNotebookContent(props.file.path, targetRef) : Promise.resolve(null),
        ]);

        const oldDoc = oldText ? parseNotebookContent(oldText) : null;
        const newDoc = newText ? parseNotebookContent(newText) : null;

        if (!oldDoc && !newDoc) {
          if (!cancelled) {
            setPreviewState({
              status: 'ready',
              cells: fallbackPreview.cells,
              language: fallbackPreview.language,
              source: 'diff',
              message: 'Notebook content could not be parsed, falling back to diff preview.',
            });
          }
          return;
        }

        const language = newDoc?.language ?? oldDoc?.language ?? fallbackPreview.language;
        const cells = buildCellsFromNotebookContent(oldDoc?.cells ?? [], newDoc?.cells ?? []);
        if (!cancelled) {
          setPreviewState({
            status: 'ready',
            cells,
            source: 'blob',
            language,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewState({
            status: 'error',
            cells: fallbackPreview.cells,
            language: fallbackPreview.language,
            source: 'diff',
            message: error instanceof Error ? error.message : 'Failed to load notebook preview.',
          });
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [
    props.baseCommitish,
    props.file.oldPath,
    props.file.path,
    props.file.status,
    props.mergedChunks,
    props.targetCommitish,
    fallbackPreview,
  ]);

  return (
    <div className="bg-github-bg-primary">
      <div className="flex items-center justify-between border-b border-github-border px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMode('diff')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors duration-200 flex items-center gap-1 cursor-pointer ${
              mode === 'diff' ?
                'text-github-text-primary'
              : 'text-github-text-secondary hover:text-github-text-primary'
            }`}
            title="Code Diff"
          >
            <FileDiff size={14} />
            Diff
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors duration-200 flex items-center gap-1 cursor-pointer ${
              mode === 'preview' ?
                'text-github-text-primary'
              : 'text-github-text-secondary hover:text-github-text-primary'
            }`}
            title="Preview"
          >
            <Eye size={14} />
            Preview
          </button>
        </div>
      </div>

      {mode === 'diff' ?
        <TextDiffViewer {...props} />
      : <div className="p-4">
          {previewState.status === 'loading' && (
            <div className="text-xs text-github-text-muted mb-3">Loading notebook preview…</div>
          )}
          {previewState.message && (
            <div className="text-xs text-github-text-muted mb-3">{previewState.message}</div>
          )}
          {previewState.cells.length === 0 ?
            <div>
              <div className="text-xs text-github-text-muted mb-3">
                No notebook cells could be extracted from this diff. Showing raw diff instead.
              </div>
              <TextDiffViewer {...props} />
            </div>
          : <NotebookPreview
              cells={previewState.cells}
              syntaxTheme={props.syntaxTheme}
              language={previewState.language}
            />}
        </div>
      }
    </div>
  );
}
