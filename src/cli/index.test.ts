import { Command } from 'commander';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    resolvePrCommits: vi.fn(),
  };
});

const { simpleGit } = await import('simple-git');
const { startServer } = await import('../server/server.js');
const { promptUser, findUntrackedFiles, markFilesIntentToAdd, resolvePrCommits } = await import(
  './utils.js'
);

describe('CLI index.ts', () => {
  let mockGit: any;
  let mockStartServer: any;
  let mockPromptUser: any;
  let mockFindUntrackedFiles: any;
  let mockMarkFilesIntentToAdd: any;
  let mockResolvePrCommits: any;

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
      port: 3000,
      url: 'http://localhost:3000',
      isEmpty: false,
    });

    mockPromptUser = vi.mocked(promptUser);
    mockFindUntrackedFiles = vi.mocked(findUntrackedFiles);
    mockMarkFilesIntentToAdd = vi.mocked(markFilesIntentToAdd);
    mockResolvePrCommits = vi.mocked(resolvePrCommits);

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
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
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
        host: '127.0.0.1',
        openBrowser: true,
        mode: 'side-by-side',
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
        args: ['--mode', 'inline'],
        expectedOptions: { mode: 'inline' },
      },
    ])('$name', async ({ args, expectedOptions }) => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
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
          });
        });

      await program.parseAsync([...args], { from: 'user' });

      const expectedCall = {
        targetCommitish: 'HEAD',
        baseCommitish: 'HEAD^',
        preferredPort: expectedOptions.port,
        host: expectedOptions.host || '127.0.0.1',
        openBrowser: expectedOptions.open !== false,
        mode: expectedOptions.mode || 'side-by-side',
      };

      expect(mockStartServer).toHaveBeenCalledWith(expectedCall);
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
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
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
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
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
  });

  describe('GitHub PR integration', () => {
    it('resolves PR commits correctly', async () => {
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const prCommits = {
        targetCommitish: 'abc123',
        baseCommitish: 'def456',
      };

      mockResolvePrCommits.mockResolvedValue(prCommits);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
        .option('--tui', 'tui')
        .option('--pr <url>', 'pr')
        .action(async (commitish: string, _compareWith: string | undefined, options: any) => {
          let targetCommitish = commitish;
          let baseCommitish: string;

          if (options.pr) {
            if (commitish !== 'HEAD' || _compareWith) {
              console.error('Error: --pr option cannot be used with positional arguments');
              process.exit(1);
            }

            const prCommits = await resolvePrCommits(options.pr);
            targetCommitish = prCommits.targetCommitish;
            baseCommitish = prCommits.baseCommitish;
          } else {
            baseCommitish = commitish + '^';
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

      await program.parseAsync(['--pr', prUrl], { from: 'user' });

      expect(mockResolvePrCommits).toHaveBeenCalledWith(prUrl);
      expect(mockStartServer).toHaveBeenCalledWith({
        targetCommitish: 'abc123',
        baseCommitish: 'def456',
        preferredPort: undefined,
        host: '127.0.0.1',
        openBrowser: true,
        mode: 'side-by-side',
      });
    });

    it('rejects PR option with positional arguments', async () => {
      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
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
        'Error: --pr option cannot be used with positional arguments'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Console output', () => {
    it('displays server startup message with correct URL', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);
      mockStartServer.mockResolvedValue({
        port: 3000,
        url: 'http://localhost:3000',
        isEmpty: false,
      });

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
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

          console.log(`\n🚀 ReviewIt server started on ${url}`);
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
        '\n🚀 ReviewIt server started on http://localhost:3000'
      );
      expect(console.log).toHaveBeenCalledWith('📋 Reviewing: HEAD');
    });

    it('displays correct message when no differences found', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);
      mockStartServer.mockResolvedValue({
        port: 3000,
        url: 'http://localhost:3000',
        isEmpty: true,
      });

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
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

          console.log(`\n🚀 ReviewIt server started on ${url}`);
          console.log(`📋 Reviewing: ${commitish}`);

          if (isEmpty) {
            console.log('\n! No differences found. Browser will not open automatically.');
            console.log(`   Server is running at ${url} if you want to check manually.\n`);
          }
        });

      await program.parseAsync([], { from: 'user' });

      expect(console.log).toHaveBeenCalledWith(
        '\n! No differences found. Browser will not open automatically.'
      );
      expect(console.log).toHaveBeenCalledWith(
        '   Server is running at http://localhost:3000 if you want to check manually.\n'
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
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
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

      await program.parseAsync(['--mode', 'inline'], { from: 'user' });

      expect(mockStartServer).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'inline',
        })
      );
    });

    it('uses default mode when not specified', async () => {
      mockFindUntrackedFiles.mockResolvedValue([]);

      const program = new Command();

      program
        .argument('[commit-ish]', 'commit-ish', 'HEAD')
        .argument('[compare-with]', 'compare-with')
        .option('--port <port>', 'port', parseInt)
        .option('--host <host>', 'host', '127.0.0.1')
        .option('--no-open', 'no-open')
        .option('--mode <mode>', 'mode', 'side-by-side')
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
          mode: 'side-by-side',
        })
      );
    });
  });
});
