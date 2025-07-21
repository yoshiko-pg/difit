import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GitDiffParser } from './git-diff';

// Mock simple-git
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    revparse: vi.fn(),
    diffSummary: vi.fn(),
    diff: vi.fn(),
  })),
}));

// Mock child_process
vi.mock('child_process', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    execSync: vi.fn(),
    execFileSync: vi.fn(),
  };
});

// Mock fs
vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

describe('GitDiffParser', () => {
  let parser: GitDiffParser;
  let mockExecFileSync: any;
  let mockReadFileSync: any;

  beforeEach(async () => {
    parser = new GitDiffParser('/test/repo');
    vi.clearAllMocks();

    // Get mocked functions
    const childProcess = await import('child_process');
    const fs = await import('fs');
    mockExecFileSync = childProcess.execFileSync;
    mockReadFileSync = fs.readFileSync;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBlobContent', () => {
    it('reads from filesystem for working directory', async () => {
      const mockBuffer = Buffer.from('test content');
      mockReadFileSync.mockReturnValue(mockBuffer);

      const result = await parser.getBlobContent('test.txt', 'working');

      expect(mockReadFileSync).toHaveBeenCalledWith('test.txt');
      expect(result).toBe(mockBuffer);
    });

    it('reads from filesystem for "." ref', async () => {
      const mockBuffer = Buffer.from('test content');
      mockReadFileSync.mockReturnValue(mockBuffer);

      const result = await parser.getBlobContent('test.txt', '.');

      expect(mockReadFileSync).toHaveBeenCalledWith('test.txt');
      expect(result).toBe(mockBuffer);
    });

    it('uses git show for staged files', async () => {
      const mockBuffer = Buffer.from('staged content');
      mockExecFileSync.mockReturnValue(mockBuffer);

      const result = await parser.getBlobContent('test.txt', 'staged');

      expect(mockExecFileSync).toHaveBeenCalledWith('git', ['show', ':test.txt'], {
        maxBuffer: 10 * 1024 * 1024,
      });
      expect(result).toBe(mockBuffer);
    });

    it('uses git cat-file for git refs', async () => {
      const blobHash = 'abc123def456';
      const mockBuffer = Buffer.from('git content');

      mockExecFileSync
        .mockReturnValueOnce(blobHash + '\n') // First call for rev-parse
        .mockReturnValueOnce(mockBuffer); // Second call for cat-file

      const result = await parser.getBlobContent('test.txt', 'HEAD');

      expect(mockExecFileSync).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD:test.txt'], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });
      expect(mockExecFileSync).toHaveBeenCalledWith('git', ['cat-file', 'blob', blobHash], {
        maxBuffer: 10 * 1024 * 1024,
      });
      expect(result).toBe(mockBuffer);
    });

    it('handles file size limit errors', async () => {
      const error = new Error('maxBuffer exceeded');
      mockExecFileSync.mockImplementation(() => {
        throw error;
      });

      await expect(parser.getBlobContent('large-file.jpg', 'HEAD')).rejects.toThrow(
        'Image file large-file.jpg is too large to display (over 10MB limit)'
      );
    });

    it('handles ENOBUFS errors', async () => {
      const error = new Error('ENOBUFS: buffer overflow');
      mockExecFileSync.mockImplementation(() => {
        throw error;
      });

      await expect(parser.getBlobContent('large-file.jpg', 'HEAD')).rejects.toThrow(
        'Image file large-file.jpg is too large to display (over 10MB limit)'
      );
    });

    it('handles general git errors', async () => {
      const error = new Error('fatal: Path does not exist');
      mockExecFileSync.mockImplementation(() => {
        throw error;
      });

      await expect(parser.getBlobContent('missing.txt', 'HEAD')).rejects.toThrow(
        'Failed to get blob content for missing.txt at HEAD: fatal: Path does not exist'
      );
    });
  });

  describe('parseFileBlock with binary files', () => {
    it('parses added binary file correctly', () => {
      const diffLines = [
        'diff --git a/image.jpg b/image.jpg',
        'new file mode 100644',
        'index 0000000..abc123',
        '--- /dev/null',
        '+++ b/image.jpg',
        'Binary files /dev/null and b/image.jpg differ',
      ];

      const summary = {
        insertions: 0,
        deletions: 0,
      };

      // Access private method for testing
      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'image.jpg',
        oldPath: undefined,
        status: 'added',
        additions: 0,
        deletions: 0,
        chunks: [], // Binary files should have empty chunks
      });
    });

    it('parses deleted binary file correctly', () => {
      const diffLines = [
        'diff --git a/old-image.png b/old-image.png',
        'deleted file mode 100644',
        'index abc123..0000000',
        '--- a/old-image.png',
        '+++ /dev/null',
        'Binary files a/old-image.png and /dev/null differ',
      ];

      const summary = {
        insertions: 0,
        deletions: 0,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'old-image.png',
        oldPath: undefined,
        status: 'deleted',
        additions: 0,
        deletions: 0,
        chunks: [],
      });
    });

    it('parses modified binary file correctly', () => {
      const diffLines = [
        'diff --git a/photo.jpg b/photo.jpg',
        'index abc123..def456 100644',
        '--- a/photo.jpg',
        '+++ b/photo.jpg',
        'Binary files a/photo.jpg and b/photo.jpg differ',
      ];

      const summary = {
        insertions: 0,
        deletions: 0,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'photo.jpg',
        oldPath: undefined,
        status: 'modified',
        additions: 0,
        deletions: 0,
        chunks: [],
      });
    });

    it('parses renamed binary file correctly', () => {
      const diffLines = [
        'diff --git a/old-name.gif b/new-name.gif',
        'similarity index 100%',
        'rename from old-name.gif',
        'rename to new-name.gif',
      ];

      const summary = {
        insertions: 0,
        deletions: 0,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'new-name.gif',
        oldPath: 'old-name.gif',
        status: 'renamed',
        additions: 0,
        deletions: 0,
        chunks: [],
      });
    });

    it('handles non-binary files normally', () => {
      const diffLines = [
        'diff --git a/script.js b/script.js',
        'index abc123..def456 100644',
        '--- a/script.js',
        '+++ b/script.js',
        '@@ -1,3 +1,4 @@',
        ' console.log("hello");',
        '+console.log("world");',
        ' // end',
      ];

      const summary = {
        insertions: 1,
        deletions: 0,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'script.js',
        oldPath: undefined,
        status: 'modified',
        additions: 1,
        deletions: 0,
        chunks: expect.any(Array), // Should have parsed chunks
      });

      // Verify chunks were parsed
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].header).toBe('@@ -1,3 +1,4 @@');
    });

    it('treats files with only deletions as modified', () => {
      const diffLines = [
        'diff --git a/script.js b/script.js',
        'index abc123..def456 100644',
        '--- a/script.js',
        '+++ b/script.js',
        '@@ -1,4 +1,3 @@',
        ' console.log("hello");',
        '-console.log("world");',
        ' // end',
      ];

      const summary = {
        insertions: 0,
        deletions: 1,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'script.js',
        oldPath: undefined,
        status: 'modified',
        additions: 0,
        deletions: 1,
        chunks: expect.any(Array),
      });
    });

    it('detects added files using /dev/null indicator', () => {
      const diffLines = [
        'diff --git a/new-file.txt b/new-file.txt',
        'index 0000000..abc123 100644',
        '--- /dev/null',
        '+++ b/new-file.txt',
        '@@ -0,0 +1,2 @@',
        '+line 1',
        '+line 2',
      ];

      const summary = {
        insertions: 2,
        deletions: 0,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result.status).toBe('added');
    });

    it('detects deleted files using /dev/null indicator', () => {
      const diffLines = [
        'diff --git a/deleted-file.txt b/deleted-file.txt',
        'index abc123..0000000 100644',
        '--- a/deleted-file.txt',
        '+++ /dev/null',
        '@@ -1,2 +0,0 @@',
        '-line 1',
        '-line 2',
      ];

      const summary = {
        insertions: 0,
        deletions: 2,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result.status).toBe('deleted');
    });
  });

  describe('File status detection improvements', () => {
    it('prioritizes new file mode over other indicators', () => {
      const diffLines = [
        'diff --git a/test.txt b/test.txt',
        'new file mode 100644',
        'index 0000000..abc123',
        '--- a/test.txt', // This might confuse simple parsers
        '+++ b/test.txt',
      ];

      const summary = {
        insertions: 5,
        deletions: 0,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result.status).toBe('added');
    });

    it('prioritizes deleted file mode over other indicators', () => {
      const diffLines = [
        'diff --git a/test.txt b/test.txt',
        'deleted file mode 100644',
        'index abc123..0000000',
        '--- a/test.txt',
        '+++ b/test.txt', // This might confuse simple parsers
      ];

      const summary = {
        insertions: 0,
        deletions: 5,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result.status).toBe('deleted');
    });
  });

  describe('parseStdinDiff', () => {
    it('should parse a simple unified diff', async () => {
      const diffContent = `diff --git a/test.txt b/test.txt
index abc123..def456 100644
--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,3 @@
 line1
-line2
+line2 modified
 line3`;

      const result = parser.parseStdinDiff(diffContent);

      expect(result).toMatchObject({
        commit: 'stdin diff',
        isEmpty: false,
        files: [
          {
            path: 'test.txt',
            status: 'modified',
            additions: 1,
            deletions: 1,
            chunks: expect.any(Array),
          },
        ],
      });

      expect(result.files[0].chunks).toHaveLength(1);
      expect(result.files[0].chunks[0].lines).toHaveLength(4);
    });

    it('should parse multiple files', async () => {
      const diffContent = `diff --git a/file1.txt b/file1.txt
index abc123..def456 100644
--- a/file1.txt
+++ b/file1.txt
@@ -1 +1 @@
-old content
+new content
diff --git a/file2.js b/file2.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/file2.js
@@ -0,0 +1,3 @@
+function hello() {
+  console.log('Hello');
+}`;

      const result = parser.parseStdinDiff(diffContent);

      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toMatchObject({
        path: 'file1.txt',
        status: 'modified',
        additions: 1,
        deletions: 1,
      });
      expect(result.files[1]).toMatchObject({
        path: 'file2.js',
        status: 'added',
        additions: 3,
        deletions: 0,
      });
    });

    it('should handle deleted files', async () => {
      const diffContent = `diff --git a/deleted.txt b/deleted.txt
deleted file mode 100644
index abc123..0000000
--- a/deleted.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-line1
-line2`;

      const result = parser.parseStdinDiff(diffContent);

      expect(result.files[0]).toMatchObject({
        path: 'deleted.txt',
        status: 'deleted',
        additions: 0,
        deletions: 2,
      });
    });

    it('should handle renamed files', async () => {
      const diffContent = `diff --git a/old-name.txt b/new-name.txt
similarity index 100%
rename from old-name.txt
rename to new-name.txt`;

      const result = parser.parseStdinDiff(diffContent);

      expect(result.files[0]).toMatchObject({
        path: 'new-name.txt',
        oldPath: 'old-name.txt',
        status: 'renamed',
        additions: 0,
        deletions: 0,
      });
    });

    it('should handle empty diff', async () => {
      const result = parser.parseStdinDiff('');

      expect(result).toMatchObject({
        commit: 'stdin diff',
        isEmpty: true,
        files: [],
      });
    });

    it('should count additions and deletions correctly', async () => {
      const diffContent = `diff --git a/test.txt b/test.txt
index abc123..def456 100644
--- a/test.txt
+++ b/test.txt
@@ -1,5 +1,6 @@
 unchanged line
-deleted line 1
-deleted line 2
+added line 1
+added line 2
+added line 3
 another unchanged
 final unchanged`;

      const result = parser.parseStdinDiff(diffContent);

      expect(result.files[0]).toMatchObject({
        additions: 3,
        deletions: 2,
      });
    });

    it('should handle diffs with multiple chunks', async () => {
      const diffContent = `diff --git a/test.txt b/test.txt
index abc123..def456 100644
--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,3 @@
 line1
-line2
+line2 modified
 line3
@@ -10,3 +10,4 @@
 line10
 line11
 line12
+line13 added`;

      const result = parser.parseStdinDiff(diffContent);

      expect(result.files[0].chunks).toHaveLength(2);
      expect(result.files[0]).toMatchObject({
        additions: 2,
        deletions: 1,
      });
    });

    it('should handle binary files', async () => {
      const diffContent = `diff --git a/image.png b/image.png
new file mode 100644
index 0000000..1234567
Binary files /dev/null and b/image.png differ`;

      const result = parser.parseStdinDiff(diffContent);

      expect(result.files[0]).toMatchObject({
        path: 'image.png',
        status: 'added',
        additions: 0,
        deletions: 0,
        chunks: [],
      });
    });

    it('should handle diffs with context lines', async () => {
      const diffContent = `diff --git a/test.txt b/test.txt
index abc123..def456 100644
--- a/test.txt
+++ b/test.txt
@@ -1,7 +1,7 @@
 context before 1
 context before 2
 context before 3
-old line
+new line
 context after 1
 context after 2
 context after 3`;

      const result = parser.parseStdinDiff(diffContent);

      const lines = result.files[0].chunks[0].lines;
      expect(lines.filter((l) => l.type === 'normal')).toHaveLength(6);
      expect(lines.filter((l) => l.type === 'delete')).toHaveLength(1);
      expect(lines.filter((l) => l.type === 'add')).toHaveLength(1);
    });
  });

  describe('countLinesFromChunks', () => {
    it('should count additions and deletions correctly', () => {
      const chunks = [
        {
          header: '@@ -1,3 +1,3 @@',
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          lines: [
            { type: 'normal' as const, content: 'line1' },
            { type: 'delete' as const, content: '-line2' },
            { type: 'add' as const, content: '+line2 modified' },
            { type: 'normal' as const, content: 'line3' },
          ],
        },
        {
          header: '@@ -5,2 +5,3 @@',
          oldStart: 5,
          oldLines: 2,
          newStart: 5,
          newLines: 3,
          lines: [
            { type: 'normal' as const, content: 'line5' },
            { type: 'add' as const, content: '+new line' },
            { type: 'normal' as const, content: 'line6' },
          ],
        },
      ];

      const result = (parser as any).countLinesFromChunks(chunks);
      expect(result).toEqual({ additions: 2, deletions: 1 });
    });
  });
});
