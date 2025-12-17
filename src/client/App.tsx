import { Columns, AlignLeft, Settings, PanelLeftClose, PanelLeft, Keyboard } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';

import {
  type DiffResponse,
  type DiffViewMode,
  type DiffSide,
  type LineNumber,
  type Comment,
} from '../types/diff';

import { Checkbox } from './components/Checkbox';
import { CommentsDropdown } from './components/CommentsDropdown';
import { CommentsListModal } from './components/CommentsListModal';
import { DiffViewer } from './components/DiffViewer';
import { FileList } from './components/FileList';
import { GitHubIcon } from './components/GitHubIcon';
import { HelpModal } from './components/HelpModal';
import { Logo } from './components/Logo';
import { ReloadButton } from './components/ReloadButton';
import { SettingsModal } from './components/SettingsModal';
import { SparkleAnimation } from './components/SparkleAnimation';
import { WordHighlightProvider } from './contexts/WordHighlightContext';
import { useAppearanceSettings } from './hooks/useAppearanceSettings';
import { useDiffComments } from './hooks/useDiffComments';
import { useFileWatch } from './hooks/useFileWatch';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useViewedFiles } from './hooks/useViewedFiles';
import { getFileElementId } from './utils/domUtils';
import { findCommentPosition } from './utils/navigation/positionHelpers';

function App() {
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [diffMode, setDiffMode] = useState<DiffViewMode>('side-by-side');
  const hasUserSetDiffModeRef = useRef(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopiedAll, setIsCopiedAll] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320); // 320px default width
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [hasTriggeredSparkles, setHasTriggeredSparkles] = useState(false);
  const [isCommentsListOpen, setIsCommentsListOpen] = useState(false);

  const { settings, updateSettings } = useAppearanceSettings();

  // New diff-aware comment system
  const {
    comments,
    addComment,
    removeComment,
    updateComment,
    clearAllComments,
    generatePrompt,
    generateAllCommentsPrompt,
  } = useDiffComments(
    diffData?.baseCommitish,
    diffData?.targetCommitish,
    diffData?.commit, // Using commit as currentCommitHash
    undefined // branchToHash map - could be populated from server data
  );

  // Viewed files management
  const { viewedFiles, toggleFileViewed, clearViewedFiles } = useViewedFiles(
    diffData?.baseCommitish,
    diffData?.targetCommitish,
    diffData?.commit,
    undefined,
    diffData?.files
  );

  const toggleFileReviewed = async (filePath: string) => {
    if (diffData) {
      const file = diffData.files.find((f) => f.path === filePath);
      if (file) {
        await toggleFileViewed(filePath, file);

        // When marking as reviewed (closing file), scroll to the file header
        if (!viewedFiles.has(filePath)) {
          setTimeout(() => {
            const element = document.getElementById(getFileElementId(filePath));
            if (element) {
              element.scrollIntoView({ behavior: 'instant', block: 'start' });
            }
          }, 100);
        }
      }
    }
  };

  const handleDiffModeChange = useCallback((mode: DiffViewMode) => {
    hasUserSetDiffModeRef.current = true;
    setDiffMode(mode);
  }, []);

  // State to trigger comment creation from keyboard
  const [commentTrigger, setCommentTrigger] = useState<{
    fileIndex: number;
    chunkIndex: number;
    lineIndex: number;
  } | null>(null);

  // File watch for reload functionality - initialize with callback
  const { shouldReload, reload, watchState } = useFileWatch(async () => {
    await fetchDiffData();
  });

  const { cursor, isHelpOpen, setIsHelpOpen, setCursorPosition } = useKeyboardNavigation({
    files: diffData?.files || [],
    comments: comments.map((c) => ({
      id: c.id,
      file: c.filePath,
      line:
        typeof c.position.line === 'number' ?
          c.position.line
        : [c.position.line.start, c.position.line.end],
      body: c.body,
      timestamp: c.createdAt,
      codeContent: c.codeSnapshot?.content,
    })),
    viewMode: diffMode,
    reviewedFiles: viewedFiles,
    onToggleReviewed: toggleFileReviewed,
    onCreateComment: () => {
      if (cursor) {
        setCommentTrigger({
          fileIndex: cursor.fileIndex,
          chunkIndex: cursor.chunkIndex,
          lineIndex: cursor.lineIndex,
        });
      }
    },
    onCopyAllComments: () => {
      if (comments.length > 0) {
        void handleCopyAllComments();
      }
    },
    onDeleteAllComments: () => {
      if (comments.length > 0 && confirm('Delete all comments?')) {
        clearAllComments();
      }
    },
    onShowCommentsList: () => {
      setIsCommentsListOpen(true);
    },
    onRefresh: () => {
      reload();
    },
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, startWidth + (e.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const fetchDiffData = useCallback(async () => {
    try {
      const response = await fetch(`/api/diff?ignoreWhitespace=${ignoreWhitespace}`);
      if (!response.ok) throw new Error('Failed to fetch diff data');
      const data = (await response.json()) as DiffResponse;
      setDiffData(data);

      // Set diff mode from server response if provided
      if (data.mode && !hasUserSetDiffModeRef.current) {
        setDiffMode(data.mode);
      }

      // Lock files are now automatically marked as viewed by useViewedFiles hook
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [ignoreWhitespace]);

  useEffect(() => {
    void fetchDiffData();
  }, [fetchDiffData]);

  // Clear comments and viewed files on initial load if requested via CLI flag
  const hasCleanedRef = useRef(false);
  useEffect(() => {
    if (diffData?.clearComments && !hasCleanedRef.current) {
      hasCleanedRef.current = true;
      clearAllComments();
      clearViewedFiles();
      console.log(
        '✅ All existing comments and viewed files cleared as requested via --clean flag'
      );
    }
  }, [diffData?.clearComments, clearAllComments, clearViewedFiles]);

  // Trigger sparkle animation when all files are viewed
  useEffect(() => {
    if (diffData) {
      // Reset the trigger flag when not all files are viewed
      if (viewedFiles.size < diffData.files.length) {
        setHasTriggeredSparkles(false);
      }
      // Show sparkles when all files are viewed and not already triggered
      else if (viewedFiles.size === diffData.files.length && !hasTriggeredSparkles) {
        setShowSparkles(true);
        setHasTriggeredSparkles(true);
        // Hide sparkles after animation completes
        setTimeout(() => {
          setShowSparkles(false);
        }, 1000);
      }
    }
  }, [viewedFiles.size, diffData, hasTriggeredSparkles]);

  // Send comments to server whenever they change and before page unload
  useEffect(() => {
    // Sync comments whenever they change
    if (comments.length > 0) {
      // Transform DiffComment to Comment format for server
      const transformedComments = comments.map((c) => ({
        id: c.id,
        file: c.filePath,
        line:
          typeof c.position.line === 'number' ?
            c.position.line
          : [c.position.line.start, c.position.line.end],
        body: c.body,
        timestamp: c.createdAt,
        side: c.position.side,
      }));
      const data = JSON.stringify({ comments: transformedComments });
      fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }).catch((error) => {
        console.error('Failed to sync comments:', error);
      });
    }

    // Also handle page unload
    const sendCommentsBeforeUnload = () => {
      if (comments.length > 0) {
        // Transform DiffComment to Comment format for server
        const transformedComments = comments.map((c) => ({
          id: c.id,
          file: c.filePath,
          line:
            typeof c.position.line === 'number' ?
              c.position.line
            : [c.position.line.start, c.position.line.end],
          body: c.body,
          timestamp: c.createdAt,
          side: c.position.side,
        }));
        // Use sendBeacon for reliable delivery during page unload
        const data = JSON.stringify({ comments: transformedComments });
        navigator.sendBeacon('/api/comments', data);
      }
    };

    window.addEventListener('beforeunload', sendCommentsBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', sendCommentsBeforeUnload);
    };
  }, [comments]);

  // Establish SSE connection for tab close detection
  useEffect(() => {
    const eventSource = new EventSource('/api/heartbeat');

    eventSource.onopen = () => {
      console.log('Connected to server heartbeat');
    };

    eventSource.onerror = () => {
      console.log('Server connection lost');
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, []);

  const handleAddComment = (
    file: string,
    line: LineNumber,
    body: string,
    codeContent?: string,
    chunkHeader?: string,
    side?: DiffSide
  ): Promise<void> => {
    addComment({
      filePath: file,
      body,
      side: side || 'new',
      line: typeof line === 'number' ? line : { start: line[0], end: line[1] },
      chunkHeader: chunkHeader || '',
      codeSnapshot:
        codeContent ?
          {
            content: codeContent,
            language: undefined,
          }
        : undefined,
    });
    return Promise.resolve();
  };

  const handleCopyAllComments = async () => {
    try {
      const prompt = generateAllCommentsPrompt();
      await navigator.clipboard.writeText(prompt);
      setIsCopiedAll(true);
      setTimeout(() => setIsCopiedAll(false), 2000);
    } catch (error) {
      console.error('Failed to copy all comments prompt:', error);
    }
  };

  const handleNavigateToComment = (comment: Comment) => {
    if (!diffData) return;

    const position = findCommentPosition(comment, diffData.files);
    if (position) {
      setCursorPosition(position);
    }
  };

  const handleGlobalClick = (e: React.MouseEvent) => {
    // Clear cursor position
    setCursorPosition(null);

    // Check if clicking on a comment button
    const target = e.target as HTMLElement;
    const isCommentButton = target.closest('[data-comment-button="true"]');

    // Close empty comment forms (unless clicking on a comment button)
    if (!isCommentButton) {
      closeEmptyCommentForms(e);
    }
  };

  const closeEmptyCommentForms = (e: React.MouseEvent) => {
    const emptyForms = document.querySelectorAll('form[data-empty="true"]');
    emptyForms.forEach((form) => {
      // Don't close if clicking inside the form itself
      if (!form.contains(e.target as Node)) {
        const cancelButton = form.querySelector('button[type="button"]') as HTMLButtonElement;
        cancelButton?.click();
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-github-bg-primary">
        <div className="text-github-text-secondary text-base">Loading diff...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-github-bg-primary text-center gap-2">
        <h2 className="text-github-danger text-2xl mb-2">Error</h2>
        <p className="text-github-text-secondary text-base">{error}</p>
      </div>
    );
  }

  if (!diffData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-github-bg-primary text-center gap-2">
        <h2 className="text-github-danger text-2xl mb-2">No data</h2>
        <p className="text-github-text-secondary text-base">No diff data available</p>
      </div>
    );
  }

  return (
    <WordHighlightProvider>
      <div className="h-screen flex flex-col" onClickCapture={handleGlobalClick}>
        <header className="bg-github-bg-secondary border-b border-github-border flex items-center">
          <div
            className={`px-4 py-3 flex items-center justify-between gap-4 ${!isDragging ? '!transition-all !duration-300 !ease-in-out' : ''}`}
            style={{
              width: isFileTreeOpen ? `${sidebarWidth}px` : 'auto',
              minWidth: isFileTreeOpen ? '200px' : 'auto',
              maxWidth: isFileTreeOpen ? '600px' : 'auto',
            }}
          >
            <h1>
              <Logo style={{ height: '18px', color: 'var(--color-github-text-secondary)' }} />
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsFileTreeOpen(!isFileTreeOpen)}
                className="p-2 text-github-text-secondary hover:text-github-text-primary hover:bg-github-bg-tertiary rounded transition-colors"
                title={isFileTreeOpen ? 'Collapse file tree' : 'Expand file tree'}
                aria-expanded={isFileTreeOpen}
                aria-controls="file-tree-panel"
                aria-label="Toggle file tree panel"
              >
                {isFileTreeOpen ?
                  <PanelLeftClose size={18} />
                : <PanelLeft size={18} />}
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-github-text-secondary hover:text-github-text-primary hover:bg-github-bg-tertiary rounded transition-colors"
                title="Appearance Settings"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
          <div
            className={`border-r border-github-border ${!isDragging ? '!transition-all !duration-300 !ease-in-out' : ''}`}
            style={{
              width: isFileTreeOpen ? '4px' : '0px',
              height: 'calc(100% - 16px)',
              margin: '8px 0',
              transform: 'translateX(-2px)',
            }}
          />
          <div className="flex-1 px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex bg-github-bg-tertiary border border-github-border rounded-md p-1">
                <button
                  onClick={() => handleDiffModeChange('side-by-side')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                    diffMode === 'side-by-side' ?
                      'bg-github-bg-primary text-github-text-primary shadow-sm'
                    : 'text-github-text-secondary hover:text-github-text-primary'
                  }`}
                >
                  <Columns size={14} />
                  Side by Side
                </button>
                <button
                  onClick={() => handleDiffModeChange('inline')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                    diffMode === 'inline' ?
                      'bg-github-bg-primary text-github-text-primary shadow-sm'
                    : 'text-github-text-secondary hover:text-github-text-primary'
                  }`}
                >
                  <AlignLeft size={14} />
                  Inline
                </button>
              </div>
              <Checkbox
                checked={ignoreWhitespace}
                onChange={setIgnoreWhitespace}
                label="Ignore Whitespace"
                title={ignoreWhitespace ? 'Show whitespace changes' : 'Ignore whitespace changes'}
              />
              {/* File Watch Reload Button */}
              <ReloadButton
                shouldReload={shouldReload}
                isReloading={watchState.isReloading}
                onReload={reload}
                changeType={watchState.lastChangeType}
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-github-text-secondary">
              {comments.length > 0 && (
                <CommentsDropdown
                  commentsCount={comments.length}
                  isCopiedAll={isCopiedAll}
                  onCopyAll={handleCopyAllComments}
                  onDeleteAll={clearAllComments}
                  onViewAll={() => setIsCommentsListOpen(true)}
                />
              )}
              <div className="flex flex-col gap-1 items-center">
                <div className="text-xs relative">
                  {viewedFiles.size === diffData.files.length ?
                    'All diffs difit-ed!'
                  : `${viewedFiles.size} / ${diffData.files.length} files viewed`}
                  <SparkleAnimation isActive={showSparkles} />
                </div>
                <div
                  className="relative h-2 bg-github-bg-tertiary rounded-full overflow-hidden"
                  style={{
                    width: '90px',
                    border: '1px solid var(--color-github-border)',
                  }}
                >
                  <div
                    className="absolute top-0 right-0 h-full transition-all duration-300 ease-out"
                    style={{
                      width: `${((diffData.files.length - viewedFiles.size) / diffData.files.length) * 100}%`,
                      backgroundColor: (() => {
                        const remainingPercent =
                          ((diffData.files.length - viewedFiles.size) / diffData.files.length) *
                          100;
                        if (remainingPercent > 50) return 'var(--color-github-accent)'; // green
                        if (remainingPercent > 20) return 'var(--color-github-warning)'; // yellow
                        return 'var(--color-github-danger)'; // red
                      })(),
                    }}
                  />
                </div>
              </div>
              <span>
                Reviewing:{' '}
                <code className="bg-github-bg-tertiary px-1.5 py-0.5 rounded text-xs text-github-text-primary">
                  {diffData.commit.includes('...') ?
                    <>
                      <span className="text-github-text-secondary font-medium">
                        {diffData.commit.split('...')[0]}...
                      </span>
                      <span className="font-medium">{diffData.commit.split('...')[1]}</span>
                    </>
                  : diffData.commit}
                </code>
              </span>
              <span>
                {diffData.files.length} file
                {diffData.files.length !== 1 ? 's' : ''} changed
              </span>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div
            className={`relative overflow-hidden ${!isDragging ? '!transition-all !duration-300 !ease-in-out' : ''}`}
            style={{
              width: isFileTreeOpen ? `${sidebarWidth}px` : '0px',
            }}
          >
            <aside
              id="file-tree-panel"
              className="bg-github-bg-secondary border-r border-github-border overflow-y-auto flex flex-col"
              style={{
                width: `${sidebarWidth}px`,
                minWidth: '200px',
                maxWidth: '600px',
                height: '100%',
              }}
            >
              <div className="flex-1 overflow-y-auto">
                <FileList
                  files={diffData.files}
                  onScrollToFile={(filePath) => {
                    const element = document.getElementById(getFileElementId(filePath));
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  comments={comments.map((c) => ({
                    id: c.id,
                    file: c.filePath,
                    line:
                      typeof c.position.line === 'number' ?
                        c.position.line
                      : [c.position.line.start, c.position.line.end],
                    body: c.body,
                    timestamp: c.createdAt,
                    codeContent: c.codeSnapshot?.content,
                  }))}
                  reviewedFiles={viewedFiles}
                  onToggleReviewed={toggleFileReviewed}
                  selectedFileIndex={cursor?.fileIndex ?? null}
                />
              </div>
              <div className="p-4 border-t border-github-border flex justify-between items-center">
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="flex items-center gap-1.5 text-github-text-secondary hover:text-github-text-primary transition-colors"
                  title="Keyboard shortcuts (Shift+?)"
                >
                  <Keyboard size={16} />
                  <span className="text-sm">Shortcuts</span>
                </button>
                <a
                  href="https://github.com/yoshiko-pg/difit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-github-text-secondary hover:text-github-text-primary transition-colors"
                  title="View on GitHub"
                >
                  <span className="text-sm">Star on GitHub</span>
                  <GitHubIcon style={{ height: '18px', width: '18px' }} />
                </a>
              </div>
            </aside>
          </div>

          <div
            className={`bg-github-border hover:bg-github-text-muted cursor-col-resize ${!isDragging ? '!transition-all !duration-300 !ease-in-out' : ''}`}
            style={{
              width: isFileTreeOpen ? '4px' : '0px',
            }}
            onMouseDown={handleMouseDown}
            title="Drag to resize file list"
          />

          <main className="flex-1 overflow-y-auto">
            {diffData.files.map((file, fileIndex) => {
              return (
                <div key={file.path} id={getFileElementId(file.path)} className="mb-6">
                  <DiffViewer
                    file={file}
                    comments={comments
                      .filter((c) => c.filePath === file.path)
                      .map((c) => ({
                        id: c.id,
                        file: c.filePath,
                        line:
                          typeof c.position.line === 'number' ?
                            c.position.line
                          : [c.position.line.start, c.position.line.end],
                        body: c.body,
                        timestamp: c.createdAt,
                        codeContent: c.codeSnapshot?.content,
                        side: c.position.side,
                      }))}
                    diffMode={diffMode}
                    reviewedFiles={viewedFiles}
                    onToggleReviewed={toggleFileReviewed}
                    onAddComment={handleAddComment}
                    onGeneratePrompt={(comment) => generatePrompt(comment.id)}
                    onRemoveComment={removeComment}
                    onUpdateComment={updateComment}
                    syntaxTheme={settings.syntaxTheme}
                    baseCommitish={diffData.baseCommitish}
                    targetCommitish={diffData.targetCommitish}
                    cursor={cursor?.fileIndex === fileIndex ? cursor : null}
                    fileIndex={fileIndex}
                    onLineClick={(fileIdx, chunkIdx, lineIdx, side) => {
                      setCursorPosition({
                        fileIndex: fileIdx,
                        chunkIndex: chunkIdx,
                        lineIndex: lineIdx,
                        side,
                      });
                    }}
                    commentTrigger={commentTrigger?.fileIndex === fileIndex ? commentTrigger : null}
                    onCommentTriggerHandled={() => setCommentTrigger(null)}
                  />
                </div>
              );
            })}
          </main>
        </div>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSettingsChange={updateSettings}
        />

        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

        <CommentsListModal
          isOpen={isCommentsListOpen}
          onClose={() => setIsCommentsListOpen(false)}
          onNavigate={handleNavigateToComment}
          comments={comments.map((c) => ({
            id: c.id,
            file: c.filePath,
            line:
              typeof c.position.line === 'number' ?
                c.position.line
              : [c.position.line.start, c.position.line.end],
            body: c.body,
            timestamp: c.createdAt,
            codeContent: c.codeSnapshot?.content,
          }))}
          onRemoveComment={removeComment}
          onGeneratePrompt={(comment) => generatePrompt(comment.id)}
          onUpdateComment={updateComment}
        />
      </div>
    </WordHighlightProvider>
  );
}

export default App;
