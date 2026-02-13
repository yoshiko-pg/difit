import { Columns, AlignLeft, Settings, PanelLeftClose, PanelLeft, Keyboard } from 'lucide-react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import {
  type DiffResponse,
  type DiffViewMode,
  type DiffSide,
  type LineNumber,
  type Comment,
  type RevisionsResponse,
} from '../types/diff';
import { DEFAULT_DIFF_VIEW_MODE, normalizeDiffViewMode } from '../utils/diffMode';

import { Checkbox } from './components/Checkbox';
import { CommentsDropdown } from './components/CommentsDropdown';
import { CommentsListModal } from './components/CommentsListModal';
import { DiffQuickMenu } from './components/DiffQuickMenu';
import { DiffViewer } from './components/DiffViewer';
import { FileList } from './components/FileList';
import { GitHubIcon } from './components/GitHubIcon';
import { HelpModal } from './components/HelpModal';
import { Logo } from './components/Logo';
import { ReloadButton } from './components/ReloadButton';
import { RevisionDetailModal } from './components/RevisionDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { SparkleAnimation } from './components/SparkleAnimation';
import { WordHighlightProvider } from './contexts/WordHighlightContext';
import { useAppearanceSettings } from './hooks/useAppearanceSettings';
import { useDiffComments } from './hooks/useDiffComments';
import { useExpandedLines, type MergedChunk } from './hooks/useExpandedLines';
import { useFileWatch } from './hooks/useFileWatch';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useViewedFiles } from './hooks/useViewedFiles';
import { useViewport } from './hooks/useViewport';
import { getFileElementId } from './utils/domUtils';
import { findCommentPosition } from './utils/navigation/positionHelpers';

const EMPTY_COMMENTS: Comment[] = [];
const EMPTY_MERGED_CHUNKS: MergedChunk[] = [];
const SIDEBAR_WIDTH_STORAGE_KEY = 'difit.sidebarWidth';
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;
const SIDEBAR_DEFAULT_WIDTH = 320;

const getInitialSidebarWidth = () => {
  if (typeof window === 'undefined') {
    return SIDEBAR_DEFAULT_WIDTH;
  }
  const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
  if (!stored) {
    return SIDEBAR_DEFAULT_WIDTH;
  }
  const parsed = Number.parseInt(stored, 10);
  if (!Number.isFinite(parsed)) {
    return SIDEBAR_DEFAULT_WIDTH;
  }
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, parsed));
};

function App() {
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [diffMode, setDiffMode] = useState<DiffViewMode>(DEFAULT_DIFF_VIEW_MODE);
  const hasUserSetDiffModeRef = useRef(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopiedAll, setIsCopiedAll] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [hasTriggeredSparkles, setHasTriggeredSparkles] = useState(false);
  const [isCommentsListOpen, setIsCommentsListOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const collapsedInitializedRef = useRef(false);
  const diffScrollContainerRef = useRef<HTMLElement | null>(null);

  // Revision selector state
  const [revisionOptions, setRevisionOptions] = useState<RevisionsResponse | null>(null);
  const [baseRevision, setBaseRevision] = useState<string>('');
  const [targetRevision, setTargetRevision] = useState<string>('');
  const [resolvedBaseRevision, setResolvedBaseRevision] = useState<string>('');
  const [resolvedTargetRevision, setResolvedTargetRevision] = useState<string>('');
  const hasUserSelectedRevisionRef = useRef(false);

  const { settings, updateSettings } = useAppearanceSettings();
  const { isMobile, isDesktop } = useViewport();

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
    undefined, // branchToHash map - could be populated from server data
    diffData?.repositoryId, // Repository identifier for storage isolation
  );

  const normalizedComments = useMemo<Comment[]>(
    () =>
      comments.map((comment) => ({
        id: comment.id,
        file: comment.filePath,
        line:
          typeof comment.position.line === 'number' ?
            comment.position.line
          : ([comment.position.line.start, comment.position.line.end] as [number, number]),
        body: comment.body,
        timestamp: comment.createdAt,
        codeContent: comment.codeSnapshot?.content,
        side: comment.position.side,
      })),
    [comments],
  );

  const commentsByFile = useMemo(() => {
    const map = new Map<string, Comment[]>();
    normalizedComments.forEach((normalized) => {
      const entry = map.get(normalized.file);
      if (entry) {
        entry.push(normalized);
      } else {
        map.set(normalized.file, [normalized]);
      }
    });
    return map;
  }, [normalizedComments]);
  const showMobileCommentsBar = isMobile && comments.length > 0;

  // Viewed files management
  const { viewedFiles, toggleFileViewed, clearViewedFiles } = useViewedFiles(
    diffData?.baseCommitish,
    diffData?.targetCommitish,
    diffData?.commit,
    undefined,
    diffData?.files,
    diffData?.repositoryId, // Repository identifier for storage isolation
  );

  // Reset initialization flag when diff context changes
  useEffect(() => {
    collapsedInitializedRef.current = false;
  }, [diffData?.repositoryId, diffData?.commit]);

  // Initialize collapsed files from viewed files (only once per diff)
  useEffect(() => {
    if (!collapsedInitializedRef.current) {
      setCollapsedFiles(new Set(viewedFiles));
      collapsedInitializedRef.current = true;
    }
  }, [viewedFiles]);

  const scrollFileIntoDiffContainer = useCallback((filePath: string) => {
    const scrollContainer = diffScrollContainerRef.current;
    const target = document.getElementById(getFileElementId(filePath));
    if (!scrollContainer || !target) {
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetScrollTop = scrollContainer.scrollTop + (targetRect.top - containerRect.top);

    scrollContainer.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth',
    });
  }, []);

  const toggleFileReviewed = useCallback(
    async (filePath: string) => {
      if (!diffData) return;

      const file = diffData.files.find((f) => f.path === filePath);
      if (!file) return;

      const wasViewed = viewedFiles.has(filePath);
      await toggleFileViewed(filePath, file);

      // Update collapsed state based on viewed state
      setCollapsedFiles((prev) => {
        const newSet = new Set(prev);
        if (!wasViewed) {
          // Marking as viewed -> collapse the file
          newSet.add(filePath);
        } else {
          // Marking as not viewed -> expand the file
          newSet.delete(filePath);
        }
        return newSet;
      });

      // When marking as reviewed (closing file), scroll to the file header
      if (!wasViewed) {
        setTimeout(() => {
          scrollFileIntoDiffContainer(filePath);
        }, 100);
      }
    },
    [diffData, scrollFileIntoDiffContainer, toggleFileViewed, viewedFiles],
  );

  const toggleFileCollapsed = useCallback((filePath: string) => {
    setCollapsedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  }, []);

  const toggleAllFilesCollapsed = useCallback(
    (shouldCollapse: boolean) => {
      if (!diffData) return;

      if (shouldCollapse) {
        // Collapse all files
        setCollapsedFiles(new Set(diffData.files.map((f) => f.path)));
      } else {
        // Expand all files
        setCollapsedFiles(new Set());
      }
    },
    [diffData],
  );

  const handleDiffModeChange = useCallback((mode: DiffViewMode) => {
    hasUserSetDiffModeRef.current = true;
    setDiffMode(mode);
  }, []);

  // Lift expand state to App level so navigation and rendering share the same merged chunks
  const {
    isLoading: isExpandLoading,
    expandLines,
    expandAllBetweenChunks,
    prefetchFileContent,
    getMergedChunks,
    lastUpdatedFilePath,
    lastUpdatedAt,
  } = useExpandedLines({
    baseCommitish: diffData?.baseCommitish,
    targetCommitish: diffData?.targetCommitish,
  });

  const getMergedChunksRef = useRef(getMergedChunks);
  useEffect(() => {
    getMergedChunksRef.current = getMergedChunks;
  }, [getMergedChunks]);

  const [mergedChunksByFile, setMergedChunksByFile] = useState<Map<string, MergedChunk[]>>(
    new Map(),
  );

  // Compute merged chunks for all files on initial diff load
  useEffect(() => {
    if (!diffData) {
      setMergedChunksByFile(new Map());
      return;
    }

    const map = new Map<string, MergedChunk[]>();
    diffData.files.forEach((file) => {
      map.set(file.path, getMergedChunksRef.current(file));
    });
    setMergedChunksByFile(map);
  }, [diffData]);

  // Recompute merged chunks only for the file that changed
  useEffect(() => {
    if (!diffData || !lastUpdatedFilePath) return;
    const file = diffData.files.find((candidate) => candidate.path === lastUpdatedFilePath);
    if (!file) return;

    setMergedChunksByFile((prev) => {
      const next = new Map(prev);
      next.set(file.path, getMergedChunksRef.current(file));
      return next;
    });
  }, [diffData, lastUpdatedFilePath, lastUpdatedAt]);

  // Create files with merged chunks for keyboard navigation
  const navigableFiles = useMemo(() => {
    if (!diffData) return [];
    return diffData.files.map((file) => ({
      ...file,
      chunks: mergedChunksByFile.get(file.path) || file.chunks,
    }));
  }, [diffData, mergedChunksByFile]);

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
    files: navigableFiles,
    comments: normalizedComments,
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

  const handleLineClick = useCallback(
    (fileIndex: number, chunkIndex: number, lineIndex: number, side: 'left' | 'right') => {
      setCursorPosition({
        fileIndex,
        chunkIndex,
        lineIndex,
        side,
      });
    },
    [setCursorPosition],
  );

  const handleCommentTriggerHandled = useCallback(() => {
    setCommentTrigger(null);
  }, [setCommentTrigger]);

  const handleGeneratePrompt = useCallback(
    (comment: Comment) => generatePrompt(comment.id),
    [generatePrompt],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(
        SIDEBAR_MIN_WIDTH,
        Math.min(SIDEBAR_MAX_WIDTH, startWidth + (e.clientX - startX)),
      );
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

  const fetchDiffData = useCallback(
    async (base?: string, target?: string) => {
      try {
        const params = new URLSearchParams({
          ignoreWhitespace: String(ignoreWhitespace),
        });
        if (base) params.set('base', base);
        if (target) params.set('target', target);

        const response = await fetch(`/api/diff?${params}`);
        if (!response.ok) throw new Error('Failed to fetch diff data');
        const data = (await response.json()) as DiffResponse;
        setDiffData(data);

        // Update resolved revision state from server response
        if (data.baseCommitish) setResolvedBaseRevision(data.baseCommitish);
        if (data.targetCommitish) setResolvedTargetRevision(data.targetCommitish);

        if (!hasUserSelectedRevisionRef.current) {
          const requestedBase = data.requestedBaseCommitish ?? data.baseCommitish;
          const requestedTarget = data.requestedTargetCommitish ?? data.targetCommitish;
          if (requestedBase) setBaseRevision(requestedBase);
          if (requestedTarget) setTargetRevision(requestedTarget);
        }

        // Set diff mode from server response if provided
        if (data.mode && !hasUserSetDiffModeRef.current) {
          setDiffMode(normalizeDiffViewMode(data.mode));
        }

        // Lock files are now automatically marked as viewed by useViewedFiles hook
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [ignoreWhitespace],
  );

  useEffect(() => {
    void fetchDiffData();
  }, [fetchDiffData]);

  useEffect(() => {
    if (isMobile && diffMode !== 'unified') {
      setDiffMode('unified');
    }
  }, [diffMode, isMobile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    } catch {
      // Ignore localStorage errors (e.g. disabled storage).
    }
  }, [sidebarWidth]);

  // Fetch revision options on mount
  useEffect(() => {
    fetch('/api/revisions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RevisionsResponse | null) => {
        setRevisionOptions(data);
        if (data?.resolvedBase) {
          setResolvedBaseRevision((prev) => prev || data.resolvedBase || '');
        }
        if (data?.resolvedTarget) {
          setResolvedTargetRevision((prev) => prev || data.resolvedTarget || '');
        }
      })
      .catch(() => setRevisionOptions(null));
  }, []);

  // Handle revision change
  const handleRevisionChange = useCallback(
    async (newBase: string, newTarget: string) => {
      // Skip if no actual change
      if (newBase === baseRevision && newTarget === targetRevision) return;

      hasUserSelectedRevisionRef.current = true;
      setBaseRevision(newBase);
      setTargetRevision(newTarget);
      setLoading(true);
      setError(null);
      await fetchDiffData(newBase, newTarget);
    },
    [baseRevision, targetRevision, fetchDiffData],
  );

  // Clear comments and viewed files on initial load if requested via CLI flag
  const hasCleanedRef = useRef(false);
  useEffect(() => {
    if (diffData?.clearComments && !hasCleanedRef.current) {
      hasCleanedRef.current = true;
      clearAllComments();
      clearViewedFiles();
      console.log(
        '✅ All existing comments and viewed files cleared as requested via --clean flag',
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

  const handleAddComment = useCallback(
    (
      file: string,
      line: LineNumber,
      body: string,
      codeContent?: string,
      side?: DiffSide,
    ): Promise<void> => {
      addComment({
        filePath: file,
        body,
        side: side || 'new',
        line: typeof line === 'number' ? line : { start: line[0], end: line[1] },
        codeSnapshot:
          codeContent ?
            {
              content: codeContent,
              language: undefined,
            }
          : undefined,
      });
      return Promise.resolve();
    },
    [addComment],
  );

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

  const handleOpenInEditor = useCallback(
    async (filePath: string, lineNumber: number) => {
      try {
        const response = await fetch('/api/open-in-editor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath, line: lineNumber, editor: settings.editor }),
        });

        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          let message = response.statusText;
          if (
            payload &&
            typeof payload === 'object' &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
          ) {
            message = (payload as { error: string }).error;
          }
          console.error('Failed to open file in editor:', message);
        }
      } catch (error) {
        console.error('Failed to open file in editor:', error);
      }
    },
    [settings.editor],
  );

  const handleGlobalClick = (e: React.MouseEvent) => {
    // Clear cursor position
    setCursorPosition(null);

    // Check if clicking on a comment button
    const target = e.target as HTMLElement;
    const isCommentButton = target.closest('[data-comment-button="true"]');
    const isOpenInEditorButton = target.closest('[data-open-in-editor-button="true"]');

    // Close empty comment forms (unless clicking on a comment button)
    if (!isCommentButton && !isOpenInEditorButton) {
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
        <header
          className={`bg-github-bg-secondary border-b border-github-border flex ${
            isMobile ? 'flex-col' : 'flex-row items-center'
          }`}
        >
          <div
            className={`flex items-center justify-between w-full ${
              isMobile ? 'px-3 py-2 gap-3' : 'px-4 py-3 gap-4 w-auto'
            } ${!isDragging ? '!transition-all !duration-300 !ease-in-out' : ''}`}
            style={{
              width:
                isMobile ? '100%'
                : isFileTreeOpen ? `${sidebarWidth}px`
                : 'auto',
              minWidth:
                isMobile ? '0px'
                : isFileTreeOpen ? '200px'
                : 'auto',
              maxWidth:
                isMobile ? 'none'
                : isFileTreeOpen ? '600px'
                : 'none',
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
          {!isMobile && (
            <div
              className={`border-r border-github-border ${!isDragging ? '!transition-all !duration-300 !ease-in-out' : ''}`}
              style={{
                width: isFileTreeOpen ? '4px' : '0px',
                height: 'calc(100% - 16px)',
                margin: '8px 0',
                transform: 'translateX(-2px)',
              }}
            />
          )}
          <div
            className={`flex-1 flex flex-wrap items-center justify-between ${
              isMobile ? 'px-3 pb-2 gap-3' : 'px-4 py-3 gap-4'
            }`}
          >
            <div className={`flex flex-wrap items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
              {!isMobile && (
                <div className="flex bg-github-bg-tertiary border border-github-border rounded-md p-1">
                  <button
                    onClick={() => handleDiffModeChange('split')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                      diffMode === 'split' ?
                        'bg-github-bg-primary text-github-text-primary shadow-sm'
                      : 'text-github-text-secondary hover:text-github-text-primary'
                    }`}
                  >
                    <Columns size={14} />
                    Split
                  </button>
                  <button
                    onClick={() => handleDiffModeChange('unified')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                      diffMode === 'unified' ?
                        'bg-github-bg-primary text-github-text-primary shadow-sm'
                      : 'text-github-text-secondary hover:text-github-text-primary'
                    }`}
                  >
                    <AlignLeft size={14} />
                    Unified
                  </button>
                </div>
              )}
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
                compact={isMobile}
              />
            </div>
            <div
              className={`flex flex-wrap items-center text-sm text-github-text-secondary ${
                isMobile ? 'gap-3' : 'gap-4'
              }`}
            >
              {!isMobile && comments.length > 0 && (
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
              {revisionOptions ?
                <DiffQuickMenu
                  options={revisionOptions}
                  baseRevision={baseRevision}
                  targetRevision={targetRevision}
                  resolvedBaseRevision={resolvedBaseRevision}
                  resolvedTargetRevision={resolvedTargetRevision}
                  onSelectDiff={(base, target) => void handleRevisionChange(base, target)}
                  onOpenAdvanced={() => setIsRevisionModalOpen(true)}
                  compact={!isDesktop}
                />
              : <span className="text-xs">
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
              }
            </div>
          </div>
        </header>
        {revisionOptions && (
          <RevisionDetailModal
            key={isRevisionModalOpen ? `${baseRevision}:${targetRevision}` : 'closed'}
            isOpen={isRevisionModalOpen}
            onClose={() => setIsRevisionModalOpen(false)}
            options={revisionOptions}
            baseRevision={baseRevision}
            targetRevision={targetRevision}
            resolvedBaseRevision={resolvedBaseRevision}
            resolvedTargetRevision={resolvedTargetRevision}
            onApply={(base, target) => void handleRevisionChange(base, target)}
          />
        )}

        {isMobile && isFileTreeOpen && (
          <button
            type="button"
            aria-label="Close file tree"
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => setIsFileTreeOpen(false)}
          />
        )}

        <div className="flex flex-1 overflow-hidden relative">
          <div
            className={`relative overflow-hidden ${!isDragging ? '!transition-all !duration-300 !ease-in-out' : ''}`}
            style={{
              width:
                isMobile ? '0px'
                : isFileTreeOpen ? `${sidebarWidth}px`
                : '0px',
            }}
          >
            <aside
              id="file-tree-panel"
              className={`bg-github-bg-secondary border-r border-github-border overflow-y-auto flex flex-col ${
                isMobile ?
                  'fixed inset-y-0 left-0 z-40 w-[min(85vw,360px)] transition-transform duration-300 ease-out'
                : 'relative'
              }`}
              style={{
                width: isMobile ? 'min(85vw, 360px)' : `${sidebarWidth}px`,
                minWidth: isMobile ? '0px' : '200px',
                maxWidth: isMobile ? 'none' : '600px',
                height: '100%',
                transform:
                  isMobile ?
                    isFileTreeOpen ? 'translateX(0)'
                    : 'translateX(-100%)'
                  : undefined,
              }}
            >
              <div className="flex-1 overflow-y-auto">
                <FileList
                  files={diffData.files}
                  onScrollToFile={scrollFileIntoDiffContainer}
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
              {!isMobile && (
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
              )}
            </aside>
          </div>

          {!isMobile && (
            <div
              className={`bg-github-border hover:bg-github-text-muted cursor-col-resize ${!isDragging ? '!transition-all !duration-300 !ease-in-out' : ''}`}
              style={{
                width: isFileTreeOpen ? '4px' : '0px',
              }}
              onMouseDown={handleMouseDown}
              title="Drag to resize file list"
            />
          )}

          <main
            ref={diffScrollContainerRef}
            className={`flex-1 overflow-y-auto ${showMobileCommentsBar ? 'pb-16' : ''}`}
          >
            {diffData.files.map((file, fileIndex) => {
              const fileComments = commentsByFile.get(file.path) ?? EMPTY_COMMENTS;
              const mergedChunks = mergedChunksByFile.get(file.path) ?? EMPTY_MERGED_CHUNKS;
              return (
                <div key={file.path} id={getFileElementId(file.path)} className="mb-6">
                  <DiffViewer
                    file={file}
                    comments={fileComments}
                    diffMode={diffMode}
                    reviewedFiles={viewedFiles}
                    onToggleReviewed={toggleFileReviewed}
                    collapsedFiles={collapsedFiles}
                    onToggleCollapsed={toggleFileCollapsed}
                    onToggleAllCollapsed={toggleAllFilesCollapsed}
                    onAddComment={handleAddComment}
                    onGeneratePrompt={handleGeneratePrompt}
                    onRemoveComment={removeComment}
                    onUpdateComment={updateComment}
                    onOpenInEditor={settings.editor === 'none' ? undefined : handleOpenInEditor}
                    syntaxTheme={settings.syntaxTheme}
                    baseCommitish={diffData.baseCommitish}
                    targetCommitish={diffData.targetCommitish}
                    cursor={cursor?.fileIndex === fileIndex ? cursor : null}
                    fileIndex={fileIndex}
                    onLineClick={handleLineClick}
                    commentTrigger={commentTrigger?.fileIndex === fileIndex ? commentTrigger : null}
                    onCommentTriggerHandled={handleCommentTriggerHandled}
                    mergedChunks={mergedChunks}
                    expandLines={expandLines}
                    expandAllBetweenChunks={expandAllBetweenChunks}
                    prefetchFileContent={prefetchFileContent}
                    isExpandLoading={isExpandLoading}
                  />
                </div>
              );
            })}
          </main>
        </div>

        {showMobileCommentsBar && (
          <div className="fixed bottom-0 left-0 right-0 z-20 bg-github-bg-secondary border-t border-github-border px-4 py-2 flex justify-end">
            <CommentsDropdown
              commentsCount={comments.length}
              isCopiedAll={isCopiedAll}
              onCopyAll={handleCopyAllComments}
              onDeleteAll={clearAllComments}
              onViewAll={() => setIsCommentsListOpen(true)}
              direction="up"
              compact
            />
          </div>
        )}

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
          syntaxTheme={settings.syntaxTheme}
        />
      </div>
    </WordHighlightProvider>
  );
}

export default App;
