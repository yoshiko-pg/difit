import { useMemo } from 'react';

import { type DiffLine, type ExpandedLine } from '../../types/diff';
import { hasSuggestionBlock, parseSuggestionBlocks } from '../../utils/suggestionUtils';

import { DiffCodeLine } from './DiffCodeLine';
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

  return (
    <div className="text-github-text-primary text-sm leading-6">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <span key={index} className="whitespace-pre-wrap">
              {part.content}
            </span>
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
