import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { type Server } from 'http';
import { join, dirname, isAbsolute, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

import express, { type Express } from 'express';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type DiffMode } from '../types/watch.js';
import { formatCommentsOutput } from '../utils/commentFormatting.js';
import {
  mergeCommentImports,
  normalizeCommentImports,
  serializeCommentImports,
} from '../utils/commentImports.js';
import { normalizeDiffViewMode } from '../utils/diffMode.js';
import {
  buildEditorSpawnSpec,
  CUSTOM_EDITOR_ID,
  NONE_EDITOR_ID,
  resolveEditorOption,
} from '../utils/editorOptions.js';
import { getFileExtension } from '../utils/fileUtils.js';

import { FileWatcherService } from './file-watcher.js';
import { GitDiffParser } from './git-diff.js';

import {
  type BaseMode,
  type CommentImport,
  type Comment,
  type CommentThread,
  type DiffCommentThread,
  type DiffResponse,
  type DiffSelection,
  type GeneratedStatusResponse,
  type RevisionsResponse,
} from '@/types/diff.js';
import {
  createDiffSelection,
  diffSelectionsEqual,
  getDiffSelectionKey,
} from '../utils/diffSelection.js';

interface ServerOptions {
  selection?: DiffSelection;
  stdinDiff?: string;
  preferredPort?: number;
  host?: string;
  openBrowser?: boolean;
  mode?: string;
  ignoreWhitespace?: boolean;
  clearComments?: boolean;
  commentImports?: CommentImport[];
  keepAlive?: boolean;
  diffMode?: DiffMode;
  repoPath?: string;
  contextLines?: number;
}

const GENERATED_STATUS_CACHE_TTL_MS = 60_000;
const MAX_DIFF_CACHE_ENTRIES = 8;

function createDiffCacheKey(selection: DiffSelection, ignoreWhitespace: boolean) {
  return `${getDiffSelectionKey(selection)}\u0000${ignoreWhitespace ? '1' : '0'}`;
}

function getCachedDiffResponse(
  cache: Map<string, DiffResponse>,
  key: string,
): DiffResponse | undefined {
  const cached = cache.get(key);
  if (!cached) {
    return undefined;
  }

  // Refresh insertion order to keep the most recently used entry.
  cache.delete(key);
  cache.set(key, cached);
  return cached;
}

function setCachedDiffResponse(cache: Map<string, DiffResponse>, key: string, value: DiffResponse) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);

  while (cache.size > MAX_DIFF_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== 'string') {
      break;
    }
    cache.delete(oldestKey);
  }
}

interface CommentSessionState {
  threads: DiffCommentThread[];
  version: number;
}

function createResolvedCommentSelection(
  responseDiffData: DiffResponse,
  fallbackSelection: DiffSelection,
  stdinDiff: boolean,
): DiffSelection {
  const baseCommitish =
    responseDiffData.baseCommitish ?? (stdinDiff ? 'stdin' : fallbackSelection.baseCommitish);
  const targetCommitish =
    responseDiffData.targetCommitish ?? (stdinDiff ? 'stdin' : fallbackSelection.targetCommitish);
  const baseMode = responseDiffData.requestedBaseMode ?? fallbackSelection.baseMode;

  return createDiffSelection(baseCommitish, targetCommitish, baseMode);
}

function createCommentSessionKey(selection: DiffSelection): string {
  return getDiffSelectionKey(selection);
}

export async function startServer(
  options: ServerOptions,
): Promise<{ port: number; url: string; isEmpty?: boolean; server?: Server }> {
  const app = express();
  const repositoryPath = resolve(options.repoPath ?? process.cwd());
  const repositoryId = createHash('sha256').update(repositoryPath).digest('hex');
  const initialCommentImports = options.commentImports || [];
  const initialSelection = options.selection ?? createDiffSelection('', '');
  const commentImportId =
    initialCommentImports.length > 0
      ? createHash('sha256').update(serializeCommentImports(initialCommentImports)).digest('hex')
      : undefined;
  const parser = new GitDiffParser(repositoryPath);
  const fileWatcher = new FileWatcherService();
  const generatedStatusCache = new Map<
    string,
    { value: GeneratedStatusResponse; expiresAt: number }
  >();
  const diffDataCache = new Map<string, DiffResponse>();
  const initialIgnoreWhitespace = options.ignoreWhitespace || false;
  const diffMode = normalizeDiffViewMode(options.mode);
  const parseBaseMode = (value: unknown): BaseMode | undefined => {
    if (value === 'merge-base') {
      return 'merge-base';
    }

    return undefined;
  };

  app.use(express.json());
  app.use(express.text()); // For sendBeacon text/plain requests

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Skip validation if using stdin diff
  if (!options.stdinDiff) {
    const isValidCommit = await parser.validateCommit(initialSelection.targetCommitish);
    if (!isValidCommit) {
      throw new Error(`Invalid or non-existent commit: ${initialSelection.targetCommitish}`);
    }
  }

  // Generate initial diff data for isEmpty check
  let initialDiffData: DiffResponse;
  if (options.stdinDiff) {
    // Parse stdin diff directly
    initialDiffData = parser.parseStdinDiff(options.stdinDiff);
  } else {
    initialDiffData = await parser.parseDiff(
      initialSelection,
      initialIgnoreWhitespace,
      options.contextLines,
    );
    setCachedDiffResponse(
      diffDataCache,
      createDiffCacheKey(initialSelection, initialIgnoreWhitespace),
      initialDiffData,
    );
  }

  // Function to invalidate cache when file changes are detected
  const invalidateCache = () => {
    diffDataCache.clear();
    generatedStatusCache.clear();
    parser.clearResolvedCommitCache();
  };

  // Track current revisions for cache invalidation
  let currentSelection = initialSelection;
  let currentCommentSelection = createResolvedCommentSelection(
    initialDiffData,
    initialSelection,
    Boolean(options.stdinDiff),
  );

  function parseRepositoryRelativePath(
    filepath: unknown,
  ):
    | { ok: true; path: string }
    | { ok: false; error: 'Invalid file path' | 'File path outside repository' } {
    if (typeof filepath !== 'string' || filepath.length === 0) {
      return { ok: false, error: 'Invalid file path' };
    }

    const normalizedFilepath = filepath.replace(/\\/g, '/');
    const hasParentTraversal = normalizedFilepath.split('/').some((segment) => segment === '..');
    if (isAbsolute(filepath) || normalizedFilepath.startsWith('/') || hasParentTraversal) {
      return { ok: false, error: 'File path outside repository' };
    }

    const resolvedPath = resolve(repositoryPath, normalizedFilepath);
    if (resolvedPath !== repositoryPath && !resolvedPath.startsWith(`${repositoryPath}${sep}`)) {
      return { ok: false, error: 'File path outside repository' };
    }

    return { ok: true, path: normalizedFilepath };
  }

  interface EditorRequest {
    readonly id: string | undefined;
    readonly command: string | undefined;
    readonly argsTemplate: string | undefined;
  }

  function parseEditorRequest(value: unknown): EditorRequest {
    if (!value || typeof value !== 'object') {
      return { id: undefined, command: undefined, argsTemplate: undefined };
    }
    const candidate = value as {
      id?: unknown;
      command?: unknown;
      argsTemplate?: unknown;
    };
    return {
      id: typeof candidate.id === 'string' ? candidate.id : undefined,
      command: typeof candidate.command === 'string' ? candidate.command : undefined,
      argsTemplate: typeof candidate.argsTemplate === 'string' ? candidate.argsTemplate : undefined,
    };
  }

  const commentSessions = new Map<string, CommentSessionState>();
  const initialCommentThreads = mergeCommentImports([], initialCommentImports).threads;
  if (initialCommentThreads.length > 0) {
    commentSessions.set(createCommentSessionKey(currentCommentSelection), {
      threads: initialCommentThreads,
      version: 1,
    });
  }

  function getCommentSelectionFromQuery(query: Record<string, unknown>): DiffSelection {
    const hasBase = typeof query.base === 'string';
    const hasTarget = typeof query.target === 'string';
    const hasBaseMode = typeof query.baseMode === 'string';

    if (!hasBase && !hasTarget && !hasBaseMode) {
      return currentCommentSelection;
    }

    return createDiffSelection(
      hasBase ? (query.base as string) : currentCommentSelection.baseCommitish,
      hasTarget ? (query.target as string) : currentCommentSelection.targetCommitish,
      hasBaseMode
        ? parseBaseMode(query.baseMode)
        : hasBase || hasTarget
          ? undefined
          : currentCommentSelection.baseMode,
    );
  }

  function getOrCreateCommentSession(selection: DiffSelection): CommentSessionState {
    const key = createCommentSessionKey(selection);
    const existing = commentSessions.get(key);
    if (existing) {
      return existing;
    }

    const nextSession: CommentSessionState = {
      threads: [],
      version: 0,
    };
    commentSessions.set(key, nextSession);
    return nextSession;
  }

  app.get('/api/diff', async (req, res) => {
    const ignoreWhitespace = req.query.ignoreWhitespace === 'true';
    const hasBase = typeof req.query.base === 'string';
    const hasTarget = typeof req.query.target === 'string';
    const hasBaseMode = typeof req.query.baseMode === 'string';
    const requestedSelection = createDiffSelection(
      hasBase ? (req.query.base as string) : currentSelection.baseCommitish,
      hasTarget ? (req.query.target as string) : currentSelection.targetCommitish,
      hasBaseMode
        ? parseBaseMode(req.query.baseMode)
        : hasBase || hasTarget
          ? undefined
          : currentSelection.baseMode,
    );
    const shouldIncludeCommentImports =
      initialCommentImports.length > 0 &&
      (Boolean(options.stdinDiff) || diffSelectionsEqual(requestedSelection, initialSelection));
    currentSelection = requestedSelection;

    let responseDiffData = initialDiffData;
    if (!options.stdinDiff) {
      const cacheKey = createDiffCacheKey(requestedSelection, ignoreWhitespace);
      const cached = getCachedDiffResponse(diffDataCache, cacheKey);
      if (cached) {
        responseDiffData = cached;
      } else {
        responseDiffData = await parser.parseDiff(
          requestedSelection,
          ignoreWhitespace,
          options.contextLines,
        );
        setCachedDiffResponse(diffDataCache, cacheKey, responseDiffData);
        generatedStatusCache.clear();
      }
    }

    currentCommentSelection = createResolvedCommentSelection(
      responseDiffData,
      requestedSelection,
      Boolean(options.stdinDiff),
    );

    const baseCommitish =
      responseDiffData.baseCommitish ?? (options.stdinDiff ? 'stdin' : undefined);
    const targetCommitish =
      responseDiffData.targetCommitish ?? (options.stdinDiff ? 'stdin' : undefined);
    const requestedBaseCommitish =
      responseDiffData.requestedBaseCommitish ??
      (requestedSelection.baseCommitish || (options.stdinDiff ? 'stdin' : undefined));
    const requestedTargetCommitish =
      responseDiffData.requestedTargetCommitish ??
      (requestedSelection.targetCommitish || (options.stdinDiff ? 'stdin' : undefined));
    const requestedBaseMode = responseDiffData.requestedBaseMode ?? requestedSelection.baseMode;

    res.json({
      ...responseDiffData,
      ignoreWhitespace,
      mode: diffMode,
      openInEditorAvailable: !options.stdinDiff,
      baseCommitish,
      targetCommitish,
      requestedBaseCommitish,
      requestedTargetCommitish,
      requestedBaseMode,
      clearComments: options.clearComments,
      repositoryId,
      commentImports: shouldIncludeCommentImports ? initialCommentImports : undefined,
      commentImportId: shouldIncludeCommentImports ? commentImportId : undefined,
    });
  });

  app.get(/^\/api\/generated-status\/(.*)$/, async (req, res) => {
    if (options.stdinDiff) {
      res.status(400).json({ error: 'Generated status is not available for stdin diff' });
      return;
    }

    try {
      const filepathResult = parseRepositoryRelativePath(req.params[0]);
      if (!filepathResult.ok) {
        res.status(400).json({ error: filepathResult.error });
        return;
      }
      const normalizedFilepath = filepathResult.path;

      const ref = (req.query.ref as string) || currentSelection.targetCommitish || 'HEAD';
      const cacheKey = `${ref}:${normalizedFilepath}`;
      const now = Date.now();
      const cached = generatedStatusCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        res.json(cached.value);
        return;
      }

      const status = await parser.getGeneratedStatus(normalizedFilepath, ref);
      const response: GeneratedStatusResponse = {
        path: normalizedFilepath,
        ref,
        ...status,
      };
      generatedStatusCache.set(cacheKey, {
        value: response,
        expiresAt: now + GENERATED_STATUS_CACHE_TTL_MS,
      });

      res.json(response);
    } catch (error) {
      console.error('Error fetching generated status:', error);
      res.status(500).json({ error: 'Failed to get generated status' });
    }
  });

  // Get available revisions for revision selector
  app.get('/api/revisions', async (_req, res) => {
    if (options.stdinDiff) {
      res.status(400).json({ error: 'Revision selection not available for stdin diff' });
      return;
    }

    try {
      const { branches, commits, originDefaultBranch, resolvedBase, resolvedTarget } =
        await parser.getRevisionOptions(
          currentSelection.baseCommitish,
          currentSelection.targetCommitish,
        );

      const response: RevisionsResponse = {
        specialOptions: [
          { value: '.', label: 'All Uncommitted Changes' },
          { value: 'staged', label: 'Staging Area' },
          { value: 'working', label: 'Working Directory' },
        ],
        branches,
        commits,
        originDefaultBranch,
        resolvedBase,
        resolvedTarget,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching revisions:', error);
      res.status(500).json({ error: 'Failed to fetch revisions' });
    }
  });

  app.get(/^\/api\/line-count\/(.*)$/, async (req, res) => {
    try {
      if (options.stdinDiff) {
        res.status(404).json({ error: 'Line count not available for stdin diff' });
        return;
      }

      const filepathResult = parseRepositoryRelativePath(req.params[0]);
      if (!filepathResult.ok) {
        res.status(400).json({ error: filepathResult.error });
        return;
      }
      const filepath = filepathResult.path;
      const oldRef = req.query.oldRef as string | undefined;
      const oldPathResult = req.query.oldPath
        ? parseRepositoryRelativePath(req.query.oldPath)
        : { ok: true as const, path: filepath };
      if (!oldPathResult.ok) {
        res.status(400).json({ error: oldPathResult.error });
        return;
      }
      const newRef = req.query.newRef as string | undefined;
      const oldPath = oldPathResult.path;

      const result: { oldLineCount?: number; newLineCount?: number } = {};

      if (oldRef) {
        try {
          result.oldLineCount = await parser.getLineCount(oldPath, oldRef);
        } catch {
          result.oldLineCount = 0;
        }
      }
      if (newRef) {
        try {
          result.newLineCount = await parser.getLineCount(filepath, newRef);
        } catch {
          result.newLineCount = 0;
        }
      }

      res.json(result);
    } catch (error) {
      console.error('Error fetching line count:', error);
      res.status(500).json({ error: 'Failed to get line count' });
    }
  });

  app.get(/^\/api\/blob\/(.*)$/, async (req, res) => {
    try {
      // If using stdin diff, blob content is not available
      if (options.stdinDiff) {
        res.status(404).json({ error: 'Blob content not available for stdin diff' });
        return;
      }

      const filepathResult = parseRepositoryRelativePath(req.params[0]);
      if (!filepathResult.ok) {
        res.status(400).json({ error: filepathResult.error });
        return;
      }
      const filepath = filepathResult.path;
      const ref = (req.query.ref as string) || 'HEAD';

      const blob = await parser.getBlobContent(filepath, ref);

      // Determine content type based on file extension
      const ext = getFileExtension(filepath);
      const contentTypes: { [key: string]: string } = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        bmp: 'image/bmp',
        svg: 'image/svg+xml',
        webp: 'image/webp',
        ico: 'image/x-icon',
        tiff: 'image/tiff',
        tif: 'image/tiff',
        avif: 'image/avif',
        heic: 'image/heic',
        heif: 'image/heif',
      };

      const contentType = contentTypes[ext || ''] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(blob);
    } catch (error) {
      console.error('Error fetching blob:', error);
      res.status(404).json({ error: 'File not found' });
    }
  });

  function normalizeLineValue(line: unknown): DiffCommentThread['position']['line'] {
    if (Array.isArray(line) && line.length === 2) {
      const start = line[0] as unknown;
      const end = line[1] as unknown;
      if (
        typeof start === 'number' &&
        typeof end === 'number' &&
        Number.isInteger(start) &&
        Number.isInteger(end) &&
        start > 0 &&
        end > 0 &&
        start <= end
      ) {
        return { start, end };
      }
    }

    if (typeof line === 'number' && Number.isInteger(line) && line > 0) {
      return line;
    }

    return 1;
  }

  function normalizeComment(comment: Comment): DiffCommentThread {
    const now = new Date().toISOString();
    const timestamp = typeof comment.timestamp === 'string' ? comment.timestamp : now;
    const threadId =
      typeof comment.id === 'string' && comment.id.length > 0
        ? comment.id
        : createHash('sha256').update(JSON.stringify(comment)).digest('hex').slice(0, 12);
    const filePath =
      typeof comment.file === 'string' && comment.file.length > 0 ? comment.file : '<unknown file>';

    return {
      id: threadId,
      filePath,
      createdAt: timestamp,
      updatedAt: timestamp,
      position: {
        side: comment.side ?? 'new',
        line: normalizeLineValue(comment.line),
      },
      codeSnapshot:
        typeof comment.codeContent === 'string'
          ? {
              content: comment.codeContent,
            }
          : undefined,
      messages: [
        {
          id: threadId,
          body: comment.body,
          author: comment.author,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    };
  }

  function toCommentThread(thread: DiffCommentThread): CommentThread {
    return {
      id: thread.id,
      file: thread.filePath,
      line:
        typeof thread.position.line === 'number'
          ? thread.position.line
          : ([thread.position.line.start, thread.position.line.end] as [number, number]),
      side: thread.position.side,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      codeContent: thread.codeSnapshot?.content,
      messages: thread.messages,
    };
  }

  function normalizeThreadPayload(thread: CommentThread | DiffCommentThread): DiffCommentThread {
    if ('filePath' in thread && 'position' in thread) {
      return thread;
    }

    const threadId =
      typeof thread.id === 'string' && thread.id.length > 0
        ? thread.id
        : createHash('sha256').update(JSON.stringify(thread)).digest('hex').slice(0, 12);
    const now = new Date().toISOString();
    const messages =
      Array.isArray(thread.messages) && thread.messages.length > 0
        ? thread.messages.map((message, index) => ({
            id:
              typeof message.id === 'string' && message.id.length > 0
                ? message.id
                : `${threadId}:${index}`,
            body: message.body,
            author: message.author,
            createdAt: message.createdAt || thread.createdAt || now,
            updatedAt: message.updatedAt || message.createdAt || thread.updatedAt || now,
          }))
        : [
            {
              id: threadId,
              body: '',
              createdAt: thread.createdAt || now,
              updatedAt: thread.updatedAt || thread.createdAt || now,
            },
          ];
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    return {
      id: threadId,
      filePath:
        typeof thread.file === 'string' && thread.file.length > 0 ? thread.file : '<unknown file>',
      createdAt: thread.createdAt || firstMessage?.createdAt || now,
      updatedAt: thread.updatedAt || lastMessage?.updatedAt || thread.createdAt || now,
      position: {
        side: thread.side ?? 'new',
        line: normalizeLineValue(thread.line),
      },
      codeSnapshot:
        typeof thread.codeContent === 'string'
          ? {
              content: thread.codeContent,
            }
          : undefined,
      messages,
    };
  }

  function parseCommentsPayload(body: unknown): DiffCommentThread[] {
    const payload =
      typeof body === 'string'
        ? (JSON.parse(body) as {
            comments?: Comment[];
            threads?: Array<CommentThread | DiffCommentThread>;
          })
        : (body as {
            comments?: Comment[];
            threads?: Array<CommentThread | DiffCommentThread>;
          });

    if (Array.isArray(payload.threads)) {
      return payload.threads.map(normalizeThreadPayload);
    }

    if (Array.isArray(payload.comments)) {
      return payload.comments.map(normalizeComment);
    }

    return [];
  }

  function parseCommentImportsPayload(body: unknown): CommentImport[] {
    if (typeof body === 'string') {
      return normalizeCommentImports(JSON.parse(body));
    }

    return normalizeCommentImports(body);
  }

  function updateCommentSession(
    selection: DiffSelection,
    nextThreads: DiffCommentThread[],
  ): boolean {
    const session = getOrCreateCommentSession(selection);
    const previous = JSON.stringify(session.threads);
    const next = JSON.stringify(nextThreads);
    session.threads = nextThreads;

    if (previous === next) {
      return false;
    }

    session.version += 1;
    fileWatcher.broadcast({
      type: 'commentsChanged',
      version: session.version,
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  app.post('/api/comments', (req, res) => {
    try {
      const selection = getCommentSelectionFromQuery(req.query as Record<string, unknown>);
      const nextThreads = parseCommentsPayload(req.body);
      updateCommentSession(selection, nextThreads);
      res.json({ success: true });
    } catch (error) {
      console.error('Error parsing comments:', error);
      res.status(400).json({ error: 'Invalid comment data' });
    }
  });

  app.post('/api/comment-imports', (req, res) => {
    try {
      const selection = getCommentSelectionFromQuery(req.query as Record<string, unknown>);
      const session = getOrCreateCommentSession(selection);
      const commentImports = parseCommentImportsPayload(req.body);
      const importId = createHash('sha256')
        .update(serializeCommentImports(commentImports))
        .digest('hex');
      const merged = mergeCommentImports(session.threads, commentImports);
      const changed = updateCommentSession(selection, merged.threads);

      res.json({
        success: true,
        changed,
        count: commentImports.length,
        importId,
        warnings: merged.warnings,
      });
    } catch (error) {
      console.error('Error parsing comment imports:', error);
      res.status(400).json({ error: 'Invalid comment import data' });
    }
  });

  app.get('/api/comments-json', (req, res) => {
    const selection = getCommentSelectionFromQuery(req.query as Record<string, unknown>);
    const session = getOrCreateCommentSession(selection);
    res.json({
      version: session.version,
      threads: session.threads,
    });
  });

  app.get('/api/comments-output', (req, res) => {
    const selection = getCommentSelectionFromQuery(req.query as Record<string, unknown>);
    const session = getOrCreateCommentSession(selection);
    res.type('text/plain');

    if (session.threads.length > 0) {
      const output = formatCommentsOutput(session.threads.map(toCommentThread));
      res.send(output);
    } else {
      res.send('');
    }
  });

  app.post('/api/open-in-editor', async (req, res) => {
    if (options.stdinDiff) {
      res.status(400).json({ error: 'Open in editor is not available for stdin diff' });
      return;
    }

    const { filePath, line, editor } = (req.body ?? {}) as {
      filePath?: unknown;
      line?: unknown;
      editor?: unknown;
    };

    if (typeof filePath !== 'string') {
      res.status(400).json({ error: 'Invalid request payload' });
      return;
    }

    const filepathResult = parseRepositoryRelativePath(filePath);
    if (!filepathResult.ok) {
      res.status(400).json({ error: filepathResult.error });
      return;
    }
    const resolvedPath = resolve(repositoryPath, filepathResult.path);

    const editorRequest = parseEditorRequest(editor);
    const editorId =
      editorRequest.id ?? process.env.DIFIT_EDITOR ?? process.env.EDITOR ?? undefined;

    if (editorId?.toLowerCase() === NONE_EDITOR_ID) {
      res.status(400).json({ error: 'Open in editor is disabled' });
      return;
    }

    // The browser always sends command + argsTemplate in the body, so we use
    // those directly. We only fall back to the preset table when neither is
    // provided (for example, when DIFIT_EDITOR is set and there's no body).
    let command: string;
    let argsTemplate: string;
    if (editorRequest.command !== undefined || editorRequest.argsTemplate !== undefined) {
      command = (editorRequest.command ?? '').trim();
      argsTemplate = (editorRequest.argsTemplate ?? '').trim();
    } else {
      const preset = resolveEditorOption(editorId);
      command = preset.command;
      argsTemplate = preset.argsTemplate;
    }

    if (!command || !argsTemplate) {
      const isCustom = editorId?.toLowerCase() === CUSTOM_EDITOR_ID;
      res.status(400).json({
        error: isCustom
          ? 'Custom editor is not configured. Set a command and arguments in Settings > System.'
          : 'Open in editor is not configured',
      });
      return;
    }

    const lineNumber = (() => {
      const parsed = Number.parseInt(String(line ?? ''), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })();

    const spawnSpec = buildEditorSpawnSpec({
      command,
      argsTemplate,
      filePath: resolvedPath,
      lineNumber,
    });

    if (!spawnSpec) {
      res.status(500).json({ error: 'Invalid editor configuration' });
      return;
    }

    const launched = await new Promise<boolean>((resolvePromise) => {
      const child = spawn(spawnSpec.command, [...spawnSpec.args], {
        stdio: 'ignore',
        detached: true,
      });
      child.once('error', (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code && code !== 'ENOENT') {
          console.error('Failed to launch editor CLI:', error);
        }
        resolvePromise(false);
      });
      child.once('spawn', () => {
        child.unref();
        resolvePromise(true);
      });
    });

    if (!launched) {
      res.status(500).json({
        error: `Failed to launch editor: command "${spawnSpec.command}" is not available on PATH`,
      });
      return;
    }

    res.json({ success: true });
  });

  // Function to output comments when server shuts down
  function outputFinalComments() {
    const session = getOrCreateCommentSession(currentCommentSelection);
    if (session.threads.length > 0) {
      console.log(formatCommentsOutput(session.threads.map(toCommentThread)));
    }
  }

  // SSE endpoint for file watching
  app.get('/api/watch', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    fileWatcher.addClient(res);

    req.on('close', () => {
      fileWatcher.removeClient(res);
    });
  });

  // SSE endpoint to detect when tab is closed
  app.get('/api/heartbeat', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial heartbeat
    res.write('data: connected\n\n');

    // Send heartbeat every 5 seconds
    const heartbeatInterval = setInterval(() => {
      res.write('data: heartbeat\n\n');
    }, 5000);

    // When client disconnects (tab closed, navigation, etc.)
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      if (options.keepAlive) {
        console.log('Client disconnected, but server is staying alive (--keep-alive)');
        console.log('Press Ctrl+C to stop the server');
      } else {
        // Add a small delay to ensure any pending sendBeacon requests are processed
        setTimeout(async () => {
          console.log('Client disconnected, shutting down server...');

          // Stop file watcher
          await fileWatcher.stop();

          outputFinalComments();
          process.exit(0);
        }, 100);
      }
    });
  });

  // Always runs in production mode when distributed as a CLI tool
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.NODE_ENV !== 'development';

  if (isProduction) {
    // Find client files relative to the CLI executable location
    const distPath = join(__dirname, '..', 'client');
    app.use(express.static(distPath));
  } else {
    app.get('/', (_req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>difit - Dev Mode</title>
          </head>
          <body>
            <div id="root"></div>
            <script>
              console.log('difit development mode');
              console.log('Diff data available at /api/diff');
            </script>
          </body>
        </html>
      `);
    });
  }

  const { port, url, server } = await startServerWithFallback(
    app,
    options.preferredPort || 4966,
    options.host || 'localhost',
  );

  // Security warning for non-localhost binding
  if (options.host && options.host !== '127.0.0.1' && options.host !== 'localhost') {
    console.warn('\n⚠️  WARNING: Server is accessible from external network!');
    console.warn(`   Binding to: ${options.host}:${port}`);
    console.warn('   Make sure this is intended and your network is secure.\n');
  }

  // Start file watcher
  if (options.diffMode) {
    try {
      await fileWatcher.start(options.diffMode, repositoryPath, 300, invalidateCache);
    } catch (error) {
      console.warn('⚠️  File watcher failed to start:', error);
      console.warn('   Continuing without file watching...');
    }
  }

  // Check if diff is empty and skip browser opening
  if (initialDiffData.isEmpty) {
    // Don't open browser if no differences found
  } else if (options.openBrowser) {
    try {
      await open(url);
    } catch {
      console.warn('Failed to open browser automatically');
    }
  }

  return { port, url, isEmpty: initialDiffData.isEmpty || false, server };
}

async function startServerWithFallback(
  app: Express,
  preferredPort: number,
  host: string,
): Promise<{ port: number; url: string; server: Server }> {
  return new Promise((resolve, reject) => {
    // express's listen() method uses listen() method in node:net Server instance internally
    // https://expressjs.com/en/5x/api.html#app.listen
    // so, an error will be an instance of NodeJS.ErrnoException
    const server = app.listen(preferredPort, host, (err: NodeJS.ErrnoException | undefined) => {
      const displayHost = host === '0.0.0.0' ? 'localhost' : host;
      const url = `http://${displayHost}:${preferredPort}`;
      if (!err) {
        resolve({ port: preferredPort, url, server });
        return;
      }

      // Handling errors when failed to launch a server
      switch (err.code) {
        // Try another port until it succeeds
        case 'EADDRINUSE': {
          console.log(`Port ${preferredPort} is busy, trying ${preferredPort + 1}...`);
          return startServerWithFallback(app, preferredPort + 1, host)
            .then(({ port, url, server }) => {
              resolve({ port, url, server });
            })
            .catch(reject);
        }
        // Unexpected error
        default: {
          reject(new Error(`Failed to launch a server: ${err.message}`));
        }
      }
    });
  });
}
