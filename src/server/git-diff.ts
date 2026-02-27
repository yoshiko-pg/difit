import { simpleGit, type SimpleGit } from 'simple-git';

import { validateDiffArguments, shortHash, createCommitRangeString } from '../cli/utils.js';
import { type DiffFile, type DiffChunk, type DiffLine, type DiffResponse } from '../types/diff.js';

import { isGeneratedFile } from './generated-file-check.js';

export class GitDiffParser {
  private git: SimpleGit;
  private repoPath: string;
  private readonly resolvedCommitCache = new Map<string, { value: string; expiresAt: number }>();
  private static readonly RESOLVED_COMMIT_CACHE_TTL_MS = 5_000;
  private static readonly GENERATED_HEADER_SCAN_BYTES = 4 * 1024;

  constructor(repoPath = process.cwd()) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async parseDiff(
    targetCommitish: string,
    baseCommitish: string,
    ignoreWhitespace = false,
  ): Promise<DiffResponse> {
    try {
      // Validate arguments
      const validation = validateDiffArguments(targetCommitish, baseCommitish);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      let resolvedCommit: string;
      let diffArgs: string[];

      // Handle target special chars (base is always a regular commit)
      if (targetCommitish === 'working') {
        // Show unstaged changes (working vs staged)
        resolvedCommit = 'Working Directory (unstaged changes)';
        diffArgs = [];
      } else if (targetCommitish === 'staged') {
        // Show staged changes against base commit
        const baseHash = await this.git.revparse([baseCommitish]);
        resolvedCommit = `${shortHash(baseHash)} vs Staging Area (staged changes)`;
        diffArgs = ['--cached', baseCommitish];
      } else if (targetCommitish === '.') {
        // Show all uncommitted changes against base commit
        const baseHash = await this.git.revparse([baseCommitish]);
        resolvedCommit = `${shortHash(baseHash)} vs Working Directory (all uncommitted changes)`;
        diffArgs = [baseCommitish];
      } else {
        // Both are regular commits: standard commit-to-commit comparison
        const targetHash = await this.git.revparse([targetCommitish]);
        const baseHash = await this.git.revparse([baseCommitish]);
        resolvedCommit = createCommitRangeString(shortHash(baseHash), shortHash(targetHash));
        diffArgs = [resolvedCommit];
      }

      if (ignoreWhitespace) {
        diffArgs.push('-w');
      }

      // Ignore external diff-tools to unify output.
      // https://github.com/yoshiko-pg/difit/issues/19
      diffArgs.push('--no-ext-diff', '--color=never');

      // Single git invocation for better startup latency on large repositories.
      const diffRaw = await this.git.diff(diffArgs);
      const files = this.parseUnifiedDiff(diffRaw);

      return {
        commit: resolvedCommit,
        files,
        isEmpty: files.length === 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse diff for ${targetCommitish} vs ${baseCommitish}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private parseUnifiedDiff(diffText: string): DiffFile[] {
    const files: DiffFile[] = [];
    const fileBlocks = diffText.split(/^diff --git /m).slice(1);

    for (const fileBlock of fileBlocks) {
      const block = `diff --git ${fileBlock}`;
      const file = this.parseFileBlock(block);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  private decodeGitPath(rawPath: string | undefined): string | undefined {
    if (typeof rawPath !== 'string') {
      return undefined;
    }

    const trimmed =
      rawPath.startsWith('"') && rawPath.endsWith('"') ? rawPath.slice(1, -1) : rawPath;

    const gitPrefixes = ['a/', 'b/', 'c/', 'i/', 'w/'];
    let withoutPrefix = trimmed;
    for (const prefix of gitPrefixes) {
      if (withoutPrefix.startsWith(prefix)) {
        withoutPrefix = withoutPrefix.slice(prefix.length);
        break;
      }
    }

    const tabIndex = withoutPrefix.indexOf('\t');
    if (tabIndex !== -1) {
      withoutPrefix = withoutPrefix.slice(0, tabIndex);
    }

    if (withoutPrefix === '/dev/null') {
      return undefined;
    }

    const bytes: number[] = [];
    for (let i = 0; i < withoutPrefix.length; i++) {
      const char = withoutPrefix[i];

      if (char === '\\' && i + 1 < withoutPrefix.length) {
        const next = withoutPrefix[i + 1];

        if (/[0-7]/.test(next)) {
          let octal = next;
          let read = 1;

          while (read < 3 && i + 1 + read < withoutPrefix.length) {
            const candidate = withoutPrefix[i + 1 + read];
            if (!/[0-7]/.test(candidate)) {
              break;
            }
            octal += candidate;
            read++;
          }

          bytes.push(parseInt(octal, 8));
          i += read; // Skip consumed digits
          continue;
        }

        switch (next) {
          case 't':
            bytes.push(0x09);
            break;
          case 'n':
            bytes.push(0x0a);
            break;
          case 'r':
            bytes.push(0x0d);
            break;
          case 'b':
            bytes.push(0x08);
            break;
          case 'f':
            bytes.push(0x0c);
            break;
          case 'v':
            bytes.push(0x0b);
            break;
          case 'a':
            bytes.push(0x07);
            break;
          case '\\':
            bytes.push(0x5c);
            break;
          case '"':
            bytes.push(0x22);
            break;
          case ' ':
            bytes.push(0x20);
            break;
          default:
            bytes.push(next.charCodeAt(0));
            break;
        }
        i++; // Skip the escaped character
        continue;
      }

      bytes.push(char.charCodeAt(0));
    }

    return Buffer.from(bytes).toString('utf8');
  }

  private extractPathFromLine(line: string | undefined, prefix: string): string | undefined {
    if (!line?.startsWith(prefix)) {
      return undefined;
    }

    return this.decodeGitPath(line.slice(prefix.length));
  }

  private parseDiffHeaderPaths(
    headerLine: string,
  ): { oldPath: string | undefined; newPath: string | undefined } | null {
    if (!headerLine.startsWith('diff --git ')) {
      return null;
    }

    const raw = headerLine.slice('diff --git '.length);
    const segments: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      const prevChar = i > 0 ? raw[i - 1] : null;

      if (char === '"' && prevChar !== '\\') {
        inQuotes = !inQuotes;
        current += char;
        continue;
      }

      if (char === ' ' && !inQuotes && prevChar !== '\\') {
        if (current) {
          segments.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current) {
      segments.push(current);
    }

    if (segments.length !== 2) {
      return null;
    }

    const [rawOldPath, rawNewPath] = segments;
    return {
      oldPath: this.decodeGitPath(rawOldPath),
      newPath: this.decodeGitPath(rawNewPath),
    };
  }

  private parseFileBlock(block: string): DiffFile | null {
    const lines = block.split('\n');
    const headerLine = lines[0];
    const headerPaths = this.parseDiffHeaderPaths(headerLine);

    const minusLine = lines.find((line) => line.startsWith('--- '));
    const plusLine = lines.find((line) => line.startsWith('+++ '));
    const renameFromLine = lines.find((line) => line.startsWith('rename from '));
    const renameToLine = lines.find((line) => line.startsWith('rename to '));

    const plusPath = this.extractPathFromLine(plusLine, '+++ ');
    const minusPath = this.extractPathFromLine(minusLine, '--- ');
    const renameFromPath = this.extractPathFromLine(renameFromLine, 'rename from ');
    const renameToPath = this.extractPathFromLine(renameToLine, 'rename to ');
    const newPath = renameToPath ?? plusPath ?? headerPaths?.newPath;
    const oldPath = renameFromPath ?? minusPath ?? headerPaths?.oldPath ?? newPath;

    if (!newPath) {
      return null;
    }

    const path = newPath;

    let status: DiffFile['status'] = 'modified';

    // Check for new file mode (added files)
    const newFileMode = lines.find((line) => line.startsWith('new file mode'));
    const deletedFileMode = lines.find((line) => line.startsWith('deleted file mode'));

    // Check for /dev/null which indicates added or deleted files
    if (newFileMode || minusLine?.includes('/dev/null')) {
      status = 'added';
    } else if (deletedFileMode || plusLine?.includes('/dev/null')) {
      status = 'deleted';
    } else if (oldPath !== newPath) {
      status = 'renamed';
    }

    // Common properties for all files
    const baseFile = {
      path,
      oldPath: status === 'renamed' && oldPath !== newPath ? oldPath : undefined,
      status,
    };

    // Parse chunks
    const chunks = this.parseChunks(lines);

    const { additions, deletions } = this.countLinesFromChunks(chunks);
    return {
      ...baseFile,
      additions,
      deletions,
      chunks,
      isGenerated: isGeneratedFile(path).isGenerated,
    };
  }

  private countLinesFromChunks(chunks: DiffChunk[]): {
    additions: number;
    deletions: number;
  } {
    let additions = 0;
    let deletions = 0;
    for (const chunk of chunks) {
      for (const line of chunk.lines) {
        if (line.type === 'add') additions++;
        else if (line.type === 'delete') deletions++;
      }
    }
    return { additions, deletions };
  }

  private parseChunks(lines: string[]): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    let currentChunk: DiffChunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }

        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
        if (match) {
          const oldStart = parseInt(match[1]);
          const oldLines = parseInt(match[2] || '1');
          const newStart = parseInt(match[3]);
          const newLines = parseInt(match[4] || '1');

          oldLineNum = oldStart;
          newLineNum = newStart;

          currentChunk = {
            header: line,
            oldStart,
            oldLines,
            newStart,
            newLines,
            lines: [],
          };
        }
      } else if (
        currentChunk &&
        (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))
      ) {
        const type = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'delete' : 'normal';

        const diffLine: DiffLine = {
          type,
          content: line.slice(1),
          oldLineNumber: type !== 'add' ? oldLineNum : undefined,
          newLineNumber: type !== 'delete' ? newLineNum : undefined,
        };

        currentChunk.lines.push(diffLine);

        if (type !== 'add') oldLineNum++;
        if (type !== 'delete') newLineNum++;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  async validateCommit(commitish: string): Promise<boolean> {
    try {
      if (commitish === '.' || commitish === 'working' || commitish === 'staged') {
        // For working directory or staging area, just check if we're in a git repo
        await this.git.status();
        return true;
      }
      await this.git.show([commitish, '--name-only']);
      return true;
    } catch {
      return false;
    }
  }

  parseStdinDiff(diffContent: string): DiffResponse {
    const files = this.parseUnifiedDiff(diffContent);

    return {
      commit: 'stdin diff',
      files,
      isEmpty: files.length === 0,
    };
  }

  async getBlobContent(filepath: string, ref: string): Promise<Buffer> {
    try {
      // For working directory, read directly from filesystem
      if (ref === 'working' || ref === '.') {
        const fs = await import('fs');
        const path = await import('path');
        const absolutePath = path.isAbsolute(filepath)
          ? filepath
          : path.resolve(this.repoPath, filepath);
        return fs.readFileSync(absolutePath);
      }

      // For git refs, we need to use child_process to execute git cat-file
      // to properly handle binary data
      const { execFileSync } = await import('child_process');

      // Handle staged files
      if (ref === 'staged') {
        // For staged files, use git show :filepath
        // Using execFileSync to prevent command injection
        const buffer = execFileSync('git', ['show', `:${filepath}`], {
          maxBuffer: 10 * 1024 * 1024, // 10MB limit
        });
        return buffer;
      }

      // First, get the blob hash for the file at the given ref
      // Using execFileSync to prevent command injection
      const blobHash = execFileSync('git', ['rev-parse', `${ref}:${filepath}`], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      }).trim();

      // Then use git cat-file to get the raw binary content
      // Increase maxBuffer to handle large files (default is 1024*1024 = 1MB)
      const buffer = execFileSync('git', ['cat-file', 'blob', blobHash], {
        maxBuffer: 10 * 1024 * 1024, // 10MB limit
      });

      return buffer;
    } catch (error) {
      // Check if it's a buffer size error
      if (
        error instanceof Error &&
        (error.message.includes('ENOBUFS') || error.message.includes('maxBuffer'))
      ) {
        throw new Error(`Image file ${filepath} is too large to display (over 10MB limit)`);
      }

      throw new Error(
        `Failed to get blob content for ${filepath} at ${ref}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getLineCount(filepath: string, ref: string): Promise<number> {
    const buffer = await this.getBlobContent(filepath, ref);
    let count = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x0a) count++; // newline byte
    }
    // If file doesn't end with newline, the last line still counts
    if (buffer.length > 0 && buffer[buffer.length - 1] !== 0x0a) {
      count++;
    }
    return count;
  }

  private extractHeaderLines(buffer: Buffer, maxLines = 20): string[] {
    const headerSlice = buffer.subarray(0, GitDiffParser.GENERATED_HEADER_SCAN_BYTES);
    return headerSlice.toString('utf8').split('\n').slice(0, maxLines);
  }

  async getGeneratedStatus(
    filepath: string,
    ref: string,
  ): Promise<{ isGenerated: boolean; source: 'path' | 'content' }> {
    const pathResult = isGeneratedFile(filepath);
    if (pathResult.isGenerated) {
      return { isGenerated: true, source: 'path' };
    }

    try {
      const buffer = await this.getBlobContent(filepath, ref);
      const lines = this.extractHeaderLines(buffer);
      const result = isGeneratedFile(filepath, () => lines);
      return { isGenerated: result.isGenerated, source: 'content' };
    } catch {
      return { isGenerated: false, source: 'path' };
    }
  }

  async resolveCommitish(commitish: string): Promise<string> {
    const now = Date.now();
    const cached = this.resolvedCommitCache.get(commitish);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const hash = await this.git.revparse([commitish]);
    const value = hash.substring(0, 7);

    this.resolvedCommitCache.set(commitish, {
      value,
      expiresAt: now + GitDiffParser.RESOLVED_COMMIT_CACHE_TTL_MS,
    });

    return value;
  }

  clearResolvedCommitCache(): void {
    this.resolvedCommitCache.clear();
  }

  async getDefaultBranch(): Promise<string | null> {
    try {
      // Try to get the default branch from origin/HEAD
      const result = await this.git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      // Result will be like "refs/remotes/origin/main\n"
      const match = result.trim().match(/refs\/remotes\/origin\/(.+)/);
      if (match) {
        return match[1];
      }
    } catch {
      // If origin/HEAD is not set, fall back to common default branches
      const commonDefaults = ['main', 'master'];
      const branchResult = await this.git.branchLocal();
      const branchNames = Object.keys(branchResult.branches);

      for (const defaultName of commonDefaults) {
        if (branchNames.includes(defaultName)) {
          return defaultName;
        }
      }
    }
    return null;
  }

  async getRevisionOptions(
    currentBase?: string,
    currentTarget?: string,
  ): Promise<{
    branches: Array<{ name: string; current: boolean }>;
    commits: Array<{ hash: string; shortHash: string; message: string }>;
    resolvedBase?: string;
    resolvedTarget?: string;
  }> {
    const [branchResult, logResult, defaultBranch] = await Promise.all([
      this.git.branchLocal(),
      this.git.log({ maxCount: 20 }),
      this.getDefaultBranch(),
    ]);

    const branches = Object.entries(branchResult.branches).map(([name, data]) => ({
      name,
      current: data.current,
    }));

    // Sort branches: default branch first, then current branch, then alphabetically
    branches.sort((a, b) => {
      if (defaultBranch) {
        if (a.name === defaultBranch) return -1;
        if (b.name === defaultBranch) return 1;
      }
      if (a.current && !b.current) return -1;
      if (!a.current && b.current) return 1;
      return a.name.localeCompare(b.name);
    });

    const commits = logResult.all.map((commit) => ({
      hash: commit.hash,
      shortHash: commit.hash.substring(0, 7),
      message: commit.message,
    }));

    // Resolve HEAD and HEAD^ to actual commit hashes if they're being used
    let resolvedBase: string | undefined;
    let resolvedTarget: string | undefined;

    if (currentBase && !['working', 'staged', '.'].includes(currentBase)) {
      try {
        resolvedBase = await this.resolveCommitish(currentBase);
      } catch {
        // If resolution fails, leave undefined
      }
    }

    if (currentTarget && !['working', 'staged', '.'].includes(currentTarget)) {
      try {
        resolvedTarget = await this.resolveCommitish(currentTarget);
      } catch {
        // If resolution fails, leave undefined
      }
    }

    return { branches, commits, resolvedBase, resolvedTarget };
  }
}
