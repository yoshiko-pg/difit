import { Box, Text } from 'ink';
import React from 'react';

interface StatusBarProps {
  commitish: string;
  totalFiles: number;
  currentMode: 'list' | 'split' | 'unified';
}

const StatusBar: React.FC<StatusBarProps> = ({ commitish, totalFiles, currentMode }) => {
  return (
    <Box borderStyle="round" paddingX={1} marginBottom={1}>
      <Box flexGrow={1}>
        <Text bold color="cyan">
          📋 difit TUI
        </Text>
        <Text> | </Text>
        <Text color="yellow">{commitish}</Text>
        <Text> | </Text>
        <Text>{totalFiles} files changed</Text>
      </Box>
      <Box>
        <Text dimColor>
          [{currentMode === 'list' ? 'File List' : currentMode === 'split' ? 'Split' : 'Unified'}]
        </Text>
      </Box>
    </Box>
  );
};

export default StatusBar;
