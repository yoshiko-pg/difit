import { createHash } from 'crypto';

import { type Response } from 'express';
import { simpleGit, type SimpleGit } from 'simple-git';

import { DiffMode, type WatchEvent } from '../types/watch.js';

interface FileWatcherConfig {
  watchPath: string;
  diffMode: DiffMode;
  debounceMs: number;
  onCacheInvalidate?: () => void;
}

/**
 * How much of the git state each mode must inspect.
 *
 * `head` is enough when the diff only moves when a commit does. The working
 * tree patch costs far more on a large repository, so modes that cannot show
 * an uncommitted change never ask for it.
 */
type SignalScope = 'head' | 'index' | 'worktree';

const MODE_SIGNAL_SCOPE: Record<DiffMode, SignalScope | null> = {
  [DiffMode.DEFAULT]: 'head',
  [DiffMode.STAGED]: 'index',
  [DiffMode.WORKING]: 'worktree',
  [DiffMode.DOT]: 'worktree',
  [DiffMode.SPECIFIC]: null, // No polling for specific commit comparisons
};

/**
 * Fraction of one core the poller is allowed to consume. The next delay comes
 * from how long the previous sample took, so a repository where the scan
 * costs 200ms is polled about every 2s, and a small one is polled at
 * MIN_POLL_INTERVAL_MS.
 */
const POLL_DUTY_CYCLE = 0.1;
const MIN_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 10_000;

/**
 * Above this cost, a working tree scan is slow enough that git's own caches
 * are worth mentioning. Below it, the poll is cheap and the advice is noise.
 */
const SLOW_SCAN_HINT_MS = 150;

// A separator that cannot appear inside a ref name or a patch line.
const SIGNAL_SEPARATOR = '\n--difit--\n';

/**
 * Flags that keep the signal patch small without losing a real change.
 *
 * The poller compares the patch to itself, so it needs no context lines. It
 * also does not need rename detection, which costs time and only relabels a
 * change that the patch already shows.
 */
const DIFF_SIGNAL_FLAGS = ['--unified=0', '--no-renames', '--no-color', '--no-ext-diff'];

export class FileWatcherService {
  private clients: Response[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private config: FileWatcherConfig | null = null;
  private git: SimpleGit | null = null;
  private signalScope: SignalScope | null = null;
  private lastSignal: string | null = null;
  private polling = false;
  private stopped = true;

  constructor() {}

  async start(
    diffMode: DiffMode,
    watchPath: string,
    debounceMs = 300,
    onCacheInvalidate?: () => void,
  ): Promise<void> {
    // Stop existing poller
    await this.stop();

    this.config = { watchPath, diffMode, debounceMs, onCacheInvalidate };
    this.stopped = false;
    this.signalScope = MODE_SIGNAL_SCOPE[diffMode];

    // No polling for specific commit comparisons
    if (this.signalScope === null) {
      console.log('🔍 File watching disabled (specific commit comparison)');
      return;
    }

    this.git = simpleGit(watchPath);

    // Record the starting state, so the first poll reports only a real change.
    // A failure here is not fatal. The next poll makes the baseline instead.
    const baselineStartedAt = performance.now();
    this.lastSignal = await this.readSignal();
    await this.warnIfScanIsSlow(performance.now() - baselineStartedAt);
  }

  /**
   * Tell the user about git's own caches when the working tree scan is slow.
   *
   * difit does not enable them. Both settings change how every other git
   * command behaves in the repository, so the choice belongs to the user.
   */
  private async warnIfScanIsSlow(baselineMs: number): Promise<void> {
    const git = this.git;
    if (!git || this.signalScope !== 'worktree' || baselineMs < SLOW_SCAN_HINT_MS) {
      return;
    }

    const [untrackedCache, fsMonitor] = await Promise.all([
      readGitBool(git, 'core.untrackedCache'),
      readGitBool(git, 'core.fsmonitor'),
    ]);

    if (untrackedCache && fsMonitor) {
      return;
    }

    const suggestions: string[] = [];
    if (!untrackedCache) {
      suggestions.push('git config core.untrackedCache true');
    }
    if (!fsMonitor) {
      suggestions.push('git config core.fsmonitor true');
    }

    console.log(
      `i  the git working tree scan takes ${Math.round(baselineMs)}ms here, which sets the live reload interval.`,
    );
    console.log('   These git settings make it faster:');
    for (const suggestion of suggestions) {
      console.log(`     ${suggestion}`);
    }
  }

  /**
   * Collect the git state that decides if the rendered diff is stale.
   *
   * Returns null when git cannot be read. The caller treats null as "unknown",
   * not as "changed", so a temporary failure does not cause a reload.
   */
  private async readSignal(): Promise<string | null> {
    const git = this.git;
    const scope = this.signalScope;
    if (!git || scope === null) {
      return null;
    }

    try {
      const parts: string[] = [];

      // The commit that HEAD points to, and the ref name. The ref name is
      // necessary because a checkout of a different branch on the same commit
      // changes what the user reviews, but it does not move the hash.
      const [head, ref] = await Promise.all([
        git.revparse(['HEAD']).catch(() => ''), // An empty repository has no HEAD
        git.raw(['symbolic-ref', '-q', 'HEAD']).catch(() => ''), // A detached HEAD has no symbolic ref
      ]);
      parts.push(head.trim(), ref.trim());

      // The patch itself is the signal. A status report only names the files
      // and their state letters, so a file that is already dirty keeps the
      // same report after every later edit, and the poller never fires. The
      // patch changes whenever the rendered diff changes, which is the exact
      // condition the client must learn about.
      if (scope === 'index') {
        parts.push(await git.raw(['diff', '--cached', ...DIFF_SIGNAL_FLAGS]));
      } else if (scope === 'worktree') {
        // `git diff HEAD` covers tracked files, staged and unstaged alike, but
        // it never reports an untracked file. The file list closes that gap.
        const [patch, untracked] = await Promise.all([
          git.raw(['diff', 'HEAD', ...DIFF_SIGNAL_FLAGS]),
          git.raw(['ls-files', '--others', '--exclude-standard']),
        ]);
        parts.push(patch, untracked);
      }

      return createHash('sha1').update(parts.join(SIGNAL_SEPARATOR)).digest('hex');
    } catch {
      return null;
    }
  }

  private scheduleNextPoll(lastDurationMs: number): void {
    if (this.stopped || this.clients.length === 0) {
      return;
    }

    const interval = Math.min(
      MAX_POLL_INTERVAL_MS,
      Math.max(MIN_POLL_INTERVAL_MS, lastDurationMs / POLL_DUTY_CYCLE),
    );

    this.pollTimer = setTimeout(() => {
      void this.poll();
    }, interval);
    // Do not keep the process alive only to poll.
    this.pollTimer.unref?.();
  }

  private async poll(): Promise<void> {
    if (this.polling || this.stopped) {
      return;
    }
    this.polling = true;
    this.pollTimer = null;

    const startedAt = performance.now();
    try {
      const signal = await this.readSignal();
      if (signal !== null) {
        if (this.lastSignal !== null && signal !== this.lastSignal) {
          this.debouncedBroadcast();
        }
        this.lastSignal = signal;
      }
    } finally {
      this.polling = false;
      this.scheduleNextPoll(performance.now() - startedAt);
    }
  }

  /** Start the poller, if it does not run already and this mode polls. */
  private startPolling(): void {
    if (this.stopped || this.pollTimer || this.polling || this.signalScope === null) {
      return;
    }
    this.scheduleNextPoll(0);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private debouncedBroadcast(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const debounceMs = this.config?.debounceMs || 300;
    this.debounceTimer = setTimeout(() => {
      // Invalidate cache before broadcasting change
      if (this.config?.onCacheInvalidate) {
        this.config.onCacheInvalidate();
      }
      this.broadcastChange();
    }, debounceMs);
  }

  // Kept async because callers await it, and because a future teardown step
  // may need to. There is nothing to await now that polling replaced watching.
  // oxlint-disable-next-line typescript/require-await
  async stop(): Promise<void> {
    this.stopped = true;

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.stopPolling();
    this.lastSignal = null;

    // Clear clients
    this.clients = [];
  }

  addClient(res: Response): void {
    this.clients.push(res);

    // Send initial connection event
    this.sendToClient(res, {
      type: 'connected',
      diffMode: this.config?.diffMode || DiffMode.DEFAULT,
      changeType: 'file',
      timestamp: new Date().toISOString(),
      message: `Connected to file watcher (${this.config?.diffMode} mode)`,
    });

    // No client reads the reload events until one connects, so the poller runs
    // only while at least one client is connected.
    this.startPolling();
  }

  removeClient(res: Response): void {
    const index = this.clients.indexOf(res);
    if (index > -1) {
      this.clients.splice(index, 1);
    }

    if (this.clients.length === 0) {
      this.stopPolling();
    }
  }

  broadcast(event: WatchEvent): void {
    if (this.clients.length === 0) {
      return;
    }
    this.clients.forEach((client) => {
      this.sendToClient(client, event);
    });
  }

  private broadcastChange(): void {
    if (this.clients.length === 0 || !this.config) {
      return;
    }

    const changeType = this.determineChangeType();
    const event: WatchEvent = {
      type: 'reload' as const,
      diffMode: this.config.diffMode,
      changeType,
      timestamp: new Date().toISOString(),
      message: `Changes detected in ${this.config.diffMode} mode`,
    };

    this.broadcast(event);
  }

  private sendToClient(client: Response, event: unknown): void {
    try {
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      console.error('Failed to send event to client:', error);
      this.removeClient(client);
    }
  }

  private determineChangeType(): 'file' | 'commit' | 'staging' {
    if (!this.config) return 'file';

    switch (this.config.diffMode) {
      case DiffMode.DEFAULT:
      case DiffMode.DOT:
        return 'commit'; // HEAD changes indicate new commits
      case DiffMode.STAGED:
        return 'staging'; // index changes
      case DiffMode.WORKING:
        return 'file'; // Both file and staging changes, default to file
      default:
        return 'file';
    }
  }
}

/**
 * Read a boolean git config value. Treats an unset or unreadable value as
 * false, so the hint appears rather than being silently skipped.
 */
async function readGitBool(git: SimpleGit, key: string): Promise<boolean> {
  try {
    const value = await git.raw(['config', '--get', key]);
    return value.trim() === 'true';
  } catch {
    return false;
  }
}
