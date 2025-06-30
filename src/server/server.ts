import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import express from 'express';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { GitDiffParser } from './git-diff.js';

interface ServerOptions {
  targetCommitish: string;
  baseCommitish: string;
  preferredPort?: number;
  openBrowser?: boolean;
  mode?: string;
  ignoreWhitespace?: boolean;
}

export async function startServer(options: ServerOptions): Promise<{ port: number; url: string }> {
  const app = express();
  const parser = new GitDiffParser();

  let diffData: any = null;
  let currentIgnoreWhitespace = options.ignoreWhitespace || false;

  app.use(express.json());

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  const isValidCommit = await parser.validateCommit(options.targetCommitish);
  if (!isValidCommit) {
    throw new Error(`Invalid or non-existent commit: ${options.targetCommitish}`);
  }

  diffData = await parser.parseDiff(
    options.targetCommitish,
    options.baseCommitish,
    currentIgnoreWhitespace
  );

  app.get('/api/diff', async (req, res) => {
    const ignoreWhitespace = req.query.ignoreWhitespace === 'true';

    if (ignoreWhitespace !== currentIgnoreWhitespace) {
      currentIgnoreWhitespace = ignoreWhitespace;
      diffData = await parser.parseDiff(
        options.targetCommitish,
        options.baseCommitish,
        ignoreWhitespace
      );
    }

    res.json({ ...diffData, ignoreWhitespace });
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
      console.log('Client disconnected, shutting down server...');
      process.exit(0);
    });
  });

  // Always runs in production mode when distributed as a CLI tool
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.NODE_ENV !== 'development';

  if (isProduction) {
    // Find client files relative to the CLI executable location
    const distPath = join(__dirname, '..', 'client');
    app.use(express.static(distPath));

    app.get('*', (_req, res) => {
      res.sendFile(join(distPath, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>ReviewIt - Dev Mode</title>
          </head>
          <body>
            <div id="root"></div>
            <script>
              console.log('ReviewIt development mode');
              console.log('Diff data available at /api/diff');
            </script>
          </body>
        </html>
      `);
    });
  }

  const { port, url } = await startServerWithFallback(app, options.preferredPort || 3000);

  if (options.openBrowser) {
    try {
      await open(url);
    } catch (error) {
      console.warn('Failed to open browser automatically');
    }
  }

  return { port, url };
}

async function startServerWithFallback(
  app: any,
  preferredPort: number
): Promise<{ port: number; url: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(preferredPort, '127.0.0.1', () => {
      const port = server.address()?.port;
      const url = `http://localhost:${port}`;
      resolve({ port, url });
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${preferredPort} is busy, trying ${preferredPort + 1}...`);
        startServerWithFallback(app, preferredPort + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });
  });
}
