import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { DiffLine } from '../../types/diff';
import { FrontmatterTable } from '../components/FrontmatterTable';
import type { MergedChunk } from '../hooks/useExpandedLines';
import { extractFrontmatter } from '../utils/frontmatter';
import { isSafeUrl } from '../utils/markdownUtils';

import { getMarkdownComponents } from './markdownComponents';
import { MarkdownSplitPreview } from './MarkdownSplitPreview';
import { DEFAULT_PREVIEW_MODE, PreviewModeTabs, type PreviewMode } from './PreviewModeTabs';
import { TextDiffViewer } from './TextDiffViewer';
import type { DiffViewerBodyProps } from './types';

type PreviewBlockType = 'add' | 'delete' | 'change' | 'context';

type PreviewBlock = {
  type: PreviewBlockType;
  lines: string[];
};

type PreviewLineEntry = {
  type: PreviewBlockType;
  content: string;
};

type MarkdownRenderBlock = {
  kind: 'markdown';
  type: PreviewBlockType;
  lines: string[];
};

type FencedCodeRenderBlock = {
  kind: 'fenced-code';
  lines: PreviewLineEntry[];
};

type PreviewRenderBlock = MarkdownRenderBlock | FencedCodeRenderBlock;

type FenceInfo = {
  marker: '`' | '~';
  length: number;
  raw: string;
};

const isFetchableRef = (ref?: string) => Boolean(ref && ref !== 'stdin');

type PreviewSource = { path: string; ref: string } | null;

type PreviewSourcePair = {
  base: PreviewSource;
  target: PreviewSource;
};

type PreviewContents = {
  base: string | null;
  target: string | null;
};

const isDeletionLine = (line: DiffLine) => line.type === 'delete' || line.type === 'remove';

const isContextLine = (line: DiffLine) => line.type === 'normal' || line.type === 'context';

const appendBlockLine = (blocks: PreviewBlock[], type: PreviewBlockType, line: string) => {
  const last = blocks[blocks.length - 1];
  if (last && last.type === type) {
    last.lines.push(line);
    return;
  }
  blocks.push({ type, lines: [line] });
};

const flushDeleteLines = (blocks: PreviewBlock[], pendingDeletes: string[]) => {
  pendingDeletes.forEach((line) => appendBlockLine(blocks, 'delete', line));
  pendingDeletes.length = 0;
};

// stdin has no blobs to fetch, so each side is rebuilt from the hunks with every line at
// its own line number, which keeps comment positions right. Lines outside the hunks stay
// blank, so a modified file shows only its changed regions.
const buildContentsFromChunks = (chunks: MergedChunk[]): PreviewContents => {
  const base: string[] = [];
  const target: string[] = [];

  chunks.forEach((chunk) => {
    chunk.lines.forEach((line) => {
      if (line.oldLineNumber && line.type !== 'add') {
        base[line.oldLineNumber - 1] = line.content;
      }
      if (line.newLineNumber && !isDeletionLine(line)) {
        target[line.newLineNumber - 1] = line.content;
      }
    });
  });

  const toContent = (lines: string[]) =>
    lines.length > 0 ? Array.from(lines, (line) => line ?? '').join('\n') : null;
  return { base: toContent(base), target: toContent(target) };
};

const buildPreviewBlocks = (chunks: MergedChunk[]): PreviewBlock[] => {
  const blocks: PreviewBlock[] = [];
  const pendingDeletes: string[] = [];
  let inChange = false;

  chunks.forEach((chunk) => {
    chunk.lines.forEach((line) => {
      if (line.type === 'header' || line.type === 'hunk') return;

      if (isDeletionLine(line)) {
        pendingDeletes.push(line.content);
        return;
      }

      if (line.type === 'add') {
        if (pendingDeletes.length > 0) {
          flushDeleteLines(blocks, pendingDeletes);
          inChange = true;
        }
        appendBlockLine(blocks, inChange ? 'change' : 'add', line.content);
        return;
      }

      if (isContextLine(line)) {
        flushDeleteLines(blocks, pendingDeletes);
        inChange = false;
        appendBlockLine(blocks, 'context', line.content);
      }
    });

    flushDeleteLines(blocks, pendingDeletes);
    inChange = false;
  });

  return blocks;
};

const getBlockStyle = (type: PreviewBlockType) => {
  switch (type) {
    case 'add':
      return 'border-l-4 border-diff-addition-border';
    case 'delete':
      return 'border-l-4 border-diff-deletion-border';
    case 'change':
      return 'border-l-4 border-diff-addition-border';
    default:
      return 'border-l-4 border-transparent';
  }
};

const isReferenceDefinitionLine = (line: string) => /^\s*\[[^\]]+\]:\s+\S+/.test(line);

const isFootnoteDefinitionLine = (line: string) => /^\s*\[\^[^\]]+\]:\s+/.test(line);

const isHtmlCommentLine = (line: string) => {
  const trimmedLine = line.trim();
  return (
    trimmedLine.length >= '<!---->'.length &&
    trimmedLine.startsWith('<!--') &&
    trimmedLine.endsWith('-->')
  );
};

const isNonRenderableLine = (line: string) =>
  line.trim() === '' ||
  isReferenceDefinitionLine(line) ||
  isFootnoteDefinitionLine(line) ||
  isHtmlCommentLine(line);

const isPlainPreviewBlock = (lines: string[]) => lines.every(isNonRenderableLine);

const parseFenceStart = (line: string): FenceInfo | null => {
  const match = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
  if (!match) return null;

  const marker = match[1];
  if (!marker) return null;

  return {
    marker: marker[0] as '`' | '~',
    length: marker.length,
    raw: line,
  };
};

const isFenceEnd = (line: string, fence: FenceInfo) => {
  const match = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
  if (!match?.[1]) return false;

  return match[1][0] === fence.marker && match[1].length >= fence.length;
};

const buildRenderBlocks = (blocks: PreviewBlock[]): PreviewRenderBlock[] => {
  const renderBlocks: PreviewRenderBlock[] = [];
  let currentMarkdownBlock: MarkdownRenderBlock | null = null;
  let currentFence: { fence: FenceInfo; lines: PreviewLineEntry[] } | null = null;

  const flushMarkdownBlock = () => {
    if (!currentMarkdownBlock) return;
    renderBlocks.push(currentMarkdownBlock);
    currentMarkdownBlock = null;
  };

  const pushMarkdownLine = (type: PreviewBlockType, line: string) => {
    if (currentMarkdownBlock?.type === type) {
      currentMarkdownBlock.lines.push(line);
      return;
    }

    flushMarkdownBlock();
    currentMarkdownBlock = {
      kind: 'markdown',
      type,
      lines: [line],
    };
  };

  const flushFence = (closingFenceLine?: string) => {
    if (!currentFence) return;

    const hasOnlyContextLines = currentFence.lines.every((line) => line.type === 'context');

    if (closingFenceLine && hasOnlyContextLines) {
      pushMarkdownLine('context', currentFence.fence.raw);
      currentFence.lines.forEach((line) => {
        pushMarkdownLine('context', line.content);
      });
      pushMarkdownLine('context', closingFenceLine);
    } else {
      flushMarkdownBlock();
      renderBlocks.push({
        kind: 'fenced-code',
        lines: currentFence.lines,
      });
    }

    currentFence = null;
  };

  blocks.forEach((block) => {
    block.lines.forEach((line) => {
      if (currentFence) {
        if (isFenceEnd(line, currentFence.fence)) {
          flushFence(line);
          return;
        }

        currentFence.lines.push({ type: block.type, content: line });
        return;
      }

      const fence = parseFenceStart(line);
      if (fence) {
        flushMarkdownBlock();
        currentFence = { fence, lines: [] };
        return;
      }

      pushMarkdownLine(block.type, line);
    });
  });

  flushFence();
  flushMarkdownBlock();

  return renderBlocks;
};

const getCodeLineClass = (type: PreviewBlockType) => {
  switch (type) {
    case 'add':
    case 'change':
      return 'border-l-4 border-diff-addition-border bg-diff-addition-bg';
    case 'delete':
      return 'border-l-4 border-diff-deletion-border bg-diff-deletion-bg';
    default:
      return 'border-l-4 border-transparent';
  }
};

// Fallback when the two files cannot both be loaded (stdin, a failed fetch), so the blocks
// cannot be aligned: renders the git hunks, with a snapshot of whichever frontmatter loaded.
const MarkdownDiffPreview = ({
  blocks,
  syntaxTheme,
  baseContent,
  targetContent,
}: {
  blocks: PreviewBlock[];
  syntaxTheme?: DiffViewerBodyProps['syntaxTheme'];
  baseContent: string | null;
  targetContent: string | null;
}) => {
  const components = useMemo(() => getMarkdownComponents(syntaxTheme), [syntaxTheme]);

  const frontmatterView = useMemo(() => {
    const targetData = targetContent !== null ? extractFrontmatter(targetContent).data : null;
    if (targetData !== null) {
      return (
        <FrontmatterTable
          mode="snapshot"
          data={targetData}
          label="Frontmatter (target only — base unavailable)"
        />
      );
    }
    const baseData = baseContent !== null ? extractFrontmatter(baseContent).data : null;
    if (baseData !== null) {
      return (
        <FrontmatterTable
          mode="snapshot"
          data={baseData}
          label="Frontmatter (base only — target unavailable)"
        />
      );
    }
    return null;
  }, [baseContent, targetContent]);

  const renderBlocks = useMemo(() => buildRenderBlocks(blocks), [blocks]);

  return (
    <div className="space-y-4">
      {frontmatterView}
      {renderBlocks.map((block, index) => {
        if (block.kind === 'fenced-code') {
          return (
            <div key={`preview-block-${index}`} className="px-4">
              <div className="markdown-preview-code overflow-x-auto rounded border border-github-border bg-github-bg-secondary text-sm font-mono text-github-text-primary">
                {block.lines.map((line, lineIndex) => (
                  <div
                    key={`preview-code-line-${index}-${lineIndex}`}
                    className={`${getCodeLineClass(line.type)} whitespace-pre px-3 py-1`}
                  >
                    {line.content || ' '}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const rawContent = block.lines.join('\n');
        const trimmedContent = rawContent.trim();
        if (!trimmedContent) return null;
        const renderAsPlain = isPlainPreviewBlock(block.lines);
        return (
          <div key={`preview-block-${index}`} className={`px-4 ${getBlockStyle(block.type)}`}>
            {renderAsPlain ? (
              <pre className="whitespace-pre-wrap text-sm text-github-text-primary font-mono">
                {trimmedContent}
              </pre>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) => (isSafeUrl(url) ? url : '')}
                components={components}
              >
                {trimmedContent}
              </ReactMarkdown>
            )}
          </div>
        );
      })}
    </div>
  );
};

export function MarkdownDiffViewer(props: DiffViewerBodyProps) {
  const { file, baseCommitish, targetCommitish, mergedChunks, syntaxTheme, diffVersion } = props;
  // App owns the remembered mode when it passes a change handler; otherwise the passed
  // mode is only the starting tab.
  const { markdownPreviewMode, onMarkdownPreviewModeChange } = props;
  const [localMode, setLocalMode] = useState<PreviewMode>(
    markdownPreviewMode ?? DEFAULT_PREVIEW_MODE,
  );
  const mode = onMarkdownPreviewModeChange
    ? (markdownPreviewMode ?? DEFAULT_PREVIEW_MODE)
    : localMode;
  const handleModeChange = onMarkdownPreviewModeChange ?? setLocalMode;
  const [contents, setContents] = useState<PreviewContents>({ base: null, target: null });
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [partialFailureLabel, setPartialFailureLabel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ sourcesKey: string; fetchKey: string } | null>(null);
  const loadedSourcesKey = loaded?.sourcesKey ?? null;
  const previewBlocks = useMemo(() => buildPreviewBlocks(mergedChunks), [mergedChunks]);

  const previewSources = useMemo<PreviewSourcePair>(() => {
    const target: PreviewSource =
      file.status === 'deleted'
        ? null
        : targetCommitish
          ? { path: file.path, ref: targetCommitish }
          : null;

    const base: PreviewSource =
      file.status === 'added'
        ? null
        : baseCommitish
          ? { path: file.oldPath || file.path, ref: baseCommitish }
          : null;

    return { base, target };
  }, [baseCommitish, targetCommitish, file.path, file.oldPath, file.status]);

  const previewSourcesKey = useMemo(() => {
    const baseKey = previewSources.base
      ? `${previewSources.base.ref}:${previewSources.base.path}`
      : '';
    const targetKey = previewSources.target
      ? `${previewSources.target.ref}:${previewSources.target.path}`
      : '';
    if (!baseKey && !targetKey) return null;
    return `${baseKey}|${targetKey}`;
  }, [previewSources]);

  // A reload of the diff (watch mode) must refetch working-tree content even though the
  // refs and paths are unchanged.
  const previewFetchKey = previewSourcesKey ? `${previewSourcesKey}#${diffVersion ?? 0}` : null;

  const fetchableSources = useMemo<PreviewSourcePair>(
    () => ({
      base:
        previewSources.base && isFetchableRef(previewSources.base.ref) ? previewSources.base : null,
      target:
        previewSources.target && isFetchableRef(previewSources.target.ref)
          ? previewSources.target
          : null,
    }),
    [previewSources],
  );

  useEffect(() => {
    const { base: baseSource, target: targetSource } = fetchableSources;

    if (!previewSourcesKey || !previewFetchKey || (!baseSource && !targetSource)) {
      setContents({ base: null, target: null });
      setLoaded(null);
      setPreviewError(null);
      setPartialFailureLabel(null);
      setIsPreviewLoading(false);
      return;
    }

    let isCanceled = false;

    const fetchBlob = async (source: PreviewSource): Promise<string | null> => {
      if (!source) return null;
      const encodedPath = encodeURIComponent(source.path);
      const response = await fetch(
        `/api/blob/${encodedPath}?ref=${encodeURIComponent(source.ref)}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch preview: ${response.statusText}`);
      }
      return response.text();
    };

    const run = async () => {
      if (previewSourcesKey !== loadedSourcesKey) {
        setContents({ base: null, target: null });
      }
      setIsPreviewLoading(true);
      setPreviewError(null);

      const [baseResult, targetResult] = await Promise.allSettled([
        fetchBlob(baseSource),
        fetchBlob(targetSource),
      ]);

      if (isCanceled) return;

      const nextBase = baseResult.status === 'fulfilled' ? baseResult.value : null;
      const nextTarget = targetResult.status === 'fulfilled' ? targetResult.value : null;

      const failures: string[] = [];
      if (baseSource && baseResult.status === 'rejected') {
        failures.push(
          baseResult.reason instanceof Error ? baseResult.reason.message : 'base fetch failed',
        );
      }
      if (targetSource && targetResult.status === 'rejected') {
        failures.push(
          targetResult.reason instanceof Error
            ? targetResult.reason.message
            : 'target fetch failed',
        );
      }

      setContents({ base: nextBase, target: nextTarget });
      setLoaded({ sourcesKey: previewSourcesKey, fetchKey: previewFetchKey });

      const baseFailed = baseSource !== null && baseResult.status === 'rejected';
      const targetFailed = targetSource !== null && targetResult.status === 'rejected';
      const allFailed =
        (baseSource ? baseFailed : true) &&
        (targetSource ? targetFailed : true) &&
        failures.length > 0;

      setPreviewError(allFailed ? failures.join('; ') : null);

      if (allFailed) {
        setPartialFailureLabel(null);
      } else if (baseFailed) {
        setPartialFailureLabel('Base content unavailable — showing partial preview.');
      } else if (targetFailed) {
        setPartialFailureLabel('Target content unavailable — showing partial preview.');
      } else {
        setPartialFailureLabel(null);
      }

      setIsPreviewLoading(false);
    };

    const relevantContent = file.status === 'deleted' ? contents.base : contents.target;

    if (previewFetchKey !== loaded?.fetchKey || relevantContent === null) {
      void run();
    } else {
      setIsPreviewLoading(false);
    }

    return () => {
      isCanceled = true;
    };
  }, [
    contents.base,
    contents.target,
    fetchableSources,
    file.status,
    loaded,
    loadedSourcesKey,
    previewFetchKey,
    previewSourcesKey,
  ]);

  const fullPreviewContent = useMemo(
    () => (file.status === 'deleted' ? contents.base : contents.target),
    [contents.base, contents.target, file.status],
  );

  const hasFullPreview = useMemo(
    () => previewSourcesKey === loadedSourcesKey && fullPreviewContent !== null,
    [fullPreviewContent, loadedSourcesKey, previewSourcesKey],
  );

  const hasSplitPreview =
    (file.status === 'added' || fetchableSources.base !== null) &&
    (file.status === 'deleted' || fetchableSources.target !== null);
  const isPreviewPending =
    (fetchableSources.base !== null || fetchableSources.target !== null) &&
    (isPreviewLoading || loadedSourcesKey !== previewSourcesKey);
  const patchContents = useMemo(
    () =>
      fetchableSources.base === null && fetchableSources.target === null
        ? buildContentsFromChunks(mergedChunks)
        : null,
    [fetchableSources, mergedChunks],
  );
  const isSplitPreviewReady =
    loadedSourcesKey === previewSourcesKey &&
    (file.status === 'added' || contents.base !== null) &&
    (file.status === 'deleted' || contents.target !== null);

  // A remembered mode may not fit this file (e.g. stdin has no blobs, or a fetch failed),
  // so fall back without overwriting the stored choice.
  const effectiveMode: PreviewMode =
    mode === 'split-preview' && !hasSplitPreview
      ? 'diff'
      : mode === 'split-preview' && !isSplitPreviewReady && !isPreviewPending
        ? 'diff-preview'
        : mode === 'full-preview' && !hasFullPreview && !isPreviewPending
          ? 'diff-preview'
          : mode;

  const commentProps = {
    filePath: file.path,
    threads: props.threads,
    showAuthorBadges: props.showAuthorBadges,
    syntaxTheme,
    onAddComment: props.onAddComment,
    onGenerateThreadPrompt: props.onGenerateThreadPrompt,
    onRemoveThread: props.onRemoveThread,
    onReplyToThread: props.onReplyToThread,
    onRemoveMessage: props.onRemoveMessage,
    onUpdateMessage: props.onUpdateMessage,
  };
  const splitContents = {
    baseContent: file.status === 'added' ? null : contents.base,
    targetContent: file.status === 'deleted' ? null : contents.target,
  };

  return (
    <div className="bg-github-bg-primary">
      <div className="flex items-center justify-between border-b border-github-border px-4 py-2">
        <PreviewModeTabs
          mode={effectiveMode}
          hasFullPreview={hasFullPreview}
          hasSplitPreview={hasSplitPreview}
          onModeChange={handleModeChange}
        />
      </div>

      {effectiveMode === 'diff' && <TextDiffViewer {...props} />}

      {effectiveMode === 'split-preview' &&
        (isSplitPreviewReady ? (
          <MarkdownSplitPreview
            {...commentProps}
            {...splitContents}
            baseLabel={baseCommitish}
            targetLabel={targetCommitish}
          />
        ) : (
          <div className="p-4 text-sm text-github-text-muted">Loading preview...</div>
        ))}

      {effectiveMode === 'diff-preview' && isSplitPreviewReady && (
        <>
          {partialFailureLabel && (
            <div className="px-4 pt-3 text-sm text-github-text-muted">{partialFailureLabel}</div>
          )}
          <MarkdownSplitPreview {...commentProps} {...splitContents} layout="unified" />
        </>
      )}

      {effectiveMode === 'diff-preview' && !isSplitPreviewReady && isPreviewPending && (
        <div className="p-4 text-sm text-github-text-muted">Loading preview...</div>
      )}

      {effectiveMode === 'diff-preview' && patchContents && (
        <MarkdownSplitPreview
          {...commentProps}
          baseContent={file.status === 'added' ? null : patchContents.base}
          targetContent={file.status === 'deleted' ? null : patchContents.target}
          layout="unified"
        />
      )}

      {/* When a fetch fails the blocks cannot be aligned: render the hunks. */}
      {effectiveMode === 'diff-preview' &&
        !patchContents &&
        !isSplitPreviewReady &&
        !isPreviewPending && (
          <div className="p-4">
            {partialFailureLabel && (
              <div className="text-sm text-github-text-muted mb-3">{partialFailureLabel}</div>
            )}
            <MarkdownDiffPreview
              blocks={previewBlocks}
              syntaxTheme={syntaxTheme}
              baseContent={contents.base}
              targetContent={contents.target}
            />
          </div>
        )}

      {effectiveMode === 'full-preview' && (
        <div className="p-4">
          {isPreviewLoading && (
            <div className="text-sm text-github-text-muted mb-3">Loading preview...</div>
          )}
          {previewError && <div className="text-sm text-github-danger mb-3">{previewError}</div>}
          {partialFailureLabel && (
            <div className="text-sm text-github-text-muted mb-3">{partialFailureLabel}</div>
          )}
          {!isPreviewLoading && !previewError && fullPreviewContent !== null && (
            <MarkdownSplitPreview
              {...commentProps}
              baseContent={file.status === 'deleted' ? fullPreviewContent : null}
              targetContent={file.status === 'deleted' ? null : fullPreviewContent}
              layout="single"
            />
          )}
          {!isPreviewLoading && !previewError && fullPreviewContent === null && (
            <div className="text-sm text-github-text-muted">Preview unavailable.</div>
          )}
        </div>
      )}
    </div>
  );
}
