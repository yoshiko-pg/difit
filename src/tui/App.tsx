import { Box, Text, useApp, useInput } from 'ink';
import React, { useState, useEffect } from 'react';

import { loadGitDiff } from '../server/git-diff-tui.js';
import { type FileDiff } from '../types/diff.js';

import DiffViewer from './components/DiffViewer.js';
import FileList from './components/FileList.js';
import SideBySideDiffViewer from './components/SideBySideDiffViewer.js';
import StatusBar from './components/StatusBar.js';

interface AppProps {
  targetCommitish: string;
  baseCommitish: string;
  mode?: string;
  repoPath?: string;
}

const App: React.FC<AppProps> = ({ targetCommitish, baseCommitish, mode, repoPath }) => {
  const [files, setFiles] = useState<FileDiff[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'inline' | 'side-by-side'>(
    mode === 'inline' ? 'inline' : 'side-by-side'
  );
  const { exit } = useApp();

  const loadDiff = async () => {
    setLoading(true);
    setError(null);
    try {
      const fileDiffs = await loadGitDiff(targetCommitish, baseCommitish, repoPath);
      setFiles(fileDiffs);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDiff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCommitish, baseCommitish]);

  useInput(
    (input, key) => {
      if (input === 'q' || (key.ctrl && input === 'c')) {
        exit();
      }

      // Reload on 'r' key
      if (input === 'r') {
        void loadDiff();
        return;
      }

      if (viewMode === 'list') {
        if (key.upArrow || input === 'k') {
          setSelectedFileIndex((prev) => Math.max(0, prev - 1));
        }
        if (key.downArrow || input === 'j') {
          setSelectedFileIndex((prev) => Math.min(files.length - 1, prev + 1));
        }
        if (key.return || input === ' ') {
          setViewMode('side-by-side');
        }
        if (input === 'd') {
          setViewMode('inline');
        }
      } else if (key.escape || input === 'b') {
        setViewMode('list');
      }
    },
    { isActive: true }
  );

  if (loading) {
    return <Text>Loading diff for {targetCommitish}...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (files.length === 0) {
    return (
      <Box flexDirection="column">
        <StatusBar commitish={targetCommitish} totalFiles={0} currentMode="list" />
        <Box marginTop={1}>
          <Text color="yellow">No changes found for {targetCommitish}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press &apos;q&apos; to quit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      <StatusBar commitish={targetCommitish} totalFiles={files.length} currentMode={viewMode} />
      <Box flexGrow={1} flexDirection="column">
        {viewMode === 'list' ?
          <FileList files={files} selectedIndex={selectedFileIndex} />
        : viewMode === 'side-by-side' ?
          <SideBySideDiffViewer
            files={files}
            initialFileIndex={selectedFileIndex}
            onBack={() => setViewMode('list')}
          />
        : <DiffViewer files={files} initialFileIndex={selectedFileIndex} />}
      </Box>
      <Box borderStyle="single" paddingX={1}>
        <Text dimColor>
          {viewMode === 'list' ?
            '↑/↓ or j/k: navigate | Enter/Space: side-by-side | d: inline diff | r: reload | q: quit'
          : viewMode === 'side-by-side' ?
            'Tab: next file | Shift+Tab: prev | ↑/↓ or j/k: scroll | ESC/b: list | r: reload | q: quit'
          : 'Tab: next | Shift+Tab: prev | ↑/↓ or j/k: scroll | ESC/b: list | r: reload | q: quit'}
        </Text>
      </Box>
    </Box>
  );
};

export default App;
