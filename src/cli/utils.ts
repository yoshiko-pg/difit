import { execFileSync, execSync } from 'child_process';
import { fstatSync, type Stats } from 'node:fs';
import { createInterface } from 'readline/promises';

import type { SimpleGit } from 'simple-git';

import type { CommentImport, DiffCommentPosition, DiffLineRange } from '../types/diff.js';
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

type GitHubReviewThreadSubjectType = string;
type GitHubReviewThreadDiffSide = string;

interface GitHubReviewThreadAuthor {
  login?: string | null;
}

interface GitHubReviewThreadCommentNode {
  id?: string | null;
  body?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  author?: GitHubReviewThreadAuthor | null;
}

interface GitHubReviewThreadNode {
  id?: string | null;
  isResolved?: boolean | null;
  isOutdated?: boolean | null;
  subjectType?: GitHubReviewThreadSubjectType | null;
  path?: string | null;
  diffSide?: GitHubReviewThreadDiffSide | null;
  startDiffSide?: GitHubReviewThreadDiffSide | null;
  line?: number | null;
  startLine?: number | null;
  originalLine?: number | null;
  originalStartLine?: number | null;
  comments?: {
    nodes?: GitHubReviewThreadCommentNode[] | null;
  } | null;
}

interface GitHubReviewThreadsPageInfo {
  hasNextPage?: boolean | null;
  endCursor?: string | null;
}

interface GitHubReviewThreadsConnection {
  nodes?: GitHubReviewThreadNode[] | null;
  pageInfo?: GitHubReviewThreadsPageInfo | null;
}

interface GitHubReviewThreadsGraphqlResponse {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads?: GitHubReviewThreadsConnection | null;
      } | null;
    } | null;
  } | null;
  errors?: Array<{
    message?: string | null;
  }> | null;
}

interface PrCommentImportsPage {
  commentImports: CommentImport[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

const PR_REVIEW_THREADS_GRAPHQL_QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $endCursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $endCursor) {
        nodes {
          id
          isResolved
          isOutdated
          subjectType
          path
          diffSide
          startDiffSide
          line
          startLine
          originalLine
          originalStartLine
          comments(first: 100) {
            nodes {
              id
              body
              createdAt
              updatedAt
              author {
                login
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
`;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function warnPrCommentImport(threadId: string | undefined, message: string): void {
  const threadLabel = threadId ? ` ${threadId}` : '';
  console.warn(`Warning: Skipping PR review thread${threadLabel}: ${message}`);
}

function createSingleLinePosition(side: 'old' | 'new', line: number): DiffCommentPosition {
  return { side, line };
}

function createMultiLinePosition(
  side: 'old' | 'new',
  start: number,
  end: number,
): DiffCommentPosition {
  const line: DiffLineRange = { start, end };
  return { side, line };
}

function createRightSidePosition(thread: GitHubReviewThreadNode): DiffCommentPosition | null {
  if (!isPositiveInteger(thread.line)) {
    warnPrCommentImport(thread.id ?? undefined, 'RIGHT thread is missing line.');
    return null;
  }

  const hasMultiLineMetadata =
    thread.startDiffSide !== undefined && thread.startDiffSide !== null
      ? true
      : thread.startLine !== undefined && thread.startLine !== null;

  if (!hasMultiLineMetadata) {
    return createSingleLinePosition('new', thread.line);
  }

  if (thread.startDiffSide !== 'RIGHT') {
    warnPrCommentImport(thread.id ?? undefined, 'RIGHT thread has mismatched startDiffSide.');
    return null;
  }

  if (!isPositiveInteger(thread.startLine) || thread.startLine > thread.line) {
    warnPrCommentImport(thread.id ?? undefined, 'RIGHT thread has an invalid multi-line range.');
    return null;
  }

  return createMultiLinePosition('new', thread.startLine, thread.line);
}

function createLeftSidePosition(thread: GitHubReviewThreadNode): DiffCommentPosition | null {
  if (!isPositiveInteger(thread.originalLine)) {
    warnPrCommentImport(thread.id ?? undefined, 'LEFT thread is missing originalLine.');
    return null;
  }

  const hasMultiLineMetadata =
    thread.startDiffSide !== undefined && thread.startDiffSide !== null
      ? true
      : thread.originalStartLine !== undefined && thread.originalStartLine !== null;

  if (!hasMultiLineMetadata) {
    return createSingleLinePosition('old', thread.originalLine);
  }

  if (thread.startDiffSide !== 'LEFT') {
    warnPrCommentImport(thread.id ?? undefined, 'LEFT thread has mismatched startDiffSide.');
    return null;
  }

  if (
    !isPositiveInteger(thread.originalStartLine) ||
    thread.originalStartLine > thread.originalLine
  ) {
    warnPrCommentImport(thread.id ?? undefined, 'LEFT thread has an invalid multi-line range.');
    return null;
  }

  return createMultiLinePosition('old', thread.originalStartLine, thread.originalLine);
}

function getThreadPosition(thread: GitHubReviewThreadNode): DiffCommentPosition | null {
  if (thread.diffSide === 'RIGHT') {
    return createRightSidePosition(thread);
  }

  if (thread.diffSide === 'LEFT') {
    return createLeftSidePosition(thread);
  }

  warnPrCommentImport(thread.id ?? undefined, 'Unsupported diffSide.');
  return null;
}

function toSortedComments(thread: GitHubReviewThreadNode): GitHubReviewThreadCommentNode[] {
  return [...(thread.comments?.nodes ?? [])].sort((left, right) =>
    (left.createdAt ?? '').localeCompare(right.createdAt ?? ''),
  );
}

function toCommentImportsForThread(thread: GitHubReviewThreadNode): CommentImport[] {
  if (thread.isResolved) {
    return [];
  }

  if (thread.isOutdated) {
    return [];
  }

  if (thread.subjectType !== 'LINE') {
    return [];
  }

  if (typeof thread.path !== 'string' || thread.path.trim().length === 0) {
    warnPrCommentImport(thread.id ?? undefined, 'Thread is missing path.');
    return [];
  }
  const filePath = thread.path;

  const position = getThreadPosition(thread);
  if (!position) {
    return [];
  }

  const comments = toSortedComments(thread);
  if (comments.length === 0) {
    warnPrCommentImport(thread.id ?? undefined, 'Thread has no comments.');
    return [];
  }

  const rootComment = comments[0];
  if (
    !rootComment ||
    typeof rootComment.id !== 'string' ||
    typeof rootComment.body !== 'string' ||
    typeof rootComment.createdAt !== 'string' ||
    typeof rootComment.updatedAt !== 'string'
  ) {
    warnPrCommentImport(thread.id ?? undefined, 'Thread has a comment with missing fields.');
    return [];
  }

  const commentImports: CommentImport[] = [
    {
      type: 'thread',
      id: rootComment.id,
      filePath,
      position,
      body: rootComment.body,
      author: rootComment.author?.login ?? undefined,
      createdAt: rootComment.createdAt,
      updatedAt: rootComment.updatedAt,
    },
  ];

  for (const comment of comments.slice(1)) {
    if (
      typeof comment.id !== 'string' ||
      typeof comment.body !== 'string' ||
      typeof comment.createdAt !== 'string' ||
      typeof comment.updatedAt !== 'string'
    ) {
      warnPrCommentImport(thread.id ?? undefined, 'Thread has a comment with missing fields.');
      continue;
    }

    commentImports.push({
      type: 'reply',
      id: comment.id,
      filePath,
      position,
      body: comment.body,
      author: comment.author?.login ?? undefined,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    });
  }

  return commentImports;
}

export function parsePrCommentImportsResponse(
  response: GitHubReviewThreadsGraphqlResponse,
): PrCommentImportsPage {
  const errors = response.errors?.map((error) => error.message).filter((message) => message) ?? [];
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  const reviewThreads = response.data?.repository?.pullRequest?.reviewThreads;
  if (!reviewThreads) {
    return {
      commentImports: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    };
  }

  return {
    commentImports: (reviewThreads.nodes ?? []).flatMap((thread) =>
      toCommentImportsForThread(thread),
    ),
    pageInfo: {
      hasNextPage: reviewThreads.pageInfo?.hasNextPage === true,
      endCursor: reviewThreads.pageInfo?.endCursor ?? null,
    },
  };
}

function formatGhCommandError(error: unknown): Error {
  const stderr = (error as { stderr?: Buffer | string }).stderr;
  const stderrText =
    typeof stderr === 'string'
      ? stderr.trim()
      : Buffer.isBuffer(stderr)
        ? stderr.toString('utf8').trim()
        : '';
  const message =
    stderrText || (error instanceof Error ? error.message : 'Unknown error while running gh');
  return new Error(`${message}\nTry: gh auth login`);
}

export function getPrCommentImports(prArg: string): Promise<CommentImport[]> {
  const pullRequestInfo = parseGitHubPrUrl(prArg);
  if (!pullRequestInfo) {
    throw new Error('Invalid GitHub PR URL');
  }

  const { owner, repo, pullNumber, hostname } = pullRequestInfo;
  const commentImports: CommentImport[] = [];
  let endCursor: string | null = null;

  while (true) {
    try {
      const args = [
        'api',
        'graphql',
        '--hostname',
        hostname,
        '-f',
        `query=${PR_REVIEW_THREADS_GRAPHQL_QUERY}`,
        '-F',
        `owner=${owner}`,
        '-F',
        `repo=${repo}`,
        '-F',
        `number=${pullNumber}`,
      ];

      if (endCursor) {
        args.push('-F', `endCursor=${endCursor}`);
      }

      const stdout = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const parsed = JSON.parse(stdout) as GitHubReviewThreadsGraphqlResponse;
      const page = parsePrCommentImportsResponse(parsed);
      commentImports.push(...page.commentImports);

      if (!page.pageInfo.hasNextPage) {
        return Promise.resolve(commentImports);
      }

      if (!page.pageInfo.endCursor) {
        throw new Error('GitHub GraphQL response indicated more pages without endCursor.');
      }

      endCursor = page.pageInfo.endCursor;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON returned from gh api graphql');
      }

      if (error instanceof Error && !('stderr' in (error as object))) {
        throw error;
      }

      throw formatGhCommandError(error);
    }
  }
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
