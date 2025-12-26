import { execSync } from 'child_process';
import { createInterface } from 'readline/promises';

import { Octokit } from '@octokit/rest';
import type { SimpleGit } from 'simple-git';

export function getGitRoot(): string {
  try {
    const result = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: 'pipe' });
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

export interface PullRequestInfo {
  owner: string;
  repo: string;
  pullNumber: number;
  hostname: string;
}

export interface PullRequestDetails {
  baseSha: string;
  headSha: string;
  baseRef: string;
  headRef: string;
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

function getGitHubToken(): string | undefined {
  // Try to get token from environment variable first
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // Try to get token from GitHub CLI
  try {
    const result = execSync('gh auth token', { encoding: 'utf8', stdio: 'pipe' });
    return result.trim();
  } catch {
    // GitHub CLI not available or not authenticated
    return undefined;
  }
}

export async function fetchPrDetails(prInfo: PullRequestInfo): Promise<PullRequestDetails> {
  const token = getGitHubToken();

  const octokitOptions: ConstructorParameters<typeof Octokit>[0] = {
    auth: token,
  };

  // For GitHub Enterprise, set the base URL
  if (prInfo.hostname !== 'github.com') {
    octokitOptions.baseUrl = `https://${prInfo.hostname}/api/v3`;
  }

  const octokit = new Octokit(octokitOptions);

  try {
    const { data: pr } = await octokit.rest.pulls.get({
      owner: prInfo.owner,
      repo: prInfo.repo,
      pull_number: prInfo.pullNumber,
    });

    return {
      baseSha: pr.base.sha,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      headRef: pr.head.ref,
    };
  } catch (error) {
    if (error instanceof Error) {
      let authHint = '';

      // Provide more specific error messages for authentication issues
      if (error.message.includes('Bad credentials')) {
        if (prInfo.hostname !== 'github.com') {
          authHint = `\n\nFor GitHub Enterprise Server (${prInfo.hostname}):
1. Generate a token on YOUR Enterprise Server: https://${prInfo.hostname}/settings/tokens
2. Set it as GITHUB_TOKEN environment variable
3. Tokens from github.com will NOT work on Enterprise servers`;
        } else {
          authHint = '\n\nTry: gh auth login or set GITHUB_TOKEN environment variable';
        }
      } else if (!token) {
        authHint = ' (Try: gh auth login or set GITHUB_TOKEN environment variable)';
      }

      throw new Error(`Failed to fetch PR details: ${error.message}${authHint}`);
    }
    throw new Error('Failed to fetch PR details: Unknown error');
  }
}

export function resolveCommitInLocalRepo(
  sha: string,
  context?: { owner: string; repo: string }
): string {
  try {
    // Verify if the commit exists locally
    execSync(`git cat-file -e ${sha}`, { stdio: 'ignore' });
    return sha;
  } catch {
    // If commit doesn't exist, try to fetch from remote
    try {
      execSync('git fetch origin', { stdio: 'ignore' });
      execSync(`git cat-file -e ${sha}`, { stdio: 'ignore' });
      return sha;
    } catch {
      const errorMessage = [
        `Commit ${sha} not found in local repository.`,
        '',
        'Common causes:',
        '  • Are you running this command in the correct repository directory?',
        context ? `    • Expected repository: ${context.owner}/${context.repo}` : '',
        '  • Is this PR from a fork?',
        '    • Try: git remote add upstream <original-repo-url> && git fetch upstream',
        '    • Try: git fetch --all to fetch from all remotes',
      ]
        .filter(Boolean)
        .join('\n');

      throw new Error(errorMessage);
    }
  }
}

export async function resolvePrCommits(
  prUrl: string
): Promise<{ targetCommitish: string; baseCommitish: string }> {
  const prInfo = parseGitHubPrUrl(prUrl);
  if (!prInfo) {
    throw new Error(
      'Invalid GitHub PR URL format. Expected: https://github.com/owner/repo/pull/123 or https://github.enterprise.com/owner/repo/pull/123'
    );
  }

  const prDetails = await fetchPrDetails(prInfo);

  const context = { owner: prInfo.owner, repo: prInfo.repo };
  const targetCommitish = resolveCommitInLocalRepo(prDetails.headSha, context);
  const baseCommitish = resolveCommitInLocalRepo(prDetails.baseSha, context);

  return { targetCommitish, baseCommitish };
}

export function validateDiffArguments(
  targetCommitish: string,
  baseCommitish?: string
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
    return { valid: false, error: `Cannot compare ${targetCommitish} with itself` };
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
