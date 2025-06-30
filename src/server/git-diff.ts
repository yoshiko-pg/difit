import { simpleGit, type SimpleGit } from 'simple-git';

import { type DiffFile, type DiffChunk, type DiffLine, type DiffResponse } from '../types/diff.js';

export class GitDiffParser {
  private git: SimpleGit;

  constructor(repoPath = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async parseDiff(commitish: string, ignoreWhitespace = false): Promise<DiffResponse> {
    try {
      let resolvedCommit: string;
      let diffArgs: string[];

      if (commitish === '.') {
        // Show diff between HEAD and working directory (all uncommitted changes)
        resolvedCommit = 'Working Directory (all uncommitted changes)';
        diffArgs = ['HEAD'];
      } else if (commitish === 'working') {
        // Show only unstaged changes
        resolvedCommit = 'Working Directory (unstaged changes)';
        diffArgs = [];
      } else if (commitish === 'staged') {
        // Show only staged changes
        resolvedCommit = 'Staging Area (staged changes)';
        diffArgs = ['--cached'];
      } else {
        // Resolve commitish to actual commit hash and get short version
        const fullHash = await this.git.revparse([commitish]);
        const shortHash = fullHash.substring(0, 7);
        const parentHash = await this.git.revparse([`${commitish}^`]);
        const shortParentHash = parentHash.substring(0, 7);
        resolvedCommit = `${shortParentHash}..${shortHash}`;
        diffArgs = [`${commitish}^`, commitish];
      }

      if (ignoreWhitespace) {
        diffArgs.push('-w');
      }

      // Add --color=never to ensure plain text output without ANSI escape sequences
      const diffSummary = await this.git.diffSummary(diffArgs);
      const diffRaw = await this.git.diff(['--color=never', ...diffArgs]);

      const files = this.parseUnifiedDiff(diffRaw, diffSummary.files);

      return {
        commit: resolvedCommit,
        files,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse diff for ${commitish}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseUnifiedDiff(diffText: string, summary: any[]): DiffFile[] {
    const files: DiffFile[] = [];
    const fileBlocks = diffText.split(/^diff --git /m).slice(1);

    for (let i = 0; i < fileBlocks.length; i++) {
      const block = `diff --git ${fileBlocks[i]}`;
      const summaryItem = summary[i];

      if (!summaryItem) continue;

      const file = this.parseFileBlock(block, summaryItem);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  private parseFileBlock(block: string, summary: any): DiffFile | null {
    const lines = block.split('\n');
    const headerLine = lines[0];

    const pathMatch = headerLine.match(/^diff --git [a-z]\/(.+) [a-z]\/(.+)$/);
    if (!pathMatch) return null;

    const oldPath = pathMatch[1];
    const newPath = pathMatch[2];
    const path = newPath;

    let status: DiffFile['status'] = 'modified';
    if (summary.binary) return null;

    if (oldPath !== newPath) {
      status = 'renamed';
    } else if (summary.insertions && !summary.deletions) {
      status = 'added';
    } else if (summary.deletions && !summary.insertions) {
      status = 'deleted';
    }

    const chunks = this.parseChunks(lines);

    return {
      path,
      oldPath: oldPath !== newPath ? oldPath : undefined,
      status,
      additions: summary.insertions || 0,
      deletions: summary.deletions || 0,
      chunks,
    };
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
}
