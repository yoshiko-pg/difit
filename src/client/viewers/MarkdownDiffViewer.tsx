import React, { useMemo, useState } from 'react';

import type { DiffLine } from '../../types/diff';
import { PrismSyntaxHighlighter } from '../components/PrismSyntaxHighlighter';
import type { MergedChunk } from '../hooks/useExpandedLines';

import { TextDiffViewer } from './TextDiffViewer';
import type { DiffViewerBodyProps } from './types';

type PreviewMode = 'diff' | 'preview';

type PreviewBlockType = 'add' | 'delete' | 'change' | 'context';

type PreviewBlock = {
  type: PreviewBlockType;
  lines: string[];
};

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language?: string; content: string }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' };

const INLINE_PATTERN =
  /(`[^`]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;

const headingStyles = [
  'text-2xl font-semibold',
  'text-xl font-semibold',
  'text-lg font-semibold',
  'text-base font-semibold',
  'text-sm font-semibold uppercase tracking-wide',
  'text-sm font-semibold',
];

const isDeletionLine = (line: DiffLine) => line.type === 'delete' || line.type === 'remove';

const isContextLine = (line: DiffLine) => line.type === 'normal' || line.type === 'context';

const isSafeUrl = (url: string) => /^(https?:|mailto:|#|\.{0,2}\/|\/)/i.test(url.trim());

const appendBlockLine = (blocks: PreviewBlock[], type: PreviewBlockType, line: string) => {
  const last = blocks[blocks.length - 1];
  if (last && last.type === type) {
    last.lines.push(line);
    return;
  }
  blocks.push({ type, lines: [line] });
};

const flushDeleteLines = (blocks: PreviewBlock[], pendingDeletes: string[]) => {
  pendingDeletes.forEach((line) => appendBlockLine(blocks, 'delete', line));
  pendingDeletes.length = 0;
};

const buildPreviewBlocks = (chunks: MergedChunk[]): PreviewBlock[] => {
  const blocks: PreviewBlock[] = [];
  const pendingDeletes: string[] = [];
  let inChange = false;

  chunks.forEach((chunk) => {
    chunk.lines.forEach((line) => {
      if (line.type === 'header' || line.type === 'hunk') return;

      if (isDeletionLine(line)) {
        pendingDeletes.push(line.content);
        return;
      }

      if (line.type === 'add') {
        if (pendingDeletes.length > 0) {
          flushDeleteLines(blocks, pendingDeletes);
          inChange = true;
        }
        appendBlockLine(blocks, inChange ? 'change' : 'add', line.content);
        return;
      }

      if (isContextLine(line)) {
        flushDeleteLines(blocks, pendingDeletes);
        inChange = false;
        appendBlockLine(blocks, 'context', line.content);
      }
    });

    flushDeleteLines(blocks, pendingDeletes);
    inChange = false;
  });

  return blocks;
};

const parseMarkdownBlocks = (text: string): MarkdownBlock[] => {
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  const isFenceLine = (line: string) => line.trim().startsWith('```');
  const isHeadingLine = (line: string) => /^#{1,6}\s+/.test(line);
  const isBlockquoteLine = (line: string) => /^>\s?/.test(line.trim());
  const isUnorderedListLine = (line: string) => /^[-*+]\s+/.test(line.trim());
  const isOrderedListLine = (line: string) => /^\d+\.\s+/.test(line.trim());
  const isHorizontalRule = (line: string) => /^(\*{3,}|-{3,}|_{3,})$/.test(line.trim());

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (isFenceLine(line)) {
      const fenceMatch = /^```(\S*)/.exec(line.trim());
      const language = fenceMatch?.[1] || undefined;
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !isFenceLine(lines[i] ?? '')) {
        codeLines.push(lines[i] ?? '');
        i += 1;
      }
      if (i < lines.length) {
        i += 1;
      }
      blocks.push({ type: 'code', language, content: codeLines.join('\n') });
      continue;
    }

    if (isHeadingLine(line)) {
      const match = /^(#{1,6})\s+(.*)$/.exec(line.trim());
      if (match) {
        blocks.push({
          type: 'heading',
          level: match[1]?.length ?? 1,
          text: match[2] ?? '',
        });
        i += 1;
        continue;
      }
    }

    if (isBlockquoteLine(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && isBlockquoteLine(lines[i] ?? '')) {
        quoteLines.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    if (isUnorderedListLine(line) || isOrderedListLine(line)) {
      const ordered = isOrderedListLine(line);
      const items: string[] = [];
      while (
        i < lines.length &&
        ((ordered && isOrderedListLine(lines[i] ?? '')) ||
          (!ordered && isUnorderedListLine(lines[i] ?? '')))
      ) {
        const current = lines[i]?.trim() ?? '';
        const item = ordered ? current.replace(/^\d+\.\s+/, '') : current.replace(/^[-*+]\s+/, '');
        items.push(item);
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      !(lines[i]?.trim() === '') &&
      !isHeadingLine(lines[i] ?? '') &&
      !isFenceLine(lines[i] ?? '') &&
      !isBlockquoteLine(lines[i] ?? '') &&
      !isUnorderedListLine(lines[i] ?? '') &&
      !isOrderedListLine(lines[i] ?? '') &&
      !isHorizontalRule(lines[i] ?? '')
    ) {
      paragraphLines.push(lines[i] ?? '');
      i += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
    }
  }

  return blocks;
};

const renderInline = (text: string): React.ReactNode[] =>
  text.split(INLINE_PATTERN).map((part, index) => {
    if (!part) return null;

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={`code-${index}`}
          className="px-1 py-0.5 rounded bg-github-bg-tertiary border border-github-border text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(part);
    if (imageMatch) {
      const [, alt, url] = imageMatch;
      if (!isSafeUrl(url ?? '')) {
        return part;
      }
      return (
        <img
          key={`img-${index}`}
          src={url}
          alt={alt}
          loading="lazy"
          className="max-w-full rounded border border-github-border"
        />
      );
    }

    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      const href = url ?? '';
      if (!href || !isSafeUrl(href)) {
        return label;
      }
      const isExternal = href.startsWith('http');
      return (
        <a
          key={`link-${index}`}
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
          className="text-sky-400 hover:text-sky-300 underline underline-offset-4"
        >
          {label}
        </a>
      );
    }

    if (
      (part.startsWith('**') && part.endsWith('**')) ||
      (part.startsWith('__') && part.endsWith('__'))
    ) {
      return (
        <strong key={`strong-${index}`} className="font-semibold">
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    }

    if (
      (part.startsWith('*') && part.endsWith('*')) ||
      (part.startsWith('_') && part.endsWith('_'))
    ) {
      return (
        <em key={`em-${index}`} className="italic">
          {renderInline(part.slice(1, -1))}
        </em>
      );
    }

    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });

const renderMarkdownBlock = (
  block: MarkdownBlock,
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'],
) => {
  switch (block.type) {
    case 'heading': {
      const level = Math.min(Math.max(block.level, 1), 6);
      const className = headingStyles[level - 1] ?? headingStyles[2];
      const tagName = `h${level}` as keyof React.JSX.IntrinsicElements;
      return React.createElement(
        tagName,
        { className: `${className} text-github-text-primary` },
        renderInline(block.text),
      );
    }
    case 'paragraph':
      return (
        <p className="text-sm leading-7 text-github-text-primary">{renderInline(block.text)}</p>
      );
    case 'list':
      if (block.ordered) {
        return (
          <ol className="list-decimal pl-6 text-sm text-github-text-primary space-y-1">
            {block.items.map((item, index) => (
              <li key={`ol-${index}`}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="list-disc pl-6 text-sm text-github-text-primary space-y-1">
          {block.items.map((item, index) => (
            <li key={`ul-${index}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'code':
      return (
        <pre className="rounded-md border border-github-border bg-github-bg-secondary p-3 overflow-x-auto text-xs">
          <PrismSyntaxHighlighter
            code={block.content}
            language={block.language}
            syntaxTheme={syntaxTheme}
            className="font-mono text-github-text-primary"
          />
        </pre>
      );
    case 'blockquote':
      return (
        <blockquote className="border-l-4 border-github-border pl-4 text-github-text-muted italic">
          {block.text.split('\n').map((line, index) => (
            <p key={`quote-${index}`}>{renderInline(line)}</p>
          ))}
        </blockquote>
      );
    case 'hr':
      return <hr className="border-github-border" />;
    default:
      return null;
  }
};

const getBlockStyle = (type: PreviewBlockType) => {
  switch (type) {
    case 'add':
      return 'border-l-4 border-diff-addition-border bg-diff-addition-bg/40';
    case 'delete':
      return 'border-l-4 border-diff-deletion-border bg-diff-deletion-bg/40 text-github-danger/90 line-through';
    case 'change':
      return 'border-l-4 border-github-warning bg-github-warning/10';
    default:
      return 'border-l-4 border-transparent';
  }
};

const MarkdownPreview = ({
  blocks,
  syntaxTheme,
}: {
  blocks: PreviewBlock[];
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'];
}) => (
  <div className="space-y-4">
    {blocks.map((block, index) => {
      const markdownBlocks = parseMarkdownBlocks(block.lines.join('\n'));
      if (markdownBlocks.length === 0) {
        return null;
      }
      return (
        <div
          key={`preview-block-${index}`}
          className={`rounded-md px-4 py-3 ${getBlockStyle(block.type)}`}
        >
          <div className="space-y-3">
            {markdownBlocks.map((markdownBlock, blockIndex) => (
              <React.Fragment key={`markdown-block-${index}-${blockIndex}`}>
                {renderMarkdownBlock(markdownBlock, syntaxTheme)}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

export function MarkdownDiffViewer(props: DiffViewerBodyProps) {
  const [mode, setMode] = useState<PreviewMode>('diff');
  const previewBlocks = useMemo(() => buildPreviewBlocks(props.mergedChunks), [props.mergedChunks]);

  return (
    <div className="bg-github-bg-primary">
      <div className="flex items-center justify-between border-b border-github-border px-4 py-3">
        <div className="flex bg-github-bg-tertiary border border-github-border rounded-md p-1">
          <button
            onClick={() => setMode('diff')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
              mode === 'diff' ?
                'bg-github-bg-primary text-github-text-primary shadow-sm'
              : 'text-github-text-secondary hover:text-github-text-primary'
            }`}
          >
            Code Diff
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
              mode === 'preview' ?
                'bg-github-bg-primary text-github-text-primary shadow-sm'
              : 'text-github-text-secondary hover:text-github-text-primary'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {mode === 'diff' ?
        <TextDiffViewer {...props} />
      : <div className="p-4">
          <MarkdownPreview blocks={previewBlocks} syntaxTheme={props.syntaxTheme} />
        </div>
      }
    </div>
  );
}
