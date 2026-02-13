import { type DiffLine, type ExpandedLine } from '../../types/diff';
import { type DiffSegment } from '../utils/wordLevelDiff';

import { EnhancedPrismSyntaxHighlighter } from './EnhancedPrismSyntaxHighlighter';
import type { AppearanceSettings } from './SettingsModal';
import { WordLevelDiffHighlighter } from './WordLevelDiffHighlighter';

interface DiffCodeLineProps {
  line: Pick<DiffLine | ExpandedLine, 'type' | 'content'>;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
  filename?: string;
  diffSegments?: DiffSegment[];
  showPrefixBorder?: boolean;
}

const getLinePrefix = (type: DiffLine['type']) => {
  switch (type) {
    case 'add':
      return '+';
    case 'delete':
      return '-';
    default:
      return ' ';
  }
};

const getPrefixClass = (type: DiffLine['type']) => {
  switch (type) {
    case 'add':
      return 'text-github-accent bg-diff-addition-bg';
    case 'delete':
      return 'text-github-danger bg-diff-deletion-bg';
    default:
      return 'text-github-text-muted bg-github-bg-secondary';
  }
};

export function DiffCodeLine({
  line,
  syntaxTheme,
  filename,
  diffSegments,
  showPrefixBorder = true,
}: DiffCodeLineProps) {
  return (
    <div className="flex items-center relative min-h-[16px]">
      <span
        className={`w-5 text-center flex-shrink-0 ${showPrefixBorder ? 'border-r border-github-border' : ''} ${getPrefixClass(
          line.type,
        )}`}
      >
        {getLinePrefix(line.type)}
      </span>
      {diffSegments ?
        <WordLevelDiffHighlighter
          segments={diffSegments}
          className="flex-1 px-3 text-github-text-primary whitespace-pre-wrap break-all overflow-wrap-break-word select-text"
        />
      : <EnhancedPrismSyntaxHighlighter
          code={line.content}
          className="flex-1 px-3 text-github-text-primary whitespace-pre-wrap break-all overflow-wrap-break-word select-text [&_pre]:m-0 [&_pre]:p-0 [&_pre]:!bg-transparent [&_pre]:font-inherit [&_pre]:text-inherit [&_pre]:leading-inherit [&_code]:!bg-transparent [&_code]:font-inherit [&_code]:text-inherit [&_code]:leading-inherit"
          syntaxTheme={syntaxTheme}
          filename={filename}
        />
      }
    </div>
  );
}
