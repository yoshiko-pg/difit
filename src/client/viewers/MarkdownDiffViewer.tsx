import { Eye, FileDiff } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { DiffLine } from '../../types/diff';
import { PrismSyntaxHighlighter } from '../components/PrismSyntaxHighlighter';
import type { MergedChunk } from '../hooks/useExpandedLines';

import { TextDiffViewer } from './TextDiffViewer';
import type { DiffViewerBodyProps } from './types';

type PreviewMode = 'diff' | 'diff-preview' | 'full-preview';

type PreviewBlockType = 'add' | 'delete' | 'change' | 'context';

type PreviewBlock = {
  type: PreviewBlockType;
  lines: string[];
};

const isFetchableRef = (ref?: string) => Boolean(ref && ref !== 'stdin');

const headingStyles = [
  'text-[26px] font-semibold',
  'text-[22px] font-semibold',
  'text-xl font-semibold',
  'text-lg font-semibold',
  'text-base font-semibold uppercase tracking-wide',
  'text-base font-semibold',
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
    <h1 className={`${headingStyles[0]} mt-6 mb-2 first:mt-0`}>{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className={`${headingStyles[1]} mt-6 mb-2 first:mt-0`}>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className={`${headingStyles[2]} mt-6 mb-2 first:mt-0`}>{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className={`${headingStyles[3]} mt-6 mb-2 first:mt-0`}>{children}</h4>
  ),
  h5: ({ children }: { children?: React.ReactNode }) => (
    <h5 className={`${headingStyles[4]} mt-6 mb-2 first:mt-0`}>{children}</h5>
  ),
  h6: ({ children }: { children?: React.ReactNode }) => (
    <h6 className={`${headingStyles[5]} mt-6 mb-2 first:mt-0`}>{children}</h6>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-base leading-7">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-6 text-base space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-6 text-base space-y-1">{children}</ol>
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
        <pre className="markdown-preview-code border border-github-border bg-github-bg-secondary p-3 overflow-x-auto text-sm">
          {children}
        </pre>
      );
    }

    return (
      <pre className="markdown-preview-code border border-github-border bg-github-bg-secondary p-3 overflow-x-auto text-sm">
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
      <code className="px-1 py-0.5 rounded bg-github-bg-tertiary border border-github-border text-sm font-mono">
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

const isReferenceDefinitionLine = (line: string) => /^\s*\[[^\]]+\]:\s+\S+/.test(line);

const isFootnoteDefinitionLine = (line: string) => /^\s*\[\^[^\]]+\]:\s+/.test(line);

const isHtmlCommentLine = (line: string) => /^\s*<!--.*-->\s*$/.test(line);

const isNonRenderableLine = (line: string) =>
  line.trim() === '' ||
  isReferenceDefinitionLine(line) ||
  isFootnoteDefinitionLine(line) ||
  isHtmlCommentLine(line);

const isPlainPreviewBlock = (lines: string[]) => lines.every(isNonRenderableLine);

const MarkdownDiffPreview = ({
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
        const rawContent = block.lines.join('\n');
        const trimmedContent = rawContent.trim();
        if (!trimmedContent) return null;
        const renderAsPlain = isPlainPreviewBlock(block.lines);
        return (
          <div key={`preview-block-${index}`} className={`px-4 ${getBlockStyle(block.type)}`}>
            {renderAsPlain ?
              <pre className="whitespace-pre-wrap text-sm text-github-text-primary font-mono">
                {trimmedContent}
              </pre>
            : <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) => (isSafeUrl(url) ? url : '')}
                components={components}
              >
                {trimmedContent}
              </ReactMarkdown>
            }
          </div>
        );
      })}
    </div>
  );
};

const MarkdownFullPreview = ({
  content,
  syntaxTheme,
}: {
  content: string;
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'];
}) => {
  const components = useMemo(() => getMarkdownComponents(syntaxTheme), [syntaxTheme]);

  return (
    <div className="space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (isSafeUrl(url) ? url : '')}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export function MarkdownDiffViewer(props: DiffViewerBodyProps) {
  const { file, baseCommitish, targetCommitish, mergedChunks, syntaxTheme } = props;
  const [mode, setMode] = useState<PreviewMode>('diff');
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadedSourceKey, setLoadedSourceKey] = useState<string | null>(null);
  const previewBlocks = useMemo(() => buildPreviewBlocks(mergedChunks), [mergedChunks]);
  const previewSource = useMemo(() => {
    if (!baseCommitish && !targetCommitish) return null;

    if (file.status === 'added') {
      return targetCommitish ? { path: file.path, ref: targetCommitish } : null;
    }

    if (file.status === 'deleted') {
      return baseCommitish ? { path: file.oldPath || file.path, ref: baseCommitish } : null;
    }

    if (targetCommitish) {
      return { path: file.path, ref: targetCommitish };
    }

    return baseCommitish ? { path: file.oldPath || file.path, ref: baseCommitish } : null;
  }, [baseCommitish, targetCommitish, file.path, file.oldPath, file.status]);

  const previewSourceKey = useMemo(
    () => (previewSource ? `${previewSource.ref}:${previewSource.path}` : null),
    [previewSource],
  );

  useEffect(() => {
    if (!previewSource || !previewSourceKey || !isFetchableRef(previewSource.ref)) {
      setFullContent(null);
      setLoadedSourceKey(null);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    let isCanceled = false;

    const fetchContent = async () => {
      if (previewSourceKey !== loadedSourceKey) {
        setFullContent(null);
      }
      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        const encodedPath = encodeURIComponent(previewSource.path);
        const response = await fetch(
          `/api/blob/${encodedPath}?ref=${encodeURIComponent(previewSource.ref)}`,
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch preview: ${response.statusText}`);
        }
        const text = await response.text();
        if (!isCanceled) {
          setFullContent(text);
          setLoadedSourceKey(previewSourceKey);
        }
      } catch (error) {
        if (!isCanceled) {
          setFullContent(null);
          setLoadedSourceKey(null);
          setPreviewError(error instanceof Error ? error.message : 'Failed to load preview');
        }
      } finally {
        if (!isCanceled) {
          setIsPreviewLoading(false);
        }
      }
    };

    if (previewSourceKey !== loadedSourceKey || fullContent === null) {
      void fetchContent();
    }

    return () => {
      isCanceled = true;
    };
  }, [fullContent, loadedSourceKey, previewSource, previewSourceKey]);

  const hasFullPreview = useMemo(
    () => previewSourceKey === loadedSourceKey && fullContent !== null,
    [fullContent, loadedSourceKey, previewSourceKey],
  );

  useEffect(() => {
    if (mode === 'full-preview' && !hasFullPreview) {
      setMode('diff-preview');
    }
  }, [hasFullPreview, mode]);

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
            onClick={() => setMode('diff-preview')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors duration-200 flex items-center gap-1 cursor-pointer ${
              mode === 'diff-preview' ?
                'text-github-text-primary'
              : 'text-github-text-secondary hover:text-github-text-primary'
            }`}
            title="Diff Preview"
          >
            <Eye size={14} />
            Diff Preview
          </button>
          {hasFullPreview && (
            <button
              onClick={() => setMode('full-preview')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors duration-200 flex items-center gap-1 cursor-pointer ${
                mode === 'full-preview' ?
                  'text-github-text-primary'
                : 'text-github-text-secondary hover:text-github-text-primary'
              }`}
              title="Full Preview"
            >
              <Eye size={14} />
              Full Preview
            </button>
          )}
        </div>
      </div>

      {mode === 'diff' && <TextDiffViewer {...props} />}

      {mode === 'diff-preview' && (
        <div className="p-4">
          <MarkdownDiffPreview blocks={previewBlocks} syntaxTheme={syntaxTheme} />
        </div>
      )}

      {mode === 'full-preview' && (
        <div className="p-4">
          {isPreviewLoading && (
            <div className="text-sm text-github-text-muted mb-3">Loading preview...</div>
          )}
          {previewError && <div className="text-sm text-github-danger mb-3">{previewError}</div>}
          {!isPreviewLoading && !previewError && fullContent !== null && (
            <MarkdownFullPreview content={fullContent} syntaxTheme={syntaxTheme} />
          )}
          {!isPreviewLoading && !previewError && fullContent === null && (
            <div className="text-sm text-github-text-muted">Preview unavailable.</div>
          )}
        </div>
      )}
    </div>
  );
}
