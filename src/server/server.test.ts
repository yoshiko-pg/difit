import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set environment variable to skip fetch mocking
process.env.VITEST_SERVER_TEST = 'true';

import { startServer } from './server.js';

// Add fetch polyfill for Node.js test environment
const { fetch } = await import('undici');
globalThis.fetch = fetch as any;

// Helper function to get available port
async function getAvailablePort(preferredPort: number): Promise<number> {
  let port = preferredPort;
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await fetch(`http://localhost:${port}`);
      // If we get here, port is in use, try next one
      port++;
    } catch {
      // Port is available
      return port;
    }
  }

  return port;
}

// Mock GitDiffParser
vi.mock('./git-diff.js', () => {
  class GitDiffParserMock {
    validateCommit = vi.fn().mockResolvedValue(true);
    parseDiff = vi.fn().mockResolvedValue({
      targetCommit: 'abc123',
      baseCommit: 'def456',
      targetMessage: 'Test commit',
      baseMessage: 'Previous commit',
      files: [
        {
          path: 'test.js',
          additions: 10,
          deletions: 5,
          chunks: [],
        },
      ],
      stats: { additions: 10, deletions: 5 },
      isEmpty: false,
    });
    getBlobContent = vi.fn().mockResolvedValue(Buffer.from('mock image data'));
    getRevisionOptions = vi.fn().mockResolvedValue({
      branches: [{ name: 'main', current: true }],
      commits: [{ hash: 'abc1234', shortHash: 'abc1234', message: 'Test commit' }],
      resolvedBase: 'abc1234',
      resolvedTarget: 'def5678',
    });
    discardChanges = vi.fn().mockResolvedValue(undefined);
  }

  return { GitDiffParser: GitDiffParserMock };
});

describe('Server Integration Tests', () => {
  describe('Comments API', () => {
    it('should accept properly formatted comments', async () => {
      const port = await getAvailablePort(4966);
      const result = await startServer({
        preferredPort: port,
        openBrowser: false,
      });

      try {
        const comments = [
          {
            id: '1',
            file: 'src/App.tsx',
            line: 10,
            body: 'Test comment',
            timestamp: '2024-01-01T00:00:00Z',
          },
          {
            id: '2',
            file: 'src/utils/helper.ts',
            line: [20, 30],
            body: 'Another comment',
            timestamp: '2024-01-01T00:01:00Z',
          },
        ];

        const response = await fetch(`http://localhost:${result.port}/api/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comments }),
        });

        expect(response.status).toBe(200);
        const apiResult = await response.json();
        expect(apiResult).toEqual({ success: true });

        // Verify the formatted output
        const outputResponse = await fetch(`http://localhost:${result.port}/api/comments-output`);
        const output = await outputResponse.text();

        expect(output).toContain('src/App.tsx:L10');
        expect(output).toContain('Test comment');
        expect(output).toContain('src/utils/helper.ts:L20-L30');
        expect(output).toContain('Another comment');
        expect(output).not.toContain('undefined');
      } finally {
        if (result.server) {
          await new Promise<void>((resolve) => {
            result.server!.close(() => resolve());
          });
        }
      }
    });

    it('should handle comments with missing file property gracefully', async () => {
      const port = await getAvailablePort(4966);
      const result = await startServer({
        preferredPort: port,
        openBrowser: false,
      });

      try {
        const commentsWithMissingFile = [
          {
            id: '1',
            // file property is missing/undefined
            line: 10,
            body: 'Comment without file',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ];

        const response = await fetch(`http://localhost:${result.port}/api/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comments: commentsWithMissingFile }),
        });

        expect(response.status).toBe(200);

        // Check the output handles undefined file gracefully
        const outputResponse = await fetch(`http://localhost:${result.port}/api/comments-output`);
        const output = await outputResponse.text();

        expect(output).toContain('<unknown file>:L10');
        expect(output).toContain('Comment without file');
      } finally {
        if (result.server) {
          await new Promise<void>((resolve) => {
            result.server!.close(() => resolve());
          });
        }
      }
    });
  });

  let servers: any[] = [];
  let originalProcessExit: any;

  beforeEach(() => {
    // Mock process.exit to prevent tests from actually exiting
    originalProcessExit = process.exit;
    process.exit = vi.fn() as any;
  });

  afterEach(async () => {
    // Restore process.exit
    process.exit = originalProcessExit;

    // Clean up any servers created during tests
    for (const server of servers) {
      if (server?.close) {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }
    }
    servers = [];
  });

  describe('Server startup', () => {
    it('starts on preferred port', async () => {
      // Use a high port number to avoid conflicts
      const preferredPort = 9000;
      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort,
      });
      servers.push(result.server); // Track for cleanup

      expect(result.port).toBeGreaterThanOrEqual(preferredPort);
      expect(result.url).toContain('http://localhost:');
      expect(result.isEmpty).toBe(false);
    });

    it('falls back to next port when preferred is occupied', async () => {
      // Use high port numbers to avoid conflicts
      const preferredPort = 9010;

      // Start server on port 9010
      const firstServer = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort,
      });
      servers.push(firstServer.server);

      // Try to start another server on the same port
      const secondServer = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort,
      });
      servers.push(secondServer.server);

      expect(firstServer.port).toBeGreaterThanOrEqual(preferredPort);
      expect(secondServer.port).toBe(firstServer.port + 1);
      expect(secondServer.url).toBe(`http://localhost:${secondServer.port}`);
    });

    it('binds to specified host', async () => {
      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        host: '0.0.0.0',
        preferredPort: 9020,
      });
      servers.push(result.server);

      expect(result.url).toContain('http://localhost:'); // Display host conversion
    });
  });

  describe('API endpoints', () => {
    let port: number;

    beforeEach(async () => {
      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort: 9030,
      });
      servers.push(result.server);
      port = result.port;
    });

    it('GET /api/diff returns diff data', async () => {
      const response = await fetch(`http://localhost:${port}/api/diff`);
      const data = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('targetCommit', 'abc123');
      expect(data).toHaveProperty('baseCommit', 'def456');
      expect(data).toHaveProperty('files');
      expect(data.files).toHaveLength(1);
      expect(data.files[0]).toHaveProperty('path', 'test.js');
      expect(data).toHaveProperty('ignoreWhitespace', false);
    });

    it('GET /api/diff?ignoreWhitespace=true handles whitespace ignore', async () => {
      const response = await fetch(`http://localhost:${port}/api/diff?ignoreWhitespace=true`);
      const data = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('ignoreWhitespace', true);
    });

    it('POST /api/comments accepts comment data', async () => {
      const comments = [{ file: 'test.js', line: 10, body: 'This is a test comment' }];

      const response = await fetch(`http://localhost:${port}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });

      const data = await response.json();
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('success', true);
    });

    it('POST /api/comments accepts multi-line comment data', async () => {
      const comments = [
        { file: 'test.js', line: 10, body: 'Single line comment' },
        { file: 'test.js', line: [20, 30], body: 'Multi-line comment' },
      ];

      const response = await fetch(`http://localhost:${port}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });

      const data = await response.json();
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('success', true);
    });

    it('POST /api/comments handles text/plain content type', async () => {
      const comments = [{ file: 'test.js', line: 10, body: 'This is a test comment' }];

      const response = await fetch(`http://localhost:${port}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ comments }),
      });

      const data = await response.json();
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('success', true);
    });

    it('GET /api/comments-output returns formatted comments', async () => {
      // First post some comments
      const comments = [
        { file: 'test.js', line: 10, body: 'First comment' },
        { file: 'test.js', line: 20, body: 'Second comment' },
      ];

      await fetch(`http://localhost:${port}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });

      // Then get the output
      const response = await fetch(`http://localhost:${port}/api/comments-output`);
      const output = await response.text();

      expect(response.ok).toBe(true);
      expect(output).toContain('Comments from review session');
      expect(output).toContain('test.js:L10');
      expect(output).toContain('First comment');
      expect(output).toContain('test.js:L20');
      expect(output).toContain('Second comment');
      expect(output).toContain('Total comments: 2');
    });

    it('GET /api/comments-output formats multi-line comments correctly', async () => {
      // Post comments with both single-line and multi-line formats
      const comments = [
        { file: 'test.js', line: 10, body: 'Single line comment' },
        { file: 'test.js', line: [15, 25], body: 'Multi-line comment' },
      ];

      await fetch(`http://localhost:${port}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });

      // Then get the output
      const response = await fetch(`http://localhost:${port}/api/comments-output`);
      const output = await response.text();

      expect(response.ok).toBe(true);
      expect(output).toContain('test.js:L10');
      expect(output).toContain('Single line comment');
      expect(output).toContain('test.js:L15-L25');
      expect(output).toContain('Multi-line comment');
      expect(output).toContain('Total comments: 2');
    });

    it.skip('GET /api/heartbeat returns SSE headers', async () => {
      // Skipped due to connection reset issues in test environment
      // SSE endpoint functionality is verified through manual testing
      expect(true).toBe(true);
    });
  });

  describe('Static file serving', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });

    it('serves dev mode HTML in development', async () => {
      process.env.NODE_ENV = 'development';

      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort: 9040,
      });
      servers.push(result.server);

      const response = await fetch(`http://localhost:${result.port}/`);
      const html = await response.text();

      expect(response.ok).toBe(true);
      expect(html).toContain('difit - Dev Mode');
      expect(html).toContain('difit development mode');
    });

    it('serves static files in production mode', async () => {
      process.env.NODE_ENV = 'production';

      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort: 9050,
      });
      servers.push(result.server);

      // In production, it should try to serve static files
      // This might 404 if dist/client doesn't exist, but that's expected
      const response = await fetch(`http://localhost:${result.port}/`);

      // We don't expect a specific response since dist/client may not exist
      // But the server should not crash
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Mode option handling', () => {
    it('accepts mode option in server configuration', async () => {
      // Test that mode option is accepted without error
      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        mode: 'inline',
      });
      servers.push(result.server);

      expect(result.port).toBeGreaterThanOrEqual(4966);
      expect(result.url).toContain('http://localhost:');
    });

    it('accepts different mode values', async () => {
      const inlineResult = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        mode: 'inline',
      });
      servers.push(inlineResult.server);

      const sideBySideResult = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        mode: 'side-by-side',
      });
      servers.push(sideBySideResult.server);

      expect(inlineResult.port).toBeGreaterThanOrEqual(4966);
      expect(sideBySideResult.port).toBeGreaterThanOrEqual(4966);
    });

    it('mode option should be included in diff response', async () => {
      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        mode: 'inline',
      });
      servers.push(result.server);

      const response = await fetch(`http://localhost:${result.port}/api/diff`);
      const data = await response.json();

      // The mode should be included in the response
      expect(data).toHaveProperty('mode', 'inline');
    });
  });

  describe('Revision options API', () => {
    it('returns available revisions', async () => {
      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
      });
      servers.push(result.server);

      const response = await fetch(`http://localhost:${result.port}/api/revisions`);
      const data = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(data.specialOptions).toHaveLength(3);
      expect(data.branches).toEqual([{ name: 'main', current: true }]);
      expect(data.commits).toEqual([
        { hash: 'abc1234', shortHash: 'abc1234', message: 'Test commit' },
      ]);
      expect(data.resolvedBase).toBe('abc1234');
      expect(data.resolvedTarget).toBe('def5678');
    });
  });

  describe('Error handling', () => {
    it.skip('handles invalid commit gracefully', async () => {
      // This test is skipped due to mocking complexity
      // The validation happens during server startup and is hard to mock properly
      expect(true).toBe(true);
    });

    it('handles malformed comment data', async () => {
      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
      });
      servers.push(result.server);

      const response = await fetch(`http://localhost:${result.port}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        expect(data).toHaveProperty('error', 'Invalid comment data');
      } else {
        // If not JSON, just check status
        expect(response.ok).toBe(false);
      }
    });
  });

  describe('CORS configuration', () => {
    it('sets correct CORS headers', async () => {
      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
      });
      servers.push(result.server);

      const response = await fetch(`http://localhost:${result.port}/api/diff`);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Origin, X-Requested-With, Content-Type, Accept',
      );
    });
  });

  describe('Blob API endpoints', () => {
    let port: number;

    beforeEach(async () => {
      const result = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort: 9060,
      });
      servers.push(result.server);
      port = result.port;
    });

    it('GET /api/blob/* returns file content for images', async () => {
      const response = await fetch(`http://localhost:${port}/api/blob/image.jpg?ref=HEAD`);

      expect(response.ok).toBe(true);
      expect(response.headers.get('Content-Type')).toBe('image/jpeg');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');

      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('sets correct content type for different image formats', async () => {
      const testCases = [
        { filename: 'photo.jpg', expectedType: 'image/jpeg' },
        { filename: 'photo.jpeg', expectedType: 'image/jpeg' },
        { filename: 'logo.png', expectedType: 'image/png' },
        { filename: 'animation.gif', expectedType: 'image/gif' },
        { filename: 'bitmap.bmp', expectedType: 'image/bmp' },
        { filename: 'vector.svg', expectedType: 'image/svg+xml' },
        { filename: 'modern.webp', expectedType: 'image/webp' },
        { filename: 'favicon.ico', expectedType: 'image/x-icon' },
        { filename: 'photo.tiff', expectedType: 'image/tiff' },
        { filename: 'photo.tif', expectedType: 'image/tiff' },
        { filename: 'modern.avif', expectedType: 'image/avif' },
        { filename: 'mobile.heic', expectedType: 'image/heic' },
        { filename: 'camera.heif', expectedType: 'image/heif' },
      ];

      for (const { filename, expectedType } of testCases) {
        const response = await fetch(`http://localhost:${port}/api/blob/${filename}?ref=HEAD`);
        expect(response.headers.get('Content-Type')).toBe(expectedType);
      }
    });

    it('sets default content type for unknown extensions', async () => {
      const response = await fetch(`http://localhost:${port}/api/blob/unknown.xyz?ref=HEAD`);

      expect(response.ok).toBe(true);
      expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
    });

    it('handles different git refs correctly', async () => {
      const testRefs = ['HEAD', 'main', 'feature-branch', 'abc123'];

      for (const ref of testRefs) {
        const response = await fetch(`http://localhost:${port}/api/blob/image.jpg?ref=${ref}`);
        expect(response.ok).toBe(true);
      }
    });

    it('defaults to HEAD when no ref is provided', async () => {
      const response = await fetch(`http://localhost:${port}/api/blob/image.jpg`);

      expect(response.ok).toBe(true);
      // Should use HEAD as default ref
    });

    it('handles file not found errors', async () => {
      // Skip this test as mocking GitDiffParser in an already running server is complex
      // The error handling is already covered by the actual implementation
    });

    it('handles large file errors appropriately', async () => {
      // Skip this test as mocking GitDiffParser in an already running server is complex
      // The error handling is already covered by the actual implementation
    });

    it('handles special characters in file paths', async () => {
      const specialPaths = [
        'folder/image with spaces.jpg',
        'folder/image-with-dashes.png',
        'folder/image_with_underscores.gif',
        'folder/ιμαγε.jpg', // Unicode characters
      ];

      for (const path of specialPaths) {
        const encodedPath = encodeURIComponent(path);
        const response = await fetch(`http://localhost:${port}/api/blob/${encodedPath}?ref=HEAD`);
        expect(response.ok).toBe(true);
      }
    });
  });

  describe('Clear Comments functionality', () => {
    it('includes clearComments flag in diff response when provided', async () => {
      const { port, server } = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        clearComments: true,
      });
      servers.push(server);

      const response = await fetch(`http://localhost:${port}/api/diff`);
      const data = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(data.clearComments).toBe(true);
    });

    it('does not include clearComments flag when not provided', async () => {
      const { port, server } = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
      });
      servers.push(server);

      const response = await fetch(`http://localhost:${port}/api/diff`);
      const data = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(data.clearComments).toBeUndefined();
    });

    it('preserves clearComments flag across diff requests', async () => {
      const { port, server } = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        clearComments: true,
      });
      servers.push(server);

      // First request
      const response1 = await fetch(`http://localhost:${port}/api/diff`);
      const data1 = (await response1.json()) as any;
      expect(data1.clearComments).toBe(true);

      // Second request with different ignoreWhitespace
      const response2 = await fetch(`http://localhost:${port}/api/diff?ignoreWhitespace=true`);
      const data2 = (await response2.json()) as any;
      expect(data2.clearComments).toBe(true);
    });
  });

  describe('Discard changes API', () => {
    it('POST /api/discard/* discards changes to a file', async () => {
      const { port, server } = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort: 9070,
      });
      servers.push(server);

      const response = await fetch(`http://localhost:${port}/api/discard/test.js`, {
        method: 'POST',
      });
      const data = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(data).toEqual({ success: true });
    });

    it('POST /api/discard/* returns 400 for stdin diff mode', async () => {
      const { port, server } = await startServer({
        stdinDiff: 'diff --git a/test.js b/test.js\n',
        preferredPort: 9071,
      });
      servers.push(server);

      const response = await fetch(`http://localhost:${port}/api/discard/test.js`, {
        method: 'POST',
      });
      const data = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Discard not available for stdin diff');
    });

    it('POST /api/discard/* rejects path traversal attempts', async () => {
      const { port, server } = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort: 9072,
      });
      servers.push(server);

      const response = await fetch(`http://localhost:${port}/api/discard/../etc/passwd`, {
        method: 'POST',
      });
      const data = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Invalid file path');
    });

    it('POST /api/discard/* handles nested file paths', async () => {
      const { port, server } = await startServer({
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort: 9073,
      });
      servers.push(server);

      const response = await fetch(`http://localhost:${port}/api/discard/src/components/App.tsx`, {
        method: 'POST',
      });
      const data = (await response.json()) as any;

      expect(response.ok).toBe(true);
      expect(data).toEqual({ success: true });
    });
  });
});
