import React from 'react';

import { type DiffLine, type ExpandedLine } from '../../types/diff';
import { type DiffSegment } from '../utils/wordLevelDiff';

import { CommentButton } from './CommentButton';
import { DiffCodeLine } from './DiffCodeLine';
import { OpenInEditorButton } from './OpenInEditorButton';
import type { AppearanceSettings } from './SettingsModal';

interface DiffLineRowProps {
  line: DiffLine | ExpandedLine;
  index: number;
  lineId?: string;
  isCurrentLine?: boolean;
  hoveredLineIndex: number | null;
  selectedLineStyle: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseMove: () => void;
  onCommentButtonMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onCommentButtonMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenInEditor?: () => void;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
  onClick?: () => void;
  filename?: string;
  diffSegments?: DiffSegment[];
  measureRef?: (node: HTMLTableRowElement | null) => void;
}

const getLineClass = (line: DiffLine | ExpandedLine) => {
  // Expanded lines have a subtle different background
  if ('isExpanded' in line && line.isExpanded) {
    return 'bg-github-bg-tertiary/80';
  }
  switch (line.type) {
    case 'add':
      return 'bg-diff-addition-bg';
    case 'delete':
      return 'bg-diff-deletion-bg';
    default:
      return 'bg-transparent';
  }
};

export const DiffLineRow: React.FC<DiffLineRowProps> = React.memo(
  ({
    line,
    index,
    lineId,
    isCurrentLine = false,
    hoveredLineIndex,
    selectedLineStyle,
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
    onCommentButtonMouseDown,
    onCommentButtonMouseUp,
    onOpenInEditor,
    syntaxTheme,
    onClick,
    filename,
    diffSegments,
    measureRef,
  }) => {
    const lineNumber = line.newLineNumber || line.oldLineNumber;
    const showLineActions = hoveredLineIndex === index && lineNumber;

    const highlightClass = isCurrentLine ? 'keyboard-cursor' : '';

    return (
      <tr
        ref={measureRef}
        id={lineId}
        className={`group ${getLineClass(line)} relative ${selectedLineStyle} ${highlightClass} cursor-pointer`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        onClick={onClick}
      >
        <td className="w-[var(--line-number-width)] min-w-[var(--line-number-width)] max-w-[var(--line-number-width)] px-2 text-right text-github-text-muted bg-github-bg-secondary border-r border-github-border select-none align-top relative">
          {line.oldLineNumber || ''}
        </td>
        <td className="w-[var(--line-number-width)] min-w-[var(--line-number-width)] max-w-[var(--line-number-width)] px-2 text-right text-github-text-muted bg-github-bg-secondary border-r border-github-border select-none align-top relative overflow-visible">
          <span>{line.newLineNumber || ''}</span>
          {showLineActions && (
            <>
              {onOpenInEditor && <OpenInEditorButton onClick={onOpenInEditor} />}
              <CommentButton
                onMouseDown={onCommentButtonMouseDown}
                onMouseUp={onCommentButtonMouseUp}
              />
            </>
          )}
        </td>
        <td className="p-0 w-full relative align-top">
          <DiffCodeLine
            line={line}
            syntaxTheme={syntaxTheme}
            filename={filename}
            diffSegments={diffSegments}
          />
        </td>
      </tr>
    );
  },
);

DiffLineRow.displayName = 'DiffLineRow';
