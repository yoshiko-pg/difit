import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { type DiffLine, type ExpandedLine } from '../../types/diff';
import { hasSuggestionBlock, parseSuggestionBlocks } from '../../utils/suggestionUtils';
import { extractMarkdownText, isElementWithCodeProps, isSafeUrl } from '../utils/markdownUtils';

import { DiffCodeLine } from './DiffCodeLine';
import { PrismSyntaxHighlighter } from './PrismSyntaxHighlighter';
import type { AppearanceSettings } from './SettingsModal';

type SuggestionPart = {
  type: 'text';
  content: string;
};

type ParsedCommentPart =
  | SuggestionPart
  | {
      type: 'suggestion';
      code: string;
      original?: string;
    };

const getSuggestionLineTypeClass = (type: 'add' | 'delete') =>
  type === 'add' ? 'bg-diff-addition-bg' : 'bg-diff-deletion-bg';

const createSuggestionLine = (
  type: 'add' | 'delete',
  content: string,
): Pick<DiffLine | ExpandedLine, 'type' | 'content'> => ({
  type,
  content,
});

function SuggestionLines({
  code,
  type,
  filename,
  keyPrefix,
  syntaxTheme,
}: {
  code: string;
  type: 'add' | 'delete';
  filename?: string;
  keyPrefix: string;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
}) {
  return (
    <>
      {code.split('\n').map((line, index) => (
        <div key={`${keyPrefix}-${index}`} className={getSuggestionLineTypeClass(type)}>
          <DiffCodeLine
            line={createSuggestionLine(type, line)}
            filename={filename}
            syntaxTheme={syntaxTheme}
            showPrefixBorder={false}
          />
        </div>
      ))}
    </>
  );
}

const getDiffCodeLineClass = (line: string) => {
  if (line.startsWith('+')) return 'bg-diff-addition-bg';
  if (line.startsWith('-')) return 'bg-diff-deletion-bg';
  return '';
};

function CommentDiffCodeBlock({ code }: { code: string }) {
  return (
    <div className="my-2 rounded-md border border-github-border bg-github-bg-secondary overflow-x-auto font-mono text-xs leading-5">
      {code.split('\n').map((line, index) => (
        <div key={index} className={`px-3 whitespace-pre ${getDiffCodeLineClass(line)}`}>
          {line || ' '}
        </div>
      ))}
    </div>
  );
}

const getCommentMarkdownComponents = (syntaxTheme?: AppearanceSettings['syntaxTheme']) => ({
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h4>
  ),
  h5: ({ children }: { children?: React.ReactNode }) => (
    <h5 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h5>
  ),
  h6: ({ children }: { children?: React.ReactNode }) => (
    <h6 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h6>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-2 first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-5 my-2 first:mt-0 last:mb-0 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-5 my-2 first:mt-0 last:mb-0 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-github-border pl-3 my-2 text-github-text-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-github-border" />,
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

    if (language === 'diff' && normalizedCodeText) {
      return <CommentDiffCodeBlock code={normalizedCodeText} />;
    }

    if (!codeText.trim()) {
      return (
        <pre className="my-2 rounded-md border border-github-border bg-github-bg-secondary p-3 overflow-x-auto text-xs leading-5">
          {children}
        </pre>
      );
    }

    return (
      <pre className="my-2 rounded-md border border-github-border bg-github-bg-secondary p-3 overflow-x-auto text-xs leading-5">
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
      <code className="px-1 py-0.5 rounded bg-github-bg-tertiary border border-github-border font-mono text-[85%]">
        {children}
      </code>
    );
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-2 first:mt-0 last:mb-0">
      <table className="border-collapse">{children}</table>
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
    <th className="px-2 py-1 text-left font-semibold border border-github-border">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-2 py-1 border border-github-border">{children}</td>
  ),
});

interface CommentBodyRendererProps {
  body: string;
  originalCode?: string;
  filename?: string;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
}

export function hasSuggestionInBody(body: string) {
  return hasSuggestionBlock(body);
}

export function CommentBodyRenderer({
  body,
  originalCode,
  filename,
  syntaxTheme,
}: CommentBodyRendererProps) {
  const parts = useMemo(() => {
    const suggestions = parseSuggestionBlocks(body);
    if (suggestions.length === 0) {
      return [{ type: 'text' as const, content: body }] as ParsedCommentPart[];
    }

    const result: ParsedCommentPart[] = [];
    let lastIndex = 0;

    for (const suggestion of suggestions) {
      if (suggestion.startIndex > lastIndex) {
        result.push({
          type: 'text',
          content: body.slice(lastIndex, suggestion.startIndex),
        });
      }

      result.push({
        type: 'suggestion',
        code: suggestion.suggestedCode,
        original: originalCode || '',
      });

      lastIndex = suggestion.endIndex;
    }

    if (lastIndex < body.length) {
      result.push({
        type: 'text',
        content: body.slice(lastIndex),
      });
    }

    return result;
  }, [body, originalCode]);

  const markdownComponents = useMemo(
    () => getCommentMarkdownComponents(syntaxTheme),
    [syntaxTheme],
  );

  return (
    <div className="text-github-text-primary text-sm leading-6">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          if (!part.content.trim()) {
            return null;
          }
          return (
            <div key={index}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                urlTransform={(url) => (isSafeUrl(url) ? url : '')}
                components={markdownComponents}
              >
                {part.content}
              </ReactMarkdown>
            </div>
          );
        }

        return (
          <div key={index} className="my-2 border border-github-border rounded-md overflow-hidden">
            <div className="font-mono text-sm">
              {part.original && (
                <SuggestionLines
                  code={part.original}
                  type="delete"
                  filename={filename}
                  keyPrefix={`orig-${index}`}
                  syntaxTheme={syntaxTheme}
                />
              )}
              <SuggestionLines
                code={part.code}
                type="add"
                filename={filename}
                keyPrefix={`sugg-${index}`}
                syntaxTheme={syntaxTheme}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
