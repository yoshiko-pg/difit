import { Box, Text, useInput, useApp } from 'ink';
import React, { useState } from 'react';

import { type FileDiff } from '../../types/diff.js';

interface DiffViewerProps {
  files: FileDiff[];
  initialFileIndex: number;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ files, initialFileIndex }) => {
  const [currentFileIndex, setCurrentFileIndex] = useState(initialFileIndex);
  const [scrollOffset, setScrollOffset] = useState(0);

  const file = files[currentFileIndex];
  const lines = file.diff.split('\n');
  const viewportHeight = Math.max(10, (process.stdout.rows || 24) - 7); // StatusBar(3) + footer(3) + margin(1)
  const maxScroll = Math.max(0, lines.length - viewportHeight);
  const { exit } = useApp();

  useInput(
    (input, key) => {
      if (input === 'q' || (key.ctrl && input === 'c')) {
        exit();
        return;
      }
      if (key.upArrow || input === 'k') {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === 'j') {
        setScrollOffset((prev) => Math.min(maxScroll, prev + 1));
      }
      if (key.pageUp) {
        setScrollOffset((prev) => Math.max(0, prev - viewportHeight));
      }
      if (key.pageDown) {
        setScrollOffset((prev) => Math.min(maxScroll, prev + viewportHeight));
      }

      // Navigate between files
      if (key.tab && !key.shift) {
        // Next file (loop to first when at end)
        setCurrentFileIndex((currentFileIndex + 1) % files.length);
        setScrollOffset(0);
      }
      if (key.tab && key.shift) {
        // Previous file (loop to last when at start)
        setCurrentFileIndex((currentFileIndex - 1 + files.length) % files.length);
        setScrollOffset(0);
      }
    },
    { isActive: true },
  );

  const visibleLines = lines.slice(scrollOffset, scrollOffset + viewportHeight);

  const getLineColor = (line: string) => {
    if (line.startsWith('+') && !line.startsWith('+++')) return 'green';
    if (line.startsWith('-') && !line.startsWith('---')) return 'red';
    if (line.startsWith('@@')) return 'cyan';
    if (line.startsWith('diff --git')) return 'yellow';
    return undefined;
  };

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold>
            {file.path} ({currentFileIndex + 1}/{files.length})
          </Text>
          <Text dimColor>
            {' '}
            - {file.additions} additions, {file.deletions} deletions
          </Text>
        </Box>
        <Box>
          <Text dimColor>
            {currentFileIndex > 0 && `← ${files[currentFileIndex - 1].path}`}
            {currentFileIndex > 0 && currentFileIndex < files.length - 1 && ' | '}
            {currentFileIndex < files.length - 1 && `${files[currentFileIndex + 1].path} →`}
          </Text>
        </Box>
      </Box>
      <Box flexGrow={1} flexDirection="column" borderStyle="single" paddingX={1}>
        {visibleLines.map((line, index) => (
          <Text key={`line-${scrollOffset + index}`} color={getLineColor(line)}>
            {line || ' '}
          </Text>
        ))}
      </Box>
      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>
          Lines {scrollOffset + 1}-{Math.min(scrollOffset + viewportHeight, lines.length)} of{' '}
          {lines.length}
          {scrollOffset + viewportHeight < lines.length &&
            ` (${lines.length - scrollOffset - viewportHeight} more)`}
        </Text>
        <Text dimColor>Tab: next file | Shift+Tab: prev file</Text>
      </Box>
    </Box>
  );
};

export default DiffViewer;
