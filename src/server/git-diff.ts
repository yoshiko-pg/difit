import {
  simpleGit,
  type SimpleGit,
  type DiffResult,
  type DiffResultTextFile,
  type DiffResultBinaryFile,
  type DiffResultNameStatusFile,
} from 'simple-git';

import { validateDiffArguments, shortHash, createCommitRangeString } from '../cli/utils.js';
import { type DiffFile, type DiffChunk, type DiffLine, type DiffResponse } from '../types/diff.js';

export class GitDiffParser {
  private git: SimpleGit;

  constructor(repoPath = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async parseDiff(
    targetCommitish: string,
    baseCommitish: string,
    ignoreWhitespace = false
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

      // Add --color=never to ensure plain text output without ANSI escape sequences
      const diffSummary = await this.git.diffSummary(diffArgs);
      const diffRaw = await this.git.diff(['--color=never', ...diffArgs]);

      const files = this.parseUnifiedDiff(diffRaw, diffSummary.files);

      return {
        commit: resolvedCommit,
        files,
        isEmpty: files.length === 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse diff for ${targetCommitish} vs ${baseCommitish}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseUnifiedDiff(diffText: string, summary: DiffResult['files']): DiffFile[] {
    const files: DiffFile[] = [];
    const fileBlocks = diffText.split(/^diff --git /m).slice(1);

    for (let i = 0; i < fileBlocks.length; i++) {
      const block = `diff --git ${fileBlocks[i]}`;
      const summaryItem = summary[i];

      // For stdin diff, we don't have summary
      if (!summaryItem) {
        const file = this.parseFileBlock(block, null);
        if (file) {
          files.push(file);
        }
        continue;
      }

      const file = this.parseFileBlock(block, summaryItem);
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
    const withoutPrefix = trimmed.replace(/^[ab]\//, '');

    if (withoutPrefix === '/dev/null') {
      return undefined;
    }

    const bytes: number[] = [];
    const escapeMap: Record<string, number> = {
      t: 0x09,
      n: 0x0a,
      r: 0x0d,
      b: 0x08,
      f: 0x0c,
      v: 0x0b,
      a: 0x07,
      '\\': 0x5c,
      '"': 0x22,
      ' ': 0x20,
    };

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

        const mapped = escapeMap[next];
        if (mapped !== undefined) {
          bytes.push(mapped);
        } else {
          bytes.push(next.charCodeAt(0));
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
    headerLine: string
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

  private hasRenameInfo(
    summary: DiffResultTextFile | DiffResultBinaryFile | DiffResultNameStatusFile
  ): summary is DiffResultNameStatusFile {
    return 'from' in summary && typeof summary.from === 'string';
  }

  private parseFileBlock(
    block: string,
    summary: DiffResultTextFile | DiffResultBinaryFile | DiffResultNameStatusFile | null
  ): DiffFile | null {
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
    const summaryNewPath = this.decodeGitPath(summary?.file);

    let summaryOldPath: string | undefined;
    if (summary && this.hasRenameInfo(summary)) {
      summaryOldPath = this.decodeGitPath(summary.from);
    }

    const newPath = renameToPath ?? plusPath ?? headerPaths?.newPath ?? summaryNewPath;

    const oldPath =
      renameFromPath ?? minusPath ?? headerPaths?.oldPath ?? summaryOldPath ?? newPath;

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
      oldPath: oldPath !== newPath ? oldPath : undefined,
      status,
    };

    // Parse chunks
    const chunks = this.parseChunks(lines);

    // Handle different summary types
    if (!summary) {
      // No summary - count additions/deletions from chunks
      const { additions, deletions } = this.countLinesFromChunks(chunks);
      return {
        ...baseFile,
        additions,
        deletions,
        chunks,
      };
    } else if ('binary' in summary && summary.binary) {
      // Binary file
      return {
        ...baseFile,
        additions: 0,
        deletions: 0,
        chunks: [], // No chunks for binary files
      };
    } else {
      // Text file with summary
      return {
        ...baseFile,
        additions: summary.insertions,
        deletions: summary.deletions,
        chunks,
      };
    }
  }

  private countLinesFromChunks(chunks: DiffChunk[]): { additions: number; deletions: number } {
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
        const type =
          line.startsWith('+') ? 'add'
          : line.startsWith('-') ? 'delete'
          : 'normal';

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
    // For stdin diff, we pass an empty summary array
    // parseUnifiedDiff will handle it by counting additions/deletions from the actual diff content
    const emptySummary: DiffResult['files'] = [];

    // Use the existing parseUnifiedDiff method
    const files = this.parseUnifiedDiff(diffContent, emptySummary);

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
        return fs.readFileSync(filepath);
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
        `Failed to get blob content for ${filepath} at ${ref}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
