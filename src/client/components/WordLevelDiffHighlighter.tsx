import React, { useMemo } from 'react';

import { type DiffSegment } from '../utils/wordLevelDiff';

interface WordLevelDiffHighlighterProps {
  segments: DiffSegment[];
  className?: string;
}

/**
 * Renders code with word-level diff highlighting.
 * Each segment is marked as unchanged, added, or removed with appropriate styling.
 */
export const WordLevelDiffHighlighter = React.memo(function WordLevelDiffHighlighter({
  segments,
  className = '',
}: WordLevelDiffHighlighterProps) {
  const renderedContent = useMemo(() => {
    return segments.map((segment, index) => {
      const diffClass =
        segment.type === 'added'
          ? 'word-diff-added'
          : segment.type === 'removed'
            ? 'word-diff-removed'
            : '';

      return (
        <span key={index} className={diffClass}>
          {segment.value}
        </span>
      );
    });
  }, [segments]);

  return <span className={className}>{renderedContent}</span>;
});
