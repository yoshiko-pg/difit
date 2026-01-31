import { Eye, FileDiff } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
          className="font-mono text-github-text-primary"
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
});

const getBlockStyle = (type: PreviewBlockType) => {
  switch (type) {
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

const MarkdownPreview = ({
  blocks,
  syntaxTheme,
}: {
  blocks: PreviewBlock[];
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'];
}) => {
  const components = useMemo(() => getMarkdownComponents(syntaxTheme), [syntaxTheme]);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const content = block.lines.join('\n').trim();
        if (!content) return null;
        return (
          <div key={`preview-block-${index}`} className={`px-4 ${getBlockStyle(block.type)}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              urlTransform={(url) => (isSafeUrl(url) ? url : '')}
              components={components}
            >
              {content}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
};

export function MarkdownDiffViewer(props: DiffViewerBodyProps) {
  const [mode, setMode] = useState<PreviewMode>('diff');
  const previewBlocks = useMemo(() => buildPreviewBlocks(props.mergedChunks), [props.mergedChunks]);

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
          <MarkdownPreview blocks={previewBlocks} syntaxTheme={props.syntaxTheme} />
        </div>
      }
    </div>
  );
}
