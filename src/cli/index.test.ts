import { Command } from 'commander';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { DiffMode } from '../types/watch.js';
import { DEFAULT_DIFF_VIEW_MODE, normalizeDiffViewMode } from '../utils/diffMode.js';
import pkg from '../../package.json' with { type: 'json' };

// Mock all external dependencies
vi.mock('simple-git');
vi.mock('../server/server.js');
vi.mock('./utils.js', async () => {
  const actual = await vi.importActual('./utils.js');
  return {
    ...actual,
    promptUser: vi.fn(),
    findUntrackedFiles: vi.fn(),
    markFilesIntentToAdd: vi.fn(),
  };
});
vi.mock('./github.js', () => ({
  getPrPatch: vi.fn(),
  getPrCommentImports: vi.fn(),
}));

const { simpleGit } = await import('simple-git');
const { startServer } = await import('../server/server.js');
const {
  promptUser,
  findUntrackedFiles,
  markFilesIntentToAdd,
  parseCommentOptions,
  shouldReadStdin,
} = await import('./utils.js');
const { getPrPatch, getPrCommentImports } = await import('./github.js');

describe('CLI index.ts', () => {
  let mockGit: any;
  let mockStartServer: any;
  let mockPromptUser: any;
  let mockFindUntrackedFiles: any;
  let mockMarkFilesIntentToAdd: any;
  let mockGetPrPatch: any;
  let mockGetPrCommentImports: any;
  let actualParseCommentOptions: typeof parseCommentOptions;

  // Store original console methods
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalConsoleWarn: any;
  let originalProcessExit: any;

  beforeEach(() => {
    // Setup mocks
    mockGit = {
      status: vi.fn(),
      add: vi.fn(),
    };
    vi.mocked(simpleGit).mockReturnValue(mockGit);

    mockStartServer = vi.mocked(startServer);
    mockStartServer.mockResolvedValue({
      port: 4966,
      url: 'http://localhost:4966',
      isEmpty: false,
    });

    mockPromptUser = vi.mocked(promptUser);
    mockFindUntrackedFiles = vi.mocked(findUntrackedFiles);
    mockMarkFilesIntentToAdd = vi.mocked(markFilesIntentToAdd);
    mockGetPrPatch = vi.mocked(getPrPatch);
    mockGetPrCommentImports = vi.mocked(getPrCommentImports);
    mockGetPrCommentImports.mockResolvedValue([]);
    actualParseCommentOptions = parseCommentOptions;

    // Mock console and process.exit
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalProcessExit = process.exit;

    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    process.exit = vi.fn() as any;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    process.exit = originalProcessExit;
  });

  describe('CLI argument processing', () => {
    it.each([
      {
        name: 'default arguments',
        args: [],
        expectedSelection: { targetCommitish: 'HEAD', baseCommitish: 'HEAD^' },
      },
      {
        name: 'single commit argument',
        args: ['main'],
        expectedSelection: { targetCommitish: 'main', baseCommitish: 'main^' },
      },
      {
        name: 'two commit arguments',
        args: ['main', 'develop'],
        expectedSelection: { targetCommitish: 'main', baseCommitish: 'develop' },
      },
      {
        name: 'special: working',
        args: ['working'],
        expectedSelection: { targetCommitish: 'working', baseCommitish: 'staged' },
      },
      {
        name: 'special: staged',
        args: ['staged'],
        expectedSelection: { targetCommitish: 'staged', baseCommitish: 'HEAD' },
      },
      {
        name: 'special: dot',
        args: ['.'],
        expectedSelection: { targetCommitish: '.', baseCommitish: 'HEAD' },
      },
      {
        name: 'merge-base comparison',
        args: ['.', 'origin/main', '--merge-base'],
        expectedSelection: {
          targetCommitish: '.',
          baseCommitish: 'origin/main',
          baseMode: 'merge-base',
        },
      },
    ])('$name', async ({ args, expectedSelection }) => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      // Simulate command execution
      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--merge-base', 'merge-base')
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          // Simulate the logic from index.ts
          let targetCommitish = commitish;
          let baseCommitish: string;

          if (_compareWith) {
            baseCommitish = _compareWith;
          } else {
            if (commitish === 'working') {
              baseCommitish = 'staged';
            } else if (commitish === 'staged' || commitish === '.') {
              baseCommitish = 'HEAD';
            } else {
              baseCommitish = commitish + '^';
            }
          }

          if (commitish === 'working' || commitish === '.') {
            const git = simpleGit();
            await findUntrackedFiles(git);
            // Skip prompt logic for test
          }

          await startServer({
            selection: options.mergeBase
              ? { targetCommitish, baseCommitish, baseMode: 'merge-base' }
              : { targetCommitish, baseCommitish },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });
        });

      await program.parseAsync([...args], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith({
        selection: expectedSelection,
        preferredPort: undefined,
        host: '',
        openBrowser: true,
        mode: 'split',
      });
    });
  });

  describe('CLI options', () => {
    it.each([
      {
        name: '--port option',
        args: ['--port', '4000'],
        expectedOptions: { port: 4000 },
      },
      {
        name: '--host option',
        args: ['--host', '0.0.0.0'],
        expectedOptions: { host: '0.0.0.0' },
      },
      {
        name: '--no-open option',
        args: ['--no-open'],
        expectedOptions: { open: false },
      },
      {
        name: '--mode option',
        args: ['--mode', 'unified'],
        expectedOptions: { mode: 'unified' },
      },
      {
        name: '--mode option (legacy inline)',
        args: ['--mode', 'inline'],
        expectedOptions: { mode: 'unified' },
      },
      {
        name: '--mode option (legacy side-by-side)',
        args: ['--mode', 'side-by-side'],
        expectedOptions: { mode: 'split' },
      },
      {
        name: '--clean option',
        args: ['--clean'],
        expectedOptions: { clean: true },
      },
      {
        name: '--keep-alive option',
        args: ['--keep-alive'],
        expectedOptions: { keepAlive: true },
      },
      {
        name: '--context option',
        args: ['--context', '5'],
        expectedOptions: { context: 5 },
      },
      {
        name: '--merge-base option',
        args: ['--merge-base'],
        expectedOptions: { mergeBase: true },
      },
    ])('$name', async ({ args, expectedOptions }) => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .option('--merge-base', 'merge-base')
        .option('--clean', 'start with a clean slate by clearing all existing comments')
        .option('--keep-alive', 'keep server running even after browser disconnects')
        .option('--context <lines>', 'context', parseInt)
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          let targetCommitish = commitish;
          let baseCommitish = commitish + '^';

          await startServer({
            selection: options.mergeBase
              ? { targetCommitish, baseCommitish, baseMode: 'merge-base' }
              : { targetCommitish, baseCommitish },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            clearComments: options.clean,
            keepAlive: options.keepAlive,
            contextLines: options.context,
          });
        });

      await program.parseAsync([...args], { from: 'user' });

      const expectedCall = {
        selection: expectedOptions.mergeBase
          ? { targetCommitish: 'HEAD', baseCommitish: 'HEAD^', baseMode: 'merge-base' }
          : { targetCommitish: 'HEAD', baseCommitish: 'HEAD^' },
        preferredPort: expectedOptions.port,
        host: expectedOptions.host || '',
        openBrowser: expectedOptions.open !== false,
        mode: expectedOptions.mode || 'split',
        clearComments: expectedOptions.clean,
        keepAlive: expectedOptions.keepAlive,
        contextLines: expectedOptions.context,
      };

      expect(mockStartServer).toHaveBeenCalledWith(expectedCall);
    });
  });

  describe('--context option', () => {
    it('rejects negative values', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--context <lines>', 'context', parseInt)
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (
            options.context !== undefined &&
            (!Number.isInteger(options.context) || options.context < 0)
          ) {
            console.error('Error: --context must be a non-negative integer');
            process.exit(1);
            return;
          }

          await startServer({
            selection: { targetCommitish: commitish, baseCommitish: `${commitish}^` },
            contextLines: options.context,
          });
        });

      await program.parseAsync(['--context', '-1'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Error: --context must be a non-negative integer');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockStartServer).not.toHaveBeenCalled();
    });

    it('rejects --context with --pr', async () => {
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--context <lines>', 'context', parseInt)
        .option('--pr <url>', 'pr')
        .action(async (_commitish: string, _compareWith: string | undefined, options: any) => {
          if (options.pr && options.context !== undefined) {
            console.error('Error: --context option cannot be used with --pr');
            process.exit(1);
            return;
          }

          await startServer({
            stdinDiff: getPrPatch(options.pr),
            contextLines: options.context,
          });
        });

      await program.parseAsync(['--pr', prUrl, '--context', '3'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith(
        'Error: --context option cannot be used with --pr',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockGetPrPatch).not.toHaveBeenCalled();
      expect(mockStartServer).not.toHaveBeenCalled();
    });

    it('rejects --context with stdin diff', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--context <lines>', 'context', parseInt)
        .option('--tui', 'tui')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const readFromStdin = shouldReadStdin({
            commitish,
            hasPositionalArgs: program.args.length > 0,
            hasPrOption: false,
            hasTuiOption: Boolean(options.tui),
          });

          if (readFromStdin && options.context !== undefined) {
            console.error('Error: --context option cannot be used with stdin diff');
            process.exit(1);
            return;
          }

          await startServer({
            stdinDiff: 'diff --git a/file.ts b/file.ts',
            contextLines: options.context,
          });
        });

      await program.parseAsync(['-', '--context', '3'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith(
        'Error: --context option cannot be used with stdin diff',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });

  describe('--merge-base option', () => {
    it('rejects --merge-base with --pr', async () => {
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--merge-base', 'merge-base')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (options.pr && commitish === 'HEAD' && !_compareWith && options.mergeBase) {
            console.error('Error: --merge-base option cannot be used with --pr');
            process.exit(1);
            return;
          }

          await startServer({
            stdinDiff: getPrPatch(options.pr),
          });
        });

      await program.parseAsync(['--pr', prUrl, '--merge-base'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith(
        'Error: --merge-base option cannot be used with --pr',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockGetPrPatch).not.toHaveBeenCalled();
      expect(mockStartServer).not.toHaveBeenCalled();
    });

    it('rejects --merge-base with stdin diff', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--merge-base', 'merge-base')
        .option('--tui', 'tui')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const readFromStdin = shouldReadStdin({
            commitish,
            hasPositionalArgs: program.args.length > 0,
            hasPrOption: false,
            hasTuiOption: Boolean(options.tui),
          });

          if (readFromStdin && options.mergeBase) {
            console.error('Error: --merge-base option cannot be used with stdin diff');
            process.exit(1);
            return;
          }

          await startServer({
            stdinDiff: 'diff --git a/file.ts b/file.ts',
          });
        });

      await program.parseAsync(['-', '--merge-base'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith(
        'Error: --merge-base option cannot be used with stdin diff',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockStartServer).not.toHaveBeenCalled();
    });

    it('rejects --merge-base when the resolved base is a special argument', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--merge-base', 'merge-base')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          let baseCommitish: string;

          if (_compareWith) {
            baseCommitish = _compareWith;
          } else if (commitish === 'working') {
            baseCommitish = 'staged';
          } else if (commitish === 'staged' || commitish === '.') {
            baseCommitish = 'HEAD';
          } else {
            baseCommitish = commitish + '^';
          }

          const selection = options.mergeBase
            ? { targetCommitish: commitish, baseCommitish, baseMode: 'merge-base' as const }
            : { targetCommitish: commitish, baseCommitish };

          if (
            options.mergeBase &&
            (selection.baseCommitish === 'working' ||
              selection.baseCommitish === 'staged' ||
              selection.baseCommitish === '.')
          ) {
            console.error(
              `Error: --merge-base requires a commit-ish base, but resolved base was "${selection.baseCommitish}"`,
            );
            process.exit(1);
            return;
          }

          await startServer({ selection });
        });

      await program.parseAsync(['working', '--merge-base'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith(
        'Error: --merge-base requires a commit-ish base, but resolved base was "staged"',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });

  describe('Version option', () => {
    it('supports --version flag', async () => {
      const program = new Command();
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      program.version(pkg.version, '-v, --version', 'output the version number').exitOverride();

      try {
        await program.parseAsync(['--version'], { from: 'user' });
      } catch {
        // commander exits after printing version
      }

      expect(stdoutWrite).toHaveBeenCalledWith(`${pkg.version}\n`);
      stdoutWrite.mockRestore();
    });

    it('supports -v flag', async () => {
      const program = new Command();
      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      program.version(pkg.version, '-v, --version', 'output the version number').exitOverride();

      try {
        await program.parseAsync(['-v'], { from: 'user' });
      } catch {
        // commander exits after printing version
      }

      expect(stdoutWrite).toHaveBeenCalledWith(`${pkg.version}\n`);
      stdoutWrite.mockRestore();
    });
  });

  describe('Git operations', () => {
    it('handles untracked files for working directory', async () => {
      const untrackedFiles = ['file1.js', 'file2.js'];
      mockFindUntrackedFiles.mockResolvedValue(untrackedFiles);
      mockPromptUser.mockResolvedValue(true);
      mockMarkFilesIntentToAdd.mockResolvedValue(undefined);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (commitish === 'working' || commitish === '.') {
            const git = simpleGit();
            await findUntrackedFiles(git);
            // Skip prompt logic for test
          }

          await startServer({
            selection: { targetCommitish: commitish, baseCommitish: 'staged' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });
        });

      await program.parseAsync(['working'], { from: 'user' });

      expect(mockFindUntrackedFiles).toHaveBeenCalledWith(mockGit);
      // Note: The actual CLI uses promptUserToIncludeUntracked, not promptUser directly
      // This test verifies the Git interaction pattern
    });

    it('skips untracked file handling for regular commits', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (commitish === 'working' || commitish === '.') {
            const git = simpleGit();
            await findUntrackedFiles(git);
          }

          await startServer({
            selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });
        });

      await program.parseAsync(['HEAD'], { from: 'user' });

      expect(mockFindUntrackedFiles).not.toHaveBeenCalled();
    });

    it('automatically includes untracked files with --include-untracked flag', async () => {
      const untrackedFiles = ['new-file.ts', 'another-file.ts'];
      mockFindUntrackedFiles.mockResolvedValue(untrackedFiles);
      mockMarkFilesIntentToAdd.mockResolvedValue(undefined);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .option('--include-untracked', 'include untracked')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (commitish === 'working' || commitish === '.') {
            const git = simpleGit();
            const files = await findUntrackedFiles(git);
            if (files.length > 0 && options.includeUntracked) {
              await markFilesIntentToAdd(git, files);
            }
          }

          await startServer({
            selection: { targetCommitish: commitish, baseCommitish: 'staged' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });
        });

      await program.parseAsync(['.', '--include-untracked'], { from: 'user' });

      expect(mockFindUntrackedFiles).toHaveBeenCalledWith(mockGit);
      expect(mockMarkFilesIntentToAdd).toHaveBeenCalledWith(mockGit, untrackedFiles);
    });

    it('does not auto-include untracked files without --include-untracked flag', async () => {
      const untrackedFiles = ['new-file.ts'];
      mockFindUntrackedFiles.mockResolvedValue(untrackedFiles);
      mockMarkFilesIntentToAdd.mockResolvedValue(undefined);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .option('--include-untracked', 'include untracked')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (commitish === 'working' || commitish === '.') {
            const git = simpleGit();
            const files = await findUntrackedFiles(git);
            // Without --include-untracked, markFilesIntentToAdd should not be called automatically
            if (files.length > 0 && options.includeUntracked) {
              await markFilesIntentToAdd(git, files);
            }
          }

          await startServer({
            selection: { targetCommitish: commitish, baseCommitish: 'staged' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });
        });

      await program.parseAsync(['.'], { from: 'user' });

      expect(mockFindUntrackedFiles).toHaveBeenCalledWith(mockGit);
      expect(mockMarkFilesIntentToAdd).not.toHaveBeenCalled();
    });
  });

  describe('GitHub PR integration', () => {
    it('loads PR patch, appends manual comments after PR imports, and starts server with stdin diff', async () => {
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const prPatch = 'diff --git a/file.ts b/file.ts\nindex 1111111..2222222 100644\n';
      const prCommentImports = [
        {
          type: 'thread' as const,
          id: 'PR_COMMENT_1',
          filePath: 'src/example.ts',
          position: { side: 'new' as const, line: 10 },
          body: 'Imported PR thread',
          author: 'octocat',
          createdAt: '2026-03-25T09:00:00Z',
          updatedAt: '2026-03-25T09:05:00Z',
        },
        {
          type: 'reply' as const,
          id: 'PR_COMMENT_2',
          filePath: 'src/example.ts',
          position: { side: 'new' as const, line: 10 },
          body: 'Imported PR reply',
          author: 'hubot',
          createdAt: '2026-03-25T09:10:00Z',
          updatedAt: '2026-03-25T09:12:00Z',
        },
      ];
      mockGetPrPatch.mockReturnValue(prPatch);
      mockGetPrCommentImports.mockResolvedValue(prCommentImports);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option(
          '--comment <json>',
          'comment',
          (value: string, previous: string[]) => [...previous, value],
          [],
        )
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const manualCommentImports = actualParseCommentOptions(options.comment);
          let commentImports = manualCommentImports;

          if (options.pr) {
            if (commitish !== 'HEAD' || _compareWith) {
              console.error('Error: --pr option cannot be used with positional arguments');
              process.exit(1);
            }

            const importedPrComments = await getPrCommentImports(options.pr);
            commentImports = [...importedPrComments, ...manualCommentImports];
          }

          await startServer({
            stdinDiff: getPrPatch(options.pr),
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            commentImports,
          });
        });

      await program.parseAsync(
        [
          '--pr',
          prUrl,
          '--comment',
          '{"type":"reply","filePath":"src/example.ts","position":{"side":"new","line":10},"body":"Manual reply"}',
        ],
        { from: 'user' },
      );

      expect(mockGetPrPatch).toHaveBeenCalledWith(prUrl);
      expect(mockGetPrCommentImports).toHaveBeenCalledWith(prUrl);
      expect(mockStartServer).toHaveBeenCalledWith({
        stdinDiff: prPatch,
        preferredPort: undefined,
        host: '',
        openBrowser: true,
        mode: 'split',
        commentImports: [
          ...prCommentImports,
          {
            type: 'reply',
            id: undefined,
            filePath: 'src/example.ts',
            position: { side: 'new', line: 10 },
            body: 'Manual reply',
            author: undefined,
            createdAt: undefined,
            updatedAt: undefined,
            codeSnapshot: undefined,
          },
        ],
      });
    });

    it('continues with patch only when PR comment import fetch fails', async () => {
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const prPatch = 'diff --git a/file.ts b/file.ts\nindex 1111111..2222222 100644\n';
      mockGetPrPatch.mockReturnValue(prPatch);
      mockGetPrCommentImports.mockRejectedValue(new Error('gh api graphql failed'));

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option(
          '--comment <json>',
          'comment',
          (value: string, previous: string[]) => [...previous, value],
          [],
        )
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const manualCommentImports = actualParseCommentOptions(options.comment);
          let commentImports = manualCommentImports;

          if (options.pr) {
            if (commitish !== 'HEAD' || _compareWith) {
              console.error('Error: --pr option cannot be used with positional arguments');
              process.exit(1);
            }

            try {
              const importedPrComments = await getPrCommentImports(options.pr);
              commentImports = [...importedPrComments, ...manualCommentImports];
            } catch (error) {
              console.warn(
                `Warning: Failed to load PR review comments: ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
            }
          }

          await startServer({
            stdinDiff: getPrPatch(options.pr),
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            ...(commentImports.length > 0 ? { commentImports } : {}),
          });
        });

      await program.parseAsync(['--pr', prUrl], { from: 'user' });

      expect(console.warn).toHaveBeenCalledWith(
        'Warning: Failed to load PR review comments: gh api graphql failed',
      );
      expect(mockStartServer).toHaveBeenCalledWith({
        stdinDiff: prPatch,
        preferredPort: undefined,
        host: '',
        openBrowser: true,
        mode: 'split',
      });
    });

    it('rejects PR option with positional arguments', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (options.pr) {
            if (commitish !== 'HEAD' || _compareWith) {
              console.error('Error: --pr option cannot be used with positional arguments');
              process.exit(1);
            }
          }
        });

      await program.parseAsync(['main', '--pr', 'https://github.com/owner/repo/pull/123'], {
        from: 'user',
      });

      expect(console.error).toHaveBeenCalledWith(
        'Error: --pr option cannot be used with positional arguments',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('rejects PR option with --tui', async () => {
      const prUrl = 'https://github.com/owner/repo/pull/123';

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (options.pr) {
            if (commitish !== 'HEAD' || _compareWith) {
              console.error('Error: --pr option cannot be used with positional arguments');
              process.exit(1);
            }
            if (options.tui) {
              console.error('Error: --pr option cannot be used with --tui');
              process.exit(1);
            }
          }
        });

      await program.parseAsync(['--pr', prUrl, '--tui'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Error: --pr option cannot be used with --tui');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });

  describe('--comment option', () => {
    it('passes parsed comment imports to startServer', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .option(
          '--comment <json>',
          'comment',
          (value: string, previous: string[]) => [...previous, value],
          [],
        )
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .action(async (commitish: string, options: any) => {
          const commentImports = actualParseCommentOptions(options.comment);
          await startServer({
            selection: { targetCommitish: commitish, baseCommitish: `${commitish}^` },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            commentImports,
          });
        });

      await program.parseAsync(
        [
          '--comment',
          '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":10},"body":"Imported comment"}',
        ],
        { from: 'user' },
      );

      expect(mockStartServer).toHaveBeenCalledWith({
        selection: { targetCommitish: 'HEAD', baseCommitish: 'HEAD^' },
        preferredPort: undefined,
        host: '',
        openBrowser: true,
        mode: 'split',
        commentImports: [
          {
            type: 'thread',
            id: undefined,
            filePath: 'src/example.ts',
            position: { side: 'new', line: 10 },
            body: 'Imported comment',
            author: undefined,
            createdAt: undefined,
            updatedAt: undefined,
            codeSnapshot: undefined,
          },
        ],
      });
    });

    it('rejects --comment with --tui', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .option(
          '--comment <json>',
          'comment',
          (value: string, previous: string[]) => [...previous, value],
          [],
        )
        .option('--tui', 'tui')
        .action(async (_commitish: string, options: any) => {
          const commentImports = actualParseCommentOptions(options.comment);
          if (options.tui && commentImports.length > 0) {
            console.error('Error: --comment option cannot be used with --tui');
            process.exit(1);
          }
        });

      await program.parseAsync(
        [
          '--tui',
          '--comment',
          '{"type":"thread","filePath":"src/example.ts","position":{"side":"new","line":10},"body":"Imported comment"}',
        ],
        { from: 'user' },
      );

      expect(console.error).toHaveBeenCalledWith(
        'Error: --comment option cannot be used with --tui',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('reports invalid comment json before starting the server', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .option(
          '--comment <json>',
          'comment',
          (value: string, previous: string[]) => [...previous, value],
          [],
        )
        .action(async (_commitish: string, options: any) => {
          try {
            actualParseCommentOptions(options.comment);
          } catch (error) {
            console.error(
              `Error: ${error instanceof Error ? error.message : 'Invalid --comment value'}`,
            );
            process.exit(1);
          }
        });

      await program.parseAsync(['--comment', '{'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith('Error: Invalid --comment JSON');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockStartServer).not.toHaveBeenCalled();
    });
  });

  describe('Clean flag functionality', () => {
    it('displays clean message when flag is used', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);
      mockStartServer.mockResolvedValue({
        port: 4966,
        url: 'http://localhost:4966',
        isEmpty: false,
      });

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .option('--clean', 'start with a clean slate by clearing all existing comments')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const { url } = await startServer({
            selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            clearComments: options.clean,
          });

          console.log(`\n🚀 difit server started on ${url}`);
          console.log(`📋 Reviewing: ${commitish}`);

          if (options.clean) {
            console.log('🧹 Starting with a clean slate - all existing comments will be cleared');
          }
        });

      await program.parseAsync(['--clean'], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({
          clearComments: true,
        }),
      );
      expect(console.log).toHaveBeenCalledWith(
        '🧹 Starting with a clean slate - all existing comments will be cleared',
      );
    });

    it('does not display clean message when flag is not used', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);
      mockStartServer.mockResolvedValue({
        port: 4966,
        url: 'http://localhost:4966',
        isEmpty: false,
      });

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .option('--clean', 'start with a clean slate by clearing all existing comments')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const { url } = await startServer({
            selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            clearComments: options.clean,
          });

          console.log(`\n🚀 difit server started on ${url}`);
          console.log(`📋 Reviewing: ${commitish}`);

          if (options.clean) {
            console.log('🧹 Starting with a clean slate - all existing comments will be cleared');
          }
        });

      await program.parseAsync([], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({
          clearComments: undefined,
        }),
      );
      expect(console.log).not.toHaveBeenCalledWith(
        '🧹 Starting with a clean slate - all existing comments will be cleared',
      );
    });
  });

  describe('Keep-alive flag functionality', () => {
    it('displays keep-alive message when flag is used', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);
      mockStartServer.mockResolvedValue({
        port: 4966,
        url: 'http://localhost:4966',
        isEmpty: false,
      });

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .option('--clean', 'start with a clean slate by clearing all existing comments')
        .option('--keep-alive', 'keep server running even after browser disconnects')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const { url } = await startServer({
            selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            clearComments: options.clean,
            keepAlive: options.keepAlive,
          });

          console.log(`\n🚀 difit server started on ${url}`);
          console.log(`📋 Reviewing: ${commitish}`);

          if (options.keepAlive) {
            console.log('🔒 Keep-alive mode: server will stay running after browser disconnects');
          }
        });

      await program.parseAsync(['--keep-alive'], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({
          keepAlive: true,
        }),
      );
      expect(console.log).toHaveBeenCalledWith(
        '🔒 Keep-alive mode: server will stay running after browser disconnects',
      );
    });

    it('does not display keep-alive message when flag is not used', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);
      mockStartServer.mockResolvedValue({
        port: 4966,
        url: 'http://localhost:4966',
        isEmpty: false,
      });

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .option('--clean', 'start with a clean slate by clearing all existing comments')
        .option('--keep-alive', 'keep server running even after browser disconnects')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const { url } = await startServer({
            selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            clearComments: options.clean,
            keepAlive: options.keepAlive,
          });

          console.log(`\n🚀 difit server started on ${url}`);
          console.log(`📋 Reviewing: ${commitish}`);

          if (options.keepAlive) {
            console.log('🔒 Keep-alive mode: server will stay running after browser disconnects');
          }
        });

      await program.parseAsync([], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({
          keepAlive: undefined,
        }),
      );
      expect(console.log).not.toHaveBeenCalledWith(
        '🔒 Keep-alive mode: server will stay running after browser disconnects',
      );
    });
  });

  describe('Console output', () => {
    it('displays server startup message with correct URL', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);
      mockStartServer.mockResolvedValue({
        port: 4966,
        url: 'http://localhost:4966',
        isEmpty: false,
      });

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const { url, isEmpty } = await startServer({
            selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });

          console.log(`\n🚀 difit server started on ${url}`);
          console.log(`📋 Reviewing: ${commitish}`);

          if (isEmpty) {
            console.log('\n! No differences found. Browser will not open automatically.');
            console.log(`   Server is running at ${url} if you want to check manually.\n`);
          } else if (options.open) {
            console.log('🌐 Opening browser...\n');
          } else {
            console.log('💡 Use --open to automatically open browser\n');
          }
        });

      await program.parseAsync([], { from: 'user' });

      expect(console.log).toHaveBeenCalledWith(
        '\n🚀 difit server started on http://localhost:4966',
      );
      expect(console.log).toHaveBeenCalledWith('📋 Reviewing: HEAD');
    });

    it('displays correct message when no differences found', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);
      mockStartServer.mockResolvedValue({
        port: 4966,
        url: 'http://localhost:4966',
        isEmpty: true,
      });

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          const { url, isEmpty } = await startServer({
            selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });

          console.log(`\n🚀 difit server started on ${url}`);
          console.log(`📋 Reviewing: ${commitish}`);

          if (isEmpty) {
            console.log('\n! No differences found. Browser will not open automatically.');
            console.log(`   Server is running at ${url} if you want to check manually.\n`);
          }
        });

      await program.parseAsync([], { from: 'user' });

      expect(console.log).toHaveBeenCalledWith(
        '\n! No differences found. Browser will not open automatically.',
      );
      expect(console.log).toHaveBeenCalledWith(
        '   Server is running at http://localhost:4966 if you want to check manually.\n',
      );
    });
  });

  describe('Server mode option handling', () => {
    it('passes mode option to startServer', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          await startServer({
            selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });
        });

      await program.parseAsync(['--mode', 'unified'], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'unified',
        }),
      );
    });

    it('uses default mode when not specified', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          await startServer({
            selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });
        });

      await program.parseAsync([], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'split',
        }),
      );
    });
  });

  describe('TUI mode', () => {
    let mockRender: any;
    let mockTuiApp: any;

    const expectRenderedTuiProps = (props: Record<string, unknown>) => {
      expect(mockRender).toHaveBeenCalledTimes(1);
      expect(mockRender).toHaveBeenCalledWith({
        component: mockTuiApp,
        props,
      });
    };

    beforeEach(() => {
      mockRender = vi.fn();
      mockTuiApp = vi.fn();

      // Mock React.createElement for testing
      vi.spyOn(React, 'createElement').mockImplementation(
        (component, props) => ({ component, props }) as any,
      );

      // Mock process.stdin.isTTY
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('passes arguments to TUI app correctly', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (options.tui) {
            if (!process.stdin.isTTY) {
              console.error('Error: TUI mode requires an interactive terminal (TTY).');
              process.exit(1);
            }

            const render = mockRender;
            const TuiApp = mockTuiApp;

            render(
              React.createElement(TuiApp, {
                selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
                mode: options.mode,
              }),
            );
          }
        });

      await program.parseAsync(['main', '--tui'], { from: 'user' });

      expectRenderedTuiProps({
        selection: { targetCommitish: 'main', baseCommitish: 'main^' },
        mode: 'split',
      });
    });

    it('passes context option to TUI app', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--context <lines>', 'context', parseInt)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (options.tui) {
            const render = mockRender;
            const TuiApp = mockTuiApp;

            render(
              React.createElement(TuiApp, {
                selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
                mode: options.mode,
                contextLines: options.context,
              }),
            );
          }
        });

      await program.parseAsync(['--tui', '--context', '2'], { from: 'user' });

      expectRenderedTuiProps({
        selection: { targetCommitish: 'HEAD', baseCommitish: 'HEAD^' },
        mode: 'split',
        contextLines: 2,
      });
    });

    it('passes mode option to TUI app', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (options.tui) {
            if (!process.stdin.isTTY) {
              console.error('Error: TUI mode requires an interactive terminal (TTY).');
              process.exit(1);
            }

            const render = mockRender;
            const TuiApp = mockTuiApp;

            render(
              React.createElement(TuiApp, {
                selection: { targetCommitish: commitish, baseCommitish: commitish + '^' },
                mode: options.mode,
              }),
            );
          }
        });

      await program.parseAsync(['--tui', '--mode', 'unified'], { from: 'user' });

      expectRenderedTuiProps({
        selection: { targetCommitish: 'HEAD', baseCommitish: 'HEAD^' },
        mode: 'unified',
      });
    });

    it('handles special arguments with TUI mode', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          if (options.tui) {
            const render = mockRender;
            const TuiApp = mockTuiApp;

            let targetCommitish = commitish;
            let baseCommitish: string;

            if (commitish === 'working') {
              baseCommitish = 'staged';
            } else if (commitish === 'staged' || commitish === '.') {
              baseCommitish = 'HEAD';
            } else {
              baseCommitish = commitish + '^';
            }

            render(
              React.createElement(TuiApp, {
                selection: { targetCommitish, baseCommitish },
                mode: options.mode,
              }),
            );
          }
        });

      await program.parseAsync(['working', '--tui', '--mode', 'unified'], { from: 'user' });

      expectRenderedTuiProps({
        selection: { targetCommitish: 'working', baseCommitish: 'staged' },
        mode: 'unified',
      });
    });

    it('rejects TUI mode in non-TTY environment', async () => {
      // Mock non-TTY environment
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
      });

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (_commitish: string, _compareWith: string | undefined, options: any) => {
          if (options.tui) {
            if (!process.stdin.isTTY) {
              console.error('Error: TUI mode requires an interactive terminal (TTY).');
              console.error('Try running the command directly in your terminal without piping.');
              process.exit(1);
            }
          }
        });

      await program.parseAsync(['--tui'], { from: 'user' });

      expect(console.error).toHaveBeenCalledWith(
        'Error: TUI mode requires an interactive terminal (TTY).',
      );
      expect(console.error).toHaveBeenCalledWith(
        'Try running the command directly in your terminal without piping.',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Diff mode determination', () => {
    const testCases = [
      {
        name: 'determines DEFAULT mode for HEAD',
        args: ['HEAD'],
        expectedMode: 'default',
      },
      {
        name: 'determines WORKING mode for working',
        args: ['working'],
        expectedMode: 'working',
      },
      {
        name: 'determines STAGED mode for staged',
        args: ['staged'],
        expectedMode: 'staged',
      },
      {
        name: 'determines DOT mode for dot argument',
        args: ['.'],
        expectedMode: 'dot',
      },
      {
        name: 'determines SPECIFIC mode for commit comparison',
        args: ['abc123', 'def456'],
        expectedMode: 'specific',
      },
      {
        name: 'determines DEFAULT mode for custom commit',
        args: ['main'],
        expectedMode: 'default',
      },
    ];

    testCases.forEach(({ name, args, expectedMode }) => {
      it(name, async () => {
        mockFindUntrackedFiles.mockResolvedValue([]);

        const program = new Command();

        program
          .argument('[commit-ish]', 'commit-ish', 'HEAD')
          .argument('[compare-with]', 'compare-with')
          .option('--port <port>', 'port', parseInt)
          .option('--host <host>', 'host', '')
          .option('--no-open', 'no-open')
          .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
          .option('--tui', 'tui')
          .option('--pr <url>', 'pr')
          .action(async (commitish: string, compareWith: string | undefined, options: any) => {
            // Simulate determineDiffMode function behavior
            let diffMode: DiffMode;
            if (compareWith && commitish !== 'HEAD' && commitish !== '.') {
              diffMode = DiffMode.SPECIFIC;
            } else if (commitish === 'working') {
              diffMode = DiffMode.WORKING;
            } else if (commitish === 'staged') {
              diffMode = DiffMode.STAGED;
            } else if (commitish === '.') {
              diffMode = DiffMode.DOT;
            } else {
              diffMode = DiffMode.DEFAULT;
            }

            await startServer({
              selection: {
                targetCommitish: commitish,
                baseCommitish: compareWith || commitish + '^',
              },
              preferredPort: options.port,
              host: options.host,
              openBrowser: options.open,
              mode: options.mode,
              diffMode,
            });
          });

        await program.parseAsync(args, { from: 'user' });

        expect(mockStartServer).toHaveBeenCalledWith(
          expect.objectContaining({
            diffMode: expectedMode,
          }),
        );
      });
    });

    it('handles HEAD comparison with different commit', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, compareWith: string | undefined, options: any) => {
          // Simulate determineDiffMode function behavior
          let diffMode: DiffMode;
          if (compareWith && commitish !== 'HEAD' && commitish !== '.') {
            diffMode = DiffMode.SPECIFIC;
          } else if (commitish === 'working') {
            diffMode = DiffMode.WORKING;
          } else if (commitish === 'staged') {
            diffMode = DiffMode.STAGED;
          } else if (commitish === '.') {
            diffMode = DiffMode.DOT;
          } else {
            diffMode = DiffMode.DEFAULT;
          }

          await startServer({
            selection: {
              targetCommitish: commitish,
              baseCommitish: compareWith || commitish + '^',
            },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            diffMode,
          });
        });

      await program.parseAsync(['HEAD', 'main'], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({
          diffMode: 'default', // HEAD with comparison is still DEFAULT mode
          selection: { targetCommitish: 'HEAD', baseCommitish: 'main' },
        }),
      );
    });

    it('enables watch mode for dot with comparison', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', normalizeDiffViewMode, DEFAULT_DIFF_VIEW_MODE)
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, compareWith: string | undefined, options: any) => {
          // Simulate determineDiffMode function behavior with the fix
          let diffMode: DiffMode;
          if (compareWith && commitish !== 'HEAD' && commitish !== '.') {
            diffMode = DiffMode.SPECIFIC;
          } else if (commitish === 'working') {
            diffMode = DiffMode.WORKING;
          } else if (commitish === 'staged') {
            diffMode = DiffMode.STAGED;
          } else if (commitish === '.') {
            diffMode = DiffMode.DOT;
          } else {
            diffMode = DiffMode.DEFAULT;
          }

          await startServer({
            selection: {
              targetCommitish: commitish,
              baseCommitish: compareWith || commitish + '^',
            },
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            diffMode,
          });
        });

      await program.parseAsync(['.', 'origin/main'], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({
          diffMode: 'dot', // Dot with comparison should still be DOT mode (watch enabled)
          selection: { targetCommitish: '.', baseCommitish: 'origin/main' },
        }),
      );
    });
  });
});
