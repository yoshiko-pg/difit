import React from 'react';
import type { ExtraProps } from 'react-markdown';

import { MermaidDiagram } from '../components/MermaidDiagram';
import { PrismSyntaxHighlighter } from '../components/PrismSyntaxHighlighter';
import { extractMarkdownText, isElementWithCodeProps, isSafeUrl } from '../utils/markdownUtils';

import type { DiffViewerBodyProps } from './types';

const headingStyles = [
  'text-[26px] font-semibold',
  'text-[22px] font-semibold',
  'text-xl font-semibold',
  'text-lg font-semibold',
  'text-base font-semibold uppercase tracking-wide',
  'text-base font-semibold',
];

type MarkdownNode = ExtraProps['node'];
type MarkdownElementProps = { children?: React.ReactNode } & ExtraProps;

type SourceLineAttributes = {
  'data-md-line-start'?: number;
  'data-md-line-end'?: number;
};

const sourceLineAttributes = (
  node: MarkdownNode,
  sourceLineOffset: number | undefined,
): SourceLineAttributes => {
  if (sourceLineOffset === undefined || !node?.position) return {};
  return {
    'data-md-line-start': node.position.start.line + sourceLineOffset,
    'data-md-line-end': node.position.end.line + sourceLineOffset,
  };
};

/**
 * Element renderers shared by the markdown previews. When `sourceLineOffset` is given,
 * block-level elements carry `data-md-line-start` / `data-md-line-end` with file line
 * numbers, which the split preview uses to anchor comments.
 */
export const getMarkdownComponents = (
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'],
  sourceLineOffset?: number,
) => {
  const lines = (node: MarkdownNode) => sourceLineAttributes(node, sourceLineOffset);
  const heading =
    (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', level: number) =>
    ({ children, node }: MarkdownElementProps) => (
      <Tag className={`${headingStyles[level]} mt-6 mb-2 first:mt-0`} {...lines(node)}>
        {children}
      </Tag>
    );

  return {
    h1: heading('h1', 0),
    h2: heading('h2', 1),
    h3: heading('h3', 2),
    h4: heading('h4', 3),
    h5: heading('h5', 4),
    h6: heading('h6', 5),
    p: ({ children, node }: MarkdownElementProps) => (
      <p className="text-base leading-7" {...lines(node)}>
        {children}
      </p>
    ),
    ul: ({ children }: MarkdownElementProps) => (
      <ul className="list-disc pl-6 text-base space-y-1">{children}</ul>
    ),
    ol: ({ children, start }: MarkdownElementProps & { start?: number }) => (
      <ol className="list-decimal pl-6 text-base space-y-1" start={start}>
        {children}
      </ol>
    ),
    li: ({ children, node }: MarkdownElementProps) => <li {...lines(node)}>{children}</li>,
    blockquote: ({ children, node }: MarkdownElementProps) => (
      <blockquote
        className="border-l-4 border-github-border pl-4 text-github-text-muted italic"
        {...lines(node)}
      >
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
    pre: ({ children, node }: MarkdownElementProps) => {
      const nodes = Array.isArray(children) ? children : [children];
      const codeElement = nodes.find(isElementWithCodeProps);
      const codeText = extractMarkdownText(codeElement ?? children);
      const match = /language-(\S+)/.exec(codeElement?.props.className ?? '');
      const language = match?.[1];
      const normalizedCodeText = codeText.replace(/\n$/, '');

      if (language === 'mermaid' && normalizedCodeText.trim()) {
        return (
          <div {...lines(node)}>
            <MermaidDiagram chart={normalizedCodeText} />
          </div>
        );
      }

      if (!codeText.trim()) {
        return (
          <pre
            className="markdown-preview-code border border-github-border bg-github-bg-secondary p-3 overflow-x-auto text-sm"
            {...lines(node)}
          >
            {children}
          </pre>
        );
      }

      return (
        <pre
          className="markdown-preview-code border border-github-border bg-github-bg-secondary p-3 overflow-x-auto text-sm"
          {...lines(node)}
        >
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
    table: ({ children, node }: MarkdownElementProps) => (
      <div className="overflow-x-auto" {...lines(node)}>
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }: MarkdownElementProps) => (
      <thead className="bg-github-bg-secondary">{children}</thead>
    ),
    tbody: ({ children }: MarkdownElementProps) => <tbody>{children}</tbody>,
    tr: ({ children, node }: MarkdownElementProps) => (
      <tr className="border-b border-github-border" {...lines(node)}>
        {children}
      </tr>
    ),
    th: ({ children }: MarkdownElementProps) => (
      <th className="px-3 py-2 text-left font-semibold border border-github-border">{children}</th>
    ),
    td: ({ children }: MarkdownElementProps) => (
      <td className="px-3 py-2 border border-github-border">{children}</td>
    ),
  };
};
