import { type Server } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import express, { type Express } from 'express';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type DiffMode } from '../types/watch.js';
import { formatCommentsOutput } from '../utils/commentFormatting.js';
import { getFileExtension } from '../utils/fileUtils.js';

import { FileWatcherService } from './file-watcher.js';
import { GitDiffParser } from './git-diff.js';

import {
  type Comment,
  type DiffResponse,
  type DiffViewMode,
  type RevisionsResponse,
} from '@/types/diff.js';

interface ServerOptions {
  targetCommitish?: string;
  baseCommitish?: string;
  stdinDiff?: string;
  preferredPort?: number;
  host?: string;
  openBrowser?: boolean;
  mode?: string;
  ignoreWhitespace?: boolean;
  clearComments?: boolean;
  diffMode?: DiffMode;
  repoPath?: string;
}

export async function startServer(
  options: ServerOptions
): Promise<{ port: number; url: string; isEmpty?: boolean; server?: Server }> {
  const app = express();
  const parser = new GitDiffParser(options.repoPath);
  const fileWatcher = new FileWatcherService();

  let diffDataCache: DiffResponse | null = null;
  let currentIgnoreWhitespace = options.ignoreWhitespace || false;
  const normalizeDiffMode = (mode?: string): DiffViewMode =>
    mode === 'inline' ? 'inline' : 'side-by-side';
  const diffMode = normalizeDiffMode(options.mode);

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
    const isValidCommit = await parser.validateCommit(options.targetCommitish ?? '');
    if (!isValidCommit) {
      throw new Error(`Invalid or non-existent commit: ${options.targetCommitish}`);
    }
  }

  // Generate initial diff data for isEmpty check
  if (options.stdinDiff) {
    // Parse stdin diff directly
    diffDataCache = parser.parseStdinDiff(options.stdinDiff);
  } else {
    diffDataCache = await parser.parseDiff(
      options.targetCommitish ?? '',
      options.baseCommitish ?? '',
      currentIgnoreWhitespace
    );
  }

  // Function to invalidate cache when file changes are detected
  const invalidateCache = () => {
    diffDataCache = null;
  };

  // Track current revisions for cache invalidation
  let currentBaseCommitish = options.baseCommitish ?? '';
  let currentTargetCommitish = options.targetCommitish ?? '';

  app.get('/api/diff', async (req, res) => {
    const ignoreWhitespace = req.query.ignoreWhitespace === 'true';
    const requestedBase = (req.query.base as string) || options.baseCommitish || '';
    const requestedTarget = (req.query.target as string) || options.targetCommitish || '';

    // Check if revisions or whitespace setting changed
    const revisionsChanged =
      requestedBase !== currentBaseCommitish || requestedTarget !== currentTargetCommitish;
    const whitespaceChanged = ignoreWhitespace !== currentIgnoreWhitespace;

    // Regenerate diff data if cache is invalid or settings changed
    if (!diffDataCache || ((revisionsChanged || whitespaceChanged) && !options.stdinDiff)) {
      currentIgnoreWhitespace = ignoreWhitespace;
      currentBaseCommitish = requestedBase;
      currentTargetCommitish = requestedTarget;
      diffDataCache = await parser.parseDiff(requestedTarget, requestedBase, ignoreWhitespace);
    }

    // Get repository identifier for storage isolation
    // Uses repository path for simplicity and worktree support
    let repositoryId: string | undefined;
    try {
      const repositoryPath = process.cwd();
      const crypto = await import('crypto');
      repositoryId = crypto.createHash('sha256').update(repositoryPath).digest('hex');
    } catch {
      // If we can't get repository path, leave undefined
    }

    res.json({
      ...diffDataCache,
      ignoreWhitespace,
      mode: diffMode,
      baseCommitish: currentBaseCommitish || 'stdin',
      targetCommitish: currentTargetCommitish || 'stdin',
      clearComments: options.clearComments,
      repositoryId,
    });
  });

  // Get available revisions for revision selector
  app.get('/api/revisions', async (_req, res) => {
    if (options.stdinDiff) {
      res.status(400).json({ error: 'Revision selection not available for stdin diff' });
      return;
    }

    try {
      const { branches, commits, resolvedBase, resolvedTarget } = await parser.getRevisionOptions(
        currentBaseCommitish,
        currentTargetCommitish
      );

      const response: RevisionsResponse = {
        specialOptions: [
          { value: '.', label: 'All Uncommitted Changes' },
          { value: 'staged', label: 'Staging Area' },
          { value: 'working', label: 'Working Directory' },
        ],
        branches,
        commits,
        resolvedBase,
        resolvedTarget,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching revisions:', error);
      res.status(500).json({ error: 'Failed to fetch revisions' });
    }
  });

  app.get(/^\/api\/blob\/(.*)$/, async (req, res) => {
    try {
      // If using stdin diff, blob content is not available
      if (options.stdinDiff) {
        res.status(404).json({ error: 'Blob content not available for stdin diff' });
        return;
      }

      const filepath = req.params[0];
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

  // Store comments for final output
  let finalComments: Comment[] = [];

  // Parse comments from request body (handles both JSON and text/plain)
  function parseCommentsPayload(body: unknown): Comment[] {
    const payload =
      typeof body === 'string' ?
        (JSON.parse(body) as { comments?: Comment[] })
      : (body as { comments?: Comment[] });

    return payload.comments || [];
  }

  app.post('/api/comments', (req, res) => {
    try {
      finalComments = parseCommentsPayload(req.body);
      res.json({ success: true });
    } catch (error) {
      console.error('Error parsing comments:', error);
      res.status(400).json({ error: 'Invalid comment data' });
    }
  });

  app.get('/api/comments-output', (_req, res) => {
    if (finalComments.length > 0) {
      const output = formatCommentsOutput(finalComments);
      res.send(output);
    } else {
      res.send('');
    }
  });

  // Function to output comments when server shuts down
  function outputFinalComments() {
    if (finalComments.length > 0) {
      console.log(formatCommentsOutput(finalComments));
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
      // Add a small delay to ensure any pending sendBeacon requests are processed
      setTimeout(async () => {
        console.log('Client disconnected, shutting down server...');

        // Stop file watcher
        await fileWatcher.stop();

        outputFinalComments();
        process.exit(0);
      }, 100);
    });
  });

  // Always runs in production mode when distributed as a CLI tool
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.NODE_ENV !== 'development';

  if (isProduction) {
    // Find client files relative to the CLI executable location
    const distPath = join(__dirname, '..', 'client');
    app.use(express.static(distPath));

    app.get('/{*splat}', (_req, res) => {
      res.sendFile(join(distPath, 'index.html'));
    });
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
    options.host || 'localhost'
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
      await fileWatcher.start(
        options.diffMode,
        options.repoPath || process.cwd(),
        300,
        invalidateCache
      );
    } catch (error) {
      console.warn('⚠️  File watcher failed to start:', error);
      console.warn('   Continuing without file watching...');
    }
  }

  // Check if diff is empty and skip browser opening
  if (diffDataCache?.isEmpty) {
    // Don't open browser if no differences found
  } else if (options.openBrowser) {
    try {
      await open(url);
    } catch {
      console.warn('Failed to open browser automatically');
    }
  }

  return { port, url, isEmpty: diffDataCache?.isEmpty || false, server };
}

async function startServerWithFallback(
  app: Express,
  preferredPort: number,
  host: string
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
