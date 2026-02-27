import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GitDiffParser } from './git-diff';

// Mock simple-git
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    revparse: vi.fn(),
    diff: vi.fn(),
  })),
}));

// Mock child_process
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();

  return {
    default: actual,
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

      expect(mockReadFileSync).toHaveBeenCalledWith('/test/repo/test.txt');
      expect(result).toBe(mockBuffer);
    });

    it('reads from filesystem for "." ref', async () => {
      const mockBuffer = Buffer.from('test content');
      mockReadFileSync.mockReturnValue(mockBuffer);

      const result = await parser.getBlobContent('test.txt', '.');

      expect(mockReadFileSync).toHaveBeenCalledWith('/test/repo/test.txt');
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
        'Image file large-file.jpg is too large to display (over 10MB limit)',
      );
    });

    it('handles ENOBUFS errors', async () => {
      const error = new Error('ENOBUFS: buffer overflow');
      mockExecFileSync.mockImplementation(() => {
        throw error;
      });

      await expect(parser.getBlobContent('large-file.jpg', 'HEAD')).rejects.toThrow(
        'Image file large-file.jpg is too large to display (over 10MB limit)',
      );
    });

    it('handles general git errors', async () => {
      const error = new Error('fatal: Path does not exist');
      mockExecFileSync.mockImplementation(() => {
        throw error;
      });

      await expect(parser.getBlobContent('missing.txt', 'HEAD')).rejects.toThrow(
        'Failed to get blob content for missing.txt at HEAD: fatal: Path does not exist',
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
        file: 'image.jpg',
        insertions: 0,
        deletions: 0,
        binary: true,
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
        isGenerated: false,
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
        file: 'old-image.png',
        insertions: 0,
        deletions: 0,
        binary: true,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'old-image.png',
        oldPath: undefined,
        status: 'deleted',
        additions: 0,
        deletions: 0,
        chunks: [],
        isGenerated: false,
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
        file: 'photo.jpg',
        insertions: 0,
        deletions: 0,
        binary: true,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'photo.jpg',
        oldPath: undefined,
        status: 'modified',
        additions: 0,
        deletions: 0,
        chunks: [],
        isGenerated: false,
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
        file: 'new-name.gif',
        from: 'old-name.gif',
        insertions: 0,
        deletions: 0,
        binary: true,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'new-name.gif',
        oldPath: 'old-name.gif',
        status: 'renamed',
        additions: 0,
        deletions: 0,
        chunks: [],
        isGenerated: false,
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
        file: 'script.js',
        insertions: 1,
        deletions: 0,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'script.js',
        oldPath: undefined,
        status: 'modified',
        additions: 1,
        deletions: 0,
        chunks: expect.any(Array), // Should have parsed chunks
        isGenerated: false,
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
        file: 'script.js',
        insertions: 0,
        deletions: 1,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toEqual({
        path: 'script.js',
        oldPath: undefined,
        status: 'modified',
        additions: 0,
        deletions: 1,
        chunks: expect.any(Array),
        isGenerated: false,
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
        file: 'new-file.txt',
        insertions: 2,
        deletions: 0,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result.status).toBe('added');
      expect(result.isGenerated).toBe(false);
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
        file: 'deleted-file.txt',
        insertions: 0,
        deletions: 2,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result.status).toBe('deleted');
      expect(result.isGenerated).toBe(false);
    });
  });

  describe('parseFileBlock with quoted paths', () => {
    it('parses file paths with spaces correctly', () => {
      const diffLines = [
        'diff --git "a/test with spaces/file name.txt" "b/test with spaces/file name.txt"',
        'new file mode 100644',
        'index 0000000..257cc56',
        '--- /dev/null',
        '+++ "b/test with spaces/file name.txt"',
        '@@ -0,0 +1 @@',
        '+foo',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('test with spaces/file name.txt');
      expect(result.status).toBe('added');
      expect(result.additions).toBe(1);
      expect(result.deletions).toBe(0);
      expect(result.isGenerated).toBe(false);
    });

    it('parses summary-provided filenames with escaped spaces', () => {
      const diffLines = [
        'diff --git "a/templates/test file.py" "b/templates/test file.py"',
        'index abc123..def456 100644',
        '--- "a/templates/test file.py"',
        '+++ "b/templates/test file.py"',
        '@@ -1 +1 @@',
        '-old',
        '+new',
      ];

      const summary = {
        file: 'templates/test\\040file.py',
        insertions: 1,
        deletions: 1,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result?.path).toBe('templates/test file.py');
      expect(result?.oldPath).toBeUndefined();
      expect(result?.isGenerated).toBe(false);
    });

    it('parses file paths with Jinja template brackets correctly', () => {
      const diffLines = [
        'diff --git "a/templates/test_000_{{ package_name }}/__.py" "b/templates/test_000_{{ package_name }}/__.py"',
        'new file mode 100644',
        'index 0000000..257cc56',
        '--- /dev/null',
        '+++ "b/templates/test_000_{{ package_name }}/__.py"',
        '@@ -0,0 +1 @@',
        '+test',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('templates/test_000_{{ package_name }}/__.py');
      expect(result.status).toBe('added');
      expect(result.isGenerated).toBe(false);
    });

    it('parses file paths with escaped characters correctly', () => {
      const diffLines = [
        'diff --git "a/file\\twith\\ttabs.txt" "b/file\\twith\\ttabs.txt"',
        'new file mode 100644',
        'index 0000000..257cc56',
        '--- /dev/null',
        '+++ "b/file\\twith\\ttabs.txt"',
        '@@ -0,0 +1 @@',
        '+content',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('file\twith\ttabs.txt');
      expect(result.status).toBe('added');
      expect(result.isGenerated).toBe(false);
    });

    it('parses renamed files with spaces correctly', () => {
      const diffLines = [
        'diff --git "a/old folder/old name.txt" "b/new folder/new name.txt"',
        'similarity index 100%',
        'rename from old folder/old name.txt',
        'rename to new folder/new name.txt',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('new folder/new name.txt');
      expect(result.oldPath).toBe('old folder/old name.txt');
      expect(result.status).toBe('renamed');
      expect(result.isGenerated).toBe(false);
    });

    it('still handles unquoted paths correctly', () => {
      const diffLines = [
        'diff --git a/src/file.js b/src/file.js',
        'index 1234567..8901234 100644',
        '--- a/src/file.js',
        '+++ b/src/file.js',
        '@@ -1,3 +1,3 @@',
        ' line1',
        '-old',
        '+new',
        ' line3',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('src/file.js');
      expect(result.status).toBe('modified');
      expect(result.additions).toBe(1);
      expect(result.deletions).toBe(1);
      expect(result.isGenerated).toBe(false);
    });

    it('handles unquoted paths with spaces when core.quotePath=false', () => {
      const diffLines = [
        'diff --git a/path with spaces/file.txt b/path with spaces/file.txt',
        'index 1234567..8901234 100644',
        '--- a/path with spaces/file.txt',
        '+++ b/path with spaces/file.txt',
        '@@ -1 +1 @@',
        '-old content',
        '+new content',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('path with spaces/file.txt');
      expect(result.status).toBe('modified');
      expect(result.additions).toBe(1);
      expect(result.deletions).toBe(1);
      expect(result.isGenerated).toBe(false);
    });

    it('decodes unquoted octal escapes in diff headers', () => {
      const diffLines = [
        'diff --git a/some\\040folder/file\\040name.ts b/some\\040folder/file\\040name.ts',
        'index 3333333..4444444 100644',
        '--- a/some\\040folder/file\\040name.ts',
        '+++ b/some\\040folder/file\\040name.ts',
        '@@ -1 +1 @@',
        '-old',
        '+new',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);

      expect(result?.path).toBe('some folder/file name.ts');
      expect(result?.oldPath).toBeUndefined();
      expect(result?.isGenerated).toBe(false);
    });

    it('handles unquoted paths containing "b/" in filename', () => {
      const diffLines = [
        'diff --git a/dir b/sub/file b/dir b/sub/file',
        'index 1234567..8901234 100644',
        '--- a/dir b/sub/file',
        '+++ b/dir b/sub/file',
        '@@ -1 +1 @@',
        '-old',
        '+new',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('dir b/sub/file');
      expect(result.oldPath).toBeUndefined();
      expect(result.status).toBe('modified');
      expect(result.isGenerated).toBe(false);
    });

    it('handles renamed files with "b/" in the path', () => {
      const diffLines = [
        'diff --git a/old b/path/file b/new b/path/file',
        'similarity index 100%',
        'rename from old b/path/file',
        'rename to new b/path/file',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('new b/path/file');
      expect(result.oldPath).toBe('old b/path/file');
      expect(result.status).toBe('renamed');
      expect(result.isGenerated).toBe(false);
    });

    it('handles alternative git diff prefixes for working tree comparisons', () => {
      const diffLines = [
        'diff --git c/a/test.txt w/a/test.txt',
        'index 1234567..8901234 100644',
        '--- c/a/test.txt',
        '+++ w/a/test.txt\t',
        '@@ -1 +1 @@',
        '-old',
        '+new',
      ];

      const summary = {
        file: 'a/test.txt',
        insertions: 1,
        deletions: 1,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toBeDefined();
      expect(result.path).toBe('a/test.txt');
      expect(result.oldPath).toBeUndefined();
      expect(result.status).toBe('modified');
      expect(result.isGenerated).toBe(false);
    });

    it('handles rename metadata with alternative git prefixes', () => {
      const diffLines = [
        'diff --git c/old/name.txt w/new/name.txt',
        'similarity index 100%',
        'rename from c/old/name.txt\t',
        'rename to w/new/name.txt\t',
      ];

      const summary = {
        file: 'new/name.txt',
        from: 'old/name.txt',
        insertions: 0,
        deletions: 0,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toBeDefined();
      expect(result.path).toBe('new/name.txt');
      expect(result.oldPath).toBe('old/name.txt');
      expect(result.status).toBe('renamed');
      expect(result.isGenerated).toBe(false);
    });

    it('ignores trailing metadata separators in diff path lines', () => {
      const diffLines = [
        'diff --git c/foo bar.txt w/foo bar.txt',
        'index 1234567..8901234 100644',
        '--- c/foo bar.txt\t',
        '+++ w/foo bar.txt\t',
        '@@ -1 +1 @@',
        '-old',
        '+new',
      ];

      const summary = {
        file: 'foo bar.txt',
        insertions: 1,
        deletions: 1,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toBeDefined();
      expect(result.path).toBe('foo bar.txt');
      expect(result.status).toBe('modified');
      expect(result.isGenerated).toBe(false);
    });

    it('prefers header paths over summary paths when they differ', () => {
      const diffLines = [
        'diff --git a/a/test.txt b/a/test.txt',
        'new file mode 100644',
        'index 0000000..257cc56',
        '--- /dev/null',
        '+++ b/a/test.txt',
        '@@ -0,0 +1 @@',
        '+content',
      ];

      const summary = {
        file: 'a/test.txt',
        insertions: 1,
        deletions: 0,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toBeDefined();
      expect(result?.path).toBe('a/test.txt');
      expect(result?.status).toBe('added');
      expect(result?.isGenerated).toBe(false);
    });

    it('does not treat added files as renamed even if summary includes from path', () => {
      const diffLines = [
        'diff --git a/test.js b/test.js',
        'new file mode 100644',
        'index 0000000..257cc56',
        '--- /dev/null',
        '+++ b/test.js',
        '@@ -0,0 +1 @@',
        '+console.log("test");',
      ];

      const summary = {
        file: 'test.js',
        from: 'c/test.js',
        insertions: 1,
        deletions: 0,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result).toBeDefined();
      expect(result?.status).toBe('added');
      expect(result?.oldPath).toBeUndefined();
      expect(result?.isGenerated).toBe(false);
    });

    it('parses file paths with octal escape sequences correctly', () => {
      const diffLines = [
        'diff --git "a/file\\303\\244.txt" "b/file\\303\\244.txt"',
        'new file mode 100644',
        'index 0000000..257cc56',
        '--- /dev/null',
        '+++ "b/file\\303\\244.txt"',
        '@@ -0,0 +1 @@',
        '+content',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('fileä.txt');
      expect(result.status).toBe('added');
      expect(result.isGenerated).toBe(false);
    });

    it('parses file paths with mixed escape sequences correctly', () => {
      const diffLines = [
        'diff --git "a/dir\\303\\251/file\\twith\\nmixed.txt" "b/dir\\303\\251/file\\twith\\nmixed.txt"',
        'new file mode 100644',
        'index 0000000..257cc56',
        '--- /dev/null',
        '+++ "b/dir\\303\\251/file\\twith\\nmixed.txt"',
        '@@ -0,0 +1 @@',
        '+test',
      ];

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), null);
      expect(result).toBeDefined();
      expect(result.path).toBe('diré/file\twith\nmixed.txt');
      expect(result.status).toBe('added');
      expect(result.isGenerated).toBe(false);
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
        file: 'test.txt',
        insertions: 5,
        deletions: 0,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result.status).toBe('added');
      expect(result.isGenerated).toBe(false);
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
        file: 'test.txt',
        insertions: 0,
        deletions: 5,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);

      expect(result.status).toBe('deleted');
      expect(result.isGenerated).toBe(false);
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
            isGenerated: false,
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
        isGenerated: false,
      });
      expect(result.files[1]).toMatchObject({
        path: 'file2.js',
        status: 'added',
        additions: 3,
        deletions: 0,
        isGenerated: false,
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
        isGenerated: false,
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
        isGenerated: false,
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
        isGenerated: false,
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
        isGenerated: false,
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
        isGenerated: false,
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

  describe('Generated file detection', () => {
    const lockFiles = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'Cargo.lock',
      'Gemfile.lock',
      'poetry.lock',
      'composer.lock',
      'Pipfile.lock',
      'go.sum',
      'go.mod',
      'pubspec.lock',
      'flake.lock',
    ];

    it.each(lockFiles)('detects %s as generated', (file) => {
      const diffLines = [
        `diff --git a/${file} b/${file}`,
        `index abc123..def456 100644`,
        `--- a/${file}`,
        `+++ b/${file}`,
        `@@ -1 +1 @@`,
        `-old`,
        `+new`,
      ];

      const summary = {
        file,
        insertions: 1,
        deletions: 1,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);
      expect(result.isGenerated).toBe(true);
    });

    it('defers content-based generated detection until getGeneratedStatus is called', async () => {
      const file = 'src/query.ts';
      const diffLines = [
        `diff --git a/${file} b/${file}`,
        `index abc123..def456 100644`,
        `--- a/${file}`,
        `+++ b/${file}`,
        `@@ -1 +1 @@`,
        `-old`,
        `+new`,
      ];

      // Mock git.diff
      const gitDiff = (parser as any).git.diff;
      gitDiff.mockResolvedValue(diffLines.join('\n'));
      (parser as any).git.revparse.mockResolvedValue('abc1234567890abcdef1234567890abcdef12');

      const getBlobContentSpy = vi.spyOn(parser as any, 'getBlobContent');
      getBlobContentSpy.mockResolvedValue(Buffer.from('// @generated\nconst x = 1;'));

      const response = await parser.parseDiff('HEAD', 'HEAD~1');

      expect(response.files[0].path).toBe(file);
      expect(response.files[0].isGenerated).toBe(false);
      expect(getBlobContentSpy).not.toHaveBeenCalled();

      const generatedStatus = await parser.getGeneratedStatus(file, 'HEAD');

      expect(getBlobContentSpy).toHaveBeenCalledTimes(1);
      expect(generatedStatus).toEqual({ isGenerated: true, source: 'content' });
    });

    it('returns source=path for path-based generated files without reading content', async () => {
      const getBlobContentSpy = vi.spyOn(parser as any, 'getBlobContent');
      const generatedStatus = await parser.getGeneratedStatus('package-lock.json', 'HEAD');

      expect(generatedStatus).toEqual({ isGenerated: true, source: 'path' });
      expect(getBlobContentSpy).not.toHaveBeenCalled();
    });

    it('returns false when content cannot be read for content-based generated detection', async () => {
      const getBlobContentSpy = vi.spyOn(parser as any, 'getBlobContent');
      getBlobContentSpy.mockRejectedValue(new Error('missing blob'));

      const generatedStatus = await parser.getGeneratedStatus('src/query.ts', 'HEAD');

      expect(generatedStatus).toEqual({ isGenerated: false, source: 'path' });
    });

    it('detects minified files as generated', () => {
      const minFiles = ['script.min.js', 'style.min.css', 'vendor/lib.min.js'];

      for (const file of minFiles) {
        const diffLines = [
          `diff --git a/${file} b/${file}`,
          `index abc123..def456 100644`,
          `--- a/${file}`,
          `+++ b/${file}`,
          `@@ -1 +1 @@`,
          `-old`,
          `+new`,
        ];

        const summary = {
          file,
          insertions: 1,
          deletions: 1,
          binary: false,
        };

        const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);
        expect(result.isGenerated).toBe(true);
      }
    });

    it('detects source maps as generated', () => {
      const file = 'main.js.map';
      const diffLines = [
        `diff --git a/${file} b/${file}`,
        `index abc123..def456 100644`,
        `--- a/${file}`,
        `+++ b/${file}`,
        `@@ -1 +1 @@`,
        `-old`,
        `+new`,
      ];

      const summary = {
        file,
        insertions: 1,
        deletions: 1,
        binary: false,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);
      expect(result.isGenerated).toBe(true);
    });

    it('does not mark normal files as generated', () => {
      const normalFiles = ['script.js', 'style.css', 'README.md', 'package.json'];

      for (const file of normalFiles) {
        const diffLines = [
          `diff --git a/${file} b/${file}`,
          `index abc123..def456 100644`,
          `--- a/${file}`,
          `+++ b/${file}`,
          `@@ -1 +1 @@`,
          `-old`,
          `+new`,
        ];

        const summary = {
          file,
          insertions: 1,
          deletions: 1,
          binary: false,
        };

        const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);
        expect(result.isGenerated).toBe(false);
      }
    });

    it('detects binary lock files as generated', () => {
      const file = 'yarn.lock';
      const diffLines = [
        `diff --git a/${file} b/${file}`,
        `index abc123..def456 100644`,
        `--- a/${file}`,
        `+++ b/${file}`,
        `Binary files a/${file} and b/${file} differ`,
      ];

      const summary = {
        file,
        insertions: 0,
        deletions: 0,
        binary: true,
      };

      const result = (parser as any).parseFileBlock(diffLines.join('\n'), summary);
      expect(result.isGenerated).toBe(true);
    });
  });
});
