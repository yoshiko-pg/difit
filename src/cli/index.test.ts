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
    getPrPatch: vi.fn(),
  };
});

const { simpleGit } = await import('simple-git');
const { startServer } = await import('../server/server.js');
const { promptUser, findUntrackedFiles, markFilesIntentToAdd, getPrPatch } =
  await import('./utils.js');

describe('CLI index.ts', () => {
  let mockGit: any;
  let mockStartServer: any;
  let mockPromptUser: any;
  let mockFindUntrackedFiles: any;
  let mockMarkFilesIntentToAdd: any;
  let mockGetPrPatch: any;

  // Store original console methods
  let originalConsoleLog: any;
  let originalConsoleError: any;
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

    // Mock console and process.exit
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;

    console.log = vi.fn();
    console.error = vi.fn();
    process.exit = vi.fn() as any;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe('CLI argument processing', () => {
    it.each([
      {
        name: 'default arguments',
        args: [],
        expectedTarget: 'HEAD',
        expectedBase: 'HEAD^',
      },
      {
        name: 'single commit argument',
        args: ['main'],
        expectedTarget: 'main',
        expectedBase: 'main^',
      },
      {
        name: 'two commit arguments',
        args: ['main', 'develop'],
        expectedTarget: 'main',
        expectedBase: 'develop',
      },
      {
        name: 'special: working',
        args: ['working'],
        expectedTarget: 'working',
        expectedBase: 'staged',
      },
      {
        name: 'special: staged',
        args: ['staged'],
        expectedTarget: 'staged',
        expectedBase: 'HEAD',
      },
      {
        name: 'special: dot',
        args: ['.'],
        expectedTarget: '.',
        expectedBase: 'HEAD',
      },
    ])('$name', async ({ args, expectedTarget, expectedBase }) => {
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
            targetCommitish,
            baseCommitish,
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });
        });

      await program.parseAsync([...args], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith({
        targetCommitish: expectedTarget,
        baseCommitish: expectedBase,
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
        .option('--clean', 'start with a clean slate by clearing all existing comments')
        .option('--keep-alive', 'keep server running even after browser disconnects')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          let targetCommitish = commitish;
          let baseCommitish = commitish + '^';

          await startServer({
            targetCommitish,
            baseCommitish,
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
            clearComments: options.clean,
            keepAlive: options.keepAlive,
          });
        });

      await program.parseAsync([...args], { from: 'user' });

      const expectedCall = {
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort: expectedOptions.port,
        host: expectedOptions.host || '',
        openBrowser: expectedOptions.open !== false,
        mode: expectedOptions.mode || 'split',
        clearComments: expectedOptions.clean,
        keepAlive: expectedOptions.keepAlive,
      };

      expect(mockStartServer).toHaveBeenCalledWith(expectedCall);
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
            targetCommitish: commitish,
            baseCommitish: 'staged',
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
            targetCommitish: commitish,
            baseCommitish: commitish + '^',
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
            targetCommitish: commitish,
            baseCommitish: 'staged',
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
            targetCommitish: commitish,
            baseCommitish: 'staged',
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
    it('loads PR patch with gh and starts server with stdin diff', async () => {
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const prPatch = 'diff --git a/file.ts b/file.ts\nindex 1111111..2222222 100644\n';
      mockGetPrPatch.mockReturnValue(prPatch);

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

          await startServer({
            stdinDiff: getPrPatch(options.pr),
            preferredPort: options.port,
            host: options.host,
            openBrowser: options.open,
            mode: options.mode,
          });
        });

      await program.parseAsync(['--pr', prUrl], { from: 'user' });

      expect(mockGetPrPatch).toHaveBeenCalledWith(prUrl);
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
            targetCommitish: commitish,
            baseCommitish: commitish + '^',
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
            targetCommitish: commitish,
            baseCommitish: commitish + '^',
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
            targetCommitish: commitish,
            baseCommitish: commitish + '^',
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
            targetCommitish: commitish,
            baseCommitish: commitish + '^',
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
            targetCommitish: commitish,
            baseCommitish: commitish + '^',
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
            targetCommitish: commitish,
            baseCommitish: commitish + '^',
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
            targetCommitish: commitish,
            baseCommitish: commitish + '^',
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
            targetCommitish: commitish,
            baseCommitish: commitish + '^',
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

    beforeEach(async () => {
      // Mock ink and TUI components
      mockRender = vi.fn();
      mockTuiApp = vi.fn();

      vi.doMock('ink', async () => ({
        render: mockRender,
      }));

      vi.doMock('../tui/App.js', async () => ({
        default: mockTuiApp,
      }));

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
      vi.doUnmock('ink');
      vi.doUnmock('../tui/App.js');
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

            const { render } = await import('ink');
            const { default: TuiApp } = await import('../tui/App.js');

            render(
              React.createElement(TuiApp, {
                targetCommitish: commitish,
                baseCommitish: commitish + '^',
                mode: options.mode,
              }),
            );
          }
        });

      await program.parseAsync(['main', '--tui'], { from: 'user' });

      expect(mockRender).toHaveBeenCalledWith({
        component: mockTuiApp,
        props: {
          targetCommitish: 'main',
          baseCommitish: 'main^',
          mode: 'split',
        },
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

            const { render } = await import('ink');
            const { default: TuiApp } = await import('../tui/App.js');

            render(
              React.createElement(TuiApp, {
                targetCommitish: commitish,
                baseCommitish: commitish + '^',
                mode: options.mode,
              }),
            );
          }
        });

      await program.parseAsync(['--tui', '--mode', 'unified'], { from: 'user' });

      expect(mockRender).toHaveBeenCalledWith({
        component: mockTuiApp,
        props: {
          targetCommitish: 'HEAD',
          baseCommitish: 'HEAD^',
          mode: 'unified',
        },
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
            const { render } = await import('ink');
            const { default: TuiApp } = await import('../tui/App.js');

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
                targetCommitish,
                baseCommitish,
                mode: options.mode,
              }),
            );
          }
        });

      await program.parseAsync(['working', '--tui', '--mode', 'unified'], { from: 'user' });

      expect(mockRender).toHaveBeenCalledWith({
        component: mockTuiApp,
        props: {
          targetCommitish: 'working',
          baseCommitish: 'staged',
          mode: 'unified',
        },
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
              targetCommitish: commitish,
              baseCommitish: compareWith || commitish + '^',
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
            targetCommitish: commitish,
            baseCommitish: compareWith || commitish + '^',
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
          targetCommitish: 'HEAD',
          baseCommitish: 'main',
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
            targetCommitish: commitish,
            baseCommitish: compareWith || commitish + '^',
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
          targetCommitish: '.',
          baseCommitish: 'origin/main',
        }),
      );
    });
  });
});
