import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { DiffLine } from '../../types/diff';
import { FrontmatterTable } from '../components/FrontmatterTable';
import { MermaidDiagram } from '../components/MermaidDiagram';
import { PrismSyntaxHighlighter } from '../components/PrismSyntaxHighlighter';
import type { MergedChunk } from '../hooks/useExpandedLines';
import { extractFrontmatter } from '../utils/frontmatter';
import { extractMarkdownText, isElementWithCodeProps, isSafeUrl } from '../utils/markdownUtils';

import { PreviewModeTabs, type PreviewMode } from './PreviewModeTabs';
import { TextDiffViewer } from './TextDiffViewer';
import type { DiffViewerBodyProps } from './types';

type PreviewBlockType = 'add' | 'delete' | 'change' | 'context';

type PreviewBlock = {
  type: PreviewBlockType;
  lines: string[];
};

type PreviewLineEntry = {
  type: PreviewBlockType;
  content: string;
};

type MarkdownRenderBlock = {
  kind: 'markdown';
  type: PreviewBlockType;
  lines: string[];
};

type FencedCodeRenderBlock = {
  kind: 'fenced-code';
  lines: PreviewLineEntry[];
};

type PreviewRenderBlock = MarkdownRenderBlock | FencedCodeRenderBlock;

type FenceInfo = {
  marker: '`' | '~';
  length: number;
  raw: string;
};

const isFetchableRef = (ref?: string) => Boolean(ref && ref !== 'stdin');

type PreviewSource = { path: string; ref: string } | null;

type PreviewSourcePair = {
  base: PreviewSource;
  target: PreviewSource;
};

type PreviewContents = {
  base: string | null;
  target: string | null;
};

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
    const codeText = extractMarkdownText(codeElement ?? children);
    const match = /language-(\S+)/.exec(codeElement?.props.className ?? '');
    const language = match?.[1];
    const normalizedCodeText = codeText.replace(/\n$/, '');

    if (language === 'mermaid' && normalizedCodeText.trim()) {
      return <MermaidDiagram chart={normalizedCodeText} />;
    }

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
          code={normalizedCodeText}
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
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-github-bg-secondary">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="border-b border-github-border">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left font-semibold border border-github-border">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 border border-github-border">{children}</td>
  ),
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

const isHtmlCommentLine = (line: string) => {
  const trimmedLine = line.trim();
  return (
    trimmedLine.length >= '<!---->'.length &&
    trimmedLine.startsWith('<!--') &&
    trimmedLine.endsWith('-->')
  );
};

const isNonRenderableLine = (line: string) =>
  line.trim() === '' ||
  isReferenceDefinitionLine(line) ||
  isFootnoteDefinitionLine(line) ||
  isHtmlCommentLine(line);

const isPlainPreviewBlock = (lines: string[]) => lines.every(isNonRenderableLine);

const parseFenceStart = (line: string): FenceInfo | null => {
  const match = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
  if (!match) return null;

  const marker = match[1];
  if (!marker) return null;

  return {
    marker: marker[0] as '`' | '~',
    length: marker.length,
    raw: line,
  };
};

const isFenceEnd = (line: string, fence: FenceInfo) => {
  const match = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
  if (!match?.[1]) return false;

  return match[1][0] === fence.marker && match[1].length >= fence.length;
};

const buildRenderBlocks = (blocks: PreviewBlock[]): PreviewRenderBlock[] => {
  const renderBlocks: PreviewRenderBlock[] = [];
  let currentMarkdownBlock: MarkdownRenderBlock | null = null;
  let currentFence: { fence: FenceInfo; lines: PreviewLineEntry[] } | null = null;

  const flushMarkdownBlock = () => {
    if (!currentMarkdownBlock) return;
    renderBlocks.push(currentMarkdownBlock);
    currentMarkdownBlock = null;
  };

  const pushMarkdownLine = (type: PreviewBlockType, line: string) => {
    if (currentMarkdownBlock?.type === type) {
      currentMarkdownBlock.lines.push(line);
      return;
    }

    flushMarkdownBlock();
    currentMarkdownBlock = {
      kind: 'markdown',
      type,
      lines: [line],
    };
  };

  const flushFence = (closingFenceLine?: string) => {
    if (!currentFence) return;

    const hasOnlyContextLines = currentFence.lines.every((line) => line.type === 'context');

    if (closingFenceLine && hasOnlyContextLines) {
      pushMarkdownLine('context', currentFence.fence.raw);
      currentFence.lines.forEach((line) => {
        pushMarkdownLine('context', line.content);
      });
      pushMarkdownLine('context', closingFenceLine);
    } else {
      flushMarkdownBlock();
      renderBlocks.push({
        kind: 'fenced-code',
        lines: currentFence.lines,
      });
    }

    currentFence = null;
  };

  blocks.forEach((block) => {
    block.lines.forEach((line) => {
      if (currentFence) {
        if (isFenceEnd(line, currentFence.fence)) {
          flushFence(line);
          return;
        }

        currentFence.lines.push({ type: block.type, content: line });
        return;
      }

      const fence = parseFenceStart(line);
      if (fence) {
        flushMarkdownBlock();
        currentFence = { fence, lines: [] };
        return;
      }

      pushMarkdownLine(block.type, line);
    });
  });

  flushFence();
  flushMarkdownBlock();

  return renderBlocks;
};

const getCodeLineClass = (type: PreviewBlockType) => {
  switch (type) {
    case 'add':
    case 'change':
      return 'border-l-4 border-diff-addition-border bg-diff-addition-bg';
    case 'delete':
      return 'border-l-4 border-diff-deletion-border bg-diff-deletion-bg';
    default:
      return 'border-l-4 border-transparent';
  }
};

const MarkdownDiffPreview = ({
  blocks,
  syntaxTheme,
}: {
  blocks: PreviewBlock[];
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'];
}) => {
  const components = useMemo(() => getMarkdownComponents(syntaxTheme), [syntaxTheme]);
  const renderBlocks = useMemo(() => buildRenderBlocks(blocks), [blocks]);

  return (
    <div className="space-y-4">
      {renderBlocks.map((block, index) => {
        if (block.kind === 'fenced-code') {
          return (
            <div key={`preview-block-${index}`} className="px-4">
              <div className="markdown-preview-code overflow-x-auto rounded border border-github-border bg-github-bg-secondary text-sm font-mono text-github-text-primary">
                {block.lines.map((line, lineIndex) => (
                  <div
                    key={`preview-code-line-${index}-${lineIndex}`}
                    className={`${getCodeLineClass(line.type)} whitespace-pre px-3 py-1`}
                  >
                    {line.content || ' '}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const rawContent = block.lines.join('\n');
        const trimmedContent = rawContent.trim();
        if (!trimmedContent) return null;
        const renderAsPlain = isPlainPreviewBlock(block.lines);
        return (
          <div key={`preview-block-${index}`} className={`px-4 ${getBlockStyle(block.type)}`}>
            {renderAsPlain ? (
              <pre className="whitespace-pre-wrap text-sm text-github-text-primary font-mono">
                {trimmedContent}
              </pre>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) => (isSafeUrl(url) ? url : '')}
                components={components}
              >
                {trimmedContent}
              </ReactMarkdown>
            )}
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
  const { data: frontmatter, content: body } = useMemo(
    () => extractFrontmatter(content),
    [content],
  );

  return (
    <div className="space-y-4">
      <FrontmatterTable mode="snapshot" data={frontmatter} />
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (isSafeUrl(url) ? url : '')}
        components={components}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
};

export function MarkdownDiffViewer(props: DiffViewerBodyProps) {
  const { file, baseCommitish, targetCommitish, mergedChunks, syntaxTheme } = props;
  const [mode, setMode] = useState<PreviewMode>('diff');
  const [contents, setContents] = useState<PreviewContents>({ base: null, target: null });
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadedSourcesKey, setLoadedSourcesKey] = useState<string | null>(null);
  const previewBlocks = useMemo(() => buildPreviewBlocks(mergedChunks), [mergedChunks]);

  const previewSources = useMemo<PreviewSourcePair>(() => {
    const target: PreviewSource =
      file.status === 'deleted'
        ? null
        : targetCommitish
          ? { path: file.path, ref: targetCommitish }
          : null;

    const base: PreviewSource =
      file.status === 'added'
        ? null
        : baseCommitish
          ? { path: file.oldPath || file.path, ref: baseCommitish }
          : null;

    return { base, target };
  }, [baseCommitish, targetCommitish, file.path, file.oldPath, file.status]);

  const previewSourcesKey = useMemo(() => {
    const baseKey = previewSources.base
      ? `${previewSources.base.ref}:${previewSources.base.path}`
      : '';
    const targetKey = previewSources.target
      ? `${previewSources.target.ref}:${previewSources.target.path}`
      : '';
    if (!baseKey && !targetKey) return null;
    return `${baseKey}|${targetKey}`;
  }, [previewSources]);

  useEffect(() => {
    const baseSource =
      previewSources.base && isFetchableRef(previewSources.base.ref) ? previewSources.base : null;
    const targetSource =
      previewSources.target && isFetchableRef(previewSources.target.ref)
        ? previewSources.target
        : null;

    if (!previewSourcesKey || (!baseSource && !targetSource)) {
      setContents({ base: null, target: null });
      setLoadedSourcesKey(null);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    let isCanceled = false;

    const fetchBlob = async (source: PreviewSource): Promise<string | null> => {
      if (!source) return null;
      const encodedPath = encodeURIComponent(source.path);
      const response = await fetch(
        `/api/blob/${encodedPath}?ref=${encodeURIComponent(source.ref)}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch preview: ${response.statusText}`);
      }
      return response.text();
    };

    const run = async () => {
      if (previewSourcesKey !== loadedSourcesKey) {
        setContents({ base: null, target: null });
      }
      setIsPreviewLoading(true);
      setPreviewError(null);

      const [baseResult, targetResult] = await Promise.allSettled([
        fetchBlob(baseSource),
        fetchBlob(targetSource),
      ]);

      if (isCanceled) return;

      const nextBase = baseResult.status === 'fulfilled' ? baseResult.value : null;
      const nextTarget = targetResult.status === 'fulfilled' ? targetResult.value : null;

      const failures: string[] = [];
      if (baseSource && baseResult.status === 'rejected') {
        failures.push(
          baseResult.reason instanceof Error ? baseResult.reason.message : 'base fetch failed',
        );
      }
      if (targetSource && targetResult.status === 'rejected') {
        failures.push(
          targetResult.reason instanceof Error
            ? targetResult.reason.message
            : 'target fetch failed',
        );
      }

      setContents({ base: nextBase, target: nextTarget });
      setLoadedSourcesKey(previewSourcesKey);

      const baseFailed = baseSource !== null && baseResult.status === 'rejected';
      const targetFailed = targetSource !== null && targetResult.status === 'rejected';
      const allFailed =
        (baseSource ? baseFailed : true) &&
        (targetSource ? targetFailed : true) &&
        failures.length > 0;

      setPreviewError(allFailed ? failures.join('; ') : null);
      setIsPreviewLoading(false);
    };

    if (previewSourcesKey !== loadedSourcesKey || contents.target === null) {
      void run();
    } else {
      setIsPreviewLoading(false);
    }

    return () => {
      isCanceled = true;
    };
  }, [contents.target, loadedSourcesKey, previewSources, previewSourcesKey]);

  const hasFullPreview = useMemo(
    () => previewSourcesKey === loadedSourcesKey && contents.target !== null,
    [contents.target, loadedSourcesKey, previewSourcesKey],
  );

  useEffect(() => {
    if (mode === 'full-preview' && !hasFullPreview) {
      setMode('diff-preview');
    }
  }, [hasFullPreview, mode]);

  return (
    <div className="bg-github-bg-primary">
      <div className="flex items-center justify-between border-b border-github-border px-4 py-2">
        <PreviewModeTabs mode={mode} hasFullPreview={hasFullPreview} onModeChange={setMode} />
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
          {!isPreviewLoading && !previewError && contents.target !== null && (
            <MarkdownFullPreview content={contents.target} syntaxTheme={syntaxTheme} />
          )}
          {!isPreviewLoading && !previewError && contents.target === null && (
            <div className="text-sm text-github-text-muted">Preview unavailable.</div>
          )}
        </div>
      )}
    </div>
  );
}
