import { execSync } from 'child_process';
import { fstatSync, type Stats } from 'node:fs';
import { createInterface } from 'readline/promises';

import type { SimpleGit } from 'simple-git';

import type { CommentImport } from '../types/diff.js';
import { parseCommentImportValue } from '../utils/commentImports.js';

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

  if (trimmed === '.' || trimmed === 'working' || trimmed === 'staged') {
    return true; // Allow special keywords for working directory and staging area diff
  }

  const baseCommitish = stripRevisionSuffix(trimmed);

  if (baseCommitish.length === 0) {
    return false;
  }

  return isValidCommitishBase(baseCommitish);
}

function isValidCommitishBase(baseCommitish: string): boolean {
  const validBasePatterns = [
    /^[a-f0-9]{4,40}$/i, // SHA hashes
    /^HEAD$/, // HEAD
    /^@$/, // @ is Git alias for HEAD
  ];

  if (validBasePatterns.some((pattern) => pattern.test(baseCommitish))) {
    return true;
  }

  // For branch, tag, and remote refs, use git's ref naming rules.
  return isValidBranchName(baseCommitish);
}

function stripRevisionSuffix(commitish: string): string {
  let suffixStart = commitish.length;

  while (suffixStart > 0) {
    const current = commitish[suffixStart - 1];

    if (current === '^') {
      suffixStart--;
      continue;
    }

    if (current === '~') {
      suffixStart--;
      continue;
    }

    if (!isAsciiDigit(current)) {
      break;
    }

    let digitStart = suffixStart - 1;
    while (digitStart > 0 && isAsciiDigit(commitish[digitStart - 1])) {
      digitStart--;
    }

    const operator = commitish[digitStart - 1];
    if (operator !== '^' && operator !== '~') {
      break;
    }

    suffixStart = digitStart - 1;
  }

  return commitish.slice(0, suffixStart);
}

function isAsciiDigit(char: string): boolean {
  return char >= '0' && char <= '9';
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

export function parseCommentOptions(commentValues: string[]): CommentImport[] {
  return commentValues.flatMap((value) => parseCommentImportValue(value));
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

export async function waitForEnter(message: string): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = await rl.question(message);
      if (answer.trim() === '') {
        return;
      }
    }
  } finally {
    rl.close();
  }
}
