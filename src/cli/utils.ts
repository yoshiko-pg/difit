import { execFileSync, execSync } from 'child_process';
import { fstatSync, type Stats } from 'node:fs';
import { createInterface } from 'readline/promises';

import type { SimpleGit } from 'simple-git';

type StdinStat = Pick<Stats, 'isFIFO' | 'isFile' | 'isSocket'>;

type StdinSource = 'pipe' | 'file' | 'socket' | 'tty';

export function detectStdinSource(stdinStat: StdinStat = fstatSync(0)): StdinSource {
  if (stdinStat.isFIFO()) {
    return 'pipe';
  }

  if (stdinStat.isFile()) {
    return 'file';
  }

  if (stdinStat.isSocket()) {
    return 'socket';
  }

  return 'tty';
}

interface ShouldReadStdinOptions {
  commitish: string;
  hasPositionalArgs: boolean;
  hasPrOption: boolean;
  hasTuiOption: boolean;
  stdinSource?: StdinSource;
}

export function shouldReadStdin(options: ShouldReadStdinOptions): boolean {
  if (options.commitish === '-') {
    return true;
  }

  if (options.hasPositionalArgs || options.hasPrOption || options.hasTuiOption) {
    return false;
  }

  const stdinSource = options.stdinSource ?? detectStdinSource();
  return stdinSource === 'pipe' || stdinSource === 'file' || stdinSource === 'socket';
}

export function getGitRoot(): string {
  try {
    const result = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return result.trim();
  } catch {
    throw new Error('Not a git repository (or any of the parent directories)');
  }
}

export function validateCommitish(commitish: string): boolean {
  if (!commitish || typeof commitish !== 'string') {
    return false;
  }

  const trimmed = commitish.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Special cases
  if (trimmed === 'HEAD~') {
    return false;
  }
  if (trimmed === '.' || trimmed === 'working' || trimmed === 'staged') {
    return true; // Allow special keywords for working directory and staging area diff
  }

  const validPatterns = [
    /^[a-f0-9]{4,40}$/i, // SHA hashes
    /^[a-f0-9]{4,40}\^+$/i, // SHA hashes with ^ suffix (parent references)
    /^[a-f0-9]{4,40}~\d+$/i, // SHA hashes with ~N suffix (ancestor references)
    /^HEAD(~\d+|\^\d*)*$/, // HEAD, HEAD~1, HEAD^, HEAD^2, etc.
    /^@(~\d+|\^\d*)*$/, // @, @~1, @^, @^2, etc. (@ is Git alias for HEAD)
  ];

  // Check if it matches any specific patterns first
  if (validPatterns.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  // For branch names, use git's rules
  return isValidBranchName(trimmed);
}

function isValidBranchName(name: string): boolean {
  // Git branch name rules
  if (name.startsWith('-')) return false; // Cannot start with dash
  if (name.endsWith('.')) return false; // Cannot end with dot
  // @ is a valid Git alias for HEAD, so we should allow it
  if (name.includes('..')) return false; // No consecutive dots
  if (name.includes('@{')) return false; // No @{ sequence
  if (name.includes('//')) return false; // No consecutive slashes
  if (name.startsWith('/') || name.endsWith('/')) return false; // No leading/trailing slashes
  if (name.endsWith('.lock')) return false; // Cannot end with .lock

  // Check for forbidden characters
  const forbiddenChars = /[~^:?*[\\\x00-\x20\x7F]/;
  if (forbiddenChars.test(name)) return false;

  // Check path components
  const components = name.split('/');
  for (const component of components) {
    if (component === '') return false; // Empty component
    if (component.startsWith('.')) return false; // Component cannot start with dot
    if (component.endsWith('.lock')) return false; // Component cannot end with .lock
  }

  return true;
}

export function shortHash(hash: string): string {
  return hash.substring(0, 7);
}

export function createCommitRangeString(baseHash: string, targetHash: string): string {
  return `${baseHash}...${targetHash}`;
}

interface PullRequestInfo {
  owner: string;
  repo: string;
  pullNumber: number;
  hostname: string;
}

export function parseGitHubPrUrl(url: string): PullRequestInfo | null {
  try {
    const urlObj = new URL(url);

    // Allow any hostname for GitHub Enterprise support
    // Just validate the path structure
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts.length < 4 || pathParts[2] !== 'pull') {
      return null;
    }

    const owner = pathParts[0];
    const repo = pathParts[1];
    const pullNumber = parseInt(pathParts[3], 10);

    if (isNaN(pullNumber)) {
      return null;
    }

    return { owner, repo, pullNumber, hostname: urlObj.hostname };
  } catch {
    return null;
  }
}

export function getPrPatch(prArg: string): string {
  try {
    const patch = execFileSync('gh', ['pr', 'diff', prArg], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (!patch.trim()) {
      throw new Error('No diff content returned from gh pr diff');
    }

    return patch;
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr;
    const stderrText =
      typeof stderr === 'string'
        ? stderr.trim()
        : Buffer.isBuffer(stderr)
          ? stderr.toString('utf8').trim()
          : '';
    const message =
      stderrText || (error instanceof Error ? error.message : 'Unknown error while running gh');
    throw new Error(`${message}\nTry: gh auth login`);
  }
}

export function validateDiffArguments(
  targetCommitish: string,
  baseCommitish?: string,
): { valid: boolean; error?: string } {
  // Validate target commitish format
  if (!validateCommitish(targetCommitish)) {
    return { valid: false, error: 'Invalid target commit-ish format' };
  }

  // Validate base commitish format if provided
  if (baseCommitish !== undefined && !validateCommitish(baseCommitish)) {
    return { valid: false, error: 'Invalid base commit-ish format' };
  }

  // Special arguments are only allowed in target, not base (except staged with working)
  const specialArgs = ['working', 'staged', '.'];
  if (baseCommitish && specialArgs.includes(baseCommitish)) {
    // Allow 'staged' as base only when target is 'working'
    if (baseCommitish === 'staged' && targetCommitish === 'working') {
      // This is valid: working vs staged
    } else {
      return {
        valid: false,
        error: `Special arguments (working, staged, .) are only allowed as target, not base. Got base: ${baseCommitish}`,
      };
    }
  }

  // Cannot compare same values
  if (targetCommitish === baseCommitish) {
    return {
      valid: false,
      error: `Cannot compare ${targetCommitish} with itself`,
    };
  }

  // "working" shows unstaged changes and can only be compared with staging area
  if (targetCommitish === 'working' && baseCommitish && baseCommitish !== 'staged') {
    return {
      valid: false,
      error:
        '"working" shows unstaged changes and cannot be compared with another commit. Use "." instead to compare all uncommitted changes with a specific commit.',
    };
  }

  return { valid: true };
}

export async function findUntrackedFiles(git: SimpleGit): Promise<string[]> {
  const status = await git.status();
  return status.not_added;
}

// Add files with --intent-to-add to make them visible in `git diff` without staging content
export async function markFilesIntentToAdd(git: SimpleGit, files: string[]): Promise<void> {
  await git.add(['--intent-to-add', ...files]);
}

export async function promptUser(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(message);
  rl.close();

  // Empty string (Enter) or 'y', 'yes' return true
  const trimmed = answer.trim().toLowerCase();
  return trimmed === '' || ['y', 'yes'].includes(trimmed);
}
