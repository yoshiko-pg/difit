import { type Response } from 'express';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { DiffMode } from '../types/watch.js';

import { FileWatcherService } from './file-watcher.js';

// Mock simple-git
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(),
}));

const { simpleGit } = await import('simple-git');
const TEST_REPO_PATH = resolve('/test/path');

/** Git state the fake repository reports, mutated per test to fake a change. */
interface GitState {
  head: string;
  ref: string;
  /** Patch of the working tree against HEAD, what `git diff HEAD` prints. */
  worktreeDiff: string;
  /** Patch of the index against HEAD, what `git diff --cached` prints. */
  stagedDiff: string;
  /** Untracked paths, what `git ls-files --others` prints. */
  untracked: string;
  /** Milliseconds the working tree scan appears to take, for the slow hint. */
  scanDelayMs?: number;
  config?: Record<string, string>;
}

function newGitState(overrides: Partial<GitState> = {}): GitState {
  return {
    head: 'abc1234',
    ref: 'refs/heads/main',
    worktreeDiff: '',
    stagedDiff: '',
    untracked: '',
    ...overrides,
  };
}

function mockGitWith(state: GitState) {
  const revparse = vi.fn(() => Promise.resolve(state.head));
  const raw = vi.fn(async (args: string[]) => {
    if (args[0] === 'symbolic-ref') {
      return state.ref;
    }
    if (args[0] === 'diff') {
      const staged = args.includes('--cached');
      if (!staged && state.scanDelayMs) {
        // A real delay, so the service measures a real duration. Tests that
        // use this run on real timers.
        await new Promise((done) => setTimeout(done, state.scanDelayMs));
      }
      return staged ? state.stagedDiff : state.worktreeDiff;
    }
    if (args[0] === 'ls-files') {
      return state.untracked;
    }
    if (args[0] === 'config') {
      const key = args[2] ?? '';
      const value = state.config?.[key];
      if (value === undefined) {
        throw new Error(`no config value for ${key}`);
      }
      return value;
    }
    return '';
  });

  const mockGit = { revparse, raw };
  vi.mocked(simpleGit).mockReturnValue(mockGit as never);
  return mockGit;
}

/** A minimal patch that edits `path`, with `body` as the new content. */
function patchFor(path: string, body: string): string {
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n+${body}\n`;
}

/** Run every pending timer so the poll and the debounce both fire. */
async function advanceToBroadcast(): Promise<void> {
  await vi.advanceTimersByTimeAsync(MAX_POLL_MS);
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
}

const MAX_POLL_MS = 10_000;
const MIN_POLL_MS = 1_000;
const DEBOUNCE_MS = 300;

describe('FileWatcherService', () => {
  let fileWatcher: FileWatcherService;
  let mockResponse: Response;
  let state: GitState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    fileWatcher = new FileWatcherService();

    state = newGitState();
    mockGitWith(state);

    // Mock Express Response
    mockResponse = {
      write: vi.fn(),
    } as unknown as Response;
  });

  afterEach(async () => {
    await fileWatcher.stop();
    vi.useRealTimers();
  });

  function reloadCalls(client: Response = mockResponse) {
    return vi
      .mocked(client.write)
      .mock.calls.filter((call) => call[0].toString().includes('"type":"reload"'));
  }

  describe('start', () => {
    it('should create a git instance for the repository path', async () => {
      await fileWatcher.start(DiffMode.DEFAULT, TEST_REPO_PATH, DEBOUNCE_MS);

      expect(simpleGit).toHaveBeenCalledWith(TEST_REPO_PATH);
    });

    it('should read the baseline signal on start', async () => {
      const mockGit = mockGitWith(state);
      await fileWatcher.start(DiffMode.DEFAULT, TEST_REPO_PATH, DEBOUNCE_MS);

      expect(mockGit.revparse).toHaveBeenCalledWith(['HEAD']);
    });

    it('should not read git state for SPECIFIC mode', async () => {
      const mockGit = mockGitWith(state);
      await fileWatcher.start(DiffMode.SPECIFIC, TEST_REPO_PATH, DEBOUNCE_MS);

      expect(mockGit.revparse).not.toHaveBeenCalled();
    });

    it('should not poll in SPECIFIC mode even with a client connected', async () => {
      await fileWatcher.start(DiffMode.SPECIFIC, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.head = 'def5678';
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(0);
    });

    it('should tolerate a git failure while reading the baseline', async () => {
      vi.mocked(simpleGit).mockReturnValue({
        revparse: vi.fn().mockRejectedValue(new Error('not a repository')),
        raw: vi.fn().mockRejectedValue(new Error('not a repository')),
      } as never);

      await expect(
        fileWatcher.start(DiffMode.DEFAULT, TEST_REPO_PATH, DEBOUNCE_MS),
      ).resolves.not.toThrow();
    });
  });

  describe('change detection', () => {
    it('should broadcast reload when HEAD moves in DEFAULT mode', async () => {
      await fileWatcher.start(DiffMode.DEFAULT, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.head = 'def5678';
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(1);
    });

    it('should broadcast reload when the branch changes on the same commit', async () => {
      await fileWatcher.start(DiffMode.DEFAULT, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.ref = 'refs/heads/feature';
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(1);
    });

    it('should not broadcast when git state is unchanged', async () => {
      await fileWatcher.start(DiffMode.DEFAULT, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(0);
    });

    it('should ignore working tree edits in DEFAULT mode', async () => {
      await fileWatcher.start(DiffMode.DEFAULT, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.worktreeDiff = patchFor('src/app.ts', 'edited');
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(0);
    });

    it('should broadcast on a working tree edit in WORKING mode', async () => {
      await fileWatcher.start(DiffMode.WORKING, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.worktreeDiff = patchFor('src/app.ts', 'edited');
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(1);
    });

    it('should broadcast on a new untracked file in DOT mode', async () => {
      await fileWatcher.start(DiffMode.DOT, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.untracked = 'src/new.ts\n';
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(1);
    });

    it('should broadcast on a staged change in STAGED mode', async () => {
      await fileWatcher.start(DiffMode.STAGED, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.stagedDiff = patchFor('src/app.ts', 'staged');
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(1);
    });

    it('should ignore an unstaged edit in STAGED mode', async () => {
      await fileWatcher.start(DiffMode.STAGED, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.worktreeDiff = patchFor('src/app.ts', 'edited');
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(0);
    });

    // A file that git already reports as changed keeps the same status letters
    // after every later edit. A signal built from `git status` therefore goes
    // quiet once a file is dirty, which is the bug this test guards.
    it('should broadcast on a second edit to an already changed file', async () => {
      state.worktreeDiff = patchFor('src/app.ts', 'first');
      await fileWatcher.start(DiffMode.WORKING, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.worktreeDiff = patchFor('src/app.ts', 'second');
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(1);
    });

    // The same blind spot, on a file that is staged and then edited again in
    // the working tree. `git status` reports `AM` before and after the edit.
    it('should broadcast on an edit to a staged file in DOT mode', async () => {
      state.stagedDiff = patchFor('src/new.ts', 'added');
      state.worktreeDiff = patchFor('src/new.ts', 'added');
      await fileWatcher.start(DiffMode.DOT, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.worktreeDiff = patchFor('src/new.ts', 'added and then edited');
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(1);
    });

    it('should ignore an untracked file in STAGED mode', async () => {
      await fileWatcher.start(DiffMode.STAGED, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.untracked = 'src/new.ts\n';
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(0);
    });

    it('should not broadcast while git reads fail', async () => {
      const mockGit = mockGitWith(state);
      await fileWatcher.start(DiffMode.WORKING, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      // The repository disappears after the baseline is recorded.
      mockGit.revparse.mockRejectedValue(new Error('git gone') as never);
      mockGit.raw.mockRejectedValue(new Error('git gone') as never);

      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(0);
    });
  });

  describe('polling lifecycle', () => {
    it('should not poll before any client connects', async () => {
      const mockGit = mockGitWith(state);
      await fileWatcher.start(DiffMode.WORKING, TEST_REPO_PATH, DEBOUNCE_MS);
      const callsAfterBaseline = mockGit.revparse.mock.calls.length;

      await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 3);

      expect(mockGit.revparse.mock.calls.length).toBe(callsAfterBaseline);
    });

    it('should stop polling after the last client disconnects', async () => {
      const mockGit = mockGitWith(state);
      await fileWatcher.start(DiffMode.WORKING, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      await vi.advanceTimersByTimeAsync(MAX_POLL_MS);
      fileWatcher.removeClient(mockResponse);
      const callsAfterDisconnect = mockGit.revparse.mock.calls.length;

      await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 3);

      expect(mockGit.revparse.mock.calls.length).toBe(callsAfterDisconnect);
    });

    it('should keep polling while one of two clients stays connected', async () => {
      const mockGit = mockGitWith(state);
      const secondClient = { write: vi.fn() } as unknown as Response;

      await fileWatcher.start(DiffMode.WORKING, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);
      fileWatcher.addClient(secondClient);

      await vi.advanceTimersByTimeAsync(MAX_POLL_MS);
      fileWatcher.removeClient(mockResponse);
      const callsAfterDisconnect = mockGit.revparse.mock.calls.length;

      await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 2);

      expect(mockGit.revparse.mock.calls.length).toBeGreaterThan(callsAfterDisconnect);
    });

    it('should stop polling after stop()', async () => {
      const mockGit = mockGitWith(state);
      await fileWatcher.start(DiffMode.WORKING, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      await fileWatcher.stop();
      const callsAfterStop = mockGit.revparse.mock.calls.length;

      await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 3);

      expect(mockGit.revparse.mock.calls.length).toBe(callsAfterStop);
    });
  });

  describe('stop', () => {
    it('should clear clients', async () => {
      await fileWatcher.start(DiffMode.DEFAULT, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);
      await fileWatcher.stop();

      // After stop, adding client should work normally (clients array should be cleared)
      expect(() => fileWatcher.addClient(mockResponse)).not.toThrow();
    });
  });

  describe('client management', () => {
    it('should add and remove clients', () => {
      const mockResponse1 = { write: vi.fn() } as unknown as Response;
      const mockResponse2 = { write: vi.fn() } as unknown as Response;

      fileWatcher.addClient(mockResponse1);
      fileWatcher.addClient(mockResponse2);

      // Should send connected event to new clients
      expect(mockResponse1.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connected"'),
      );
      expect(mockResponse2.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connected"'),
      );

      fileWatcher.removeClient(mockResponse1);

      fileWatcher.broadcast({
        type: 'commentsChanged',
        version: 1,
        timestamp: new Date().toISOString(),
      });

      expect(mockResponse1.write).not.toHaveBeenCalledWith(
        expect.stringContaining('"type":"commentsChanged"'),
      );
      expect(mockResponse2.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"commentsChanged"'),
      );
    });
  });

  describe('debounce functionality', () => {
    // The poll interval is at least MIN_POLL_MS, so a debounce shorter than
    // that never collapses two polls. Use a longer window to cover several.
    const LONG_DEBOUNCE_MS = MIN_POLL_MS * 5;

    it('should send one reload for several changes inside the debounce window', async () => {
      await fileWatcher.start(DiffMode.WORKING, TEST_REPO_PATH, LONG_DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      // Each poll sees a different patch, but they all land in one window.
      state.worktreeDiff = patchFor('a.ts', 'one');
      await vi.advanceTimersByTimeAsync(MIN_POLL_MS);
      state.worktreeDiff = patchFor('a.ts', 'two');
      await vi.advanceTimersByTimeAsync(MIN_POLL_MS);
      state.worktreeDiff = patchFor('a.ts', 'three');
      await vi.advanceTimersByTimeAsync(MIN_POLL_MS);
      await vi.advanceTimersByTimeAsync(LONG_DEBOUNCE_MS);

      expect(reloadCalls()).toHaveLength(1);
    });

    it('should send a reload per change when polls are further apart than the debounce', async () => {
      await fileWatcher.start(DiffMode.WORKING, TEST_REPO_PATH, DEBOUNCE_MS);
      fileWatcher.addClient(mockResponse);

      state.worktreeDiff = patchFor('a.ts', 'one');
      await advanceToBroadcast();
      state.worktreeDiff = patchFor('a.ts', 'two');
      await advanceToBroadcast();

      expect(reloadCalls()).toHaveLength(2);
    });
  });

  describe('slow working tree scan hint', () => {
    const SLOW_MS = 200;
    let logSpy: MockInstance<typeof console.log>;

    beforeEach(() => {
      // The hint measures a real duration, so these tests need real timers.
      vi.useRealTimers();
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    function hintLines(): string[] {
      return logSpy.mock.calls.map((call) => String(call[0]));
    }

    it('should suggest both settings when neither is enabled', async () => {
      mockGitWith({ ...state, scanDelayMs: SLOW_MS, config: {} });
      await fileWatcher.start(DiffMode.DOT, TEST_REPO_PATH, DEBOUNCE_MS);

      const lines = hintLines();
      expect(lines.some((line) => line.includes('working tree scan takes'))).toBe(true);
      expect(lines.some((line) => line.includes('core.untrackedCache'))).toBe(true);
      expect(lines.some((line) => line.includes('core.fsmonitor'))).toBe(true);
    });

    it('should suggest only the setting that is not enabled', async () => {
      mockGitWith({
        ...state,
        scanDelayMs: SLOW_MS,
        config: { 'core.untrackedCache': 'true' },
      });
      await fileWatcher.start(DiffMode.DOT, TEST_REPO_PATH, DEBOUNCE_MS);

      const lines = hintLines();
      expect(lines.some((line) => line.includes('core.untrackedCache'))).toBe(false);
      expect(lines.some((line) => line.includes('core.fsmonitor'))).toBe(true);
    });

    it('should stay silent when both settings are enabled', async () => {
      mockGitWith({
        ...state,
        scanDelayMs: SLOW_MS,
        config: { 'core.untrackedCache': 'true', 'core.fsmonitor': 'true' },
      });
      await fileWatcher.start(DiffMode.DOT, TEST_REPO_PATH, DEBOUNCE_MS);

      expect(hintLines().some((line) => line.includes('working tree scan takes'))).toBe(false);
    });

    it('should stay silent when the working tree scan is fast', async () => {
      mockGitWith({ ...state, config: {} });
      await fileWatcher.start(DiffMode.DOT, TEST_REPO_PATH, DEBOUNCE_MS);

      expect(hintLines().some((line) => line.includes('working tree scan takes'))).toBe(false);
    });

    it('should stay silent in a mode that never reads the working tree', async () => {
      mockGitWith({ ...state, scanDelayMs: SLOW_MS, config: {} });
      await fileWatcher.start(DiffMode.DEFAULT, TEST_REPO_PATH, DEBOUNCE_MS);

      expect(hintLines().some((line) => line.includes('working tree scan takes'))).toBe(false);
    });
  });

  describe('change type determination', () => {
    it('should determine correct change type for each mode', async () => {
      const modes = [
        { mode: DiffMode.DEFAULT, expectedType: 'commit' },
        { mode: DiffMode.DOT, expectedType: 'commit' },
        { mode: DiffMode.STAGED, expectedType: 'staging' },
        { mode: DiffMode.WORKING, expectedType: 'file' },
      ];

      for (const { mode, expectedType } of modes) {
        const modeState: GitState = newGitState();
        mockGitWith(modeState);

        const watcher = new FileWatcherService();
        await watcher.start(mode, TEST_REPO_PATH, DEBOUNCE_MS);
        const mockClient = { write: vi.fn() } as unknown as Response;
        watcher.addClient(mockClient);

        // A new commit moves HEAD in every mode.
        modeState.head = 'def5678';
        await advanceToBroadcast();

        expect(mockClient.write).toHaveBeenCalledWith(
          expect.stringContaining(`"changeType":"${expectedType}"`),
        );

        await watcher.stop();
      }
    });
  });
});
